/**
 * Voyage Simulation Core
 * Main simulation engine for maritime trading voyages
 */

import { ShipRegistry } from '../data/ships.js';
import { PortRegistry } from '../data/ports.js';
import { RouteRegistry } from '../data/routes.js';
import { CargoRegistry } from '../data/cargo.js';
import { ProficiencySystem } from '../trading/proficiency.js';
import { CargoPurchasing } from '../trading/cargo-buy.js';
import { CargoSelling } from '../trading/cargo-sell.js';
import { CargoPerishability } from '../trading/perishability.js';
import { CargoOperations } from '../trading/cargo-operations.js';
import { ReportGenerator } from '../journal/report-generator.js';

export class VoyageSimulator {
    
    constructor() {
        this.activeVoyages = new Map();
        this.MILES_PER_INCH_DAILY = 8;
    }

    /**
     * Start a new voyage simulation
     */
    async startVoyage(voyageConfig) {
        const {
            shipId,
            routeId,
            captain,
            lieutenant,
            startingGold,
            tradeMode,
            commissionRate,
            latitude,
            longitude,
            autoRepair,
            enableRowing,
            automateTrading,
            startingYear,
            startingMonth,
            startingDay,
            crewQuality
        } = voyageConfig;

        // Initialize voyage state FIRST
        const voyageState = this.initializeVoyageState(voyageConfig);
        
        // Validate configuration
        const validation = this.validateVoyageConfig(voyageConfig);
        if (!validation.valid) {
            ui.notifications.error(validation.message);
            return null;
        }

        // Setup weather system AFTER state is created
        if (globalThis.dndWeather?.weatherSystem) {
            const system = globalThis.dndWeather.weatherSystem;
            
            system.settings.latitude = latitude;
            system.settings.longitude = longitude;
            system.settings.terrain = "coast-warm";
            system.settings.elevation = 0;
            system.settings.locationName = PortRegistry.get(voyageState.route.ports[0])?.name || "At Sea";

            // Initialize calendar
            if (system.calendarTracker && startingYear && startingMonth && startingDay) {
                system.calendarTracker.setDate({
                    year: startingYear,
                    month: startingMonth,
                    day: startingDay,
                    hour: 6,
                    minute: 0
                });
                
                console.log("Set voyage start date:", system.calendarTracker.getDateString());
            }
        }

        // Store active voyage
        const voyageId = foundry.utils.randomID();
        this.activeVoyages.set(voyageId, voyageState);

        // Begin simulation
        await this.runSimulation(voyageId);
        
        return voyageId;
    }

    /**
     * Initialize voyage state object
     */
    initializeVoyageState(config) {
        const ship = ShipRegistry.createInstance(config.shipId);
        const route = RouteRegistry.get(config.routeId);
        
        // Calculate proficiency scores
        const captainProficiencyScores = ProficiencySystem.createProficiencyScores(config.captain);
        const lieutenantSkills = config.lieutenant.skills;
        const crewQualityMod = ProficiencySystem.getCrewQualityModifier(config.crewQuality);

        return {
            // Ship & Route
            ship: ship,
            route: route,
            
            // Characters
            captain: config.captain,
            lieutenant: config.lieutenant,
            captainProficiencyScores: captainProficiencyScores,
            lieutenantSkills: lieutenantSkills,
            
            // Settings
            tradeMode: config.tradeMode,
            commissionRate: config.commissionRate,
            autoRepair: config.autoRepair,
            enableRowing: config.enableRowing,
            automateTrading: config.automateTrading,
            crewQuality: config.crewQuality,
            crewQualityMod: crewQualityMod,
            
            // Financial tracking
            treasury: config.startingGold,
            startingCapital: config.startingGold,
            crewEarningsFromTrade: 0,
            revenueTotal: 0,
            expenseTotal: 0,
            
            // Cargo state
            currentCargo: {
                type: null,
                loads: 0,
                purchasePrice: 0
            },
            
            // Voyage tracking
            totalDays: 0,
            totalDistance: 0,
            totalHullDamage: ship.hullPoints.max - ship.hullPoints.value,
            consecutiveRowingDays: 0,
            
            // Logs
            voyageLogHtml: { value: "" },
            weatherLogHtml: { value: "" },
            portsVisited: [],
            portActivities: [],
            repairLog: [],
            passengerManifest: [],
            
            // Maintenance
            shipMaintenanceStatus: {
                lastMaintenance: 0,
                maintenanceOverdue: 0,
                shipQuality: "Average",
                speedPenalty: 0,
                temporaryRepairs: []
            },
            
            // Dates
            shipStartDate: null,
            shipEndDate: null
        };
    }

