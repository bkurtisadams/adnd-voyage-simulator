/**
 * Cargo Purchasing System
 * Handles buying cargo at ports
 */

import { CargoRegistry } from '../data/cargo.js';
import { PortRegistry } from '../data/ports.js';
import { ProficiencySystem } from './proficiency.js';
import { PortAgentSystem } from './port-agent.js';

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
            crewQualityMod,
            captainCharisma
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
        const reactionAdj = ProficiencySystem.getReactionAdjustment(captainCharisma || 10);
        let merchantCount = Math.max(1, merchantRoll.total + portSizeMod + reactionAdj);
        
        const reactionNote = reactionAdj !== 0 ? ` (CHA ${reactionAdj >= 0 ? '+' : ''}${reactionAdj})` : '';
        voyageLogHtmlRef.value += `<p><strong>Merchants in ${portName}:</strong> ${merchantCount} available${reactionNote}.</p>`;
        currentPortActivity.activities.push(`Detected ${merchantCount} merchants in port.`);

        // Check for port agent availability and auto-hire
        let usingPortAgent = false;
        let portAgent = null;
        const port = PortRegistry.get(portId);
        
        if (PortAgentSystem.isAvailable(port.size)) {
            const shouldAutoHire = PortAgentSystem.shouldAutoHire(captainProficiencyScores, port.size);
            
            if (shouldAutoHire) {
                portAgent = await PortAgentSystem.generateAgent();
                usingPortAgent = true;
                voyageLogHtmlRef.value += `<p><strong>Port Agent Hired:</strong> Skill ${portAgent.skillScore}, Fee ${portAgent.feePercent}%</p>`;
                currentPortActivity.activities.push(`Hired port agent (skill ${portAgent.skillScore}, fee ${portAgent.feePercent}%)`);
            } else if (!automateTrading && merchantCount < 3) {
                // Manual mode: offer port agent if few merchants
                portAgent = await PortAgentSystem.generateAgent();
                
                const agentChoice = await new Promise((resolve) => {
                    new Dialog({
                        title: "Port Agent Available",
                        content: `
                            <p>Only ${merchantCount} merchants available. Hire a port agent?</p>
                            <p><strong>Agent Skills:</strong> Bargaining ${portAgent.skillScore}, Appraisal ${portAgent.skillScore}</p>
                            <p><strong>Fee:</strong> ${portAgent.feePercent}% of transaction</p>
                            <p><strong>Your Skills:</strong> Bargaining ${captainProficiencyScores.bargaining || 'none'}, Appraisal ${captainProficiencyScores.appraisal || 'none'}</p>
                        `,
                        buttons: {
                            hire: { label: "Hire Agent", callback: () => resolve(true) },
                            skip: { label: "No Thanks", callback: () => resolve(false) }
                        },
                        default: "skip"
                    }).render(true);
                });
                
                if (agentChoice) {
                    usingPortAgent = true;
                    voyageLogHtmlRef.value += `<p><strong>Port Agent Hired:</strong> Skill ${portAgent.skillScore}, Fee ${portAgent.feePercent}%</p>`;
                    currentPortActivity.activities.push(`Hired port agent (skill ${portAgent.skillScore}, fee ${portAgent.feePercent}%)`);
                }
            }
        }
        
        // If using port agent, bypass merchant requirement
        if (usingPortAgent) {
            merchantCount = 1; // Agent acts as merchant
        }

        // Determine cargo type available
        const baseRollObj = new Roll("3d6");
        await baseRollObj.evaluate();
        let rawBaseTypeRoll = baseRollObj.total;
        let finalBaseTypeRoll = rawBaseTypeRoll + portSizeMod;

        // Apply Appraisal skill (use port agent if available)
        let appraisalAdjust = 0;
        const appraisalScores = usingPortAgent ? portAgent.proficiencyScores : captainProficiencyScores;
        
        if (appraisalScores.appraisal !== null) {
            const appCheck = await ProficiencySystem.makeProficiencyCheck(
                "appraisal",
                appraisalScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );
            
            if (appCheck.success) {
                appraisalAdjust = +1;
                voyageLogHtmlRef.value += `<p><strong>Appraisal${usingPortAgent ? ' (Agent)' : ''}:</strong> SUCCESS (${appCheck.roll} ≤ ${appCheck.needed}) → +1 to goods quality.</p>`;
            } else {
                if (appCheck.roll % 2 === 1) {
                    appraisalAdjust = -1;
                    voyageLogHtmlRef.value += `<p><strong>Appraisal${usingPortAgent ? ' (Agent)' : ''}:</strong> FAILED (${appCheck.roll} > ${appCheck.needed}, odd) → -1 to goods quality.</p>`;
                } else {
                    voyageLogHtmlRef.value += `<p><strong>Appraisal${usingPortAgent ? ' (Agent)' : ''}:</strong> FAILED (${appCheck.roll} > ${appCheck.needed}, even) → no penalty.</p>`;
                }
            }
        }

        finalBaseTypeRoll = Math.clamp(finalBaseTypeRoll + appraisalAdjust, 3, 20);

        const determinedCargoKey = CargoRegistry.determineTypeFromRoll(finalBaseTypeRoll);
        const determinedCargo = CargoRegistry.get(determinedCargoKey);

        // Determine quantity available
        const qtyRollObj = new Roll("3d8");
        await qtyRollObj.evaluate();
        let qtyAvailable = Math.max(1, qtyRollObj.total - rawBaseTypeRoll);

        voyageLogHtmlRef.value += `<p><strong>Available Cargo:</strong> ${qtyAvailable} loads of ${determinedCargo.name} @ ${determinedCargo.baseValue} gp/load.</p>`;

        // Apply Bargaining skill (use port agent if available)
        let bargainAdjustPercent = 0;
        const bargainingScores = usingPortAgent ? portAgent.proficiencyScores : captainProficiencyScores;
        
        if (bargainingScores.bargaining !== null) {
            const bargainCheck = await ProficiencySystem.makeProficiencyCheck(
                "bargaining",
                bargainingScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );

            if (bargainCheck.success) {
                const successMargin = Math.clamp(bargainCheck.needed - bargainCheck.roll, 0, 5);
                bargainAdjustPercent = -(successMargin * 5);
                voyageLogHtmlRef.value += `<p><strong>Bargaining${usingPortAgent ? ' (Agent)' : ''}:</strong> SUCCESS (${bargainCheck.roll} ≤ ${bargainCheck.needed}) → ${Math.abs(bargainAdjustPercent)}% discount.</p>`;
            } else {
                const failureMargin = Math.clamp(bargainCheck.roll - bargainCheck.needed, 0, 5);
                bargainAdjustPercent = (failureMargin * 5);
                voyageLogHtmlRef.value += `<p><strong>Bargaining${usingPortAgent ? ' (Agent)' : ''}:</strong> FAILED (${bargainCheck.roll} > ${bargainCheck.needed}) → +${bargainAdjustPercent}% penalty.</p>`;
            }
        }

        purchasePricePerLoad = Math.max(1, Math.floor(determinedCargo.baseValue * (100 + bargainAdjustPercent) / 100));
        
        // Deduct port agent fee if used
        let agentFee = 0;
        if (usingPortAgent) {
            const transactionValue = purchasePricePerLoad * Math.min(shipCapacity, qtyAvailable);
            agentFee = PortAgentSystem.calculateFee(transactionValue, portAgent.feePercent);
        }

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
                
                // Deduct port agent fee if used
                if (usingPortAgent && agentFee > 0) {
                    const actualAgentFee = PortAgentSystem.calculateFee(totalPurchaseCost, portAgent.feePercent);
                    treasury -= actualAgentFee;
                    voyageLogHtmlRef.value += `<p><strong>Port Agent Fee:</strong> ${actualAgentFee} gp (${portAgent.feePercent}% of ${totalPurchaseCost} gp)</p>`;
                }
                
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
                                numLoads = Math.clamp(numLoads, 0, maxPurchasable);
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
                
                // Deduct port agent fee if used
                if (usingPortAgent && agentFee > 0) {
                    const actualAgentFee = PortAgentSystem.calculateFee(totalPurchaseCost, portAgent.feePercent);
                    treasury -= actualAgentFee;
                    voyageLogHtmlRef.value += `<p><strong>Port Agent Fee:</strong> ${actualAgentFee} gp (${portAgent.feePercent}% of ${totalPurchaseCost} gp)</p>`;
                }

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

    /**
     * Roll merchant availability at a port (without committing to purchase)
     */
    static async rollMerchantAvailability(port, captainCharisma = 10) {
        const portSizeMod = PortRegistry.getSizeModifier(port.size);
        const reactionAdj = ProficiencySystem.getReactionAdjustment(captainCharisma);
        const merchantRoll = new Roll("1d6");
        await merchantRoll.evaluate();
        const merchantCount = Math.max(1, merchantRoll.total + portSizeMod + reactionAdj);
        
        return {
            merchantCount,
            roll: merchantRoll.total,
            portSizeMod,
            reactionAdj
        };
    }

    /**
     * Roll cargo offer from merchants (without committing to purchase)
     */
    static async rollCargoOffer(params) {
        const { portId, captainProficiencyScores, lieutenantSkills, crewQualityMod } = params;
        
        const port = PortRegistry.get(portId);
        const portSizeMod = PortRegistry.getSizeModifier(port.size);
        
        // Roll cargo type
        const baseRollObj = new Roll("3d6");
        await baseRollObj.evaluate();
        let rawBaseTypeRoll = baseRollObj.total;
        let finalBaseTypeRoll = rawBaseTypeRoll + portSizeMod;
        
        // Apply Appraisal skill
        let appraisalAdjust = 0;
        let appraisalResult = null;
        if (captainProficiencyScores?.appraisal !== null && captainProficiencyScores?.appraisal !== undefined) {
            const appCheck = await ProficiencySystem.makeProficiencyCheck(
                "appraisal",
                captainProficiencyScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );
            appraisalResult = appCheck;
            if (appCheck.success) {
                appraisalAdjust = +1;
            } else if (appCheck.roll % 2 === 1) {
                appraisalAdjust = -1;
            }
        }
        
        finalBaseTypeRoll = Math.clamp(finalBaseTypeRoll + appraisalAdjust, 3, 20);
        const cargoKey = CargoRegistry.determineTypeFromRoll(finalBaseTypeRoll);
        const cargo = CargoRegistry.get(cargoKey);
        
        // Roll quantity
        const qtyRollObj = new Roll("3d8");
        await qtyRollObj.evaluate();
        const qtyAvailable = Math.max(1, qtyRollObj.total - rawBaseTypeRoll);
        
        // Apply Bargaining skill
        let bargainAdjustPercent = 0;
        let bargainResult = null;
        if (captainProficiencyScores?.bargaining !== null && captainProficiencyScores?.bargaining !== undefined) {
            const bargainCheck = await ProficiencySystem.makeProficiencyCheck(
                "bargaining",
                captainProficiencyScores,
                lieutenantSkills,
                crewQualityMod,
                0
            );
            bargainResult = bargainCheck;
            if (bargainCheck.success) {
                const successMargin = Math.clamp(bargainCheck.needed - bargainCheck.roll, 0, 5);
                bargainAdjustPercent = -(successMargin * 5);
            } else {
                const failureMargin = Math.clamp(bargainCheck.roll - bargainCheck.needed, 0, 5);
                bargainAdjustPercent = (failureMargin * 5);
            }
        }
        
        const pricePerLoad = Math.max(1, Math.floor(cargo.baseValue * (100 + bargainAdjustPercent) / 100));
        
        return {
            cargoType: cargoKey,
            cargoName: cargo.name,
            baseValue: cargo.baseValue,
            pricePerLoad,
            loadsAvailable: qtyAvailable,
            bargainAdjustPercent,
            appraisalResult,
            bargainResult
        };
    }
}