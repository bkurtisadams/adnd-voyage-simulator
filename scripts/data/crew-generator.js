/**
 * Crew Generator Utility
 * Generates random stats and details for maritime officers
 */
export class CrewGenerator {

    static NAMES = [
        "Saltbeard", "Ironhand", "Fairwind", "Blackwood", "Stormcaller", 
        "Hawkins", "Drake", "Morgan", "Vane", "Rackham", "Bonny", 
        "Read", "Kidd", "Roberts", "Teach", "Avery", "Dampier"
    ];

    static TITLES = [
        "Captain", "Master", "Commander", "Skipper"
    ];

    static LT_TITLES = [
        "Mr.", "Ms.", "Mate", "Lieutenant"
    ];

    /**
     * Generate a complete officer profile
     * @param {string} rank - 'Captain' or 'Lieutenant'
     */
    static generate(rank = 'Captain') {
        const isCaptain = rank === 'Captain';
        
        // Roll Attributes (Weighted slightly based on rank)
        const stats = {
            str: this.rollStat(isCaptain ? 0 : 2), // Lt needs more muscle
            dex: this.rollStat(1),
            con: this.rollStat(1),
            int: this.rollStat(isCaptain ? 2 : 0), // Capt needs brains
            wis: this.rollStat(isCaptain ? 2 : 0), // Capt needs sea sense
            cha: this.rollStat(isCaptain ? 2 : -1) // Capt needs command
        };

        // Generate Name
        const nameList = this.NAMES;
        const titleList = isCaptain ? this.TITLES : this.LT_TITLES;
        const name = `${titleList[Math.floor(Math.random() * titleList.length)]} ${nameList[Math.floor(Math.random() * nameList.length)]}`;

        // logical skills based on rank
        const skills = this.generateSkills(rank, stats);

        return {
            name,
            ...stats,
            ...skills
        };
    }

    static rollStat(bonus = 0) {
        // Simple 3d6 + bonus (capped at 18)
        const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;
        return Math.min(18, roll + bonus);
    }

    static generateSkills(rank, stats) {
        // Base logical defaults
        const skills = {};
        
        // Everyone needs these
        skills.seamanship = true;
        skills.seaLore = Math.random() > 0.5;

        if (rank === 'Captain') {
            skills.navigation = true;
            skills.piloting = true;
            skills.bargaining = stats.cha > 12;
            skills.trade = stats.wis > 12;
            skills.leadership = true; // Conceptually
            skills.signaling = Math.random() > 0.7;
        } else {
            // Lieutenant
            skills.shipCarpentry = Math.random() > 0.6;
            skills.shipRowing = stats.str > 14;
            skills.signaling = true;
            skills.piloting = Math.random() > 0.5; // Backup pilot
            skills.customsInspection = Math.random() > 0.8;
        }

        return skills;
    }
}