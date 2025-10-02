/**
 * Ship Repair System
 * Handles ship repairs and maintenance
 */

export class ShipRepairs {

    /**
     * Offer repair options to player
     */
    static async offerRepairOptions(params) {
        const {
            portName,
            currentHull,
            maxHull,
            treasury,
            shipTemplate,
            totalDays,
            proficiencyScores,
            portSize
        } = params;

        const damageAmount = maxHull - currentHull;
        if (damageAmount <= 0) {
            return {
                repairCost: 0,
                repairDays: 0,
                newHull: currentHull,
                newTreasury: treasury
            };
        }

        // Calculate dry dock costs based on port size
        let drydockCostModifier = 0;
        if (portSize === "Major Port") drydockCostModifier = -0.5;
        else if (portSize === "Minor Port") drydockCostModifier = 0.5;

        const drydockRepairDays = Math.ceil(damageAmount * 0.6);
        const dailyDrydockFee = Math.round(maxHull * 5 * (1 + drydockCostModifier));
        const drydockTotalCost = (damageAmount * 100) + (drydockRepairDays * dailyDrydockFee);

        return new Promise((resolve) => {
            new Dialog({
                title: `Ship Repairs - ${portName}`,
                content: `
                    <div style="margin-bottom: 15px;">
                        <h3>🔧 Ship Condition</h3>
                        <p><strong>Current Hull:</strong> ${currentHull}/${maxHull} (-${damageAmount} damage)</p>
                        <p><strong>Treasury:</strong> ${treasury} gp</p>
                        <p><strong>Port Type:</strong> ${portSize}</p>
                    </div>

                    <h3>Repair Options:</h3>

                    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px;">
                        <strong>🏗️ Professional Repair</strong><br />
                        <strong>Cost:</strong> ${damageAmount * 100} gp (100 gp/hull point)<br />
                        <strong>Time:</strong> ${damageAmount} days<br />
                        <strong>Quality:</strong> Permanent, full restoration
                    </div>

                    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px;">
                        <strong>🏭 Dry Dock Repair</strong><br />
                        <strong>Cost:</strong> ${drydockTotalCost} gp<br />
                        <strong>Time:</strong> ${drydockRepairDays} days (40% faster)<br />
                        <strong>Quality:</strong> Permanent, full restoration<br />
                        <small>Dry dock fees: ${dailyDrydockFee} gp/day</small>
                    </div>

                    ${proficiencyScores.shipCarpentry !== null ? `
                    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px;">
                        <strong>🔨 Self-Repair (Ship Carpentry)</strong><br />
                        <strong>Cost:</strong> ${Math.min(damageAmount, Math.floor(maxHull/2)) * 50} gp<br />
                        <strong>Time:</strong> ${Math.min(damageAmount, Math.floor(maxHull/2))} weeks<br />
                        <strong>Max Repair:</strong> ${Math.min(damageAmount, Math.floor(maxHull/2))} points (≤50% hull)<br />
                        <small>Requires proficiency checks</small>
                    </div>
                    ` : ''}

                    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 5px;">
                        <strong>⏭️ No Repairs</strong><br />
                        Continue voyage with current damage
                    </div>
                `,
                buttons: {
                    professional: {
                        icon: "<i class='fas fa-hammer'></i>",
                        label: `Professional (${damageAmount * 100} gp)`,
                        callback: () => {
                            if (treasury >= damageAmount * 100) {
                                resolve({
                                    method: "professional",
                                    repairCost: damageAmount * 100,
                                    repairDays: damageAmount,
                                    newHull: maxHull,
                                    newTreasury: treasury - (damageAmount * 100)
                                });
                            } else {
                                ui.notifications.error("Insufficient funds!");
                                resolve({ repairCost: 0, repairDays: 0, newHull: currentHull, newTreasury: treasury });
                            }
                        }
                    },
                    drydock: {
                        icon: "<i class='fas fa-industry'></i>",
                        label: `Dry Dock (${drydockTotalCost} gp)`,
                        callback: () => {
                            if (treasury >= drydockTotalCost) {
                                resolve({
                                    method: "drydock",
                                    repairCost: drydockTotalCost,
                                    repairDays: drydockRepairDays,
                                    newHull: maxHull,
                                    newTreasury: treasury - drydockTotalCost
                                });
                            } else {
                                ui.notifications.error("Insufficient funds!");
                                resolve({ repairCost: 0, repairDays: 0, newHull: currentHull, newTreasury: treasury });
                            }
                        }
                    },
                    ...(proficiencyScores.shipCarpentry !== null ? {
                        selfrepair: {
                            icon: "<i class='fas fa-tools'></i>",
                            label: "Self-Repair",
                            callback: async () => {
                                const result = await this.performSelfRepair(
                                    damageAmount,
                                    maxHull,
                                    currentHull,
                                    treasury,
                                    proficiencyScores.shipCarpentry,
                                    totalDays
                                );
                                resolve(result);
                            }
                        }
                    } : {}),
                    none: {
                        icon: "<i class='fas fa-times'></i>",
                        label: "No Repairs",
                        callback: () => resolve({ repairCost: 0, repairDays: 0, newHull: currentHull, newTreasury: treasury })
                    }
                },
                default: "professional"
            }).render(true);
        });
    }