    /**
     * Validate voyage configuration
     */
    validateVoyageConfig(config) {
        if (!ShipRegistry.get(config.shipId)) {
            return { valid: false, message: "Invalid ship ID" };
        }
        
        if (!RouteRegistry.get(config.routeId)) {
            return { valid: false, message: "Invalid route ID" };
        }
        
        if (config.startingGold < 0) {
            return { valid: false, message: "Starting gold must be >= 0" };
        }
        
        if (config.tradeMode === "consignment" && 
            (config.commissionRate < 10 || config.commissionRate > 40)) {
            return { valid: false, message: "Commission rate must be 10-40%" };
        }
        
        if (!config.captain.name) {
            return { valid: false, message: "Captain must have a name" };
        }
        
        return { valid: true };
    }

    /**
     * Main simulation loop
     */
    async runSimulation(voyageId) {
        const state = this.activeVoyages.get(voyageId);
        if (!state) return;

        // Build route legs
        const legs = this.buildRouteLegs(state.route);
        
        // Calculate total distance
        state.totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
        
        // Process origin port
        await this.processOriginPort(state, legs);
        
        // Sail each leg
        for (let i = 0; i < legs.length; i++) {
            const legComplete = await this.sailLeg(state, legs[i], i, legs);
            
            if (!legComplete) {
                // Ship sank or voyage aborted
                await this.handleVoyageFailure(state);
                return;
            }
            
            // Process arrival at destination port
            if (i < legs.length - 1 || this.isCircuitRoute(state.route)) {
                await this.processPort(state, legs[i].toID, i, legs);
            }
            
            // Check if ship is still seaworthy
            if (state.ship.hullPoints.value <= 0) {
                await this.handleVoyageFailure(state);
                return;
            }
        }
        
        // Voyage complete - finalize
        await this.finalizeVoyage(state);
    }

    /**
     * Build leg objects from route
     */
    buildRouteLegs(route) {
        const legs = [];
        const ports = route.ports;
        
        for (let i = 0; i < ports.length - 1; i++) {
            const distance = PortRegistry.getDistance(ports[i], ports[i + 1]);
            if (!distance) {
                console.error(`Missing distance for ${ports[i]} → ${ports[i + 1]}`);
                continue;
            }
            legs.push({
                fromID: ports[i],
                toID: ports[i + 1],
                distance: distance
            });
        }
        
        // Add return leg if circuit
        if (route.name.toLowerCase().includes("circuit") && legs.length > 0) {
            const lastPort = ports[ports.length - 1];
            const firstPort = ports[0];
            const returnDist = PortRegistry.getDistance(lastPort, firstPort);
            if (returnDist) {
                legs.push({ fromID: lastPort, toID: firstPort, distance: returnDist });
            }
        }
        
        return legs;
    }

    /**
     * Check if route is a circuit
     */
    isCircuitRoute(route) {
        return route.name.toLowerCase().includes("circuit");
    }

