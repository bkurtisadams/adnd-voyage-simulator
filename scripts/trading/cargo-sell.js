/**
 * Cargo Selling System
 * Handles selling cargo at ports
 */

import { CargoRegistry } from '../data/cargo.js';
import { PortRegistry } from '../data/ports.js';
import { ProficiencySystem } from './proficiency.js';
import { CargoPerishability } from './perishability.js';

/**
 * Calculate transport fee for consignment cargo
 * Rules: 40 gp per ton (2 loads) per 500 miles, minimum 100 gp
 */
function calculateTransportFee(loads, distanceMiles) {
    const tons = loads / 2; // 2 loads = 1 ton
    const segments = Math.ceil(distanceMiles / 500); // How many 500-mile segments
    const fee = tons * 40 * segments;
    
    return Math.max(fee, 100); // Minimum 100 gp
}

export class CargoSelling {

    /**
     * Handle cargo sale at a port
     */
    static async handleCargoSale(params) {
        const {
            portId,
            currentTreasury,
            captainProficiencyScores,
            lieutenantSkills,
            automateTrading,
            currentPortActivity,
            voyageLogHtmlRef,
            currentCargoType,
            currentLoads,
            currentPurchaseCost,
            tradeMode,
            commissionRate,
            distanceTraveled,
            crewQualityMod,
            crewEarningsFromTrade
        } = params;

        const portName = PortRegistry.get(portId).name;
        const portSize = PortRegistry.get(portId).size;
        const portSizeMod = PortRegistry.getSizeModifier(portSize);

        let newTreasury = currentTreasury;
        let newCrewEarningsFromTrade = crewEarningsFromTrade;

        // Customs delay
        const cDelayRoll = new Roll("1d6");
        await cDelayRoll.evaluate();
        voyageLogHtmlRef.value += `<p><strong>Customs Delay:</strong> ${cDelayRoll.total} hours.</p>`;

        // Check if smuggling proficiency exists
        let attemptSmuggling = false;
        let finalTaxAmount = 0;
        let finalTaxPercent = 0;
        let finalSmugglingNote = "";

        // Roll for base tax rate first
        const taxRoll = new Roll("2d10");
        await taxRoll.evaluate();
        const baseTaxPercent = Math.clamp(taxRoll.total, 1, 100);

        // Calculate estimated tax for decision-making
        const baseCargoValue = CargoRegistry.get(currentCargoType).baseValue * currentLoads;
        const estimatedTax = Math.floor(baseCargoValue * (baseTaxPercent / 100));

        // Decide whether to attempt smuggling
        if (captainProficiencyScores.smuggling !== null && captainProficiencyScores.smuggling > 0) {
            if (automateTrading) {
                // Auto-decide: only smuggle if high proficiency AND high tax
                attemptSmuggling = (captainProficiencyScores.smuggling >= 12 && estimatedTax > 500);
                
                if (attemptSmuggling) {
                    voyageLogHtmlRef.value += `<p><em>Captain decides to attempt smuggling (tax would be: ${estimatedTax} gp, proficiency: ${captainProficiencyScores.smuggling})</em></p>`;
                }
            } else {
                // Manual mode - ask player
                attemptSmuggling = await this.offerSmugglingChoice(portName, captainProficiencyScores);
            }
        }

        // Process smuggling or normal customs
        if (attemptSmuggling) {
            const smugglingCheck = await ProficiencySystem.makeProficiencyCheck(
                "smuggling",
                captainProficiencyScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );

            if (smugglingCheck.success) {
                finalTaxPercent = 0;
                finalTaxAmount = 0;
                finalSmugglingNote = "Successfully avoided customs inspection";
                voyageLogHtmlRef.value += `<p><strong>Smuggling SUCCESS:</strong> No customs fees!</p>`;
            } else {
                // Failed smuggling = 10x penalty
                finalTaxAmount = estimatedTax * 10;
                finalTaxPercent = baseTaxPercent * 10;
                finalSmugglingNote = `Smuggling failed - ${finalTaxPercent}% fine`;
                voyageLogHtmlRef.value += `<p><strong>Smuggling FAILED:</strong> ${finalTaxPercent}% fine (${finalTaxAmount} gp)!</p>`;
            }
        } else {
            // Normal customs processing with appraisal
            const cargoValue = await this.processCustomsAppraisal(
                currentCargoType,
                currentLoads,
                captainProficiencyScores,
                lieutenantSkills,
                crewQualityMod,
                voyageLogHtmlRef
            );
            finalTaxPercent = baseTaxPercent;
            finalTaxAmount = Math.floor(cargoValue * (finalTaxPercent / 100));
            voyageLogHtmlRef.value += `<p><strong>Customs Tax:</strong> ${finalTaxPercent}% of ${cargoValue} gp = ${finalTaxAmount} gp.</p>`;
        }

        // Calculate sale price with all modifiers (includes distance roll)
        let saleResult = await this.calculateSalePrice(
            currentCargoType,
            currentLoads,
            portSize,
            portSizeMod,
            distanceTraveled,
            captainProficiencyScores,
            lieutenantSkills,
            crewQualityMod,
            voyageLogHtmlRef
        );

        // Check perishability using the same distance roll from sale calculation
        let actualLoads = currentLoads;
        let actualPurchaseCost = currentPurchaseCost;
        
        if (saleResult.distanceRollInfo) {
            const perishResult = await CargoPerishability.applyPerishability(
                saleResult.distanceRollInfo,
                currentLoads,
                voyageLogHtmlRef,
                portName
            );
            
            if (!perishResult.success || perishResult.loadsRemaining === 0) {
                // All cargo spoiled - return early
                return {
                    newTreasury: currentTreasury,
                    newCrewEarningsFromTrade: crewEarningsFromTrade,
                    taxAmount: 0,
                    totalSaleValueForOwner: 0,
                    spoiledAll: true
                };
            }
            
            if (perishResult.loadsLost > 0) {
                // Some cargo spoiled - recalculate sale value with remaining loads
                actualLoads = perishResult.loadsRemaining;
                actualPurchaseCost = Math.floor(currentPurchaseCost * (actualLoads / currentLoads));
                
                // Recalculate total sale value with remaining loads
                saleResult = {
                    ...saleResult,
                    totalSaleValue: saleResult.pricePerLoad * actualLoads
                };
            }
        }

        // Handle profit distribution based on trade mode
        let totalSaleValueForOwner = 0;
        let totalSaleValueToConsignor = 0;
        let crewDirectTradeEarnings = 0;

        if (tradeMode === "speculation") {
            // SPECULATION MODE (Ship Owner)
            // Rules: "A ship owner engages in speculation typically takes 50% of the profits, 
            // with the remainder split in shares amongst the captain and crew."
            
            const cargoGrossProfit = saleResult.totalSaleValue - actualPurchaseCost;
            
            voyageLogHtmlRef.value += `<p><strong>Cargo Sale:</strong> ${actualLoads} loads @ ${saleResult.pricePerLoad} gp/load = ${saleResult.totalSaleValue} gp gross.</p>`;
            
            if (cargoGrossProfit > 0) {
                // Owner gets 50% of profit, crew gets 50% of profit
                const ownerProfitShare = Math.floor(cargoGrossProfit * 0.50);
                crewDirectTradeEarnings = Math.floor(cargoGrossProfit * 0.50);
                
                // Owner receives: original investment + their share of profit
                totalSaleValueForOwner = actualPurchaseCost + ownerProfitShare;
                
                voyageLogHtmlRef.value += `<p><strong>Speculation Profit:</strong> Gross profit ${cargoGrossProfit} gp. Owner receives ${totalSaleValueForOwner} gp (cost recovery + 50% profit). Crew earns ${crewDirectTradeEarnings} gp (50% profit).</p>`;
            } else {
                // Loss or break-even - owner gets sale value, crew gets nothing
                crewDirectTradeEarnings = 0;
                totalSaleValueForOwner = saleResult.totalSaleValue;
                
                voyageLogHtmlRef.value += `<p><strong>Speculation Loss:</strong> Purchased for ${actualPurchaseCost} gp, sold for ${saleResult.totalSaleValue} gp. Loss: ${Math.abs(cargoGrossProfit)} gp. Owner receives ${totalSaleValueForOwner} gp.</p>`;
            }
            
            newTreasury += totalSaleValueForOwner;
            newCrewEarningsFromTrade += crewDirectTradeEarnings;
            
        } else {
            // CONSIGNMENT MODE
            // Rules: "The captain or guild representative sells the cargo for the best possible price, 
            // with 10-40% of the sale to the ship's crew."
            
            // Crew gets their commission (10-40% of sale, based on commissionRate setting)
            const crewCommission = Math.floor(saleResult.totalSaleValue * (commissionRate / 100));
            crewDirectTradeEarnings = crewCommission;
            
            // Consignor gets the rest
            totalSaleValueToConsignor = saleResult.totalSaleValue - crewCommission;
            
            // Calculate transport fee: 40 gp per ton (2 loads) per 500 miles
            // Get the distance for this leg (passed in as distanceTraveled)
            const transportFee = calculateTransportFee(currentLoads, distanceTraveled);
            
            // Owner receives second half of transport fee (first half was paid upfront)
            const deliveryPayment = Math.floor(transportFee / 2);
            totalSaleValueForOwner = deliveryPayment;
            
            voyageLogHtmlRef.value += `<p><strong>Transport Fee (delivery payment):</strong> ${deliveryPayment} gp (${transportFee} gp total for ${distanceTraveled} miles)</p>`;
            
            newTreasury += totalSaleValueForOwner;
            newCrewEarningsFromTrade += crewDirectTradeEarnings;
        }

        // Deduct tax from owner's treasury
        if (finalTaxAmount > 0) {
            newTreasury -= finalTaxAmount;
        }

        // Log final treasury change summary
        const treasuryChange = newTreasury - currentTreasury;
        const changeSign = treasuryChange >= 0 ? '+' : '';
        voyageLogHtmlRef.value += `<p><strong>Treasury Update:</strong> ${currentTreasury} gp → ${newTreasury} gp (${changeSign}${treasuryChange} gp from this sale)</p>`;

        return {
            loadsSold: currentLoads,
            salePricePerLoad: saleResult.pricePerLoad,
            totalSaleValueToConsignor,
            totalSaleValueForOwner,
            taxAmount: finalTaxAmount,
            taxPercentFinal: finalTaxPercent,
            smugglingNote: finalSmugglingNote,
            crewDirectTradeEarnings,
            newCrewEarningsFromTrade,
            newTreasury,
            cargoType: currentCargoType,
            action: "sold"
        };
    }

