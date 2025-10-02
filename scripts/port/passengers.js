/**
 * Passenger Booking System
 * Handles passenger revenue and charter opportunities
 */

import { PortRegistry } from '../data/ports.js';

export class PassengerBooking {

    /**
     * Handle passenger booking at a port
     */
    static async handlePassengerBooking(params) {
        const {
            portId,
            currentTreasury,
            currentPortActivity,
            voyageLogHtmlRef,
            passengerManifest,
            routeLegs,
            currentLegIndex,
            automateTrading
        } = params;

        const portName = PortRegistry.get(portId).name;
        const portSizeMod = PortRegistry.getSizeModifier(PortRegistry.get(portId).size);
        let revenueEarned = 0;
        let newTreasury = currentTreasury;

        // Regular passengers seeking passage
        const passRoll1 = new Roll("2d4");
        const passRoll2 = new Roll("1d4");
        await passRoll1.evaluate();
        await passRoll2.evaluate();

        let regularPassengers = Math.max(0, passRoll1.total - passRoll2.total + portSizeMod);

        if (regularPassengers > 0) {
            // Calculate remaining distance
            let remainingDistance = 0;
            for (let j = currentLegIndex; j < routeLegs.length; j++) {
                remainingDistance += routeLegs[j].distance;
            }

            if (remainingDistance > 0) {
                const passengerRevenue = this.calculatePassengerRevenue(regularPassengers, remainingDistance);
                revenueEarned += passengerRevenue;
                newTreasury += passengerRevenue;

                passengerManifest.push({
                    type: "regular",
                    count: regularPassengers,
                    origin: portName,
                    destination: "End of Route",
                    distance: remainingDistance,
                    revenue: passengerRevenue
                });

                currentPortActivity.activities.push(`Boarded ${regularPassengers} regular passengers.`);
                voyageLogHtmlRef.value += `<p><strong>Passengers at ${portName}:</strong> ${regularPassengers} passengers @ ${passengerRevenue} gp total (${remainingDistance} miles)</p>`;
            }
        }

        // Charter opportunity (5% chance)
        const charterRoll = new Roll("1d100");
        await charterRoll.evaluate();

        if (charterRoll.total <= 5) {
            const charterResult = await this.offerCharterOpportunity(portName, automateTrading);
            
            if (charterResult.accepted) {
                revenueEarned += charterResult.fee;
                newTreasury += charterResult.fee;

                passengerManifest.push({
                    type: "charter",
                    count: 1,
                    origin: portName,
                    destination: "Charter Destination",
                    distance: charterResult.distance,
                    revenue: charterResult.fee
                });

                currentPortActivity.activities.push(`CHARTER: ${charterResult.distance} miles for ${charterResult.fee} gp`);
                voyageLogHtmlRef.value += `<p><strong>CHARTER VOYAGE:</strong> ${charterResult.distance} miles @ ${charterResult.fee} gp</p>`;
            }
        }

        return {
            newTreasury: newTreasury,
            revenueEarned: revenueEarned
        };
    }

    /**
     * Calculate passenger revenue (20 gp per 500 miles)
     */
    static calculatePassengerRevenue(passengers, distance) {
        const segments = Math.ceil(distance / 500);
        return passengers * 20 * segments;
    }

    /**
     * Offer charter opportunity
     */
    static async offerCharterOpportunity(portName, automateTrading) {
        const distanceRoll = new Roll("2d20");
        await distanceRoll.evaluate();
        const distance = distanceRoll.total * 100;

        // Calculate charter fee (40 gp per ton per 500 miles, min 100 gp)
        const segments = Math.ceil(distance / 500);
        const fee = Math.max(100, 40 * segments); // Simplified, would use actual ship tonnage

        if (automateTrading) {
            return { accepted: true, distance: distance, fee: fee };
        }

        return new Promise((resolve) => {
            new Dialog({
                title: `Charter Opportunity - ${portName}`,
                content: `
                    <p>Passengers wish to charter the entire vessel!</p>
                    <p><strong>Destination:</strong> ${distance} miles away</p>
                    <p><strong>Charter Fee:</strong> ${fee} gp</p>
                    <p>Accept this charter?</p>
                `,
                buttons: {
                    accept: {
                        label: "Accept Charter",
                        callback: () => resolve({ accepted: true, distance: distance, fee: fee })
                    },
                    decline: {
                        label: "Decline",
                        callback: () => resolve({ accepted: false, distance: 0, fee: 0 })
                    }
                },
                default: "decline"
            }).render(true);
        });
    }
}