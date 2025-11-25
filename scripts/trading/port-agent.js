/**
 * Port Agent System
 * Middlemen for cargo transactions
 */

export class PortAgentSystem {

    /**
     * Check if port agents are available at this port
     */
    static isAvailable(portSize) {
        if (!game.settings.get("adnd-voyage-simulator", "portAgentsEnabled")) return false;
        // Available at Minor Port or larger (not Anchorage)
        return ["Minor Port", "Port", "Major Port"].includes(portSize);
    }

    /**
     * Generate a port agent's skills and fee
     */
    static async generateAgent() {
        // Skills: 10 + d8 + d4 - 1 (range 11-21)
        const skillRoll = new Roll("10 + 1d8 + 1d4 - 1");
        await skillRoll.evaluate();
        const skillScore = skillRoll.total;

        // Fee: 2d10 + 5% (range 7-25%)
        const feeRoll = new Roll("2d10 + 5");
        await feeRoll.evaluate();
        const feePercent = feeRoll.total;

        return {
            skillScore,
            feePercent,
            proficiencyScores: {
                bargaining: skillScore,
                appraisal: skillScore,
                trade: null,
                smuggling: null,
                customsInspection: null
            }
        };
    }

    /**
     * Determine if automation should use a port agent
     */
    static shouldAutoHire(captainProficiencyScores, portSize) {
        if (!this.isAvailable(portSize)) return false;
        // Use agent when captain lacks both trading skills
        return captainProficiencyScores.bargaining === null && 
               captainProficiencyScores.appraisal === null;
    }

    /**
     * Calculate agent fee from transaction value
     */
    static calculateFee(transactionValue, feePercent) {
        return Math.floor(transactionValue * feePercent / 100);
    }
}