    static async processCustomsAppraisal(cargoType, loads, profScores, ltSkills, crewQualityMod, logRef) {
        const baseValue = CargoRegistry.get(cargoType).baseValue * loads;
        let adjustmentPercent = 0;

        if (profScores.appraisal !== null) {
            const aprCheck = await ProficiencySystem.makeProficiencyCheck(
                "appraisal",
                profScores,
                ltSkills,
                crewQualityMod,
                0
            );

            if (!aprCheck.success && aprCheck.roll % 2 === 1) {
                const failureMargin = aprCheck.roll - aprCheck.needed;
                adjustmentPercent = -(failureMargin * 5);
            }
        }

        return Math.max(0, Math.floor(baseValue * (100 + adjustmentPercent) / 100));
    }

    static async calculateSalePrice(cargoType, loads, portSize, portSizeMod, distance, profScores, ltSkills, crewQualityMod, logRef) {
        // Demand modifier: 3d6 roll, modified +4 by successful Trade proficiency
        const dmRoll = new Roll("3d6");
        await dmRoll.evaluate();
        
        let demandRollModified = dmRoll.total;
        let tradeNote = "";
        
        // Trade proficiency modifies the demand ROLL by +4 (per rules)
        if (profScores.trade !== null) {
            const tradeCheck = await ProficiencySystem.makeProficiencyCheck("trade", profScores, ltSkills, crewQualityMod, 0);
            if (tradeCheck.success) {
                demandRollModified += 4;
                tradeNote = " (Trade +4)";
            } else if (tradeCheck.roll % 2 === 1) {
                demandRollModified -= 4; // Inverse on odd failure
                tradeNote = " (Trade -4, odd fail)";
            }
        }
        
        let demandMod = this.getDemandModifier(demandRollModified);
        demandMod += portSizeMod;

        // Distance modifier (d6 roll determines both price modifier AND perishability threshold)
        // Per rules: Short (1-2, <80mi, -1), Medium (3-5, ≤250mi, 0), Long (6, ≤500mi, +2), Extraordinary (>500mi, +4)
        const distRoll = new Roll("1d6");
        await distRoll.evaluate();
        
        let distanceMod = 0;
        let distanceCategory = "Medium";
        let distanceThreshold = 250;
        
        // Check for Extraordinary first (actual distance > 500 miles overrides roll)
        if (distance > 500) {
            distanceMod = +4;
            distanceCategory = "Extraordinary";
            distanceThreshold = 500;
        } else if (distRoll.total <= 2) {
            distanceMod = -1;
            distanceCategory = "Short";
            distanceThreshold = 80;
        } else if (distRoll.total <= 5) {
            distanceMod = 0;
            distanceCategory = "Medium";
            distanceThreshold = 250;
        } else {
            distanceMod = +2;
            distanceCategory = "Long";
            distanceThreshold = 500;
        }
        
        // Store for perishability check
        this._lastDistanceRoll = {
            roll: distRoll.total,
            category: distanceCategory,
            threshold: distanceThreshold,
            actualDistance: distance
        };

        // Bargaining and Appraisal: +1 to SA roll for success, -1 for odd failure (per rules)
        // The margin-based 5% bonus applies to FINAL price, not SA roll
        let sellBargAdj = 0, sellAppAdj = 0;
        let bargainMargin = 0, appraisalMargin = 0;

        if (profScores.bargaining !== null) {
            const check = await ProficiencySystem.makeProficiencyCheck("bargaining", profScores, ltSkills, crewQualityMod, 0);
            if (check.success) {
                sellBargAdj = +1;
                bargainMargin = Math.min(5, check.needed - check.roll); // For final price bonus
            } else if (check.roll % 2 === 1) {
                sellBargAdj = -1; // Inverse on odd failure
            }
        }

        if (profScores.appraisal !== null) {
            const check = await ProficiencySystem.makeProficiencyCheck("appraisal", profScores, ltSkills, crewQualityMod, 0);
            if (check.success) {
                sellAppAdj = +1;
                appraisalMargin = Math.min(5, check.needed - check.roll);
            } else if (check.roll % 2 === 1) {
                sellAppAdj = -1; // Inverse on odd failure
            }
        }

        // Calculate SA roll
        const saRoll = new Roll("3d6");
        await saRoll.evaluate();
        let saBase = saRoll.total + demandMod + distanceMod + sellBargAdj + sellAppAdj;

        // Penalty for no trading skills
        let noSkillsPenalty = 0;
        if (!profScores.bargaining && !profScores.appraisal && !profScores.trade) {
            noSkillsPenalty = -2;
            saBase -= 2;
        }

        const saPercent = CargoRegistry.getSaleAdjustment(saBase);
        const baseValue = CargoRegistry.get(cargoType).baseValue;
        
        // Apply bargaining margin bonus to final price (5% per point, max 25%)
        const bargainBonus = Math.min(25, bargainMargin * 5);
        const finalPercent = Math.floor(saPercent * (100 + bargainBonus) / 100);
        
        const pricePerLoad = Math.max(1, Math.floor(baseValue * finalPercent / 100));
        const totalValue = pricePerLoad * loads;

        // Log the SA calculation for debugging
        logRef.value += `<p><em>Sale Price Calc: SA Roll ${saRoll.total} + Demand ${demandMod}${tradeNote} + Distance ${distanceMod} (${distanceCategory}) + Barg ${sellBargAdj} + App ${sellAppAdj}${noSkillsPenalty ? ' - 2 (no skills)' : ''} = ${saBase} → ${saPercent}%${bargainBonus > 0 ? ` (+${bargainBonus}% bargain bonus) = ${finalPercent}%` : ''} of ${baseValue} gp = ${pricePerLoad} gp/load</em></p>`;

        return { 
            pricePerLoad, 
            totalSaleValue: totalValue,
            distanceRollInfo: this._lastDistanceRoll
        };
    }

    static getDemandModifier(roll) {
        if (roll <= 3) return -5;
        if (roll <= 5) return -4;
        if (roll === 6) return -3;
        if (roll === 7) return -2;
        if (roll <= 9) return -1;
        if (roll <= 11) return 0;
        if (roll <= 13) return +1;
        if (roll === 14) return +2;
        if (roll === 15) return +3;
        if (roll <= 17) return +4;
        return +5;
    }

    static async offerSmugglingChoice(portName, profScores) {
        return new Promise((resolve) => {
            new Dialog({
                title: `Smuggling Opportunity - ${portName}`,
                content: `
                    <p>Attempt to avoid customs?</p>
                    <p><strong>Success:</strong> No fees</p>
                    <p><strong>Failure:</strong> 10× penalty</p>
                    <p><strong>Your Score:</strong> ${profScores.smuggling}</p>
                `,
                buttons: {
                    attempt: { label: "Smuggle", callback: () => resolve(true) },
                    legal: { label: "Pay Customs", callback: () => resolve(false) }
                },
                default: "legal"
            }).render(true);
        });
    }
}