// Basically all of this stolen from Dice Tray cause I can't find a single explanation on how fvtt works : https://github.com/mclemente/fvtt-dice-tray

const { ApplicationV2: ApplicationV2$1, HandlebarsApplicationMixin: HandlebarsApplicationMixin$1 } = foundry.applications.api;

const ACTIVE_TILE = {Grass: 0, Dirt: 1, Stone: 2}

const TILE_MAP = {
	[ACTIVE_TILE.Grass]: [
		"Aetherball: Steal",
		"Aetherball: Throw",
		"Aetherball: Grab",
		"Aetherball: Tackle",
		"Aetherball: Intercept",
	],
	[ACTIVE_TILE.Dirt]: [
		"Aetherball: Blast",
		"Aetherball: Push",
		"Aetherball: Yank",
	],
	[ACTIVE_TILE.Stone]: [
		"Aetherball: Force Wall",
		"Aetherball: Hinder",
		"Aetherball: Shield",
	],
}

class Aetherball {
    popout
	state = ACTIVE_TILE.Grass

	get settings() {
		return {};
	}
}

class AetherballPopout extends HandlebarsApplicationMixin$1(ApplicationV2$1) {
	static DEFAULT_OPTIONS = {
		id: "aetherball-popout",
		tag: "aside",
		window: {
			title: "Aetherball",
			minimizable: true
		}
	};

	static PARTS = {
		actions: {
			id: "actions",
			template: "modules/aetherball/templates/popout.html",
		}
	};

    async _renderFrame(options) {
		const frame = await super._renderFrame(options);
		this.window.close.remove(); // Prevent closing
		return frame;
	}

    async close(options={}) {
		if ( !options.closeKey ) return super.close(options);
		return this;
	}

	_onRender(context, options) {
		super._onRender(context, options);
		for (const button of this.element.querySelectorAll(".aetherball-popout button")) {
			button.addEventListener("click", async (e) => {
				const selectedToken = canvas.tokens.controlled[0];
				if (!selectedToken) {
					ui.notifications.warn("Please select a token first.");
					return;
				}
				const action = await fetchAction(e.currentTarget.dataset.action);
				
				if(action.type == "effect") {
					let item = selectedToken.actor.items.find(i => i.name === action.name);
					if (item) {
						await selectedToken.actor.deleteEmbeddedDocuments('Item', [item.id]);
					} else {
						item = await selectedToken.actor.createEmbeddedDocuments('Item', [action.toObject()]);
					}
				} else {
					let item = selectedToken.actor.items.find(i => i.name === action.name);
					if (!item) {
						item = await selectedToken.actor.createEmbeddedDocuments('Item', [action.toObject()]);
						item = item[0]
					}
					await item.toMessage();
					await selectedToken.actor.deleteEmbeddedDocuments('Item', [item.id]);
				}
			})
		}
	}

	async _prepareContext(_options) {
		const actions = await fetchActions();
		
		let display = []

		for(let action in actions) {
			//if(!TILE_MAP[CONFIG.AETHERBALL.state].includes(actions[action].name)) continue
			if(actions[action].type == "effect") continue
			display.push({
				"id": actions[action].id,
				"img": actions[action].img,
				"name": actions[action].name.split("Aetherball: ")[1],
			})
		}

		for(let action in actions) {
			if(actions[action].type != "effect") continue
			display.push({
				"id": actions[action].id,
				"img": actions[action].img,
				"name": actions[action].name.split("Aetherball: ")[1],
			})
		}

		return {
			actions: display,
		};
	}

    setPosition(position) {
		const superPosition = super.setPosition(position);
		const { left, top } = superPosition;
		game.settings.set("aetherball", "popoutPosition", { left, top });
		return superPosition;
	}
}

async function fetchActions() {
	const compendium = game.packs.get('aetherball.aetherball');
	const actions = await compendium.getDocuments();
	return actions;
}

async function fetchAction(itemId) {
	const compendium = game.packs.get('aetherball.aetherball');
	const item = await compendium.getDocument(itemId);
	return item;
}

async function preloadTemplates() {
	const templatePaths = [
		"modules/aetherball/templates/popout.html",
	];

	return loadTemplates(templatePaths);
}

Hooks.once('init', async function() {
	preloadTemplates();
    CONFIG.AETHERBALL = new Aetherball()
	registerSettings();
	registerKeybindings();
});

Hooks.once('ready', async function() {
    //if (game.settings.get("aetherball", "autoOpenPopout")) togglePopout();
    togglePopout();
});

async function togglePopout() {
	CONFIG.AETHERBALL.popout ??= new AetherballPopout();
	if (CONFIG.AETHERBALL.popout.rendered) await CONFIG.AETHERBALL.popout.close({ animate: false });
	else await CONFIG.AETHERBALL.popout.render(true);
}

function registerSettings() {
	game.settings.register("aetherball", "popoutPosition", {
		scope: "client",
		config: false,
		default: {},
		type: Object
	});
}

function registerKeybindings() {
	game.keybindings.register("aetherball", "popout", {
		name: "Open Aetherball Actions",
		onDown: async () => {
			await togglePopout();
		}
	});
}