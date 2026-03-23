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
import { CargoOperations } from '../trading/cargo-operations.js';
import { TradingStrategy } from '../trading/trading-strategy.js';
import { ReportGenerator } from '../journal/report-generator.js';
import { ShipRepairSystem } from './ship-repair.js';
import { CrewHiringSystem } from './crew-hiring.js';
import { MerchantTimingSystem } from '../trading/merchant-timing.js';
import { PortAgentSystem } from '../trading/port-agent.js';

export class VoyageSimulator {
  /** Persist active voyages in a single world setting */
  static STORE_NS = "adnd-voyage-simulator";
  static STORE_KEY = "voyages";

  static async _getStore() {
      try {
      const raw = await game.settings.get(this.STORE_NS, this.STORE_KEY);
      return raw && typeof raw === "object" ? raw : {};
      } catch {
      // First run: register the setting if needed
      await game.settings.register(this.STORE_NS, this.STORE_KEY, {
          name: "Voyage Store",
          scope: "world",
          config: false,
          default: {}
      });
      return {};
      }
  }
  static async _setStore(store) {
      return game.settings.set(this.STORE_NS, this.STORE_KEY, store || {});
  }

  static async saveState(voyageId, state) {
      const store = await this._getStore();
      store[voyageId] = state;
      await this._setStore(store);
  }
  static async loadState(voyageId) {
      const store = await this._getStore();
      return store[voyageId] ?? null;
  }
  static async listVoyages() {
      const store = await this._getStore();
      return Object.entries(store).map(([id, s]) => ({ id, name: s?.name || id, state: s }));
  }

  
  constructor() {
      this.activeVoyages = new Map();
      this.MILES_PER_INCH_DAILY = 8;
  }

  /**
   * Start a new voyage simulation
   */
  async startVoyage(voyageConfig) {
    const mode = (voyageConfig?.mode === "manual") ? "manual" : "auto";
    const voyageId = voyageConfig?.voyageId || crypto.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    
    // Initialize state
    const voyageState = this.initializeVoyageState(voyageConfig);
    voyageState.id = voyageId;
    voyageState.mode = mode;

    const validation = this.validatevoyageConfig(voyageConfig);
    if (!validation.valid) {
        ui.notifications.error(validation.message);
        return null;
    }

    // Date/Time Setup — prefer CTT, fall back to weather module
    const ctt = game.modules?.get('calendar-time-tracker')?.api;
    if (ctt && voyageConfig.startingYear && voyageConfig.startingMonth && voyageConfig.startingDay) {
        // CTT expects numeric month index, but voyageConfig has month name string
        // Look up the index from CTT's calendar configuration
        let monthIndex = voyageConfig.startingMonth;
        if (typeof monthIndex === 'string') {
            const calConfig = ctt.getMonthData?.(0); // probe to check if API works
            // Search CTT's calendar months for the matching name
            const tracker = game.modules.get('calendar-time-tracker')?.timeTracker;
            const months = tracker?.calendarSystem?.configuration?.months || [];
            const foundIdx = months.findIndex(m => m.name === monthIndex);
            if (foundIdx >= 0) {
                monthIndex = foundIdx;
                console.log(`[Voyage Setup] Resolved month "${voyageConfig.startingMonth}" to CTT index ${monthIndex}`);
            } else {
                console.warn(`[Voyage Setup] Could not find month "${voyageConfig.startingMonth}" in CTT calendar, skipping setDateTime`);
                monthIndex = null;
            }
        }
        if (monthIndex !== null) {
            ctt.setDateTime({
                year: voyageConfig.startingYear,
                month: monthIndex,
                day: voyageConfig.startingDay,
                hour: 6, minute: 0, second: 0
            });
            console.log(`[Voyage Setup] Date set via CTT: ${ctt.getCurrentDate().fullDateTime}`);
        }
    }

    // Weather System Setup
    if (globalThis.dndWeather?.weatherSystem) {
        const system = globalThis.dndWeather.weatherSystem;
        system.settings.latitude = voyageConfig.latitude;
        system.settings.longitude = voyageConfig.longitude;
        system.settings.terrain = "coast-warm";
        system.settings.elevation = 0;
        system.settings.locationName = PortRegistry.get(voyageState.route.ports[0])?.name || "At Sea";

        // Only set weather calendar if CTT is NOT handling dates
        if (!ctt && system.calendarTracker && voyageConfig.startingYear && voyageConfig.startingMonth && voyageConfig.startingDay) {
            system.calendarTracker.setDate({
                year: voyageConfig.startingYear,
                month: voyageConfig.startingMonth,
                day: voyageConfig.startingDay,
                hour: 6,
                minute: 0
            });
            console.log(`[Voyage Setup] Date set via Weather module: ${system.calendarTracker.getDateString()}`);
        }
    }

    // Initial Ledger Entry
    const startDate = this.getCurrentDate();
    this.recordLedgerEntry(voyageState, startDate, "Beginning of trade simulation", voyageState.treasury, 0, true);
    console.log(`[Voyage Ledger] Initial Balance: ${voyageState.treasury} gp on ${startDate}`);

    // Persist State
    this.activeVoyages.set(voyageId, voyageState);
    await VoyageSimulator.saveState(voyageId, voyageState);

    if (mode === "manual") {
        console.log(`Voyage ${voyageId} initialized in MANUAL mode.`);
        return voyageId;
    } else {
        await this.runSimulation(voyageId);
        return voyageId;
    }
  }

  /**
   * Helper to record financial transaction to ledger
   */
  recordLedgerEntry(state, date, description, income, expense, setBalance = false) {
      let newBalance = 0;
      if (setBalance) {
          newBalance = income;
      } else {
          const lastEntry = state.ledger[state.ledger.length - 1];
          const prevBalance = lastEntry ? lastEntry.balance : 0;
          newBalance = prevBalance + income - expense;
      }

      state.ledger.push({
          date: date,
          description: description,
          income: income > 0 ? income : null,
          expense: expense > 0 ? expense : null,
          balance: newBalance
      });
      
      if (!setBalance) {
          console.log(`[Voyage Ledger] ${date} | ${description} | +${income} -${expense} | Bal: ${newBalance}`);
      }
  }

  /**
   * Initialize voyage state object
   */
  initializeVoyageState(config) {
      const ship = ShipRegistry.createInstance(config.shipId);
      const route = RouteRegistry.get(config.routeId);
      
      const captainProficiencyScores = ProficiencySystem.createProficiencyScores(config.captain);
      const lieutenantSkills = config.lieutenant?.skills ?? {};
      const crewQualityMod = ProficiencySystem.getCrewQualityModifier(config.crewQuality);

      // --- EXPENSE CALCULATION (Based on DMG 1e, p.33-34) ---
      let monthlyWage = 0;
      let totalCrewCount = 0;
      
      // 1. Basic Crew Wages (Sailors, Oarsmen, Marines)
      if (ship.crew) {
          ship.crew.forEach(group => {
              let wage = 0;
              // "Sailors cost 2 g.p. per month"
              if (group.role === 'sailor' || group.role === 'sailors') wage = 2;
              // "Oarsmen ... cost 5 g.p. per month"
              else if (group.role === 'oarsman' || group.role === 'oarsmen') wage = 5;
              // "Marines ... cost 3 g.p. per month"
              else if (group.role === 'marine' || group.role === 'marines') wage = 3;
              
              // Do not count officers in this loop, we calculate them based on rules below
              if (['lieutenant', 'mate', 'captain'].includes(group.role)) return;

              if (wage > 0) {
                  monthlyWage += (group.count * wage);
                  totalCrewCount += group.count;
              }
          });
      }

      console.log(`[Voyage Expenses] Base Crew Count: ${totalCrewCount}. Base Crew Wage: ${monthlyWage} gp/mo`);

      // 2. Officer Requirements & Wages
      // "For every 20 crewmen... there must be 1 lieutenant and 2 mates."
      // "Each master or captain will have at least one lieutenant and several mates."
      // Interpretation: Minimum 1 Lt and 2 Mates. Scale up for every full 20 crew.
      const requiredLieutenants = Math.max(1, Math.ceil(totalCrewCount / 20));
      const requiredMates = Math.max(2, Math.ceil(totalCrewCount / 10)); // 2 per 20 = 1 per 10

      // Mates: "Cost 30 g.p. per month"
      const matesCost = requiredMates * 30;
      monthlyWage += matesCost;

      // Lieutenants: "Cost... 100 g.p. per month per level"
      // Default mercenary lieutenant level is usually 2 or 3.
      const ltLevel = config.lieutenant.level || 3; 
      const ltCost = requiredLieutenants * (ltLevel * 100);
      monthlyWage += ltCost;

      // Captain: "Cost... 100 g.p. per month per level"
      // "1-4 = 5th, 5-7 = 6th, 8-9 = 7th, 0 = 8th"
      let capLevel = config.captain.level;
      if (!capLevel) {
          const roll = Math.floor(Math.random() * 10) + 1; // d10
          if (roll <= 4) capLevel = 5;
          else if (roll <= 7) capLevel = 6;
          else if (roll <= 9) capLevel = 7;
          else capLevel = 8;
          console.log(`[Voyage Expenses] Rolled Random Captain Level: ${capLevel} (Roll: ${roll})`);
      }
      const captainCost = capLevel * 100;
      monthlyWage += captainCost;

      // Total Complement for Food Calc
      const totalSouls = totalCrewCount + requiredMates + requiredLieutenants + 1; // +1 Captain

      console.log(`[Voyage Expenses] Officers: 1 Capt (Lvl ${capLevel}), ${requiredLieutenants} Lts (Lvl ${ltLevel}), ${requiredMates} Mates.`);
      console.log(`[Voyage Expenses] Officer Wages: Capt ${captainCost} + Lts ${ltCost} + Mates ${matesCost} = ${captainCost + ltCost + matesCost} gp`);
      console.log(`[Voyage Expenses] Total Monthly Wage Bill: ${monthlyWage} gp`);

      // 3. Food Costs (Calculated Weekly per DMG "Supplies")
      // 7gp per week per 5 crew.
      // Weekly cost = (TotalSouls / 5) * 7.
      // Daily cost = Weekly cost / 7 = TotalSouls / 5 * 1gp.
      const dailyFoodCost = Math.ceil(totalSouls / 5); 

      const dailyWageCost = Math.ceil(monthlyWage / 30);
      
      console.log(`[Voyage Expenses] Daily Burn: Wages ${dailyWageCost} gp + Food ${dailyFoodCost} gp = ${dailyWageCost + dailyFoodCost} gp/day`);

      return {
          // Core Data
          ship: ship,
          currentCrew: JSON.parse(JSON.stringify(ship.crew)),
          route: route,
          
          // Actors
          captain: { ...config.captain, level: capLevel }, // Store calculated level
          lieutenant: { ...config.lieutenant, level: ltLevel },
          allOfficers: config.allOfficers || [],
          officerCounts: {
              lieutenants: requiredLieutenants,
              mates: requiredMates
          },
          captainProficiencyScores: captainProficiencyScores,
          lieutenantSkills: lieutenantSkills,
          
          // Configuration
          tradeMode: config.tradeMode,
          commissionRate: config.commissionRate,
          autoRepair: config.autoRepair,
          enableRowing: config.enableRowing,
          automateTrading: config.automateTrading,
          crewQuality: config.crewQuality,
          crewQualityMod: crewQualityMod,
          
          // Finances
          treasury: config.startingGold,
          startingCapital: config.startingGold,
          crewEarningsFromTrade: 0,
          revenueTotal: 0,
          expenseTotal: 0,
          
          // Ledger & Expenses
          ledger: [],
          dailyOperationalCost: dailyWageCost + dailyFoodCost,
          legAccumulatedCost: 0,
          breakdown: { wages: 0, food: 0, repairs: 0, fees: 0, cargo: 0, taxes: 0 },
          
          // Cargo
          currentCargo: { type: null, loads: 0, purchasePrice: 0 },
          
          // Tracking
          totalDays: 0,
          totalDistance: 0,
          totalHullDamage: ship.hullPoints.max - ship.hullPoints.value,
          consecutiveRowingDays: 0,
          position: { routeSegment: 0, milesOnSegment: 0 }, 
          weatherSeed: null,
          currentWaterType: "SHALLOW", // FRESH, COASTAL, SHALLOW, or DEEP - for encounter checks
          
          // Logs
          voyageLogHtml: { value: "" },
          weatherLogHtml: { value: "" },
          events: [], // Structured event log for encounters, damage, etc.
          portsVisited: [],
          portActivities: [],
          repairLog: [],
          passengerManifest: [],
          log: [], 
          
          // Maintenance
          shipMaintenanceStatus: {
              lastMaintenance: 0,
              maintenanceOverdue: 0,
              shipQuality: "Average",
              speedPenalty: 0,
              temporaryRepairs: []
          },
          maintenance: { daysSinceService: 0, speedPenalty: 0, quality: "Average" },
          
          // Scurvy tracking
          scurvy: {
              daysOnSeaRations: 0,
              affectedCrew: 0,
              totalConLost: 0,
              totalStrLost: 0
          },

          // Crew morale
          morale: {
              daysSinceShoreLeave: 0,
              proficiencyPenalty: 0,
              desertedTotal: 0
          },

          // Dates & Flags
          shipStartDate: null,
          shipEndDate: null,
          flags: { atSea: true, inPort: false, finished: false, lastPortId: config.routeId ? RouteRegistry.get(config.routeId).ports[0] : null }
      };
  }

