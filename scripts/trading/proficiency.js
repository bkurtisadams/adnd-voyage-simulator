/**
 * Proficiency System
 * Handles skill calculations and checks
 */

export class ProficiencySystem {
    
    /**
     * Map skills to their governing abilities
     */
    static getAbilityForSkill(skillKey) {
        const abilityMap = {
            bargaining: "chaScore",
            appraisal: "wisScore",
            trade: "wisScore",
            smuggling: "wisScore",
            customsInspection: "wisScore",
            seamanship: "dexScore",
            shipCarpentry: "intScore",
            navigation: "intScore",
            piloting: "wisScore",
            seaLore: "intScore",
            shipRowing: "strScore",
            shipSailing: "intScore",
            shipwright: "intScore",
            signaling: "intScore",
            vesselIdentification: "intScore"
        };
        return abilityMap[skillKey] || null;
    }

    /**
     * Calculate proficiency score (target number for d20 roll)
     */
    static calculateProficiencyScore(abilityScore, skillKey) {
        if (!abilityScore) return null;

        const modifiers = {
            bargaining: -2,
            appraisal: -2,
            trade: -1,
            smuggling: -4,
            customsInspection: -2,
            seamanship: +1,
            shipCarpentry: 0,
            navigation: -3,
            piloting: +1,
            seaLore: -2,
            shipRowing: +1,
            shipSailing: +1,
            shipwright: -2,
            signaling: 0,
            vesselIdentification: 0
        };

        const modifier = modifiers[skillKey] ?? 0;
        return abilityScore + modifier;
    }

    /**
     * Get crew quality modifier
     */
    static getCrewQualityModifier(quality) {
        const modifiers = {
            "Landlubber": -2,
            "Green": -2,
            "Average": -1,
            "Trained": 0,
            "Crack": +1,
            "Old Salts": +2
        };
        return modifiers[quality] || 0;
    }

    /**
     * Create proficiency scores object for a character
     */
    static createProficiencyScores(character) {
        const scores = {};
        
        for (const [skillKey, hasSkill] of Object.entries(character.skills)) {
            if (hasSkill) {
                const abilityKey = this.getAbilityForSkill(skillKey);
                if (abilityKey && character[abilityKey] !== undefined) {
                    scores[skillKey] = this.calculateProficiencyScore(
                        character[abilityKey],
                        skillKey
                    );
                } else {
                    scores[skillKey] = null;
                }
            } else {
                scores[skillKey] = null;
            }
        }
        
        return scores;
    }

    /**
     * Make a proficiency check
     * @returns {Object} {success, roll, needed, modifier, note}
     */
    static async makeProficiencyCheck(skillKey, proficiencyScores, lieutenantSkills, crewQualityMod, modifier = 0) {
        const captainScore = proficiencyScores[skillKey];

        // Special case: unskilled piloting (use base WIS-4)
        if (captainScore === null && skillKey === "piloting") {
            const baseWisdom = 10; // Would need to be passed in or stored
            const unskilledScore = baseWisdom - 4;
            
            const roll = new Roll(`1d20 + ${modifier + crewQualityMod}`);
            await roll.evaluate();
            
            return {
                success: roll.total <= unskilledScore,
                roll: roll.total,
                needed: unskilledScore,
                modifier: modifier + crewQualityMod,
                note: "Unskilled piloting attempt"
            };
        }

        if (captainScore === null) {
            return {
                success: false,
                roll: null,
                needed: null,
                modifier: modifier + crewQualityMod,
                note: "Captain lacks proficiency"
            };
        }

        let effectiveModifier = modifier + crewQualityMod;

        // Lieutenant assistance (if they have the skill)
        if (lieutenantSkills[skillKey] && skillKey !== "smuggling" && skillKey !== "piloting") {
            effectiveModifier += 1;
        }

        // Special smuggling bonus if Customs Inspection present
        if (skillKey === "smuggling" && 
            (proficiencyScores.customsInspection !== null || lieutenantSkills.customsInspection)) {
            effectiveModifier += 1;
        }

        const roll = new Roll(`1d20 + ${effectiveModifier}`);
        await roll.evaluate();

        return {
            success: roll.total <= captainScore,
            roll: roll.total,
            needed: captainScore,
            modifier: effectiveModifier
        };
    }
}