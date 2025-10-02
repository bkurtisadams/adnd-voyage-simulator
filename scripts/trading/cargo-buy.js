/**
 * Cargo Purchasing System
 * Handles buying cargo at ports
 */

import { CargoRegistry } from '../data/cargo.js';
import { PortRegistry } from '../data/ports.js';
import { ProficiencySystem } from './proficiency.js';

export class CargoPurchasing {

    /**
     * Handle cargo purchase at a port
     */
    static async handleCargoPurchase(params) {
        const {
            portId,
            shipTemplate,
            currentTreasury: initialTreasury,
            captainProficiencyScores,
            lieutenantSkills,
            automateTrading,
            currentPortActivity,
            voyageLogHtmlRef,
            tradeMode,
            commissionRate,
            crewQualityMod
        } = params;
        let treasury = initialTreasury;

        let purchasedCargoType = null;
        let purchasedLoads = 0;
        let purchasePricePerLoad = 0;
        let totalPurchaseCost = 0;
        let additionalDays = 0;

        const portName = PortRegistry.get(portId).name;
        const portSizeMod = PortRegistry.getSizeModifier(PortRegistry.get(portId).size);
        const shipCapacity = shipTemplate.cargoCapacity;

        // Consignment mode - no purchasing
        if (tradeMode === "consignment") {
            voyageLogHtmlRef.value += `<p><em>Consignment mode: No cargo purchased at ${portName}.</em></p>`;
            return {
                newTreasury: treasury,
                cargoType: null,
                loadsBought: 0,
                purchasePricePerLoad: 0,
                totalPurchaseCost: 0,
                additionalDays: 0
            };
        }

        // Determine merchant availability
        const merchantRoll = new Roll("1d6");
        await merchantRoll.evaluate();
        let merchantCount = Math.max(1, merchantRoll.total + portSizeMod);
        
        voyageLogHtmlRef.value += `<p><strong>Merchants in ${portName}:</strong> ${merchantCount} available.</p>`;
        currentPortActivity.activities.push(`Detected ${merchantCount} merchants in port.`);

        // Determine cargo type available
        const baseRollObj = new Roll("3d6");
        await baseRollObj.evaluate();
        let rawBaseTypeRoll = baseRollObj.total;
        let finalBaseTypeRoll = rawBaseTypeRoll + portSizeMod;

        // Apply Appraisal skill
        let appraisalAdjust = 0;
        if (captainProficiencyScores.appraisal !== null) {
            const appCheck = await ProficiencySystem.makeProficiencyCheck(
                "appraisal",
                captainProficiencyScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );
            
            if (appCheck.success) {
                appraisalAdjust = +1;
                voyageLogHtmlRef.value += `<p><strong>Appraisal Check:</strong> SUCCESS (${appCheck.roll} ≤ ${appCheck.needed}) → +1 to goods quality.</p>`;
            } else {
                if (appCheck.roll % 2 === 1) {
                    appraisalAdjust = -1;
                    voyageLogHtmlRef.value += `<p><strong>Appraisal Check:</strong> FAILED (${appCheck.roll} > ${appCheck.needed}, odd roll) → -1 to goods quality.</p>`;
                } else {
                    voyageLogHtmlRef.value += `<p><strong>Appraisal Check:</strong> FAILED (${appCheck.roll} > ${appCheck.needed}, even roll) → no penalty.</p>`;
                }
            }
        }

        finalBaseTypeRoll = Math.clamped(finalBaseTypeRoll + appraisalAdjust, 3, 20);

        const determinedCargoKey = CargoRegistry.determineTypeFromRoll(finalBaseTypeRoll);
        const determinedCargo = CargoRegistry.get(determinedCargoKey);

        // Determine quantity available
        const qtyRollObj = new Roll("3d8");
        await qtyRollObj.evaluate();
        let qtyAvailable = Math.max(1, qtyRollObj.total - rawBaseTypeRoll);

        voyageLogHtmlRef.value += `<p><strong>Available Cargo:</strong> ${qtyAvailable} loads of ${determinedCargo.name} @ ${determinedCargo.baseValue} gp/load.</p>`;

        // Apply Bargaining skill
        let bargainAdjustPercent = 0;
        if (captainProficiencyScores.bargaining !== null) {
            const bargainCheck = await ProficiencySystem.makeProficiencyCheck(
                "bargaining",
                captainProficiencyScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );

            if (bargainCheck.success) {
                const successMargin = Math.clamped(bargainCheck.needed - bargainCheck.roll, 0, 5);
                bargainAdjustPercent = -(successMargin * 5);
                voyageLogHtmlRef.value += `<p><strong>Bargaining (Buy):</strong> SUCCESS (margin: ${successMargin}) → ${Math.abs(bargainAdjustPercent)}% discount.</p>`;
            } else {
                const failureMargin = Math.clamped(bargainCheck.roll - bargainCheck.needed, 0, 5);
                bargainAdjustPercent = (failureMargin * 5);
                voyageLogHtmlRef.value += `<p><strong>Bargaining (Buy):</strong> FAILED (margin: ${failureMargin}) → +${bargainAdjustPercent}% penalty.</p>`;
            }
        }

        purchasePricePerLoad = Math.max(1, Math.floor(determinedCargo.baseValue * (100 + bargainAdjustPercent) / 100));

        // Automated or manual purchase decision
        if (automateTrading) {
            purchasedLoads = Math.min(shipCapacity, qtyAvailable);
            totalPurchaseCost = purchasePricePerLoad * purchasedLoads;

            if (totalPurchaseCost > treasury) {
                purchasedLoads = Math.floor(treasury / purchasePricePerLoad);
                totalPurchaseCost = purchasePricePerLoad * purchasedLoads;
            }

            if (purchasedLoads > 0) {
                treasury -= totalPurchaseCost;
                voyageLogHtmlRef.value += `<p><strong>Automated Purchase:</strong> Bought ${purchasedLoads} loads @ ${purchasePricePerLoad} gp/load (Total: ${totalPurchaseCost} gp).</p>`;
                currentPortActivity.trading = {
                    type: "purchase",
                    cargoType: determinedCargo.name,
                    loads: purchasedLoads,
                    pricePerLoad: purchasePricePerLoad,
                    totalCost: totalPurchaseCost
                };
            }
        } else {
            // Manual purchase dialog
            const maxAffordable = Math.floor(treasury / purchasePricePerLoad);
            const maxPurchasable = Math.min(shipCapacity, qtyAvailable, maxAffordable);

            const playerDecision = await new Promise((resolve) => {
                new Dialog({
                    title: `Purchase Cargo at ${portName}`,
                    content: `
                        <p>A merchant offers <strong>${qtyAvailable} loads of ${determinedCargo.name}</strong> 
                        at <strong>${purchasePricePerLoad} gp/load</strong>.</p>
                        <p>You have <strong>${treasury} gp</strong>. 
                        Ship capacity: <strong>${shipCapacity} loads</strong>.</p>
                        <p>How many loads to buy? (Max: ${maxPurchasable})</p>
                        <input type="number" id="loadsToBuy" min="0" max="${maxPurchasable}" 
                               value="${maxPurchasable}" style="width: 100%;">
                    `,
                    buttons: {
                        buy: {
                            label: "Buy Cargo",
                            callback: (html) => {
                                let numLoads = parseInt(html.find("#loadsToBuy").val()) || 0;
                                numLoads = Math.clamped(numLoads, 0, maxPurchasable);
                                const cost = numLoads * purchasePricePerLoad;
                                
                                if (cost > treasury) {
                                    ui.notifications.error("Insufficient funds!");
                                    resolve({ loads: 0, cost: 0, action: "insufficient_funds" });
                                } else {
                                    resolve({ loads: numLoads, cost: cost, action: "buy" });
                                }
                            }
                        },
                        done: {
                            label: "Done Trading",
                            callback: () => resolve({ loads: 0, cost: 0, action: "done" })
                        }
                    },
                    default: "buy"
                }).render(true);
            });

            if (playerDecision.action === "buy" && playerDecision.loads > 0) {
                purchasedLoads = playerDecision.loads;
                totalPurchaseCost = playerDecision.cost;
                treasury -= totalPurchaseCost;

                voyageLogHtmlRef.value += `<p><strong>Manual Purchase:</strong> Bought ${purchasedLoads} loads @ ${purchasePricePerLoad} gp/load (Total: ${totalPurchaseCost} gp).</p>`;
                currentPortActivity.trading = {
                    type: "purchase",
                    cargoType: determinedCargo.name,
                    loads: purchasedLoads,
                    pricePerLoad: purchasePricePerLoad,
                    totalCost: totalPurchaseCost
                };
            }

            return {
                newTreasury: treasury,
                cargoType: determinedCargoKey,
                loadsBought: purchasedLoads,
                purchasePricePerLoad: purchasePricePerLoad,
                totalPurchaseCost: totalPurchaseCost,
                additionalDays: 0,
                action: playerDecision.action
            };
        }

        return {
            newTreasury: treasury,
            cargoType: determinedCargoKey,
            loadsBought: purchasedLoads,
            purchasePricePerLoad: purchasePricePerLoad,
            totalPurchaseCost: totalPurchaseCost,
            additionalDays: 0
        };
    }
}