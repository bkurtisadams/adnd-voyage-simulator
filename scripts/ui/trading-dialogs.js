/**
 * Trading Dialog Components
 * Dialogs for manual cargo trading decisions
 */

import { CargoRegistry } from '../data/cargo.js';

export class TradingDialogs {

    /**
     * Cargo purchase decision dialog
     */
    static async showPurchaseDialog(params) {
        const {
            portName,
            cargoType,
            loadsAvailable,
            pricePerLoad,
            currentTreasury,
            shipCapacity,
            maxAffordable
        } = params;

        const cargo = CargoRegistry.get(cargoType);
        const maxPurchasable = Math.min(shipCapacity, loadsAvailable, maxAffordable);

        return new Promise((resolve) => {
            new Dialog({
                title: `Purchase Cargo at ${portName}`,
                content: `
                    <div class="cargo-purchase-dialog">
                        <div class="cargo-info">
                            <h3>${cargo.name}</h3>
                            <p class="cargo-description">${cargo.description}</p>
                        </div>

                        <div class="transaction-details">
                            <table style="width: 100%; margin: 10px 0;">
                                <tr>
                                    <td><strong>Available:</strong></td>
                                    <td>${loadsAvailable} loads</td>
                                </tr>
                                <tr>
                                    <td><strong>Price per Load:</strong></td>
                                    <td>${pricePerLoad} gp</td>
                                </tr>
                                <tr>
                                    <td><strong>Your Treasury:</strong></td>
                                    <td>${currentTreasury} gp</td>
                                </tr>
                                <tr>
                                    <td><strong>Ship Capacity:</strong></td>
                                    <td>${shipCapacity} loads</td>
                                </tr>
                            </table>
                        </div>

                        <div class="purchase-input">
                            <label for="loadsToBuy">How many loads to purchase? (Max: ${maxPurchasable})</label>
                            <input type="number" id="loadsToBuy" name="loadsToBuy" 
                                   min="0" max="${maxPurchasable}" 
                                   value="${maxPurchasable}" 
                                   style="width: 100%; padding: 5px; margin-top: 5px;">
                            <p id="totalCost" style="margin-top: 10px; font-weight: bold;">
                                Total Cost: ${maxPurchasable * pricePerLoad} gp
                            </p>
                        </div>
                    </div>

                    <style>
                        .cargo-purchase-dialog {
                            padding: 10px;
                        }
                        .cargo-info {
                            background: #f0f0f0;
                            padding: 10px;
                            border-radius: 5px;
                            margin-bottom: 15px;
                        }
                        .cargo-info h3 {
                            margin-top: 0;
                        }
                        .cargo-description {
                            font-style: italic;
                            color: #666;
                        }
                        .transaction-details table {
                            border-collapse: collapse;
                        }
                        .transaction-details td {
                            padding: 5px;
                            border-bottom: 1px solid #ddd;
                        }
                    </style>
                `,
                buttons: {
                    buy: {
                        icon: '<i class="fas fa-shopping-cart"></i>',
                        label: "Purchase Cargo",
                        callback: (html) => {
                            const numLoads = parseInt(html.find("#loadsToBuy").val()) || 0;
                            const clampedLoads = Math.max(0, Math.min(numLoads, maxPurchasable));
                            const cost = clampedLoads * pricePerLoad;

                            if (cost > currentTreasury) {
                                ui.notifications.error("Insufficient funds!");
                                resolve({ loads: 0, cost: 0, action: "insufficient_funds" });
                            } else {
                                resolve({ loads: clampedLoads, cost: cost, action: "buy" });
                            }
                        }
                    },
                    done: {
                        icon: '<i class="fas fa-sign-out-alt"></i>',
                        label: "Done Trading",
                        callback: () => resolve({ loads: 0, cost: 0, action: "done" })
                    }
                },
                default: "buy",
                render: (html) => {
                    // Update total cost dynamically
                    html.find("#loadsToBuy").on("input", function() {
                        const loads = parseInt($(this).val()) || 0;
                        const total = loads * pricePerLoad;
                        html.find("#totalCost").text(`Total Cost: ${total} gp`);
                    });
                }
            }).render(true);
        });
    }

