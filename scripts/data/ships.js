/**
 * Ship Registry
 * Manages ship definitions and instances
 */

export class ShipRegistry {
    static ships = new Map();

    static initialize() {
        // Register default ships
        this.register('small_merchant_1', {
            id: "small_merchant_1",
            name: "Surprise",
            shipType: "Small Merchant Vessel",
            hullPoints: { value: 36, max: 36 },
            cargoCapacity: 30,
            movement: 15, // inches per round (5 mph tactical, scales to 120 mi/day)
            baseEarningsPerDay: 50,
            currentPort: "greyhawk_city",
            captain: { name: "Captain Beldan", level: 5 },
            crew: [
                { role: "lieutenant", level: 1, count: 1 },
                { role: "mate", level: 0, count: 1 },
                { role: "sailor", level: 0, count: 8 },
                { role: "oarsman", level: 0, count: 2 },
                { role: "marine", level: 0, count: 0 }
            ]
        });

        this.register('medium_cog_1', {
            id: "medium_cog_1",
            name: "Ocean Star",
            shipType: "Medium Cog",
            hullPoints: { value: 40, max: 40 },
            cargoCapacity: 50,
            movement: 12, // inches per round (4 mph tactical, scales to 96 mi/day)
            baseEarningsPerDay: 120,
            currentPort: "greyhawk_city",
            captain: { name: "Captain Bellara", level: 3 },
            crew: [
                { role: "lieutenant", level: 2, count: 2 },
                { role: "mate", level: 0, count: 4 },
                { role: "sailor", level: 0, count: 30 },
                { role: "oarsman", level: 0, count: 5 },
                { role: "marine", level: 0, count: 5 }
            ]
        });

        console.log(`Ship Registry | Registered ${this.ships.size} ships`);
    }

    static register(id, shipData) {
        this.ships.set(id, shipData);
    }

    static get(id) {
        return this.ships.get(id);
    }

    static getAll() {
        return Array.from(this.ships.values());
    }

    static createInstance(id) {
        const template = this.get(id);
        if (!template) {
            throw new Error(`Ship template '${id}' not found`);
        }
        // Deep clone to create a new instance
        return foundry.utils.deepClone(template);
    }
}