/**
 * Cargo Perishability System
 * Handles cargo spoilage based on distance and time
 * 
 * Per AD&D rules: "Cargo can be perishable. If the distance traveled since the
 * last transaction is greater than the distance rolled, 25% of the time 25% of 
 * the cargo will have perished for each additional unit of travel."
 * 
 * The d6 distance roll (from sale price calculation) determines perishability:
 * - Short (1-2): <80 miles threshold
 * - Medium (3-5): ≤250 miles threshold  
 * - Long (6): ≤500 miles threshold
 */

import { CargoRegistry } from '../data/cargo.js';

export class CargoPerishability {

    /**
     * Check if cargo has perished during voyage
     * @param {Object} distanceRollInfo - {roll, category, threshold, actualDistance} from sale calculation
     * @param {number} currentLoads - Current number of loads
     * @returns {Object} {loadsLost, loadsRemaining, perishabilityNote, spoiled}
     */
    static async checkPerishability(distanceRollInfo, currentLoads) {
        const { roll, category, threshold, actualDistance } = distanceRollInfo;
        
        // If actual distance is within threshold, cargo is fine - no logging needed
        if (actualDistance <= threshold) {
            return {
                loadsLost: 0,
                loadsRemaining: currentLoads,
                perishabilityNote: null,
                spoiled: false
            };
        }
        
        // Calculate how many distance "units" beyond threshold we traveled
        const excessUnits = this.calculateExcessUnits(category, actualDistance);
        
        if (excessUnits === 0) {
            return {
                loadsLost: 0,
                loadsRemaining: currentLoads,
                perishabilityNote: null,
                spoiled: false
            };
        }
        
        // Roll for spoilage on each excess unit (25% chance of 25% loss each)
        const spoilageResults = await this.rollSpoilage(excessUnits, currentLoads);
        
        // Only generate note if something actually spoiled
        if (spoilageResults.totalLost === 0) {
            return {
                loadsLost: 0,
                loadsRemaining: currentLoads,
                perishabilityNote: null,
                spoiled: false
            };
        }
        
        const loadsRemaining = currentLoads - spoilageResults.totalLost;
        const perishabilityNote = this.buildPerishabilityNote(
            actualDistance,
            threshold,
            category,
            excessUnits,
            spoilageResults
        );
        
        return {
            loadsLost: spoilageResults.totalLost,
            loadsRemaining: loadsRemaining,
            perishabilityNote: perishabilityNote,
            spoiled: true,
            distanceRoll: roll,
            threshold: threshold,
            excessUnits: excessUnits,
            spoilageDetails: spoilageResults.details
        };
    }

    /**
     * Calculate how many distance units beyond threshold
     */
    static calculateExcessUnits(category, actualDistance) {
        let excessUnits = 0;
        
        if (category === "Short" && actualDistance > 80) {
            if (actualDistance > 500) excessUnits = 3;
            else if (actualDistance > 250) excessUnits = 2;
            else excessUnits = 1;
        } 
        else if (category === "Medium" && actualDistance > 250) {
            if (actualDistance > 500) excessUnits = 2;
            else excessUnits = 1;
        } 
        else if (category === "Long" && actualDistance > 500) {
            excessUnits = 1;
        }
        
        return excessUnits;
    }

    /**
     * Roll for spoilage on each excess unit
     * 25% chance that 25% of remaining cargo perishes per excess unit
     */
    static async rollSpoilage(excessUnits, startingLoads) {
        let totalLost = 0;
        const details = [];
        
        for (let unit = 0; unit < excessUnits; unit++) {
            const perishChance = new Roll("1d100");
            await perishChance.evaluate();
            
            if (perishChance.total <= 25) {
                const currentRemaining = startingLoads - totalLost;
                const lostThisUnit = Math.ceil(currentRemaining * 0.25);
                totalLost += lostThisUnit;
                
                details.push({
                    unit: unit + 1,
                    roll: perishChance.total,
                    spoiled: true,
                    loadsLost: lostThisUnit
                });
            } else {
                details.push({
                    unit: unit + 1,
                    roll: perishChance.total,
                    spoiled: false,
                    loadsLost: 0
                });
            }
        }
        
        return { totalLost, details };
    }

    /**
     * Build descriptive note for log - only called when spoilage occurs
     */
    static buildPerishabilityNote(distance, threshold, category, excessUnits, spoilageResults) {
        const spoiledUnits = spoilageResults.details.filter(d => d.spoiled);
        const spoiledText = spoiledUnits.map(d => `${d.loadsLost} loads`).join(', ');
        
        return `Voyage exceeded ${category} cargo threshold (${distance} mi > ${threshold} mi). ` +
               `${spoilageResults.totalLost} loads of cargo spoiled (${spoiledText}).`;
    }

    /**
     * Get perishability risk level for display
     */
    static getPerishabilityRisk(distanceTraveled) {
        if (distanceTraveled < 80) return { level: "Very Low", color: "green" };
        if (distanceTraveled < 250) return { level: "Low", color: "lightgreen" };
        if (distanceTraveled < 500) return { level: "Moderate", color: "orange" };
        return { level: "High", color: "red" };
    }

    /**
     * Apply perishability to cargo before sale
     * @param {Object} distanceRollInfo - From CargoSelling._lastDistanceRoll
     * @param {number} currentLoads - Current cargo loads
     * @param {Object} logRef - Reference to voyage log HTML
     * @param {string} portName - Name of port for logging
     */
    static async applyPerishability(distanceRollInfo, currentLoads, logRef, portName) {
        const result = await this.checkPerishability(distanceRollInfo, currentLoads);
        
        if (result.spoiled && result.loadsLost > 0) {
            logRef.value += `<p><strong>⚠️ Cargo Spoilage at ${portName}:</strong> ${result.perishabilityNote}</p>`;
            
            if (result.loadsRemaining === 0) {
                logRef.value += `<p><strong>❌ Total Cargo Loss:</strong> All cargo has perished. Nothing to sell.</p>`;
                return {
                    success: false,
                    loadsRemaining: 0,
                    loadsLost: result.loadsLost,
                    note: result.perishabilityNote
                };
            }
            
            return {
                success: true,
                loadsRemaining: result.loadsRemaining,
                loadsLost: result.loadsLost,
                note: result.perishabilityNote
            };
        }
        
        // No spoilage - don't log anything
        return {
            success: true,
            loadsRemaining: currentLoads,
            loadsLost: 0,
            note: null
        };
    }
}