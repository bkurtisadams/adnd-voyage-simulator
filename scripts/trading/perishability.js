/**
 * Cargo Perishability System
 * Handles cargo spoilage based on distance and time
 */

import { CargoRegistry } from '../data/cargo.js';

export class CargoPerishability {

    /**
     * Check if cargo has perished during voyage
     * @param {string} cargoType - Type of cargo
     * @param {number} distanceTraveled - Actual distance traveled since purchase
     * @param {number} currentLoads - Current number of loads
     * @returns {Object} {loadsLost, loadsRemaining, perishabilityNote}
     */
    static async checkPerishability(cargoType, distanceTraveled, currentLoads) {
        // Roll d6 to determine distance category threshold (not actual distance)
        const distanceRoll = new Roll("1d6");
        await distanceRoll.evaluate();
        
        let distanceCategory;
        let distanceThreshold;
        
        if (distanceRoll.total <= 2) { 
            distanceCategory = "Short";
            distanceThreshold = 80;
        } else if (distanceRoll.total <= 5) { 
            distanceCategory = "Medium";
            distanceThreshold = 250;
        } else { 
            distanceCategory = "Long";
            distanceThreshold = 500;
        }
        
        // If actual distance is within threshold, cargo is fine
        if (distanceTraveled <= distanceThreshold) {
            return {
                loadsLost: 0,
                loadsRemaining: currentLoads,
                perishabilityNote: `Cargo intact (${distanceTraveled} mi ≤ ${distanceThreshold} mi ${distanceCategory} threshold)`,
                distanceRoll: distanceRoll.total,
                threshold: distanceThreshold
            };
        }
        
        // Calculate how many distance "units" beyond threshold we traveled
        const excessUnits = this.calculateExcessUnits(
            distanceCategory,
            distanceTraveled,
            distanceThreshold
        );
        
        if (excessUnits === 0) {
            return {
                loadsLost: 0,
                loadsRemaining: currentLoads,
                perishabilityNote: `Cargo intact (within ${distanceCategory} category)`,
                distanceRoll: distanceRoll.total,
                threshold: distanceThreshold
            };
        }
        
        // Roll for spoilage on each excess unit
        const spoilageResults = await this.rollSpoilage(excessUnits, currentLoads);
        
        const loadsRemaining = currentLoads - spoilageResults.totalLost;
        const perishabilityNote = this.buildPerishabilityNote(
            distanceTraveled,
            distanceThreshold,
            distanceCategory,
            excessUnits,
            spoilageResults
        );
        
        return {
            loadsLost: spoilageResults.totalLost,
            loadsRemaining: loadsRemaining,
            perishabilityNote: perishabilityNote,
            distanceRoll: distanceRoll.total,
            threshold: distanceThreshold,
            excessUnits: excessUnits,
            spoilageDetails: spoilageResults.details
        };
    }

    /**
     * Calculate how many distance units beyond threshold
     */
    static calculateExcessUnits(category, actualDistance, threshold) {
        let excessUnits = 0;
        
        if (category === "Short" && actualDistance > 80) {
            // Short -> Medium (80-250)
            if (actualDistance > 500) excessUnits = 3; // -> Long -> Extraordinary
            else if (actualDistance > 250) excessUnits = 2; // -> Long
            else excessUnits = 1; // -> Medium
        } 
        else if (category === "Medium" && actualDistance > 250) {
            // Medium -> Long (250-500)
            if (actualDistance > 500) excessUnits = 2; // -> Long -> Extraordinary
            else excessUnits = 1; // -> Long
        } 
        else if (category === "Long" && actualDistance > 500) {
            excessUnits = 1; // -> Extraordinary
        }
        
        return excessUnits;
    }

    /**
     * Roll for spoilage on each excess unit
     */
    static async rollSpoilage(excessUnits, startingLoads) {
        let totalLost = 0;
        const details = [];
        
        for (let unit = 0; unit < excessUnits; unit++) {
            const perishChance = new Roll("1d100");
            await perishChance.evaluate();
            
            if (perishChance.total <= 25) { // 25% chance
                // 25% of REMAINING cargo perishes
                const currentRemaining = startingLoads - totalLost;
                const lostThisUnit = Math.ceil(currentRemaining * 0.25);
                totalLost += lostThisUnit;
                
                details.push({
                    unit: unit + 1,
                    roll: perishChance.total,
                    spoiled: true,
                    loadsLost: lostThisUnit,
                    note: `Unit ${unit + 1}: ${lostThisUnit} loads spoiled (${perishChance.total}% ≤ 25%)`
                });
            } else {
                details.push({
                    unit: unit + 1,
                    roll: perishChance.total,
                    spoiled: false,
                    loadsLost: 0,
                    note: `Unit ${unit + 1}: no spoilage (${perishChance.total}% > 25%)`
                });
            }
        }
        
        return { totalLost, details };
    }

    /**
     * Build descriptive note for log
     */
    static buildPerishabilityNote(distance, threshold, category, excessUnits, spoilageResults) {
        const spoilageText = spoilageResults.details.map(d => d.note).join('; ');
        
        return `Cargo perishability check: ${distance} mi > ${threshold} mi ${category} threshold ` +
               `(+${excessUnits} excess unit${excessUnits !== 1 ? 's' : ''}). ` +
               `${spoilageText}. Total lost: ${spoilageResults.totalLost} loads`;
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
     */
    static async applyPerishability(cargoType, distanceTraveled, currentLoads, logRef, portName) {
        const result = await this.checkPerishability(cargoType, distanceTraveled, currentLoads);
        
        if (result.loadsLost > 0) {
            logRef.value += `<p><strong>⚠️ Cargo Spoilage at ${portName}:</strong> ${result.perishabilityNote}</p>`;
            
            // If all cargo spoiled
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
        } else {
            logRef.value += `<p><strong>✓ Cargo Condition at ${portName}:</strong> ${result.perishabilityNote}</p>`;
            return {
                success: true,
                loadsRemaining: currentLoads,
                loadsLost: 0,
                note: result.perishabilityNote
            };
        }
    }
}