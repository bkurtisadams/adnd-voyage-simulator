/**
 * Maritime Encounter System
 * Handles random encounters at sea per AD&D DMG rules
 * 
 * DMG Rules:
 * - Fresh Water: Encounter 1 in 20, check morning, evening, midnight (3×/day)
 * - Salt Water Coastal/Shallow: Encounter 1 in 20, check dawn and noon (2×/day)
 * - Salt Water Deep: Encounter 1 in 20, check once at noon (1×/day)
 * 
 * Encounter Mitigation:
 * - Unintelligent monsters 75% driven off by flaming oil nearby, 90% if burned
 * - Large amounts of food 50% likely to end encounters
 */

import { EncounterRegistry } from '../data/encounters.js';

export class EncounterSystem {

    /**
     * Water type configurations for encounter frequency
     */
    static WATER_TYPES = {
        FRESH: { 
            checks: ["morning", "evening", "midnight"], 
            depth: "FRESH",
            description: "Fresh water (river, lake)"
        },
        COASTAL: { 
            checks: ["dawn", "noon"], 
            depth: "SHALLOW",
            description: "Coastal salt water"
        },
        SHALLOW: { 
            checks: ["dawn", "noon"], 
            depth: "SHALLOW",
            description: "Shallow salt water"
        },
        DEEP: { 
            checks: ["noon"], 
            depth: "DEEP",
            description: "Deep ocean water"
        }
    };

    /**
     * Process all encounter checks for a sailing day
     * @param {string} waterType - FRESH, COASTAL, SHALLOW, or DEEP
     * @returns {Array} Array of all encounters that occurred
     */
    static async processDailyEncounters(waterType = "SHALLOW") {
        const waterConfig = this.WATER_TYPES[waterType] || this.WATER_TYPES.SHALLOW;
        const encounters = [];

        console.log(`EncounterSystem | Processing ${waterConfig.checks.length} encounter checks for ${waterType} water`);
        
        for (const timeOfDay of waterConfig.checks) {
            const encounter = await this.rollForEncounter(timeOfDay, waterConfig.depth);
            if (encounter) {
                console.log(`EncounterSystem | Encounter at ${timeOfDay}: ${encounter.encounter.name}`);
                encounters.push(encounter);
            }
        }

        return encounters;
    }

    /**
     * Roll for a single encounter check
     * Encounter occurs on 1 in 20 (d20 = 1)
     */
    static async rollForEncounter(timeOfDay = "dawn", depth = "SHALLOW") {
        const encounterCheck = new Roll("1d20");
        await encounterCheck.evaluate();

        console.log(`EncounterSystem | ${timeOfDay} check: d20=${encounterCheck.total} (need 1 for encounter)`);
        
        if (encounterCheck.total !== 1) {
            return null;
        }

        console.log(`EncounterSystem | ENCOUNTER! Rolling on ${depth} tables...`);
        
        // Determine frequency category (d100)
        const frequencyRoll = new Roll("1d100");
        await frequencyRoll.evaluate();

        let category;
        if (frequencyRoll.total <= 65) category = "COMMON";
        else if (frequencyRoll.total <= 85) category = "UNCOMMON";
        else if (frequencyRoll.total <= 97) category = "RARE";
        else category = "VERY_RARE";

        console.log(`EncounterSystem | Frequency roll: ${frequencyRoll.total} = ${category}`);
        
        // Get encounter from registry
        const encounter = EncounterRegistry.rollEncounter(depth, category);
        if (!encounter) {
            console.warn(`EncounterSystem | No encounter found for ${depth}/${category}`);
            return null;
        }
        
        console.log(`EncounterSystem | Selected: ${encounter.name}`);

        // Roll encounter distance and surprise
        const distanceInfo = await this.rollEncounterDistance(encounter);
        const surpriseInfo = await this.rollSurprise(encounter);

        // Adjust distance for surprise
        let effectiveDistance = distanceInfo.distance;
        if (surpriseInfo.shipSurprised) {
            effectiveDistance = Math.max(1, effectiveDistance - surpriseInfo.surpriseSegments);
        }

        // Classify encounter type
        const classification = this.classifyEncounter(encounter);

        // Determine intelligence
        const isUnintelligent = this.isUnintelligent(encounter);

        // Roll number appearing
        const numberAppearing = await this.rollNumberAppearing(encounter);

        return {
            timeOfDay,
            encounter,
            category,
            classification,
            frequencyRoll: frequencyRoll.total,
            distance: effectiveDistance,
            distanceRaw: distanceInfo.distance,
            distanceType: distanceInfo.type,
            surprise: surpriseInfo,
            numberAppearing,
            isUnintelligent,
            canBeDrivenOff: isUnintelligent && classification === "threat"
        };
    }