    /**
     * Process activities at origin port
     */
    async processOriginPort(state, legs) {
        const originID = state.route.ports[0];
        const originPort = PortRegistry.get(originID);
        const originName = originPort.name;
        
        // Capture start date
        state.shipStartDate = this.getCurrentDate();
        
        state.portsVisited.push(originName);
        state.voyageLogHtml.value += `<h2>Voyage Commenced: ${originName}</h2>`;
        
        // Create port activity record
        const portActivity = {
            portName: originName,
            portType: "origin",
            date: this.getCurrentDate(),
            fees: {},
            activities: [],
            totalCost: 0
        };
        
        // Calculate port fees
        const portFees = await this.calculatePortFees(state, originPort, 3); // 3 days at origin
        portActivity.fees = portFees;
        portActivity.totalCost = portFees.total;
        state.treasury -= portFees.total;
        state.expenseTotal += portFees.total;
        
        state.voyageLogHtml.value += `<p><strong>Port Fees:</strong> ${portFees.total} gp (Entrance: ${portFees.entrance} gp, Moorage: ${portFees.moorage.cost} gp, Pilot: ${portFees.pilot} gp)</p>`;
        
        state.portActivities.push(portActivity);
        
        // Handle initial cargo loading
        if (state.tradeMode === "consignment") {
            await this.loadConsignmentCargo(state, portActivity);
        } else {
            await this.attemptCargoPurchase(state, originID, portActivity);
        }
    }

    async calculatePortFees(state, port, daysInPort) {
        // Port entrance fee: d10 + 10
        const entranceRoll = new Roll("1d10 + 10");
        await entranceRoll.evaluate();
        const entrance = entranceRoll.total;
        
        // Pilot/towage: 1 gp per hull point (required at origin and each destination)
        const pilot = state.ship.hullPoints.max;
        
        // Moorage: 80% chance of berth, otherwise anchor
        const berthRoll = new Roll("1d100");
        await berthRoll.evaluate();
        const hasBerth = berthRoll.total <= 80;
        
        let moorageCost, moorageType;
        if (hasBerth) {
            moorageCost = state.ship.hullPoints.max * daysInPort; // 1 gp/hull point/day
            moorageType = "berth";
        } else {
            moorageCost = 5 * daysInPort; // 5 gp/day at anchor
            moorageType = "anchor";
        }
        
        return {
            entrance: entrance,
            pilot: pilot,
            moorage: {
                cost: moorageCost,
                type: moorageType,
                days: daysInPort
            },
            total: entrance + pilot + moorageCost
        };
    }

    /**
     * Sail a single leg
     */
    async sailLeg(state, leg, legIndex, allLegs) {
        const fromName = PortRegistry.get(leg.fromID).name;
        const toName = PortRegistry.get(leg.toID).name;
        
        state.voyageLogHtml.value += `
            <h4>Leg ${legIndex + 1}: ${fromName} → ${toName}</h4>
            <p><strong>Distance:</strong> ${leg.distance} miles</p>
        `;
        
        let remainingDistance = leg.distance;
        let sailingDays = 0;
        
        // Day-by-day sailing simulation
        while (remainingDistance > 0 || sailingDays === 0) {
            const dayResult = await this.simulateSailingDay(state, toName, remainingDistance);
            
            if (dayResult.shipSank) {
                return false;
            }
            
            remainingDistance -= dayResult.distanceCovered;
            sailingDays++;
            state.totalDays++;
            
            this.advanceDay();
        }
        
        return true;
    }

