/**
 * Merchant Timing System
 * Implements staggered merchant availability per "Oops, I'm at Sea" rules
 * 
 * Rules:
 * - Week 1: Half of total merchants available
 * - Week 2: Quarter of total merchants available
 * - Week 3+: One merchant per week
 */

export class MerchantTimingSystem {

    /**
     * Calculate total merchants at port (same as before)
     */
    static rollTotalMerchants(portSize, charisma) {
        const portSizeMod = this.getPortSizeModifier(portSize);
        const reactionAdj = this.getReactionAdjustment(charisma);
        
        const roll = new Roll("1d6");
        roll.evaluate({ async: false });
        
        const total = Math.max(1, roll.total + portSizeMod + reactionAdj);
        
        return {
            total,
            roll: roll.total,
            portSizeMod,
            reactionAdj
        };
    }

    /**
     * Calculate merchants available this week
     */
    static getMerchantsThisWeek(totalMerchants, weekNumber) {
        if (weekNumber === 1) {
            // Week 1: Half available
            return Math.max(1, Math.floor(totalMerchants / 2));
        } else if (weekNumber === 2) {
            // Week 2: Quarter available
            return Math.max(1, Math.floor(totalMerchants / 4));
        } else {
            // Week 3+: One per week
            return 1;
        }
    }

    /**
     * Calculate cumulative merchants available after X weeks
     */
    static getCumulativeMerchants(totalMerchants, weeksInPort) {
        let cumulative = 0;
        
        for (let week = 1; week <= weeksInPort; week++) {
            cumulative += this.getMerchantsThisWeek(totalMerchants, week);
            if (cumulative >= totalMerchants) {
                cumulative = totalMerchants;
                break;
            }
        }
        
        return cumulative;
    }

    /**
     * Offer "wait for more merchants" choice (manual mode)
     */
    static async offerWaitChoice(totalMerchants, currentWeek, merchantsSoFar, daysInPort) {
        const merchantsThisWeek = this.getMerchantsThisWeek(totalMerchants, currentWeek);
        const remainingMerchants = totalMerchants - merchantsSoFar;
        
        if (remainingMerchants <= 0) {
            // All merchants seen
            return false;
        }

        const nextWeekMerchants = this.getMerchantsThisWeek(totalMerchants, currentWeek + 1);
        const daysToWait = 7 - (daysInPort % 7);

        let content = `
            <div class="merchant-wait">
                <h3>Merchant Availability</h3>
                <p><strong>Total Merchants at Port:</strong> ${totalMerchants}</p>
                <p><strong>Merchants Seen So Far:</strong> ${merchantsSoFar}</p>
                <p><strong>Remaining:</strong> ${remainingMerchants}</p>
                <p><strong>Days in Port:</strong> ${daysInPort}</p>
                
                <hr>
                
                <p><strong>Wait ${daysToWait} more days for next week?</strong></p>
                <p>Next week will have ~${Math.min(nextWeekMerchants, remainingMerchants)} more merchants available.</p>
                <p><em>Note: Waiting costs time (crew wages, moorage fees) but may offer better cargo opportunities.</em></p>
            </div>
        `;

        return new Promise((resolve) => {
            new Dialog({
                title: "Wait for More Merchants?",
                content: content,
                buttons: {
                    wait: {
                        label: `Wait ${daysToWait} Days`,
                        callback: () => resolve(true)
                    },
                    sail: {
                        label: "Depart Now",
                        callback: () => resolve(false)
                    }
                },
                default: "sail"
            }).render(true);
        });
    }

    /**
     * Auto-decision for waiting (automation mode)
     * Rules: Wait if:
     * - Less than 3 merchants seen
     * - Haven't been in port more than 2 weeks
     * - More merchants remain
     */
    static shouldAutoWait(totalMerchants, currentWeek, merchantsSoFar) {
        if (merchantsSoFar >= 3) return false; // Saw enough
        if (currentWeek >= 3) return false; // Been here too long
        if (merchantsSoFar >= totalMerchants) return false; // Saw them all
        
        return true;
    }

    /**
     * Helper: Port size modifier for merchant rolls
     */
    static getPortSizeModifier(portSize) {
        const mods = {
            "Anchorage": -2,
            "Minor Port": 0,
            "Port": 1,
            "Major Port": 2
        };
        return mods[portSize] || 0;
    }

    /**
     * Helper: CHA reaction adjustment
     */
    static getReactionAdjustment(chaScore) {
        if (chaScore <= 5) return -2;
        if (chaScore <= 8) return -1;
        if (chaScore <= 13) return 0;
        if (chaScore <= 15) return 1;
        if (chaScore <= 17) return 2;
        return 3; // 18+
    }
}