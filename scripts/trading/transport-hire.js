/**
 * Transport for Hire System
 * Merchants offering paid shipping jobs
 */

import { CargoRegistry } from '../data/cargo.js';

export class TransportHireSystem {

    /**
     * Check if transport for hire is enabled
     */
    static isEnabled() {
        return game.settings.get("adnd-voyage-simulator", "transportForHireEnabled");
    }

    /**
     * Roll for transport job availability
     * @param {boolean} solicited - Crew actively seeking work (+25%)
     */
    static async rollForJob(solicited = false) {
        if (!this.isEnabled()) return null;

        const chance = solicited ? 30 : 5;
        const roll = new Roll("1d100");
        await roll.evaluate();

        if (roll.total > chance) return null;

        // Determine cargo details
        const loadsRoll = new Roll("1d12");
        await loadsRoll.evaluate();
        const loads = loadsRoll.total;

        // Determine cargo type (same 3d6 table)
        const typeRoll = new Roll("3d6");
        await typeRoll.evaluate();
        const cargoType = CargoRegistry.determineTypeFromRoll(typeRoll.total);

        // Destination distance: most remote port within 2d20 × 100 miles
        const distRoll = new Roll("2d20 * 100");
        await distRoll.evaluate();
        const maxDistance = distRoll.total;

        return {
            available: true,
            loads,
            cargoType,
            cargoName: CargoRegistry.get(cargoType).name,
            maxDistance,
            roll: roll.total,
            chance
        };
    }

    /**
     * Calculate transport fee
     * 40 gp per ton (2 loads) per 500 miles, minimum 100 gp
     */
    static calculateFee(loads, distanceMiles) {
        const tons = loads / 2;
        const segments = Math.ceil(distanceMiles / 500);
        const fee = tons * 40 * segments;
        return Math.max(fee, 100);
    }

    /**
     * Create a transport contract
     */
    static createContract(job, destinationPort, actualDistance) {
        const totalFee = this.calculateFee(job.loads, actualDistance);
        const upfrontPayment = Math.floor(totalFee / 2);
        const deliveryPayment = totalFee - upfrontPayment;

        return {
            loads: job.loads,
            cargoType: job.cargoType,
            cargoName: job.cargoName,
            destinationPort,
            distance: actualDistance,
            totalFee,
            upfrontPayment,
            deliveryPayment,
            status: "active"
        };
    }
}