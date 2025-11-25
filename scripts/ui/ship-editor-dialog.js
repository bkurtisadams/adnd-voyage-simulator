/**
 * Ship Editor Dialog
 * Allows editing ship properties including hull points
 */

import { ShipRegistry } from '../data/ships.js';

export class ShipEditorDialog extends FormApplication {
    
    constructor(shipId = null) {
        super({}, {});
        this.selectedShipId = shipId;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'ship-editor-dialog',
            title: 'Ship Editor',
            template: 'modules/adnd-voyage-simulator/templates/ship-editor.hbs',
            width: 600,
            height: 'auto',
            closeOnSubmit: false,
            submitOnChange: false,
            resizable: true,
            classes: ['adnd-voyage', 'ship-editor']
        });
    }

    getData() {
        const ships = ShipRegistry.getAll();
        const selectedShip = this.selectedShipId 
            ? ShipRegistry.get(this.selectedShipId)
            : ships[0];
        
        this.selectedShipId = selectedShip?.id || ships[0]?.id;

        return {
            ships: ships.map(s => ({
                id: s.id,
                name: s.name,
                selected: s.id === this.selectedShipId
            })),
            ship: selectedShip,
            hasShip: !!selectedShip
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('#shipSelect').change(this._onShipChange.bind(this));
        html.find('#resetHull').click(this._onResetHull.bind(this));
        html.find('#addCrew').click(this._onAddCrew.bind(this));
        html.find('.delete-crew').click(this._onDeleteCrew.bind(this));
    }

    async _onShipChange(event) {
        this.selectedShipId = event.target.value;
        this.render(true);
    }

    async _onResetHull(event) {
        event.preventDefault();
        const ship = ShipRegistry.get(this.selectedShipId);
        if (!ship) return;

        ship.hullPoints.value = ship.hullPoints.max;
        ui.notifications.info(`${ship.name} hull reset to ${ship.hullPoints.max}`);
        this.render(true);
    }

    async _onAddCrew(event) {
        event.preventDefault();
        const ship = ShipRegistry.get(this.selectedShipId);
        if (!ship) return;

        ship.crew.push({
            role: "sailor",
            level: 0,
            count: 1
        });
        this.render(true);
    }

    async _onDeleteCrew(event) {
        event.preventDefault();
        const ship = ShipRegistry.get(this.selectedShipId);
        if (!ship) return;

        const index = parseInt(event.currentTarget.dataset.index);
        ship.crew.splice(index, 1);
        this.render(true);
    }

    async _updateObject(event, formData) {
        const ship = ShipRegistry.get(this.selectedShipId);
        if (!ship) return;

        // Update basic properties
        ship.name = formData.name;
        ship.shipType = formData.shipType;
        ship.hullPoints.value = parseInt(formData.hullValue) || 0;
        ship.hullPoints.max = parseInt(formData.hullMax) || 1;
        ship.cargoCapacity = parseInt(formData.cargoCapacity) || 0;
        ship.movement = parseInt(formData.movement) || 0;
        ship.baseEarningsPerDay = parseInt(formData.baseEarningsPerDay) || 0;
        ship.currentPort = formData.currentPort;

        // Update captain
        ship.captain.name = formData.captainName;
        ship.captain.level = parseInt(formData.captainLevel) || 0;

        // Update crew from form data
        const crewUpdates = [];
        for (const [key, value] of Object.entries(formData)) {
            const crewMatch = key.match(/^crew_(\d+)_(\w+)$/);
            if (crewMatch) {
                const index = parseInt(crewMatch[1]);
                const field = crewMatch[2];
                
                if (!crewUpdates[index]) {
                    crewUpdates[index] = {};
                }
                crewUpdates[index][field] = field === 'role' ? value : parseInt(value) || 0;
            }
        }

        // Apply crew updates
        crewUpdates.forEach((update, index) => {
            if (ship.crew[index] && update) {
                Object.assign(ship.crew[index], update);
            }
        });

        ui.notifications.info(`${ship.name} updated successfully!`);
        this.render(true);
    }
}