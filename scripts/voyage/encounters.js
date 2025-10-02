/**
 * Maritime Encounter System
 * Handles random encounters at sea
 */

import { EncounterRegistry } from '../data/encounters.js';

export class EncounterSystem {

    /**
     * Roll for encounter
     */
    static async rollForEncounter(timeOfDay = "dawn") {
        const encounterCheck = new Roll("1d20");
        await encounterCheck.evaluate();

        if (encounterCheck.total !== 1) {
            return null; // No encounter
        }

        // Determine frequency category
        const frequencyRoll = new Roll("1d100");
        await frequencyRoll.evaluate();

        let category;
        if (frequencyRoll.total <= 65) category = "COMMON";
        else if (frequencyRoll.total <= 85) category = "UNCOMMON";
        else if (frequencyRoll.total <= 97) category = "RARE";
        else category = "VERY_RARE";

        // Get encounter
        const waterType = "SHALLOW"; // Could be parameterized
        const encounter = EncounterRegistry.rollEncounter(waterType, category);

        if (!encounter) return null;

        // Classify encounter type
        const classification = this.classifyEncounter(encounter);

        return {
            timeOfDay: timeOfDay,
            encounter: encounter,
            category: category,
            classification: classification,
            frequencyRoll: frequencyRoll.total
        };
    }

    /**
     * Classify encounter as threat/sighting/hazard/interactive
     */
    static classifyEncounter(encounter) {
        const creatureName = encounter.name.toLowerCase();

        const directThreats = ["dragon", "kraken", "elemental", "giant", "roc", "scrag", 
                               "troll", "sea serpent", "snake", "hydra", "squid", "octopus", 
                               "sahuagin", "sea hag", "sirine", "nereid", "kelpie"];
        
        const interactiveEncounters = ["man", "ship", "island", "omen", "albatross"];
        const hazards = ["seaweed", "shoals", "whirlpool", "maelstrom", "ice", "reef"];

        if (directThreats.some(threat => creatureName.includes(threat))) {
            return "threat";
        } else if (interactiveEncounters.some(enc => creatureName.includes(enc))) {
            return "interactive";
        } else if (hazards.some(hazard => creatureName.includes(hazard))) {
            return "hazard";
        }

        // Check if potentially aggressive
        if (encounter.other?.includes("attack") || 
            (encounter.damage && encounter.damage !== "0" && encounter.damage !== "-")) {
            const aggressionRoll = new Roll("1d100");
            aggressionRoll.evaluate({ async: false });
            return aggressionRoll.total > 85 ? "threat" : "sighting";
        }

        return "sighting";
    }

    /**
     * Generate encounter description text
     */
    static generateEncounterText(encounterResult) {
        const enc = encounterResult.encounter;
        const classification = encounterResult.classification;
        const numberText = enc.number !== "-" ? ` (${enc.number})` : "";

        switch (classification) {
            case "sighting":
                return `spotted ${enc.name.toLowerCase()}${numberText}`;
            
            case "threat":
                return `hostile ${enc.name.toLowerCase()}${numberText} encountered`;
            
            case "hazard":
                return `${enc.name.toLowerCase()} encountered`;
            
            case "interactive":
                if (enc.name.toLowerCase().includes("man") || enc.name.toLowerCase().includes("ship")) {
                    return `encountered ${enc.name.toLowerCase()}`;
                } else if (enc.name.toLowerCase().includes("island")) {
                    return `sighted ${enc.name.toLowerCase()}`;
                }
                return `${enc.name.toLowerCase()} observed`;
            
            default:
                return `encountered ${enc.name.toLowerCase()}${numberText}`;
        }
    }

    /**
     * Calculate encounter damage (for threats/hazards)
     */
    static async calculateEncounterDamage(encounter, classification) {
        if (classification === "sighting" || classification === "interactive") {
            return 0;
        }

        // Check for special effects
        if (encounter.other) {
            const effectKey = Object.keys(EncounterRegistry.effects).find(key => 
                encounter.other.includes(key)
            );
            
            if (effectKey) {
                const effect = EncounterRegistry.getEffect(effectKey);
                if (effect?.damage) {
                    const damageRoll = new Roll(effect.damage);
                    await damageRoll.evaluate();
                    return damageRoll.total;
                }
            }
        }

        // Generic combat damage for threats
        if (classification === "threat") {
            const combatRoll = new Roll("1d6");
            await combatRoll.evaluate();
            return combatRoll.total;
        }

        return 0;
    }
}