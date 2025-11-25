import { CargoRegistry } from '../data/cargo.js';
import { PortRegistry } from '../data/ports.js';
import { ProficiencySystem } from './proficiency.js';
import { CargoPerishability } from './perishability.js';
import { PortAgentSystem } from './port-agent.js';

function calculateTransportFee(loads, distanceMiles) {
    const tons = loads / 2;
    const segments = Math.ceil(distanceMiles / 500);
    const fee = tons * 40 * segments;
    return Math.max(fee, 100);
}

export class CargoSelling {

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

        const port = PortRegistry.get(portId);
        const portName = port.name;
        const portSize = port.size;
        const portSizeMod = PortRegistry.getSizeModifier(portSize);

        let newTreasury = currentTreasury;
        let newCrewEarningsFromTrade = crewEarningsFromTrade;

        // Check for port agent usage
        let useAgent = false;
        let agent = null;
        let agentFee = 0;
        const agentAvailable = PortAgentSystem.isAvailable(portSize);

        if (automateTrading) {
            useAgent = PortAgentSystem.shouldAutoHire(captainProficiencyScores, portSize);
            if (useAgent) {
                agent = await PortAgentSystem.generateAgent();
                voyageLogHtmlRef.value += `<p><strong>Port Agent Hired (Sale):</strong> Skill ${agent.skillScore}, Fee ${agent.feePercent}%</p>`;
            }
        } else if (agentAvailable) {
            useAgent = await this.offerAgentChoice(portName, captainProficiencyScores, "sell");
            if (useAgent) {
                agent = await PortAgentSystem.generateAgent();
                voyageLogHtmlRef.value += `<p><strong>Port Agent Hired (Sale):</strong> Skill ${agent.skillScore}, Fee ${agent.feePercent}%</p>`;
            }
        }

        const effectiveSkills = useAgent ? agent.proficiencyScores : captainProficiencyScores;

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

        // Decide whether to attempt smuggling (only captain can smuggle, not agent)
        if (!useAgent && captainProficiencyScores.smuggling !== null && captainProficiencyScores.smuggling > 0) {
            if (automateTrading) {
                attemptSmuggling = (captainProficiencyScores.smuggling >= 12 && estimatedTax > 500);
                
                if (attemptSmuggling) {
                    voyageLogHtmlRef.value += `<p><em>Captain decides to attempt smuggling (tax would be: ${estimatedTax} gp, proficiency: ${captainProficiencyScores.smuggling})</em></p>`;
                }
            } else {
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
                finalTaxAmount = estimatedTax * 10;
                finalTaxPercent = baseTaxPercent * 10;
                finalSmugglingNote = `Smuggling failed - ${finalTaxPercent}% fine`;
                voyageLogHtmlRef.value += `<p><strong>Smuggling FAILED:</strong> ${finalTaxPercent}% fine (${finalTaxAmount} gp)!</p>`;
            }
        } else {
            const cargoValue = await this.processCustomsAppraisal(
                currentCargoType,
                currentLoads,
                effectiveSkills,
                useAgent ? {} : lieutenantSkills,
                useAgent ? 0 : crewQualityMod,
                voyageLogHtmlRef,
                useAgent
            );
            finalTaxPercent = baseTaxPercent;
            finalTaxAmount = Math.floor(cargoValue * (finalTaxPercent / 100));
            voyageLogHtmlRef.value += `<p><strong>Customs Tax:</strong> ${finalTaxPercent}% of ${cargoValue} gp = ${finalTaxAmount} gp.</p>`;
        }

        // Calculate sale price with all modifiers (includes distance roll)
        // Agent imposes -1 demand penalty
        let saleResult = await this.calculateSalePrice(
            currentCargoType,
            currentLoads,
            portSize,
            portSizeMod,
            distanceTraveled,
            effectiveSkills,
            useAgent ? {} : lieutenantSkills,
            useAgent ? 0 : crewQualityMod,
            voyageLogHtmlRef,
            useAgent // agentPenalty flag
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
                return {
                    newTreasury: currentTreasury,
                    newCrewEarningsFromTrade: crewEarningsFromTrade,
                    taxAmount: 0,
                    totalSaleValueForOwner: 0,
                    spoiledAll: true
                };
            }
            
