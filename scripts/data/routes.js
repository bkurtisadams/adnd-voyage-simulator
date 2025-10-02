/**
 * Route Registry
 * Manages trade route definitions
 */

export class RouteRegistry {
    static routes = new Map();

    static initialize() {
        const routeData = {
            nyr_dyv_circuit: {
                name: "Nyr Dyv Circuit",
                ports: ["verbobonc", "dyvers", "greyhawk_city", "leukish"],
                description: "Classic circuit around the Nyr Dyv lake"
            },
            greyhawk_dyvers: {
                name: "Greyhawk ↔ Dyvers",
                ports: ["greyhawk_city", "dyvers"],
                description: "Direct route between major cities"
            },
            southern_route: {
                name: "Southern Route",
                ports: ["leukish", "greyhawk_city", "dyvers", "verbobonc"],
                description: "Southern coastal trade route"
            },
            relmor_bay_circuit: {
                name: "Relmor Bay Circuit",
                ports: ["hardby", "rel_mord", "gradsul"],
                description: "Circuit around Relmor Bay"
            },
            gearnat_relmor_trade: {
                name: "Gearnat-Relmor Inter-Bay Trade",
                ports: ["greyhawk_city", "hardby", "rel_mord", "gradsul", "greyhawk_city"],
                description: "Trade route connecting the two major bays"
            },
            hardby_to_gradsul: {
                name: "Hardby ↔ Gradsul",
                ports: ["hardby", "gradsul"],
                description: "Direct route across Relmor Bay"
            },
            nyr_dyv_eastern_loop: {
                name: "Nyr Dyv Eastern Loop",
                ports: ["greyhawk_city", "hardby", "safeton", "fax", "greyhawk_city"],
                description: "Eastern loop around Nyr Dyv"
            },
            nyr_dyv_western_loop: {
                name: "Nyr Dyv Western Loop",
                ports: ["greyhawk_city", "safeton", "nessermouth", "greyhawk_city"],
                description: "Western loop around Nyr Dyv"
            },
            southern_coastal_route: {
                name: "Southern Coastal Route",
                ports: ["port_elredd", "leukish", "greyhawk_city", "port_elredd"],
                description: "Southern coastal circuit"
            },
            heart_of_nyr_dyv: {
                name: "Heart of Nyr Dyv Triangle",
                ports: ["greyhawk_city", "safeton", "dyvers", "greyhawk_city"],
                description: "Triangle route through the heart of Nyr Dyv"
            },
            relmor_bay_western_trade: {
                name: "Relmor Bay Western Trade",
                ports: ["hardby", "rel_mord", "fax", "hardby"],
                description: "Western Relmor Bay trade circuit"
            }
        };

        for (const [id, data] of Object.entries(routeData)) {
            this.routes.set(id, data);
        }

        console.log(`Route Registry | Registered ${this.routes.size} routes`);
    }

    static get(id) {
        return this.routes.get(id);
    }

    static getAll() {
        return Array.from(this.routes.entries()).map(([id, data]) => ({ id, ...data }));
    }

    static calculateTotalDistance(routeId) {
        const route = this.get(routeId);
        if (!route) return 0;

        // PortRegistry is already imported at the top of the file
        let totalDistance = 0;

        for (let i = 0; i < route.ports.length - 1; i++) {
            const distance = PortRegistry.getDistance(route.ports[i], route.ports[i + 1]);
            if (distance) totalDistance += distance;
        }

        return totalDistance;
    }
}