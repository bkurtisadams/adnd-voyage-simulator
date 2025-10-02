/**
 * Cargo Selling System
 * Handles selling cargo at ports
 */

import { CargoRegistry } from '../data/cargo.js';
import { PortRegistry } from '../data/ports.js';
import { ProficiencySystem } from './proficiency.js';

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

        // Smuggling attempt check
        let attemptSmuggling = false;
        let finalTaxAmount = 0;
        let finalTaxPercent = 0;
        let finalSmugglingNote = "";

        if (captainProficiencyScores.smuggling !== null) {
            attemptSmuggling = automateTrading ? true : await this.offerSmugglingChoice(portName, captainProficiencyScores);
        }

        const taxRoll = new Roll("2d10");
        await taxRoll.evaluate();
        finalTaxPercent = Math.clamped(taxRoll.total, 1, 100);

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
                const baseCargoValue = CargoRegistry.get(currentCargoType).baseValue * currentLoads;
                finalTaxAmount = Math.floor(baseCargoValue * (finalTaxPercent / 100)) * 10;
                finalTaxPercent = finalTaxPercent * 10;
                finalSmugglingNote = `Smuggling failed - ${finalTaxPercent}% fine`;
                voyageLogHtmlRef.value += `<p><strong>Smuggling FAILED:</strong> ${finalTaxPercent}% fine!</p>`;
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
            finalTaxAmount = Math.floor(cargoValue * (finalTaxPercent / 100));
            voyageLogHtmlRef.value += `<p><strong>Customs Tax:</strong> ${finalTaxPercent}% of ${cargoValue} gp = ${finalTaxAmount} gp.</p>`;
        }

        // Calculate sale price with all modifiers
        const saleResult = await this.calculateSalePrice(
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

        // Handle profit distribution based on trade mode
        let totalSaleValueForOwner = 0;
        let totalSaleValueToConsignor = 0;
        let crewDirectTradeEarnings = 0;

        if (tradeMode === "speculation") {
            const cargoGrossProfit = saleResult.totalSaleValue - currentPurchaseCost;
            const guildCut = cargoGrossProfit > 0 ? Math.floor(cargoGrossProfit * 0.20) : 0;
            crewDirectTradeEarnings = cargoGrossProfit > 0 ? Math.floor(cargoGrossProfit * 0.80) : 0;
            totalSaleValueForOwner = saleResult.totalSaleValue - guildCut - crewDirectTradeEarnings;

            newTreasury += totalSaleValueForOwner;
            newCrewEarningsFromTrade += crewDirectTradeEarnings;
        } else {
            // Consignment
            const commission = Math.floor(saleResult.totalSaleValue * (commissionRate / 100));
            crewDirectTradeEarnings = commission;
            totalSaleValueToConsignor = saleResult.totalSaleValue - commission;
            newCrewEarningsFromTrade += crewDirectTradeEarnings;
        }

        // Deduct tax
        if (finalTaxAmount > 0) {
            newTreasury -= finalTaxAmount;
        }

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
        // Demand modifier
        const dmRoll = new Roll("3d6");
        await dmRoll.evaluate();
        let demandMod = this.getDemandModifier(dmRoll.total);
        demandMod += portSizeMod;

        // Trade proficiency affects demand
        if (profScores.trade !== null) {
            const tradeCheck = await ProficiencySystem.makeProficiencyCheck("trade", profScores, ltSkills, crewQualityMod, 0);
            if (tradeCheck.success) {
                demandMod += 2;
            } else if (tradeCheck.roll % 2 === 1) {
                demandMod -= 2;
            }
        }

        // Distance modifier (CORRECTED - uses d6 roll, not actual distance)
        const distRoll = new Roll("1d6");
        await distRoll.evaluate();
        let distanceMod = 0;
        if (distRoll.total <= 2) distanceMod = -1;
        else if (distRoll.total <= 5) distanceMod = 0;
        else distanceMod = +2;

        // Bargaining and Appraisal for selling (CORRECTED - uses success margin)
        let sellBargAdj = 0, sellAppAdj = 0;

        if (profScores.bargaining !== null) {
            const check = await ProficiencySystem.makeProficiencyCheck("bargaining", profScores, ltSkills, crewQualityMod, 0);
            const margin = check.success ? 
                Math.clamped(check.needed - check.roll, 0, 5) : 
                -Math.clamped(check.roll - check.needed, 0, 5);
            sellBargAdj = margin;
        }

        if (profScores.appraisal !== null) {
            const check = await ProficiencySystem.makeProficiencyCheck("appraisal", profScores, ltSkills, crewQualityMod, 0);
            const margin = check.success ? 
                Math.clamped(check.needed - check.roll, 0, 5) : 
                -Math.clamped(check.roll - check.needed, 0, 5);
            sellAppAdj = margin;
        }

        // Calculate SA
        const saRoll = new Roll("3d6");
        await saRoll.evaluate();
        let saBase = saRoll.total + demandMod + distanceMod + sellBargAdj + sellAppAdj;

        // Penalty for no trading skills
        if (!profScores.bargaining && !profScores.appraisal && !profScores.trade) {
            saBase -= 2;
        }

        const saPercent = CargoRegistry.getSaleAdjustment(saBase);
        const baseValue = CargoRegistry.get(cargoType).baseValue;
        const pricePerLoad = Math.max(1, Math.floor(baseValue * saPercent / 100));
        const totalValue = pricePerLoad * loads;

        return { pricePerLoad, totalSaleValue: totalValue };
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