    /**
     * Cargo sale decision dialog
     */
    static async showSaleDialog(params) {
        const {
            portName,
            cargoType,
            currentLoads,
            purchaseCost,
            estimatedSalePrice,
            estimatedRevenue
        } = params;

        const cargo = CargoRegistry.get(cargoType);
        const estimatedProfit = estimatedRevenue - purchaseCost;
        const profitColor = estimatedProfit >= 0 ? "green" : "red";

        return new Promise((resolve) => {
            new Dialog({
                title: `Sell Cargo at ${portName}`,
                content: `
                    <div class="cargo-sale-dialog">
                        <div class="cargo-info">
                            <h3>${cargo.name}</h3>
                            <p><strong>Quantity:</strong> ${currentLoads} loads</p>
                        </div>

                        <div class="financial-summary">
                            <table style="width: 100%; margin: 10px 0;">
                                <tr>
                                    <td><strong>Purchase Cost:</strong></td>
                                    <td>${purchaseCost} gp</td>
                                </tr>
                                <tr>
                                    <td><strong>Estimated Sale Price:</strong></td>
                                    <td>${estimatedSalePrice} gp/load</td>
                                </tr>
                                <tr>
                                    <td><strong>Estimated Revenue:</strong></td>
                                    <td>${estimatedRevenue} gp</td>
                                </tr>
                                <tr style="border-top: 2px solid #333;">
                                    <td><strong>Estimated Profit:</strong></td>
                                    <td style="color: ${profitColor}; font-weight: bold;">
                                        ${estimatedProfit > 0 ? '+' : ''}${estimatedProfit} gp
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <div class="sale-notice" style="background: #fffacd; padding: 10px; border-radius: 5px; margin-top: 10px;">
                            <p style="margin: 0;"><strong>Note:</strong> Final price subject to customs, demand, and proficiency checks.</p>
                        </div>
                    </div>
                `,
                buttons: {
                    sell: {
                        icon: '<i class="fas fa-coins"></i>',
                        label: "Sell Cargo",
                        callback: () => resolve({ action: "sell" })
                    },
                    hold: {
                        icon: '<i class="fas fa-hand-paper"></i>',
                        label: "Keep Cargo",
                        callback: () => resolve({ action: "hold" })
                    },
                    done: {
                        icon: '<i class="fas fa-sign-out-alt"></i>',
                        label: "Done Trading",
                        callback: () => resolve({ action: "done" })
                    }
                },
                default: "sell"
            }).render(true);
        });
    }

    /**
     * Port trading continuation dialog
     */
    static async showContinueTradingDialog(params) {
        const {
            portName,
            hasCargoToSell,
            canBuyCargo,
            isConsignmentInTransit,
            currentCargo
        } = params;

        let message = "";
        let showWaitButton = false;

        if (isConsignmentInTransit) {
            message = `<p>Carrying consignment cargo (${currentCargo.loads} loads of ${currentCargo.type}).</p>
                      <p>Can only sell at final destination. Continue voyage?</p>`;
        } else if (hasCargoToSell && !canBuyCargo) {
            message = `<p>Hold is full with ${currentCargo.loads} loads of ${currentCargo.type}.</p>
                      <p>You chose not to sell at this port. Continue to next port?</p>`;
            showWaitButton = true;
        } else if (!hasCargoToSell && !canBuyCargo) {
            message = `<p>No cargo trading available. Continue to next port?</p>`;
        } else {
            message = `<p>No cargo was traded this round.</p>
                      <p>Wait for new opportunities or continue voyage?</p>`;
            showWaitButton = true;
        }

        return new Promise((resolve) => {
            new Dialog({
                title: `Trading at ${portName}`,
                content: message,
                buttons: {
                    ...(showWaitButton ? {
                        wait: {
                            icon: '<i class="fas fa-clock"></i>',
                            label: "Wait (7 Days)",
                            callback: () => resolve({ action: "wait", days: 7 })
                        }
                    } : {}),
                    done: {
                        icon: '<i class="fas fa-anchor"></i>',
                        label: "Leave Port",
                        callback: () => resolve({ action: "leave" })
                    }
                },
                default: "done"
            }).render(true);
        });
    }