  // ... (Rest of the file remains the same: validatevoyageConfig, runSimulation, buildRouteLegs, etc.) ...
  validatevoyageConfig(config) {
      if (!ShipRegistry.get(config.shipId)) return { valid: false, message: "Invalid ship ID" };
      if (!RouteRegistry.get(config.routeId)) return { valid: false, message: "Invalid route ID" };
      if (config.startingGold < 0) return { valid: false, message: "Starting gold must be >= 0" };
      if (config.tradeMode === "consignment" && (config.commissionRate < 10 || config.commissionRate > 40)) {
          return { valid: false, message: "Commission rate must be 10-40%" };
      }
      if (!config.captain?.name) return { valid: false, message: "Captain must have a name" };
      return { valid: true };
  }

  async runSimulation(voyageId) {
      const state = this.activeVoyages.get(voyageId);
      if (!state) return;

      const legs = this.buildRouteLegs(state.route);
      state.totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
      
      await this.processOriginPort(state, legs);
      
      for (let i = 0; i < legs.length; i++) {
          const legComplete = await this.sailLeg(state, legs[i], i, legs);
          
          if (!legComplete) {
              await this.handleVoyageFailure(state);
              return;
          }
          
          if (i < legs.length - 1 || this.isCircuitRoute(state.route)) {
              await this.processPort(state, legs[i].toID, i, legs);
          }
          
          if (state.ship.hullPoints.value <= 0) {
              await this.handleVoyageFailure(state);
              return;
          }
      }
      
      await this.finalizeVoyage(state);
  }

  buildRouteLegs(route) {
      const legs = [];
      const ports = route.ports;
      for (let i = 0; i < ports.length - 1; i++) {
          const distance = PortRegistry.getDistance(ports[i], ports[i + 1]);
          if (!distance) continue;
          const waterType = route.segments
              ? (route.segments.find(s => s.from === ports[i] && s.to === ports[i + 1])?.waterType || "coastal")
              : "coastal";
          legs.push({ fromID: ports[i], toID: ports[i + 1], distance: distance, waterType: waterType });
      }
      if (route.name.toLowerCase().includes("circuit") && legs.length > 0) {
          const lastPort = ports[ports.length - 1];
          const firstPort = ports[0];
          const returnDist = PortRegistry.getDistance(lastPort, firstPort);
          if (returnDist) {
              const waterType = route.segments
                  ? (route.segments.find(s => s.from === lastPort && s.to === firstPort)?.waterType || "coastal")
                  : "coastal";
              legs.push({ fromID: lastPort, toID: firstPort, distance: returnDist, waterType: waterType });
          }
      }
      return legs;
  }

  isCircuitRoute(route) {
      return route.name.toLowerCase().includes("circuit");
  }

  async processOriginPort(state, legs) {
      const originID = state.route.ports[0];
      const originPort = PortRegistry.get(originID);
      const originName = originPort.name;
      
      state.shipStartDate = this.getCurrentDate();
      state.portsVisited.push(originName);
      state.voyageLogHtml.value += `<h2>Voyage Commenced: ${originName}</h2>`;
      
      const portActivity = {
          portName: originName,
          portType: "origin",
          date: this.getCurrentDate(),
          fees: {},
          activities: [],
          totalCost: 0
      };
      
      const portFees = await this.calculatePortFees(state, originPort, 3);
      portActivity.fees = portFees;
      portActivity.totalCost = portFees.total;
      state.treasury -= portFees.total;
      state.expenseTotal += portFees.total;
      
      this.recordLedgerEntry(state, this.getCurrentDate(), `Port fees at ${originName}`, 0, portFees.total);
      if (state.breakdown) state.breakdown.fees += portFees.total;
      
      state.voyageLogHtml.value += `<p><strong>Port Fees:</strong> ${portFees.total} gp (Entrance: ${portFees.entrance} gp, Moorage: ${portFees.moorage.cost} gp [${portFees.moorage.type}], Pilot: ${portFees.pilot} gp)</p>`;
      state.portActivities.push(portActivity);
      
      // Ship Repairs
      await this.offerShipRepairs(state, originPort, portActivity);
      
      // Crew Hiring
      await this.offerCrewHiring(state, originPort, portActivity);
      
      if (state.tradeMode === "consignment") {
          await this.loadConsignmentCargo(state, portActivity);
      } else {
          // At origin, use strategy with all legs ahead
          await this.attemptStrategicPurchase(state, originID, portActivity, -1, legs);
      }
  }

  async calculatePortFees(state, port, daysInPort) {
      const entranceRoll = new Roll("1d10 + 10");
      await entranceRoll.evaluate();
      const entrance = entranceRoll.total;
      
      const pilot = state.ship.hullPoints.max;
      
      // Determine moorage: Default to Anchor (5 gp/day) unless specific need for Berth
      // Berth costs 1 gp/hull point/day - much more expensive for larger ships
      // Rules: "Ships that cannot find (or do not desire) a berth may anchor"
      
      const damagePercent = ((state.ship.hullPoints.max - state.ship.hullPoints.value) / state.ship.hullPoints.max) * 100;
      const needsRepair = damagePercent > 10;
      const berthIsCheap = state.ship.hullPoints.max <= 5; // Very small boats - berth is ≤5 gp/day
      
      // Check berth availability (80% chance per rules)
      const berthAvailableRoll = new Roll("1d100");
      await berthAvailableRoll.evaluate();
      const berthAvailable = berthAvailableRoll.total <= 80;

      let moorageCost, moorageType, moorageReason;
      
      // Only take berth if: available AND (needs repair OR berth is cheaper/same as anchor)
      if (berthAvailable && needsRepair) {
          moorageCost = state.ship.hullPoints.max * daysInPort;
          moorageType = "berth";
          moorageReason = `for repairs (${Math.round(damagePercent)}% damage)`;
      } else if (berthAvailable && berthIsCheap) {
          moorageCost = state.ship.hullPoints.max * daysInPort;
          moorageType = "berth";
          moorageReason = `(small vessel, berth ≤ anchor cost)`;
      } else {
          // Default: anchor is cheaper
          moorageCost = 5 * daysInPort;
          moorageType = "anchor";
          moorageReason = berthAvailable ? "(berth available but anchor cheaper)" : "(no berth available)";
      }
      
      return {
          entrance: entrance,
          pilot: pilot,
          moorage: { cost: moorageCost, type: moorageType, days: daysInPort, reason: moorageReason },
          total: entrance + pilot + moorageCost
      };
  }

  async sailLeg(state, leg, legIndex, allLegs) {
      const fromName = PortRegistry.get(leg.fromID).name;
      const toName = PortRegistry.get(leg.toID).name;
      
      state.voyageLogHtml.value += `<h4>Leg ${legIndex + 1}: ${fromName} → ${toName}</h4><p><strong>Distance:</strong> ${leg.distance} miles</p>`;
      
      // Set waterType for this leg from route segment data
      state.currentWaterType = this._waterTypeToEncounterKey(leg.waterType || "coastal");

      let remainingDistance = leg.distance;
      let sailingDays = 0;
      
      while (remainingDistance > 0 || sailingDays === 0) {
          const dayResult = await this.simulateSailingDay(state, toName, remainingDistance, leg);
          if (dayResult.shipSank) return false;
          remainingDistance -= dayResult.distanceCovered;
          sailingDays++;
          state.totalDays++;
          this.advanceDay();
      }
      return true;
  }

