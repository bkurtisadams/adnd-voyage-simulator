/**
 * Weather Integration System
 * Handles weather generation and effects on sailing
 */

export class WeatherSystem {

    /**
     * Generate weather for a sailing day
     */
    static async generateDayWeather() {
        if (!globalThis.dndWeather?.weatherSystem) {
            console.warn("ADnD Weather module not found - using fallback weather");
            return this.getFallbackWeather();
        }

        const weatherArr = await globalThis.dndWeather.weatherSystem.generateWeather();
        const weatherObj = weatherArr[0];
        globalThis.dndWeather.weatherSystem.currentWeather = weatherObj;

        return this.parseWeatherObject(weatherObj);
    }

    /**
     * Parse weather object into usable data
     */
    static parseWeatherObject(weatherObj) {
        const temp = weatherObj.baseConditions?.temperature;
        const wind = weatherObj.baseConditions?.wind;
        const precip = weatherObj.baseConditions?.precipitation;
        const sky = weatherObj.baseConditions?.sky;

        return {
            temperature: {
                high: temp?.high || 70,
                low: temp?.low || 50
            },
            wind: {
                speed: wind?.speed || 10,
                direction: wind?.direction || "N"
            },
            precipitation: {
                type: precip?.type || "none",
                duration: precip?.duration || 0
            },
            sky: sky || "clear",
            raw: weatherObj
        };
    }

    /**
     * Fallback weather when DnD Weather unavailable
     */
    static getFallbackWeather() {
        const windRoll = new Roll("2d10 + 5");
        windRoll.evaluate({ async: false });

        return {
            temperature: { high: 70, low: 55 },
            wind: { speed: windRoll.total, direction: "Variable" },
            precipitation: { type: "none", duration: 0 },
            sky: "partly cloudy",
            raw: null
        };
    }

    /**
     * Calculate sailing speed based on weather
     */
    static calculateSailingSpeed(baseSpeed, weather) {
        let currentSpeed = baseSpeed;
        let speedNote = "";
        const windSpeed = weather.wind.speed;

        // Wind effects
        if (windSpeed < 5) {
            currentSpeed = 0;
            speedNote = "Becalmed! Wind too light for sailing (< 5 mph).";
        } else if (windSpeed >= 5 && windSpeed < 20) {
            const penalty = Math.floor((20 - windSpeed) / 10) * 8; // 8 mi/day per 10 mph deficit
            currentSpeed = Math.max(1, baseSpeed - penalty);
            speedNote = `Light winds (${windSpeed} mph). Speed reduced by ${penalty} mi/day.`;
        } else if (windSpeed >= 20 && windSpeed <= 30) {
            speedNote = `Good sailing winds (${windSpeed} mph).`;
        } else if (windSpeed > 30) {
            const bonus = Math.floor((windSpeed - 30) / 10) * 16; // 16 mi/day per 10 mph over 30
            currentSpeed = baseSpeed + bonus;
            speedNote = `Strong winds (${windSpeed} mph). Speed increased by ${bonus} mi/day.`;
        }

        // Wet sails bonus
        if (["drizzle", "rainstorm-light", "rainstorm-heavy", "hailstorm"].includes(weather.precipitation.type)) {
            const wetBonus = Math.floor(Math.random() * 6) + 5; // 5-10%
            const bonusMiles = Math.floor(currentSpeed * (wetBonus / 100));
            currentSpeed += bonusMiles;
            speedNote += ` Wet sails bonus: +${bonusMiles} mi/day (${wetBonus}%).`;
        }

        return {
            speed: currentSpeed,
            note: speedNote,
            becalmed: windSpeed < 5
        };
    }

    /**
     * Calculate long voyage penalty
     */
    static async calculateLongVoyagePenalty(currentSpeed) {
        const penaltyRoll = new Roll("1d4");
        await penaltyRoll.evaluate();
        
        const penaltyPercent = penaltyRoll.total * 5;
        const reducedSpeed = Math.floor(currentSpeed * (100 - penaltyPercent) / 100);
        
        return {
            penalty: penaltyPercent,
            reducedSpeed: reducedSpeed,
            originalSpeed: currentSpeed
        };
    }

    /**
     * Format weather log entry
     */
    static formatWeatherLog(dateStr, weather, speedInfo, destination) {
        const temp = weather.temperature;
        const wind = weather.wind;
        const precip = weather.precipitation;

        return `<p><strong>${dateStr} (sailing to ${destination}):</strong> ` +
               `High ${temp.high}°F, Low ${temp.low}°F | ${weather.sky} | ` +
               `Wind ${wind.speed} mph ${wind.direction} | ` +
               `${precip.type !== "none" ? `${precip.type} (${precip.duration}h)` : "No precipitation"}. ` +
               `${speedInfo.note}</p>`;
    }

    /**
     * Format in-port weather log
     */
    static formatPortWeatherLog(dateStr, weather, portName) {
        const temp = weather.temperature;
        const wind = weather.wind;
        const precip = weather.precipitation;

        return `<p><strong>${dateStr} (In Port at ${portName}):</strong> ` +
               `High ${temp.high}°F, Low ${temp.low}°F | ${weather.sky} | ` +
               `Wind ${wind.speed} mph ${wind.direction} | ` +
               `${precip.type !== "none" ? `${precip.type} (${precip.duration}h)` : "No precipitation"}.</p>`;
    }
}