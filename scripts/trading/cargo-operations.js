/**
 * Cargo Operations Time Calculator
 * Handles loading/unloading timing with merchant availability
 */

import { ProficiencySystem } from './proficiency.js';

export class CargoOperations {

    /**
     * Calculate time required for cargo operations
     * Separates physical work time from merchant availability
     */
    static async calculateOperationTime(params) {
        const {
            loadsToHandle,
            merchantCount,
            crewCount,
            moorageType,
            isLoading = false,
            crewQualityMod = 0
        } = params;

        // PHYSICAL LOADING/UNLOADING TIME
        const baseCrewEfficiency = Math.floor(crewCount / 5); // 5 crew per load per hour
        const effectiveCrewRate = Math.max(1, baseCrewEfficiency);

        // Crew quality affects time multiplier
        let timeMultiplier = 1;
        if (crewQualityMod === -2) timeMultiplier = 1.25;
        else if (crewQualityMod === -1) timeMultiplier = 1.1;
        else if (crewQualityMod === +1) timeMultiplier = 0.9;
        else if (crewQualityMod === +2) timeMultiplier = 0.75;

        let baseHoursPerLoad = 1 / effectiveCrewRate;
        
        if (isLoading) {
            baseHoursPerLoad *= 1.5; // Loading takes 50% longer
        }
        
        if (moorageType === "Anchor") {
            // Anchorage penalties
            baseHoursPerLoad *= isLoading ? 2.5 : 1.75;
        }
        
        const totalHoursForPhysicalWork = Math.ceil(loadsToHandle * baseHoursPerLoad * timeMultiplier);
        const daysNeededForPhysicalWork = Math.ceil(totalHoursForPhysicalWork / 12);
        
        // MERCHANT AVAILABILITY TIMING
        // Rules: Half available week 1, quarter week 2, remainder one per week
        let merchantAvailabilityWeeks = 0;
        
        if (loadsToHandle > 0 && merchantCount > 0) {
            const merchantsNeeded = Math.ceil(loadsToHandle / 5); // Each merchant handles ~5 loads
            const merchantsWeek1 = Math.ceil(merchantCount / 2);
            const merchantsWeek2 = Math.ceil(merchantCount / 4);
            const merchantsWeek3Plus = merchantCount - merchantsWeek1 - merchantsWeek2;
            
            if (merchantsNeeded <= merchantsWeek1) {
                merchantAvailabilityWeeks = 1;
            } else if (merchantsNeeded <= merchantsWeek1 + merchantsWeek2) {
                merchantAvailabilityWeeks = 2;
            } else {
                const additionalNeeded = merchantsNeeded - merchantsWeek1 - merchantsWeek2;
                merchantAvailabilityWeeks = 2 + Math.min(additionalNeeded, merchantsWeek3Plus);
            }
        }
        
        const merchantAvailabilityDays = merchantAvailabilityWeeks * 7;
        
        // TOTAL = MAX of physical work OR merchant availability
        const totalDays = Math.max(daysNeededForPhysicalWork, merchantAvailabilityDays);
        
        return {
            totalHours: totalHoursForPhysicalWork,
            daysNeeded: totalDays,
            hoursPerLoad: baseHoursPerLoad,
            weeksSpentTrading: Math.ceil(totalDays / 7),
            physicalWorkDays: daysNeededForPhysicalWork,
            merchantAvailabilityDays: merchantAvailabilityDays,
            merchantsNeeded: loadsToHandle > 0 ? Math.ceil(loadsToHandle / 5) : 0,
            merchantsAvailable: merchantCount,
            bottleneck: merchantAvailabilityDays > daysNeededForPhysicalWork ? "merchants" : "physical"
        };
    }

    /**
     * Format operation time details for logging
     */
    static formatOperationLog(timeResult, operationType = "Loading") {
        let log = `${operationType} time: ${timeResult.totalHours} hours physical work (${timeResult.physicalWorkDays} days)`;
        
        if (timeResult.bottleneck === "merchants") {
            log += `, waiting ${timeResult.merchantAvailabilityDays} days for merchants ` +
                   `(needed ${timeResult.merchantsNeeded}, available ${timeResult.merchantsAvailable})`;
        }
        
        log += `. Total: ${timeResult.daysNeeded} days`;
        return log;
    }
}