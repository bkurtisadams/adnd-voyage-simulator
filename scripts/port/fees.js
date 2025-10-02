/**
 * Port Fees System
 * Handles port entrance, moorage, and pilot fees
 */

import { PortRegistry } from '../data/ports.js';

export class PortFees {

    /**
     * Handle all port arrival fees
     */
    static async handlePortArrival(params) {
        const {
            portId,
            shipTemplate,
            currentTreasury,
            currentPortActivity,
            voyageLogHtmlRef
        } = params;

        const portName = PortRegistry.get(portId).name;
        let feesPaid = 0;
        let daysSpent = 0;
        let newTreasury = currentTreasury;

        // Entrance fee (d10 + 10 gp)
        const entranceRoll = new Roll("1d10 + 10");
        await entranceRoll.evaluate();
        const entranceFee = entranceRoll.total;
        
        newTreasury -= entranceFee;
        feesPaid += entranceFee;
        
        currentPortActivity.fees.entrance = entranceFee;
        currentPortActivity.totalCost += entranceFee;
        currentPortActivity.activities.push(`Paid entrance fee: ${entranceFee} gp`);
        voyageLogHtmlRef.value += `<p><strong>Entrance Fee at ${portName}:</strong> ${entranceRoll.formula} = ${entranceFee} gp</p>`;

        // Moorage (80% chance of berth, otherwise anchor)
        const moorageCheck = new Roll("1d100");
        await moorageCheck.evaluate();
        
        let moorageCost, moorageType;
        if (moorageCheck.total <= 80) {
            moorageType = "Berth";
            moorageCost = shipTemplate.hullPoints.max * 1; // 1 gp/hull point/day
            currentPortActivity.activities.push(`Secured berth (${moorageCheck.total}% ≤ 80%)`);
        } else {
            moorageType = "Anchor";
            moorageCost = 5; // 5 gp/day flat
            currentPortActivity.activities.push(`Anchored in harbor (${moorageCheck.total}% > 80%)`);
        }
        
        newTreasury -= moorageCost;
        feesPaid += moorageCost;
        daysSpent += 1; // Initial day of moorage
        
        currentPortActivity.fees.moorage = {
            cost: moorageCost,
            type: moorageType,
            roll: moorageCheck.total,
            days: 1
        };
        currentPortActivity.totalCost += moorageCost;
        
        voyageLogHtmlRef.value += `<p><strong>Moorage at ${portName} (${moorageType}):</strong> ${moorageCost} gp (1 day)</p>`;

        // Pilot/Towage (1 gp per hull point)
        const pilotCost = shipTemplate.hullPoints.max * 1;
        newTreasury -= pilotCost;
        feesPaid += pilotCost;
        
        currentPortActivity.fees.pilot = pilotCost;
        currentPortActivity.totalCost += pilotCost;
        currentPortActivity.activities.push(`Pilot/towage service: ${pilotCost} gp`);
        
        voyageLogHtmlRef.value += `<p><strong>Pilot/Towage at ${portName}:</strong> ${pilotCost} gp</p>`;

        return {
            newTreasury: newTreasury,
            feesPaid: feesPaid,
            daysSpent: daysSpent,
            moorageType: moorageType
        };
    }

    /**
     * Calculate additional moorage fees for extended port stays
     */
    static calculateDailyMoorage(moorageType, hullPoints, additionalDays) {
        if (additionalDays <= 0) return 0;
        
        const dailyRate = moorageType === "Berth" ? hullPoints : 5;
        return dailyRate * additionalDays;
    }

    /**
     * Apply daily moorage fees and update port activity
     */
    static applyDailyMoorage(portActivity, moorageType, hullPoints, additionalDays) {
        if (additionalDays <= 0) return 0;
        
        const cost = this.calculateDailyMoorage(moorageType, hullPoints, additionalDays);
        
        if (portActivity.fees.moorage) {
            portActivity.fees.moorage.days += additionalDays;
            portActivity.fees.moorage.cost += cost;
        } else {
            portActivity.fees.moorage = {
                type: moorageType,
                days: additionalDays,
                cost: cost
            };
        }
        
        portActivity.totalCost += cost;
        portActivity.activities.push(`Daily moorage for ${additionalDays} days: ${cost} gp`);
        
        return cost;
    }
}