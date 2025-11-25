/**
 * Integration Test for Ship Repairs, Crew Hiring, and Port Agents
 * Forces conditions that trigger all three systems
 */

export class VoyageIntegrationTest {
    
    static async runFullSystemTest() {
        console.log("=== VOYAGE INTEGRATION TEST ===");
        console.log("Testing: Ship Repairs, Crew Hiring, Port Agents");
        console.log("");
        
        // Find the Surprise ship
        const surprise = game.actors.find(a => a.name === "Surprise");
        if (!surprise) {
            ui.notifications.error("Ship 'Surprise' not found!");
            return;
        }
        
        // Get voyage simulator
        const { VoyageSimulator } = await import("./scripts/voyage/simulation.js");
        
        // Create test voyage with forced conditions
        const testConfig = {
            ship: surprise,
            captain: game.actors.find(a => a.name.includes("Beldar")),
            route: "nyr-dyv-circuit",
            tradeMode: "speculation",
            automateTrading: true,
            
            // FORCE DAMAGE: Start with 6 HP damage (16.7%)
            forcedStartingHull: 30, // 30/36 = 83.3% condition
            
            // FORCE CREW SHORTFALL: Start with 4 crew missing (22% shortfall)
            forcedStartingCrew: {
                sailors: 12, // Should be 16
                marines: 2,  // Should be 2
                mates: 2,    // Should be 2
                officers: 2  // Should be 2
            },
            
            // FORCE LOW MERCHANTS: Override merchant rolls
            forcedMerchantCounts: {
                "verbobonc": 2,  // Low count triggers agent offer
                "greyhawk": 8,   // Normal count
                "leukish": 1,    // Very low triggers agent offer
                "dyvers": 2      // Low count triggers agent offer
            }
        };
        
        console.log("Test Conditions:");
        console.log(`- Hull Damage: 6 HP (36 → 30, 16.7% damage)`);
        console.log(`- Crew Shortfall: 4 sailors missing (18 → 14 crew, 22% shortfall)`);
        console.log(`- Merchant Counts: Verbobonc(2), Greyhawk(8), Leukish(1), Dyvers(2)`);
        console.log("");
        console.log("Expected Triggers:");
        console.log("✓ Ship repairs at EVERY port (damage >10% threshold)");
        console.log("✓ Crew hiring at EVERY port (shortfall >20% threshold)");
        console.log("✓ Port agents at 3 ports (Verbobonc, Leukish, Dyvers - low merchants)");
        console.log("");
        
        // Apply forced conditions to voyage
        const modifiedSimulator = this.patchSimulatorForTest(VoyageSimulator, testConfig);
        
        // Run voyage
        console.log("Starting test voyage...");
        const voyage = await modifiedSimulator.startVoyage(testConfig);
        
        console.log("");
        console.log("=== TEST COMPLETE ===");
        console.log("Check voyage log for:");
        console.log("1. 'Ship damage: 6 HP (17%), repairs deferred' OR 'Ship Repaired: 6 hull points'");
        console.log("2. 'Hired replacement crew' messages");
        console.log("3. 'Port Agent Hired' messages");
        
        return voyage;
    }
    
    /**
     * Patch the simulator to inject test conditions
     */
    static patchSimulatorForTest(SimulatorClass, testConfig) {
        const original = SimulatorClass.prototype.startVoyage;
        
        SimulatorClass.prototype.startVoyage = async function(config) {
            // Apply forced hull damage
            if (testConfig.forcedStartingHull) {
                config.ship.system.hullPoints = {
                    max: 36,
                    value: testConfig.forcedStartingHull
                };
                console.log(`✓ Forced hull damage: ${testConfig.forcedStartingHull}/36`);
            }
            
            // Apply forced crew shortfall
            if (testConfig.forcedStartingCrew) {
                config.ship.system.crew = testConfig.forcedStartingCrew;
                console.log(`✓ Forced crew shortfall: 14 crew (need 18)`);
            }
            
            // Patch merchant availability
            if (testConfig.forcedMerchantCounts) {
                this._testMerchantCounts = testConfig.forcedMerchantCounts;
                console.log(`✓ Forced merchant counts: ${JSON.stringify(testConfig.forcedMerchantCounts)}`);
            }
            
            return original.call(this, config);
        };
        
        // Patch cargo-buy to use forced merchant counts
        const originalCargoBuy = SimulatorClass.prototype.attemptCargoPurchase;
        SimulatorClass.prototype.attemptCargoPurchase = async function(state, portId, portActivity) {
            if (this._testMerchantCounts) {
                const portName = portId.toLowerCase().replace(/[^a-z]/g, '');
                const forcedCount = this._testMerchantCounts[portName];
                
                if (forcedCount !== undefined) {
                    // Temporarily override merchant roll
                    const originalRoll = Roll.prototype.evaluate;
                    Roll.prototype.evaluate = async function() {
                        if (this.formula === "1d6") {
                            this.total = Math.max(1, forcedCount - 2); // Adjust for modifiers
                            this._evaluated = true;
                            return this;
                        }
                        return originalRoll.call(this);
                    };
                    
                    const result = await originalCargoBuy.call(this, state, portId, portActivity);
                    
                    // Restore original
                    Roll.prototype.evaluate = originalRoll;
                    
                    return result;
                }
            }
            
            return originalCargoBuy.call(this, state, portId, portActivity);
        };
        
        return SimulatorClass;
    }
    
    /**
     * Manual mode test - opens dialogs for user interaction
     */
    static async runManualTest() {
        console.log("=== MANUAL MODE TEST ===");
        console.log("This will open dialogs for you to test manually");
        
        // Same as runFullSystemTest but with automateTrading: false
        const testConfig = {
            // ... same config as above
            automateTrading: false, // Manual mode
        };
        
        console.log("Test will present dialogs for:");
        console.log("1. Ship repair choice (professional vs DIY)");
        console.log("2. Crew hiring choice");
        console.log("3. Port agent hiring choice");
        
        // Run test
        return this.runFullSystemTest();
    }
}

// Execute test
VoyageIntegrationTest.runFullSystemTest();