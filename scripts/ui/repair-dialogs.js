/**
 * Repair Dialog Components
 * Dialogs for ship repair and maintenance decisions
 */

export class RepairDialogs {

    /**
     * Main repair options dialog
     */
    static async showRepairOptions(params) {
        const {
            portName,
            currentHull,
            maxHull,
            treasury,
            portSize,
            hasShipCarpentry,
            carpentryScore
        } = params;

        const damageAmount = maxHull - currentHull;
        const damagePercent = Math.round((damageAmount / maxHull) * 100);

        // Calculate costs
        const professionalCost = damageAmount * 100;
        const professionalDays = damageAmount;

        let drydockModifier = 0;
        if (portSize === "Major Port") drydockModifier = -0.5;
        else if (portSize === "Minor Port") drydockModifier = 0.5;

        const drydockDays = Math.ceil(damageAmount * 0.6);
        const dailyDrydockFee = Math.round(maxHull * 5 * (1 + drydockModifier));
        const drydockTotalCost = (damageAmount * 100) + (drydockDays * dailyDrydockFee);

        const maxSelfRepair = Math.min(damageAmount, Math.floor(maxHull / 2));
        const selfRepairCost = maxSelfRepair * 50;
        const selfRepairWeeks = maxSelfRepair;

        return new Promise((resolve) => {
            new Dialog({
                title: `Ship Repairs - ${portName}`,
                content: `
                    <div class="repair-dialog">
                        <div class="ship-condition" style="background: ${damagePercent > 50 ? '#f8d7da' : '#fff3cd'}; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                            <h3 style="margin-top: 0;">Ship Condition</h3>
                            <div class="condition-bar" style="background: #ddd; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0;">
                                <div style="background: ${damagePercent > 50 ? '#dc3545' : damagePercent > 25 ? '#ffc107' : '#28a745'}; height: 100%; width: ${100 - damagePercent}%;"></div>
                            </div>
                            <table style="width: 100%;">
                                <tr>
                                    <td><strong>Current Hull:</strong></td>
                                    <td>${currentHull}/${maxHull} HP</td>
                                </tr>
                                <tr>
                                    <td><strong>Damage:</strong></td>
                                    <td>${damageAmount} HP (${damagePercent}%)</td>
                                </tr>
                                <tr>
                                    <td><strong>Treasury:</strong></td>
                                    <td>${treasury} gp</td>
                                </tr>
                                <tr>
                                    <td><strong>Port:</strong></td>
                                    <td>${portSize}</td>
                                </tr>
                            </table>
                        </div>

                        <h3>Repair Options:</h3>

                        <div class="repair-option" style="border: 2px solid #0066cc; padding: 12px; margin: 10px 0; border-radius: 5px;">
                            <strong>🏗️ Professional Shipyard Repair</strong>
                            <table style="width: 100%; margin-top: 5px;">
                                <tr><td>Cost:</td><td><strong>${professionalCost} gp</strong> (100 gp/HP)</td></tr>
                                <tr><td>Time:</td><td>${professionalDays} days (1 day/HP)</td></tr>
                                <tr><td>Quality:</td><td>Permanent, full restoration</td></tr>
                            </table>
                        </div>

                        <div class="repair-option" style="border: 2px solid #6610f2; padding: 12px; margin: 10px 0; border-radius: 5px;">
                            <strong>🏭 Dry Dock Facility</strong>
                            <table style="width: 100%; margin-top: 5px;">
                                <tr><td>Cost:</td><td><strong>${drydockTotalCost} gp</strong></td></tr>
                                <tr><td>Time:</td><td>${drydockDays} days (40% faster)</td></tr>
                                <tr><td>Quality:</td><td>Permanent, full restoration</td></tr>
                                <tr><td>Fees:</td><td>${dailyDrydockFee} gp/day dry dock rental</td></tr>
                            </table>
                        </div>

                        ${hasShipCarpentry ? `
                        <div class="repair-option" style="border: 2px solid #28a745; padding: 12px; margin: 10px 0; border-radius: 5px;">
                            <strong>🔨 Self-Repair (Ship Carpentry)</strong>
                            <table style="width: 100%; margin-top: 5px;">
                                <tr><td>Cost:</td><td><strong>${selfRepairCost} gp</strong> (materials only)</td></tr>
                                <tr><td>Time:</td><td>${selfRepairWeeks} weeks</td></tr>
                                <tr><td>Max Repair:</td><td>${maxSelfRepair} HP (≤50% hull)</td></tr>
                                <tr><td>Skill:</td><td>Target ${carpentryScore} per repair</td></tr>
                                <tr><td>Note:</td><td>Failed checks = temporary repairs (d6 days)</td></tr>
                            </table>
                        </div>
                        ` : `
                        <div class="repair-option" style="border: 2px solid #6c757d; padding: 12px; margin: 10px 0; border-radius: 5px; background: #f8f9fa; opacity: 0.7;">
                            <strong>🔨 Self-Repair</strong>
                            <p style="margin: 5px 0;">Requires Ship Carpentry proficiency</p>
                        </div>
                        `}

                        <div class="repair-option" style="border: 2px solid #ffc107; padding: 12px; margin: 10px 0; border-radius: 5px;">
                            <strong>⏭️ No Repairs</strong>
                            <p style="margin: 5px 0;">Continue voyage with current damage</p>
                        </div>
                    </div>
                `,
                buttons: {
                    professional: {
                        icon: '<i class="fas fa-hammer"></i>',
                        label: `Professional (${professionalCost} gp)`,
                        callback: () => {
                            if (treasury >= professionalCost) {
                                resolve({
                                    method: "professional",
                                    repairCost: professionalCost,
                                    repairDays: professionalDays,
                                    newHull: maxHull,
                                    newTreasury: treasury - professionalCost
                                });
                            } else {
                                ui.notifications.error("Insufficient funds!");
                                resolve({ method: "none" });
                            }
                        }
                    },
                    drydock: {
                        icon: '<i class="fas fa-industry"></i>',
                        label: `Dry Dock (${drydockTotalCost} gp)`,
                        callback: () => {
                            if (treasury >= drydockTotalCost) {
                                resolve({
                                    method: "drydock",
                                    repairCost: drydockTotalCost,
                                    repairDays: drydockDays,
                                    newHull: maxHull,
                                    newTreasury: treasury - drydockTotalCost
                                });
                            } else {
                                ui.notifications.error("Insufficient funds!");
                                resolve({ method: "none" });
                            }
                        }
                    },
                    ...(hasShipCarpentry ? {
                        selfrepair: {
                            icon: '<i class="fas fa-tools"></i>',
                            label: `Self-Repair (${selfRepairCost} gp)`,
                            callback: () => resolve({ method: "selfrepair" })
                        }
                    } : {}),
                    none: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "No Repairs",
                        callback: () => resolve({ method: "none" })
                    }
                },
                default: "professional"
            }, {
                width: 600
            }).render(true);
        });
    }

    /**
     * Emergency at-sea repairs dialog
     */
    static async showEmergencyRepairs(params) {
        const {
            currentHull,
            maxHull,
            crewCount
        } = params;

        const damageAmount = maxHull - currentHull;
        const maxEmergencyRepair = Math.floor(maxHull / 2);
        const availableRepair = Math.min(damageAmount, maxEmergencyRepair - currentHull);

        if (availableRepair <= 0) {
            return { repairPoints: 0, repairHours: 0 };
        }

        return new Promise((resolve) => {
            new Dialog({
                title: "Emergency At-Sea Repairs",
                content: `
                    <div class="emergency-repair-dialog">
                        <div class="emergency-warning" style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                            <h3 style="margin-top: 0;">⚓ Critical Damage!</h3>
                            <p><strong>Current Hull:</strong> ${currentHull}/${maxHull} HP</p>
                            <p><strong>Available Emergency Repair:</strong> Up to ${availableRepair} HP</p>
                        </div>

                        <div class="emergency-details" style="border: 2px solid #fd7e14; padding: 12px; border-radius: 5px; background: #fff8f0;">
                            <strong>🔧 Makeshift At-Sea Repairs</strong>
                            <ul style="margin: 10px 0;">
                                <li><strong>Time:</strong> 1 hour per hull point</li>
                                <li><strong>Duration:</strong> Temporary (d6 days each)</li>
                                <li><strong>Requirements:</strong> 10 crew, ship idle</li>
                                <li><strong>Restrictions:</strong> No storms/combat, calm seas</li>
                            </ul>
                        </div>

                        <div class="repair-input" style="margin: 15px 0;">
                            <label for="emergencyRepairAmount"><strong>Hull points to repair:</strong></label>
                            <input type="number" id="emergencyRepairAmount" 
                                   min="0" max="${availableRepair}" 
                                   value="${Math.min(availableRepair, 3)}" 
                                   style="width: 100%; padding: 8px; margin-top: 5px;">
                            <p style="margin-top: 5px; font-size: 0.9em; color: #666;">
                                Crew available: ${crewCount} (requires 10 minimum)
                            </p>
                        </div>
                    </div>
                `,
                buttons: {
                    repair: {
                        icon: '<i class="fas fa-wrench"></i>',
                        label: "Make Emergency Repairs",
                        callback: (html) => {
                            if (crewCount < 10) {
                                ui.notifications.error("Insufficient crew for emergency repairs!");
                                resolve({ repairPoints: 0, repairHours: 0 });
                                return;
                            }

                            const repairPoints = parseInt(html.find("#emergencyRepairAmount").val()) || 0;
                            resolve({ repairPoints: repairPoints, repairHours: repairPoints });
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => resolve({ repairPoints: 0, repairHours: 0 })
                    }
                },
                default: "repair"
            }).render(true);
        });
    }
}