    /**
     * Smuggling opportunity dialog
     */
    static async showSmugglingDialog(params) {
        const {
            portName,
            smugglingScore,
            customsInspectionBonus
        } = params;

        const effectiveScore = smugglingScore + (customsInspectionBonus ? 1 : 0);

        return new Promise((resolve) => {
            new Dialog({
                title: `Smuggling Opportunity - ${portName}`,
                content: `
                    <div class="smuggling-dialog">
                        <div class="warning-box" style="background: #fff3cd; border: 2px solid #ffc107; padding: 15px; border-radius: 5px;">
                            <h3 style="margin-top: 0;">Avoid Customs Inspection?</h3>
                            <p>You have the Smuggling proficiency. Attempt to bypass customs?</p>
                        </div>

                        <div class="smuggling-odds" style="margin: 15px 0;">
                            <table style="width: 100%;">
                                <tr>
                                    <td><strong>Your Smuggling Score:</strong></td>
                                    <td>${effectiveScore}</td>
                                </tr>
                                ${customsInspectionBonus ? `
                                <tr>
                                    <td colspan="2" style="font-size: 0.9em; color: #666;">
                                        +1 bonus from Customs Inspection proficiency
                                    </td>
                                </tr>
                                ` : ''}
                            </table>
                        </div>

                        <div class="outcomes" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                            <div style="border: 2px solid #28a745; padding: 10px; border-radius: 5px; background: #d4edda;">
                                <strong>Success:</strong><br>
                                Pay no customs fees
                            </div>
                            <div style="border: 2px solid #dc3545; padding: 10px; border-radius: 5px; background: #f8d7da;">
                                <strong>Failure:</strong><br>
                                Pay 10× normal fees as fine
                            </div>
                        </div>
                    </div>
                `,
                buttons: {
                    attempt: {
                        icon: '<i class="fas fa-user-secret"></i>',
                        label: "Attempt Smuggling",
                        callback: () => resolve(true)
                    },
                    legal: {
                        icon: '<i class="fas fa-file-invoice-dollar"></i>',
                        label: "Pay Customs Legally",
                        callback: () => resolve(false)
                    }
                },
                default: "legal"
            }).render(true);
        });
    }

    /**
     * Charter opportunity dialog
     */
    static async showCharterDialog(params) {
        const {
            portName,
            distance,
            fee,
            shipCapacity
        } = params;

        return new Promise((resolve) => {
            new Dialog({
                title: `Charter Opportunity - ${portName}`,
                content: `
                    <div class="charter-dialog">
                        <div class="charter-offer" style="background: #e7f3ff; border: 2px solid #0066cc; padding: 15px; border-radius: 5px;">
                            <h3 style="margin-top: 0;">Exclusive Charter Request</h3>
                            <p>Passengers wish to charter the entire vessel for a private voyage!</p>
                        </div>

                        <div class="charter-details" style="margin: 15px 0;">
                            <table style="width: 100%;">
                                <tr>
                                    <td><strong>Destination Distance:</strong></td>
                                    <td>${distance} miles</td>
                                </tr>
                                <tr>
                                    <td><strong>Charter Fee:</strong></td>
                                    <td style="color: #28a745; font-weight: bold;">${fee} gp</td>
                                </tr>
                                <tr>
                                    <td><strong>Ship Capacity:</strong></td>
                                    <td>${shipCapacity} loads (unavailable for cargo)</td>
                                </tr>
                            </table>
                        </div>

                        <div class="charter-note" style="background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 10px;">
                            <p style="margin: 0;"><strong>Note:</strong> Accepting this charter will replace your current trading voyage or require a diversion from your planned route.</p>
                        </div>
                    </div>
                `,
                buttons: {
                    accept: {
                        icon: '<i class="fas fa-handshake"></i>',
                        label: `Accept Charter (${fee} gp)`,
                        callback: () => resolve({ accepted: true, distance: distance, fee: fee })
                    },
                    decline: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Decline - Continue Current Voyage",
                        callback: () => resolve({ accepted: false, distance: 0, fee: 0 })
                    }
                },
                default: "decline"
            }).render(true);
        });
    }
}