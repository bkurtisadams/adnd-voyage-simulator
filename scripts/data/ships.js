/**
 * Ship Registry
 * Ship templates from DMG (1e p.53-54) and Seafaring supplement.
 * Templates are generic ship types; instances are named player ships
 * cloned from templates.
 *
 * Movement values are in "inches" per the DMG/Seafaring scale.
 * The simulator converts to miles/day via MILES_PER_INCH_DAILY.
 *
 * Hull points follow the Seafaring/DMG convention:
 *   Hull value = hull points.  Cost to repair = 100 gp/HP professional.
 *
 * Cargo capacity is in "loads" (1 load ~ 1 ton displacement for trade goods).
 *
 * Crew arrays list minimum required complement. Officers (captain, lieutenant,
 * mate) are calculated separately in initializeVoyageState based on crew total.
 */

export class ShipRegistry {
    static templates = new Map();
    static ships = new Map(); // player-named instances

    static initialize() {
        this._registerTemplates();
        this._registerLegacyInstances();
        console.log(`Ship Registry | ${this.templates.size} templates, ${this.ships.size} instances`);
    }

    // =========================================================================
    // TEMPLATES — generic ship types from DMG + Seafaring
    // =========================================================================
    static _registerTemplates() {
        const t = (id, data) => this.templates.set(id, { id, ...data });

        // -----------------------------------------------------------------
        // DMG 1e Ships (p.53-54)
        // Hull values are dice ranges per DMG. We store the formula for
        // rolling at creation time and a typical (midpoint) as default.
        // Speed is in mph per the DMG speed table.
        // Cargo capacity is estimated from hull size (not in DMG).
        // Ship class determines boarding height advantage.
        // Dimensions from DMG Length/Width table.
        // -----------------------------------------------------------------

        t("rowboat", {
            shipType: "Rowboat",
            source: "DMG",
            shipClass: "rowboat",
            hullFormula: "1d4",
            hullPoints: { value: 3, max: 3 },
            cargoCapacity: 1,
            normalSail: 2, maxSail: 3,
            normalOar: 1, maxOar: 2,
            movement: 2, // normalSail for legacy compat
            movementOar: 1,
            rigging: "none",
            length: "8-20 ft", width: "2-4 ft",
            crew: [
                { role: "sailor", count: 1 }
            ],
            marines: 0,
            cost: 50,
            notes: "Small boats rowed by oars or paddles. Ship's longboats, dugout canoes, skiffs. Do not function well in breezes above 19 mph."
        });

        t("barge_small", {
            shipType: "Small Barge",
            source: "DMG",
            shipClass: "barge",
            hullFormula: "1d6",
            hullPoints: { value: 4, max: 4 },
            cargoCapacity: 15,
            normalSail: 2, maxSail: 3,
            normalOar: 1, maxOar: 1,
            movement: 2,
            movementOar: 1,
            rigging: "none",
            length: "15-20 ft", width: "8-12 ft",
            crew: [
                { role: "sailor", count: 2 },
                { role: "oarsman", count: 8 }
            ],
            marines: 0,
            cost: 200,
            notes: "Shallow-draft river vessel. Do not function well in winds above moderate breezes."
        });

        t("barge_large", {
            shipType: "Large Barge",
            source: "DMG",
            shipClass: "barge",
            hullFormula: "2d4",
            hullPoints: { value: 5, max: 5 },
            cargoCapacity: 40,
            normalSail: 1, maxSail: 2,
            normalOar: 0.5, maxOar: 1,
            movement: 1,
            movementOar: 1,
            rigging: "none",
            length: "25-45 ft", width: "12-20 ft",
            crew: [
                { role: "sailor", count: 4 },
                { role: "oarsman", count: 20 }
            ],
            marines: 0,
            cost: 500,
            notes: "Large rectangular river/coastal vessel. Very slow but high capacity."
        });

        t("galley_small", {
            shipType: "Small Galley",
            source: "DMG",
            shipClass: "galley",
            hullFormula: "2d6",
            hullPoints: { value: 7, max: 7 },
            cargoCapacity: 10,
            normalSail: 6, maxSail: 9,
            normalOar: 5, maxOar: 8,
            movement: 6,
            movementOar: 5,
            rigging: "square",
            length: "30-60 ft", width: "8-15 ft",
            crew: [
                { role: "sailor", count: 5 },
                { role: "oarsman", count: 30 }
            ],
            marines: 10,
            cost: 10000,
            notes: "Light oared warship. Can ram. Crew at -1 boarding merchant/warship (height disadvantage). Clinker-built for maneuverability."
        });

        t("galley_large", {
            shipType: "Large Galley",
            source: "DMG",
            shipClass: "galley",
            hullFormula: "4d4",
            hullPoints: { value: 10, max: 10 },
            cargoCapacity: 20,
            normalSail: 4, maxSail: 7,
            normalOar: 4, maxOar: 8,
            movement: 4,
            movementOar: 4,
            rigging: "square",
            length: "120-160 ft", width: "20-30 ft",
            crew: [
                { role: "sailor", count: 10 },
                { role: "oarsman", count: 100 }
            ],
            marines: 30,
            cost: 25000,
            notes: "Heavy war galley with ram. Bireme/trireme type. Crew at -1 boarding merchant/warship."
        });

        t("merchant_small", {
            shipType: "Small Merchant",
            source: "DMG",
            shipClass: "merchant",
            hullFormula: "6d6",
            hullPoints: { value: 21, max: 21 },
            cargoCapacity: 30,
            normalSail: 5, maxSail: 7,
            normalOar: 0.5, maxOar: 1,
            movement: 5,
            movementOar: 1,
            rigging: "lateen",
            length: "25-40 ft", width: "10-15 ft",
            crew: [
                { role: "sailor", count: 10 }
            ],
            marines: 0,
            cost: 5000,
            notes: "Wide-hulled single-mast lateen-sailed vessel. Can be moved by sweeps at rowboat speed. Favored by merchants and pirates alike."
        });

        t("merchant_large", {
            shipType: "Large Merchant",
            source: "DMG",
            shipClass: "merchant",
            hullFormula: "12d4",
            hullPoints: { value: 30, max: 30 },
            cargoCapacity: 100,
            normalSail: 3, maxSail: 5,
            normalOar: 0.25, maxOar: 0.5,
            movement: 3,
            movementOar: 0.5,
            rigging: "square",
            length: "50-80 ft", width: "15-25 ft",
            crew: [
                { role: "sailor", count: 20 }
            ],
            marines: 0,
            cost: 15000,
            notes: "Cog/carrack type. Sturdy, few sailors needed. Defenders at +1 vs galley boarders."
        });

        t("warship", {
            shipType: "Warship",
            source: "DMG",
            shipClass: "warship",
            hullFormula: "7d6",
            hullPoints: { value: 25, max: 25 },
            cargoCapacity: 15,
            normalSail: 4, maxSail: 6,
            normalOar: 0.5, maxOar: 1,
            movement: 4,
            movementOar: 1,
            rigging: "square",
            length: "70-100 ft", width: "15-25 ft",
            crew: [
                { role: "sailor", count: 15 },
                { role: "oarsman", count: 10 }
            ],
            marines: 20,
            cost: 20000,
            notes: "Nao type, square-sailed, 2+ masts, caravel construction. Overhanging forecastle, rounded stern. Defenders at +1 vs galley boarders."
        });

        // -----------------------------------------------------------------
        // Seafaring Ships ("Oops, I'm at Sea" supplement)
        // Speed stored as dailySail / dailyOar in miles (from the source).
        // Asterisk routes can double movement on open ocean (day+night).
        // Hull values are dice ranges rolled at instance creation.
        // Seaworthy % = chance of surviving open-ocean conditions.
        // -----------------------------------------------------------------

        t("raft", {
            shipType: "Raft",
            source: "Seafaring",
            shipClass: "barge",
            hullFormula: null,
            hullPoints: { value: 5, max: 5 },
            cargoCapacity: 5, // 10,000 cn ~ 5 loads
            dailySail: 12, dailyOar: 12,
            normalSail: 3, maxSail: 3,
            normalOar: 3, maxOar: 3,
            movement: 3, movementOar: 3,
            oceanDouble: false,
            rigging: "none",
            seaworthy: 30,
            length: "up to 30×40 ft", width: "10-40 ft",
            crew: [
                { role: "sailor", count: 2 }
            ],
            marines: 0,
            foodDays: 0,
            cost: 50,
            notes: "Logs lashed together. 30% Seaworthy. Can be built by PCs in d3 days per 100 sq ft."
        });

        t("rowboat", {
            shipType: "Rowboat",
            source: "Seafaring",
            shipClass: "rowboat",
            hullFormula: "1d4",
            hullPoints: { value: 3, max: 3 },
            cargoCapacity: 2, // 2000-4000 cn
            dailySail: 18, dailyOar: 9,
            normalSail: 6, maxSail: 9,
            normalOar: 3, maxOar: 6,
            movement: 6, movementOar: 3,
            oceanDouble: false,
            rigging: "none",
            seaworthy: 35,
            length: "8-20 ft", width: "2-4 ft",
            crew: [
                { role: "sailor", count: 2 }
            ],
            marines: 0,
            foodDays: 0,
            cost: 75,
            notes: "Canoe, skiff, or small boat. 35% Seaworthy. Does not function well above 19 mph winds."
        });

        t("lifeboat", {
            shipType: "Lifeboat",
            source: "Seafaring",
            shipClass: "rowboat",
            hullFormula: "1d4",
            hullPoints: { value: 3, max: 3 },
            cargoCapacity: 3, // 5000 cn stowed on ship + 15000 cn capacity
            dailySail: 18, dailyOar: 9,
            normalSail: 6, maxSail: 9,
            normalOar: 3, maxOar: 6,
            movement: 6, movementOar: 3,
            oceanDouble: false,
            rigging: "square",
            seaworthy: 55,
            length: "20 ft", width: "4-5 ft",
            crew: [
                { role: "sailor", count: 2 }
            ],
            marines: 0,
            foodDays: 7,
            cost: 150,
            notes: "Ship's lifeboat with collapsible mast. 55% Seaworthy. Stores 1 week iron rations for 10. Takes 1 turn to launch."
        });

        t("outrigger", {
            shipType: "Outrigger",
            source: "Seafaring",
            shipClass: "rowboat",
            hullFormula: "1d4+3",
            hullPoints: { value: 6, max: 6 },
            cargoCapacity: 5, // 5000-20000 cn
            dailySail: 24, dailyOar: 18,
            normalSail: 6, maxSail: 6,
            normalOar: 3, maxOar: 3,
            movement: 6, movementOar: 3,
            oceanDouble: false,
            rigging: "lateen",
            seaworthy: 70,
            length: "20-80 ft", width: "16 ft avg",
            crew: [
                { role: "sailor", count: 3 },
                { role: "oarsman", count: 3 }
            ],
            marines: 0,
            foodDays: 3,
            cost: 75,
            notes: "70% Seaworthy. Longer versions can make transoceanic voyages. Simple to build: 1 man, 1 week."
        });

        t("barge_small_sf", {
            shipType: "Small Barge",
            source: "Seafaring",
            shipClass: "barge",
            hullFormula: "1d4+1",
            hullPoints: { value: 4, max: 4 },
            cargoCapacity: 80, // 160,000 cn
            dailySail: 16, dailyOar: 8,
            normalSail: 4.5, maxSail: 6,
            normalOar: 3, maxOar: 4.5,
            movement: 4.5, movementOar: 3,
            oceanDouble: false,
            rigging: "none",
            seaworthy: 30,
            length: "15-20 ft", width: "4 ft",
            crew: [
                { role: "sailor", count: 2 },
                { role: "oarsman", count: 4 }
            ],
            marines: 0,
            foodDays: 3,
            cost: 500,
            notes: "30% Seaworthy. Calm inland waterways only. 4 passengers + 6,000 cn personal gear."
        });

        t("barge_large_sf", {
            shipType: "Large Barge",
            source: "Seafaring",
            shipClass: "barge",
            hullFormula: "2d3+1",
            hullPoints: { value: 5, max: 5 },
            cargoCapacity: 160, // 320,000 cn
            dailySail: 8, dailyOar: 4,
            normalSail: 3, maxSail: 6,
            normalOar: 2, maxOar: 3,
            movement: 3, movementOar: 2,
            oceanDouble: false,
            rigging: "none",
            seaworthy: 30,
            length: "25-40 ft", width: "12-20 ft",
            crew: [
                { role: "sailor", count: 2 },
                { role: "oarsman", count: 6 }
            ],
            marines: 0,
            foodDays: 3,
            cost: 1000,
            notes: "30% Seaworthy. Calm inland waterways only. 6 passengers + 7,500 cn personal gear."
        });

        t("galley_small_sf", {
            shipType: "Small Galley (Hemiolia)",
            source: "Seafaring",
            shipClass: "galley",
            hullFormula: "2d6",
            hullPoints: { value: 7, max: 7 },
            cargoCapacity: 15, // 20,000-40,000 cn
            dailySail: 50, dailyOar: 30,
            normalSail: 18, maxSail: 27,
            normalOar: 15, maxOar: 24,
            movement: 18, movementOar: 15,
            oceanDouble: false,
            rigging: "square",
            seaworthy: 40,
            length: "60-100 ft", width: "10-15 ft",
            crew: [
                { role: "sailor", count: 10 },
                { role: "oarsman", count: 60 }
            ],
            marines: 20,
            foodDays: 10,
            cost: 10000,
            notes: "40% Seaworthy. Coastal/lake use. Ram (d4+2 × 3 hull dmg) and 2 light catapults. Beaches at night."
        });

        t("galley_large_sf", {
            shipType: "Large Galley (Dromond)",
            source: "Seafaring",
            shipClass: "galley",
            hullFormula: "4d4",
            hullPoints: { value: 10, max: 10 },
            cargoCapacity: 150, // 300,000 cn
            dailySail: 50, dailyOar: 30,
            normalSail: 12, maxSail: 21,
            normalOar: 12, maxOar: 24,
            movement: 12, movementOar: 12,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 45,
            length: "120-150 ft", width: "15-20 ft",
            crew: [
                { role: "sailor", count: 20 },
                { role: "oarsman", count: 180 }
            ],
            marines: 50,
            foodDays: 20,
            cost: 25000,
            notes: "45% Seaworthy. Ocean/large lake. Ram (d6+3 × 3 hull dmg), 2 light catapults. 100 oars, 50/side, upper+lower banks."
        });

        t("galley_war", {
            shipType: "War Galley (Cataphract)",
            source: "Seafaring",
            shipClass: "galley",
            hullFormula: "4d4+8",
            hullPoints: { value: 18, max: 18 },
            cargoCapacity: 30, // 60,000 cn
            dailySail: 36, dailyOar: 12,
            normalSail: 12, maxSail: 12,
            normalOar: 6, maxOar: 6,
            movement: 12, movementOar: 6,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 45,
            length: "120-150 ft", width: "20-30 ft",
            crew: [
                { role: "sailor", count: 30 },
                { role: "oarsman", count: 150 }
            ],
            marines: 75,
            foodDays: 14,
            cost: 50000,
            notes: "45% Seaworthy. Two-masted combat galley. Always has ram (d6+4 × 3 hull dmg). Two towers (+3 AC), up to 3 light catapults."
        });

        t("sailing_boat", {
            shipType: "Sailing Boat (Fishing)",
            source: "Seafaring",
            shipClass: "merchant",
            hullFormula: "3d8",
            hullPoints: { value: 14, max: 14 },
            cargoCapacity: 10, // 20,000 cn
            dailySail: 60, dailyOar: 10,
            normalSail: 15, maxSail: 21,
            normalOar: 2, maxOar: 3,
            movement: 15, movementOar: 2,
            oceanDouble: true,
            rigging: "lateen",
            seaworthy: 70,
            length: "15-45 ft", width: "5-15 ft",
            crew: [
                { role: "sailor", count: 1 }
            ],
            marines: 0,
            foodDays: 1,
            cost: 2000,
            notes: "70% Seaworthy. Small single-masted coastal/lake craft. 60 mi/day on open ocean (day+night sailing)."
        });

        t("sailing_small", {
            shipType: "Small Sailing Ship (Knarr)",
            source: "Seafaring",
            shipClass: "merchant",
            hullFormula: "6d6",
            hullPoints: { value: 21, max: 21 },
            cargoCapacity: 100, // 200,000 cn
            dailySail: 50, dailyOar: 20,
            normalSail: 15, maxSail: 21,
            normalOar: 2, maxOar: 3,
            movement: 15, movementOar: 2,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 65,
            length: "60-80 ft", width: "20-30 ft",
            crew: [
                { role: "sailor", count: 10 }
            ],
            marines: 0,
            foodDays: 30,
            cost: 5000,
            notes: "65% Seaworthy. Single mast, square sail, small stern castle. Flat bottom for rivers/beaching. 1 ballista. 50 mi open ocean."
        });

        t("sailing_large", {
            shipType: "Large Sailing Ship (Cog)",
            source: "Seafaring",
            shipClass: "merchant",
            hullFormula: "12d4",
            hullPoints: { value: 30, max: 30 },
            cargoCapacity: 200, // 400,000 cn
            dailySail: 35, dailyOar: 15,
            normalSail: 9, maxSail: 15,
            normalOar: 1, maxOar: 2,
            movement: 9, movementOar: 1,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 67,
            length: "100-150 ft", width: "25-30 ft",
            crew: [
                { role: "sailor", count: 20 }
            ],
            marines: 0,
            foodDays: 60,
            cost: 15000,
            notes: "65-70% Seaworthy. 2-3 masts, fore/sterncastle. Up to 2 artillery. 35 mi/day coastal, 70 open ocean."
        });

        t("troop_transport", {
            shipType: "Troop Transport",
            source: "Seafaring",
            shipClass: "merchant",
            hullFormula: "4d10+12",
            hullPoints: { value: 34, max: 34 },
            cargoCapacity: 300, // 600,000 cn
            dailySail: 50, dailyOar: 0,
            normalSail: 12, maxSail: 15,
            normalOar: 0, maxOar: 0,
            movement: 12, movementOar: 0,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 60,
            length: "100-150 ft", width: "25-30 ft",
            crew: [
                { role: "sailor", count: 20 }
            ],
            marines: 100,
            foodDays: 60,
            cost: 22500,
            notes: "60% Seaworthy. Same size as large sailing ship but double capacity. Side hatch for horses/animals. No oars."
        });

        t("warship_sf", {
            shipType: "Warship (Nao/Carrack)",
            source: "Seafaring",
            shipClass: "warship",
            hullFormula: "7d6",
            hullPoints: { value: 25, max: 25 },
            cargoCapacity: 50, // 100,000 cn
            dailySail: 50, dailyOar: 20,
            normalSail: 12, maxSail: 18,
            normalOar: 2, maxOar: 3,
            movement: 12, movementOar: 2,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 60,
            length: "70-100 ft", width: "15-25 ft",
            crew: [
                { role: "sailor", count: 20 }
            ],
            marines: 50,
            foodDays: 60,
            cost: 20000,
            notes: "60% Seaworthy. Three-masted nao/carrack. Up to 4 artillery (max 2 catapults). 50 mi/day open ocean."
        });

        t("longship_sf", {
            shipType: "Longship (Drakkar)",
            source: "Seafaring",
            shipClass: "galley",
            hullFormula: "2d8",
            hullPoints: { value: 9, max: 9 },
            cargoCapacity: 100, // 200,000 cn
            dailySail: 45, dailyOar: 18,
            normalSail: 15, maxSail: 15,
            normalOar: 9, maxOar: 18,
            movement: 15, movementOar: 9,
            oceanDouble: true,
            rigging: "square",
            seaworthy: 60,
            length: "60-120 ft", width: "10-15 ft",
            crew: [
                { role: "sailor", count: 75 }
            ],
            marines: 0,
            foodDays: 10,
            cost: 15000,
            notes: "60% Seaworthy. Square-sailed oared galley, single unsteppable mast. 75 sailors act as rowers+marines. No ram. 50 rowers for full speed."
        });
    }

