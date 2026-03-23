/**
 * Voyage Setup Dialog
 * Main dialog for configuring and starting voyages
 * Supports multi-officer crew roster
 */

import { ShipRegistry } from '../data/ships.js';
import { PortRegistry } from '../data/ports.js';
import { RouteRegistry } from '../data/routes.js';
import { VoyageSimulator } from '../voyage/simulation.js';
import { CrewGenerator } from '../data/crew-generator.js';
import { ProficiencySystem } from '../trading/proficiency.js';

// Skill abbreviations for compact display
const SKILL_ABBREV = {
    bargaining: "Barg", appraisal: "Appr", trade: "Trade", smuggling: "Smug",
    customsInspection: "Cust", seamanship: "Seam", shipCarpentry: "Carp",
    navigation: "Nav", piloting: "Pilot", seaLore: "Lore", shipRowing: "Row",
    shipSailing: "Sail", shipwright: "Wright", signaling: "Sig",
    vesselIdentification: "VesID", boating: "Boat", artillerist: "Artil"
};

export class VoyageSetupDialog extends FormApplication {

    constructor(options = {}) {
        super({}, options);
        this.loadSavedSettings();
        // Initialize officers from saved data or migrate from old format
        this.officers = this.savedData.officers || [];
        // Ensure every loaded officer has a skills object
        for (const o of this.officers) {
            if (!o.skills || typeof o.skills !== 'object') o.skills = {};
        }
        console.log(`[Voyage Dialog] Saved officers: ${this.officers.length}, savedData keys: ${Object.keys(this.savedData).join(', ')}`);
        if (this.officers.length === 0) {
            // Migrate from old captain/lieutenant format
            if (this.savedData.captainName) {
                console.log(`[Voyage Dialog] Migrating old captain: ${this.savedData.captainName}`);
                this.officers.push({
                    name: this.savedData.captainName,
                    role: "Captain",
                    level: 5,
                    status: "healthy",
                    str: this.savedData.str || 10,
                    dex: this.savedData.dex || 10,
                    con: this.savedData.con || 10,
                    int: this.savedData.int || 10,
                    wis: this.savedData.wis || 10,
                    cha: this.savedData.cha || 10,
                    skills: {
                        bargaining: !!this.savedData.skillBargaining,
                        appraisal: !!this.savedData.skillAppraisal,
                        trade: !!this.savedData.skillTrade,
                        smuggling: !!this.savedData.skillSmuggling,
                        customsInspection: !!this.savedData.skillCustomsInspection,
                        seamanship: !!this.savedData.skillSeamanship,
                        shipCarpentry: !!this.savedData.skillShipCarpentry,
                        navigation: !!this.savedData.skillNavigation,
                        piloting: !!this.savedData.skillPiloting,
                        seaLore: !!this.savedData.skillSeaLore,
                        shipRowing: !!this.savedData.skillShipRowing,
                        shipSailing: !!this.savedData.skillShipSailing,
                        shipwright: !!this.savedData.skillShipwright,
                        signaling: !!this.savedData.skillSignaling,
                        vesselIdentification: !!this.savedData.skillVesselIdentification
                    }
                });
            }
            if (this.savedData.ltName) {
                console.log(`[Voyage Dialog] Migrating old lieutenant: ${this.savedData.ltName}`);
                this.officers.push({
                    name: this.savedData.ltName,
                    role: "Lieutenant",
                    level: 3,
                    status: "healthy",
                    str: this.savedData.ltStr || 10,
                    dex: this.savedData.ltDex || 10,
                    con: this.savedData.ltCon || 10,
                    int: this.savedData.ltInt || 10,
                    wis: this.savedData.ltWis || 10,
                    cha: this.savedData.ltCha || 10,
                    skills: {
                        bargaining: !!this.savedData.ltSkillBargaining,
                        appraisal: !!this.savedData.ltSkillAppraisal,
                        trade: !!this.savedData.ltSkillTrade,
                        smuggling: !!this.savedData.ltSkillSmuggling,
                        customsInspection: !!this.savedData.ltSkillCustomsInspection,
                        seamanship: !!this.savedData.ltSkillSeamanship,
                        shipCarpentry: !!this.savedData.ltSkillShipCarpentry,
                        navigation: !!this.savedData.ltSkillNavigation,
                        piloting: !!this.savedData.ltSkillPiloting,
                        seaLore: !!this.savedData.ltSkillSeaLore,
                        shipRowing: !!this.savedData.ltSkillShipRowing,
                        shipSailing: !!this.savedData.ltSkillShipSailing,
                        shipwright: !!this.savedData.ltSkillShipwright,
                        signaling: !!this.savedData.ltSkillSignaling,
                        vesselIdentification: !!this.savedData.ltSkillVesselIdentification
                    }
                });
            }
            // If still empty, generate a default captain
            if (this.officers.length === 0) {
                console.log(`[Voyage Dialog] No saved data found, generating default captain`);
                this.officers.push(CrewGenerator.generate("Captain"));
            }
        }
        console.log(`[Voyage Dialog] Final officers count: ${this.officers.length}`, this.officers);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "voyage-setup-dialog",
            classes: ["adnd-voyage-simulator", "sheet"],
            title: "AD&D Voyage Simulator - Setup",
            template: "modules/adnd-voyage-simulator/templates/voyage-setup.hbs",
            width: 780,
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

    _getSkillTags(skills) {
        if (!skills) return [];
        return Object.entries(skills)
            .filter(([_, v]) => v)
            .map(([k]) => SKILL_ABBREV[k] || k)
            .slice(0, 6); // max 6 tags in summary
    }

    async getData() {
        const data = await super.getData();

        data.namedShips = ShipRegistry.getAll().map(ship => ({
            id: ship.id,
            name: ship.name,
            shipType: ship.shipType,
            selected: ship.id === this.savedData.shipID
        }));

        const grouped = ShipRegistry.getTemplatesGrouped();
        data.templatesDMG = grouped.dmg;
        data.templatesSeafaring = grouped.seafaring;

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

        // Build officer display data — ensure skills always exists
        data.officers = this.officers.map((o, idx) => ({
            ...o,
            skills: o.skills || {},
            roleLower: (o.role || "lieutenant").toLowerCase(),
            status: o.status || "healthy",
            skillTags: this._getSkillTags(o.skills),
            expanded: idx === 0 // first officer starts expanded
        }));

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('input[name="tradeMode"]').change(this._onTradeModeChange.bind(this));
        html.find('#automateTrading').change(this._onAutomateToggle.bind(this));
        html.find('button[type="submit"]').click(this._onSubmit.bind(this));

        // Crew roster listeners
        html.find('.add-officer-btn').click(this._onAddOfficer.bind(this));
        html.find('.officer-randomize').click(this._onRandomizeOfficer.bind(this));
        html.find('.officer-expand').click(this._onToggleOfficerDetail.bind(this));
        html.find('.officer-delete').click(this._onDeleteOfficer.bind(this));
    }

    // ---- Crew Roster Actions ----

    _onAddOfficer(event) {
        event.preventDefault();
        const role = this.element.find('#addOfficerRole').val();
        const officer = CrewGenerator.generate(role);
        this._syncOfficersFromForm();
        this.officers.push(officer);
        this.render(true);
    }

    _onRandomizeOfficer(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        this._syncOfficersFromForm();
        const role = this.officers[index]?.role || "Lieutenant";
        this.officers[index] = CrewGenerator.generate(role);
        this.render(true);
    }

    _onToggleOfficerDetail(event) {
        event.preventDefault();
        const index = event.currentTarget.dataset.index;
        const detail = this.element.find(`.officer-detail[data-detail="${index}"]`);
        const icon = $(event.currentTarget).find('i');
        detail.toggle();
        icon.toggleClass('fa-chevron-down fa-chevron-up');
    }

    _onDeleteOfficer(event) {
        event.preventDefault();
        const index = parseInt(event.currentTarget.dataset.index);
        this._syncOfficersFromForm();
        this.officers.splice(index, 1);
        this.render(true);
    }

    /** Read current officer values from the form back into this.officers */
    _syncOfficersFromForm() {
        const html = this.element;
        const updated = [];
        for (let i = 0; i < this.officers.length; i++) {
            const o = { ...this.officers[i] };
            const nameVal = html.find(`[name="officer_${i}_name"]`).val();
            if (nameVal !== undefined) o.name = nameVal;

            const roleVal = html.find(`[name="officer_${i}_role"]`).val();
            if (roleVal) o.role = roleVal;

            const lvl = html.find(`[name="officer_${i}_level"]`).val();
            if (lvl !== undefined) o.level = parseInt(lvl) || 0;

            const status = html.find(`[name="officer_${i}_status"]`).val();
            if (status) o.status = status;

            for (const attr of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
                const v = html.find(`[name="officer_${i}_${attr}"]`).val();
                if (v !== undefined) o[attr] = parseInt(v) || 10;
            }

            const skills = {};
            for (const key of Object.keys(SKILL_ABBREV)) {
                const el = html.find(`[name="officer_${i}_skill_${key}"]`);
                if (el.length) skills[key] = el.is(':checked');
                else if (o.skills?.[key]) skills[key] = o.skills[key];
            }
            o.skills = skills;
            updated.push(o);
        }
        this.officers = updated;
    }

    // ---- Trade Mode Toggles ----

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
            if (isConsignment) this.element.find('#commissionRateGroup').show();
        }
    }

    // ---- Submit ----

    async _onSubmit(event) {
        event.preventDefault();
        this._syncOfficersFromForm();

        const formData = this._getFormData();
        const validation = this._validateFormData(formData);
        if (!validation.valid) {
            ui.notifications.error(validation.message);
            return;
        }

        // Save settings including officers
        formData.officers = this.officers;
        await game.settings.set('adnd-voyage-simulator', 'lastVoyageSettings', formData);

        const voyageConfig = this._buildVoyageConfig(formData);
        this.close();

        const simulator = new VoyageSimulator();
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
            startingGold: parseInt(html.find('#startingGold').val()),
            tradeMode: html.find('input[name="tradeMode"]:checked').val() || "speculation",
            commissionRate: parseInt(html.find('#commissionRate').val()),
            latitude: parseFloat(html.find('#latitude').val()),
            longitude: parseFloat(html.find('#longitude').val()),
            autoRepair: html.find('#autoRepair').is(':checked'),
            enableRowing: html.find('#enableRowing').is(':checked'),
            automateTrading: html.find('#automateTrading').is(':checked'),
            startingYear: parseInt(html.find('#startingYear').val()),
            startingMonth: html.find('#startingMonth').val(),
            startingDay: parseInt(html.find('#startingDay').val()),
            crewQuality: html.find('#crewQuality').val(),
            officers: this.officers
        };
    }

    _validateFormData(data) {
        if (!data.shipID) return { valid: false, message: "Please select a ship" };
        if (!data.routeID) return { valid: false, message: "Please select a route" };
        if (data.startingGold < 0) return { valid: false, message: "Starting gold must be >= 0" };
        if (!data.startingMonth) return { valid: false, message: "Please select a starting month" };

        // Must have at least a captain
        const hasCaptain = this.officers.some(o => o.role === "Captain");
        if (!hasCaptain) return { valid: false, message: "Ship requires a Captain" };
        const captainName = this.officers.find(o => o.role === "Captain")?.name;
        if (!captainName) return { valid: false, message: "Captain must have a name" };

        if (data.tradeMode === "consignment" && (data.commissionRate < 10 || data.commissionRate > 40)) {
            return { valid: false, message: "Commission rate must be 10-40%" };
        }
        return { valid: true };
    }

    _buildVoyageConfig(formData) {
        // Build officer data with proficiency scores
        const allOfficers = this.officers.map(o => {
            const profScores = ProficiencySystem.createProficiencyScores({
                ...o,
                strScore: o.str, dexScore: o.dex, conScore: o.con,
                intScore: o.int, wisScore: o.wis, chaScore: o.cha
            });
            return {
                name: o.name,
                role: o.role,
                level: o.level || 1,
                status: o.status || "healthy",
                str: o.str, dex: o.dex, con: o.con,
                int: o.int, wis: o.wis, cha: o.cha,
                skills: o.skills || {},
                proficiencyScores: profScores
            };
        });

        // Extract captain and first lieutenant for backward compat
        const captain = allOfficers.find(o => o.role === "Captain") || allOfficers[0];
        const lieutenant = allOfficers.find(o => o.role === "Lieutenant") || { name: "", level: 1, skills: {}, proficiencyScores: {} };

        // Build legacy lieutenantSkills (boolean map) from all non-captain officers
        const lieutenantSkills = {};
        for (const o of allOfficers) {
            if (o.role === "Captain") continue;
            for (const [sk, has] of Object.entries(o.skills || {})) {
                if (has) lieutenantSkills[sk] = true;
            }
        }

        return {
            shipId: this._resolveShipId(formData.shipID),
            routeId: formData.routeID,
            mode: formData.mode,
            captain: {
                name: captain.name,
                level: captain.level,
                strScore: captain.str, dexScore: captain.dex, conScore: captain.con,
                intScore: captain.int, wisScore: captain.wis, chaScore: captain.cha,
                chaScore: captain.cha,
                skills: captain.skills || {}
            },
            lieutenant: {
                name: lieutenant.name,
                level: lieutenant.level,
                strScore: lieutenant.str, dexScore: lieutenant.dex, conScore: lieutenant.con,
                intScore: lieutenant.int, wisScore: lieutenant.wis, chaScore: lieutenant.cha,
                skills: lieutenant.skills || {}
            },
            allOfficers,
            lieutenantSkills,
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

    /**
     * If the selected shipID is a template reference (tmpl:caravel),
     * create a named instance from it. Otherwise return the ID as-is.
     */
    _resolveShipId(shipID) {
        if (!shipID?.startsWith("tmpl:")) return shipID;
        const templateId = shipID.slice(5);
        const tmpl = ShipRegistry.getTemplate(templateId);
        if (!tmpl) {
            ui.notifications.error(`Unknown ship template: ${templateId}`);
            return shipID;
        }
        const shipName = tmpl.shipType; // default name = ship type
        const instance = ShipRegistry.createFromTemplate(templateId, shipName);
        console.log(`Voyage Setup | Created ship "${instance.name}" (${instance.id}) from template ${templateId}`);
        return instance.id;
    }
}
