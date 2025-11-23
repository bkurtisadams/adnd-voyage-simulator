/**
 * AD&D Voyage Simulator
 * Main module initialization and UI integration
 */

console.log("=== AD&D Voyage Simulator main.js loading ===");

import { VoyageSimulator } from './voyage/simulation.js';
import { ShipRegistry } from './data/ships.js';
import { PortRegistry } from './data/ports.js';
import { RouteRegistry } from './data/routes.js';
import { CargoRegistry } from './data/cargo.js';
import { EncounterRegistry } from './data/encounters.js';
import { VoyageSetupDialog } from './ui/voyage-dialog.js';

console.log("=== All imports successful ===");

/**
 * Module namespace and initialization
 */
class ADnDVoyageSimulator {
    static ID = 'adnd-voyage-simulator';
    static TITLE = 'AD&D Voyage Simulator';
    static FLAGS = {
        ACTIVE_VOYAGES: 'activeVoyages'
    };

    /**
     * Initialize module on Foundry init hook
     */
    static initialize() {
        console.log(`${this.TITLE} | Initializing module`);
        
        // Register settings
        this.registerSettings();
        
        // Initialize data registries
        ShipRegistry.initialize();
        PortRegistry.initialize();
        RouteRegistry.initialize();
        CargoRegistry.initialize();
        EncounterRegistry.initialize();
        
        // Store module API in game namespace
        game.adndVoyage = {
            simulator: new VoyageSimulator(),
            ships: ShipRegistry,
            ports: PortRegistry,
            routes: RouteRegistry,
            cargo: CargoRegistry,
            encounters: EncounterRegistry,
            openDialog: () => new VoyageSetupDialog().render(true)
        };
        
        console.log(`${this.TITLE} | Initialization complete`);
    }

    /**
     * Register module settings
     */
    static registerSettings() {
        // Default starting gold
        game.settings.register(this.ID, 'defaultStartingGold', {
            name: 'ADND_VOYAGE.Settings.DefaultGold.Name',
            hint: 'ADND_VOYAGE.Settings.DefaultGold.Hint',
            scope: 'world',
            config: true,
            type: Number,
            default: 1000,
            range: {
                min: 0,
                max: 100000,
                step: 100
            }
        });

        // Default trade mode
        game.settings.register(this.ID, 'defaultTradeMode', {
            name: 'ADND_VOYAGE.Settings.TradeMode.Name',
            hint: 'ADND_VOYAGE.Settings.TradeMode.Hint',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                'speculation': 'ADND_VOYAGE.TradeMode.Speculation',
                'consignment': 'ADND_VOYAGE.TradeMode.Consignment'
            },
            default: 'speculation'
        });

        // Default crew quality
        game.settings.register(this.ID, 'defaultCrewQuality', {
            name: 'ADND_VOYAGE.Settings.CrewQuality.Name',
            hint: 'ADND_VOYAGE.Settings.CrewQuality.Hint',
            scope: 'world',
            config: true,
            type: String,
            choices: {
                'Landlubber': 'ADND_VOYAGE.CrewQuality.Landlubber',
                'Green': 'ADND_VOYAGE.CrewQuality.Green',
                'Average': 'ADND_VOYAGE.CrewQuality.Average',
                'Trained': 'ADND_VOYAGE.CrewQuality.Trained',
                'Crack': 'ADND_VOYAGE.CrewQuality.Crack',
                'Old Salts': 'ADND_VOYAGE.CrewQuality.OldSalts'
            },
            default: 'Trained'
        });

        // Auto-repair
        game.settings.register(this.ID, 'autoRepair', {
            name: 'ADND_VOYAGE.Settings.AutoRepair.Name',
            hint: 'ADND_VOYAGE.Settings.AutoRepair.Hint',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false
        });