    /**
     * Roll encounter distance
     * Surface creatures: 6d4 × 10 yards in clear conditions
     * Underwater creatures: 6d4 yards
     */
    static async rollEncounterDistance(encounter) {
        const canSubmerge = this.canCreatureSubmerge(encounter);
        const distRoll = new Roll("6d4");
        await distRoll.evaluate();
        
        if (canSubmerge) {
            return {
                distance: distRoll.total,
                type: "underwater",
                note: `Creature surfaced ${distRoll.total} yards away`
            };
        } else {
            return {
                distance: distRoll.total * 10,
                type: "surface",
                note: `Sighted at ${distRoll.total * 10} yards`
            };
        }
    }

    /**
     * Determine if creature can approach from underwater
     */
    static canCreatureSubmerge(encounter) {
        const name = encounter.name.toLowerCase();
        const submergeCreatures = [
            "shark", "whale", "kraken", "squid", "octopus", "serpent", "snake",
            "sahuagin", "merrow", "scrag", "troll", "turtle", "ray", "eel",
            "seahorse", "sea lion", "fish", "barracuda", "urchin", "jellyfish",
            "man-o-war", "elemental", "otter", "dolphin", "porpoise"
        ];
        return submergeCreatures.some(c => name.includes(c));
    }

    /**
     * Determine if creature is unintelligent (can be driven off)
     */
    static isUnintelligent(encounter) {
        const name = encounter.name.toLowerCase();
        const unintelligentCreatures = [
            "shark", "whale", "squid", "octopus", "ray", "eel", "barracuda",
            "jellyfish", "man-o-war", "turtle", "fish", "snake", "serpent",
            "crab", "urchin", "seahorse"
        ];
        return unintelligentCreatures.some(c => name.includes(c));
    }

    /**
     * Roll for surprise
     * Monsters surprise ships as normal; Ships never surprise unless special conditions
     */
    static async rollSurprise(encounter) {
        let surpriseChance = 2; // Base 2 in 6
        
        // Check for special surprise ability
        if (encounter.other) {
            const surpriseMatch = encounter.other.match(/surprise\s*(\d+)\s*in\s*6/i);
            if (surpriseMatch) {
                surpriseChance = parseInt(surpriseMatch[1]);
            }
        }

        const surpriseRoll = new Roll("1d6");
        await surpriseRoll.evaluate();

        const shipSurprised = surpriseRoll.total <= surpriseChance;
        const surpriseSegments = shipSurprised ? surpriseChance : 0;

        return {
            shipSurprised,
            surpriseRoll: surpriseRoll.total,
            surpriseChance,
            surpriseSegments,
            note: shipSurprised ? `Ship surprised! (${surpriseRoll.total} ≤ ${surpriseChance})` : ""
        };
    }

    /**
     * Roll number appearing from encounter data
     */
    static async rollNumberAppearing(encounter) {
        if (!encounter.number || encounter.number === "-") {
            return { count: 1, roll: null };
        }

        try {
            let formula = encounter.number
                .replace(/×/g, "*")
                .replace(/x/gi, "*");
            
            const roll = new Roll(formula);
            await roll.evaluate();
            return { count: roll.total, roll: formula };
        } catch (e) {
            const parsed = parseInt(encounter.number);
            return { count: isNaN(parsed) ? 1 : parsed, roll: null };
        }
    }

    /**
     * Attempt to drive off encounter with flaming oil
     * DMG: Unintelligent monsters 75% driven off by flaming oil nearby, 90% if burned
     * @param {Object} encounterResult - The encounter result object
     * @param {boolean} oilBurning - Whether oil is actively burning the creature
     * @returns {Object} { drivenOff: boolean, roll: number, needed: number }
     */
    static async attemptDriveOffWithOil(encounterResult, oilBurning = false) {
        if (!encounterResult.isUnintelligent) {
            return { drivenOff: false, roll: null, needed: null, note: "Creature is intelligent - oil ineffective" };
        }

        const driveOffChance = oilBurning ? 90 : 75;
        const roll = new Roll("1d100");
        await roll.evaluate();

        const drivenOff = roll.total <= driveOffChance;
        return {
            drivenOff,
            roll: roll.total,
            needed: driveOffChance,
            note: drivenOff 
                ? `Creature driven off by ${oilBurning ? 'burning' : 'flaming'} oil! (${roll.total} ≤ ${driveOffChance}%)`
                : `Creature not deterred by oil (${roll.total} > ${driveOffChance}%)`
        };
    }

