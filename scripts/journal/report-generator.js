/**
 * Journal Report Generator
 * Creates detailed voyage logs and journal entries
 */

import { PortRegistry } from '../data/ports.js';
import { CargoRegistry } from '../data/cargo.js';

export class ReportGenerator {

    /**
     * Generate complete voyage journal entry
     */
    static async createVoyageJournal(voyageState) {
        const journalContent = this.buildJournalHTML(voyageState);
        
        const startDate = this.parseWeatherDate(voyageState.shipStartDate);
        const endDate = this.parseWeatherDate(voyageState.shipEndDate);
        
        const journalName = `Voyage – ${voyageState.ship.name} (${startDate} to ${endDate})`;

        try {
            const journalEntry = await JournalEntry.create({
                name: journalName,
                folder: await this.getOrCreateVoyageFolder()
            });

            await journalEntry.createEmbeddedDocuments("JournalEntryPage", [{
                name: "Voyage Log",
                type: "text",
                text: {
                    content: journalContent,
                    markdown: false
                }
            }]);

            ui.notifications.info(`Journal entry "${journalName}" created successfully!`);
            journalEntry.sheet.render(true); // Auto-open the journal
            return journalEntry;
        } catch (err) {
            console.error("Error creating journal entry:", err);
            ui.notifications.error("Failed to create journal entry. See console for details.");
            await this.offerHTMLExport(journalContent, journalName);
            return null;
        }
    }