    /**
     * Simulate a single day of sailing
     */
    async simulateSailingDay(state, destinationName, remainingDistance) {
        const dateStr = this.getCurrentDate();
        
        // Generate weather for the day using the global weather system
        let weather = null;
        let parsedWeather = null;
        
        if (globalThis.dndWeather?.weatherSystem) {
            const weatherArr = await globalThis.dndWeather.weatherSystem.generateWeather();
            weather = weatherArr[0];
            globalThis.dndWeather.weatherSystem.setCurrentWeather(weather);
            
            // Parse weather data from your weather module format
            const temp = weather.baseConditions?.temperature;
            const wind = weather.baseConditions?.wind;
            const precip = weather.baseConditions?.precipitation;
            
            parsedWeather = {
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
                sky: weather.baseConditions?.sky || "clear",
                raw: weather
            };
        } else {
            // Fallback weather if module not available
            console.warn("Weather module not available, using fallback");
            const windRoll = new Roll("2d10 + 5");
            await windRoll.evaluate();
            
            parsedWeather = {
                temperature: { high: 70, low: 55 },
                wind: { speed: windRoll.total, direction: "Variable" },
                precipitation: { type: "none", duration: 0 },
                sky: "partly cloudy",
                raw: null
            };
        }
        
        // Calculate sailing speed based on weather
        const baseSpeed = state.ship.movement * this.MILES_PER_INCH_DAILY;
        const speedInfo = this.calculateSailingSpeed(baseSpeed, parsedWeather);
        
        let distanceCovered = 0;
        let damage = 0;
        let shipSank = false;
        
        // Check if becalmed
        if (speedInfo.becalmed) {
            state.voyageLogHtml.value += `<p><strong>${dateStr}:</strong> Becalmed! No progress made. ${speedInfo.note}</p>`;
            
            // Try rowing if enabled
            if (state.enableRowing) {
                const { NavigationSystem } = await import('./navigation.js');
                const rowingInfo = NavigationSystem.handleRowing(
                    state.enableRowing,
                    state.ship.crew.find(c => c.role === "oarsmen")?.count || 0,
                    state.consecutiveRowingDays,
                    8 // base rowing speed in miles/day
                );
                
                if (rowingInfo.canRow) {
                    distanceCovered = Math.min(rowingInfo.rowingSpeed, remainingDistance);
                    state.consecutiveRowingDays++;
                    state.voyageLogHtml.value += `<p>Crew rows: ${distanceCovered} miles. ${rowingInfo.fatigued ? '(Crew fatigued)' : ''}</p>`;
                }
            }
        } else {
            // Normal sailing
            state.consecutiveRowingDays = 0;
            distanceCovered = Math.min(speedInfo.speed, remainingDistance);
            
            // Check for weather hazards
            const { NavigationSystem } = await import('./navigation.js');
            const hazard = NavigationSystem.assessWeatherHazard(parsedWeather);
            
            if (hazard.hazardType) {
                // Require piloting check
                const pilotCheck = await NavigationSystem.makePilotingCheck(
                    state.captainProficiencyScores,
                    state.lieutenantSkills,
                    state.crewQualityMod,
                    hazard.pilotingModifier
                );
                
                if (!pilotCheck.success) {
                    damage = await NavigationSystem.calculateHazardDamage(
                        hazard.hazardType,
                        pilotCheck.missedBy
                    );
                    
                    state.ship.hullPoints.value -= damage;
                    state.totalHullDamage += damage;
                    
                    state.voyageLogHtml.value += `<p><strong>⚠️ ${hazard.description}!</strong> Piloting check failed by ${pilotCheck.missedBy}. Hull damage: ${damage} HP. (${state.ship.hullPoints.value}/${state.ship.hullPoints.max} remaining)</p>`;
                    
                    if (state.ship.hullPoints.value <= 0) {
                        shipSank = true;
                    }
                }
            }
        }
        
        // Log weather
        const weatherLog = this.formatWeatherLog(dateStr, parsedWeather, speedInfo, destinationName);
        state.weatherLogHtml.value += weatherLog;
        
        // Check for encounters
        const { EncounterSystem } = await import('./encounters.js');
        const encounter = await EncounterSystem.rollForEncounter("dawn");
        
        if (encounter) {
            const encounterText = EncounterSystem.generateEncounterText(encounter);
            state.voyageLogHtml.value += `<p><strong>🎲 Encounter:</strong> ${encounterText}</p>`;
            
            // Calculate encounter damage if applicable
            const encounterDamage = await EncounterSystem.calculateEncounterDamage(
                encounter.encounter,
                encounter.classification
            );
            
            if (encounterDamage > 0) {
                state.ship.hullPoints.value -= encounterDamage;
                state.totalHullDamage += encounterDamage;
                damage += encounterDamage;
                
                state.voyageLogHtml.value += `<p>Encounter damage: ${encounterDamage} HP. (${state.ship.hullPoints.value}/${state.ship.hullPoints.max} remaining)</p>`;
                
                if (state.ship.hullPoints.value <= 0) {
                    shipSank = true;
                }
            }
        }
        
        return {
            distanceCovered: distanceCovered,
            shipSank: shipSank,
            damage: damage
        };
    }

