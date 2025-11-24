/**
 * Trading Strategy System
 * Smart automation for cargo trading decisions
 * 
 * Strategy based on AD&D Seafaring rules:
 * - Distance bonuses: <80mi (-1), ≤250mi (0), ≤500mi (+2), >500mi (+4 guaranteed)
 * - Higher value cargo = higher absolute profit potential
 * - Waiting costs ~120 gp/week (anchor + crew)
 * - Bargaining discount (up to 25%) usually beats waiting
 */

import { CargoRegistry } from '../data/cargo.js';
import { PortRegistry } from '../data/ports.js';

export class TradingStrategy {

    /**
     * Evaluate whether to buy cargo at current port
     * @param {Object} params - Trading context
     * @returns {Object} { shouldBuy, reason, maxLoads, expectedProfit }
     */
    static evaluatePurchase(params) {
        const {
            cargoType,
            pricePerLoad,
            loadsAvailable,
            shipCapacity,
            currentTreasury,
            distanceToNextPort,
            distanceToFinalPort,
            isOriginPort,
            isFinalPort,
            remainingLegs
        } = params;

        const cargo = CargoRegistry.get(cargoType);
        const baseValue = cargo.baseValue;

        // RULE 1: Never buy at final port - nowhere to sell
        if (isFinalPort) {
            return {
                shouldBuy: false,
                reason: "Final port - no destination to sell cargo",
                maxLoads: 0,
                expectedProfit: 0
            };
        }

        // Calculate best possible sale distance (farthest port we can reach)
        const bestSaleDistance = this.calculateBestSaleDistance(remainingLegs);
        const distanceBonus = this.getDistanceBonus(bestSaleDistance);

        // RULE 2: Evaluate profitability
        const expectedSalePercent = this.estimateSalePercent(distanceBonus);
        const expectedSalePrice = Math.floor(baseValue * expectedSalePercent / 100);
        const expectedProfitPerLoad = expectedSalePrice - pricePerLoad;

        // RULE 3: Skip bad deals - don't buy if price > 110% of base
        const priceRatio = pricePerLoad / baseValue;
        if (priceRatio > 1.10 && expectedProfitPerLoad < 0) {
            return {
                shouldBuy: false,
                reason: `Price too high (${Math.round(priceRatio * 100)}% of base) with low profit potential`,
                maxLoads: 0,
                expectedProfit: 0,
                priceRatio
            };
        }

        // RULE 4: Prioritize long-distance trades
        if (bestSaleDistance > 500) {
            // Guaranteed +4 bonus - almost always profitable
            const maxAffordable = Math.floor(currentTreasury * 0.8 / pricePerLoad); // Keep 20% reserve
            const maxLoads = Math.min(shipCapacity, loadsAvailable, maxAffordable);
            
            return {
                shouldBuy: true,
                reason: `Excellent trade: ${bestSaleDistance} mi to sale (+4 bonus guaranteed)`,
                maxLoads,
                expectedProfit: expectedProfitPerLoad * maxLoads,
                expectedSalePrice,
                distanceBonus: "+4 (Extraordinary)"
            };
        }

        // RULE 5: Short distance trades - be cautious
        if (bestSaleDistance < 250) {
            // Only buy if price is very good (discount)
            if (priceRatio <= 0.85) {
                const maxAffordable = Math.floor(currentTreasury * 0.5 / pricePerLoad);
                const maxLoads = Math.min(shipCapacity, loadsAvailable, maxAffordable);
                
                return {
                    shouldBuy: true,
                    reason: `Good discount (${Math.round(priceRatio * 100)}%) offsets short distance`,
                    maxLoads,
                    expectedProfit: expectedProfitPerLoad * maxLoads,
                    expectedSalePrice,
                    distanceBonus: bestSaleDistance < 80 ? "-1 (Short)" : "0 (Medium)"
                };
            }
            
            return {
                shouldBuy: false,
                reason: `Short distance (${bestSaleDistance} mi) with no discount - likely loss`,
                maxLoads: 0,
                expectedProfit: expectedProfitPerLoad,
                distanceBonus: bestSaleDistance < 80 ? "-1 (Short)" : "0 (Medium)"
            };
        }

        // RULE 6: Medium distance (250-500 mi) - buy if price is reasonable
        if (priceRatio <= 1.0 || expectedProfitPerLoad > 0) {
            const maxAffordable = Math.floor(currentTreasury * 0.7 / pricePerLoad);
            const maxLoads = Math.min(shipCapacity, loadsAvailable, maxAffordable);
            
            return {
                shouldBuy: true,
                reason: `Medium distance trade (${bestSaleDistance} mi), reasonable price`,
                maxLoads,
                expectedProfit: expectedProfitPerLoad * maxLoads,
                expectedSalePrice,
                distanceBonus: "0 to +2 (Medium/Long)"
            };
        }

        return {
            shouldBuy: false,
            reason: `Price too high (${Math.round(priceRatio * 100)}%) for medium distance`,
            maxLoads: 0,
            expectedProfit: expectedProfitPerLoad
        };
    }

