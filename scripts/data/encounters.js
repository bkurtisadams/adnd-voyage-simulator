// encounters.js v2.0.0 - 2026-03-22
// Full encounter tables from Seafaring rules supplement
// Salt Water Shallow, Salt Water Deep, Fresh Water (mapped from lake/river)
// Includes Dinosaur, Island, Ghost Ship, and Other Encounters subtables

export class EncounterRegistry {
    static tables = new Map();
    static effects = new Map();
    static subtables = new Map();

    static initialize() {
        this.registerShallowTables();
        this.registerDeepTables();
        this.registerFreshTables();
        this.registerSubtables();
        this.registerEffects();
        console.log(`Encounter Registry | Registered ${this.tables.size} encounter tables, ${this.subtables.size} subtables`);
    }

    // =========================================================================
    // SALT WATER SHALLOW / COASTAL (check dawn + noon)
    // Frequency bands: 1-65 Common, 66-85 Uncommon, 86-97 Rare, 98-00 Very Rare
    // =========================================================================

    static registerShallowTables() {
        this.tables.set('SALT_WATER_SHALLOW_COMMON', [
            { roll: 1, name: "Crocodile, common", number: "3d8", ac: 5, move: '6"//12"', hd: "3", thac0: 16, damage: "2d4/d12", size: "L", inLair: 0, other: "Surprise 3 in 6", canSubmerge: true },
            { roll: 2, name: "Men, merchant", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "80% carrying d100% cargo", type: "ship" },
            { roll: 3, name: "Ray, sting", number: "d3", ac: 7, move: '9"', hd: "1", thac0: 19, damage: "d3", size: "S", inLair: 0, other: "90% invisible, poison" },
            { roll: 4, name: "Seaweed, Floating", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Seaweed", type: "hazard" },
            { roll: 5, name: "Shark", number: "3d4", ac: 6, move: '//24"', hd: "3-8", thac0: "16-13", damage: "d4+1/2d4/3d4", size: "M-L", inLair: 0, other: "S/M/L variants" },
            { roll: 6, name: "Strangle Weed", number: "3d4", ac: 6, move: null, hd: "2-4", thac0: "16-15", damage: null, size: "S", inLair: 100, other: "7'-12' fronds. See MM" },
            { roll: 7, name: "Whale", number: "d8", ac: 4, move: '18"-24"', hd: "12-36", thac0: 9, damage: "d8-5d8", size: "L", inLair: 0, other: "On surface, damage=half of HD" },
            { roll: 8, name: "Whale, carnivorous", number: "d8", ac: 4, move: '//24"', hd: "12", thac0: 9, damage: "5d4-15d4", size: "L", inLair: 0, other: "Bite, Swallow" },
            { roll: 9, name: "Beetle, giant water", number: "d12", ac: 3, move: '3"//12"', hd: "4", thac0: 15, damage: "3d6", size: "L", inLair: 0, other: null }
        ]);

        this.tables.set('SALT_WATER_SHALLOW_UNCOMMON', [
            { roll: 1, name: "Dolphin", number: "2d10", ac: 5, move: '//30"', hd: "2+2", thac0: 16, damage: "2d4", size: "M", inLair: 0, other: null },
            { roll: 2, name: "Eel, Giant", number: "d4", ac: 6, move: '//9"', hd: "5", thac0: 15, damage: "3d6/2d10", size: "M", inLair: 0, other: null },
            { roll: 3, name: "Falcon, Large", number: "1", ac: 6, move: '1"/33"', hd: "1", thac0: 19, damage: "d2/d2/1", size: "S", inLair: 30, other: "Dive +2 to hit for 2x damage, no beak. 25% eye" },
            { roll: 4, name: "Koalinth", number: "d20*10", ac: 5, move: '9"', hd: "1+1", thac0: 18, damage: "d8", size: "M", inLair: 25, other: "Leaders", canSubmerge: true },
            { roll: 5, name: "Lamprey, Normal", number: "d2", ac: 7, move: '12"', hd: "1+2", thac0: 18, damage: "d2", size: "S", inLair: 0, other: "Drain blood (2 hp/HD)" },
            { roll: 6, name: "Lobster, giant", number: "d4", ac: 4, move: '6"//12"', hd: "4+4", thac0: 15, damage: "2d6/2d6", size: "L", inLair: 0, other: "Surprise 3 in 6" },
            { roll: 7, name: "Men, buccaneer", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "Leader, warship", type: "ship", canBoard: true },
            { roll: 8, name: "Men, navy", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 0, other: "10% 2d4 ships", type: "ship" },
            { roll: 9, name: "Men, pirate", number: null, ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "Tribesman with small craft", type: "ship", canBoard: true },
            { roll: 10, name: "Men, smuggler", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "80% carrying d100% cargo", type: "ship" },
            { roll: 11, name: "Merman", number: "d20*10", ac: 7, move: '1"//18"', hd: "1+1", thac0: 18, damage: "d8/w", size: "M", inLair: 25, other: null, canSubmerge: true },
            { roll: 12, name: "Ogre (Merrow)", number: "2d12", ac: 4, move: '6"//12"', hd: "4+4", thac0: 15, damage: "d6/d6/2d4", size: "L", inLair: 20, other: "Surprise 4 in 6", canSubmerge: true },
            { roll: 13, name: "Otter, sea", number: "d4", ac: 5, move: '12"//18"', hd: "1+1", thac0: 18, damage: "d3", size: "S", inLair: 20, other: null },
            { roll: 14, name: "Portuguese Man-o-war, Giant", number: "d10", ac: 9, move: '//1"', hd: "d4", thac0: "19-16", damage: "d10", size: "S-L", inLair: 0, other: "Warm seas" },
            { roll: 15, name: "Ray, Manta", number: "1", ac: 6, move: '//18"', hd: "8-11", thac0: "12-10", damage: "3d4/2d10", size: "L", inLair: 0, other: "Warm seas, Swallow. See MM" },
            { roll: 16, name: "Sahuagin", number: "d4*20", ac: 5, move: '12"//24"', hd: "2+2", thac0: 16, damage: "d2/d2/d4", size: "M", inLair: 25, other: "Leaders, Sharks", canSubmerge: true },
            { roll: 17, name: "Sea Hag", number: "d4", ac: 7, move: '15"', hd: "3", thac0: 16, damage: "d4", size: "M", inLair: 10, other: "Death Look. See MM.", canSubmerge: true },
            { roll: 18, name: "Sea Horse, Giant", number: "d20", ac: 7, move: '//21"', hd: "2/3/4", thac0: "16-15", damage: "d4/d4+1/2d4", size: "L", inLair: 0, other: "S/M/L variants" },
            { roll: 19, name: "Sea Lion", number: "3d4", ac: "5/3", move: '//18"', hd: "6", thac0: 13, damage: "d6/d6/2d6", size: "L", inLair: 20, other: null },
            { roll: 20, name: "Snake, Giant Sea Serpent", number: "d8", ac: 5, move: '//12"', hd: "8-10", thac0: "12-10", damage: "d6/3d6", size: "L", inLair: 0, other: "Poison, Constriction, only 20% attack" },
            { roll: 21, name: "Spiders, Giant (Marine)", number: "d8", ac: 4, move: '12"', hd: "4+4", thac0: 15, damage: "2d4", size: "L", inLair: 70, other: null },
            { roll: 22, name: "Swordfish", number: "d4+1", ac: 6, move: '//24"', hd: "1+1", thac0: 18, damage: "2d6", size: "M", inLair: 0, other: "Usually with dolphins" },
            { roll: 23, name: "Troll, Marine (Scrag)", number: "d8", ac: 2, move: '3"//12"', hd: "6+12", thac0: 12, damage: "d4/d4/d8+8", size: "L", inLair: 15, other: "10% AC1", canSubmerge: true },
            { roll: 24, name: "Turtle, giant, sea", number: "d3", ac: "2/5", move: '1"//15"', hd: "15", thac0: 8, damage: "4d3", size: "L", inLair: 0, other: "Non-aggressive. Capsize" },
            { roll: 25, name: "Urchin, Black", number: "d6", ac: 4, move: '9"//15"', hd: "1+1", thac0: 18, damage: "d6", size: "S", inLair: 10, other: "Clairvoyant, hidden" }
        ]);

        this.tables.set('SALT_WATER_SHALLOW_RARE', [
            { roll: 1, name: "Barracuda", number: "2d6", ac: 6, move: '30"', hd: "1-3", thac0: "19-16", damage: "2d4", size: "S-L", inLair: 0, other: null },
            { roll: 2, name: "Crab, Giant", number: "2d6", ac: 3, move: '9"', hd: "3", thac0: 16, damage: "2d8/2d8", size: "L", inLair: 0, other: null },
            { roll: 3, name: "Crane, Giant", number: "d20", ac: 5, move: '9"/18"', hd: "3", thac0: 16, damage: "d10", size: "M", inLair: 0, other: "If 20, 50% d20+30 encountered" },
            { roll: 4, name: "Dragon, Bronze", number: "d4", ac: 0, move: '9"/24"', hd: "8-10", thac0: "12-10", damage: "d6/d6/4d6", size: "L", inLair: 45, other: "Breath weapon, magic use" },
            { roll: 5, name: "Dragon, Mist", number: "d2", ac: "1/-2", move: '6"/33"', hd: "9-11", thac0: "12-10", damage: "d4/d4/2d12/2d4", size: "L", inLair: 35, other: "Breath weapon, magic use" },
            { roll: 6, name: "Eagle", number: "d2", ac: 6, move: '1"/30"', hd: "1+3", thac0: 18, damage: "d2/d2/d2", size: "M", inLair: 20, other: "Eyesight, +4 to hit dive for 2x claw but no beak" },
            { roll: 7, name: "Eye, Floating", number: "d12", ac: 9, move: '//30"', hd: "1-4 hp", thac0: 20, damage: null, size: "S", inLair: 0, other: "Hypnotism" },
            { roll: 8, name: "Falcon, Small", number: "1", ac: 5, move: '1"/36"', hd: "1-1", thac0: 20, damage: "1/1/1", size: "S", inLair: 30, other: "Dive +2 to hit for 2x damage, no beak. 25% eye" },
            { roll: 9, name: "Ghost Ship", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Ghost Ship", type: "subtable" },
            { roll: 10, name: "Giant, Storm", number: "d4*20", ac: 1, move: '15"', hd: "15+2-7", thac0: 7, damage: "7d6", size: "L", inLair: 55, other: null },
            { roll: 11, name: "Griffon", number: "2d8", ac: 5, move: '18"/36"', hd: "3+3", thac0: 16, damage: "d6/d6/d10", size: "L", inLair: 10, other: null },
            { roll: 12, name: "Hippogriff", number: "2d8", ac: 5, move: '18"/36"', hd: "3+3", thac0: 16, damage: "d6/d6/d10", size: "L", inLair: 10, other: null },
            { roll: 13, name: "Hollyphant", number: "d3", ac: -4, move: '9"/42"', hd: "8+8", thac0: 10, damage: "d3/d3/d6", size: "S", inLair: 0, other: null },
            { roll: 14, name: "Island", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Island sub-table", type: "subtable" },
            { roll: 15, name: "Lacedon", number: "2d12", ac: 6, move: '9"', hd: "2", thac0: 16, damage: "d3/d3/d3", size: "M", inLair: 20, other: "Paralyze, Undead", canSubmerge: true },
            { roll: 16, name: "Lammasu", number: "2d4", ac: 6, move: '12"/24"', hd: "7+7", thac0: 12, damage: "d6/d6", size: "L", inLair: 30, other: "30% MR. See MM." },
            { roll: 17, name: "Lamprey, Giant", number: "d4", ac: 6, move: '9"', hd: "5", thac0: 15, damage: "d6", size: "M", inLair: 0, other: "Drain blood (2 hp/HD)" },
            { roll: 18, name: "Lizard Man", number: "4d10", ac: "5(4)", move: '6"//12"', hd: "2+1", thac0: 16, damage: "d2/d2/d8", size: "M", inLair: 30, other: null, canSubmerge: true },
            { roll: 19, name: "Locathah", number: "d20*10", ac: 6, move: '12"', hd: "2", thac0: 16, damage: "d8/w", size: "M", inLair: 10, other: "Leaders, Giant Eels", canSubmerge: true },
            { roll: 20, name: "Narwhale", number: "d6", ac: 6, move: '//21"', hd: "4+4-6+6", thac0: "13-15", damage: "2d12/6d4/7d4", size: "L", inLair: 0, other: "Cool to cold water" },
            { roll: 21, name: "Octopus, giant", number: "d3", ac: 7, move: '3"//12"', hd: "8", thac0: 12, damage: "d4x8", size: "L", inLair: 70, other: "25% pin arm" },
            { roll: 22, name: "Otter, Giant", number: "d4+1", ac: 5, move: '9"//18"', hd: "5", thac0: 15, damage: "3d6", size: "L", inLair: 0, other: "Playful" },
            { roll: 23, name: "Ray, Pungi", number: "d3", ac: 7, move: '12"', hd: "4", thac0: 15, damage: "d4", size: "L", inLair: 0, other: "Poison" },
            { roll: 24, name: "Roc", number: "d2", ac: 4, move: '3"/30"', hd: "18", thac0: 7, damage: "3d6/3d6", size: "L", inLair: 10, other: "Beak for 4d6 when prey try to escape" },
            { roll: 25, name: "Shark, giant", number: "d3", ac: 5, move: '//18"', hd: "10-15", thac0: "10-8", damage: "4d4-6d6", size: "L", inLair: 0, other: "Swallow" },
            { roll: 26, name: "Siren (Harpy)", number: "2d6", ac: 7, move: '6"/15"', hd: "3", thac0: 16, damage: "d3/d4/d6", size: "M", inLair: 25, other: "Singing, charm. See MM Harpy." },
            { roll: 27, name: "Sphinx, Gyno-", number: "1", ac: -1, move: '15"/24"', hd: "8", thac0: 12, damage: "2d4/2d4", size: "L", inLair: 15, other: "Spell use" },
            { roll: 28, name: "Triton", number: "d6*10", ac: 5, move: '//15"', hd: "3", thac0: 16, damage: "d8/w", size: "M", inLair: 25, other: "Leaders. Mounted", canSubmerge: true },
            { roll: 29, name: "Urchin, Green", number: "d4", ac: 3, move: '9"//18"', hd: "2+1", thac0: 16, damage: "d6+1x2", size: "S", inLair: 10, other: "Clairvoyant, hidden" },
            { roll: 30, name: "Urchin, Red", number: "d4", ac: 2, move: '9"//18"', hd: "3+1", thac0: 16, damage: "d4+1x2", size: "S", inLair: 10, other: "Clairvoyant, hidden, poison (sleep)" },
            { roll: 31, name: "Whirlpool", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Whirlpool", type: "hazard" },
            { roll: 32, name: "Will-o-wisp", number: "1", ac: -8, move: '18"', hd: "9", thac0: 12, damage: "2d8", size: "S", inLair: 5, other: "10% encounter d3" },
            { roll: 33, name: "Wind Walker", number: "d3", ac: 7, move: '15"/30"', hd: "6+3", thac0: 13, damage: "3d6", size: "L", inLair: 20, other: "See MM" }
        ]);

        this.tables.set('SALT_WATER_SHALLOW_VERY_RARE', [
            { roll: 1, name: "Aarakocra", number: "d10", ac: 6, move: '6"/36"', hd: "1+2", thac0: 18, damage: "d3/d3", size: "M", inLair: 5, other: "Dive +4 with javelins (2x damage)" },
            { roll: 2, name: "Afanc", number: "1", ac: 6, move: '//15"', hd: "15", thac0: 8, damage: "5d4/3d4/3d4", size: "L", inLair: 0, other: "Creates whirlpool (see MM2). Capsize" },
            { roll: 3, name: "Algoid", number: "d6", ac: 5, move: '6"', hd: "5", thac0: 15, damage: "d10/d10", size: "M", inLair: 20, other: "Mind Blast, See FF." },
            { roll: 4, name: "Crocodile, giant", number: "d2-2d12", ac: 4, move: '6"/12"', hd: "7", thac0: 13, damage: "3d6/2d10", size: "L", inLair: 0, other: "Surprise", canSubmerge: true },
            { roll: 5, name: "Deva, Movanic", number: "d6", ac: -5, move: '12"/30"//21"', hd: "7+28", thac0: 12, damage: "By type (+5 STR)", size: "M", inLair: 0, other: "55% MR, +1 flame tongue, MM2" },
            { roll: 6, name: "Dinosaur", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Dinosaur Subtable", type: "subtable" },
            { roll: 7, name: "Dragon Turtle", number: "1", ac: 0, move: '3"//9"', hd: "12-14", thac0: "9-8", damage: "2d6/2d6/4d8", size: "L", inLair: 5, other: "Breath Weapon. Capsize", canSubmerge: true },
            { roll: 8, name: "Dragon, Celestial (T'ien Lung)", number: "1", ac: -2, move: '9"/48"//6"', hd: "11-13", thac0: "10-9", damage: "d6/d6/4d10", size: "L", inLair: 60, other: "Breath weapon, magic use" },
            { roll: 9, name: "Dragon, Cloud", number: "d2", ac: "0/-3", move: '6"/39"', hd: "12-14", thac0: "9-8", damage: "d10/d10/3d12/3d4", size: "L", inLair: 25, other: "5% Two. Breath weapon, magic use, 50% MR." },
            { roll: 10, name: "Dragon, Gold", number: "d3", ac: -2, move: '12"/30"', hd: "10-12", thac0: "10-9", damage: "d8/d8/6d6", size: "L", inLair: 65, other: "Breath weapon, magic use" },
            { roll: 11, name: "Dragon, Sea (Lung Wang)", number: "1", ac: 0, move: '3"//9"', hd: "11-13", thac0: "10-9", damage: "d12/d12/6d6", size: "L", inLair: 60, other: "Breath weapon, magic use", canSubmerge: true },
            { roll: 12, name: "Eagle, Giant", number: "d20*10", ac: 7, move: '3"/48"', hd: "4", thac0: 15, damage: "d6/d6/2d6", size: "M", inLair: 20, other: "Eyesight, +4 to hit dive for 2x claw but no beak" },
            { roll: 13, name: "Eel, Electric Marine", number: "d3", ac: 9, move: '//12"', hd: "2", thac0: 16, damage: "d3", size: "M", inLair: 0, other: "Radius 15' jolt for 3d8 (5'), 2d8 (10'), d8 (15')" },
            { roll: 14, name: "Elf, Aquatic (Sea Elf)", number: "d20*10", ac: 5, move: '12"', hd: "1+1", thac0: 18, damage: "d10/w", size: "M", inLair: 10, other: "Leaders. Dolphins", canSubmerge: true },
            { roll: 15, name: "Hippocampus", number: "2d4", ac: 5, move: '//24"', hd: "4", thac0: 15, damage: "d4", size: "L", inLair: 0, other: null },
            { roll: 16, name: "Ice", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Ice", type: "hazard" },
            { roll: 17, name: "Kelpie", number: "d4", ac: 3, move: '9"//12"', hd: "5", thac0: 15, damage: null, size: "M", inLair: 70, other: "Charm at -2 and drown 2d10/round. Half damage from fire" },
            { roll: 18, name: "Ki-rin", number: "1", ac: -5, move: '24"/48"', hd: "12", thac0: 9, damage: "2d4/2d4/3d6", size: "L", inLair: 5, other: "+3 horn. See MM." },
            { roll: 19, name: "Kopoacinth", number: "2d8", ac: 5, move: '9"/15"', hd: "4+4", thac0: 15, damage: "d3/d3/d6/d4", size: "M", inLair: 20, other: "+1 or better", canSubmerge: true },
            { roll: 20, name: "Kraken", number: "1", ac: "5/0", move: '//3" (21")', hd: "20", thac0: 7, damage: "2d6x2/2d4x6/5d4", size: "L", inLair: 75, other: "Spell Use, Drag Under. See MM2", canSubmerge: true },
            { roll: 21, name: "Lammasu, Greater", number: "d2", ac: 3, move: '15"/30"', hd: "12+7", thac0: 9, damage: "2d6/2d6", size: "L", inLair: 0, other: "40% MR. See MM2." },
            { roll: 22, name: "Ixitxachitl", number: "10d10", ac: 6, move: '12"', hd: "1+1", thac0: 18, damage: "3d4", size: "M", inLair: 60, other: "Cleric spells", canSubmerge: true },
            { roll: 23, name: "Lycanthrope, Seawolf, Greater", number: "4d4", ac: 5, move: '9"//27"', hd: "9+2", thac0: 12, damage: "3d4", size: "L", inLair: 0, other: "+1 or better to hit, All bites lycanthropy d4+1 days" },
            { roll: 24, name: "Lycanthrope, Seawolf, Lesser", number: "3d6", ac: "6(7)", move: '30"//12"', hd: "2+2", thac0: 16, damage: "2d4", size: "M", inLair: 0, other: "50% damage conveys lycanthropy" },
            { roll: 25, name: "Lycanthrope, Wereshark", number: "1", ac: 0, move: '12"//21"', hd: "10+3", thac0: 10, damage: "5d4", size: "L", inLair: 20, other: null },
            { roll: 26, name: "Manticore", number: "d4", ac: 4, move: '12"/18"', hd: "6+3", thac0: 13, damage: "d3/d3/d6", size: "L", inLair: 20, other: "Tail spikes (4 volleys of 6, 18\" range, d6 damage)" },
            { roll: 27, name: "Nereid", number: "d4*20", ac: 10, move: '12"', hd: "4", thac0: 15, damage: null, size: "M", inLair: 100, other: "95% undetectable. Blinding. Kiss." },
            { roll: 28, name: "Nymph", number: "d4", ac: 9, move: '12"', hd: "3", thac0: 16, damage: "0", size: "M", inLair: 100, other: "50% MR, Druid spells" },
            { roll: 29, name: "Pegasus", number: "d10", ac: 6, move: '24"/48"', hd: "4", thac0: 15, damage: "d8/d8/d3", size: "L", inLair: 15, other: null },
            { roll: 30, name: "Shedu", number: "2d4", ac: 4, move: '12"/24"', hd: "9+9", thac0: 10, damage: "d6/d6/2d6", size: "L", inLair: 25, other: "25% MR, See MM." },
            { roll: 31, name: "Shedu, Greater", number: "2d4", ac: 2, move: '15"/30"', hd: "14+4", thac0: 8, damage: "3d6/3d6", size: "L", inLair: 0, other: "50% MR, see MM2" },
            { roll: 32, name: "Sirine", number: "1", ac: "3 or less", move: '12"//24"', hd: "4-7", thac0: "15-13", damage: "By weapon", size: "M", inLair: 30, other: "20%+ MR, see MM2" },
            { roll: 33, name: "Sphinx, Andro-", number: "1", ac: -2, move: '18"/30"', hd: "12", thac0: 9, damage: "2d6/2d6", size: "L", inLair: 60, other: "Roar, cleric spells" },
            { roll: 34, name: "Selkie", number: "1", ac: 5, move: '12"//36"', hd: "3+3", thac0: 15, damage: "d6", size: "M", inLair: 0, other: "Human form" },
            { roll: 35, name: "Titan", number: "1-2", ac: "2 to -3", move: '21"', hd: "17-22", thac0: 7, damage: "7d6/8d6", size: "L", inLair: 10, other: "Spell use." },
            { roll: 36, name: "Urchin, Silver", number: "d2", ac: 0, move: '12"//21"', hd: "5+3", thac0: 15, damage: "d4+1x5", size: "S", inLair: 10, other: "Clairvoyant, hidden, poison (catatonic)" },
            { roll: 37, name: "Urchin, Yellow", number: "d3", ac: 1, move: '12"//18"', hd: "4+2", thac0: 15, damage: "d6x4", size: "S", inLair: 10, other: "Clairvoyant, hidden, poison (paralysis)" },
            { roll: 38, name: "Water Weird", number: "d3", ac: 4, move: '12"', hd: "3+3", thac0: 15, damage: "0", size: "L", inLair: 50, other: "Drowning" }
        ]);
    }

    // =========================================================================
    // SALT WATER DEEP (check once at noon)
    // Frequency bands: 1-65 Common, 66-85 Uncommon, 86-97 Rare, 98-00 Very Rare
    // =========================================================================

    static registerDeepTables() {
        this.tables.set('SALT_WATER_DEEP_COMMON', [
            { roll: 1, name: "Men, merchant", number: null, ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "80% carrying d100% cargo", type: "ship" },
            { roll: 2, name: "Seaweed, Floating", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "40% additional encounter", type: "hazard" },
            { roll: 3, name: "Shark", number: "3d4", ac: 6, move: '24"', hd: "3-8", thac0: "16-12", damage: "d4+1/2d4/3d4", size: "M-L", inLair: 0, other: null },
            { roll: 4, name: "Whale", number: "d8", ac: 4, move: '18/21/24"', hd: "12/24/36", thac0: 7, damage: "d8/3d8/5d8", size: "L", inLair: 0, other: null },
            { roll: 5, name: "Whale, carnivorous", number: "d8", ac: 4, move: '12/18/24"', hd: "12/24/36", thac0: 7, damage: "5d4/10d4/15d4", size: "L", inLair: 0, other: "Swallow" }
        ]);

        this.tables.set('SALT_WATER_DEEP_UNCOMMON', [
            { roll: 1, name: "Dinosaur", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Dinosaur Subtable", type: "subtable" },
            { roll: 2, name: "Dolphin", number: "2d10", ac: 5, move: '30"', hd: "2+2", thac0: 16, damage: "2d4", size: "M", inLair: 0, other: null },
            { roll: 3, name: "Eel, Giant", number: "d4", ac: 6, move: '9"', hd: "5", thac0: 15, damage: "3d6", size: "M", inLair: 0, other: null },
            { roll: 4, name: "Island", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Island subtable", type: "subtable" },
            { roll: 5, name: "Men, buccaneer", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "Leaders. Warship. 25% MU, 15% Cleric. 20% carrying d100% cargo", type: "ship", canBoard: true },
            { roll: 6, name: "Men, navy", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 0, other: "10% 2d4 ships", type: "ship" },
            { roll: 7, name: "Men, smuggler", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "80% carrying d100% cargo", type: "ship" },
            { roll: 8, name: "Merman", number: "d20*10", ac: 7, move: '1"//18"', hd: "1+1", thac0: 18, damage: "d8/w", size: "M", inLair: 25, other: "Temperate/tropical", canSubmerge: true },
            { roll: 9, name: "Omen", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "Random check for additional encounter", type: "special" },
            { roll: 10, name: "Portuguese Man-o-war, Giant", number: "d10", ac: 9, move: '1"', hd: "d4", thac0: "19-16", damage: "d10", size: "S-L", inLair: 0, other: "Warm seas" },
            { roll: 11, name: "Sahuagin", number: "d4*20", ac: 5, move: '12"/24"', hd: "2+2", thac0: 16, damage: "d2/d2/d4", size: "M", inLair: 25, other: "Leaders, Sharks, Temperate/warm", canSubmerge: true },
            { roll: 12, name: "Scrag", number: "d8", ac: 2, move: '3"//12"', hd: "6+12", thac0: 12, damage: "d4/d4/d8+8", size: "L", inLair: 15, other: "10% AC1", canSubmerge: true },
            { roll: 13, name: "Snake, sea", number: "d8", ac: 5, move: '12"', hd: "8-10", thac0: "12-10", damage: "d6/3d6", size: "L", inLair: 0, other: "Poison, Constriction" },
            { roll: 14, name: "Turtle, giant, sea", number: "d3", ac: "2/5", move: '1"/15"', hd: "15", thac0: 8, damage: "4d3", size: "L", inLair: 0, other: "Non-aggressive. Capsize" },
            { roll: 15, name: "Urchin, Black", number: "d6", ac: 4, move: '9"//15"', hd: "1+1", thac0: 18, damage: "d6", size: "S", inLair: 10, other: "Clairvoyant, hidden" }
        ]);

        this.tables.set('SALT_WATER_DEEP_RARE', [
            { roll: 1, name: "Albatross", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "Treat as Omen. Roll again disregarding Common/Uncommon", type: "special" },
            { roll: 2, name: "Ghost Ship", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Ghost Ship", type: "subtable" },
            { roll: 3, name: "Giant, Storm", number: "d4*20", ac: 1, move: '15"', hd: "15+2-7", thac0: 7, damage: "7d6", size: "L", inLair: 55, other: null },
            { roll: 4, name: "Giant, Cloud", number: "d6", ac: 2, move: '15"', hd: "12+2-7", thac0: "9-7", damage: "6d6", size: "L", inLair: 40, other: "Hurl 2d12" },
            { roll: 5, name: "Green Slime", number: "d6", ac: 9, move: '0"', hd: "2", thac0: 16, damage: null, size: "S", inLair: 0, other: "Indistinguishable from seaweed at 40'+", type: "hazard" },
            { roll: 6, name: "Hollyphant", number: "d3", ac: -4, move: '9"/42"', hd: "8+8", thac0: 10, damage: "d3/d3/d6", size: "S", inLair: 0, other: null },
            { roll: 7, name: "Hydra, Sea", number: "1", ac: 5, move: '9"', hd: "5-12", thac0: "15-9", damage: "d6/d8/d10", size: "L", inLair: 20, other: "d8+4 heads" },
            { roll: 8, name: "Ice", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "Not warm. See Ice", type: "hazard" },
            { roll: 9, name: "Narwhale", number: "d6", ac: 6, move: '//21"', hd: "4+4-6+6", thac0: "13-15", damage: "2d12/6d4/7d4", size: "L", inLair: 0, other: "Cool to cold water" },
            { roll: 10, name: "Octopus, giant", number: "d3", ac: 7, move: '3"/12"', hd: "8", thac0: 12, damage: "d4x8", size: "L", inLair: 70, other: "25% pin arm" },
            { roll: 11, name: "Roc", number: "d2", ac: 4, move: '3"/30"', hd: "18", thac0: 7, damage: "3d6/3d6", size: "L", inLair: 10, other: "Beak 4d6" },
            { roll: 12, name: "Rocky shoals", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Rocky Shoals/Collision", type: "hazard" },
            { roll: 13, name: "Salt Water Termite", number: "d6+1", ac: 5, move: '6"//18"', hd: "4", thac0: 15, damage: "d6", size: "S", inLair: 0, other: "Ink causes paralysis, 1 Hull point/round for d6 rounds" },
            { roll: 14, name: "Shark, giant", number: "d3", ac: 5, move: '18"', hd: "10-15", thac0: "9-7", damage: "4d4-6d6", size: "L", inLair: 0, other: "Swallow" },
            { roll: 15, name: "Spiders, Giant (Marine)", number: "d8", ac: 4, move: '12"', hd: "4+4", thac0: 15, damage: "2d4", size: "L", inLair: 70, other: null },
            { roll: 16, name: "Squid, giant", number: "1", ac: "7/3", move: '3"/18"', hd: "12", thac0: 9, damage: "d6x12/5d4", size: "L", inLair: 40, other: "Pin" },
            { roll: 17, name: "Triton", number: "d6*10", ac: 5, move: '15"', hd: "3", thac0: 16, damage: "d8/w", size: "M", inLair: 25, other: "Leaders. Mounted.", canSubmerge: true },
            { roll: 18, name: "Urchin, Green", number: "d4", ac: 3, move: '9"//18"', hd: "2+1", thac0: 16, damage: "d6+1x2", size: "S", inLair: 10, other: "Clairvoyant, hidden" },
            { roll: 19, name: "Urchin, Red", number: "d4", ac: 2, move: '9"//18"', hd: "3+1", thac0: 16, damage: "d4+1x2", size: "S", inLair: 10, other: "Clairvoyant, hidden, poison (sleep)" },
            { roll: 20, name: "Whirlpool", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Whirlpool", type: "hazard" },
            { roll: 21, name: "Will-o-wisp", number: "1", ac: -8, move: '18"', hd: "9", thac0: 12, damage: "2d8", size: "S", inLair: 5, other: "10% encounter d3" }
        ]);

        // Deep water V tier (between Rare and Very Rare in the doc)
        this.tables.set('SALT_WATER_DEEP_VERY_RARE_LOW', [
            { roll: 1, name: "Dragon Turtle", number: "1", ac: 0, move: '3"/9"', hd: "12-14", thac0: "9-8", damage: "2d6/2d6/4d8", size: "L", inLair: 5, other: "Breath Weapon. Capsize", canSubmerge: true },
            { roll: 2, name: "Dragon, Cloud", number: "1", ac: "0/-3", move: '6"/39"', hd: "12-14", thac0: "9-8", damage: "d10/d10/3d12/3d4", size: "L", inLair: 25, other: "5% Two." },
            { roll: 3, name: "Elemental, Air", number: "1", ac: 2, move: '36"', hd: "8/12/16", thac0: "12/9/7", damage: "2d10", size: "L", inLair: 0, other: null },
            { roll: 4, name: "Elemental, Water", number: "1", ac: 2, move: '6"//18"', hd: "8/12/16", thac0: "12/9/7", damage: "5d6", size: "L", inLair: 0, other: "Capsize", canSubmerge: true },
            { roll: 5, name: "Giant, Frost", number: "d8", ac: 4, move: '12"', hd: "10+1-4", thac0: "10-8", damage: "4d6", size: "L", inLair: 30, other: "See AC10 - Iceberg" },
            { roll: 6, name: "Kal-Muru (Ship-bane)", number: "10-60", ac: 4, move: '12"', hd: "2*", thac0: 16, damage: "d3/d3/d6", size: "L", inLair: 0, other: "Create Fog, Confusion" },
            { roll: 7, name: "Kraken", number: "1", ac: "5/0", move: '//3" (21")', hd: "20", thac0: 7, damage: "2d6x2/2d4x6/5d4", size: "L", inLair: 75, other: "Spell Use, Drag Under", canSubmerge: true },
            { roll: 8, name: "Maelstrom", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Maelstrom", type: "hazard" },
            { roll: 9, name: "Nereid", number: "d4*20", ac: 10, move: '12"', hd: "4", thac0: 15, damage: null, size: "M", inLair: 100, other: "95% undetectable. Blinding. Kiss." },
            { roll: 10, name: "Lycanthrope, Seawolf, Greater", number: "4d4", ac: 5, move: '9"//27"', hd: "9+2", thac0: 12, damage: "3d4", size: "L", inLair: 0, other: "Cold waters" },
            { roll: 11, name: "Lycanthrope, Seawolf, Lesser", number: "3d6", ac: "6(7)", move: '30"//12"', hd: "2+2", thac0: 16, damage: "2d4", size: "M", inLair: 0, other: null },
            { roll: 12, name: "Sirine", number: "1", ac: 2, move: '12"//24"', hd: "4-7", thac0: "15-13", damage: "By weapon", size: "M", inLair: 30, other: "In lair encounter 2-8" },
            { roll: 13, name: "Water Weird", number: "d3", ac: 4, move: '12"', hd: "3+3", thac0: 15, damage: "0", size: "L", inLair: 50, other: "Drowning" }
        ]);

        // Deep water true Very Rare
        this.tables.set('SALT_WATER_DEEP_VERY_RARE', [
            { roll: 1, name: "Kuo-toa", number: "2d12", ac: 4, move: '9"//18"', hd: "2+", thac0: 16, damage: "by weapon/d4+1", size: "M", inLair: 0, other: "War bands, clerics, shield glue, lightning, slippery, surprised 1 in 6, immune poison/paralysis. See FF.", canSubmerge: true },
            { roll: 2, name: "Urchin, Yellow", number: "d3", ac: 1, move: '12"//18"', hd: "4+2", thac0: 15, damage: "d6x4", size: "S", inLair: 10, other: "Clairvoyant, hidden, poison (paralysis)" },
            { roll: 3, name: "Urchin, Silver", number: "d2", ac: 0, move: '12"//21"', hd: "5+3", thac0: 15, damage: "d4+1x5", size: "S", inLair: 10, other: "Clairvoyant, hidden, poison (catatonic)" },
            { roll: 4, name: "Lycanthrope, Wereshark", number: "1", ac: 0, move: '12"//21"', hd: "10+3", thac0: 10, damage: "5d4", size: "L", inLair: 20, other: null }
        ]);
    }

    // =========================================================================
    // FRESH WATER (check morning, evening, midnight — 3x/day)
    // Uses Shallow tables as base with freshwater-appropriate creatures
    // =========================================================================

    static registerFreshTables() {
        this.tables.set('FRESH_COMMON', [
            { roll: 1, name: "Crocodile, common", number: "3d8", ac: 5, move: '6"//12"', hd: "3", thac0: 16, damage: "2d4/d12", size: "L", inLair: 0, other: "Surprise 3 in 6", canSubmerge: true },
            { roll: 2, name: "Men, merchant", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "80% carrying d100% cargo", type: "ship" },
            { roll: 3, name: "Ray, sting", number: "d3", ac: 7, move: '9"', hd: "1", thac0: 19, damage: "d3", size: "S", inLair: 0, other: "90% invisible, poison" },
            { roll: 4, name: "Seaweed, Floating", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Seaweed", type: "hazard" },
            { roll: 5, name: "Shark", number: "3d4", ac: 6, move: '//24"', hd: "3-8", thac0: "16-13", damage: "d4+1/2d4/3d4", size: "M-L", inLair: 0, other: "Freshwater bull shark" },
            { roll: 6, name: "Beetle, giant water", number: "d12", ac: 3, move: '3"//12"', hd: "4", thac0: 15, damage: "3d6", size: "L", inLair: 0, other: null }
        ]);

        this.tables.set('FRESH_UNCOMMON', [
            { roll: 1, name: "Dolphin", number: "2d10", ac: 5, move: '//30"', hd: "2+2", thac0: 16, damage: "2d4", size: "M", inLair: 0, other: "River dolphin" },
            { roll: 2, name: "Eel, Giant", number: "d4", ac: 6, move: '//9"', hd: "5", thac0: 15, damage: "3d6/2d10", size: "M", inLair: 0, other: null },
            { roll: 3, name: "Lamprey, Normal", number: "d2", ac: 7, move: '12"', hd: "1+2", thac0: 18, damage: "d2", size: "S", inLair: 0, other: "Drain blood (2 hp/HD)" },
            { roll: 4, name: "Lobster, giant (crayfish)", number: "d4", ac: 4, move: '6"//12"', hd: "4+4", thac0: 15, damage: "2d6/2d6", size: "L", inLair: 0, other: "Surprise 3 in 6" },
            { roll: 5, name: "Men, buccaneer", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "River pirates", type: "ship", canBoard: true },
            { roll: 6, name: "Men, smuggler", number: "5d6*10", ac: null, move: '12"', hd: "1", thac0: null, damage: "W", size: "M", inLair: 20, other: "80% carrying d100% cargo", type: "ship" },
            { roll: 7, name: "Ogre (Merrow)", number: "2d12", ac: 4, move: '6"//12"', hd: "4+4", thac0: 15, damage: "d6/d6/2d4", size: "L", inLair: 20, other: "Surprise 4 in 6", canSubmerge: true },
            { roll: 8, name: "Otter, sea", number: "d4", ac: 5, move: '12"//18"', hd: "1+1", thac0: 18, damage: "d3", size: "S", inLair: 20, other: null },
            { roll: 9, name: "Snake, Giant Sea Serpent", number: "d8", ac: 5, move: '//12"', hd: "8-10", thac0: "12-10", damage: "d6/3d6", size: "L", inLair: 0, other: "Poison, Constriction, only 20% attack" },
            { roll: 10, name: "Turtle, giant, sea", number: "d3", ac: "2/5", move: '1"//15"', hd: "15", thac0: 8, damage: "4d3", size: "L", inLair: 0, other: "Non-aggressive. Capsize" },
            { roll: 11, name: "Urchin, Black", number: "d6", ac: 4, move: '9"//15"', hd: "1+1", thac0: 18, damage: "d6", size: "S", inLair: 10, other: "Clairvoyant, hidden" }
        ]);

        this.tables.set('FRESH_RARE', [
            { roll: 1, name: "Crab, Giant", number: "2d6", ac: 3, move: '9"', hd: "3", thac0: 16, damage: "2d8/2d8", size: "L", inLair: 0, other: null },
            { roll: 2, name: "Crocodile, giant", number: "d2", ac: 4, move: '6"/12"', hd: "7", thac0: 13, damage: "3d6/2d10", size: "L", inLair: 0, other: "Surprise", canSubmerge: true },
            { roll: 3, name: "Ghost Ship", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Ghost Ship", type: "subtable" },
            { roll: 4, name: "Ice", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "Ice floes, 10-16 feet. See Ice", type: "hazard" },
            { roll: 5, name: "Island", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Island sub-table", type: "subtable" },
            { roll: 6, name: "Lacedon", number: "2d12", ac: 6, move: '9"', hd: "2", thac0: 16, damage: "d3/d3/d3", size: "M", inLair: 20, other: "Paralyze, Undead", canSubmerge: true },
            { roll: 7, name: "Lamprey, Giant", number: "d4", ac: 6, move: '9"', hd: "5", thac0: 15, damage: "d6", size: "M", inLair: 0, other: "Drain blood (2 hp/HD)" },
            { roll: 8, name: "Lizard Man", number: "4d10", ac: "5(4)", move: '6"//12"', hd: "2+1", thac0: 16, damage: "d2/d2/d8", size: "M", inLair: 30, other: null, canSubmerge: true },
            { roll: 9, name: "Octopus, giant", number: "d3", ac: 7, move: '3"//12"', hd: "8", thac0: 12, damage: "d4x8", size: "L", inLair: 70, other: "25% pin arm" },
            { roll: 10, name: "Whirlpool", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Whirlpool", type: "hazard" },
            { roll: 11, name: "Will-o-wisp", number: "1", ac: -8, move: '18"', hd: "9", thac0: 12, damage: "2d8", size: "S", inLair: 5, other: "10% encounter d3" }
        ]);

        this.tables.set('FRESH_VERY_RARE', [
            { roll: 1, name: "Afanc", number: "1", ac: 6, move: '//15"', hd: "15", thac0: 8, damage: "5d4/3d4/3d4", size: "L", inLair: 0, other: "Creates whirlpool (see MM2). Capsize" },
            { roll: 2, name: "Dinosaur", number: null, ac: null, move: null, hd: null, thac0: null, damage: null, size: null, inLair: 0, other: "See Dinosaur Subtable (warm climate only)", type: "subtable" },
            { roll: 3, name: "Dragon Turtle", number: "1", ac: 0, move: '3"//9"', hd: "12-14", thac0: "9-8", damage: "2d6/2d6/4d8", size: "L", inLair: 5, other: "Breath Weapon. Capsize", canSubmerge: true },
            { roll: 4, name: "Kelpie", number: "d4", ac: 3, move: '9"//12"', hd: "5", thac0: 15, damage: null, size: "M", inLair: 70, other: "Charm at -2 and drown 2d10/round" },
            { roll: 5, name: "Water Weird", number: "d3", ac: 4, move: '12"', hd: "3+3", thac0: 15, damage: "0", size: "L", inLair: 50, other: "Drowning" }
        ]);
    }

    // =========================================================================
    // SUBTABLES
    // =========================================================================

    static registerSubtables() {
        this.subtables.set('DINOSAUR', [
            // Common
            { roll: 1, name: "Dinicthys", number: "d4", ac: 7, move: '//21"', hd: "10", thac0: 10, damage: "5d4", size: "L", inLair: 0, other: "Deep water only", frequency: "COMMON" },
            { roll: 2, name: "Plesiosaurus", number: "d3", ac: 7, move: '15"', hd: "20", thac0: 7, damage: "5d4", size: "L", inLair: 0, other: "Flipper attack in water. Warm climate fresh water", frequency: "COMMON" },
            { roll: 3, name: "Pteranodon", number: "3d6", ac: 7, move: '3"/15"', hd: "3+3", thac0: 16, damage: "2d8", size: "L", inLair: 0, other: "Carry 200 lbs. Shallow water only", frequency: "COMMON" },
            // Uncommon
            { roll: 4, name: "Archelon ischyras", number: "d4", ac: 3, move: '3"//15"', hd: "7", thac0: 13, damage: "3d4", size: "L", inLair: 0, other: "Turtle", frequency: "UNCOMMON" },
            { roll: 5, name: "Elasmosaurus", number: "d2", ac: 7, move: '15"', hd: "15", thac0: 8, damage: "4d6", size: "L", inLair: 0, other: "Warm climate fresh water", frequency: "UNCOMMON" },
            { roll: 6, name: "Mosasaurus", number: "d3", ac: 7, move: '3"//15"', hd: "12", thac0: 9, damage: "4d8", size: "L", inLair: 0, other: "Warm climate fresh water", frequency: "UNCOMMON" },
            { roll: 7, name: "Nothosaurus", number: "1", ac: 6, move: '3"//18"', hd: "14", thac0: 8, damage: "5d6", size: "L", inLair: 0, other: "Tropical. Foreflipper against soft targets", frequency: "UNCOMMON" },
            // Rare
            { roll: 8, name: "Tennodontosaur", number: "1", ac: 4, move: '//24"', hd: "10", thac0: 10, damage: "5d4", size: "L", inLair: 0, other: "10% 2. Rear tail attack", frequency: "RARE" },
            { roll: 9, name: "Giant Pterosaur", number: "d8", ac: 5, move: '3"/12"', hd: "6+6", thac0: 13, damage: "3d4", size: "L", inLair: 0, other: "Dive +4 to hit, 2x damage. Carry 300 lbs", frequency: "RARE" }
        ]);

        this.subtables.set('ISLAND', [
            { roll: 1, name: "Floating Rock", source: "Dungeon Magazine #046" },
            { roll: 2, name: "Needle", source: "I11" },
            { roll: 3, name: "Castanamir", source: "C3" },
            { roll: 4, name: "Wreck of Shining Star", source: "Dungeon Magazine #015" },
            { roll: 5, name: "Triffids", source: null },
            { roll: 6, name: "Drums on Fire Mountain", source: "X8" },
            { roll: 7, name: "Tamoachan", source: "C1" },
            { roll: 8, name: "Crystal Caves", source: "UK1" },
            { roll: 9, name: "Lizardmen Floating Island", source: "Gaz 4" },
            { roll: 10, name: "War Rafts", source: "X7" },
            { roll: 11, name: "Barrier Peaks", source: "S3" },
            { roll: 12, name: "Sunken Atoll", source: "OA1" },
            { roll: 13, name: "Secret Pirate Base", source: "X1, A3, Threshold #04, GAZ9, GAZ4" },
            { roll: 14, name: "Temple of Poseidon", source: "Dragon Magazine #46" },
            { roll: 15, name: "Roll again (two populations)", source: null },
            { roll: 16, name: "Roll again (two populations)", source: null }
        ]);

        this.subtables.set('GHOST_SHIP_CREW', [
            { minRoll: 1, maxRoll: 40, crew: "Skeletons", number: "10-40" },
            { minRoll: 41, maxRoll: 80, crew: "Zombies", number: "10-40" },
            { minRoll: 81, maxRoll: 100, crew: "Juju Zombies", number: "10-20" }
        ]);

        this.subtables.set('GHOST_SHIP_OFFICERS', [
            { minRoll: 1, maxRoll: 30, officer: "Wight", number: "1-4" },
            { minRoll: 31, maxRoll: 60, officer: "Wraith", number: "1-3" },
            { minRoll: 61, maxRoll: 80, officer: "Spectre", number: "1-2" },
            { minRoll: 81, maxRoll: 95, officer: "Ghost", number: "1-2" },
            { minRoll: 96, maxRoll: 100, officer: "Lich", number: "1" }
        ]);

        this.subtables.set('SUNKEN_SHIP', [
            { minRoll: 1, maxRoll: 10, contents: "Merchant treasure", other: "See Man, Merchants" },
            { minRoll: 11, maxRoll: 20, contents: "No treasure", other: null },
            { minRoll: 21, maxRoll: 60, contents: "Lacedons", number: "2d12", other: "From original crew" },
            { minRoll: 61, maxRoll: 100, contents: "Other monsters", other: "Roll on main chart" }
        ]);

        this.subtables.set('OTHER_ENCOUNTERS', [
            { roll: 1, name: "Seaweed, Floating", type: "hazard" },
            { roll: 2, name: "Ghost Ship", type: "subtable" },
            { roll: 3, name: "Ice", type: "hazard" },
            { roll: 4, name: "Land Encounter", type: "special" },
            { roll: 5, name: "Omen", type: "special" },
            { roll: 6, name: "Reef/Shoals", type: "hazard" },
            { roll: 7, name: "Seaweed, Bed", type: "hazard" },
            { roll: 8, name: "Shipboard Fire", type: "hazard" },
            { roll: 9, name: "Sunken Ship", type: "subtable" },
            { roll: 10, name: "Whirlpool/Maelstrom", type: "hazard" }
        ]);
    }

    // =========================================================================
    // EFFECTS REGISTRY - special encounter mechanics
    // =========================================================================

    static registerEffects() {
        this.effects.set("seaweed", {
            movementPenalty: 50,
            additionalEncounterChance: 40,
            notes: "Floating seaweed slows ship by 50%. 40% chance of another encounter."
        });

        this.effects.set("seaweed_bed", {
            movementPenalty: 50,
            additionalEncounterChance: 30,
            visionReduction: 10,
            notes: "Underwater seaweed bed, 30-300' high. Vision reduced to 10'. 30% chance of another encounter."
        });

        this.effects.set("ghost_ship", {
            notes: "Manned by undead sailors. Attacks at night when masters at full power.",
            dayAttackChance: 10,
            nightAttackChance: 75
        });

        this.effects.set("ice_freshwater", {
            damagePerRound: "1d6",
            holeChance: 10,
            sizeRange: "10-16 feet",
            notes: "Ice floes do 1-6 hull damage per round in contact. 10% chance of holing ship."
        });

        this.effects.set("ice_saltwater", {
            damagePerRound: "1d6",
            holeChance: 10,
            sizeRange: "10-60 feet",
            fieldSize: "10-20 icebergs",
            notes: "Icebergs range from single mountains to fields of 10-20. 1-6 hull damage/round, 10% hole."
        });

        this.effects.set("whirlpool", {
            duration: "d6 hours",
            dragSpeed: "1\"/round cumulative",
            escapeMethod: "Exceed flow speed",
            breakApart: "6 rounds if not escaped",
            pilotingPenalty: -4,
            cumulativePenalty: -2,
            endDamage: "2d10",
            smallCraftOnly: 75,
            notes: "Ships dragged at 1\"/round cumulative. Must exceed flow speed. Seamanship check at -4. If not escaped, breaks apart in d6 rounds."
        });

        this.effects.set("maelstrom", {
            catchRange: 3,
            escapeSpeed: 18,
            entryTime: "d4 turns",
            dragSpeed: "1\"/round cumulative",
            notes: "Any ship within 3 miles caught unless movement 18\"+. Enters vortex in d4 turns. Same drag/escape as whirlpool."
        });

        this.effects.set("island_reef", {
            reefChance: 10,
            reefDamage: "2d12",
            holeChance: 20,
            notes: "Islands have 10% chance of surrounding reefs. Reefs do 2-12 hull damage, 20% chance of holing."
        });

        this.effects.set("omen", {
            moraleModifier: 5,
            goodChance: 50,
            examples: {
                bad: ["Bloody sea", "Wounded/dead albatross", "Phantom ship sighting", "Cloud formations of sea monsters"],
                good: ["Fair winds", "Dolphins following ship", "Clear stars", "Seabirds overhead"]
            },
            notes: "Half good, half bad. +/- 5% crew morale."
        });

        this.effects.set("shipboard_fire", {
            notes: "Roll on Burn Damage table for damage before/if fire extinguished.",
            type: "hazard"
        });

        this.effects.set("sunken_ship", {
            notes: "May contain treasure and/or inhabitants. Roll on Sunken Ship subtable."
        });

        this.effects.set("capsize", {
            notes: "Sea Snake, Dragon Turtle, and similar creatures attempt to capsize ships on attack."
        });

        this.effects.set("collision", {
            notes: "Reef/shoals may cause ship to run aground. See Collision rules."
        });
    }

    // =========================================================================
    // LOOKUP METHODS
    // =========================================================================

    static getTable(tableName) {
        return this.tables.get(tableName);
    }

    static getEffect(effectKey) {
        return this.effects.get(effectKey);
    }

    static getSubtable(name) {
        return this.subtables.get(name);
    }

    /**
     * Roll on a specific encounter table.
     * @param {string} waterType - SHALLOW, DEEP, or FRESH
     * @param {string} frequency - COMMON, UNCOMMON, RARE, VERY_RARE
     * @returns {Object|null} encounter entry
     */
    static rollEncounter(waterType = "SHALLOW", frequency = "COMMON") {
        const prefix = waterType === "FRESH" ? "FRESH" : `SALT_WATER_${waterType}`;
        const tableName = `${prefix}_${frequency}`;
        let table = this.getTable(tableName);

        // Deep water has a split very rare tier (VERY_RARE_LOW and VERY_RARE)
        if (!table && waterType === "DEEP" && frequency === "VERY_RARE") {
            const roll = Math.random();
            table = roll < 0.75
                ? this.getTable('SALT_WATER_DEEP_VERY_RARE_LOW')
                : this.getTable('SALT_WATER_DEEP_VERY_RARE');
        }

        if (!table || table.length === 0) return null;

        const index = Math.floor(Math.random() * table.length);
        const entry = { ...table[index] };

        // Resolve subtable references
        if (entry.type === "subtable") {
            entry.subtableResult = this.rollSubtable(entry.name);
        }

        return entry;
    }

    /**
     * Roll on a subtable by encounter name
     */
    static rollSubtable(encounterName) {
        const name = encounterName.toLowerCase();

        if (name.includes("dinosaur")) {
            const table = this.subtables.get('DINOSAUR');
            if (!table) return null;
            const index = Math.floor(Math.random() * table.length);
            return table[index];
        }

        if (name.includes("island")) {
            const table = this.subtables.get('ISLAND');
            if (!table) return null;
            // 85% deserted, 15% inhabited
            const desertedRoll = Math.floor(Math.random() * 100) + 1;
            if (desertedRoll <= 85) {
                return { name: "Deserted Island", reef: Math.random() < 0.10, mountainous: Math.random() < 0.75 };
            }
            const index = Math.floor(Math.random() * table.length);
            return { ...table[index], reef: Math.random() < 0.10, mountainous: Math.random() < 0.75 };
        }

        if (name.includes("ghost ship")) {
            return this.rollGhostShip();
        }

        if (name.includes("sunken")) {
            return this.rollSunkenShip();
        }

        return null;
    }

    /**
     * Generate a ghost ship encounter
     */
    static rollGhostShip() {
        const crewTable = this.subtables.get('GHOST_SHIP_CREW');
        const officerTable = this.subtables.get('GHOST_SHIP_OFFICERS');
        const crewRoll = Math.floor(Math.random() * 100) + 1;
        const officerRoll = Math.floor(Math.random() * 100) + 1;

        const crew = crewTable.find(e => crewRoll >= e.minRoll && crewRoll <= e.maxRoll);
        const officer = officerTable.find(e => officerRoll >= e.minRoll && officerRoll <= e.maxRoll);

        return {
            name: "Ghost Ship",
            crew: crew?.crew || "Skeletons",
            crewNumber: crew?.number || "10-40",
            officer: officer?.officer || "Wight",
            officerNumber: officer?.number || "1-4",
            attacksAtNight: true,
            notes: `Crewed by ${crew?.number || '10-40'} ${crew?.crew || 'skeletons'}, commanded by ${officer?.number || '1-4'} ${officer?.officer || 'wight'}(s)`
        };
    }

    /**
     * Generate a sunken ship encounter
     */
    static rollSunkenShip() {
        const table = this.subtables.get('SUNKEN_SHIP');
        const roll = Math.floor(Math.random() * 100) + 1;
        const result = table.find(e => roll >= e.minRoll && roll <= e.maxRoll);
        return {
            name: "Sunken Ship",
            contents: result?.contents || "No treasure",
            number: result?.number || null,
            other: result?.other || null,
            notes: `Sunken vessel: ${result?.contents || 'empty'}${result?.number ? ` (${result.number})` : ''}`
        };
    }

    /**
     * Sea monster movement rates for chase/flee calculations
     */
    static MONSTER_SPEEDS = {
        "dolphin": 30, "dragon turtle": 9, "eye of the deep": 6,
        "locathah": 12, "merman": 18, "octopus": 12,
        "sahuagin": 24, "sea hag": 15, "sea lion": 18,
        "sea horse": 21, "shark": 24, "megalodon": 18,
        "squid": 18, "whale": 24
    };

    /**
     * Get monster movement rate for chase calculations
     */
    static getMonsterSpeed(name) {
        const key = name.toLowerCase();
        for (const [monster, speed] of Object.entries(this.MONSTER_SPEEDS)) {
            if (key.includes(monster)) return speed;
        }
        return null;
    }
}
