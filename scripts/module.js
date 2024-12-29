// Basically all of this stolen from Dice Tray cause I can't find a single explanation on how fvtt works : https://github.com/mclemente/fvtt-dice-tray

const { ApplicationV2: ApplicationV2$1, HandlebarsApplicationMixin: HandlebarsApplicationMixin$1 } = foundry.applications.api;

class Aetherball {
    popout
}

class AetherballPopout extends HandlebarsApplicationMixin$1(ApplicationV2$1) {
	static DEFAULT_OPTIONS = {
		id: "aetherball-popout",
		tag: "aside",
		position: {
			width: ui?.sidebar?.options.width ?? 300
		},
		window: {
			title: "Aetherball",
			minimizable: true
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
    
	/*_onFirstRender(context, options) {
		super._onFirstRender(context, options);
		const position = game.settings.get("aetherball", "popoutPosition");
		const left = position.left ?? ui.nav?.element[0].getBoundingClientRect().left;
		const top = position.top ?? ui.controls?.element[0].getBoundingClientRect().top;
		options.position = {...options.position, left, top};
	}*/

    /*setPosition(position) {
		const superPosition = super.setPosition(position);
		const { left, top } = superPosition;
		game.settings.set("aetherball", "popoutPosition", { left, top });
		return superPosition;
	}*/
}

Hooks.once('init', async function() {
    CONFIG.AETHERBALL = new Aetherball()
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
