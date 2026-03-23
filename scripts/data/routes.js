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
                description: "Classic circuit around the Nyr Dyv lake",
                segments: [
                    { from: "verbobonc", to: "dyvers", waterType: "lake" },
                    { from: "dyvers", to: "greyhawk_city", waterType: "lake" },
                    { from: "greyhawk_city", to: "leukish", waterType: "lake" }
                ]
            },
            greyhawk_dyvers: {
                name: "Greyhawk ↔ Dyvers",
                ports: ["greyhawk_city", "dyvers"],
                description: "Direct route between major cities",
                segments: [
                    { from: "greyhawk_city", to: "dyvers", waterType: "lake" }
                ]
            },
            southern_route: {
                name: "Southern Route",
                ports: ["leukish", "greyhawk_city", "dyvers", "verbobonc"],
                description: "Southern coastal trade route",
                segments: [
                    { from: "leukish", to: "greyhawk_city", waterType: "lake" },
                    { from: "greyhawk_city", to: "dyvers", waterType: "lake" },
                    { from: "dyvers", to: "verbobonc", waterType: "river" }
                ]
            },
            relmor_bay_circuit: {
                name: "Relmor Bay Circuit",
                ports: ["hardby", "rel_mord", "gradsul"],
                description: "Circuit around Relmor Bay",
                segments: [
                    { from: "hardby", to: "rel_mord", waterType: "coastal" },
                    { from: "rel_mord", to: "gradsul", waterType: "coastal" }
                ]
            },
            gearnat_relmor_trade: {
                name: "Gearnat-Relmor Inter-Bay Trade",
                ports: ["greyhawk_city", "hardby", "rel_mord", "gradsul", "greyhawk_city"],
                description: "Trade route connecting the two major bays",
                segments: [
                    { from: "greyhawk_city", to: "hardby", waterType: "openWater" },
                    { from: "hardby", to: "rel_mord", waterType: "coastal" },
                    { from: "rel_mord", to: "gradsul", waterType: "coastal" },
                    { from: "gradsul", to: "greyhawk_city", waterType: "openWater" }
                ]
            },
            hardby_to_gradsul: {
                name: "Hardby ↔ Gradsul",
                ports: ["hardby", "gradsul"],
                description: "Direct route across Relmor Bay",
                segments: [
                    { from: "hardby", to: "gradsul", waterType: "openWater" }
                ]
            },
            nyr_dyv_eastern_loop: {
                name: "Nyr Dyv Eastern Loop",
                ports: ["greyhawk_city", "hardby", "safeton", "fax", "greyhawk_city"],
                description: "Eastern loop around Nyr Dyv",
                segments: [
                    { from: "greyhawk_city", to: "hardby", waterType: "coastal" },
                    { from: "hardby", to: "safeton", waterType: "coastal" },
                    { from: "safeton", to: "fax", waterType: "lake" },
                    { from: "fax", to: "greyhawk_city", waterType: "lake" }
                ]
            },
            nyr_dyv_western_loop: {
                name: "Nyr Dyv Western Loop",
                ports: ["greyhawk_city", "safeton", "nessermouth", "greyhawk_city"],
                description: "Western loop around Nyr Dyv",
                segments: [
                    { from: "greyhawk_city", to: "safeton", waterType: "lake" },
                    { from: "safeton", to: "nessermouth", waterType: "river" },
                    { from: "nessermouth", to: "greyhawk_city", waterType: "lake" }
                ]
            },
            southern_coastal_route: {
                name: "Southern Coastal Route",
                ports: ["port_elredd", "leukish", "greyhawk_city", "port_elredd"],
                description: "Southern coastal circuit",
                segments: [
                    { from: "port_elredd", to: "leukish", waterType: "coastal" },
                    { from: "leukish", to: "greyhawk_city", waterType: "lake" },
                    { from: "greyhawk_city", to: "port_elredd", waterType: "coastal" }
                ]
            },
            heart_of_nyr_dyv: {
                name: "Heart of Nyr Dyv Triangle",
                ports: ["greyhawk_city", "safeton", "dyvers", "greyhawk_city"],
                description: "Triangle route through the heart of Nyr Dyv",
                segments: [
                    { from: "greyhawk_city", to: "safeton", waterType: "lake" },
                    { from: "safeton", to: "dyvers", waterType: "lake" },
                    { from: "dyvers", to: "greyhawk_city", waterType: "lake" }
                ]
            },
            relmor_bay_western_trade: {
                name: "Relmor Bay Western Trade",
                ports: ["hardby", "rel_mord", "fax", "hardby"],
                description: "Western Relmor Bay trade circuit",
                segments: [
                    { from: "hardby", to: "rel_mord", waterType: "coastal" },
                    { from: "rel_mord", to: "fax", waterType: "coastal" },
                    { from: "fax", to: "hardby", waterType: "coastal" }
                ]
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

    /**
     * Get the waterType for a specific leg of a route.
     * Falls back to "coastal" if no segment data exists.
     */
    static getSegmentWaterType(routeId, fromPortId, toPortId) {
        const route = this.get(routeId);
        if (!route?.segments) return "coastal";
        const seg = route.segments.find(s => s.from === fromPortId && s.to === toPortId);
        return seg?.waterType || "coastal";
    }
}