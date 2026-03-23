/**
 * Crew Generator Utility
 * Generates random stats and details for maritime officers
 */
export class CrewGenerator {

    static NAMES = [
        "Saltbeard", "Ironhand", "Fairwind", "Blackwood", "Stormcaller", 
        "Hawkins", "Drake", "Morgan", "Vane", "Rackham", "Bonny", 
        "Read", "Kidd", "Roberts", "Teach", "Avery", "Dampier",
        "Corwin", "Ashford", "Waverly", "Kelley", "Dunstan", "Marsh",
        "Thorne", "Hale", "Crowe", "Blythe", "Selwick", "Rowe"
    ];

    static ROLE_TITLES = {
        Captain: ["Captain", "Master", "Commander", "Skipper"],
        Lieutenant: ["Mr.", "Ms.", "Lieutenant"],
        Mate: ["Mate", "Bosun"],
        Navigator: ["Navigator", "Pilot"],
        Artillerist: ["Gunner", "Master Gunner"],
        Surgeon: ["Doctor", "Surgeon", "Physick"]
    };

    /**
     * Generate a complete officer profile
     * @param {string} role - Captain, Lieutenant, Mate, Navigator, Artillerist, Surgeon
     */
    static generate(role = 'Captain') {
        const stats = this.rollStatsForRole(role);
        const titleList = this.ROLE_TITLES[role] || this.ROLE_TITLES.Lieutenant;
        const name = `${titleList[Math.floor(Math.random() * titleList.length)]} ${this.NAMES[Math.floor(Math.random() * this.NAMES.length)]}`;
        const skills = this.generateSkills(role, stats);
        const level = this.rollLevel(role);

        return { name, level, role, ...stats, skills };
    }

    static rollStatsForRole(role) {
        const bonuses = {
            Captain:     { str: 0, dex: 1, con: 1, int: 2, wis: 2, cha: 2 },
            Lieutenant:  { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 0 },
            Mate:        { str: 2, dex: 1, con: 2, int: 0, wis: 0, cha: -1 },
            Navigator:   { str: -1, dex: 0, con: 0, int: 3, wis: 2, cha: -1 },
            Artillerist: { str: 1, dex: 2, con: 1, int: 1, wis: 0, cha: -1 },
            Surgeon:     { str: -1, dex: 1, con: 0, int: 3, wis: 2, cha: 0 }
        };
        const b = bonuses[role] || bonuses.Lieutenant;
        return {
            str: this.rollStat(b.str), dex: this.rollStat(b.dex), con: this.rollStat(b.con),
            int: this.rollStat(b.int), wis: this.rollStat(b.wis), cha: this.rollStat(b.cha)
        };
    }

    static rollLevel(role) {
        if (role === "Captain") {
            const roll = Math.floor(Math.random() * 10) + 1;
            if (roll <= 4) return 5;
            if (roll <= 7) return 6;
            if (roll <= 9) return 7;
            return 8;
        }
        if (role === "Lieutenant") return Math.floor(Math.random() * 3) + 2; // 2-4
        if (role === "Mate") return Math.floor(Math.random() * 2) + 1; // 1-2
        return Math.floor(Math.random() * 3) + 1; // 1-3 for specialists
    }

    static rollStat(bonus = 0) {
        const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 3;
        return Math.max(3, Math.min(18, roll + bonus));
    }

    static generateSkills(role, stats) {
        const s = {};

        // All maritime officers get seamanship
        s.seamanship = true;

        switch (role) {
            case 'Captain':
                s.navigation = true;
                s.piloting = true;
                s.shipSailing = true;
                s.bargaining = stats.cha >= 12;
                s.appraisal = stats.wis >= 12;
                s.trade = stats.wis >= 13;
                s.seaLore = Math.random() > 0.4;
                s.vesselIdentification = Math.random() > 0.5;
                s.signaling = Math.random() > 0.7;
                break;
            case 'Lieutenant':
                s.shipSailing = true;
                s.piloting = Math.random() > 0.4;
                s.navigation = Math.random() > 0.6;
                s.signaling = true;
                s.shipCarpentry = Math.random() > 0.5;
                s.bargaining = stats.cha >= 14;
                s.seaLore = Math.random() > 0.6;
                break;
            case 'Mate':
                s.shipSailing = true;
                s.shipRowing = stats.str >= 12;
                s.signaling = true;
                s.boating = true;
                s.shipCarpentry = Math.random() > 0.4;
                break;
            case 'Navigator':
                s.navigation = true;
                s.piloting = true;
                s.shipSailing = true;
                s.seaLore = true;
                s.vesselIdentification = Math.random() > 0.3;
                s.signaling = Math.random() > 0.5;
                break;
            case 'Artillerist':
                s.artillerist = true;
                s.signaling = true;
                s.shipCarpentry = Math.random() > 0.6;
                break;
            case 'Surgeon':
                // Medicine/First Aid are not in the proficiency system yet,
                // but track them for future use
                s.seaLore = Math.random() > 0.5;
                s.appraisal = stats.wis >= 14;
                break;
        }

        return s;
    }
}