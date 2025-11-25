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

        const port = PortRegistry.get(portId);
        const portName = port.name;
        const portSize = port.size;
        const portSizeMod = PortRegistry.getSizeModifier(portSize);
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

        // Check for port agent usage
        let useAgent = false;
        let agent = null;
        let agentFee = 0;
        const agentAvailable = PortAgentSystem.isAvailable(portSize);

        if (automateTrading) {
            useAgent = PortAgentSystem.shouldAutoHire(captainProficiencyScores, portSize);
            if (useAgent) {
                agent = await PortAgentSystem.generateAgent();
                voyageLogHtmlRef.value += `<p><strong>Port Agent Hired:</strong> Skill ${agent.skillScore}, Fee ${agent.feePercent}%</p>`;
            }
        } else if (agentAvailable) {
            // Manual mode - offer choice
            useAgent = await this.offerAgentChoice(portName, captainProficiencyScores);
            if (useAgent) {
                agent = await PortAgentSystem.generateAgent();
                voyageLogHtmlRef.value += `<p><strong>Port Agent Hired:</strong> Skill ${agent.skillScore}, Fee ${agent.feePercent}%</p>`;
            }
        }

        // Use agent's skills or captain's
        const effectiveSkills = useAgent ? agent.proficiencyScores : captainProficiencyScores;

        // Determine merchant availability (agent bypasses this requirement)
        let merchantCount = 1;
        if (!useAgent) {
            const merchantRoll = new Roll("1d6");
            await merchantRoll.evaluate();
            const reactionAdj = ProficiencySystem.getReactionAdjustment(captainCharisma || 10);
            merchantCount = Math.max(1, merchantRoll.total + portSizeMod + reactionAdj);
            
            const reactionNote = reactionAdj !== 0 ? ` (CHA ${reactionAdj >= 0 ? '+' : ''}${reactionAdj})` : '';
            voyageLogHtmlRef.value += `<p><strong>Merchants in ${portName}:</strong> ${merchantCount} available${reactionNote}.</p>`;
            currentPortActivity.activities.push(`Detected ${merchantCount} merchants in port.`);
        } else {
            voyageLogHtmlRef.value += `<p><em>Port agent handles merchant negotiations.</em></p>`;
        }

        // Determine cargo type available
        const baseRollObj = new Roll("3d6");
        await baseRollObj.evaluate();
        let rawBaseTypeRoll = baseRollObj.total;
        let finalBaseTypeRoll = rawBaseTypeRoll + portSizeMod;

        // Apply Appraisal skill
        let appraisalAdjust = 0;
        if (effectiveSkills.appraisal !== null) {
            const appCheck = await ProficiencySystem.makeProficiencyCheck(
                "appraisal",
                effectiveSkills,
                useAgent ? {} : lieutenantSkills,
                useAgent ? 0 : crewQualityMod,
                0
            );
            
            if (appCheck.success) {
                appraisalAdjust = +1;
                voyageLogHtmlRef.value += `<p><strong>Appraisal Check${useAgent ? ' (Agent)' : ''}:</strong> SUCCESS (${appCheck.roll} ≤ ${appCheck.needed}) → +1 to goods quality.</p>`;
            } else {
                if (appCheck.roll % 2 === 1) {
                    appraisalAdjust = -1;
                    voyageLogHtmlRef.value += `<p><strong>Appraisal Check${useAgent ? ' (Agent)' : ''}:</strong> FAILED (${appCheck.roll} > ${appCheck.needed}, odd roll) → -1 to goods quality.</p>`;
                } else {
                    voyageLogHtmlRef.value += `<p><strong>Appraisal Check${useAgent ? ' (Agent)' : ''}:</strong> FAILED (${appCheck.roll} > ${appCheck.needed}, even roll) → no penalty.</p>`;
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

        // Apply Bargaining skill
        let bargainAdjustPercent = 0;
        if (effectiveSkills.bargaining !== null) {
            const bargainCheck = await ProficiencySystem.makeProficiencyCheck(
                "bargaining",
                effectiveSkills,
                useAgent ? {} : lieutenantSkills,
                useAgent ? 0 : crewQualityMod,
                0
            );

            if (bargainCheck.success) {
                const successMargin = Math.clamp(bargainCheck.needed - bargainCheck.roll, 0, 5);
                bargainAdjustPercent = -(successMargin * 5);
                voyageLogHtmlRef.value += `<p><strong>Bargaining (Buy)${useAgent ? ' (Agent)' : ''}:</strong> SUCCESS (margin: ${successMargin}) → ${Math.abs(bargainAdjustPercent)}% discount.</p>`;
            } else {
                const failureMargin = Math.clamp(bargainCheck.roll - bargainCheck.needed, 0, 5);
                bargainAdjustPercent = (failureMargin * 5);
                voyageLogHtmlRef.value += `<p><strong>Bargaining (Buy)${useAgent ? ' (Agent)' : ''}:</strong> FAILED (margin: ${failureMargin}) → +${bargainAdjustPercent}% penalty.</p>`;
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

            // Calculate and apply agent fee
            if (useAgent && purchasedLoads > 0) {
                agentFee = PortAgentSystem.calculateFee(totalPurchaseCost, agent.feePercent);
                if (totalPurchaseCost + agentFee > treasury) {
                    // Reduce purchase to afford fee
                    purchasedLoads = Math.floor((treasury) / (purchasePricePerLoad * (1 + agent.feePercent / 100)));
                    totalPurchaseCost = purchasePricePerLoad * purchasedLoads;
                    agentFee = PortAgentSystem.calculateFee(totalPurchaseCost, agent.feePercent);
                }
            }

            if (purchasedLoads > 0) {
                treasury -= (totalPurchaseCost + agentFee);
                let logMsg = `<p><strong>Automated Purchase:</strong> Bought ${purchasedLoads} loads @ ${purchasePricePerLoad} gp/load (Total: ${totalPurchaseCost} gp)`;
                if (agentFee > 0) logMsg += ` + Agent Fee: ${agentFee} gp`;
                logMsg += `.</p>`;
                voyageLogHtmlRef.value += logMsg;
                
                currentPortActivity.trading = {
                    type: "purchase",
                    cargoType: determinedCargo.name,
                    loads: purchasedLoads,
                    pricePerLoad: purchasePricePerLoad,
                    totalCost: totalPurchaseCost,
                    agentFee
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
                        ${useAgent ? `<p><em>Agent fee: ${agent.feePercent}% of purchase</em></p>` : ''}
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
                                const fee = useAgent ? PortAgentSystem.calculateFee(cost, agent.feePercent) : 0;
                                
                                if (cost + fee > treasury) {
                                    ui.notifications.error("Insufficient funds!");
                                    resolve({ loads: 0, cost: 0, fee: 0, action: "insufficient_funds" });
                                } else {
                                    resolve({ loads: numLoads, cost: cost, fee: fee, action: "buy" });
                                }
                            }
                        },
                        done: {
                            label: "Done Trading",
                            callback: () => resolve({ loads: 0, cost: 0, fee: 0, action: "done" })
                        }
                    },
                    default: "buy"
                }).render(true);
            });

            if (playerDecision.action === "buy" && playerDecision.loads > 0) {
                purchasedLoads = playerDecision.loads;
                totalPurchaseCost = playerDecision.cost;
                agentFee = playerDecision.fee;
                treasury -= (totalPurchaseCost + agentFee);

                let logMsg = `<p><strong>Manual Purchase:</strong> Bought ${purchasedLoads} loads @ ${purchasePricePerLoad} gp/load (Total: ${totalPurchaseCost} gp)`;
                if (agentFee > 0) logMsg += ` + Agent Fee: ${agentFee} gp`;
                logMsg += `.</p>`;
                voyageLogHtmlRef.value += logMsg;
                
                currentPortActivity.trading = {
                    type: "purchase",
                    cargoType: determinedCargo.name,
                    loads: purchasedLoads,
                    pricePerLoad: purchasePricePerLoad,
                    totalCost: totalPurchaseCost,
                    agentFee
                };
            }

            return {
                newTreasury: treasury,
                cargoType: determinedCargoKey,
                loadsBought: purchasedLoads,
                purchasePricePerLoad: purchasePricePerLoad,
                totalPurchaseCost: totalPurchaseCost,
                agentFee,
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
            agentFee,
            additionalDays: 0
        };
    }

    static async offerAgentChoice(portName, profScores) {
        const hasBargaining = profScores.bargaining !== null;
        const hasAppraisal = profScores.appraisal !== null;
        
        return new Promise((resolve) => {
            new Dialog({
                title: `Port Agent - ${portName}`,
                content: `
                    <p>A port agent offers to handle cargo negotiations.</p>
                    <p><strong>Agent Benefits:</strong></p>
                    <ul>
                        <li>Skilled in Bargaining & Appraisal</li>
                        <li>No need for available merchants</li>
                    </ul>
                    <p><strong>Agent Costs:</strong></p>
                    <ul>
                        <li>Fee: 7-25% of transaction</li>
                        <li>-1 demand modifier on sales</li>
                    </ul>
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