    /**
     * Attempt to end encounter with food
     * DMG: Large amounts of food 50% likely to end encounters
     * @param {Object} encounterResult - The encounter result object
     * @returns {Object} { ended: boolean, roll: number, needed: number }
     */
    static async attemptEndWithFood(encounterResult) {
        if (!encounterResult.isUnintelligent) {
            return { ended: false, roll: null, needed: null, note: "Creature is intelligent - food ineffective" };
        }

        const endChance = 50;
        const roll = new Roll("1d100");
        await roll.evaluate();

        const ended = roll.total <= endChance;
        return {
            ended,
            roll: roll.total,
            needed: endChance,
            note: ended 
                ? `Creature distracted by food! Encounter ended. (${roll.total} ≤ ${endChance}%)`
                : `Creature ignores food (${roll.total} > ${endChance}%)`
        };
    }

    /**
     * Classify encounter as threat/sighting/hazard/interactive
     * Only large monsters, aerial creatures, and pirates are true threats to ships
     */
    static classifyEncounter(encounter) {
        const name = encounter.name.toLowerCase();
        const size = (encounter.size || "").toUpperCase();

        const hazards = ["seaweed", "shoals", "whirlpool", "maelstrom", "ice", "reef"];
        if (hazards.some(h => name.includes(h))) {
            return "hazard";
        }

        const interactiveEncounters = ["man, merchant", "ship", "island", "omen", "albatross", "merchant"];
        if (interactiveEncounters.some(e => name.includes(e))) {
            return "interactive";
        }

        // Only large/aerial/pirate creatures are ship threats
        const shipThreats = [
            "dragon", "kraken", "elemental", "giant", "roc", "scrag", 
            "troll", "sea serpent", "hydra", "squid, giant", "octopus, giant", 
            "sahuagin", "sea hag", "merrow", "pirate", "buccaneer",
            "whale, carnivorous", "turtle, giant", "wyvern", "leviathan"
        ];
        
        const isLargeSize = size.includes("L") || size.includes("G");
        const isKnownThreat = shipThreats.some(t => name.includes(t));
        
        if (isKnownThreat || (isLargeSize && this.isAggressive(encounter))) {
            return "threat";
        }

        // Small/medium creatures are sightings, not threats to ships
        return "sighting";
    }

    /**
     * Check if creature is aggressive based on encounter data
     */
    static isAggressive(encounter) {
        if (encounter.other?.toLowerCase().includes("attack")) return true;
        if (encounter.damage && encounter.damage !== "0" && encounter.damage !== "-") {
            // Only 15% of damage-capable creatures are aggressive
            return Math.random() <= 0.15;
        }
        return false;
    }

    /**
     * Generate encounter description text
     */
    static generateEncounterText(encounterResult) {
        const enc = encounterResult.encounter;
        const classification = encounterResult.classification;
        const count = encounterResult.numberAppearing?.count || 1;
        const countText = count > 1 ? ` (×${count})` : "";
        const timeText = encounterResult.timeOfDay ? ` [${encounterResult.timeOfDay}]` : "";
        const distText = encounterResult.distance ? ` at ${encounterResult.distance} yards` : "";

        let text = "";
        switch (classification) {
            case "sighting":
                text = `Spotted ${enc.name.toLowerCase()}${countText}${distText}${timeText}`;
                break;
            case "threat":
                text = `⚔️ ${enc.name}${countText} attacks the ship${distText}${timeText}!`;
                break;
            case "hazard":
                text = `⚠️ ${enc.name} encountered${timeText}`;
                break;
            case "interactive":
                if (enc.name.toLowerCase().includes("man") || enc.name.toLowerCase().includes("ship")) {
                    text = `🚢 Encountered ${enc.name.toLowerCase()}${timeText}`;
                } else if (enc.name.toLowerCase().includes("island")) {
                    text = `🏝️ Sighted ${enc.name.toLowerCase()}${timeText}`;
                } else {
                    text = `${enc.name}${timeText}`;
                }
                break;
            default:
                text = `Encountered ${enc.name.toLowerCase()}${countText}${timeText}`;
        }

        // Add surprise info for threats
        if (classification === "threat" && encounterResult.surprise?.shipSurprised) {
            text += ` ${encounterResult.surprise.note}`;
        }

        return text;
    }

