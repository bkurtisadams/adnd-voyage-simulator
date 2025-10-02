/**
 * Port Registry
 * Manages port definitions and connections
 */

export class PortRegistry {
    static ports = new Map();
    static MILES_PER_INCH_DAILY = 8;

    static initialize() {
        // Register all ports
        const portData = {
            greyhawk_city: {
                name: "City of Greyhawk",
                size: "Major Port",
                connections: {
                    dyvers: 390,
                    verbobonc: 600,
                    leukish: 420,
                    hardby: 180,
                    safeton: 240,
                    fax: 480,
                    port_elredd: 480,
                    nessermouth: 870
                }
            },
            dyvers: {
                name: "Dyvers",
                size: "Port",
                connections: {
                    greyhawk_city: 390,
                    verbobonc: 210,
                    leukish: 570,
                    hardby: 570,
                    safeton: 630,
                    fax: 870,
                    port_elredd: 990
                }
            },
            verbobonc: {
                name: "Verbobonc",
                size: "Port",
                connections: {
                    greyhawk_city: 600,
                    dyvers: 210,
                    leukish: 780
                }
            },
            leukish: {
                name: "Leukish",
                size: "Minor Port",
                connections: {
                    greyhawk_city: 420,
                    dyvers: 570,
                    verbobonc: 780,
                    port_elredd: 350
                }
            },
            hardby: {
                name: "Hardby",
                size: "Major Port",
                connections: {
                    rel_mord: 150,
                    gradsul: 200,
                    greyhawk_city: 650,
                    fax: 300,
                    port_elredd: 600
                }
            },
            safeton: {
                name: "Safeton",
                size: "Port",
                connections: {
                    greyhawk_city: 250,
                    dyvers: 200,
                    nessermouth: 100
                }
            },
            fax: {
                name: "Fax",
                size: "Minor Port",
                connections: {
                    greyhawk_city: 180,
                    hardby: 300,
                    rel_mord: 400
                }
            },
            port_elredd: {
                name: "Port Elredd",
                size: "Major Port",
                connections: {
                    greyhawk_city: 500,
                    leukish: 350,
                    hardby: 600,
                    rel_mord: 700
                }
            },
            nessermouth: {
                name: "Nessermouth",
                size: "Minor Port",
                connections: {
                    safeton: 100,
                    greyhawk_city: 200
                }
            },
            rel_mord: {
                name: "Rel Mord",
                size: "Port",
                connections: {
                    hardby: 150,
                    gradsul: 100,
                    fax: 400,
                    port_elredd: 700
                }
            },
            gradsul: {
                name: "Gradsul",
                size: "Port",
                connections: {
                    hardby: 200,
                    rel_mord: 100
                }
            }
        };

        for (const [id, data] of Object.entries(portData)) {
            this.ports.set(id, data);
        }

        console.log(`Port Registry | Registered ${this.ports.size} ports`);
    }

    static get(id) {
        return this.ports.get(id);
    }

    static getAll() {
        return Array.from(this.ports.values());
    }

    static getSizeModifier(portSize) {
        switch (portSize) {
            case "Major Port": return +2;
            case "Port": return +1;
            case "Minor Port": return 0;
            default: return -2;
        }
    }

    static getDistance(fromId, toId) {
        const fromPort = this.get(fromId);
        if (!fromPort) return null;
        return fromPort.connections[toId] || null;
    }
}