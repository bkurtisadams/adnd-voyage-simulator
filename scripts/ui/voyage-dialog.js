/**
 * Voyage Setup Dialog
 * Main dialog for configuring and starting voyages
 */

import { ShipRegistry } from '../data/ships.js';
import { PortRegistry } from '../data/ports.js';
import { RouteRegistry } from '../data/routes.js';
import { VoyageSimulator } from '../voyage/simulation.js';
import { CrewGenerator } from '../data/crew-generator.js';

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
            width: 720,
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
        data.saved.mode = data.saved.mode || "auto";
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
        
        // Random Generator Listeners
        html.find('.randomize-crew').click(this._onRandomizeCrew.bind(this));
    }

    _onRandomizeCrew(event) {
        event.preventDefault();
        const type = event.currentTarget.dataset.type; // 'captain' or 'lieutenant'
        const rank = type === 'captain' ? 'Captain' : 'Lieutenant';
        
        // Generate data
        const generated = CrewGenerator.generate(rank);

        // Populate Name
        const nameField = type === 'captain' ? '#captainName' : '#lieutenantName';
        this.element.find(nameField).val(generated.name);

        // Populate Attributes
        const attrPrefix = type === 'captain' ? '#' : '#lt';
        const strId = type === 'captain' ? '#str' : '#ltStr'; // specialized due to handlebars logic/ids in template
        const dexId = type === 'captain' ? '#dex' : '#ltDex';
        const conId = type === 'captain' ? '#con' : '#ltCon';
        const intId = type === 'captain' ? '#int' : '#ltInt';
        const wisId = type === 'captain' ? '#wis' : '#ltWis';
        const chaId = type === 'captain' ? '#cha' : '#ltCha';

        this.element.find(strId).val(generated.str);
        this.element.find(dexId).val(generated.dex);
        this.element.find(conId).val(generated.con);
        this.element.find(intId).val(generated.int);
        this.element.find(wisId).val(generated.wis);
        this.element.find(chaId).val(generated.cha);

        // Populate Skills
        // First clear all checkboxes for this tab
        const skillPrefix = type === 'captain' ? '#skill' : '#ltSkill';
        
        // Uncheck all first
        this.element.find(`div[data-tab="${type}-info"] input[type="checkbox"]`).prop('checked', false);

        // Check generated skills
        for (const [skill, hasSkill] of Object.entries(generated.skills)) {
            if (hasSkill) {
                // Construct ID: e.g. #skillBargaining or #ltSkillBargaining
                // Ensure capitalization matches template IDs
                const capitalizedSkill = skill.charAt(0).toUpperCase() + skill.slice(1);
                const selector = `${skillPrefix}${capitalizedSkill}`;
                this.element.find(selector).prop('checked', true);
            }
        }
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
        
        // Notify user of mode
        if (voyageConfig.mode === 'manual') {
            ui.notifications.info("Initializing Manual Voyage. Use the macro or sidebar to advance days.");
        } else {
            ui.notifications.info("Starting Automated Voyage Simulation...");
        }

        await simulator.startVoyage(voyageConfig);
    }

    _getFormData() {
        const html = this.element;

        return {
            shipID: html.find('#shipID').val(),
            routeID: html.find('#routeID').val(),
            mode: html.find('#mode').val(),
            
            // Captain
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
            
            // Lieutenant
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
            
            // Settings
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
        if (!data.shipID) return { valid: false, message: "Please select a ship" };
        if (!data.routeID) return { valid: false, message: "Please select a route" };
        if (!data.captainName) return { valid: false, message: "Captain must have a name" };
        if (data.startingGold < 0) return { valid: false, message: "Starting gold must be >= 0" };
        if (data.tradeMode === "consignment" && (data.commissionRate < 10 || data.commissionRate > 40)) {
            return { valid: false, message: "Commission rate must be 10-40%" };
        }
        if (!data.startingMonth) return { valid: false, message: "Please select a starting month" };

        return { valid: true };
    }

    _buildVoyageConfig(formData) {
        return {
            shipId: formData.shipID,
            routeId: formData.routeID,
            mode: formData.mode,
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