    /**
     * Calculate encounter damage (for threats/hazards)
     * Only large monsters, aerial monsters, and pirates can harm ships/sailors
     */
    static async calculateEncounterDamage(encounter, classification, numberAppearing = 1) {
        if (classification === "sighting" || classification === "interactive") {
            return { hullDamage: 0, crewLoss: 0, notes: "" };
        }

        // Check if creature can actually harm a ship
        const canHarmShip = this.canCreatureHarmShip(encounter);
        if (!canHarmShip.canHarm) {
            return { 
                hullDamage: 0, 
                crewLoss: 0, 
                notes: canHarmShip.reason 
            };
        }

        let hullDamage = 0;
        let crewLoss = 0;
        let notes = "";

        // Check for special effects in encounter data
        if (encounter.other) {
            const effect = this.parseSpecialEffect(encounter.other);
            if (effect) {
                hullDamage += effect.hullDamage || 0;
                crewLoss += effect.crewLoss || 0;
                notes = effect.notes || "";
            }
        }

        // Calculate base threat damage
        if (classification === "threat") {
            const hdMatch = encounter.hd?.match(/(\d+)/);
            const baseHD = hdMatch ? parseInt(hdMatch[1]) : 1;
            const totalHD = baseHD * numberAppearing;
            
            // Large creatures: 1 hull damage per 10 HD (minimum 1)
            // Aerial: can damage rigging, 1 per 15 HD
            // Pirates: based on number
            if (canHarmShip.type === "large") {
                const hdBasedDamage = Math.max(1, Math.floor(totalHD / 10));
                const damageRoll = new Roll(`1d${Math.max(2, hdBasedDamage * 2)}`);
                await damageRoll.evaluate();
                hullDamage += damageRoll.total;
            } else if (canHarmShip.type === "aerial") {
                // Aerial creatures damage rigging/sails, less hull damage
                const damageRoll = new Roll("1d4");
                await damageRoll.evaluate();
                hullDamage += damageRoll.total;
                notes = notes || "Rigging/sail damage from aerial attack";
            } else if (canHarmShip.type === "pirate") {
                // Pirates: boarding action
                const damageRoll = new Roll("1d6");
                await damageRoll.evaluate();
                hullDamage += damageRoll.total;
                notes = "Ship damaged during boarding action";
            }

            // Crew casualties - only from threats that can reach the deck
            if (canHarmShip.canHarmCrew && totalHD >= 6) {
                const crewRoll = new Roll("1d4");
                await crewRoll.evaluate();
                crewLoss = crewRoll.total;
            }
        }

        // Hazard damage
        if (classification === "hazard") {
            const hazardDamage = await this.calculateHazardDamage(encounter);
            hullDamage += hazardDamage.hull;
            notes = hazardDamage.notes;
        }

        return { hullDamage, crewLoss, notes };
    }

    /**
     * Determine if a creature can harm a ship
     * Only large monsters (L/G size), aerial monsters, and pirates/hostile ships
     */
    static canCreatureHarmShip(encounter) {
        const name = encounter.name.toLowerCase();
        const size = (encounter.size || "").toUpperCase();
        
        // Pirates and hostile ships
        const pirateTypes = ["pirate", "buccaneer", "raider", "warship", "galley", "man, pirate"];
        if (pirateTypes.some(p => name.includes(p))) {
            return { canHarm: true, type: "pirate", canHarmCrew: true, reason: "" };
        }
        
        // Aerial creatures that can attack ships
        const aerialCreatures = ["dragon", "roc", "wyvern", "griffon", "hippogriff", "manticore", "chimera", "harpy", "pteranodon"];
        if (aerialCreatures.some(a => name.includes(a))) {
            return { canHarm: true, type: "aerial", canHarmCrew: true, reason: "" };
        }
        
        // Large sea monsters that can damage ships (size L or G, or known large creatures)
        const largeSeaMonsters = [
            "kraken", "leviathan", "sea serpent", "whale", "turtle, giant", 
            "squid, giant", "octopus, giant", "elemental", "dragon turtle",
            "serpent", "hydra", "aboleth"
        ];
        
        // Check explicit size
        const isLargeSize = size.includes("L") || size.includes("G");
        
        // Check known large monsters
        const isKnownLarge = largeSeaMonsters.some(m => name.includes(m));
        
        // Merrow (ogres) and Scrags (trolls) are large humanoids that can board
        const canBoard = ["merrow", "scrag", "troll", "ogre", "giant"].some(m => name.includes(m));
        
        if (isLargeSize || isKnownLarge) {
            return { canHarm: true, type: "large", canHarmCrew: true, reason: "" };
        }
        
        if (canBoard) {
            return { canHarm: true, type: "boarding", canHarmCrew: true, reason: "" };
        }
        
        // Small/medium creatures cannot harm ships
        const creatureName = encounter.name;
        return { 
            canHarm: false, 
            type: "small", 
            canHarmCrew: false, 
            reason: `${creatureName} circles the ship but cannot harm the vessel.`
        };
    }