  /**
   * Map route segment waterType strings to EncounterSystem keys
   */
  _waterTypeToEncounterKey(waterType) {
      const map = {
          "coastal": "SHALLOW",
          "openWater": "DEEP",
          "river": "FRESH",
          "lake": "FRESH"
      };
      return map[waterType] || "SHALLOW";
  }

  async simulateSailingDay(state, destinationName, remainingDistance, leg = null) {
      const dateStr = this.getCurrentDate();
      
      if (state.dailyOperationalCost) {
          state.expenseTotal += state.dailyOperationalCost;
          state.treasury -= state.dailyOperationalCost;
          state.legAccumulatedCost = (state.legAccumulatedCost || 0) + state.dailyOperationalCost;
          
          if (state.breakdown) {
              const foodRatio = 0.3; 
              const dailyFood = Math.floor(state.dailyOperationalCost * foodRatio);
              state.breakdown.food += dailyFood;
              state.breakdown.wages += (state.dailyOperationalCost - dailyFood);
          }
      }

      let parsedWeather = null;
      if (globalThis.dndWeather?.weatherSystem) {
          const weatherArr = await globalThis.dndWeather.weatherSystem.generateWeather();
          const weather = weatherArr[0];
          globalThis.dndWeather.weatherSystem.setCurrentWeather(weather);
          
          const temp = weather.baseConditions?.temperature;
          const wind = weather.baseConditions?.wind;
          const precip = weather.baseConditions?.precipitation;
          
          parsedWeather = {
              temperature: { high: temp?.high || 70, low: temp?.low || 50 },
              wind: { speed: wind?.speed || 10, direction: wind?.direction || "N" },
              precipitation: { type: precip?.type || "none", duration: precip?.duration || 0 },
              sky: weather.baseConditions?.sky || "clear",
              raw: weather
          };
      } else {
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
      
      // Speed: Seafaring ships store dailySail (miles/day) directly.
      // DMG ships store normalSail (mph) — convert via hours/day.
      // Legacy ships store movement ("inches") — convert via MILES_PER_INCH_DAILY.
      const SAILING_HOURS_PER_DAY = 10;
      let baseSpeed;
      if (state.ship.dailySail) {
          baseSpeed = state.ship.dailySail;
      } else if (state.ship.normalSail) {
          baseSpeed = state.ship.normalSail * SAILING_HOURS_PER_DAY;
      } else {
          baseSpeed = state.ship.movement * this.MILES_PER_INCH_DAILY;
      }
      const speedInfo = this.calculateSailingSpeed(baseSpeed, parsedWeather);
      
      let distanceCovered = 0;
      let damage = 0;
      let shipSank = false;
      
      // --- Maintenance evaluation ---
      this._evaluateMaintenance(state, dateStr);

      // --- Scurvy tracking (at sea = sea rations) ---
      this._processScurvy(state, dateStr);

      // --- Morale tracking ---
      this._processMorale(state, dateStr);

      // Apply morale penalty to speed
      const moralePenalty = state.morale?.proficiencyPenalty || 0;

      // Apply maintenance speed penalty
      const maintSpeedPenalty = state.maintenance?.speedPenalty || 0;

      if (speedInfo.becalmed) {
          state.voyageLogHtml.value += `<p><strong>${dateStr}:</strong> Becalmed! No progress made. ${speedInfo.note}</p>`;
          if (state.enableRowing) {
              const { NavigationSystem } = await import('./navigation.js');
              const rowingInfo = NavigationSystem.handleRowing(
                  state.enableRowing,
                  (state.ship?.crew || []).find(c => c.role === "oarsmen")?.count || 0,
                  state.consecutiveRowingDays,
                  8
              );
              if (rowingInfo.canRow) {
                  distanceCovered = Math.min(rowingInfo.rowingSpeed, remainingDistance);
                  state.consecutiveRowingDays++;
                  state.voyageLogHtml.value += `<p>Crew rows: ${distanceCovered} miles. ${rowingInfo.fatigued ? '(Crew fatigued)' : ''}</p>`;
              }
          }
      } else {
          state.consecutiveRowingDays = 0;
          let adjustedSpeed = speedInfo.speed;
          // Apply cumulative maintenance speed penalty
          if (maintSpeedPenalty > 0) {
              adjustedSpeed = Math.max(1, Math.floor(adjustedSpeed * (100 - maintSpeedPenalty) / 100));
          }
          distanceCovered = Math.min(adjustedSpeed, remainingDistance);

          // --- Daily navigation check (openWater segments only) ---
          const segWaterType = leg?.waterType || "coastal";
          if (segWaterType === "openWater" && distanceCovered > 0) {
              const navResult = await this._rollNavigationCheck(state, parsedWeather, moralePenalty);
              if (navResult && navResult.failed) {
                  const milesLost = Math.max(0, Math.floor(distanceCovered * navResult.lostPercent / 100));
                  distanceCovered = Math.max(0, distanceCovered - milesLost);
                  state.voyageLogHtml.value += `<p>⚠️ Navigation error! Lost ${milesLost} miles (d20: ${navResult.roll}, needed ≤ ${navResult.target}). ${navResult.modNote}</p>`;
              }
          }

          // --- Wind damage table (gale+ conditions, every 6 hours) ---
          const windDmgResults = await this._processWindDamage(state, parsedWeather, dateStr);
          for (const wd of windDmgResults) {
              if (wd.damage) damage += wd.damage;
              if (wd.sank) shipSank = true;
          }

          const { NavigationSystem } = await import('./navigation.js');
          const hazard = NavigationSystem.assessWeatherHazard(parsedWeather);

          if (hazard && hazard.hazardType) {
              const pilotCheck = await NavigationSystem.makePilotingCheck(
                  state.captainProficiencyScores, state.lieutenantSkills, state.crewQualityMod, hazard.pilotingModifier
              );
              if (!pilotCheck.success) {
                  damage = await NavigationSystem.calculateHazardDamage(hazard.hazardType, pilotCheck.missedBy);
                  state.ship.hullPoints.value -= damage;
                  state.totalHullDamage += damage;
                  state.voyageLogHtml.value += `<p><strong>⚠️ ${hazard.description} (${dateStr})!</strong> Piloting check failed by ${pilotCheck.missedBy}. Hull damage: ${damage} HP. (${state.ship.hullPoints.value}/${state.ship.hullPoints.max} remaining)</p>`;
                  
                  state.events.push({
                      type: 'damage',
                      date: dateStr,
                      source: 'weather',
                      sourceName: hazard.description,
                      hazardType: hazard.hazardType,
                      pilotCheckMissedBy: pilotCheck.missedBy,
                      hullDamage: damage,
                      hullRemaining: state.ship.hullPoints.value
                  });
                  
                  if (state.ship.hullPoints.value <= 0) shipSank = true;
              }
          }
      }
      
      const weatherLog = this.formatWeatherLog(dateStr, parsedWeather, speedInfo, destinationName);
      state.weatherLogHtml.value += weatherLog;
      
      // Process daily encounters based on water type
      const { EncounterSystem } = await import('./encounter-system.js');
      const waterType = state.currentWaterType || "SHALLOW";
      console.log(`Voyage Simulator | Processing encounters for water type: ${waterType}`);
      const encounters = await EncounterSystem.processDailyEncounters(waterType);
      console.log(`Voyage Simulator | Encounters rolled: ${encounters.length}`);
      
      for (const encounter of encounters) {
          const encounterText = EncounterSystem.generateEncounterText(encounter);
          console.log(`Voyage Simulator | Encounter: ${encounterText}`);
          state.voyageLogHtml.value += `<p><strong>🎲 Encounter (${dateStr}):</strong> ${encounterText}</p>`;
          
          state.events.push({
              type: 'encounter',
              date: dateStr,
              waterType,
              encounter: encounter.encounter.name,
              classification: encounter.classification,
              timeOfDay: encounter.timeOfDay,
              numberAppearing: encounter.numberAppearing?.count || 1,
              distance: encounter.distance,
              surprise: encounter.surprise?.shipSurprised || false
          });
          
          const encounterDamage = await this._resolveEncounterOrBoarding(
              state, encounter, dateStr
          );
          
          if (encounterDamage.hullDamage > 0) {
              state.ship.hullPoints.value -= encounterDamage.hullDamage;
              state.totalHullDamage += encounterDamage.hullDamage;
              damage += encounterDamage.hullDamage;
              state.voyageLogHtml.value += `<p>Hull damage: ${encounterDamage.hullDamage} HP. (${state.ship.hullPoints.value}/${state.ship.hullPoints.max} remaining)</p>`;
              
              state.events.push({
                  type: 'damage',
                  date: dateStr,
                  source: 'encounter',
                  sourceName: encounter.encounter.name,
                  hullDamage: encounterDamage.hullDamage,
                  hullRemaining: state.ship.hullPoints.value
              });
          }
          
          if (encounterDamage.crewLoss > 0) {
              state.voyageLogHtml.value += `<p>⚠️ Crew casualties: ${encounterDamage.crewLoss} lost!</p>`;
              
              let remainingLosses = encounterDamage.crewLoss;
              
              const sailors = state.currentCrew.find(c => c.role === "sailor" || c.role === "sailors");
              if (sailors && remainingLosses > 0) {
                  const lostSailors = Math.min(sailors.count, remainingLosses);
                  sailors.count -= lostSailors;
                  remainingLosses -= lostSailors;
              }
              
              if (remainingLosses > 0) {
                  const marines = state.currentCrew.find(c => c.role === "marine" || c.role === "marines");
                  if (marines) {
                      const lostMarines = Math.min(marines.count, remainingLosses);
                      marines.count -= lostMarines;
                      remainingLosses -= lostMarines;
                  }
              }
              
              state.events.push({
                  type: 'crew_loss',
                  date: dateStr,
                  source: 'encounter',
                  sourceName: encounter.encounter.name,
                  crewLost: encounterDamage.crewLoss
              });
          }
          
          if (encounterDamage.notes) {
              state.voyageLogHtml.value += `<p><em>${encounterDamage.notes}</em></p>`;
          }
          
          if (state.ship.hullPoints.value <= 0) {
              shipSank = true;
              break;
          }
      }
      
      return { distanceCovered, shipSank, damage };
  }

  // ===========================================================================
  // NAVIGATION CHECK (open water only)
  // d20 vs navigator proficiency with full modifier stack from the PDF:
  //   no charts +2, strong breeze +2, gale +5, storm +10,
  //   two navigators -3, unseaworthy +2, current +1/+3
  // Failure costs (result × 5)% of the day's travel as lost miles
  // ===========================================================================
  async _rollNavigationCheck(state, weather, moralePenalty = 0) {
      const windSpeed = weather.wind.speed;
      let modifier = 0;
      let modParts = [];

      // Wind modifiers
      if (windSpeed >= 75) { modifier += 10; modParts.push("storm +10"); }
      else if (windSpeed >= 50) { modifier += 5; modParts.push("gale +5"); }
      else if (windSpeed >= 30) { modifier += 2; modParts.push("strong breeze +2"); }

      // No charts — check proficiency
      const hasNavigation = state.captainProficiencyScores?.navigation || state.lieutenantSkills?.navigation;
      if (!hasNavigation) { modifier += 2; modParts.push("no charts +2"); }

      // Two navigators bonus
      const capNav = state.captainProficiencyScores?.navigation;
      const ltNav = state.lieutenantSkills?.navigation;
      if (capNav && ltNav) { modifier -= 3; modParts.push("two navigators -3"); }

      // Unseaworthy (maintenance quality degraded)
      if (state.maintenance?.quality === "Unseaworthy") { modifier += 2; modParts.push("unseaworthy +2"); }

      // Morale penalty
      if (moralePenalty > 0) { modifier += moralePenalty; modParts.push(`morale +${moralePenalty}`); }

      // Navigator base target: proficiency score or default 10
      const navScore = capNav || ltNav || 10;
      const target = Math.max(1, navScore - modifier);

      const navRoll = new Roll("1d20");
      await navRoll.evaluate();

      if (navRoll.total <= target) return { failed: false };

      const overBy = navRoll.total - target;
      const lostPercent = overBy * 5;
      return {
          failed: true,
          roll: navRoll.total,
          target,
          overBy,
          lostPercent,
          modNote: modParts.length ? `(mods: ${modParts.join(", ")})` : ""
      };
  }

  // ===========================================================================
  // WIND DAMAGE TABLE — called every 6 hours during gale+ conditions
  // Checks: capsizing, broken mast, broken beams/leaking, torn sails, man overboard
  // Thresholds by severity: gale / storm / hurricane
  // ===========================================================================
  async _processWindDamage(state, weather, dateStr) {
      const windSpeed = weather.wind.speed;
      const results = [];
      if (windSpeed < 50) return results; // Below gale, no wind damage checks

      // Determine severity tier: 0=gale(50-74), 1=storm(75-99), 2=hurricane(100+)
      let tier;
      if (windSpeed >= 100) tier = 2;
      else if (windSpeed >= 75) tier = 1;
      else tier = 0;

      const thresholds = {
          capsize:     [1, 20, 40],
          brokenMast:  [5, 25, 45],
          leaking:     [10, 35, 50],
          tornSails:   [20, 45, 65],
          manOverboard:[10, 50, 70]
      };

      // 4 checks per day (every 6 hours)
      for (let watch = 0; watch < 4; watch++) {
          for (const [event, chances] of Object.entries(thresholds)) {
              const chance = chances[tier];
              const roll = new Roll("1d100");
              await roll.evaluate();
              if (roll.total > chance) continue;

              let entry = { event, roll: roll.total, chance, damage: 0, sank: false };

              if (event === "capsize") {
                  state.voyageLogHtml.value += `<p><strong>☠️ CAPSIZED (${dateStr})!</strong> Ship overturned by wind! (${roll.total} ≤ ${chance}%)</p>`;
                  state.ship.hullPoints.value = 0;
                  entry.damage = state.ship.hullPoints.max;
                  entry.sank = true;
                  results.push(entry);
                  return results;
              }
              if (event === "brokenMast") {
                  state.ship.movement = Math.max(1, Math.floor(state.ship.movement / 2));
                  state.voyageLogHtml.value += `<p><strong>⚠️ Broken mast (${dateStr})!</strong> Movement halved. (${roll.total} ≤ ${chance}%)</p>`;
                  state.events.push({ type: 'wind_damage', date: dateStr, event: 'brokenMast' });
              }
              if (event === "leaking") {
                  const leakDmg = new Roll("1d4");
                  await leakDmg.evaluate();
                  state.ship.hullPoints.value = Math.max(0, state.ship.hullPoints.value - leakDmg.total);
                  state.totalHullDamage += leakDmg.total;
                  entry.damage = leakDmg.total;
                  state.voyageLogHtml.value += `<p><strong>⚠️ Beams broken / hull leaking (${dateStr})!</strong> ${leakDmg.total} hull damage — crew assigned to bail. (${roll.total} ≤ ${chance}%)</p>`;
                  state.events.push({ type: 'wind_damage', date: dateStr, event: 'leaking', hullDamage: leakDmg.total });
                  if (state.ship.hullPoints.value <= 0) { entry.sank = true; results.push(entry); return results; }
              }
              if (event === "tornSails") {
                  // 25% speed reduction per torn sails event (stacks)
                  state.maintenance.speedPenalty = Math.min(75, (state.maintenance.speedPenalty || 0) + 25);
                  state.voyageLogHtml.value += `<p><strong>⚠️ Sails torn (${dateStr})!</strong> Speed reduced. (${roll.total} ≤ ${chance}%)</p>`;
                  state.events.push({ type: 'wind_damage', date: dateStr, event: 'tornSails' });
              }
              if (event === "manOverboard") {
                  // Randomly lose an officer or crewman
                  const crewLoss = this._resolveManOverboard(state);
                  state.voyageLogHtml.value += `<p><strong>⚠️ Man overboard (${dateStr})!</strong> Lost: ${crewLoss.who}. (${roll.total} ≤ ${chance}%)</p>`;
                  state.events.push({ type: 'crew_loss', date: dateStr, source: 'wind', crewLost: 1, who: crewLoss.who });
              }

              results.push(entry);
          }
      }
      return results;
  }

  /**
   * Resolve man overboard — randomly kills an officer or crew member
   */
  _resolveManOverboard(state) {
      // 20% chance it's an officer, 80% regular crew
      const isOfficer = Math.random() < 0.20;
      if (isOfficer) {
          const mates = state.officerCounts?.mates || 0;
          const lts = state.officerCounts?.lieutenants || 0;
          if (mates > 0) {
              state.officerCounts.mates--;
              return { who: "Mate" };
          } else if (lts > 0) {
              state.officerCounts.lieutenants--;
              return { who: "Lieutenant" };
          }
      }
      // Regular crew
      const sailors = state.currentCrew.find(c => c.role === "sailor" || c.role === "sailors");
      if (sailors && sailors.count > 0) { sailors.count--; return { who: "Sailor" }; }
      const marines = state.currentCrew.find(c => c.role === "marine" || c.role === "marines");
      if (marines && marines.count > 0) { marines.count--; return { who: "Marine" }; }
      const oarsmen = state.currentCrew.find(c => c.role === "oarsman" || c.role === "oarsmen");
      if (oarsmen && oarsmen.count > 0) { oarsmen.count--; return { who: "Oarsman" }; }
      return { who: "Unknown crew" };
  }

  // ===========================================================================
  // SCURVY — counter for daysOnSeaRations; after 30 days, 10% crew
  // affected per additional week. Affected crew lose 1 CON + 1 STR/week.
  // Port with fresh food resets the counter and recovers 3 pts/week.
  // ===========================================================================
  _processScurvy(state, dateStr) {
      if (!state.scurvy) state.scurvy = { daysOnSeaRations: 0, affectedCrew: 0, totalConLost: 0, totalStrLost: 0 };
      state.scurvy.daysOnSeaRations++;

      if (state.scurvy.daysOnSeaRations > 30 && state.scurvy.daysOnSeaRations % 7 === 0) {
          const totalCrew = (state.currentCrew || []).reduce((s, g) => s + (g.count || 0), 0);
          const newCases = Math.max(1, Math.floor(totalCrew * 0.10));
          state.scurvy.affectedCrew = Math.min(totalCrew, state.scurvy.affectedCrew + newCases);
          state.scurvy.totalConLost++;
          state.scurvy.totalStrLost++;
          state.voyageLogHtml.value += `<p><strong>🤒 Scurvy (${dateStr})!</strong> ${state.scurvy.affectedCrew} crew affected (week ${Math.floor((state.scurvy.daysOnSeaRations - 30) / 7) + 1}). -1 CON, -1 STR this week.</p>`;
          state.events.push({ type: 'scurvy', date: dateStr, affected: state.scurvy.affectedCrew });
      }
  }

  /**
   * Reset scurvy at port with fresh food. Called from processPort.
   */
  _resetScurvyAtPort(state, daysInPort, dateStr) {
      if (!state.scurvy) return;
      state.scurvy.daysOnSeaRations = 0;
      const weeksInPort = Math.floor(daysInPort / 7);
      if (weeksInPort > 0 && state.scurvy.affectedCrew > 0) {
          const recovered = weeksInPort * 3;
          state.scurvy.totalConLost = Math.max(0, state.scurvy.totalConLost - recovered);
          state.scurvy.totalStrLost = Math.max(0, state.scurvy.totalStrLost - recovered);
          if (state.scurvy.totalConLost === 0) state.scurvy.affectedCrew = 0;
          state.voyageLogHtml.value += `<p>🍊 Fresh food! Scurvy counter reset. ${weeksInPort > 0 ? `+${recovered} pts recovered.` : ''}</p>`;
      } else {
          state.voyageLogHtml.value += `<p>🍊 Fresh provisions loaded — scurvy counter reset.</p>`;
      }
  }

  // ===========================================================================
  // MORALE — daysSinceShoreLeave; >30 days = -1 proficiency per extra week;
  // 60+ days = desertion roll (lose d4 crew) at each port stop.
  // ===========================================================================
  _processMorale(state, dateStr) {
      if (!state.morale) state.morale = { daysSinceShoreLeave: 0, proficiencyPenalty: 0, desertedTotal: 0 };
      state.morale.daysSinceShoreLeave++;

      if (state.morale.daysSinceShoreLeave > 30) {
          const weeksOver = Math.floor((state.morale.daysSinceShoreLeave - 30) / 7);
          state.morale.proficiencyPenalty = weeksOver;
          if (weeksOver > 0 && state.morale.daysSinceShoreLeave % 7 === 0) {
              state.voyageLogHtml.value += `<p><strong>😤 Low morale (${dateStr})!</strong> ${state.morale.daysSinceShoreLeave} days without shore leave. -${weeksOver} to proficiency checks.</p>`;
          }
      } else {
          state.morale.proficiencyPenalty = 0;
      }
  }

  /**
   * Process morale at port — grant shore leave, check desertion.
   */
  async _processMoraleAtPort(state, portName, dateStr) {
      if (!state.morale) return;

      // Check desertion if 60+ days without shore leave
      if (state.morale.daysSinceShoreLeave >= 60) {
          const desertRoll = new Roll("1d4");
          await desertRoll.evaluate();
          const deserted = desertRoll.total;
          let remaining = deserted;
          const sailors = state.currentCrew.find(c => c.role === "sailor" || c.role === "sailors");
          if (sailors && remaining > 0) {
              const lost = Math.min(sailors.count, remaining);
              sailors.count -= lost;
              remaining -= lost;
          }
          if (remaining > 0) {
              const oarsmen = state.currentCrew.find(c => c.role === "oarsman" || c.role === "oarsmen");
              if (oarsmen) { const lost = Math.min(oarsmen.count, remaining); oarsmen.count -= lost; remaining -= lost; }
          }
          state.morale.desertedTotal += deserted;
          state.voyageLogHtml.value += `<p><strong>🏃 Desertion at ${portName}!</strong> ${deserted} crew deserted (${state.morale.daysSinceShoreLeave} days without leave).</p>`;
          state.events.push({ type: 'desertion', date: dateStr, count: deserted, port: portName });
      }

      // Reset morale
      state.morale.daysSinceShoreLeave = 0;
      state.morale.proficiencyPenalty = 0;
  }

  // ===========================================================================
  // MAINTENANCE — daysSinceService > 180 degrades quality, cumulative 10% speed
  // penalty per month overdue. Maintenance at port costs 1 gp/hull/day for
  // (maxHull/5) days.
  // ===========================================================================
  _evaluateMaintenance(state, dateStr) {
      if (!state.maintenance) state.maintenance = { daysSinceService: 0, speedPenalty: 0, quality: "Average" };
      const days = state.maintenance.daysSinceService || 0;

      if (days > 180) {
          const monthsOverdue = Math.floor((days - 180) / 30);
          const newPenalty = monthsOverdue * 10;

          // Degrade quality one step at 180, 210, 240...
          const qualities = ["Average", "Fair", "Poor", "Unseaworthy"];
          const qIdx = Math.min(qualities.length - 1, monthsOverdue);
          state.maintenance.quality = qualities[qIdx];
          state.maintenance.speedPenalty = newPenalty;

          if (days % 30 === 0) {
              state.voyageLogHtml.value += `<p><strong>🔧 Maintenance overdue (${dateStr})!</strong> ${days} days since last service. Quality: ${state.maintenance.quality}. Speed penalty: -${newPenalty}%.</p>`;
          }
      }
  }

  /**
   * Perform maintenance at port.
   * Cost: 1 gp per hull value per day. Duration: maxHull / 5 days.
   */
  async _performMaintenance(state, portName, dateStr) {
      const maxHull = state.ship.hullPoints?.max || 20;
      const maintenanceDays = Math.ceil(maxHull / 5);
      const dailyCost = maxHull; // 1 gp per hull value per day
      const totalCost = dailyCost * maintenanceDays;

      if (state.treasury < totalCost) {
          state.voyageLogHtml.value += `<p><em>Maintenance needed but cannot afford (${totalCost} gp for ${maintenanceDays} days).</em></p>`;
          return 0;
      }

      state.treasury -= totalCost;
      state.expenseTotal += totalCost;
      if (state.breakdown) state.breakdown.repairs += totalCost;
      this.recordLedgerEntry(state, dateStr, `Ship maintenance at ${portName}`, 0, totalCost);

      state.maintenance.daysSinceService = 0;
      state.maintenance.speedPenalty = 0;
      state.maintenance.quality = "Average";

      state.voyageLogHtml.value += `<p><strong>🔧 Maintenance performed at ${portName}:</strong> ${maintenanceDays} days, ${totalCost} gp. Ship quality restored to Average.</p>`;
      state.events.push({ type: 'maintenance', date: dateStr, cost: totalCost, days: maintenanceDays, port: portName });

      return maintenanceDays;
  }

  // ===========================================================================
  // ENCOUNTER → BOARDING INTERCEPT
  // If the encounter is a boardable threat, route through BoardingCombat.
  // Auto mode: fully auto-resolve. Manual mode: post interactive chat card.
  // Falls back to standard calculateEncounterDamage for non-boarding threats.
  // ===========================================================================
  async _resolveEncounterOrBoarding(state, encounterResult, dateStr) {
      const { EncounterSystem } = await import('./encounter-system.js');
      const enc = encounterResult.encounter;
      const classification = encounterResult.classification;
      const numAppearing = encounterResult.numberAppearing?.count || 1;

      // Check if this encounter can board the ship
      const canHarmResult = EncounterSystem.canCreatureHarmShip(enc);
      if (canHarmResult.canBoard && classification === "threat") {
          const { BoardingCombat } = await import('./boarding-combat.js');
          const boardingCtx = BoardingCombat.detectBoarding(enc, classification, numAppearing, canHarmResult);

          if (boardingCtx) {
              if (state.mode === "manual") {
                  // Interactive: post chat card and let GM resolve PC fight
                  const msgId = await BoardingCombat.postBoardingCard(state, boardingCtx, encounterResult);
                  state.voyageLogHtml.value += `<p><strong>⚔️ Boarding action initiated (${dateStr})!</strong> See chat for interactive combat card.</p>`;
                  // Return zero damage here — actual damage applied when GM resolves the card
                  return { hullDamage: 0, crewLoss: 0, notes: "Boarding action in progress — awaiting GM resolution.", boardingCardId: msgId };
              } else {
                  // Auto mode: resolve immediately
                  const result = await BoardingCombat.autoResolve(state, boardingCtx);
                  const summary = BoardingCombat.formatAutoResultForLog(result, boardingCtx);
                  state.voyageLogHtml.value += `<p>${summary}</p>`;

                  // Apply crew losses to state
                  if (result.totalDefCasualties > 0) {
                      let remaining = result.totalDefCasualties;
                      const marines = state.currentCrew.find(c => c.role === "marine" || c.role === "marines");
                      if (marines) { const lost = Math.min(marines.count, remaining); marines.count -= lost; remaining -= lost; }
                      const sailors = state.currentCrew.find(c => c.role === "sailor" || c.role === "sailors");
                      if (sailors && remaining > 0) { const lost = Math.min(sailors.count, remaining); sailors.count -= lost; }
                  }

                  // Plunder if attackers won
                  if (result.attackerVictory) {
                      state.currentCargo = { type: null, loads: 0, purchasePrice: 0 };
                      const plunderAmount = Math.floor(state.treasury * 0.75);
                      state.treasury -= plunderAmount;
                      state.voyageLogHtml.value += `<p><strong>☠️ Plundered!</strong> Lost all cargo and ${plunderAmount} gp.</p>`;
                  }

                  state.events.push({
                      type: 'boarding',
                      date: dateStr,
                      boarderName: boardingCtx.boarderName,
                      totalBoarders: boardingCtx.totalBoarders,
                      defenderVictory: result.defenderVictory,
                      rounds: result.rounds.length,
                      defCasualties: result.totalDefCasualties,
                      atkCasualties: result.totalAtkCasualties
                  });

                  // Return hull damage — crew losses already applied above
                  return { hullDamage: result.hullDamage, crewLoss: 0, notes: summary };
              }
          }
      }

      // Non-boarding encounter: use standard damage calculation
      return await EncounterSystem.calculateEncounterDamage(enc, classification, numAppearing);
  }

  calculateSailingSpeed(baseSpeed, weather) {
      let currentSpeed = baseSpeed;
      let speedNote = "";
      const windSpeed = weather.wind.speed;

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

      if (["drizzle", "rainstorm-light", "rainstorm-heavy", "hailstorm"].includes(weather.precipitation.type)) {
          const wetBonus = Math.floor(Math.random() * 6) + 5;
          const bonusMiles = Math.floor(currentSpeed * (wetBonus / 100));
          currentSpeed += bonusMiles;
          speedNote += ` Wet sails: +${bonusMiles} mi.`;
      }

      return { speed: currentSpeed, note: speedNote, becalmed: false };
  }

  formatWeatherLog(dateStr, weather, speedInfo, destination) {
      const temp = weather.temperature;
      const wind = weather.wind;
      const precip = weather.precipitation;
      return `<p><strong>${dateStr} (sailing to ${destination}):</strong> High ${temp.high}°F, Low ${temp.low}°F | ${weather.sky} | Wind ${wind.speed} mph ${wind.direction} | ${precip.type !== "none" ? `${precip.type} (${precip.duration}h)` : "No precipitation"}. ${speedInfo.note}</p>`;
  }

  async processPort(state, portId, legIndex, allLegs) {
      const port = PortRegistry.get(portId);
      const portName = port.name;
      const dateStr = this.getCurrentDate();
      state.portsVisited.push(portName);
      
      // 1. Clear accumulated sea expenses
      if (state.legAccumulatedCost && state.legAccumulatedCost > 0) {
          this.recordLedgerEntry(state, this.getCurrentDate(), "Voyage expenses (Wages & Provisions)", 0, state.legAccumulatedCost);
          state.legAccumulatedCost = 0;
      }

      // 2. Determine base time in port
      let daysInPort = legIndex === allLegs.length - 1 ? 3 : Math.floor(Math.random() * 3) + 2;
      const portActivity = {
          portName: portName,
          portType: legIndex === allLegs.length - 1 ? "destination" : "intermediate",
          date: this.getCurrentDate(),
          fees: {},
          activities: [],
          totalCost: 0
      };

      state.voyageLogHtml.value += `<h3>Arrived at ${portName}</h3>`;

      // --- Scurvy: reset counter, fresh food ---
      this._resetScurvyAtPort(state, daysInPort, dateStr);

      // --- Morale: shore leave, desertion check ---
      await this._processMoraleAtPort(state, portName, dateStr);

      // --- Maintenance: auto-perform if overdue ---
      let maintenanceDays = 0;
      if ((state.maintenance?.daysSinceService || 0) > 180) {
          maintenanceDays = await this._performMaintenance(state, portName, dateStr);
          daysInPort = Math.max(daysInPort, maintenanceDays);
      }

      // --- Loading/unloading time ---
      // 1 load per hour per 5 crew at dock, 75% longer at anchor, 150% at beach
      const totalCrew = (state.currentCrew || []).reduce((s, g) => s + (g.count || 0), 0);
      const loadsPerHour = Math.max(1, Math.floor(totalCrew / 5));
      const cargoLoads = state.currentCargo?.loads || 0;
      const cargoCapacity = state.ship?.cargoCapacity || 30;
      const totalLoadsToHandle = cargoLoads + cargoCapacity; // unload + load
      let loadingHours = Math.ceil(totalLoadsToHandle / loadsPerHour);
      // Moorage type penalty — will be determined after fees
      let loadingDays = 0; // calculated below after moorage decision

      // 3. Calculate and pay Port Fees
      const portFees = await this.calculatePortFees(state, port, daysInPort);
      portActivity.fees = portFees;
      portActivity.totalCost = portFees.total;
      state.treasury -= portFees.total;
      state.expenseTotal += portFees.total;
      
      this.recordLedgerEntry(state, this.getCurrentDate(), `Port fees at ${portName}`, 0, portFees.total);
      if (state.breakdown) state.breakdown.fees += portFees.total;
      
      state.voyageLogHtml.value += `<p><strong>Port Fees:</strong> ${portFees.total} gp (Entrance: ${portFees.entrance} gp, Moorage: ${portFees.moorage.cost} gp [${portFees.moorage.type}], Pilot: ${portFees.pilot} gp)</p>`;

      // Apply loading time based on moorage type
      if (portFees.moorage.type === "anchor") loadingHours = Math.ceil(loadingHours * 1.75);
      // beach not currently a moorage type but future-proof
      loadingDays = Math.ceil(loadingHours / 10); // ~10 working hours per day
      if (loadingDays > 0) {
          daysInPort = Math.max(daysInPort, loadingDays);
          state.voyageLogHtml.value += `<p><strong>Cargo handling:</strong> ~${loadingHours} hours (${loadingDays} days) at ${portFees.moorage.type}.</p>`;
      }

      // Ship Repairs
      await this.offerShipRepairs(state, port, portActivity);
      
      // Crew Hiring
      await this.offerCrewHiring(state, port, portActivity);
      
      // 4. Simulate Days in Port (Weather & Costs)
      for (let i = 0; i < daysInPort; i++) {
          this.advanceDay();
          state.maintenance.daysSinceService = (state.maintenance.daysSinceService || 0) + 1;
          if (state.dailyOperationalCost) {
              state.expenseTotal += state.dailyOperationalCost;
              state.treasury -= state.dailyOperationalCost;
              state.legAccumulatedCost = (state.legAccumulatedCost || 0) + state.dailyOperationalCost;
              
              if (state.breakdown) {
                  const foodRatio = 0.3;
                  const dailyFood = Math.floor(state.dailyOperationalCost * foodRatio);
                  state.breakdown.food += dailyFood;
                  state.breakdown.wages += (state.dailyOperationalCost - dailyFood);
              }
          }

          const { WeatherSystem } = await import('./weather.js');
          const weather = await WeatherSystem.generateDayWeather();
          const weatherLog = WeatherSystem.formatPortWeatherLog(this.getCurrentDate(), weather, portName);
          state.weatherLogHtml.value += weatherLog;
      }
      
      // 5. Handle Passengers
      let distanceRemaining = 0;
      for (let k = legIndex + 1; k < allLegs.length; k++) {
          distanceRemaining += allLegs[k].distance;
      }

      if (distanceRemaining > 0) {
          const { PassengerBooking } = await import('./passengers.js');
          
          const passResult = await PassengerBooking.handlePassengerBooking({
              portId: portId,
              currentTreasury: state.treasury,
              currentPortActivity: portActivity,
              voyageLogHtmlRef: state.voyageLogHtml,
              passengerManifest: state.passengerManifest,
              routeLegs: allLegs,
              currentLegIndex: legIndex + 1,
              automateTrading: state.automateTrading
          });

          if (passResult.revenueEarned > 0) {
              state.treasury = passResult.newTreasury;
              state.revenueTotal += passResult.revenueEarned;
              this.recordLedgerEntry(state, this.getCurrentDate(), `Passenger Revenue from ${portName}`, passResult.revenueEarned, 0);
          }
      }

      // 5b. Merchant Timing — week-based merchant availability
      const weeksInPort = Math.max(1, Math.floor(daysInPort / 7));
      const merchantTotal = MerchantTimingSystem.rollTotalMerchants(port.size, state.captain.chaScore);
      const merchantsAvailable = MerchantTimingSystem.getCumulativeMerchants(merchantTotal.total, weeksInPort);
      state.voyageLogHtml.value += `<p><strong>Merchants (${portName}):</strong> ${merchantsAvailable} of ${merchantTotal.total} available (${weeksInPort} week${weeksInPort > 1 ? 's' : ''} in port).</p>`;

      // 5c. Transport for Hire — roll for shipping jobs
      try {
          const { TransportHireSystem } = await import('../trading/transport-hire.js');
          const job = await TransportHireSystem.rollForJob(true);
          if (job && job.available) {
              const fee = TransportHireSystem.calculateFee(job.loads, distanceRemaining > 0 ? distanceRemaining : 500);
              state.voyageLogHtml.value += `<p><strong>📋 Shipping job available:</strong> ${job.loads} loads of ${job.cargoName}, max ${job.maxDistance} miles, fee ${fee} gp.</p>`;
              portActivity.activities.push(`Transport job offered: ${job.loads} loads ${job.cargoName} for ${fee} gp`);
          }
      } catch (e) {
          // TransportHireSystem may require game settings; silently skip
      }

      state.portActivities.push(portActivity);
      
      // 6. Handle Cargo Trading with Strategy
      const isFinalPort = legIndex === allLegs.length - 1;
      const remainingLegs = allLegs.slice(legIndex + 1);
      
      let cargoDistanceTraveled = 0;
      if (state.currentCargo.loads > 0 && state.currentCargo.purchaseLegIndex !== undefined) {
          for (let k = state.currentCargo.purchaseLegIndex; k <= legIndex; k++) {
              cargoDistanceTraveled += allLegs[k]?.distance || 0;
          }
      }
      
      // Selling decision
      if (state.currentCargo.loads > 0 && state.tradeMode === "speculation") {
          const distanceToNext = remainingLegs[0]?.distance || 0;
          const sellEval = TradingStrategy.evaluateSale({
              cargoType: state.currentCargo.type,
              loadsCurrent: state.currentCargo.loads,
              purchasePrice: state.currentCargo.purchasePrice,
              distanceTraveled: cargoDistanceTraveled,
              distanceToNextPort: distanceToNext,
              isFinalPort,
              remainingLegs
          });
          
          if (sellEval.shouldSell) {
              console.log(`[Voyage Trade] Selling: ${sellEval.reason}`);
              await this.attemptCargoSale(state, portId, portActivity, cargoDistanceTraveled);
          } else {
              console.log(`[Voyage Trade] Holding cargo: ${sellEval.reason}`);
              state.voyageLogHtml.value += `<p><em>📦 Holding ${state.currentCargo.loads} loads of ${CargoRegistry.get(state.currentCargo.type)?.name}: ${sellEval.reason}</em></p>`;
          }
      }
      
      // Buying decision  
      if (state.tradeMode === "speculation" && state.currentCargo.loads === 0 && !isFinalPort) {
          await this.attemptStrategicPurchase(state, portId, portActivity, legIndex, allLegs);
      }
  }

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
          crewQualityMod: state.crewQualityMod,
          captainCharisma: state.captain.chaScore
      });
      
      state.treasury = result.newTreasury;
      state.expenseTotal += result.totalPurchaseCost;
      
      if (state.breakdown) state.breakdown.cargo += result.totalPurchaseCost;

      if (result.loadsBought > 0) {
          console.log(`[Voyage Trade] Purchased ${result.loadsBought} loads of ${result.cargoType} for ${result.totalPurchaseCost} gp`);
          this.recordLedgerEntry(state, this.getCurrentDate(), `Purchased ${result.loadsBought} loads of ${CargoRegistry.get(result.cargoType)?.name || result.cargoType}`, 0, result.totalPurchaseCost);
          state.currentCargo = {
              type: result.cargoType,
              loads: result.loadsBought,
              purchasePrice: result.purchasePricePerLoad
          };
      }
  }

  async attemptStrategicPurchase(state, portId, portActivity, legIndex, allLegs) {
      const isOriginPort = legIndex === -1;
      const remainingLegs = isOriginPort ? allLegs : allLegs.slice(legIndex + 1);
      const bestSaleDistance = TradingStrategy.calculateBestSaleDistance(remainingLegs);
      
      // Get merchant offers to evaluate
      const port = PortRegistry.get(portId);
      const merchantResult = await CargoPurchasing.rollMerchantAvailability(port, state.captain.chaScore);
      
      const reactionNote = merchantResult.reactionAdj !== 0 ? ` + CHA: ${merchantResult.reactionAdj >= 0 ? '+' : ''}${merchantResult.reactionAdj}` : '';
      state.voyageLogHtml.value += `<p><strong>Merchants in ${port.name}:</strong> ${merchantResult.merchantCount} available (1d6: ${merchantResult.roll} + size: ${merchantResult.portSizeMod}${reactionNote}).</p>`;
      
      if (merchantResult.merchantCount === 0) {
          state.voyageLogHtml.value += `<p><em>No merchants available at ${port.name}.</em></p>`;
          return;
      }
      
      // Roll for cargo offer
      const cargoOffer = await CargoPurchasing.rollCargoOffer({
          portId,
          captainProficiencyScores: state.captainProficiencyScores,
          lieutenantSkills: state.lieutenantSkills,
          crewQualityMod: state.crewQualityMod
      });
      
      if (!cargoOffer) {
          state.voyageLogHtml.value += `<p><em>No cargo available at ${port.name}.</em></p>`;
          return;
      }
      
      // Log skill check results
      if (cargoOffer.appraisalResult) {
          const app = cargoOffer.appraisalResult;
          if (app.success) {
              state.voyageLogHtml.value += `<p><strong>Appraisal:</strong> SUCCESS (${app.roll} ≤ ${app.needed}) → +1 to goods quality.</p>`;
          } else if (app.roll % 2 === 1) {
              state.voyageLogHtml.value += `<p><strong>Appraisal:</strong> FAILED (${app.roll} > ${app.needed}, odd) → -1 to goods quality.</p>`;
          } else {
              state.voyageLogHtml.value += `<p><strong>Appraisal:</strong> FAILED (${app.roll} > ${app.needed}, even) → no penalty.</p>`;
          }
      }
      
      state.voyageLogHtml.value += `<p><strong>Available Cargo:</strong> ${cargoOffer.loadsAvailable} loads of ${cargoOffer.cargoName} @ ${cargoOffer.baseValue} gp/load base.</p>`;
      
      if (cargoOffer.bargainResult) {
          const barg = cargoOffer.bargainResult;
          if (barg.success) {
              state.voyageLogHtml.value += `<p><strong>Bargaining:</strong> SUCCESS (${barg.roll} ≤ ${barg.needed}) → ${Math.abs(cargoOffer.bargainAdjustPercent)}% discount.</p>`;
          } else {
              state.voyageLogHtml.value += `<p><strong>Bargaining:</strong> FAILED (${barg.roll} > ${barg.needed}) → +${cargoOffer.bargainAdjustPercent}% penalty.</p>`;
          }
      }
      
      state.voyageLogHtml.value += `<p><strong>Offered Price:</strong> ${cargoOffer.pricePerLoad} gp/load (${Math.round(cargoOffer.pricePerLoad / cargoOffer.baseValue * 100)}% of base).</p>`;
      
      // Evaluate with strategy
      const buyEval = TradingStrategy.evaluatePurchase({
          cargoType: cargoOffer.cargoType,
          pricePerLoad: cargoOffer.pricePerLoad,
          loadsAvailable: cargoOffer.loadsAvailable,
          shipCapacity: state.ship.cargoCapacity - state.currentCargo.loads,
          currentTreasury: state.treasury,
          distanceToNextPort: remainingLegs[0]?.distance || 0,
          distanceToFinalPort: bestSaleDistance,
          isOriginPort,
          isFinalPort: false,
          remainingLegs
      });
      
      const cargo = CargoRegistry.get(cargoOffer.cargoType);
      
      if (!buyEval.shouldBuy) {
          console.log(`[Voyage Trade] Skipping purchase: ${buyEval.reason}`);
          state.voyageLogHtml.value += `<p><em>💰 Declined ${cargo?.name || cargoOffer.cargoType}: ${buyEval.reason}</em></p>`;
          return;
      }
      
      // Proceed with purchase
      console.log(`[Voyage Trade] Buying: ${buyEval.reason}`);
      const loadsToBuy = Math.min(buyEval.maxLoads, cargoOffer.loadsAvailable);
      const totalCost = loadsToBuy * cargoOffer.pricePerLoad;
      
      state.treasury -= totalCost;
      state.expenseTotal += totalCost;
      if (state.breakdown) state.breakdown.cargo += totalCost;
      
      this.recordLedgerEntry(state, this.getCurrentDate(), `Purchased ${loadsToBuy} loads of ${cargo?.name || cargoOffer.cargoType}`, 0, totalCost);
      
      state.currentCargo = {
          type: cargoOffer.cargoType,
          loads: loadsToBuy,
          purchasePrice: cargoOffer.pricePerLoad,
          purchaseLegIndex: isOriginPort ? 0 : legIndex  // Track when cargo was bought
      };
      
      state.voyageLogHtml.value += `<p><strong>📦 Purchased:</strong> ${loadsToBuy} loads of ${cargo?.name} at ${cargoOffer.pricePerLoad} gp/load (${totalCost} gp total)</p>`;
      state.voyageLogHtml.value += `<p><em>Strategy: ${buyEval.reason}. Expected sale: ${buyEval.expectedSalePrice || '?'} gp/load (${buyEval.distanceBonus || 'varies'})</em></p>`;
      
      portActivity.activities.push(`Purchased ${loadsToBuy} loads of ${cargo?.name} for ${totalCost} gp`);
  }

  async attemptCargoSale(state, portId, portActivity, distanceTraveled) {
      // Perishability is now checked inside handleCargoSale after the distance roll
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
      
      // Handle case where all cargo spoiled
      if (result.spoiledAll) {
          state.currentCargo = { type: null, loads: 0, purchasePrice: 0 };
          return;
      }
      
      state.treasury = result.newTreasury;
      state.crewEarningsFromTrade = result.newCrewEarningsFromTrade;
      state.expenseTotal += result.taxAmount;
      
      if (state.breakdown) state.breakdown.taxes += result.taxAmount;
      
      if (result.totalSaleValueForOwner > 0) {
          state.revenueTotal += result.totalSaleValueForOwner; 
          this.recordLedgerEntry(state, this.getCurrentDate(), `Sold ${state.currentCargo.loads} loads of ${CargoRegistry.get(state.currentCargo.type)?.name || state.currentCargo.type}`, result.totalSaleValueForOwner, 0);
      }
      
      if (result.taxAmount > 0) {
          this.recordLedgerEntry(state, this.getCurrentDate(), `Customs tax at ${PortRegistry.get(portId).name}`, 0, result.taxAmount);
      }

      state.currentCargo = { type: null, loads: 0, purchasePrice: 0 };
  }

  async loadConsignmentCargo(state, portActivity) {
      state.currentCargo = {
          type: "consumer",
          loads: state.ship.cargoCapacity,
          purchasePrice: 0
      };
      const cargo = CargoRegistry.get("consumer");
      const totalRouteDistance = state.route.ports.reduce((total, port, index, ports) => {
          if (index === 0) return 0;
          const distance = PortRegistry.getDistance(ports[index - 1], port);
          return total + (distance || 0);
      }, 0);
      const tons = state.currentCargo.loads / 2;
      const segments = Math.ceil(totalRouteDistance / 500);
      const totalTransportFee = Math.max(tons * 40 * segments, 100);
      const upfrontPayment = Math.floor(totalTransportFee / 2);
      
      state.treasury += upfrontPayment;
      state.revenueTotal += upfrontPayment;
      
      this.recordLedgerEntry(state, this.getCurrentDate(), "Consignment Upfront Payment", upfrontPayment, 0);

      state.voyageLogHtml.value += `<p><strong>Consignment Load:</strong> ${cargo.name} (${state.currentCargo.loads} loads). Commission: ${state.commissionRate}%</p>`;
      state.voyageLogHtml.value += `<p><strong>Transport Fee (upfront payment):</strong> ${upfrontPayment} gp (${totalTransportFee} gp total for ${totalRouteDistance} miles, ${upfrontPayment} gp due on delivery)</p>`;
      portActivity.activities.push(`Loaded ${state.currentCargo.loads} loads of ${cargo.name} on consignment.`);
      portActivity.activities.push(`Received upfront transport payment: ${upfrontPayment} gp`);
  }

  async offerShipRepairs(state, port, portActivity) {
    const damage = state.ship.hullPoints.max - state.ship.hullPoints.value;
    if (damage === 0) return;
    
    if (!ShipRepairSystem.canRepairAtPort(port.size)) {
        state.voyageLogHtml.value += `<p><em>No repair facilities available at ${port.name} (Anchorage)</em></p>`;
        return;
    }

    // --- Qualified DIY repair crew per Seafaring + DMG ---
    const baseCrew = (state.currentCrew || []).reduce(
        (sum, group) => sum + (group.count || 0),
        0
    );
    const officerCrew =
        (state.officerCounts?.lieutenants || 0) +
        (state.officerCounts?.mates || 0) +
        1; // captain
    const totalCrew = baseCrew + officerCrew;

    const hasShipwright =
        !!state.captainProficiencyScores?.shipwright ||
        !!state.lieutenantSkills?.shipwright;
    const hasShipCarpentry =
        !!state.captainProficiencyScores?.shipCarpentry ||
        !!state.lieutenantSkills?.shipCarpentry;

    const hasQualifiedDIYRepairCrew =
        totalCrew >= 5 && (hasShipwright || hasShipCarpentry);
    // ------------------------------------------------------

    let repairChoice;
    if (state.automateTrading) {
        repairChoice = ShipRepairSystem.shouldAutoRepair(
            state.ship.hullPoints.value,
            state.ship.hullPoints.max,
            state.treasury
        );

        if (!repairChoice) {
            const damagePercent = Math.round((damage / state.ship.hullPoints.max) * 100);
            const repairCost = damage * 100;

            if (damagePercent < 10) {
            state.voyageLogHtml.value +=
                `<p><em>Ship damage is only ${damagePercent}%—repairs deferred (minor damage).</em></p>`;
            } else {
            state.voyageLogHtml.value +=
                `<p><em>Ship damage is ${damagePercent}% but repairs deferred (insufficient funds: need ${repairCost} gp).</em></p>`;
            }
        }
          } else {
                repairChoice = await ShipRepairSystem.offerRepairChoice(
                    state.ship.hullPoints.value,
                    state.ship.hullPoints.max,
                    state.treasury,
                    hasQualifiedDIYRepairCrew
                );
            }

        if (repairChoice) {
        state.treasury -= repairChoice.cost;
        state.expenseTotal += repairChoice.cost;
        state.ship.hullPoints.value = state.ship.hullPoints.max;

        if (state.breakdown) {
            state.breakdown.repairs = (state.breakdown.repairs || 0) + repairChoice.cost;
        }

        this.recordLedgerEntry(
            state,
            this.getCurrentDate(),
            `Ship repairs at ${port.name}`,
            0,
            repairChoice.cost
        );

        state.voyageLogHtml.value +=
            `<p><strong>Ship Repairs:</strong> Hull restored for ${repairChoice.cost} gp (${repairChoice.type}).</p>`;
        portActivity.activities.push(
            `Repaired ${damage} hull points (${repairChoice.type}): ${repairChoice.cost} gp`
        );
        }

  }    

  async offerCrewHiring(state, port, portActivity) {
    const requiredCrew = state.ship.crew; // Required crew from ship template
    const currentCrew = state.currentCrew; // Actual current crew (tracked separately)
    
    const shortfall = CrewHiringSystem.calculateShortfall(currentCrew, requiredCrew);
    
    if (Object.keys(shortfall).length === 0) return;
    
    if (!CrewHiringSystem.canHireAtPort(port.size, "small")) {
        state.voyageLogHtml.value += `<p><em>No crew available for hire at ${port.name}</em></p>`;
        return;
    }
    
    let hireChoice;
    if (state.automateTrading) {
        const shouldHire = CrewHiringSystem.shouldAutoHire(currentCrew, requiredCrew);
        if (shouldHire) {
            hireChoice = { hired: shortfall };
        }
    } else {
        hireChoice = await CrewHiringSystem.offerHiringChoice(shortfall, state.treasury);
    }
    
    if (hireChoice) {
        // Update current crew counts in state.currentCrew
        for (const [role, data] of Object.entries(hireChoice.hired)) {
            const crewMember = currentCrew.find(c => c.role === role);
            if (crewMember) {
                crewMember.count += data.needed;
            } else {
                currentCrew.push({ role, count: data.needed });
            }
        }
        
        state.voyageLogHtml.value += `<p><strong>Crew Hired:</strong> `;
        for (const [role, data] of Object.entries(hireChoice.hired)) {
            state.voyageLogHtml.value += `${data.needed} ${role}(s) @ ${data.cost} gp/month; `;
        }
        state.voyageLogHtml.value += `</p>`;
        
        portActivity.activities.push(`Hired replacement crew: ${JSON.stringify(hireChoice.hired)}`);
    }
}

  /** Get CTT API if available */
  _getCTT() {
      return game.modules?.get('calendar-time-tracker')?.api ?? null;
  }

  getCurrentDate() {
      // Priority 1: CTT module
      const ctt = this._getCTT();
      if (ctt) {
          const d = ctt.getCurrentDate();
          return d.fullDateTime || d.formatted || `${d.year}-${d.month}-${d.day}`;
      }
      // Priority 2: Weather module calendar
      if (globalThis.dndWeather?.weatherSystem?.calendarTracker) {
          return globalThis.dndWeather.weatherSystem.calendarTracker.getDateString();
      }
      if (globalThis.dndWeather?.weatherSystem?.currentWeather?.timestamp) {
          return globalThis.dndWeather.weatherSystem.currentWeather.timestamp;
      }
      return "Unknown Date";
  }

  advanceDay() {
      // Priority 1: CTT module
      const ctt = this._getCTT();
      if (ctt) {
          ctt.advanceTime(1, "day");
          return;
      }
      // Priority 2: Weather module calendar
      if (globalThis.dndWeather?.weatherSystem?.calendarTracker) {
          globalThis.dndWeather.weatherSystem.calendarTracker.advanceDay();
      }
  }

  advanceHours(hours) {
      const ctt = this._getCTT();
      if (ctt) {
          ctt.advanceTime(hours, "hour");
          return;
      }
      // Weather module has no hour-level advance; skip
  }

  async handleVoyageFailure(state) {
      await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ alias: "Voyage Simulator" }),
          content: `<h3>⚓ Voyage FAILED: ${state.ship.name} Sank</h3><p><strong>Captain:</strong> ${state.captain.name}</p><p><strong>Total Days:</strong> ${state.totalDays}</p><p><strong>Distance Sailed:</strong> ${state.totalDistance} miles</p>`
      });
  }

  async finalizeVoyage(state) {
      state.shipEndDate = this.getCurrentDate();
      
      if (state.legAccumulatedCost && state.legAccumulatedCost > 0) {
          this.recordLedgerEntry(state, state.shipEndDate, "Final Voyage expenses", 0, state.legAccumulatedCost);
          state.legAccumulatedCost = 0;
      }

      await ReportGenerator.createVoyageJournal(state);
      
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
          flags: { 'adnd-voyage-simulator': { voyageComplete: true } }
      });
      
      for (const [id, s] of this.activeVoyages.entries()) {
        if (s === state) { this.activeVoyages.delete(id); break; }
      }
      
      ui.notifications.info(`Voyage complete! Journal entry created.`);
  }

  // ==========================================================================
  // MANUAL MODE LOGIC
  // ==========================================================================

  async rollNextDay(voyageId, decisions = {}) {
    return this.simulateDay(voyageId, decisions);
  }

  async simulateDay(voyageId, decisions = {}) {
    const state = await VoyageSimulator.loadState(voyageId);
    if (!state || state.flags.finished) throw new Error("Voyage not found or already finished.");

    if (state.dailyOperationalCost) {
        state.expenseTotal += state.dailyOperationalCost;
        state.treasury -= state.dailyOperationalCost;
        state.legAccumulatedCost = (state.legAccumulatedCost || 0) + state.dailyOperationalCost;
        
        if (state.breakdown) {
            const foodRatio = 0.3;
            const dailyFood = Math.floor(state.dailyOperationalCost * foodRatio);
            state.breakdown.food += dailyFood;
            state.breakdown.wages += (state.dailyOperationalCost - dailyFood);
        }
    }

    const weather = await this._getOrRollWeatherForDay(state);

    const SAILING_HOURS = 10;
    let baseMiles;
    if (state.ship?.dailySail) {
        baseMiles = state.ship.dailySail;
    } else if (state.ship?.normalSail) {
        baseMiles = state.ship.normalSail * SAILING_HOURS;
    } else {
        baseMiles = (state.ship?.movement ?? 6) * (this.MILES_PER_INCH_DAILY ?? 24);
    } 
    const hullMax  = state.ship?.hullPoints?.max ?? 0;
    const hullVal  = state.ship?.hullPoints?.value ?? hullMax;
    const hullLost = Math.max(0, hullMax - hullVal);

    let hullPenaltyPct = 0;
    try {
      const { NavigationSystem } = await import("./navigation.js");
      hullPenaltyPct = NavigationSystem.calculateHullDamagePenalty?.(hullLost, hullMax)?.speedPenaltyPercent ?? 0;
    } catch {}

    const maintPenaltyPct = Number(state.maintenance?.speedPenalty ?? 0);
    const penalizedBase = Math.max(0, Math.floor(baseMiles * (100 - hullPenaltyPct - maintPenaltyPct) / 100));

    const speedInfo = this.calculateSailingSpeed(penalizedBase, weather);
    let milesToday = speedInfo.speed || 0;

    let navCheck = null;
    try {
      const { NavigationSystem } = await import("./navigation.js");
      navCheck = NavigationSystem.makeDailyNavigationCheck?.(state, weather) || null;
      if (navCheck?.milesLost) milesToday = Math.max(0, milesToday - navCheck.milesLost);
    } catch {}

    const hazards = [];
    try {
      const { NavigationSystem } = await import("./navigation.js");
      const inHazard = this._segmentIsHazard?.(state) || false;
      if (inHazard && milesToday > 0) {
        const checks = Math.floor(milesToday / 5);
        for (let i = 0; i < checks; i++) {
          const hz = await this._resolveHazardCheck(state, weather, NavigationSystem, decisions);
          hazards.push(hz);
          if (hz?.deadInWater) { milesToday = 0; break; }
        }
      }
    } catch {}

    const travel = this._advancePosition(state, milesToday);
    const arrived = travel?.arrivedPortId ?? null;

    await this._applyDayDecisions(state, decisions, arrived);

    state.maintenance.daysSinceService = (state.maintenance.daysSinceService ?? 0) + 1;

    // Process daily scurvy/morale/maintenance for manual mode
    const dateStr = this.getCurrentDate?.() || "Unknown";
    this._processScurvy(state, dateStr);
    this._processMorale(state, dateStr);
    this._evaluateMaintenance(state, dateStr);

    // Wind damage for manual mode
    const windDmgResults = await this._processWindDamage(state, weather, dateStr);
    for (const wd of windDmgResults) {
      if (wd.sank) hazards.push({ ...wd, deadInWater: true });
    }

    // Navigation check for manual mode (openWater only)
    if (!navCheck) {
        const segWaterType = state.currentSegmentWaterType || "coastal";
        if (segWaterType === "openWater" && milesToday > 0) {
            const moralePen = state.morale?.proficiencyPenalty || 0;
            navCheck = await this._rollNavigationCheck(state, weather, moralePen);
            if (navCheck?.failed) {
                const lost = Math.max(0, Math.floor(milesToday * navCheck.lostPercent / 100));
                milesToday = Math.max(0, milesToday - lost);
                navCheck.milesLost = lost;
            }
        }
    }

    const result = {
      day: state.day + 1,
      weather, speedInfo, navCheck,
      miles: milesToday,
      hazards,
      arrivedPortId: arrived,
      notes: speedInfo.note || "",
    };

    state.day++;
    state.log.push(result);
    await VoyageSimulator.saveState(state.id, state);

    return { state, result };
  }

  async _getOrRollWeatherForDay(state) {
    try {
      const { WeatherSystem } = await import("./weather.js");
      return await WeatherSystem.generateDayWeather();
    } catch {
      return { wind:{speed: 10, direction:"N"}, precipitation:{type:"none",duration:0}, sky:"clear", temperature:{high:70,low:55} };
    }
  }

  _segmentIsHazard(state) {
    return !!state?.routeSegmentHazard;
  }

  async _resolveHazardCheck(state, weather, NavigationSystem, decisions) {
    const haz = NavigationSystem.assessWeatherHazard?.(weather);
    if (!haz || haz.severity === "NONE") return { severity: "NONE" };
    const pilotRoll = NavigationSystem.makePilotingCheck?.(state, haz, decisions?.pilotMods ?? 0);
    const dmg = NavigationSystem.calculateHazardDamage?.(haz.type, haz.severity, pilotRoll?.missBy ?? 0);
    if (dmg?.hull) {
      state.ship.hullPoints.value = Math.max(0, state.ship.hullPoints.value - dmg.hull);
    }
    return { ...haz, pilotRoll, dmg, deadInWater: dmg?.deadInWater || false };
  }

  _advancePosition(state, milesToday) {
    state.position.milesOnSegment += milesToday;
    return { arrivedPortId: null };
  }

  async _applyDayDecisions(state, decisions, arrivedPortId) {
    if (decisions?.heaveTo) return;
    if (arrivedPortId && decisions?.autoTradeDays) {
      try {
        const { CargoSelling } = await import("../trading/cargo-sell.js");
      } catch {}
    }
  }
}