        // Enable rowing
        game.settings.register(this.ID, 'enableRowing', {
            name: 'ADND_VOYAGE.Settings.EnableRowing.Name',
            hint: 'ADND_VOYAGE.Settings.EnableRowing.Hint',
            scope: 'world',
            config: true,
            type: Boolean,
            default: false
        });

        // Last used voyage settings (client-side)
        game.settings.register(this.ID, 'lastVoyageSettings', {
            name: 'Last Voyage Configuration',
            scope: 'client',
            config: false,
            type: Object,
            default: {}
        });

        // Active voyages (world-level)
        game.settings.register(this.ID, 'activeVoyages', {
            name: 'Active Voyages',
            scope: 'world',
            config: false,
            type: Object,
            default: {}
        });
    }

    /**
     * Ready hook - add UI elements
     */
    static ready() {
        console.log(`${this.TITLE} | Ready`);
        
        // Check for ADND Weather dependency
        if (!globalThis.dndWeather?.weatherSystem) {
            console.warn(`${this.TITLE} | ADND Weather module not active - weather features will be limited`);
        }

        if (game.user.isGM) {
            this.addSceneControl();
        }
    }

    /**
     * Add scene control button
     */
    static addSceneControl() {
        Hooks.on('getSceneControlButtons', (controls) => {
  try {
    // Normalize the top-level controls to an array (v13 = array, some modules patch to object)
    const list = Array.isArray(controls)
      ? controls
      : Array.isArray(controls?.controls)
        ? controls.controls
        : Array.isArray(controls?.buttons)
          ? controls.buttons
          : Object.values(controls ?? {});

    const token = list.find(c => c?.name === 'token');
    if (!token) return;

    // Normalize tools to an array (some modules convert to object keyed by name)
    const toolsArr = Array.isArray(token.tools)
      ? token.tools
      : token.tools
        ? Object.values(token.tools)
        : [];

    // Only add once
    if (!toolsArr.some(t => t?.name === 'voyage-simulator')) {
      toolsArr.push({
        name: 'voyage-simulator',
        title: game.i18n?.localize?.('ADND_VOYAGE.Controls.OpenSimulator') ?? 'Open Voyage Simulator',
        icon: 'fas fa-ship',
        button: true,
        visible: game.user?.isGM ?? true,
        onClick: () => new VoyageSetupDialog().render(true)
      });
    }

    // Write normalized array back
    token.tools = toolsArr;
  } catch (err) {
    console.error('adnd-voyage-simulator | getSceneControlButtons failed', err, controls);
  }
});

    }

    /**
     * Add macro button
     */
    static addMacroSupport() {
        // Register a global function for macro use
        window.openVoyageSimulator = () => {
            new VoyageSetupDialog().render(true);
        };
    }

    /**
     * Render chat log hook - add custom styling
     */
    static enhanceChatMessages() {
        Hooks.on('renderChatMessage', (message, html, data) => {
            // Add custom styling for voyage simulator messages
            if (message.speaker?.alias === 'Voyage Simulator') {
                html.addClass('adnd-voyage-message');
            }
        });
    }
}

// ============================================================================
// Foundry VTT Hooks
// ============================================================================

/**
 * Init hook - module initialization
 */
Hooks.once('init', async () => {
  // Initialize core systems
  ADnDVoyageSimulator.initialize();
  ADnDVoyageSimulator.addMacroSupport();

  // Load and register the Captain/Lieutenant tab templates
  await loadTemplates([
    "modules/adnd-voyage-simulator/templates/crew/captain-tab.hbs",
    "modules/adnd-voyage-simulator/templates/crew/lieutenant-tab.hbs"
  ]);

  // Optionally register them as partials if the dialog expects {{> voyage-captain-tab}}
  const [captainHbs, lieutenantHbs] = await Promise.all([
    fetch("modules/adnd-voyage-simulator/templates/crew/captain-tab.hbs").then(r => r.text()),
    fetch("modules/adnd-voyage-simulator/templates/crew/lieutenant-tab.hbs").then(r => r.text())
  ]);
  Handlebars.registerPartial("voyage-captain-tab", captainHbs);
  Handlebars.registerPartial("voyage-lieutenant-tab", lieutenantHbs);

    // Handlebars convenience helpers used by voyage-setup.hbs
    if (!Handlebars.helpers.selected) {
        Handlebars.registerHelper('selected', (value, expected) => (value === expected ? 'selected' : ''));
    }
    if (!Handlebars.helpers.checked) {
        Handlebars.registerHelper('checked', (value) => (value ? 'checked' : ''));
    }

});