    calculateSailingSpeed(baseSpeed, weather) {
        let currentSpeed = baseSpeed;
        let speedNote = "";
        const windSpeed = weather.wind.speed;

        // Wind effects
        if (windSpeed < 5) {
            currentSpeed = 0;
            speedNote = "Becalmed! Wind too light for sailing (< 5 mph).";
            return { speed: 0, note: speedNote, becalmed: true };
        } else if (windSpeed >= 5 && windSpeed < 20) {
            const penalty = Math.floor((20 - windSpeed) / 10) * 8;
            currentSpeed = Math.max(1, baseSpeed - penalty);
            speedNote = `Light winds (${windSpeed} mph). Speed reduced by ${penalty} mi/day.`;
        } else if (windSpeed >= 20 && windSpeed <= 30) {
            speedNote = `Good sailing winds (${windSpeed} mph).`;
        } else if (windSpeed > 30) {
            const bonus = Math.floor((windSpeed - 30) / 10) * 16;
            currentSpeed = baseSpeed + bonus;
            speedNote = `Strong winds (${windSpeed} mph). Speed increased by ${bonus} mi/day.`;
        }

        // Wet sails bonus
        if (["drizzle", "rainstorm-light", "rainstorm-heavy", "hailstorm"].includes(weather.precipitation.type)) {
            const wetBonus = Math.floor(Math.random() * 6) + 5;
            const bonusMiles = Math.floor(currentSpeed * (wetBonus / 100));
            currentSpeed += bonusMiles;
            speedNote += ` Wet sails: +${bonusMiles} mi.`;
        }

        return {
            speed: currentSpeed,
            note: speedNote,
            becalmed: false
        };
    }

