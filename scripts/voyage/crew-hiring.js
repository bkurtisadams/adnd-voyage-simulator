/**
 * Crew Hiring System
 * Handles hiring replacement crew per DMG rules
 */

export class CrewHiringSystem {

    /**
     * Crew types and their costs (monthly wages from DMG)
     */
    static CREW_TYPES = {
        sailor: { name: "Sailor", cost: 2, hp: 4 },
        oarsman: { name: "Oarsman", cost: 5, hp: 5 },
        marine: { name: "Marine", cost: 3, hp: 4 },
        mate: { name: "Mate", cost: 30, hp: 6 },
        lieutenant: { name: "Lieutenant", costPerLevel: 100, hp: 8 }
    };

    /**
     * Check if crew hiring is available at this port
     * Rules: "Even in a small fishing village" for small ships
     */
    static canHireAtPort(portSize, shipSize) {
        // Small ships can hire anywhere
        // Larger ships need Minor Port or better
        if (shipSize === "small") return true;
        return ["Minor Port", "Port", "Major Port"].includes(portSize);
    }

    /**
     * Calculate crew shortfall
     */
    static calculateShortfall(currentCrew, requiredCrew) {
        const shortfall = {};
        
        for (const crewRole of requiredCrew) {
            const current = currentCrew.find(c => c.role === crewRole.role);
            const currentCount = current ? current.count : 0;
            const needed = crewRole.count - currentCount;
            
            if (needed > 0) {
                shortfall[crewRole.role] = {
                    needed,
                    cost: this.CREW_TYPES[crewRole.role]?.cost || 0
                };
            }
        }
        
        return shortfall;
    }

    /**
     * Present hiring dialog (manual mode)
     */
    static async offerHiringChoice(shortfall, treasury) {
        if (Object.keys(shortfall).length === 0) return null;

        let content = `
            <div class="crew-hiring">
                <h3>Crew Available for Hire</h3>
                <p>Monthly wages (prorated to voyage duration):</p>
                <table>
                    <tr><th>Role</th><th>Needed</th><th>Wage/Month</th><th>Total</th></tr>
        `;

        let totalCost = 0;
        for (const [role, data] of Object.entries(shortfall)) {
            const monthlyCost = data.cost * data.needed;
            totalCost += monthlyCost;
            content += `<tr>
                <td>${role}</td>
                <td>${data.needed}</td>
                <td>${data.cost} gp</td>
                <td>${monthlyCost} gp/month</td>
            </tr>`;
        }

        content += `</table>
            <p><strong>Note:</strong> Wages paid at voyage end based on actual duration.</p>
            <p><strong>Treasury:</strong> ${treasury} gp</p>
        </div>`;

        const canAfford = true; // Wages paid later, so always "can afford"

        return new Promise((resolve) => {
            new Dialog({
                title: "Hire Crew",
                content: content,
                buttons: {
                    hire: {
                        label: "Hire Full Crew",
                        callback: () => resolve({ hired: shortfall, totalMonthlyWages: totalCost })
                    },
                    skip: {
                        label: "Sail Short-Handed",
                        callback: () => resolve(null)
                    }
                },
                default: "hire"
            }).render(true);
        });
    }

    /**
     * Auto-decision for hiring (automation mode)
     * Rules: Always hire if shortfall > 20% of required crew
     */
    static shouldAutoHire(currentCrew, requiredCrew) {
        const currentTotal = currentCrew.reduce((sum, c) => sum + c.count, 0);
        const requiredTotal = requiredCrew.reduce((sum, c) => sum + c.count, 0);
        const shortfallPercent = ((requiredTotal - currentTotal) / requiredTotal) * 100;
        
        if (shortfallPercent > 20) {
            return this.calculateShortfall(currentCrew, requiredCrew);
        }
        
        return null;
    }

    /**
     * Apply hired crew to ship
     */
    static applyHiredCrew(currentCrew, hired) {
        for (const [role, data] of Object.entries(hired)) {
            const crewMember = currentCrew.find(c => c.role === role);
            if (crewMember) {
                crewMember.count += data.needed;
            }
        }
    }
}