            if (perishResult.loadsLost > 0) {
                actualLoads = perishResult.loadsRemaining;
                actualPurchaseCost = Math.floor(currentPurchaseCost * (actualLoads / currentLoads));
                
                saleResult = {
                    ...saleResult,
                    totalSaleValue: saleResult.pricePerLoad * actualLoads
                };
            }
        }

        // Calculate agent fee on sale
        if (useAgent) {
            agentFee = PortAgentSystem.calculateFee(saleResult.totalSaleValue, agent.feePercent);
            voyageLogHtmlRef.value += `<p><strong>Agent Fee (Sale):</strong> ${agentFee} gp (${agent.feePercent}% of ${saleResult.totalSaleValue} gp)</p>`;
        }

        // Handle profit distribution based on trade mode
        let totalSaleValueForOwner = 0;
        let totalSaleValueToConsignor = 0;
        let crewDirectTradeEarnings = 0;

        if (tradeMode === "speculation") {
            const cargoGrossProfit = saleResult.totalSaleValue - actualPurchaseCost - agentFee;
            
            voyageLogHtmlRef.value += `<p><strong>Cargo Sale:</strong> ${actualLoads} loads @ ${saleResult.pricePerLoad} gp/load = ${saleResult.totalSaleValue} gp gross.</p>`;
            
            if (cargoGrossProfit > 0) {
                const ownerProfitShare = Math.floor(cargoGrossProfit * 0.50);
                const crewProfitShare = cargoGrossProfit - ownerProfitShare;
                
                totalSaleValueForOwner = actualPurchaseCost + ownerProfitShare;
                crewDirectTradeEarnings = crewProfitShare;
                newCrewEarningsFromTrade += crewProfitShare;
                
                voyageLogHtmlRef.value += `<p><strong>Speculation Profit:</strong> ${cargoGrossProfit} gp (Sale ${saleResult.totalSaleValue} - Cost ${actualPurchaseCost}${agentFee > 0 ? ` - Agent ${agentFee}` : ''})</p>`;
                voyageLogHtmlRef.value += `<p><em>Owner: ${ownerProfitShare} gp (50%), Crew: ${crewProfitShare} gp (50%)</em></p>`;
            } else {
                totalSaleValueForOwner = saleResult.totalSaleValue - agentFee;
                voyageLogHtmlRef.value += `<p><strong>Speculation Loss:</strong> ${Math.abs(cargoGrossProfit)} gp</p>`;
            }
        } else if (tradeMode === "consignment") {
            const commissionAmount = Math.floor(saleResult.totalSaleValue * (commissionRate / 100));
            const crewCommissionShare = Math.floor(commissionAmount * 0.40);
            const ownerCommissionShare = commissionAmount - crewCommissionShare;
            
            totalSaleValueToConsignor = saleResult.totalSaleValue - commissionAmount;
            totalSaleValueForOwner = ownerCommissionShare;
            crewDirectTradeEarnings = crewCommissionShare;
            newCrewEarningsFromTrade += crewCommissionShare;
            
            const transportFee = calculateTransportFee(currentLoads, distanceTraveled);
            const deliveryPayment = Math.floor(transportFee / 2);
            totalSaleValueForOwner += deliveryPayment;
            
            voyageLogHtmlRef.value += `<p><strong>Consignment Sale:</strong> ${saleResult.totalSaleValue} gp</p>`;
            voyageLogHtmlRef.value += `<p><strong>Commission (${commissionRate}%):</strong> ${commissionAmount} gp (Owner: ${ownerCommissionShare}, Crew: ${crewCommissionShare})</p>`;
            voyageLogHtmlRef.value += `<p><strong>Transport Fee (delivery):</strong> ${deliveryPayment} gp</p>`;
        }

        // Apply customs tax
        newTreasury += totalSaleValueForOwner;
        newTreasury -= finalTaxAmount;

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
            agentFee,
            action: "sold"
        };
    }

    static async processCustomsAppraisal(cargoType, loads, profScores, ltSkills, crewQualityMod, logRef, useAgent = false) {
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

    static async calculateSalePrice(cargoType, loads, portSize, portSizeMod, distance, profScores, ltSkills, crewQualityMod, logRef, agentPenalty = false) {
        // Demand modifier: 3d6 roll, modified +4 by successful Trade proficiency
        const dmRoll = new Roll("3d6");
        await dmRoll.evaluate();
        
        let demandRollModified = dmRoll.total;
        let tradeNote = "";
        
        // Trade proficiency modifies the demand ROLL by +4 (per rules)
        // Note: agents don't have Trade skill
        if (profScores.trade !== null) {
            const tradeCheck = await ProficiencySystem.makeProficiencyCheck("trade", profScores, ltSkills, crewQualityMod, 0);
            if (tradeCheck.success) {
                demandRollModified += 4;
                tradeNote = " (Trade +4)";
            } else if (tradeCheck.roll % 2 === 1) {
                demandRollModified -= 4;
                tradeNote = " (Trade -4, odd fail)";
            }
        }
        
        let demandMod = this.getDemandModifier(demandRollModified);
        demandMod += portSizeMod;

        // Agent penalty: -1 to demand
        let agentNote = "";
        if (agentPenalty) {
            demandMod -= 1;
            agentNote = " - Agent -1";
        }

        // Distance modifier
        const distRoll = new Roll("1d6");
        await distRoll.evaluate();
        
        let distanceMod = 0;
        let distanceCategory = "Medium";
        let distanceThreshold = 250;
        
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
        
        this._lastDistanceRoll = {
            roll: distRoll.total,
            category: distanceCategory,
            threshold: distanceThreshold,
            actualDistance: distance
        };

        // Precious goods: 10% chance of Extraordinary (+4)
        let preciousBonus = 0;
        let preciousNote = "";
        if (cargoType === "precious") {
            const preciousRoll = new Roll("1d100");
            await preciousRoll.evaluate();
            if (preciousRoll.total <= 10) {
                preciousBonus = 4;
                preciousNote = " + Precious +4";
            }
        }

        // Bargaining and Appraisal
        let sellBargAdj = 0, sellAppAdj = 0;
        let bargainMargin = 0;

        if (profScores.bargaining !== null) {
            const check = await ProficiencySystem.makeProficiencyCheck("bargaining", profScores, ltSkills, crewQualityMod, 0);
            if (check.success) {
                sellBargAdj = +1;
                bargainMargin = Math.min(5, check.needed - check.roll);
            } else if (check.roll % 2 === 1) {
                sellBargAdj = -1;
            }
        }

        if (profScores.appraisal !== null) {
            const check = await ProficiencySystem.makeProficiencyCheck("appraisal", profScores, ltSkills, crewQualityMod, 0);
            if (check.success) {
                sellAppAdj = +1;
            } else if (check.roll % 2 === 1) {
                sellAppAdj = -1;
            }
        }

        // Calculate SA roll
        const saRoll = new Roll("3d6");
        await saRoll.evaluate();
        let saBase = saRoll.total + demandMod + distanceMod + preciousBonus + sellBargAdj + sellAppAdj;

        // Penalty for no trading skills
        let noSkillsPenalty = 0;
        if (!profScores.bargaining && !profScores.appraisal && !profScores.trade) {
            noSkillsPenalty = -2;
            saBase -= 2;
        }

        const saPercent = CargoRegistry.getSaleAdjustment(saBase);
        const baseValue = CargoRegistry.get(cargoType).baseValue;
        
        const bargainBonus = Math.min(25, bargainMargin * 5);
        const finalPercent = Math.floor(saPercent * (100 + bargainBonus) / 100);
        
        const pricePerLoad = Math.max(1, Math.floor(baseValue * finalPercent / 100));
        const totalValue = pricePerLoad * loads;

        logRef.value += `<p><em>Sale Price Calc: SA Roll ${saRoll.total} + Demand ${demandMod}${tradeNote}${agentNote} + Distance ${distanceMod} (${distanceCategory})${preciousNote} + Barg ${sellBargAdj} + App ${sellAppAdj}${noSkillsPenalty ? ' - 2 (no skills)' : ''} = ${saBase} → ${saPercent}%${bargainBonus > 0 ? ` (+${bargainBonus}% bargain bonus) = ${finalPercent}%` : ''} of ${baseValue} gp = ${pricePerLoad} gp/load</em></p>`;

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

    static async offerAgentChoice(portName, profScores, mode) {
        const hasBargaining = profScores.bargaining !== null;
        const hasAppraisal = profScores.appraisal !== null;
        
        return new Promise((resolve) => {
            new Dialog({
                title: `Port Agent - ${portName}`,
                content: `
                    <p>A port agent offers to handle the ${mode}.</p>
                    <p><strong>Agent Benefits:</strong> Skilled Bargaining & Appraisal</p>
                    <p><strong>Agent Costs:</strong> Fee 7-25%${mode === 'sell' ? ', -1 demand' : ''}</p>
                    <p><em>Your skills: Bargaining ${hasBargaining ? '✓' : '✗'}, Appraisal ${hasAppraisal ? '✓' : '✗'}</em></p>
                `,
                buttons: {
                    hire: { label: "Hire Agent", callback: () => resolve(true) },
                    decline: { label: "Handle Myself", callback: () => resolve(false) }
                },
                default: "decline"
            }).render(true);
        });
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