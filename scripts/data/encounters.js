/**
 * Encounter Tables Registry
 * Manages maritime encounter data
 */

export class EncounterRegistry {
    static tables = new Map();
    static effects = new Map();

    static initialize() {
        this.registerTables();
        this.registerEffects();
        console.log(`Encounter Registry | Registered ${this.tables.size} encounter tables`);
    }

    static registerTables() {
        // Salt Water Shallow Common
        this.tables.set('SALT_WATER_SHALLOW_COMMON', [
            { name: "Man, merchant", number: "-", ac: "-", move: "12\"", hd: "1", thac0: "-", damage: "W", size: "M", inLair: "20%", other: "80% will be carrying d100% cargo." },
            { name: "Seaweed, Floating", number: "-", ac: "-", move: "-", hd: "-", thac0: "-", damage: "-", size: "-", inLair: "-", other: "MM2. 40% additional encounter" },
            { name: "Shark", number: "3d4", ac: "6", move: "24\"", hd: "3-8", thac0: "16-12", damage: "d4+1|2d4|3d4", size: "M/L", inLair: "Nil", other: "-" },
            { name: "Whale", number: "d8", ac: "4", move: "18/21/24", hd: "12/24/36", thac0: "7", damage: "d8/3d8/5d8", size: "L", inLair: "Nil", other: "-" },
            { name: "Whale, carnivorous", number: "d8", ac: "4", move: "12/18/24", hd: "12/24/36", thac0: "7", damage: "5d4/10d4/15d4", size: "L", inLair: "Nil", other: "Swallow" }
        ]);

        // Salt Water Shallow Uncommon
        this.tables.set('SALT_WATER_SHALLOW_UNCOMMON', [
            { name: "Ogre (Merrow)", number: "2d12", ac: "4", move: "6\"//12\"", hd: "4+4", thac0: "15", damage: "d6/d6/2d4|weapon", size: "L (9')", inLair: "20%", other: "Surprise 4 in 6" },
            { name: "Otter, sea", number: "d4", ac: "5", move: "12\"//18\"", hd: "1+1", thac0: "18", damage: "d3", size: "S", inLair: "20%", other: "-" },
            { name: "Portuguese Man-o-war, Giant", number: "d10", ac: "9", move: "//1\"", hd: "d4", thac0: "19-16", damage: "d10", size: "S-L", inLair: "Nil", other: "Warm seas" },
            { name: "Ray, Manta", number: "1", ac: "6", move: "//18\"", hd: "8-11", thac0: "12-10", damage: "3d4/2-20", size: "L", inLair: "Nil", other: "Warm seas, Swallow. See MM" },
            { name: "Sahuagin", number: "d4×20", ac: "5", move: "12\"//24\"", hd: "2+2", thac0: "16", damage: "d2/d2/d4", size: "M", inLair: "25%", other: "Leaders, Sharks" },
            { name: "Sea Hag", number: "d4", ac: "7", move: "15\"", hd: "3", thac0: "16", damage: "d4 (dagger)", size: "M", inLair: "10%", other: "Death Look. See MM." },
            { name: "Sea Horse, Giant", number: "d20", ac: "7", move: "//21\"", hd: "2/3/4", thac0: "16-15", damage: "d4/d4+1/2d4", size: "L", inLair: "-", other: "S/M/L" },
            { name: "Sea Lion", number: "3d4", ac: "5/3", move: "//18\"", hd: "6", thac0: "13", damage: "d6/d6/2d6", size: "L", inLair: "20%", other: "-" },
            { name: "Snake, Giant Sea Serpent", number: "d8", ac: "5", move: "//12\"", hd: "8-10", thac0: "12-10", damage: "d6/3d6", size: "L", inLair: "Nil", other: "Poison, Constriction, only 20% attack." },
            { name: "Spiders, Giant (Marine)", number: "d8", ac: "4", move: "12\"", hd: "4+4", thac0: "15", damage: "2d4", size: "L", inLair: "70%", other: "-" },
            { name: "Swordfish", number: "d4+1", ac: "6", move: "//24\"", hd: "1+1", thac0: "18", damage: "2d6", size: "M", inLair: "Nil", other: "Usually with dolphins" },
            { name: "Troll, Marine (Scrag)", number: "d8", ac: "2", move: "3\"//12\"", hd: "6+12", thac0: "12", damage: "d4/d4/d8+8", size: "L", inLair: "15%", other: "10% AC1" },
            { name: "Turtle, giant, sea", number: "d3", ac: "2/5", move: "1\"//15\"", hd: "15", thac0: "8", damage: "4d3", size: "L", inLair: "Nil", other: "Non-aggressive. Capsize" },
            { name: "Urchin, Black", number: "d6", ac: "4", move: "9\"//15\"", hd: "1+1", thac0: "18", damage: "d6", size: "S", inLair: "10%", other: "clairvoyant, hidden" }
        ]);

        // Salt Water Shallow Rare (abbreviated for space - include all from original)
        this.tables.set('SALT_WATER_SHALLOW_RARE', [
            { name: "Barracuda", number: "2d6", ac: "6", move: "30\"", hd: "1-3", thac0: "19-16", damage: "2d4", size: "S to L", inLair: "Nil", other: "-" },
            { name: "Dragon, Bronze", number: "d4", ac: "0", move: "9\"/24\" €", hd: "8-10", thac0: "12-10", damage: "d6/d6/4d6", size: "L", inLair: "45%", other: "Breath weapon, magic use" },
            { name: "Ghost Ship", number: "-", ac: "-", move: "-", hd: "-", thac0: "-", damage: "-", size: "-", inLair: "-", other: "See Ghost Ship" },
            { name: "Island", number: "-", ac: "-", move: "-", hd: "-", thac0: "-", damage: "-", size: "-", inLair: "-", other: "See Island sub-table" },
            { name: "Kraken", number: "1", ac: "0/-4", move: "3\"//21\"", hd: "20", thac0: "5", damage: "2d10×6/5d4", size: "G", inLair: "20%", other: "Legendary sea monster" },
            { name: "Shark, giant", number: "d3", ac: "5", move: "//18\"", hd: "10-15", thac0: "10-8", damage: "4d4-6d6", size: "L", inLair: "Nil", other: "Swallow" },
            { name: "Whirlpool", number: "-", ac: "-", move: "-", hd: "-", thac0: "-", damage: "-", size: "-", inLair: "-", other: "See Whirlpool" }
            // ... include all remaining rare encounters
        ]);
    }