    /**
     * Build the complete HTML journal content
     */
    static buildJournalHTML(state) {
        const {
            ship,
            route,
            captain,
            lieutenant,
            startingCapital,
            treasury,
            crewEarningsFromTrade,
            totalDays,
            totalDistance,
            totalHullDamage,
            shipStartDate,
            shipEndDate,
            portsVisited,
            portActivities,
            passengerManifest,
            repairLog,
            weatherLogHtml,
            voyageLogHtml,
            tradeMode,
            commissionRate,
            revenueTotal,
            expenseTotal,
            crewQuality
        } = state;

        const finalHull = Math.max(0, ship.hullPoints.max - totalHullDamage);
        const ownerNetProfit = treasury - startingCapital;

        // Calculate profit distribution
        const profitDistribution = this.calculateProfitDistribution({
            ownerNetProfit,
            crewEarningsFromTrade,
            ship
        });

        // Build port activities section
        const portActivitiesHTML = this.buildPortActivitiesHTML(portActivities, tradeMode);

        // Build repair log section
        const repairLogHTML = this.buildRepairLogHTML(repairLog);

        // Build passenger manifest section
        const passengerManifestHTML = this.buildPassengerManifestHTML(passengerManifest);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Voyage Log - ${ship.name}</title>
    ${this.getJournalStyles()}
</head>
<body>
    <div class="logbook-page">
        <h1 class="page-title">Ship's Log — ${ship.name}</h1>

        <div class="vessel-info">
            <div class="log-entry no-indent">
                <strong>Captain:</strong> ${captain.name}<br />
                <strong>Route:</strong> ${route.name}<br />
                <strong>Crew Quality:</strong> ${crewQuality}<br />
                <strong>Voyage Commenced:</strong> ${shipStartDate}<br />
                <strong>Voyage Concluded:</strong> ${shipEndDate}
            </div>
            <div class="log-entry no-indent">
                <strong>Days at Sea:</strong> ${totalDays} days<br />
                <strong>Distance Sailed:</strong> ${totalDistance} miles<br />
                <strong>Vessel Condition:</strong> ${finalHull}/${ship.hullPoints.max} hull points<br />
                <strong>Final Port:</strong> ${PortRegistry.get(ship.currentPort)?.name || "Unknown"}
            </div>
        </div>

        <h2 class="section-header">Summary of Accounts</h2>

        <div class="info-box">
            <div class="log-entry no-indent">
                <strong>Capital at Departure (Owner's):</strong> ${startingCapital} gold pieces<br />
                <strong>Capital at Return (Owner's):</strong> ${treasury} gold pieces<br />
                <strong>Owner's Net Result:</strong> ${ownerNetProfit >= 0 ? 'Profit of' : 'Loss of'} ${Math.abs(ownerNetProfit)} gold pieces
            </div>

            <div class="log-entry no-indent">
                <strong>Total Revenue Earned:</strong> ${revenueTotal} gold pieces<br />
                <strong>Total Expenses Incurred:</strong> ${expenseTotal} gold pieces
            </div>
        </div>

        <h2 class="section-header">Division of Profits</h2>

        <div class="log-entry">
            As per maritime custom and the articles of agreement signed before departure, the profits of this voyage have been divided in the traditional manner among all parties with interest in the venture.
        </div>

        <div class="info-box">
            <strong>Ship Owner's Share:</strong> ${profitDistribution.ownerShare} gold pieces<br />
            <strong>Captain's Share:</strong> ${profitDistribution.captainShare} gold pieces<br />
            <strong>Lieutenant's Share:</strong> ${profitDistribution.lieutenantShares} gold pieces<br />
            <strong>Mate's Share:</strong> ${profitDistribution.mateShares} gold pieces<br />
            <strong>Common Crew's Share:</strong> ${profitDistribution.commonCrewShare} gold pieces<br />
            <br />
            <strong>Crew's Direct Trade Earnings:</strong> ${crewEarningsFromTrade} gold pieces<br />
            <strong>Total Crew Payout:</strong> ${profitDistribution.totalCrewPayout} gold pieces
        </div>

        <h2 class="section-header">Cargo Manifest and Trading Summary</h2>
        ${this.buildCargoSummaryHTML(portActivities, tradeMode, commissionRate)}

        ${repairLog.length > 0 ? `
        <h2 class="section-header">Ship Repairs and Maintenance</h2>
        ${repairLogHTML}
        ` : ''}

        ${passengerManifest.length > 0 ? `
        <h2 class="section-header">Passenger Manifest</h2>
        ${passengerManifestHTML}
        ` : ''}

        <h2 class="section-header">Port Calls and Activities</h2>
        ${portActivitiesHTML}

        <h2 class="section-header">Daily Log of Weather and Navigation</h2>
        <div class="weather-log">
            ${this.formatWeatherLog(weatherLogHtml.value)}
        </div>

        <h2 class="section-header">Condition of Vessel</h2>
        <div class="log-entry">
            The vessel ${ship.name} completed this voyage in ${this.getVesselConditionDescription(finalHull, ship.hullPoints.max)}. Total damage sustained during the voyage amounted to ${totalHullDamage} hull points from weather and sea conditions encountered.
        </div>

        <div class="signature-block">
            Submitted this day in good faith and according to maritime law and custom,<br /><br />
            <strong>${captain.name}</strong><br />
            Master and Commander<br />
            <em>${shipEndDate}</em>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Get journal CSS styles
     */
    static getJournalStyles() {
        return `
<style>
    body {
        font-family: Georgia, 'Times New Roman', serif;
        background: linear-gradient(45deg, #f4f1e8 0%, #e8e0d0 100%);
        color: #2c1810;
        line-height: 1.7;
        padding: 0;
        margin: 0;
    }

    .logbook-page {
        background: linear-gradient(45deg, #f9f6f0 0%, #f4f1e8 100%);
        border: 3px solid #8b4513;
        border-radius: 8px;
        padding: 40px;
        margin: 20px;
        box-shadow: 0 0 30px rgba(139, 69, 19, 0.4);
        position: relative;
    }

    .page-title {
        text-align: center;
        font-size: 28px;
        color: #654321;
        text-decoration: underline;
        margin-bottom: 30px;
        font-variant: small-caps;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(139, 69, 19, 0.3);
    }

    .section-header {
        color: #654321;
        font-size: 20px;
        margin-top: 30px;
        margin-bottom: 15px;
        text-decoration: underline;
        font-variant: small-caps;
        font-weight: bold;
    }

    .log-entry {
        margin-bottom: 20px;
        text-indent: 25px;
        font-size: 16px;
    }

    .log-entry.no-indent {
        text-indent: 0;
    }

    .info-box {
        background: rgba(139, 69, 19, 0.1);
        border: 2px solid #8b4513;
        border-radius: 5px;
        padding: 20px;
        margin: 20px 0;
        font-size: 15px;
    }

    .port-entry {
        background: rgba(160, 82, 45, 0.1);
        border-left: 4px solid #8b4513;
        padding: 15px;
        margin: 15px 0;
        font-size: 15px;
    }

    .weather-log {
        font-family: 'Courier New', monospace;
        background: rgba(139, 69, 19, 0.05);
        border: 2px solid #8b4513;
        border-radius: 5px;
        padding: 20px;
        margin: 20px 0;
        font-size: 12px;
        line-height: 1.5;
        max-height: 400px;
        overflow-y: auto;
    }

    .signature-block {
        text-align: right;
        font-style: italic;
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #8b4513;
        font-size: 16px;
    }

    .vessel-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin: 20px 0;
    }

    strong {
        color: #654321;
        font-weight: bold;
    }

    @media print {
        .logbook-page {
            box-shadow: none;
            border: 2px solid #8b4513;
            margin: 0;
        }
    }
</style>
        `;
    }

    /**
     * Build port activities HTML section
     */
    static buildPortActivitiesHTML(portActivities, tradeMode) {
        if (!portActivities || portActivities.length === 0) {
            return '<p><em>No port activities recorded.</em></p>';
        }

        return portActivities.map(activity => {
            const typeColors = {
                origin: "#e8f5e8",
                destination: "#e8e8f5",
                intermediate: "#f8f8f8"
            };

            const typeIcons = {
                origin: "⛵",
                destination: "⚓",
                intermediate: "🏪"
            };

            const typeLabels = {
                origin: "(Port of Origin)",
                destination: "(Final Destination)",
                intermediate: "(Port Call)"
            };

            const bgColor = typeColors[activity.portType] || "#f8f8f8";
            const icon = typeIcons[activity.portType] || "⚓";
            const label = typeLabels[activity.portType] || "";

            return `
                <div class="port-entry" style="background: ${bgColor};">
                    <h4 style="margin-top: 0;">${icon} ${activity.portName} ${label}</h4>
                    <p><strong>Date:</strong> ${activity.date}</p>

                    ${activity.fees && Object.keys(activity.fees).length > 0 ? `
                    <div style="margin: 10px 0;">
                        <strong>Port Fees:</strong>
                        <ul style="margin: 5px 0 0 20px;">
                            ${activity.fees.entrance ? `<li>Entrance: ${activity.fees.entrance} gp</li>` : ''}
                            ${activity.fees.moorage ? `<li>Moorage (${activity.fees.moorage.type}): ${activity.fees.moorage.cost} gp (${activity.fees.moorage.days} days)</li>` : ''}
                            ${activity.fees.pilot ? `<li>Pilot/Towage: ${activity.fees.pilot} gp</li>` : ''}
                        </ul>
                        <p><strong>Total Fees: ${activity.totalCost} gp</strong></p>
                    </div>
                    ` : ''}

                    ${activity.trading ? `
                    <div style="margin: 10px 0;">
                        <strong>Trading:</strong>
                        <ul style="margin: 5px 0 0 20px;">
                            <li>Type: ${activity.trading.type === "purchase" ? "Purchase" : "Sale"}</li>
                            <li>Commodity: ${activity.trading.cargoType}</li>
                            <li>Quantity: ${activity.trading.loads} loads</li>
                            ${activity.trading.pricePerLoad ? `<li>Price: ${activity.trading.pricePerLoad} gp/load</li>` : ''}
                            ${activity.trading.totalCost ? `<li>Cost: ${activity.trading.totalCost} gp</li>` : ''}
                        </ul>
                    </div>
                    ` : ''}

                    ${activity.activities && activity.activities.length > 0 ? `
                    <div style="margin: 10px 0;">
                        <strong>Activities:</strong>
                        <ul style="margin: 5px 0 0 20px;">
                            ${activity.activities.map(act => `<li>${act}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Build cargo summary HTML
     */
    static buildCargoSummaryHTML(portActivities, tradeMode, commissionRate) {
        let totalPurchased = 0;
        let totalSold = 0;
        let totalPurchaseCost = 0;
        let totalSaleRevenue = 0;

        portActivities.forEach(activity => {
            if (activity.trading) {
                if (activity.trading.type === "purchase") {
                    totalPurchased += activity.trading.loads;
                    totalPurchaseCost += activity.trading.totalCost;
                } else if (activity.trading.type === "sale") {
                    totalSold += activity.trading.loads;
                    totalSaleRevenue += activity.trading.totalRevenueForOwner || 0;
                }
            }
        });

        if (totalPurchased === 0 && totalSold === 0) {
            return '<p><em>No cargo trading activities recorded.</em></p>';
        }

        return `
            <div class="info-box">
                <p><strong>Total Cargo Purchased:</strong> ${totalPurchased} loads</p>
                <p><strong>Total Cargo Sold:</strong> ${totalSold} loads</p>
                <p><strong>Total Purchase Cost:</strong> ${totalPurchaseCost} gp</p>
                <p><strong>Total Sale Revenue:</strong> ${totalSaleRevenue} gp</p>
                <p><strong>Trading Mode:</strong> ${tradeMode === 'speculation' ? 'Speculation' : `Consignment (${commissionRate}% commission)`}</p>
            </div>
        `;
    }

    /**
     * Build repair log HTML
     */
    static buildRepairLogHTML(repairLog) {
        return repairLog.map(repair => `
            <div class="port-entry">
                <strong>Repair at ${repair.port}:</strong><br />
                Method: ${this.getRepairMethodLabel(repair.method)}<br />
                Cost: ${repair.cost} gp<br />
                Time: ${repair.days} days<br />
                ${repair.description ? `Notes: ${repair.description}` : ''}
            </div>
        `).join('');
    }

    /**
     * Build passenger manifest HTML
     */
    static buildPassengerManifestHTML(passengerManifest) {
        const totalPassengers = passengerManifest.reduce((sum, group) => sum + group.count, 0);
        const totalRevenue = passengerManifest.reduce((sum, group) => sum + group.revenue, 0);

        return `
            ${passengerManifest.map(group => `
                <div class="port-entry">
                    <strong>${group.type === "regular" ? "Regular Passengers" : "Charter Service"}:</strong><br />
                    Origin: ${group.origin}<br />
                    Destination: ${group.destination}<br />
                    ${group.distance ? `Distance: ${group.distance} miles<br />` : ''}
                    Passengers: ${group.count}<br />
                    Revenue: ${group.revenue} gp
                </div>
            `).join('')}

            <div class="info-box">
                <strong>Total Passengers:</strong> ${totalPassengers}<br />
                <strong>Total Revenue:</strong> ${totalRevenue} gp
            </div>
        `;
    }

    /**
     * Calculate profit distribution
     */
    static calculateProfitDistribution(params) {
        const { ownerNetProfit, crewEarningsFromTrade, ship } = params;

        let ownerShare = 0;
        let captainShare = 0;
        let lieutenantShares = 0;
        let mateShares = 0;
        let commonCrewShare = 0;

        if (ownerNetProfit > 0) {
            ownerShare = Math.floor(ownerNetProfit * 0.50);
            const remainingProfit = ownerNetProfit - ownerShare;

            const lieutenantCount = ship.crew.find(c => c.role === "lieutenant")?.count || 0;
            lieutenantShares = Math.floor(remainingProfit * 0.05) * lieutenantCount;

            const mateCount = ship.crew.find(c => c.role === "mate")?.count || 0;
            mateShares = Math.floor(remainingProfit * 0.01) * mateCount;

            captainShare = Math.floor(remainingProfit * 0.25);

            commonCrewShare = remainingProfit - captainShare - lieutenantShares - mateShares;
        }

        const totalCrewPayout = crewEarningsFromTrade + captainShare + lieutenantShares + mateShares + commonCrewShare;

        return {
            ownerShare,
            captainShare,
            lieutenantShares,
            mateShares,
            commonCrewShare,
            totalCrewPayout
        };
    }

    /**
     * Helper methods
     */
    static parseWeatherDate(dateStr) {
        const match = dateStr.match(/^(\w+)\s+(\d+),\s+CY\s+(\d+)$/);
        return match ? `${match[2]} ${match[1]} ${match[3]}` : dateStr;
    }

    static getVesselConditionDescription(currentHull, maxHull) {
        const percent = (currentHull / maxHull) * 100;
        if (percent > 75) return "excellent condition, requiring only routine maintenance";
        if (percent > 50) return "fair condition with minor damage that may be easily repaired";
        if (percent > 25) return "poor condition requiring significant repairs";
        return "critical condition requiring immediate and extensive repairs";
    }

    static getRepairMethodLabel(method) {
        const labels = {
            professional: "Professional Shipyard",
            drydock: "Dry Dock Facility",
            selfrepair: "Crew Self-Repair"
        };
        return labels[method] || method;
    }

    static formatWeatherLog(weatherHtml) {
        return weatherHtml
            .replace(/<p><strong>/g, '<div style="margin: 8px 0; padding: 5px 0; border-bottom: 1px dotted #8b4513;"><strong>')
            .replace(/<\/strong>/g, '</strong><br />')
            .replace(/<\/p>/g, '</div>');
    }

    /**
     * Get or create voyage folder
     */
    static async getOrCreateVoyageFolder() {
        const existingFolder = game.folders.find(f => f.name === "Voyage Logs" && f.type === "JournalEntry");
        if (existingFolder) return existingFolder.id;

        const folder = await Folder.create({
            name: "Voyage Logs",
            type: "JournalEntry",
            color: "#8b4513"
        });
        return folder.id;
    }

    /**
     * Offer HTML export if journal creation fails
     */
    static async offerHTMLExport(htmlContent, fileName) {
        return new Promise((resolve) => {
            new Dialog({
                title: "Journal Creation Failed",
                content: `<p>Could not create journal entry. Export as HTML file instead?</p>`,
                buttons: {
                    export: {
                        icon: '<i class="fas fa-file-export"></i>',
                        label: "Export HTML",
                        callback: () => {
                            this.exportHTML(htmlContent, fileName);
                            resolve(true);
                        }
                    },
                    close: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Close",
                        callback: () => resolve(false)
                    }
                }
            }).render(true);
        });
    }

    /**
     * Export HTML to file
     */
    static exportHTML(htmlContent, fileName) {
        const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        ui.notifications.info(`Voyage log exported as ${link.download}`);
    }
}