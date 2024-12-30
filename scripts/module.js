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
	actions_pack = "aetherball.aetherball"
    popout
	current_tile = ACTIVE_TILE.Grass
	scene_name = "Aetherball Field"
	position = {
		width: "auto"
	}
	grid_start = {x: 4, y: 2}
	grid_size = {x: 41, y: 17}
	grid_pattern = [[ACTIVE_TILE.Dirt,ACTIVE_TILE.Grass],[ACTIVE_TILE.Grass,ACTIVE_TILE.Stone]]

	get settings() {
		return {};
	}
}

function validateTokenTile(t) {
	if(!t || !t.inCombat || t.scene.name != CONFIG.AETHERBALL.scene_name) return ACTIVE_TILE.Invalid
	let tile_position = {
		"x": (t.document._source.x - t.scene.dimensions.sceneRect.x) / t.scene.dimensions.distancePixels / t.scene.dimensions.distance,
		"y": (t.document._source.y - t.scene.dimensions.sceneRect.y) / t.scene.dimensions.distancePixels / t.scene.dimensions.distance,
	}
	if(
		CONFIG.AETHERBALL.grid_start.x <= tile_position.x && tile_position.x < CONFIG.AETHERBALL.grid_start.x + CONFIG.AETHERBALL.grid_size.x &&
		CONFIG.AETHERBALL.grid_start.y <= tile_position.y && tile_position.y < CONFIG.AETHERBALL.grid_start.y + CONFIG.AETHERBALL.grid_size.y
	) {
		const patternWidth = CONFIG.AETHERBALL.grid_pattern[0].length;
		const patternHeight = CONFIG.AETHERBALL.grid_pattern.length;
		const mappedX = Math.abs(tile_position.x - CONFIG.AETHERBALL.grid_start.x) % patternWidth;
		const mappedY = Math.abs(tile_position.y - CONFIG.AETHERBALL.grid_start.y) % patternHeight;
		return CONFIG.AETHERBALL.grid_pattern[mappedY][mappedX];
	}
	return ACTIVE_TILE.Invalid
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
		
		const original_position = this.element ? this.position.left + this.element.getBoundingClientRect().width/2 : null
		CONFIG.AETHERBALL.popout.current_tile = validateTokenTile(canvas.tokens.controlled[0])
		if(CONFIG.AETHERBALL.popout.current_tile != ACTIVE_TILE.Invalid) await this.render(true);
		else await this.close({ animate: false })
		if (original_position) {
			this.position.left = original_position - this.element.getBoundingClientRect().width/2
			this.setPosition(this.position)
		}
	}

	_onFirstRender(context, options) {
		super._onFirstRender(context, options);
		const position = game.settings.get("aetherball", "popoutPosition");
		const left = position.left ?? ui.nav?.element[0].getBoundingClientRect().left;
		const top = position.top ?? ui.controls?.element[0].getBoundingClientRect().top;
		options.position = {...options.position, left, top};
	}

	_onRender(context, options) {
		super._onRender(context, options);
		this.position.width = "auto";
		for (const button of this.element.querySelectorAll(".aetherball-popout button")) {
			const selectedToken = canvas.tokens.controlled[0];

			button.addEventListener("click", async (e) => {
				const action = await fetchAction(e.currentTarget.dataset.action)

				if (!selectedToken || canvas.tokens.controlled.length > 1) {
					ui.notifications.warn("Please select only one token first.");
					return;
				}
				
				if(action.type == "effect") {
					let item = selectedToken.actor.items.find(i => i.name === action.name);
					if (item) {
						await selectedToken.actor.deleteEmbeddedDocuments('Item', [item.id]);
						button.style.filter = "grayscale(1)"
						if(action.name == "Aetherball: Prone") {
							const prone_item = selectedToken.actor.items.find(i => i.name === "Prone");
							if(prone_item) await selectedToken.actor.deleteEmbeddedDocuments('Item', [prone_item.id]);
						}
					} else {
						item = await selectedToken.actor.createEmbeddedDocuments('Item', [action.toObject()]);
						await item[0].toMessage();
						button.style.filter = ""
						if(action.name == "Aetherball: Prone") {
							const pf2e_prone = await fetchProne()
							await selectedToken.actor.createEmbeddedDocuments('Item', [pf2e_prone.toObject()]);
						}
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

			fetchAction(button.dataset.action).then((action) => {
				if(selectedToken && action.type == "effect") {
					button.style.filter = selectedToken.actor.items.find(i => i.name === action.name) ? "" : "grayscale(1)"
				}
			});
		}
	}

	async _prepareContext(_options) {
		const actions = await fetchAetherballActions();
		
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

async function fetchAetherballActions() {
	const compendium = game.packs.get(CONFIG.AETHERBALL.actions_pack);
	const actions = await compendium.getDocuments();
	return actions;
}

async function fetchAction(itemId) {
	const compendium = game.packs.get(CONFIG.AETHERBALL.actions_pack);
	const item = await compendium.getDocument(itemId);
	return item;
}

async function fetchProne() {
	const compendium = game.packs.get("pf2e.conditionitems");
	return await compendium.getDocument(compendium.index.find((e) => e.name == "Prone")._id);
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