    /**
     * Evaluate whether to sell cargo at current port
     * @param {Object} params - Trading context
     * @returns {Object} { shouldSell, reason }
     */
    static evaluateSale(params) {
        const {
            cargoType,
            loadsCurrent,
            purchasePrice,
            distanceTraveled,
            distanceToNextPort,
            isFinalPort,
            remainingLegs
        } = params;

        // RULE 1: Always sell at final port
        if (isFinalPort) {
            return {
                shouldSell: true,
                reason: "Final port - must sell remaining cargo"
            };
        }

        // RULE 2: Check if holding for longer distance is better
        const currentDistanceBonus = this.getDistanceBonus(distanceTraveled);
        
        // Calculate potential bonus if we hold to next port
        const futureDistance = distanceTraveled + distanceToNextPort;
        const futureDistanceBonus = this.getDistanceBonus(futureDistance);

        // If we can get +4 by waiting, hold the cargo
        if (currentDistanceBonus < 4 && futureDistanceBonus >= 4) {
            return {
                shouldSell: false,
                reason: `Hold cargo: current bonus +${currentDistanceBonus}, next port bonus +${futureDistanceBonus}`,
                currentBonus: currentDistanceBonus,
                futureBonus: futureDistanceBonus
            };
        }

        // If current bonus is +2 or better, sell
        if (currentDistanceBonus >= 2) {
            return {
                shouldSell: true,
                reason: `Good distance bonus (+${currentDistanceBonus}) - sell now`,
                currentBonus: currentDistanceBonus
            };
        }

        // If we're at +0 or less, check if we can do better
        if (futureDistanceBonus > currentDistanceBonus + 1) {
            return {
                shouldSell: false,
                reason: `Hold for better price: +${currentDistanceBonus} now vs +${futureDistanceBonus} at next port`,
                currentBonus: currentDistanceBonus,
                futureBonus: futureDistanceBonus
            };
        }

        // Default: sell to free up cargo space
        return {
            shouldSell: true,
            reason: `Sell to free cargo hold (bonus: +${currentDistanceBonus})`,
            currentBonus: currentDistanceBonus
        };
    }

    /**
     * Evaluate whether waiting for more merchants is worth it
     * @param {Object} params - Context
     * @returns {Object} { shouldWait, reason, weeksToWait }
     */
    static evaluateWaiting(params) {
        const {
            currentMerchants,
            cargoTypeAvailable,
            pricePerLoad,
            weeklyWaitCost,  // moorage + crew
            shipCapacity
        } = params;

        const cargo = CargoRegistry.get(cargoTypeAvailable);
        const baseValue = cargo.baseValue;
        const priceRatio = pricePerLoad / baseValue;

        // Week 2 brings 25% more merchants with different cargo
        const expectedMerchantsWeek2 = Math.ceil(currentMerchants / 4);

        // Not worth waiting if:
        // 1. Current cargo is good (Fine or Precious at good price)
        // 2. Wait cost exceeds potential savings
        // 3. Already have good merchants

        if (cargo.baseValue >= 400 && priceRatio <= 1.0) {
            return {
                shouldWait: false,
                reason: "Good cargo already available at fair price",
                weeksToWait: 0
            };
        }

        // Calculate potential benefit of waiting
        // Assume 30% chance of better cargo type, 20% chance of better price
        const potentialSavings = baseValue * 0.15 * shipCapacity; // ~15% improvement
        
        if (potentialSavings > weeklyWaitCost * 1.5) {
            return {
                shouldWait: true,
                reason: `Potential savings (${potentialSavings} gp) exceed wait cost (${weeklyWaitCost} gp)`,
                weeksToWait: 1
            };
        }

        return {
            shouldWait: false,
            reason: `Wait cost (${weeklyWaitCost} gp) too high for uncertain benefit`,
            weeksToWait: 0
        };
    }

