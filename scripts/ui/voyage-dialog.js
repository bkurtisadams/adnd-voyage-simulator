/**
 * Voyage Setup Dialog
 * Main dialog for configuring and starting voyages
 */

import { ShipRegistry } from '../data/ships.js';
import { PortRegistry } from '../data/ports.js';
import { RouteRegistry } from '../data/routes.js';
import { VoyageSimulator } from '../voyage/simulation.js';

export class VoyageSetupDialog extends FormApplication {

    constructor(options = {}) {
        super({}, options);
        this.loadSavedSettings();
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "voyage-setup-dialog",
            classes: ["adnd-voyage-simulator", "sheet"],
            title: "AD&D Voyage Simulator - Setup",
            template: "modules/adnd-voyage-simulator/templates/voyage-setup.hbs",
            width: 700,
            height: "auto",
            tabs: [
                { navSelector: ".tabs", contentSelector: ".sheet-body", initial: "voyage-details" }
            ],
            closeOnSubmit: false,
            submitOnChange: false,
            resizable: true
        });
    }

    loadSavedSettings() {
        this.savedData = game.settings.get('adnd-voyage-simulator', 'lastVoyageSettings') || {};
    }

    async getData() {
        const data = await super.getData();

        data.ships = ShipRegistry.getAll().map(ship => ({
            id: ship.id,
            name: `${ship.name} (${ship.shipType})`,
            selected: ship.id === this.savedData.shipID
        }));

        data.routes = RouteRegistry.getAll().map(route => ({
            id: route.id,
            name: route.name,
            description: route.description,
            selected: route.id === this.savedData.routeID
        }));

        data.crewQualities = [
            { value: "Landlubber", label: "Landlubber (-2)", selected: this.savedData.crewQuality === "Landlubber" },
            { value: "Green", label: "Green (-2)", selected: this.savedData.crewQuality === "Green" },
            { value: "Average", label: "Average (-1)", selected: this.savedData.crewQuality === "Average" },
            { value: "Trained", label: "Trained (0)", selected: this.savedData.crewQuality === "Trained" || !this.savedData.crewQuality },
            { value: "Crack", label: "Crack (+1)", selected: this.savedData.crewQuality === "Crack" },
            { value: "Old Salts", label: "Old Salts (+2)", selected: this.savedData.crewQuality === "Old Salts" }
        ];

        data.months = [
            "Needfest", "Fireseek", "Readying", "Coldeven", "Growfest", "Planting",
            "Flocktime", "Wealsun", "Richfest", "Reaping", "Goodmonth", "Harvester",
            "Brewfest", "Patchwall", "Ready'reat", "Sunsebb"
        ].map(month => ({
            value: month,
            selected: month === this.savedData.startingMonth
        }));

        data.saved = this.savedData;
        data.saved.startingGold = data.saved.startingGold || 1000;
        data.saved.tradeMode = data.saved.tradeMode || "speculation";
        data.saved.commissionRate = data.saved.commissionRate || 25;
        data.saved.latitude = data.saved.latitude || 40;
        data.saved.longitude = data.saved.longitude || 0;
        data.saved.startingYear = data.saved.startingYear || 569;
        data.saved.startingDay = data.saved.startingDay || 1;

        data.captain = {
          name: this.savedData.captainName || "",
          rank: "Captain"
        };
        data.lieutenant = {
          name: this.savedData.ltName || "",
          rank: "Lieutenant"
        };
 
        const actor = canvas.tokens.controlled[0]?.actor;
        if (actor && !data.captain.name) {
          data.captain.name = actor.name;
        }

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('input[name="tradeMode"]').change(this._onTradeModeChange.bind(this));
        html.find('#automateTrading').change(this._onAutomateToggle.bind(this));
        html.find('button[type="submit"]').click(this._onSubmit.bind(this));
    }

    _onTradeModeChange(event) {
        const isConsignment = $(event.currentTarget).val() === 'consignment';
        const isAutomated = this.element.find('#automateTrading').is(':checked');
        
        if (isConsignment && !isAutomated) {
            this.element.find('#commissionRateGroup').show();
        } else {
            this.element.find('#commissionRateGroup').hide();
        }
    }

    _onAutomateToggle(event) {
        const isAutomated = $(event.currentTarget).is(':checked');
        
        if (isAutomated) {
            this.element.find('#manualTradeModeGroup').hide();
            this.element.find('#commissionRateGroup').hide();
        } else {
            this.element.find('#manualTradeModeGroup').show();
            const isConsignment = this.element.find('input[name="tradeMode"]:checked').val() === 'consignment';
            if (isConsignment) {
                this.element.find('#commissionRateGroup').show();
            }
        }
    }

    async _onSubmit(event) {
        event.preventDefault();
        
        const formData = this._getFormData();
        
        const validation = this._validateFormData(formData);
        if (!validation.valid) {
            ui.notifications.error(validation.message);
            return;
        }

        await game.settings.set('adnd-voyage-simulator', 'lastVoyageSettings', formData);

        const voyageConfig = this._buildVoyageConfig(formData);

        this.close();

        const simulator = new VoyageSimulator();
        await simulator.startVoyage(voyageConfig);
    }

    _getFormData() {
        const html = this.element;

        return {
            shipID: html.find('#shipID').val(),
            routeID: html.find('#routeID').val(),
            captainName: html.find('#captainName').val(),
            
            str: parseInt(html.find('#str').val()),
            dex: parseInt(html.find('#dex').val()),
            con: parseInt(html.find('#con').val()),
            int: parseInt(html.find('#int').val()),
            wis: parseInt(html.find('#wis').val()),
            cha: parseInt(html.find('#cha').val()),
            
            skillBargaining: html.find('#skillBargaining').is(':checked'),
            skillAppraisal: html.find('#skillAppraisal').is(':checked'),
            skillTrade: html.find('#skillTrade').is(':checked'),
            skillSmuggling: html.find('#skillSmuggling').is(':checked'),
            skillCustomsInspection: html.find('#skillCustomsInspection').is(':checked'),
            skillSeamanship: html.find('#skillSeamanship').is(':checked'),
            skillShipCarpentry: html.find('#skillShipCarpentry').is(':checked'),
            skillNavigation: html.find('#skillNavigation').is(':checked'),
            skillPiloting: html.find('#skillPiloting').is(':checked'),
            skillSeaLore: html.find('#skillSeaLore').is(':checked'),
            skillShipRowing: html.find('#skillShipRowing').is(':checked'),
            skillShipSailing: html.find('#skillShipSailing').is(':checked'),
            skillShipwright: html.find('#skillShipwright').is(':checked'),
            skillSignaling: html.find('#skillSignaling').is(':checked'),
            skillVesselIdentification: html.find('#skillVesselIdentification').is(':checked'),
            
            ltName: html.find('#lieutenantName').val(),
            ltStr: parseInt(html.find('#ltStr').val()),
            ltDex: parseInt(html.find('#ltDex').val()),
            ltCon: parseInt(html.find('#ltCon').val()),
            ltInt: parseInt(html.find('#ltInt').val()),
            ltWis: parseInt(html.find('#ltWis').val()),
            ltCha: parseInt(html.find('#ltCha').val()),
            
            ltSkillBargaining: html.find('#ltSkillBargaining').is(':checked'),
            ltSkillAppraisal: html.find('#ltSkillAppraisal').is(':checked'),
            ltSkillTrade: html.find('#ltSkillTrade').is(':checked'),
            ltSkillSmuggling: html.find('#ltSkillSmuggling').is(':checked'),
            ltSkillCustomsInspection: html.find('#ltSkillCustomsInspection').is(':checked'),
            ltSkillSeamanship: html.find('#ltSkillSeamanship').is(':checked'),
            ltSkillShipCarpentry: html.find('#ltSkillShipCarpentry').is(':checked'),
            ltSkillNavigation: html.find('#ltSkillNavigation').is(':checked'),
            ltSkillPiloting: html.find('#ltSkillPiloting').is(':checked'),
            ltSkillSeaLore: html.find('#ltSkillSeaLore').is(':checked'),
            ltSkillShipRowing: html.find('#ltSkillShipRowing').is(':checked'),
            ltSkillShipSailing: html.find('#ltSkillShipSailing').is(':checked'),
            ltSkillShipwright: html.find('#ltSkillShipwright').is(':checked'),
            ltSkillSignaling: html.find('#ltSkillSignaling').is(':checked'),
            ltSkillVesselIdentification: html.find('#ltSkillVesselIdentification').is(':checked'),
            
            startingGold: parseInt(html.find('#startingGold').val()),
            tradeMode: html.find('input[name="tradeMode"]:checked').val(),
            commissionRate: parseInt(html.find('#commissionRate').val()),
            latitude: parseFloat(html.find('#latitude').val()),
            longitude: parseFloat(html.find('#longitude').val()),
            autoRepair: html.find('#autoRepair').is(':checked'),
            enableRowing: html.find('#enableRowing').is(':checked'),
            automateTrading: html.find('#automateTrading').is(':checked'),
            startingYear: parseInt(html.find('#startingYear').val()),
            startingMonth: html.find('#startingMonth').val(),
            startingDay: parseInt(html.find('#startingDay').val()),
            crewQuality: html.find('#crewQuality').val()
        };
    }

    _validateFormData(data) {
        if (!data.shipID) {
            return { valid: false, message: "Please select a ship" };
        }
        if (!data.routeID) {
            return { valid: false, message: "Please select a route" };
        }
        if (!data.captainName) {
            return { valid: false, message: "Captain must have a name" };
        }
        if (data.startingGold < 0) {
            return { valid: false, message: "Starting gold must be >= 0" };
        }
        if (data.tradeMode === "consignment" && (data.commissionRate < 10 || data.commissionRate > 40)) {
            return { valid: false, message: "Commission rate must be 10-40%" };
        }
        if (!data.startingMonth) {
            return { valid: false, message: "Please select a starting month" };
        }

        const abilities = [data.str, data.dex, data.con, data.int, data.wis, data.cha];
        if (abilities.some(a => a < 3 || a > 18 || isNaN(a))) {
            return { valid: false, message: "Abilities must be 3-18" };
        }

        return { valid: true };
    }

    _buildVoyageConfig(formData) {
        return {
            shipId: formData.shipID,
            routeId: formData.routeID,
            captain: {
                name: formData.captainName,
                strScore: formData.str,
                dexScore: formData.dex,
                conScore: formData.con,
                intScore: formData.int,
                wisScore: formData.wis,
                chaScore: formData.cha,
                skills: {
                    bargaining: formData.skillBargaining,
                    appraisal: formData.skillAppraisal,
                    trade: formData.skillTrade,
                    smuggling: formData.skillSmuggling,
                    customsInspection: formData.skillCustomsInspection,
                    seamanship: formData.skillSeamanship,
                    shipCarpentry: formData.skillShipCarpentry,
                    navigation: formData.skillNavigation,
                    piloting: formData.skillPiloting,
                    seaLore: formData.skillSeaLore,
                    shipRowing: formData.skillShipRowing,
                    shipSailing: formData.skillShipSailing,
                    shipwright: formData.skillShipwright,
                    signaling: formData.skillSignaling,
                    vesselIdentification: formData.skillVesselIdentification
                }
            },
            lieutenant: {
                name: formData.ltName,
                strScore: formData.ltStr,
                dexScore: formData.ltDex,
                conScore: formData.ltCon,
                intScore: formData.ltInt,
                wisScore: formData.ltWis,
                chaScore: formData.ltCha,
                skills: {
                    bargaining: formData.ltSkillBargaining,
                    appraisal: formData.ltSkillAppraisal,
                    trade: formData.ltSkillTrade,
                    smuggling: formData.ltSkillSmuggling,
                    customsInspection: formData.ltSkillCustomsInspection,
                    seamanship: formData.ltSkillSeamanship,
                    shipCarpentry: formData.ltSkillShipCarpentry,
                    navigation: formData.ltSkillNavigation,
                    piloting: formData.ltSkillPiloting,
                    seaLore: formData.ltSkillSeaLore,
                    shipRowing: formData.ltSkillShipRowing,
                    shipSailing: formData.ltSkillShipSailing,
                    shipwright: formData.ltSkillShipwright,
                    signaling: formData.ltSkillSignaling,
                    vesselIdentification: formData.ltSkillVesselIdentification
                }
            },
            startingGold: formData.startingGold,
            tradeMode: formData.tradeMode,
            commissionRate: formData.commissionRate,
            latitude: formData.latitude,
            longitude: formData.longitude,
            autoRepair: formData.autoRepair,
            enableRowing: formData.enableRowing,
            automateTrading: formData.automateTrading,
            startingYear: formData.startingYear,
            startingMonth: formData.startingMonth,
            startingDay: formData.startingDay,
            crewQuality: formData.crewQuality
        };
    }
}