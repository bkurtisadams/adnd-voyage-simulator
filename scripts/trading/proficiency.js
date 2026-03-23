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
            vesselIdentification: "intScore",
            boating: "wisScore",
            artillerist: "intScore"
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
            vesselIdentification: 0,
            boating: +1,
            artillerist: -2
        };

        const modifier = modifiers[skillKey] ?? 0;
        return abilityScore + modifier;
    }

    /**
     * Get Charisma Reaction Adjustment for merchant availability
     * Based on 1e PHB Charisma Table
     */
    static getReactionAdjustment(chaScore) {
        if (chaScore <= 5) return -2;
        if (chaScore <= 8) return -1;
        if (chaScore <= 13) return 0;
        if (chaScore <= 15) return 1;
        if (chaScore <= 17) return 2;
        return 3; // 18+
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
            const effectiveTarget = unskilledScore + crewQualityMod - modifier;
            
            const roll = new Roll("1d20");
            await roll.evaluate();
            
            const success = roll.total <= effectiveTarget;
            return {
                success,
                roll: roll.total,
                needed: effectiveTarget,
                modifier: crewQualityMod - modifier,
                note: "Unskilled piloting attempt",
                missedBy: success ? 0 : roll.total - effectiveTarget
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

        // AD&D proficiency: roll d20 <= (score + modifiers)
        // Positive modifiers (crew quality, lt assist) make target higher = easier
        // Negative modifiers (hazards, weather) make target lower = harder
        let targetModifier = crewQualityMod - modifier; // hazard/weather modifier is penalty (subtracted)

        // Lieutenant assistance (if they have the skill)
        if (lieutenantSkills[skillKey] && skillKey !== "smuggling" && skillKey !== "piloting") {
            targetModifier += 1;
        }

        // Special smuggling bonus if Customs Inspection present
        if (skillKey === "smuggling" && 
            (proficiencyScores.customsInspection !== null || lieutenantSkills.customsInspection)) {
            targetModifier += 1;
        }

        const roll = new Roll("1d20");
        await roll.evaluate();

        const effectiveTarget = captainScore + targetModifier;
        const success = roll.total <= effectiveTarget;
        return {
            success,
            roll: roll.total,
            needed: effectiveTarget,
            modifier: targetModifier,
            missedBy: success ? 0 : roll.total - effectiveTarget
        };
    }

    /**
     * Make a proficiency check using the best available officer
     * Searches all officers for the highest score in the given skill
     */
    static async makeBestOfficerCheck(skillKey, allOfficers, crewQualityMod, modifier = 0) {
        let bestScore = null;
        let bestOfficer = null;
        let consortCount = 0;

        for (const officer of allOfficers) {
            const score = officer.proficiencyScores?.[skillKey];
            if (score !== null && score !== undefined) {
                if (bestScore === null || score > bestScore) {
                    bestScore = score;
                    bestOfficer = officer;
                }
                consortCount++;
            }
        }

        if (bestScore === null) {
            if (skillKey === "piloting") {
                const unskilledScore = 10 - 4;
                const effectiveTarget = unskilledScore + crewQualityMod - modifier;
                const roll = new Roll("1d20");
                await roll.evaluate();
                const success = roll.total <= effectiveTarget;
                return {
                    success, roll: roll.total, needed: effectiveTarget,
                    modifier: crewQualityMod - modifier,
                    officer: "Unskilled", note: "No officer has Piloting",
                    missedBy: success ? 0 : roll.total - effectiveTarget
                };
            }
            return { success: false, roll: null, needed: null, officer: null, note: "No officer has proficiency" };
        }

        let targetMod = crewQualityMod - modifier;
        // Two or more navigators/pilots in consort: +3 to target (rules: -3 to roll)
        if ((skillKey === "navigation" || skillKey === "piloting") && consortCount >= 2) {
            targetMod += 3;
        } else if (consortCount >= 2 && skillKey !== "smuggling") {
            targetMod += 1; // general lt assist
        }

        // Smuggling + customs inspection synergy
        if (skillKey === "smuggling") {
            for (const officer of allOfficers) {
                if (officer.proficiencyScores?.customsInspection !== null && officer.proficiencyScores?.customsInspection !== undefined) {
                    targetMod += 1;
                    break;
                }
            }
        }

        const roll = new Roll("1d20");
        await roll.evaluate();
        const effectiveTarget = bestScore + targetMod;
        const success = roll.total <= effectiveTarget;

        return {
            success, roll: roll.total, needed: effectiveTarget,
            modifier: targetMod,
            officer: bestOfficer.name || "Officer",
            missedBy: success ? 0 : roll.total - effectiveTarget
        };
    }
}