    /**
     * Perform self-repair with proficiency checks
     */
    static async performSelfRepair(damageAmount, maxHull, currentHull, treasury, carpentryScore, totalDays) {
        const maxSelfRepair = Math.min(damageAmount, Math.floor(maxHull / 2));
        const selfRepairCost = maxSelfRepair * 50;

        if (treasury < selfRepairCost) {
            ui.notifications.error("Insufficient funds for materials!");
            return { repairCost: 0, repairDays: 0, newHull: currentHull, newTreasury: treasury };
        }

        let successfulRepairs = 0;
        let temporaryRepairs = [];

        for (let i = 0; i < maxSelfRepair; i++) {
            const profCheck = new Roll("1d20");
            await profCheck.evaluate();

            if (profCheck.total <= carpentryScore) {
                successfulRepairs++;
            } else {
                const durationRoll = new Roll("1d6");
                await durationRoll.evaluate();
                
                temporaryRepairs.push({
                    points: 1,
                    expiresDay: totalDays + (durationRoll.total * 7)
                });
            }
        }

        return {
            method: "selfrepair",
            repairCost: selfRepairCost,
            repairDays: maxSelfRepair * 7,
            newHull: currentHull + successfulRepairs + temporaryRepairs.length,
            newTreasury: treasury - selfRepairCost,
            successfulRepairs: successfulRepairs,
            temporaryRepairs: temporaryRepairs
        };
    }

    /**
     * Offer emergency at-sea repairs
     */
    static async offerEmergencyRepairs(currentHull, maxHull, totalDays) {
        const damageAmount = maxHull - currentHull;
        const maxEmergencyRepair = Math.floor(maxHull / 2);

        if (damageAmount <= 0 || currentHull >= maxEmergencyRepair) {
            return { repairPoints: 0, repairHours: 0 };
        }

        const availableRepair = Math.min(damageAmount, maxEmergencyRepair - currentHull);

        return new Promise((resolve) => {
            new Dialog({
                title: "Emergency At-Sea Repairs",
                content: `
                    <h3>⚓ Emergency Repairs</h3>
                    <p><strong>Current Hull:</strong> ${currentHull}/${maxHull}</p>
                    <p><strong>Available Repair:</strong> Up to ${availableRepair} points</p>
                    
                    <div style="border: 1px solid orange; padding: 10px; margin: 10px 0; background: #fff8dc;">
                        <strong>🔧 Makeshift Repair</strong><br />
                        <strong>Time:</strong> 1 hour per hull point<br />
                        <strong>Duration:</strong> Temporary (d6 days)<br />
                        <strong>Requirements:</strong> 10 crew, ship idle
                    </div>

                    <p>Hull points to repair:</p>
                    <input type="number" id="repairAmount" min="0" max="${availableRepair}" 
                           value="${Math.min(availableRepair, 3)}" style="width: 100px;">
                `,
                buttons: {
                    repair: {
                        icon: "<i class='fas fa-wrench'></i>",
                        label: "Make Repairs",
                        callback: async (html) => {
                            const repairPoints = parseInt(html.find("#repairAmount").val()) || 0;
                            
                            if (repairPoints > 0) {
                                const temporaryRepairs = [];
                                
                                for (let i = 0; i < repairPoints; i++) {
                                    const durationRoll = new Roll("1d6");
                                    await durationRoll.evaluate();
                                    
                                    temporaryRepairs.push({
                                        points: 1,
                                        expiresDay: totalDays + durationRoll.total
                                    });
                                }

                                resolve({
                                    repairPoints: repairPoints,
                                    repairHours: repairPoints,
                                    newHull: currentHull + repairPoints,
                                    temporaryRepairs: temporaryRepairs
                                });
                            } else {
                                resolve({ repairPoints: 0, repairHours: 0 });
                            }
                        }
                    },
                    cancel: {
                        icon: "<i class='fas fa-times'></i>",
                        label: "Cancel",
                        callback: () => resolve({ repairPoints: 0, repairHours: 0 })
                    }
                },
                default: "repair"
            }).render(true);
        });
    }

    /**
     * Check maintenance status
     */
    static checkMaintenance(totalDays, maintenanceStatus, maxHull) {
        if (totalDays - maintenanceStatus.lastMaintenance > 180) {
            maintenanceStatus.maintenanceOverdue = totalDays - maintenanceStatus.lastMaintenance - 180;
        }

        const monthsOverdue = Math.floor(maintenanceStatus.maintenanceOverdue / 30);
        if (monthsOverdue > 0) {
            const qualityLevels = ["Excellent", "Good", "Average", "Unseaworthy"];
            const currentIndex = qualityLevels.indexOf(maintenanceStatus.shipQuality);
            const newIndex = Math.min(currentIndex + Math.ceil(monthsOverdue / 6), qualityLevels.length - 1);
            maintenanceStatus.shipQuality = qualityLevels[newIndex];
            maintenanceStatus.speedPenalty = Math.min(monthsOverdue * 10, 90);
        }

        return {
            maintenanceNeeded: maintenanceStatus.maintenanceOverdue > 0,
            speedPenalty: maintenanceStatus.speedPenalty
        };
    }
}