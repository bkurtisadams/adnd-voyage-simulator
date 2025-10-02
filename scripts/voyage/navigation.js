/**
 * Navigation and Hazard System
 * Handles piloting checks and weather hazards
 */

import { ProficiencySystem } from '../trading/proficiency.js';

export class NavigationSystem {

    /**
     * Assess weather hazards and determine piloting requirements
     */
    static assessWeatherHazard(weather) {
        const windSpeed = weather.wind.speed;
        const precipType = weather.precipitation.type;
        const sky = weather.sky;

        let hazardType = null;
        let pilotingModifier = 0;
        let hazardDescription = "";

        // Major weather hazards
        if (["hurricane", "gale", "tropical-storm", "thunderstorm"].includes(precipType) || windSpeed >= 30) {
            if (precipType === "hurricane" || windSpeed >= 75) {
                hazardType = "Critical";
                pilotingModifier = 10;
                hazardDescription = "Hurricane/Severe Storm";
            } else if (precipType === "gale" || windSpeed >= 50) {
                hazardType = "Major";
                pilotingModifier = 5;
                hazardDescription = "Gale Force Winds";
            } else if (precipType === "tropical-storm" || precipType === "thunderstorm" || windSpeed >= 30) {
                hazardType = "Minor";
                pilotingModifier = 2;
                hazardDescription = "Thunderstorm/Strong Winds";
            }
        }

        // Visibility hazards
        if (sky && sky.toLowerCase().includes("fog")) {
            const fogMod = sky.toLowerCase().includes("heavy") ? 6 : 3;
            
            if (!hazardType) {
                hazardType = "Minor";
                pilotingModifier = fogMod;
                hazardDescription = sky.toLowerCase().includes("heavy") ? "Heavy Fog" : "Fog";
            } else {
                pilotingModifier += fogMod;
                hazardDescription += " + Fog";
            }
        } else if (sky && sky.toLowerCase().includes("mist")) {
            if (!hazardType) {
                hazardType = "Minor";
                pilotingModifier = 3;
                hazardDescription = "Mist";
            }
        }

        return {
            hazardType: hazardType,
            pilotingModifier: pilotingModifier,
            description: hazardDescription
        };
    }

    /**
     * Execute piloting check
     */
    static async makePilotingCheck(proficiencyScores, lieutenantSkills, crewQualityMod, hazardModifier) {
        return await ProficiencySystem.makeProficiencyCheck(
            "piloting",
            proficiencyScores,
            lieutenantSkills,
            crewQualityMod,
            hazardModifier
        );
    }

    /**
     * Calculate damage from failed piloting check
     */
    static async calculateHazardDamage(hazardType, missedBy) {
        let damage = 0;
        let damageRoll;

        if (hazardType === "Minor") {
            if (missedBy >= 1 && missedBy <= 4) {
                damage = 1;
            } else if (missedBy >= 5 && missedBy <= 7) {
                damageRoll = new Roll("1d3 + 1");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            } else if (missedBy >= 8) {
                damageRoll = new Roll("1d4 + 2");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            }
        } else if (hazardType === "Major") {
            if (missedBy >= 1 && missedBy <= 2) {
                damage = 1;
            } else if (missedBy >= 3 && missedBy <= 4) {
                damageRoll = new Roll("1d3 + 1");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            } else if (missedBy >= 5) {
                damageRoll = new Roll("1d5 + 3");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            }
        } else if (hazardType === "Critical") {
            if (missedBy >= 1 && missedBy <= 2) {
                damageRoll = new Roll("1d3 + 1");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            } else if (missedBy >= 3 && missedBy <= 4) {
                damageRoll = new Roll("1d4 + 2");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            } else if (missedBy >= 5 && missedBy <= 7) {
                damageRoll = new Roll("1d5 + 3");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            } else if (missedBy >= 8) {
                damageRoll = new Roll("1d6 + 4");
                await damageRoll.evaluate();
                damage = damageRoll.total;
            }
        }

        return damage;
    }

    /**
     * Calculate hull damage penalties
     */
    static calculateHullDamagePenalty(currentHullDamage, maxHull) {
        const damagePercent = (currentHullDamage / maxHull) * 100;
        const speedPenaltyPercent = Math.floor(damagePercent / 10) * 10;
        const isDeadInWater = damagePercent >= 75;

        return {
            speedPenaltyPercent: speedPenaltyPercent,
            isDeadInWater: isDeadInWater,
            damagePercent: Math.round(damagePercent)
        };
    }

    /**
     * Handle rowing as backup propulsion
     */
    static handleRowing(enableRowing, oarsmenCount, consecutiveRowingDays, baseRowingSpeed) {
        if (!enableRowing || oarsmenCount === 0) {
            return {
                canRow: false,
                rowingSpeed: 0,
                fatigued: false
            };
        }

        const rowingFatigueThreshold = 3;
        let speed = baseRowingSpeed;
        let fatigued = false;

        if (consecutiveRowingDays > rowingFatigueThreshold) {
            speed = Math.floor(speed / 2);
            fatigued = true;
        }

        return {
            canRow: true,
            rowingSpeed: speed,
            fatigued: fatigued
        };
    }
}