    /**
     * Parse special effects from encounter "other" field
     */
    static parseSpecialEffect(otherText) {
        const text = otherText.toLowerCase();
        
        if (text.includes("capsize")) {
            return { hullDamage: 0, crewLoss: 0, notes: "Creature attempts to capsize ship!", special: "capsize" };
        }
        if (text.includes("swallow")) {
            return { hullDamage: 2, crewLoss: 1, notes: "Creature can swallow crew/small boats" };
        }
        if (text.includes("constriction")) {
            return { hullDamage: 3, crewLoss: 0, notes: "Creature constricts ship" };
        }
        
        return null;
    }

    /**
     * Calculate damage from environmental hazards
     */
    static async calculateHazardDamage(encounter) {
        const name = encounter.name.toLowerCase();

        if (name.includes("whirlpool") || name.includes("maelstrom")) {
            const roll = new Roll("2d10");
            await roll.evaluate();
            return { hull: roll.total, notes: "Ship dragged into whirlpool! Must escape or be destroyed." };
        }
        if (name.includes("ice")) {
            const roll = new Roll("1d6");
            await roll.evaluate();
            return { hull: roll.total, notes: "Ice collision! 10% chance of holing ship." };
        }
        if (name.includes("reef") || name.includes("shoals")) {
            const roll = new Roll("2d6");
            await roll.evaluate();
            return { hull: roll.total, notes: "Ship struck reef/shoals!" };
        }
        if (name.includes("seaweed")) {
            return { hull: 0, notes: "Floating seaweed slows ship by 50%. 40% chance of additional encounter." };
        }

        return { hull: 0, notes: "" };
    }

    /**
     * Check for capsizing attempt by large creature
     * Only truly massive creatures can attempt to capsize ships
     * @param {Object} encounter - The encounter data
     * @param {Object} ship - Ship data with size info
     * @returns {Object} { attemptCapsize: boolean, capsizeChance: number }
     */
    static calculateCapsizeChance(encounter, ship) {
        const name = encounter.name.toLowerCase();
        const size = (encounter.size || "").toUpperCase();
        
        // Only gargantuan creatures or those with explicit capsize ability
        const capsizeCreatures = ["turtle, giant", "whale", "kraken", "leviathan", "elemental, water"];
        const hasCapsize = encounter.other?.toLowerCase().includes("capsize");
        
        if (!hasCapsize && !capsizeCreatures.some(c => name.includes(c))) {
            return { attemptCapsize: false, capsizeChance: 0 };
        }
        
        // Must be size G or have explicit capsize ability
        if (!size.includes("G") && !hasCapsize) {
            return { attemptCapsize: false, capsizeChance: 0 };
        }

        // Base 10% modified by ship size
        let capsizeChance = 10;
        const hullMax = ship?.hullPoints?.max || 20;
        
        if (hullMax <= 10) capsizeChance += 15;      // Very small (rowboat, canoe)
        else if (hullMax <= 20) capsizeChance += 10; // Small (small sailing ship)
        else if (hullMax <= 40) capsizeChance += 5;  // Medium
        else if (hullMax >= 60) capsizeChance -= 5;  // Large
        else if (hullMax >= 80) capsizeChance -= 10; // Very large (galleon)

        return { attemptCapsize: true, capsizeChance: Math.max(0, capsizeChance) };
    }
}