    /**
     * Calculate the best sale distance considering all remaining legs
     */
    static calculateBestSaleDistance(remainingLegs) {
        if (!remainingLegs || remainingLegs.length === 0) return 0;
        
        let cumulativeDistance = 0;
        let bestDistance = 0;
        
        for (const leg of remainingLegs) {
            cumulativeDistance += leg.distance;
            // We can sell at any port along the way
            if (cumulativeDistance > bestDistance) {
                bestDistance = cumulativeDistance;
            }
            // If we hit 500+, that's the best we can get (guaranteed +4)
            if (cumulativeDistance > 500) {
                return cumulativeDistance;
            }
        }
        
        return bestDistance;
    }

    /**
     * Get distance bonus for sale price
     */
    static getDistanceBonus(distance) {
        if (distance > 500) return 4;  // Extraordinary
        if (distance > 250) return 2;  // Long (d6=6 territory)
        if (distance > 80) return 0;   // Medium
        return -1;                      // Short
    }

    /**
     * Estimate sale percentage based on distance bonus
     * Conservative estimate assuming average rolls
     */
    static estimateSalePercent(distanceBonus) {
        // Base SA roll averages 10.5 (3d6)
        // Add distance bonus
        // Average demand ~0
        // Result: 10-11 range = 100-110%
        const estimatedSA = 10 + distanceBonus;
        return CargoRegistry.getSaleAdjustment(estimatedSA);
    }

    /**
     * Rank cargo types by profit potential
     */
    static rankCargoByProfit(cargoType, pricePerLoad, distanceBonus) {
        const cargo = CargoRegistry.get(cargoType);
        const baseValue = cargo.baseValue;
        const expectedSalePercent = this.estimateSalePercent(distanceBonus);
        const expectedSalePrice = Math.floor(baseValue * expectedSalePercent / 100);
        const profit = expectedSalePrice - pricePerLoad;
        const profitMargin = profit / pricePerLoad;

        return {
            cargoType,
            baseValue,
            pricePerLoad,
            expectedSalePrice,
            profit,
            profitMargin,
            // Higher value cargo with positive margin is best
            score: profit > 0 ? baseValue * profitMargin : profit
        };
    }

    /**
     * Generate trading advice for the captain
     */
    static generateAdvice(params) {
        const {
            currentPort,
            nextPort,
            finalPort,
            distanceToNext,
            totalRemainingDistance,
            cargoType,
            pricePerLoad,
            currentTreasury,
            holdingCargo
        } = params;

        const advice = [];

        if (totalRemainingDistance > 500) {
            advice.push("📈 Long voyage ahead - prioritize buying high-value cargo for +4 distance bonus.");
        }

        if (distanceToNext < 250 && !holdingCargo) {
            advice.push("⚠️ Short leg ahead - consider skipping purchase or holding for longer trade.");
        }

        if (holdingCargo && totalRemainingDistance > 500) {
            advice.push("📦 Consider holding cargo for maximum distance bonus at final ports.");
        }

        const cargo = CargoRegistry.get(cargoType);
        if (cargo && pricePerLoad > cargo.baseValue * 1.1) {
            advice.push(`💰 Price is ${Math.round(pricePerLoad / cargo.baseValue * 100)}% of base - consider waiting or skipping.`);
        }

        if (currentTreasury < 1000) {
            advice.push("⚠️ Low funds - prioritize safe trades over risky high-value cargo.");
        }

        return advice;
    }
}