/**
 * Ready hook - add UI elements
 */
Hooks.once('ready', () => {
    ADnDVoyageSimulator.ready();
    ADnDVoyageSimulator.enhanceChatMessages();

    if (typeof window.openVoyageSimulator !== 'function' && typeof VoyageSetupDialog === 'function') {
        window.openVoyageSimulator = () => new VoyageSetupDialog().render(true);
    }
});

/**
 * Render sidebar hook - add journal folder button
 */
Hooks.on('renderJournalDirectory', (app, html, data) => {
    if (!game.user.isGM) return;

    // V13: html is now an array [HTMLElement]
    const element = html[0] || html;
    const $html = $(element);

    const button = $(`
        <button class="adnd-voyage-new-button">
            <i class="fas fa-ship"></i> New Voyage
        </button>
    `);

    button.on('click', () => {
        new VoyageSetupDialog().render(true);
    });

    $html.find('.directory-footer').append(button);
});

/**
 * Render actor sheet hook - add voyage button for character sheets
 */
Hooks.on('renderActorSheet', (app, html, data) => {
  if (!game.user.isGM) return;
  if (app.actor?.type !== 'character') return;

  const element = html[0] || html;
  const $html = $(element);
  const sheetActor = app.actor;

  const $button = $(
    `<a class="adnd-voyage-character-button" title="Start Voyage as Captain">
       <i class="fas fa-anchor"></i> Start Voyage
     </a>`
  );

  $button.on('click', () => {
    const dialog = new VoyageSetupDialog();
    dialog.render(true);

    Hooks.once('renderVoyageSetupDialog', (_dlg, dlgHtml /*, dlgData */) => {
      const $dlg = $(dlgHtml);
      $dlg.find('#captainName').val(sheetActor.name);

      const abilities = sheetActor.system?.abilities;
      if (abilities) {
        $dlg.find('#str').val(abilities.str?.value ?? 10);
        $dlg.find('#dex').val(abilities.dex?.value ?? 10);
        $dlg.find('#con').val(abilities.con?.value ?? 10);
        $dlg.find('#int').val(abilities.int?.value ?? 10);
        $dlg.find('#wis').val(abilities.wis?.value ?? 10);
        $dlg.find('#cha').val(abilities.cha?.value ?? 10);
      }
    });
  });

  $html.find('.window-header .window-title').after($button);
});

/**
 * Chat command support - V13 compatible
 */
Hooks.on('chatCommandsReady', (commands) => {
    commands.register({
        name: '/voyage',
        module: 'adnd-voyage-simulator',
        description: 'Open the AD&D Voyage Simulator',
        icon: '<i class="fas fa-ship"></i>',
        callback: () => {
            new VoyageSetupDialog().render(true);
        }
    });

    commands.register({
        name: '/voyage-simulator',
        module: 'adnd-voyage-simulator',
        description: 'Open the AD&D Voyage Simulator',
        icon: '<i class="fas fa-anchor"></i>',
        callback: () => {
            new VoyageSetupDialog().render(true);
        }
    });
});

/**
 * Handlebars helper registration
 */
Hooks.once('init', () => {
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });

    Handlebars.registerHelper('and', function(a, b) {
        return a && b;
    });

    Handlebars.registerHelper('not', function(value) {
        return !value;
    });
});

// Export for console access and debugging
window.ADnDVoyageSimulator = ADnDVoyageSimulator;