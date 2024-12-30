// Much of this is taken from Dice Tray cause I can't find a single good explanation on how fvtt works : https://github.com/mclemente/fvtt-dice-tray
const ACTIVE_TILE = {Invalid: -1, Grass: 0, Dirt: 1, Stone: 2}

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
	current_tile = ACTIVE_TILE.Grass
	scene_name = "Scene"
	position = {
		width: "auto"
	}
	grid_start = {x: 10, y: 1}
	grid_size = {x: 41, y: 17}
	grid_pattern = [[ACTIVE_TILE.Dirt,ACTIVE_TILE.Grass],[ACTIVE_TILE.Grass,ACTIVE_TILE.Stone]]

	get settings() {
		return {};
	}
}

function validateTokenTile(t) {
	if(!t || !t.inCombat || !t.scene.name == CONFIG.AETHERBALL.scene_name) return ACTIVE_TILE.Invalid
	let tile_position = {
		"x": (t.document._source.x - t.scene.dimensions.sceneRect.x) / t.scene.dimensions.distancePixels / t.scene.dimensions.distance,
		"y": (t.document._source.y - t.scene.dimensions.sceneRect.y) / t.scene.dimensions.distancePixels / t.scene.dimensions.distance,
	}
	if(
		CONFIG.AETHERBALL.grid_start.x < tile_position.x < CONFIG.AETHERBALL.grid_start.x + CONFIG.AETHERBALL.grid_size.x &&
		CONFIG.AETHERBALL.grid_start.y < tile_position.y < CONFIG.AETHERBALL.grid_start.y + CONFIG.AETHERBALL.grid_size.y
	) {
		const patternWidth = CONFIG.AETHERBALL.grid_pattern[0].length;
		const patternHeight = CONFIG.AETHERBALL.grid_pattern.length;
		const mappedX = Math.abs(tile_position.x - CONFIG.AETHERBALL.grid_start.x) % patternWidth;
		const mappedY = Math.abs(tile_position.y - CONFIG.AETHERBALL.grid_start.y) % patternHeight;
		return CONFIG.AETHERBALL.grid_pattern[mappedY][mappedX];
	}
}

const { ApplicationV2: ApplicationV2$1, HandlebarsApplicationMixin: HandlebarsApplicationMixin$1 } = foundry.applications.api;

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
		this.window.close.remove();
		return frame;
	}

    async close(options={}) {
		if (!options.closeKey) return super.close(options);
		return this;
	}

	async update() {
		if(canvas.tokens.controlled.length !== 1) {
			await this.close({ animate: false })
			return
		}
		
		CONFIG.AETHERBALL.popout.current_tile = validateTokenTile(canvas.tokens.controlled[0])
		if(CONFIG.AETHERBALL.popout.current_tile != ACTIVE_TILE.Invalid) await this.render(true);
		else await this.close({ animate: false })
	}

	_onRender(context, options) {
		super._onRender(context, options);
		this.position.width = "auto";
		this.position.top = canvas.screenDimensions[1] - 250
		//this.element.style.width = "auto";
		console.log(this.position)
		for (const button of this.element.querySelectorAll(".aetherball-popout button")) {
			button.addEventListener("click", async (e) => {
				const selectedToken = canvas.tokens.controlled[0];
				if (!selectedToken || canvas.tokens.controlled.length > 1) {
					ui.notifications.warn("Please select only one token first.");
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
		const actions = await fetchAllActions();
		
		let display = []

		for(let action in actions) {
			if(!TILE_MAP[CONFIG.AETHERBALL.popout.current_tile].includes(actions[action].name)) continue
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

async function fetchAllActions() {
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
	return loadTemplates([
		"modules/aetherball/templates/popout.html",
	]);
}

Hooks.once('init', async function() {
	preloadTemplates();
	registerSettings();
    CONFIG.AETHERBALL = new Aetherball()
	registerKeybindings();
});

Hooks.once('ready', async function() {
	CONFIG.AETHERBALL.popout ??= new AetherballPopout();
    CONFIG.AETHERBALL.popout.update()
});

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

Hooks.on('controlToken', (e) => {
	CONFIG.AETHERBALL.popout.update()
})

Hooks.on('updateToken', (e) => {
	const selectedToken = canvas.tokens.controlled[0];
	if(e.id != selectedToken.id) return
	CONFIG.AETHERBALL.popout.update()
});

Hooks.on('updateCombat', (e) => {
	CONFIG.AETHERBALL.popout.update()
})

Hooks.on('deleteCombat', (e) => {
	CONFIG.AETHERBALL.popout.update()
})