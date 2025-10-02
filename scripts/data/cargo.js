/**
 * Cargo Type Registry
 * Manages cargo definitions and trade goods
 */

export class CargoRegistry {
    static types = new Map();

    static initialize() {
        const cargoData = {
            primitive: {
                name: "Primitive Goods",
                baseValue: 50,
                valueRoll: { min: 3, max: 5 },
                description: "Basic commodities: grain, lumber, stone, simple textiles"
            },
            consumer: {
                name: "Consumer Goods",
                baseValue: 150,
                valueRoll: { min: 6, max: 8 },
                description: "Common trade goods: tools, cloth, preserved foods, pottery"
            },
            comfort: {
                name: "Comfort Items",
                baseValue: 250,
                valueRoll: { min: 9, max: 12 },
                description: "Quality goods: furniture, glassware, wines, fine clothing"
            },
            fine: {
                name: "Fine Goods",
                baseValue: 400,
                valueRoll: { min: 13, max: 16 },
                description: "Luxury items: jewelry, art, rare spices, masterwork items"
            },
            precious: {
                name: "Precious Goods",
                baseValue: 2000,
                valueRoll: { min: 17, max: 20 },
                description: "Exceptional valuables: gems, magical items, exotic creatures"
            }
        };

        for (const [id, data] of Object.entries(cargoData)) {
            this.types.set(id, data);
        }

        console.log(`Cargo Registry | Registered ${this.types.size} cargo types`);
    }

    static get(id) {
        return this.types.get(id);
    }

    static getAll() {
        return Array.from(this.types.values());
    }

    /**
     * Determine cargo type from 3d6 roll
     */
    static determineTypeFromRoll(rollTotal) {
        if (rollTotal <= 5) return "primitive";
        if (rollTotal <= 8) return "consumer";
        if (rollTotal <= 12) return "comfort";
        if (rollTotal <= 16) return "fine";
        return "precious";
    }

    /**
     * Get sale adjustment percentage from SA roll
     */
    static getSaleAdjustment(saRoll) {
        const table = {
            3: 30, 4: 40, 5: 50, 6: 60, 7: 70,
            8: 80, 9: 90, 10: 100, 11: 110, 12: 120,
            13: 130, 14: 140, 15: 150, 16: 160, 17: 180,
            18: 200, 19: 300, 20: 400
        };
        
        if (saRoll > 20) return table[20];
        if (saRoll < 3) return table[3];
        return table[saRoll];
    }
}