    formatWeatherLog(dateStr, weather, speedInfo, destination) {
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
     * Process port arrival and activities
     */
    async processPort(state, portId, legIndex, allLegs) {
        const port = PortRegistry.get(portId);
        const portName = port.name;
        state.portsVisited.push(portName);
        
        // Determine days in port (2-4 days for intermediate, 3 days for final)
        const daysInPort = legIndex === allLegs.length - 1 ? 3 : Math.floor(Math.random() * 3) + 2;
        
        const portActivity = {
            portName: portName,
            portType: legIndex === allLegs.length - 1 ? "destination" : "intermediate",
            date: this.getCurrentDate(),
            fees: {},
            activities: [],
            totalCost: 0
        };
        
        // Calculate and deduct port fees
        const portFees = await this.calculatePortFees(state, port, daysInPort);
        portActivity.fees = portFees;
        portActivity.totalCost = portFees.total;
        state.treasury -= portFees.total;
        state.expenseTotal += portFees.total;
        
        state.voyageLogHtml.value += `<h3>Arrived at ${portName}</h3>`;
        state.voyageLogHtml.value += `<p><strong>Port Fees:</strong> ${portFees.total} gp</p>`;
        
        // Advance days for port stay
        for (let i = 0; i < daysInPort; i++) {
            this.advanceDay();
            
            // Generate weather while in port
            const { WeatherSystem } = await import('./weather.js');
            const weather = await WeatherSystem.generateDayWeather();
            const weatherLog = WeatherSystem.formatPortWeatherLog(this.getCurrentDate(), weather, portName);
            state.weatherLogHtml.value += weatherLog;
        }
        
        state.portActivities.push(portActivity);
        
        // Attempt cargo sale if carrying cargo
        if (state.currentCargo.loads > 0) {
            await this.attemptCargoSale(state, portId, portActivity, allLegs[legIndex - 1]?.distance || 0);
        }
        
        // Attempt cargo purchase if in speculation mode and hold empty
        if (state.tradeMode === "speculation" && state.currentCargo.loads === 0) {
            await this.attemptCargoPurchase(state, portId, portActivity);
        }
    }

    /**
     * Attempt to purchase cargo
     */
    async attemptCargoPurchase(state, portId, portActivity) {
        const result = await CargoPurchasing.handleCargoPurchase({
            portId: portId,
            shipTemplate: state.ship,
            currentTreasury: state.treasury,
            captainProficiencyScores: state.captainProficiencyScores,
            lieutenantSkills: state.lieutenantSkills,
            automateTrading: state.automateTrading,
            currentPortActivity: portActivity,
            voyageLogHtmlRef: state.voyageLogHtml,
            tradeMode: state.tradeMode,
            commissionRate: state.commissionRate,
            crewQualityMod: state.crewQualityMod
        });
        
        state.treasury = result.newTreasury;
        state.expenseTotal += result.totalPurchaseCost;
        
        if (result.loadsBought > 0) {
            state.currentCargo = {
                type: result.cargoType,
                loads: result.loadsBought,
                purchasePrice: result.purchasePricePerLoad
            };
        }
    }

    /**
     * Attempt to sell cargo
     */
    async attemptCargoSale(state, portId, portActivity, distanceTraveled) {
        // Check perishability first
        const perishResult = await CargoPerishability.applyPerishability(
            state.currentCargo.type,
            distanceTraveled,
            state.currentCargo.loads,
            state.voyageLogHtml,
            PortRegistry.get(portId).name
        );
        
        if (!perishResult.success || perishResult.loadsRemaining === 0) {
            state.currentCargo = { type: null, loads: 0, purchasePrice: 0 };
            return;
        }
        
        // Update cargo quantity after perishability
        state.currentCargo.loads = perishResult.loadsRemaining;
        
        // Attempt sale
        const result = await CargoSelling.handleCargoSale({
            portId: portId,
            currentTreasury: state.treasury,
            captainProficiencyScores: state.captainProficiencyScores,
            lieutenantSkills: state.lieutenantSkills,
            automateTrading: state.automateTrading,
            currentPortActivity: portActivity,
            voyageLogHtmlRef: state.voyageLogHtml,
            currentCargoType: state.currentCargo.type,
            currentLoads: state.currentCargo.loads,
            currentPurchaseCost: state.currentCargo.purchasePrice * state.currentCargo.loads,
            tradeMode: state.tradeMode,
            commissionRate: state.commissionRate,
            distanceTraveled: distanceTraveled,
            crewQualityMod: state.crewQualityMod,
            crewEarningsFromTrade: state.crewEarningsFromTrade
        });
        
        state.treasury = result.newTreasury;
        state.crewEarningsFromTrade = result.newCrewEarningsFromTrade;
        state.expenseTotal += result.taxAmount;
        
        // Clear cargo after sale
        state.currentCargo = { type: null, loads: 0, purchasePrice: 0 };
    }

    /**
     * Load consignment cargo at origin
     */
    async loadConsignmentCargo(state, portActivity) {
        state.currentCargo = {
            type: "consumer",
            loads: state.ship.cargoCapacity,
            purchasePrice: 0
        };
        
        const cargo = CargoRegistry.get("consumer");
        
        // Calculate transport fee for the route
        // Sum all leg distances to get total journey distance
        const totalRouteDistance = state.route.ports.reduce((total, port, index, ports) => {
            if (index === 0) return 0;
            const distance = PortRegistry.getDistance(ports[index - 1], port);
            return total + (distance || 0);
        }, 0);
        
        // Calculate transport fee: 40 gp per ton (2 loads) per 500 miles, min 100 gp
        const tons = state.currentCargo.loads / 2;
        const segments = Math.ceil(totalRouteDistance / 500);
        const totalTransportFee = Math.max(tons * 40 * segments, 100);
        
        // Charge half upfront
        const upfrontPayment = Math.floor(totalTransportFee / 2);
        state.treasury += upfrontPayment;
        state.revenueTotal += upfrontPayment;
        
        state.voyageLogHtml.value += `<p><strong>Consignment Load:</strong> ${cargo.name} (${state.currentCargo.loads} loads). Commission: ${state.commissionRate}%</p>`;
        state.voyageLogHtml.value += `<p><strong>Transport Fee (upfront payment):</strong> ${upfrontPayment} gp (${totalTransportFee} gp total for ${totalRouteDistance} miles, ${upfrontPayment} gp due on delivery)</p>`;
        
        portActivity.activities.push(`Loaded ${state.currentCargo.loads} loads of ${cargo.name} on consignment.`);
        portActivity.activities.push(`Received upfront transport payment: ${upfrontPayment} gp`);
    }

    /**
     * Get current date from weather system
     */
    getCurrentDate() {
        // Try to get from weather system's calendar tracker
        if (globalThis.dndWeather?.weatherSystem?.calendarTracker) {
            return globalThis.dndWeather.weatherSystem.calendarTracker.getDateString();
        }
        
        // Fallback to current weather timestamp
        if (globalThis.dndWeather?.weatherSystem?.currentWeather?.timestamp) {
            return globalThis.dndWeather.weatherSystem.currentWeather.timestamp;
        }
        
        console.warn("Weather system date not available");
        return "Unknown Date";
    }

    /**
     * Advance calendar by one day
     */
    advanceDay() {
        if (globalThis.dndWeather?.weatherSystem?.calendarTracker) {
            globalThis.dndWeather.weatherSystem.calendarTracker.advanceDay();
            console.log("Advanced day to:", globalThis.dndWeather.weatherSystem.calendarTracker.getDateString());
        }
    }

    /**
     * Handle voyage failure (ship sank)
     */
    async handleVoyageFailure(state) {
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ alias: "Voyage Simulator" }),
            content: `
                <h3>⚓ Voyage FAILED: ${state.ship.name} Sank</h3>
                <p><strong>Captain:</strong> ${state.captain.name}</p>
                <p><strong>Total Days:</strong> ${state.totalDays}</p>
                <p><strong>Distance Sailed:</strong> ${state.totalDistance} miles</p>
            `
        });
    }

    /**
     * Finalize voyage and generate reports
     */
    async finalizeVoyage(state) {
        // SET END DATE HERE
        state.shipEndDate = this.getCurrentDate();

        // Import ReportGenerator at the top of simulation.js if not already done
        const { ReportGenerator } = await import('../journal/report-generator.js');
        
        // Generate journal entry
        await ReportGenerator.createVoyageJournal(state);
        
        // Create summary chat message
        const ownerNetProfit = state.treasury - state.startingCapital;
        const profitDistribution = ReportGenerator.calculateProfitDistribution({
            ownerNetProfit,
            crewEarningsFromTrade: state.crewEarningsFromTrade,
            ship: state.ship
        });
        
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ alias: "Voyage Simulator" }),
            content: `
                <div class="adnd-voyage-complete">
                    <h3>⚓ Voyage Complete: ${state.ship.name}</h3>
                    <p><strong>Captain:</strong> ${state.captain.name}</p>
                    <p><strong>Route:</strong> ${state.route.name}</p>
                    <p><strong>Duration:</strong> ${state.totalDays} days</p>
                    <p><strong>Distance:</strong> ${state.totalDistance} miles</p>
                    <hr/>
                    <p><strong>Starting Capital:</strong> ${state.startingCapital} gp</p>
                    <p><strong>Final Treasury:</strong> ${state.treasury} gp</p>
                    <p><strong>Net Result:</strong> ${ownerNetProfit >= 0 ? 'Profit' : 'Loss'} of ${Math.abs(ownerNetProfit)} gp</p>
                    <p><strong>Crew Payout:</strong> ${profitDistribution.totalCrewPayout} gp</p>
                </div>
            `,
            flags: {
                'adnd-voyage-simulator': {
                    voyageComplete: true
                }
            }
        });
        
        // Clean up active voyage
        this.activeVoyages.delete(state.voyageId);
        
        ui.notifications.info(`Voyage complete! Journal entry created.`);
    }
}