    static registerEffects() {
        this.effects.set("See Whirlpool", {
            damage: "2d10",
            notes: "Ship dragged at 1\"/round cumulative. Must exceed flow speed to escape. Breaks apart in d6 rounds if not escaped."
        });

        this.effects.set("See Ice", {
            damage: "1d6",
            notes: "Ice floes/icebergs do 1-6 hull damage per round in contact. 10% chance of holing ship."
        });

        this.effects.set("See Ghost Ship", {
            notes: "Manned by undead sailors. Crew: 01-40 skeletons, 41-80 zombies, 81-00 juju zombies."
        });

        this.effects.set("MM2. 40% additional encounter", {
            movementPenalty: "50",
            additionalEncounterChance: 40,
            notes: "Floating seaweed slows ship by 50%. 40% chance of another encounter."
        });

        this.effects.set("Capsize", {
            damage: "2d6",
            notes: "Creature attempts to capsize the ship. Large creatures can overturn vessels."
        });

        this.effects.set("Swallow", {
            damage: "3d6",
            notes: "Large creature can swallow small boats whole. Crew may escape from inside."
        });
    }

    static getTable(tableName) {
        return this.tables.get(tableName);
    }

    static getEffect(effectKey) {
        return this.effects.get(effectKey);
    }

    static rollEncounter(waterType = "SHALLOW", frequency = "COMMON") {
        const tableName = `SALT_WATER_${waterType}_${frequency}`;
        const table = this.getTable(tableName);
        
        if (!table || table.length === 0) return null;
        
        const index = Math.floor(Math.random() * table.length);
        return table[index];
    }
}