    // =========================================================================
    // LEGACY INSTANCES — preserve existing named ships for backwards compat
    // =========================================================================
    static _registerLegacyInstances() {
        this.register('small_merchant_1', {
            id: "small_merchant_1",
            name: "Surprise",
            shipType: "Small Merchant",
            templateId: "merchant_small",
            shipClass: "merchant",
            hullPoints: { value: 36, max: 36 },
            hullFormula: "6d6",
            cargoCapacity: 30,
            normalSail: 5, maxSail: 7,
            normalOar: 0.5, maxOar: 1,
            movement: 5,
            movementOar: 1,
            rigging: "lateen",
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
            shipType: "Cog",
            templateId: "cog",
            shipClass: "merchant",
            hullPoints: { value: 40, max: 40 },
            cargoCapacity: 50,
            normalSail: 5, maxSail: 7,
            normalOar: 0, maxOar: 0,
            movement: 5,
            movementOar: 0,
            rigging: "square",
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
    }

    // =========================================================================
    // TEMPLATE API
    // =========================================================================

    static getTemplate(id) {
        return this.templates.get(id);
    }

    static getAllTemplates() {
        return Array.from(this.templates.entries()).map(([id, data]) => ({ id, ...data }));
    }

    /**
     * Get templates grouped by source for optgroup display.
     */
    static getTemplatesGrouped() {
        const dmg = [];
        const seafaring = [];
        for (const [id, t] of this.templates) {
            const entry = { id, ...t };
            if (t.source === "DMG") dmg.push(entry);
            else seafaring.push(entry);
        }
        return { dmg, seafaring };
    }

    /**
     * Create a new named ship instance from a template.
     * Rolls hull value from the DMG formula if present.
     */
    static createFromTemplate(templateId, name, port = "greyhawk_city") {
        const tmpl = this.getTemplate(templateId);
        if (!tmpl) throw new Error(`Ship template '${templateId}' not found`);

        // Roll hull points from formula if DMG-style dice range
        let hullMax = tmpl.hullPoints.max;
        if (tmpl.hullFormula) {
            try {
                const roll = new Roll(tmpl.hullFormula);
                roll.evaluate({ async: false });
                hullMax = roll.total;
                console.log(`Ship Registry | Rolled hull for ${tmpl.shipType}: ${tmpl.hullFormula} = ${hullMax}`);
            } catch {
                // Fallback to stored default
            }
        }

        const id = `${templateId}_${Date.now()}`;
        const instance = {
            id,
            name,
            shipType: tmpl.shipType,
            templateId: templateId,
            shipClass: tmpl.shipClass || "merchant",
            hullPoints: { value: hullMax, max: hullMax },
            hullFormula: tmpl.hullFormula || null,
            cargoCapacity: tmpl.cargoCapacity,
            // Daily miles — Seafaring ships provide this directly
            dailySail: tmpl.dailySail || null,
            dailyOar: tmpl.dailyOar || null,
            oceanDouble: tmpl.oceanDouble || false,
            // Speed in mph — DMG ships use this for conversion
            normalSail: tmpl.normalSail || tmpl.movement || 3,
            maxSail: tmpl.maxSail || tmpl.normalSail || tmpl.movement || 3,
            normalOar: tmpl.normalOar || tmpl.movementOar || 0,
            maxOar: tmpl.maxOar || tmpl.normalOar || 0,
            // Legacy movement field for backwards compat with simulator
            movement: tmpl.normalSail || tmpl.movement || 3,
            movementOar: tmpl.normalOar || tmpl.movementOar || 0,
            rigging: tmpl.rigging || "square",
            seaworthy: tmpl.seaworthy || 50,
            length: tmpl.length || "",
            width: tmpl.width || "",
            foodDays: tmpl.foodDays || 7,
            baseEarningsPerDay: Math.floor(tmpl.cargoCapacity * 2),
            currentPort: port,
            captain: { name: "", level: 0 },
            crew: JSON.parse(JSON.stringify(tmpl.crew)).map(c => ({ ...c, level: 0 })),
            cost: tmpl.cost || 0,
            notes: tmpl.notes || ""
        };

        // Add marines from template
        if (tmpl.marines > 0) {
            instance.crew.push({ role: "marine", level: 0, count: tmpl.marines });
        }

        this.register(id, instance);
        return instance;
    }

    // =========================================================================
    // INSTANCE API (backwards-compatible)
    // =========================================================================

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
            throw new Error(`Ship instance '${id}' not found`);
        }
        return foundry.utils.deepClone(template);
    }
}
