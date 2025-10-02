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

        // Initialize voyage state
        const voyageState = this.initializeVoyageState(voyageConfig);
        
        // Validate configuration
        const validation = this.validateVoyageConfig(voyageConfig);
        if (!validation.valid) {
            ui.notifications.error(validation.message);
            return null;
        }

        // Setup weather system
        if (game.dndWeather?.weatherSystem) {
            game.dndWeather.weatherSystem.settings.latitude = latitude;
            game.dndWeather.weatherSystem.settings.longitude = longitude;
            game.dndWeather.weatherSystem.settings.terrain = "coast-warm";
            game.dndWeather.weatherSystem.settings.elevation = 0;

            if (startingYear && startingMonth && startingDay) {
                game.dndWeather.weatherSystem.calendarTracker.setDate({
                    year: startingYear,
                    month: startingMonth,
                    day: startingDay,
                    hour: 6,
                    minute: 0,
                    second: 0
                });
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
        const originName = PortRegistry.get(originID).name;
        
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
        state.portActivities.push(portActivity);
        
        // Handle initial cargo loading
        if (state.tradeMode === "consignment") {
            await this.loadConsignmentCargo(state, portActivity);
        } else {
            await this.attemptCargoPurchase(state, originID, portActivity);
        }
        
        // TODO: Passenger booking, repairs, etc. will be added in port operations module
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
        // This will be expanded with weather, encounters, damage, etc.
        const shipSpeed = state.ship.movement * this.MILES_PER_INCH_DAILY;
        
        // For now, simple placeholder
        return {
            distanceCovered: Math.min(shipSpeed, remainingDistance),
            shipSank: false,
            damage: 0
        };
    }

    /**
     * Process port arrival and activities
     */
    async processPort(state, portId, legIndex, allLegs) {
        const portName = PortRegistry.get(portId).name;
        state.portsVisited.push(portName);
        
        const portActivity = {
            portName: portName,
            portType: legIndex === allLegs.length - 1 ? "destination" : "intermediate",
            date: this.getCurrentDate(),
            fees: {},
            activities: [],
            totalCost: 0
        };
        state.portActivities.push(portActivity);
        
        // Attempt cargo sale if carrying cargo
        if (state.currentCargo.loads > 0) {
            await this.attemptCargoSale(state, portId, portActivity, allLegs[legIndex].distance);
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
        state.voyageLogHtml.value += `<p><strong>Consignment Load:</strong> ${cargo.name} (${state.currentCargo.loads} loads). Commission: ${state.commissionRate}%</p>`;
        
        portActivity.activities.push(`Loaded ${state.currentCargo.loads} loads of ${cargo.name} on consignment.`);
    }

    /**
     * Get current date from weather system
     */
    getCurrentDate() {
        if (game.dndWeather?.weatherSystem?.calendarTracker) {
            return game.dndWeather.weatherSystem.calendarTracker.getDateString();
        }
        return "Unknown Date";
    }

    /**
     * Advance calendar by one day
     */
    advanceDay() {
        if (game.dndWeather?.weatherSystem?.calendarTracker) {
            game.dndWeather.weatherSystem.calendarTracker.advanceDay();
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
        // TODO: Generate journal entry with full logs
        // TODO: Distribute profits
        // TODO: Clean up active voyage
        
        console.log("Voyage complete:", state);
    }
}