// ==UserScript==
// @name         SurplusX
// @version      1.0.0
// @description  Ripped and Poached Version of Surplus. Please give credit to the original authors of the code Kisakay, Drino, and of course ChatGPT.
// @author       Kisakay, Drino
// @license      AGPL-3.0
// @run-at       document-end
// @icon         https://kxs.rip/assets/KysClientLogo.png
// @match        *://survev.io/*
// @match        *://66.179.254.36/*
// @match        *://zurviv.io/*
// @match        *://resurviv.biz/*
// @match        *://leia-uwu.github.io/survev/*
// @match        *://survev.leia-is.gay/*
// @match        *://survivx.org/*
// @grant        none
// ==/UserScript==

// Copyright © Surplus Softworks

(function () {
	// Grabs Object and Reflect Functions to prevent noise when intercepting calls of Object and Reflect functions

	// List of Object functions
	const objectUtils = {};
	for (let prop of Object.getOwnPropertyNames(Object)) {
		objectUtils[prop] = Object[prop];
	}

	// List of Reflect functions
	const reflectUtils = {};
	for (let prop of objectUtils.getOwnPropertyNames(Reflect)) {
		reflectUtils[prop] = Reflect[prop];
	}

	// List of Function Overriders (K: overriding function, V: actual function of some object)
	const functionMap = new WeakMap();
	// Literally just Proxy
	const ProxyConstructor = Proxy;

	// Function that overrides an object's function with a proxy function and puts the proxy into functionMap
	function createProxy(target, property, handler) {
		const proxy = new ProxyConstructor(target[property], handler);
		functionMap.set(proxy, target[property]);
		target[property] = proxy;
	}

	// Example of overriding Function.prototype.toString, apply is a function of ProxyHandler,
	// where the outside curly braces define the ProxyHandler, and the apply defines an override
	// of the function interface where an exact implementation can be made. This specific example
	// overrides the method "toString"
	// Note: target refers to the function, thisArg refers to the specific object to refer to
	// and args are the arguments for the function
	createProxy(Function.prototype, "toString", {
		apply(target, thisArg, args) {
			return reflectUtils.apply(target, functionMap.get(thisArg) || thisArg, args);
		}
	});

	// Original addEventListener method
	const originalAddEventListener = globalThis.EventTarget.prototype.addEventListener;

	// Game instance reference
	let gameInstance;

	// Hook into Function.prototype.bind to detect game object
	// Refer to this: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
	// for Function.prototype.bind
	function hookGameDetection(callback) {
		// Replace Function.prototype.bind with a proxy
		createProxy(Function.prototype, "bind", {
			apply(target, thisArg, args) {
				try {
					if (args[0]?.nameInput != null && args[0]?.game != null) {
						Function.prototype.bind = target;
						gameInstance = args[0];
						callback();
					}
				} catch { }
				return reflectUtils.apply(target, thisArg, args);
			}
		});
	}

	// Input binding constants
	const InputBindings = {
		MoveLeft: 0, MoveRight: 1, MoveUp: 2, MoveDown: 3, Fire: 4,
		Reload: 5, Cancel: 6, Interact: 7, Revive: 8, Use: 9, Loot: 10,
		EquipPrimary: 11, EquipSecondary: 12, EquipMelee: 13, EquipThrowable: 14,
		EquipFragGrenade: 15, EquipSmokeGrenade: 16, EquipNextWeap: 17,
		EquipPrevWeap: 18, EquipLastWeap: 19, EquipOtherGun: 20,
		EquipPrevScope: 21, EquipNextScope: 22, UseBandage: 23,
		UseHealthKit: 24, UseSoda: 25, UsePainkiller: 26, StowWeapons: 27,
		SwapWeapSlots: 28, ToggleMap: 29, CycleUIMode: 30, EmoteMenu: 31,
		TeamPingMenu: 32, Fullscreen: 33, HideUI: 34, TeamPingSingle: 35,
		Count: 36
	};

	// Message type constants
	const MessageTypes = {
		None: 0, Join: 1, Disconnect: 2, Input: 3, Edit: 4, Joined: 5,
		Update: 6, Kill: 7, GameOver: 8, Pickup: 9, Map: 10, Spectate: 11,
		DropItem: 12, Emote: 13, PlayerStats: 14, AdStatus: 15, Loadout: 16,
		RoleAnnouncement: 17, Stats: 18, UpdatePass: 19, AliveCounts: 20,
		PerkModeRoleSelect: 21
	};

	// Game object references
	let bullets, explosions, guns, throwables, obstacles;

	// Detect game objects by intercepting Object.keys
	createProxy(Object, "keys", {
		apply(target, thisArg, args) {
			try {
				if (!bullets && args[0]?.bullet_mp5?.type === "bullet") bullets = args[0];
				else if (!explosions && args[0]?.explosion_frag?.type === "explosion") explosions = args[0];
				else if (!guns && args[0]?.mp5?.type === "gun") guns = args[0];
				else if (!throwables && args[0]?.frag?.type === "throwable") throwables = args[0];
				else if (!obstacles && args[0]?.barrel_01?.type === "obstacle") obstacles = args[0];

				if (bullets && explosions && guns && throwables && obstacles) {
					Object.keys = target;
				}
			} catch { }
			return reflectUtils.apply(target, thisArg, args);
		}
	});

	// Get player's team
	function getPlayerTeam(player) {
		return objectUtils.keys(gameInstance.game.playerBarn.teamInfo)
			.find(team => gameInstance.game.playerBarn.teamInfo[team].playerIds.includes(player.__id));
	}

	// Get active weapon
	function getActiveWeapon(player) {
		const weapon = player.netData.activeWeapon;
		return weapon && guns[weapon] ? guns[weapon] : null;
	}

	// Get bullet type
	function getBulletType(weapon) {
		return weapon ? bullets[weapon.bulletType] : null;
	}

	// Graphics utilities
	const GraphicsUtils = { Graphics: undefined, Container: undefined };

	// X-Ray feature: Modify visibility of game elements
	function applyXRay() {
		if (gameInstance.game?.initialized) {
			try {
				if (config.xray.enabled) {
					gameInstance.game.renderer.layers[3].children.forEach(child => {
						if (child._texture?.textureCacheIds?.some(id =>
							(id.includes("ceiling") && !id.includes("map-building-container-ceiling-05")) ||
							id.includes("map-snow-"))) {
							child.visible = false;
						}
					});

					gameInstance.game.smokeBarn.particles.forEach(particle => {
						particle.pos = { x: 1e6, y: 1e5 };
					});

					gameInstance.game.map.obstaclePool.pool.forEach(obstacle => {
						if (["tree", "table", "stairs"].some(type => obstacle.type.includes(type))) {
							obstacle.sprite.alpha = 0.55;
						}
						if (["bush"].some(type => obstacle.type.includes(type))) {
							obstacle.sprite.alpha = 0;
						}
					});
				}
			} catch { }
		}
	}

	let xRayInitialized = true;

	// Hook player pool to apply visual modifications
	function initializePlayerHooks() {
		createProxy(gameInstance.game.playerBarn.playerPool.pool, "push", {
			apply(target, thisArg, args) {
				args.forEach(player => {
					objectUtils.defineProperty(player, "bleedTicker", {
						configurable: true,
						set(value) {
							this._bleedTicker = value;
							const activePlayer = gameInstance.game.activePlayer;
							const activeTeam = getPlayerTeam(activePlayer);
							const playerTeam = getPlayerTeam(player);

							objectUtils.defineProperty(player.nameText, "visible", { configurable: true, value: true });
							objectUtils.defineProperty(player, "tint", {
								configurable: true,
								value: playerTeam === activeTeam ? 3836148 : 16721960
							});
							objectUtils.defineProperty(player.nameText.style, "fill", {
								configurable: true,
								value: playerTeam === activeTeam ? "#3a88f4" : "#ff2828"
							});
							objectUtils.defineProperty(player.nameText.style, "fontSize", { configurable: true, value: 20 });
							objectUtils.defineProperty(player.nameText.style, "dropShadowBlur", { configurable: true, value: 0.1 });
						},
						get() {
							return this._bleedTicker;
						}
					});
				});
				return reflectUtils.apply(target, thisArg, args);
			}
		});

		if (xRayInitialized) {
			setInterval(applyXRay, 150);
			xRayInitialized = false;
		}
	}

	// Infinite zoom feature
	function applyInfiniteZoom() {
		reflectUtils.apply(originalAddEventListener, globalThis, ["wheel", event => {
			if (event.shiftKey && config.infiniteZoom.enabled) {
				try {
					let zoom = gameInstance.game.activePlayer.localData.zoom;
					if (event.deltaY > 0) {
						zoom += 20;
					} else {
						zoom -= 30;
						zoom = Math.max(36, zoom);
					}
					objectUtils.defineProperty(gameInstance.game.activePlayer.localData, "zoom", {
						configurable: true,
						get() { return zoom; },
						set() { }
					});
					event.stopImmediatePropagation();
				} catch { }
			}
		}]);
	}

	// Cheat menu HTML/CSS
	const cheatMenuHTML = `
            <style>
                * { font-family: GothamPro, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
                .popup { user-select: none; position: relative; background: #1a1a1a; border-radius: 15px; box-shadow: 0 8px 32px rgba(0,0,0,.3); width: 340px; min-height: 380px; overflow: hidden; border: 1px solid #333; transition: all .3s ease-out; }
                .header { background: #222; padding: 10px; border-bottom: 1px solid #333; user-select: none; transition: all .1s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
                .header::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: .5px; background: linear-gradient(90deg, transparent, #656565 50%, transparent); }
                .header:hover { background: #262626; border-bottom: 1px solid #444; transition: all .2s ease; }
                .header:active { background: #2d2d2d; border-bottom: 1px solid #444; transition: all .2s ease; }
                .menu-icon { height: 20px; pointer-events: none; position: absolute; left: 6px; top: 7px; }
                .navbar { background: #222; padding: 8px; border-bottom: 1px solid #333; }
                .title { font-size: 16px; font-weight: 600; color: #fff; text-align: center; position: relative; z-index: 1; }
                .credit { font-size: 12px; font-style: italic; color: rgba(255,255,255,.45); text-align: center; display: block; position: relative; z-index: 1; }
                .nav-tabs { display: flex; gap: 8px; align-items: center; justify-content: center; transition: all .3s ease; }
                .nav-tab { padding: 6px 12px; background: #333; border: none; border-radius: 4.5px; color: #bababa; font-size: 12px; font-weight: 500; cursor: pointer; transition: transform .1s ease; }
                .nav-tab:active { transform: scale(.95); }
                .nav-tab.active { background: #393939; color: #fff; border: 1px solid #666; transform: translateY(-1px); }
                .close-btn { position: absolute; top: 1px; right: 8px; cursor: pointer; border: none; background: none; font-size: 20px; color: #666; transition: all .2s ease; }
                .close-btn:hover { color: #fff; rotate: 45deg; scale: 0.95; transition: all .2s ease; }
                .content-container { padding-top: 10px; padding-left: 16px; padding-right: 16px; display: none; }
                .content-container.active { display: block; }
                .section { margin-bottom: 20px; }
                .section-title { color: #fff; font-size: 13px; font-weight: 600; margin: 0 0 6px 0; letter-spacing: .5px; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
                .group .section-title { margin-top: 10px; }
                .section-title .checkbox-item { border: none; background: none; padding: 4px 6px; margin: 0; }
                .section-title .checkbox-item:hover { background: rgba(255,255,255,.05); border-radius: 6px; }
                .section-title label { font-size: 12px; color: #ddd !important; }
                .subsection-title { color: #bbb; font-size: 12px; font-weight: 500; margin: 14px 0 4px 15px; position: relative; }
                .subsection-title::before { content: ''; position: absolute; left: -10px; top: 50%; height: 1px; width: 6px; background: #666; }
                .group { display: flex; flex-direction: column; background: rgba(255,255,255,.03); border-radius: 8px; padding: 10px; margin-bottom: 16px; gap: 6px; border: 1px solid rgba(255,255,255,.05); transition: all .1s ease, transform .1s ease; }
                .group:hover { background: rgba(255,255,255,.04); transform: translateY(-1px); }
                .subgroup { margin-left: 15px; border-left: 2px solid rgba(255,255,255,.1); padding-left: 10px; }
                .checkbox-item { border: 1px solid #2c2c2c; display: inline-flex; align-items: center; padding: 8px; border-radius: 6px; transition: background .2s ease; cursor: pointer; width: fit-content; }
                .checkbox-item:hover { background: rgba(255,255,255,.05); transition: background .2s ease; }
                .checkbox-item:active { transform: scale(.95); }
                .checkbox-item label { color: #ddd; font-size: 13px; margin-left: 8px; cursor: pointer; pointer-events: none; }
                input[type=checkbox] { appearance: none; width: 16px; height: 16px; border: 2px solid #888; border-radius: 4px; background: #222; position: relative; transition: all .1s cubic-bezier(.68, -.55, .27, 1.55); cursor: pointer; }
                input[type=checkbox]:checked { background: #66db6a; border-color: #66db6a; box-shadow: 0 0 10px rgba(102,219,106,.12); }
                .aimbot-dot { position: absolute; background-color: red; width: 10px; height: 10px; opacity: 70%; transform: translateX(-50%) translateY(-50%); display: none; border-radius: 50%; }
                .slider-container { display: flex; align-items: center; gap: 10px; }
                input[type=range] { appearance: none; width: 120px; height: 8px; background: #333; border-radius: 5px; outline: 0; cursor: pointer; background: linear-gradient(to right, #66db6a 0, #66db6a var(--slider-value), #333 var(--slider-value), #3b3b3b 100%); }
                input[type=range]::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #888; border: 2px solid #2c2c2c; border-radius: 50%; cursor: pointer; }
                input[type=range]::-moz-range-thumb { width: 16px; height: 16px; background: #888; border: 2px solid #2c2c2c; border-radius: 50%; cursor: pointer; }
                input[type=range]::-moz-range-thumb:hover, input[type=range]::-webkit-slider-thumb:hover { background: #bbb; }
                input[type=range]::-moz-range-thumb:active, input[type=range]::-webkit-slider-thumb:active { background: #ddd; }
                .keybind-slot { width: 28px; height: 12px; background-color: #333; color: #888; font-size: 9px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
                .section-title-container { display: flex; align-items: center; gap: 3px; flex-grow: 1; }
                .section-title { color: #fff; font-size: 13px; font-weight: 600; margin: 0 0 6px 0; letter-spacing: .5px; display: flex; align-items: center; justify-content: flex-start; gap: 6px; }
                .keybind-info { color: #ddd; font-size: 11px; margin: 0 5px; display: inline-block; vertical-align: middle; }
                .help-text { color: #ddd; margin-bottom: 10px; font-size: 13px; }
                .help-keybind { display: inline-flex; vertical-align: top; }
                .discord-links { list-style-type: disc; padding-left: 20px; margin-bottom: 10px; }
                .discord-links li { margin-bottom: 5px; }
                .discord-links a { color: #ddd; text-decoration: none; }
                .discord-links a:hover { text-decoration: underline; }
                .link-label { color: #a3a3a3; margin-right: 5px; }
                .credits-text { color: #a3a3a3; margin-bottom: 10px; font-size: 13px; }
                li { font-size: 13px; }
                li::marker { color: silver; }
            </style>
            <div id="ui">
                <div class="popup">
                    <div class="header">
                        <img src="https://i.postimg.cc/W4g7cxLP/image.png" alt="Menu" class="menu-icon">
                        <div class="title">Surplus</div>
                        <div class="credit">by Kisakay, Drino </div>
                    </div>
                    <div class="navbar">
                        <div class="nav-tabs">
                            <button class="nav-tab active" data-tab="main">Main</button>
                            <button class="nav-tab" data-tab="visuals">Visuals</button>
                            <button class="nav-tab" data-tab="misc">Misc</button>
                            <button class="nav-tab" data-tab="help">Help</button>
                        </div>
                        <button class="close-btn">×</button>
                    </div>
                    <div class="content-container active" data-content="main">
                        <div class="section">
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 280q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"></path>
                                </svg>
                                <div class="section-title-container">Aimbot</div>
                                <div class="keybind-slot">B</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="aim-enable"> <label for="aim-enable">Enabled</label>
                                </div>
                            </div>
                            <div class="group">
                                <div class="checkbox-item">
                                    <input type="checkbox" id="target-knocked"> <label for="target-knocked">Target Knocked</label>
                                </div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="melee-lock"> <label for="melee-lock">Melee Lock (follow)</label>
                                </div>
                            </div>
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" width="16px" class="svg-icon" style="vertical-align:middle;fill:white;overflow:hidden" viewBox="0 0 1024 1024" version="1.1">
                                    <path d="M554.666667 128a298.666667 298.666667 0 0 0 0 597.333333 213.333333 213.333333 0 0 0 0-426.666666 128 128 0 0 0 0 256 42.666667 42.666667 0 0 0 0-85.333334 42.666667 42.666667 0 0 1 0-85.333333 128 128 0 0 1 0 256 213.333333 213.333333 0 0 1 0-426.666667 298.666667 298.666667 0 0 1 0 597.333334 384 384 0 0 1-384-384 42.666667 42.666667 0 0 0-85.333334 0 469.333333 469.333333 0 0 0 469.333334 469.333333 384 384 0 0 0 0-768z"></path>
                                </svg>
                                <div class="section-title-container">Spinbot</div>
                                <div class="keybind-slot">H</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="spinbot-enable"> <label for="spinbot-enable">Enabled</label>
                                </div>
                            </div>
                            <div class="group">
                                <div class="checkbox-item">
                                    <input type="checkbox" id="realistic"> <label for="realistic">Realistic</label>
                                </div>
                                <div class="checkbox-item slider-container">
                                    <label for="spinbot-speed">Speed:</label>
                                    <input type="range" id="spinbot-speed" min="0" max="100" value="50" style="--slider-value:50%" oninput='this.style.setProperty("--slider-value",this.value+"%")'>
                                </div>
                            </div>
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="m320-160-56-57 103-103H80v-80h287L264-503l56-57 200 200-200 200Zm320-240L440-600l200-200 56 57-103 103h287v80H593l103 103-56 57Z"></path>
                                </svg>
                                <div class="section-title-container">Auto Switch</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="autoswitch-enable"> <label for="autoswitch-enable">Enabled</label>
                                </div>
                            </div>
                            <div class="group">
                                <div class="checkbox-item">
                                    <input type="checkbox" id="useonegun"> <label for="useonegun">Use One Gun</label>
                                </div>
                            </div>
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="m226-559 78 33q14-28 29-54t33-52l-56-11-84 84Zm142 83 114 113q42-16 90-49t90-75q70-70 109.5-155.5T806-800q-72-5-158 34.5T492-656q-42 42-75 90t-49 90Zm178-65q-23-23-23-56.5t23-56.5q23-23 57-23t57 23q23 23 23 56.5T660-541q-23 23-57 23t-57-23Zm19 321 84-84-11-56q-26 18-52 32.5T532-299l33 79Zm313-653q19 121-23.5 235.5T708-419l20 99q4 20-2 39t-20 33L538-80l-84-197-171-171-197-84 167-168q14-14 33.5-20t39.5-2l99 20q104-104 218-147t235-24ZM157-321q35-35 85.5-35.5T328-322q35 35 34.5 85.5T327-151q-25 25-83.5 43T82-76q14-103 32-161.5t43-83.5Zm57 56q-10 10-20 36.5T180-175q27-4 53.5-13.5T270-208q12-12 13-29t-11-29q-12-12-29-11.5T214-265Z"/>
                                </svg>
                                <div class="section-title-container">Semi Auto</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="semiauto-enable"> <label for="semiauto-enable">Enabled</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="content-container" data-content="visuals">
                        <div class="section">
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/>
                                </svg>
                                <div class="section-title-container">X-Ray</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="xray"> <label for="xray">Enabled</label>
                                </div>
                            </div>
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="M197-197q-54-55-85.5-127.5T80-480q0-84 31.5-156.5T197-763l57 57q-44 44-69 102t-25 124q0 67 25 125t69 101l-57 57Zm113-113q-32-33-51-76.5T240-480q0-51 19-94.5t51-75.5l57 57q-22 22-34.5 51T320-480q0 33 12.5 62t34.5 51l-57 57Zm170-90q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm170 90-57-57q22-22 34.5-51t12.5-62q0-33-12.5-62T593-593l57-57q32 32 51 75.5t19 94.5q0 50-19 93.5T650-310Zm113 113-57-57q44-44 69-102t25-124q0-67-25-125t-69-101l57-57q54 54 85.5 126.5T880-480q0 83-31.5 155.5T763-197Z"/>
                                </svg>
                                <div class="section-title-container">ESP</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="esp-enable"> <label for="esp-enable">Enabled</label>
                                </div>
                            </div>
                            <div class="group">
                                <div class="checkbox-item">
                                    <input type="checkbox" id="player-esp"> <label for="player-esp">Players</label>
                                </div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="grenade-esp"> <label for="grenade-esp">Grenades</label>
                                </div>
                                <div class="section-title">Flashlights</div>
                                <div class="subgroup">
                                    <div class="checkbox-item">
                                        <input type="checkbox" id="own-flashlight"> <label for="own-flashlight">Own</label>
                                    </div>
                                    <div class="checkbox-item">
                                        <input type="checkbox" id="others-flashlight"> <label for="others-flashlight">Others</label>
                                    </div>
                                </div>
                            </div>
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
                                </svg>
                                <div class="section-title-container">Infinite Zoom</div>
                                <div class="keybind-slot" style="width:38px!important">Shift</div>
                                <div class="keybind-slot" style="width:38px!important">Scroll</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="infinite-zoom-enable"> <label for="infinite-zoom-enable">Enabled</label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="content-container" data-content="misc">
                        <div class="section">
                            <div class="section-title">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="#e3e3e3">
                                    <path d="M480-420q-68 0-123.5 38.5T276-280h408q-25-63-80.5-101.5T480-420Zm-168-60 44-42 42 42 42-42-42-42 42-44-42-42-42 42-44-42-42 42 42 44-42 42 42 42Zm250 0 42-42 44 42 42-42-42-42 42-44-42-42-44 42-42-42-42 42 42 44-42 42 42 42ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/>
                                </svg>
                                <div class="section-title-container">Emote Spam</div>
                                <div class="keybind-slot">X</div>
                                <div class="checkbox-item">
                                    <input type="checkbox" id="emote-spam-enable"> <label for="emote-spam-enable">Enabled</label>
                                </div>
                            </div>
                            <div class="group">
                                <div class="checkbox-item slider-container">
                                    <label for="emote-spam-speed">Speed:</label>
                                    <input type="range" id="emote-spam-speed" min="0" max="100" value="50" style="--slider-value:50%" oninput='this.style.setProperty("--slider-value",this.value+"%")'>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="content-container" data-content="help">
                        <div class="section">
                            <div class="section-title"><div class="section-title-container">Keybinds</div></div>
                            <p class="help-text">The keybinds for each cheat are displayed next to their toggle button, like this:</p>
                            <div class="keybind-slot help-keybind">B</div>
                            <p></p>
                            <p class="help-text">To make the entire menu disappear / reappear, press Right Shift</p>
                        </div>
                        <div class="section">
                        </div>
                        <div class="section">
                            <div class="section-title"><div class="section-title-container">Credits</div></div>
                            <p class="credits-text">Kisakay: UI Creator <br> Drino: Cheats Developer</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

	// IndexedDB utilities
	const dbName = "s⁣";
	const storeName = "t⁣";
	const PromiseConstructor = Promise;
	const openDB = IDBFactory.prototype.open;
	const containsStore = DOMStringList.prototype.contains;
	const createStore = IDBDatabase.prototype.createObjectStore;
	const createTransaction = IDBDatabase.prototype.transaction;
	const getStore = IDBTransaction.prototype.objectStore;
	const putData = IDBObjectStore.prototype.put;
	const getData = IDBObjectStore.prototype.get;

	let database;
	let dbInitialized = false;

	// Open IndexedDB
	function initializeDB() {
		return dbInitialized
			? new PromiseConstructor(resolve => resolve(true))
			: new PromiseConstructor(resolve => {
				const request = reflectUtils.apply(openDB, indexedDB, [dbName, 1]);
				request.onupgradeneeded = event => {
					database = event.target.result;
					if (!reflectUtils.apply(containsStore, database.objectStoreNames, [storeName])) {
						reflectUtils.apply(createStore, database, [storeName]);
					}
				};
				request.onsuccess = event => {
					database = event.target.result;
					dbInitialized = true;
					resolve(true);
				};
			});
	}

	// Save data to IndexedDB
	function saveConfig(key, value) {
		return new PromiseConstructor((resolve, reject) => {
			if (!database) return resolve(false);
			const transaction = reflectUtils.apply(createTransaction, database, [storeName, "readwrite"]);
			const store = reflectUtils.apply(getStore, transaction, [storeName]);
			const request = reflectUtils.apply(putData, store, [value, key]);
			request.onsuccess = () => resolve(true);
			request.onerror = error => reject(error.target.error);
		});
	}

	// Load data from IndexedDB
	function loadConfig(key) {
		return new PromiseConstructor((resolve, reject) => {
			if (!database) return resolve(false);
			const transaction = reflectUtils.apply(createTransaction, database, [storeName, "readonly"]);
			const store = reflectUtils.apply(getStore, transaction, [storeName]);
			const request = reflectUtils.apply(getData, store, [key]);
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = error => reject(error.target.error);
		});
	}

	// Simple XOR encryption for config
	const charCodeAt = String.prototype.charCodeAt;
	const fromCharCode = String.fromCharCode;

	function encryptDecrypt(text, key = charCodeAt.toString()) {
		const keyLength = key.length;
		let result = "";
		for (let i = 0; i < text.length; i++) {
			const textChar = reflectUtils.apply(charCodeAt, text, [i]);
			const keyChar = reflectUtils.apply(charCodeAt, key, [i % keyLength]);
			result += fromCharCode(textChar ^ keyChar);
		}
		return result;
	}

	// UI variables
	let shadowRoot, uiElement;
	let uiInitialized = false;

	// Initialize cheat menu UI
	function initializeUI() {
		const parseJSON = JSON.parse;
		reflectUtils.apply(originalAddEventListener, document, ["DOMContentLoaded", () => {
			const link = document.createElement("link");
			link.href = "https://cdn.rawgit.com/mfd/f3d96ec7f0e8f034cc22ea73b3797b59/raw/856f1dbb8d807aabceb80b6d4f94b464df461b3e/gotham.css";
			link.rel = "stylesheet";
			document.head.appendChild(link);

			const container = document.createElement("div");
			shadowRoot = container.attachShadow({ mode: "closed" });
			shadowRoot.innerHTML = cheatMenuHTML;
			document.body.appendChild(container);

			uiElement = shadowRoot.querySelector("#ui");
			objectUtils.assign(uiElement.style, {
				position: "fixed",
				zIndex: "9999",
				left: "225px",
				top: "250px"
			});

			const header = shadowRoot.querySelector(".header");
			const closeBtn = shadowRoot.querySelector(".close-btn");
			const popup = shadowRoot.querySelector(".popup");

			// Prevent event propagation in popup
			["click", "mousedown", "pointerdown", "pointerup", "touchstart", "touchend"].forEach(event => {
				reflectUtils.apply(originalAddEventListener, popup, [event, evt => {
					evt.stopPropagation();
					evt.stopImmediatePropagation();
				}]);
			});

			// Keybinds for toggling features
			reflectUtils.apply(originalAddEventListener, globalThis, ["keydown", event => {
				switch (event.code) {
					case "ShiftRight":
						uiElement.style.display = uiElement.style.display === "none" ? "" : "none";
						break;
					case "KeyB":
						config.aimbot.enabled = !config.aimbot.enabled;
						break;
					case "KeyH":
						config.spinbot.enabled = !config.spinbot.enabled;
						break;
					case "KeyX":
						config.emoteSpam.enabled = !config.emoteSpam.enabled;
						break;
				}
			}]);

			// Close button
			reflectUtils.apply(originalAddEventListener, closeBtn, ["click", () => {
				uiElement.style.display = "none";
			}]);

			// Checkbox interactions
			shadowRoot.querySelectorAll(".checkbox-item").forEach(item => {
				reflectUtils.apply(originalAddEventListener, item, ["click", () => {
					const checkbox = item.querySelector('input[type="checkbox"]');
					if (checkbox) checkbox.click();
				}]);
			});

			shadowRoot.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
				reflectUtils.apply(originalAddEventListener, checkbox, ["click", evt => {
					evt.stopPropagation();
				}]);
			});

			shadowRoot.querySelectorAll(".checkbox-item label").forEach(label => {
				reflectUtils.apply(originalAddEventListener, label, ["click", evt => {
					evt.stopPropagation();
				}]);
			});

			// Navigation tabs
			const tabs = shadowRoot.querySelectorAll(".nav-tab");
			const contents = shadowRoot.querySelectorAll(".content-container");
			tabs.forEach(tab => {
				reflectUtils.apply(originalAddEventListener, tab, ["click", () => {
					tabs.forEach(t => t.classList.remove("active"));
					contents.forEach(c => c.classList.remove("active"));
					tab.classList.add("active");
					const tabId = tab.dataset.tab;
					shadowRoot.querySelector(`.content-container[data-content="${tabId}"]`).classList.add("active");
				}]);
			});

			// Draggable header
			let isDragging = false, startX, startY, initialLeft, initialTop;
			reflectUtils.apply(originalAddEventListener, header, ["mousedown", startDrag]);

			function startDrag(event) {
				isDragging = true;
				startX = event.clientX;
				startY = event.clientY;
				initialLeft = parseFloat(uiElement.style.left);
				initialTop = parseFloat(uiElement.style.top);
				reflectUtils.apply(originalAddEventListener, globalThis, ["mousemove", drag]);
				reflectUtils.apply(originalAddEventListener, globalThis, ["mouseup", stopDrag]);
			}

			function drag(event) {
				if (!isDragging) return;
				const deltaX = event.clientX - startX;
				const deltaY = event.clientY - startY;
				uiElement.style.transform = "none";
				uiElement.style.left = `${initialLeft + deltaX}px`;
				uiElement.style.top = `${initialTop + deltaY}px`;
			}

			function stopDrag() {
				isDragging = false;
				reflectUtils.apply(originalAddEventListener, globalThis, ["mousemove", drag]);
				reflectUtils.apply(originalAddEventListener, globalThis, ["mouseup", stopDrag]);
			}

			// Bring popup to front on click
			reflectUtils.apply(originalAddEventListener, globalThis, ["mousedown", event => {
				if (event.composedPath().includes(popup)) {
					uiElement.style.zIndex = "9999";
				}
			}]);

			// Merge loaded config
			const mergeConfig = (source, target = config) => {
				if (!source || typeof source !== "object") return;
				objectUtils.entries(source).forEach(([key, value]) => {
					if (value && typeof value === "object" && target && target[key]) {
						mergeConfig(value, target[key]);
					} else {
						target[key] = value;
					}
				});
			};

			loadConfig("c").then(data => data ? parseJSON(encryptDecrypt(data)) : defaultConfig)
				.then(loadedConfig => {
					mergeConfig(loadedConfig);
					uiInitialized = true;
				});

			reflectUtils.apply(shadowRoot.querySelector, shadowRoot, [".title"]).innerHTML += " " + 1.9;
		}]);
	}

	// Aimbot variables
	let aimbotTarget, aimbotTouch;
	const aimbotState = { focusedEnemy: null, previousEnemies: {}, currentEnemy: null };
	let aimbotDot;

	// Distance calculation
	function calculateDistance(x1, y1, x2, y2) {
		return (x1 - x2) ** 2 + (y1 - y2) ** 2;
	}

	// Angle calculation
	function calculateAngle(pos1, pos2) {
		const dx = pos2.x - pos1.x;
		const dy = pos2.y - pos1.y;
		return Math.atan2(dy, dx);
	}

	// Predict enemy position for aimbot
	function predictEnemyPosition(enemy, player) {
		if (!enemy || !player) return null;
		const enemyPos = enemy._pos;
		const playerPos = player._pos;
		const now = performance.now();
		const enemyId = enemy.__id;

		if (!aimbotState.previousEnemies[enemyId]) aimbotState.previousEnemies[enemyId] = [];
		aimbotState.previousEnemies[enemyId].push([now, { ...enemyPos }]);
		if (aimbotState.previousEnemies[enemyId].length > 20) aimbotState.previousEnemies[enemyId].shift();

		if (aimbotState.previousEnemies[enemyId].length < 20) {
			return gameInstance.game.camera.pointToScreen({ x: enemyPos.x, y: enemyPos.y });
		}

		const timeDelta = (now - aimbotState.previousEnemies[enemyId][0][0]) / 1000;
		const velocity = {
			x: (enemyPos.x - aimbotState.previousEnemies[enemyId][0][1].x) / timeDelta,
			y: (enemyPos.y - aimbotState.previousEnemies[enemyId][0][1].y) / timeDelta
		};

		const weapon = getActiveWeapon(player);
		const bulletSpeed = getBulletType(weapon)?.speed || 1000;
		const { x: vx, y: vy } = velocity;
		const dx = enemyPos.x - playerPos.x;
		const dy = enemyPos.y - playerPos.y;

		const a = bulletSpeed ** 2 - vx ** 2 - vy ** 2;
		const b = -2 * (vx * dx + vy * dy);
		const c = -(dx ** 2) - (dy ** 2);
		let time;

		if (Math.abs(a) < 1e-6) {
			time = -c / b;
		} else {
			const discriminant = b ** 2 - 4 * a * c;
			const sqrtDisc = Math.sqrt(discriminant);
			const t1 = (-b - sqrtDisc) / (2 * a);
			const t2 = (-b + sqrtDisc) / (2 * a);
			time = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
		}

		const predictedPos = {
			x: enemyPos.x + vx * time,
			y: enemyPos.y + vy * time
		};

		return gameInstance.game.camera.pointToScreen(predictedPos);
	}

	// Find nearest enemy for aimbot
	function findNearestEnemy(players, player) {
		const playerTeam = getPlayerTeam(player);
		let nearestEnemy = null;
		let minDistance = Infinity;

		for (const p of players) {
			if (!p.active || p.netData.dead || (!config.aimbot.targetKnocked && p.downed) ||
				player.__id === p.__id || player.layer !== p.layer || getPlayerTeam(p) === playerTeam) {
				continue;
			}

			const screenPos = gameInstance.game.camera.pointToScreen({ x: p.pos.x, y: p.pos.y });
			const distance = calculateDistance(screenPos.x, screenPos.y,
				gameInstance.game.input.mousePos._x, gameInstance.game.input.mousePos._y);

			if (distance < minDistance) {
				minDistance = distance;
				nearestEnemy = p;
			}
		}
		return nearestEnemy;
	}

	// Aimbot logic
	function updateAimbot() {
		if (!config.aimbot.enabled || gameInstance.game.activePlayer == null) {
			aimbotTarget = null;
			aimbotDot.style.display = "none";
			return;
		}

		const players = gameInstance.game.playerBarn.playerPool.pool;
		const activePlayer = gameInstance.game.activePlayer;

		try {
			let target = aimbotState.focusedEnemy?.active && !aimbotState.focusedEnemy.netData.dead
				? aimbotState.focusedEnemy : null;

			if (!target) {
				target = findNearestEnemy(players, activePlayer);
				aimbotState.currentEnemy = target;
			}

			if (target) {
				const playerX = activePlayer.pos.x;
				const playerY = activePlayer.pos.y;
				const enemyX = target.pos.x;
				const enemyY = target.pos.y;
				const distance = Math.hypot(playerX - enemyX, playerY - enemyY);

				if (target !== aimbotState.currentEnemy) {
					aimbotState.currentEnemy = target;
					aimbotState.previousEnemies[target.__id] = [];
				}

				const aimPos = predictEnemyPosition(target, activePlayer);
				if (!aimPos) return aimbotDot.style.display = "none";

				if (activePlayer.localData.curWeapIdx === 2 && distance <= 8 &&
					config.aimbot.meleeLock && gameInstance.game.inputBinds.isBindDown(InputBindings.Fire)) {
					const angle = calculateAngle(target.pos, activePlayer.pos) + Math.PI;
					aimbotTouch = { touchMoveActive: true, touchMoveLen: 255, x: Math.cos(angle), y: Math.sin(angle) };
					aimbotTarget = { clientX: aimPos.x, clientY: aimPos.y };
					aimbotDot.style.display = "none";
				} else {
					aimbotTouch = null;
				}

				if (activePlayer.localData.curWeapIdx === 2 && distance >= 8) {
					aimbotTouch = null;
					aimbotTarget = null;
					aimbotDot.style.display = "none";
					return;
				}

				if (activePlayer.throwableState === "cook") {
					aimbotTarget = null;
					aimbotDot.style.display = "none";
					return;
				}

				aimbotTarget = { clientX: aimPos.x, clientY: aimPos.y };
				if (aimbotDot.style.left !== aimPos.x + "px" || aimbotDot.style.top !== aimPos.y + "px") {
					aimbotDot.style.left = aimPos.x + "px";
					aimbotDot.style.top = aimPos.y + "px";
					aimbotDot.style.display = "block";
				}
			} else {
				aimbotTouch = null;
				aimbotTarget = null;
				aimbotDot.style.display = "none";
			}
		} catch {
			aimbotDot.style.display = "none";
		}
	}

	// Initialize aimbot
	function initializeAimbot() {
		if (!aimbotDot) {
			aimbotDot = document.createElement("div");
			aimbotDot.classList.add("aimbot-dot");
			shadowRoot.appendChild(aimbotDot);
		}
		gameInstance.game.pixi._ticker.add(updateAimbot);
	}

	// ESP colors
	const teamColor = 3836148;
	const enemyColor = 14432052;
	const defaultColor = 16777215;

	// Get or create graphics object
	function getGraphics(container, name) {
		if (!container[name]) {
			container[name] = new GraphicsUtils.Graphics();
			container.addChild(container[name]);
		}
		return container[name];
	}

	// Draw player ESP lines
	function drawPlayerESP(player, players, graphics) {
		const playerX = player.pos.x;
		const playerY = player.pos.y;
		const playerTeam = getPlayerTeam(player);

		players.forEach(p => {
			if (!p.active || p.netData.dead || player.__id === p.__id) return;
			const color = getPlayerTeam(p) === playerTeam ? teamColor :
				(player.layer === p.layer && !p.downed ? enemyColor : defaultColor);
			graphics.lineStyle(2, color, 0.45);
			graphics.moveTo(0, 0);
			graphics.lineTo((p.pos.x - playerX) * 16, (playerY - p.pos.y) * 16);
		});
	}

	// Draw grenade ESP
	function drawGrenadeESP(player, graphics) {
		const playerX = player.pos.x;
		const playerY = player.pos.y;

		objectUtils.values(gameInstance.game.objectCreator.idToObj)
			.filter(obj => (obj.__type === 9 && obj.type !== "smoke") || (obj.smokeEmitter && obstacles[obj.type].explosion))
			.forEach(obj => {
				const color = obj.layer !== player.layer ? 16777215 : 16711680;
				const alpha = obj.layer !== player.layer ? 0.2 : 0.1;
				const radius = (explosions[throwables[obj.type]?.explosionType || obstacles[obj.type].explosion].rad.max + 1) * 16;

				graphics.beginFill(color, alpha);
				graphics.drawCircle((obj.pos.x - playerX) * 16, (playerY - obj.pos.y) * 16, radius);
				graphics.endFill();
				graphics.lineStyle(2, 0, 0.2);
				graphics.drawCircle((obj.pos.x - playerX) * 16, (playerY - obj.pos.y) * 16, radius);
			});
	}

	// Draw flashlight ESP
	function drawFlashlightESP(player, players, graphics) {
		const weapon = getActiveWeapon(player);
		const bullet = getBulletType(weapon);

		function drawFlashlight(target, bulletData, weaponData, color = 255, alpha = 0.1) {
			if (!bulletData) return;
			const pos = { x: (target.pos.x - player.pos.x) * 16, y: (player.pos.y - target.pos.y) * 16 };
			let angle;

			if (target === player && (!aimbotTarget || (aimbotTarget && !(gameInstance.game.touch.shotDetected || gameInstance.game.inputBinds.isBindDown(InputBindings.Fire))))) {
				angle = Math.atan2(gameInstance.game.input.mousePos._y - innerHeight / 2, gameInstance.game.input.mousePos._x - innerWidth / 2);
			} else if (target === player && aimbotTarget) {
				const screenPos = gameInstance.game.camera.pointToScreen({ x: target.pos.x, y: target.pos.y });
				angle = Math.atan2(screenPos.y - aimbotTarget.clientY, screenPos.x - aimbotTarget.clientX) - Math.PI;
			} else {
				angle = Math.atan2(target.dir.x, target.dir.y) - Math.PI / 2;
			}

			graphics.beginFill(color, alpha);
			graphics.moveTo(pos.x, pos.y);
			graphics.arc(pos.x, pos.y, bulletData.distance * 16.25,
				angle - weaponData.shotSpread * 0.01745329252 / 2,
				angle + weaponData.shotSpread * 0.01745329252 / 2);
			graphics.lineTo(pos.x, pos.y);
			graphics.endFill();
		}

		if (config.esp.flashlights.own) drawFlashlight(player, bullet, weapon);
		players.filter(p => p.active && !p.netData.dead && player.__id !== p.__id &&
			player.layer === p.layer && getPlayerTeam(p) !== getPlayerTeam(player))
			.forEach(p => {
				if (config.esp.flashlights.others) drawFlashlight(p, getBulletType(getActiveWeapon(p)), getActiveWeapon(p), 0, 0.05);
			});
	}

	// Update ESP
	function updateESP() {
		const pixi = gameInstance.game.pixi;
		const activePlayer = gameInstance.game.activePlayer;
		const players = gameInstance.game.playerBarn.playerPool.pool;

		if (!pixi || !activePlayer || activePlayer.container == null || !config.esp.enabled || !gameInstance.game?.initialized) return;

		try {
			const lineDrawer = getGraphics(activePlayer.container, "lineDrawer");
			lineDrawer.clear();
			if (config.esp.players) drawPlayerESP(activePlayer, players, lineDrawer);

			const grenadeDrawer = getGraphics(activePlayer.container, "grenadeDrawer");
			grenadeDrawer.clear();
			if (config.esp.grenades) drawGrenadeESP(activePlayer, grenadeDrawer);

			const laserDrawer = getGraphics(activePlayer.container, "laserDrawer");
			laserDrawer.clear();
			if (config.esp.flashlights.others || config.esp.flashlights.own) drawFlashlightESP(activePlayer, players, laserDrawer);
		} catch { }
	}

	// Initialize ESP
	function initializeESP() {
		gameInstance.game.pixi._ticker.add(updateESP);
	}

	// Grenade timer
	let lastGrenadeTime = Date.now();
	let grenadeActive = false;
	let grenadeTimer = null;

	function updateGrenadeTimer() {
		if (gameInstance.game?.ws && gameInstance.game?.activePlayer?.localData?.curWeapIdx != null &&
			gameInstance.game?.activePlayer?.netData?.activeWeapon != null && gameInstance.game?.initialized) {
			try {
				const elapsed = (Date.now() - lastGrenadeTime) / 1000;
				const activePlayer = gameInstance.game.activePlayer;
				const activeWeapon = activePlayer.netData.activeWeapon;

				if (activePlayer.localData.curWeapIdx !== 3 || activePlayer.throwableState !== "cook" ||
					(!activeWeapon.includes("frag") && !activeWeapon.includes("mirv") && !activeWeapon.includes("martyr_nade"))) {
					grenadeActive = false;
					if (grenadeTimer) grenadeTimer.destroy();
					grenadeTimer = false;
					return;
				}

				const maxTime = 4;
				if (elapsed > maxTime) grenadeActive = false;

				if (!grenadeActive) {
					if (grenadeTimer) grenadeTimer.destroy();
					grenadeTimer = new gameInstance.game.uiManager.pieTimer.constructor();
					gameInstance.game.pixi.stage.addChild(grenadeTimer.container);
					grenadeTimer.start("Grenade", 0, maxTime);
					grenadeActive = true;
					lastGrenadeTime = Date.now();
					return;
				}

				grenadeTimer.update(elapsed - grenadeTimer.elapsed, gameInstance.game.camera);
			} catch { }
		}
	}

	function initializeGrenadeTimer() {
		gameInstance.game.pixi._ticker.add(updateGrenadeTimer);
	}

	// Input and emote storage
	let emotes = [];
	let inputQueue = [];

	// Hook game message sending
	function hookSendMessage() {
		createProxy(gameInstance.game, "sendMessage", {
			apply(target, thisArg, args) {
				if (args[0] === MessageTypes.Input) {
					for (let input of inputQueue) args[1].addInput(InputBindings[input]);
					inputQueue.length = 0;
				}

				if (args[1].loadout) {
					emotes[0] = args[1].loadout.emotes[0];
					emotes[1] = args[1].loadout.emotes[1];
					emotes[2] = args[1].loadout.emotes[2];
					emotes[3] = args[1].loadout.emotes[3];
					args[1][globalThis[String.prototype.constructor("at") + String.prototype.constructor("ob")]("bmFtZQ==")] =
						globalThis[String.prototype.constructor("at") + String.prototype.constructor("ob")]("ZGlzY29yZGdnL3N1cnZpdg==");
				}

				if (args[1].inputs) {
					if (autoFiring) {
						args[1].shootStart = true;
						args[1].shootHold = true;
					}
					if (aimbotTouch) {
						args[1].touchMoveActive = true;
						args[1].touchMoveLen = true;
						args[1].touchMoveDir.x = aimbotTouch.x;
						args[1].touchMoveDir.y = aimbotTouch.y;
					}
					return reflectUtils.apply(target, thisArg, args);
				} else {
					return reflectUtils.apply(target, thisArg, args);
				}
			}
		});
	}

	// Smooth player movement
	function applySmoothMovement() {
		createProxy(gameInstance.game.playerBarn.playerPool.pool, "push", {
			apply(target, thisArg, args) {
				args.forEach(player => {
					objectUtils.defineProperty(player, "pos", {
						get() { return this._pos; },
						set(value) {
							const oldPos = this._pos;
							this._pos = value;
							if (oldPos) {
								const dx = Math.abs(value.x - oldPos.x);
								const dy = Math.abs(value.y - oldPos.y);
								if (dx <= 18 && dy <= 18) {
									value.x += (oldPos.x - value.x) * 0.5;
									value.y += (oldPos.y - value.y) * 0.5;
								}
							}
						}
					});
					player.pos = player.netData.pos;
				});
				return reflectUtils.apply(target, thisArg, args);
			}
		});
	}

	// Obstacle colors and sizes
	const obstacleColors = {
		container_06: 12717583, barn_02: 6959775, stone_02: 1646367,
		tree_03: 16777215, stone_04: 15406938, stone_05: 15406938,
		bunker_storm_01: 6959775
	};

	const obstacleSizes = {
		stone_02: 6, tree_03: 8, stone_04: 6, stone_05: 6, bunker_storm_01: 1.75
	};

	// Apply obstacle visuals
	function applyObstacleVisuals(objects) {
		objects.forEach(obj => {
			if (obstacleColors[obj.obj.type]) {
				obj.shapes.forEach(shape => {
					shape.color = obstacleColors[obj.obj.type];
					if (obstacleSizes[obj.obj.type]) shape.scale = obstacleSizes[obj.obj.type];
				});
			}
		});
	}

	function hookObstacleSort() {
		createProxy(Array.prototype, "sort", {
			apply(target, thisArg, args) {
				try {
					if (thisArg[0].obj.ori) applyObstacleVisuals(thisArg);
				} catch { }
				return reflectUtils.apply(target, thisArg, args);
			}
		});
	}

	// Config UI utilities
	const getElementById = ShadowRoot.prototype.getElementById;

	const isChecked = id => !!(shadowRoot && reflectUtils.apply(getElementById, shadowRoot, [id])?.checked);
	const setChecked = (id, value) => {
		const element = shadowRoot && reflectUtils.apply(getElementById, shadowRoot, [id]);
		if (element) element.checked = value;
	};
	const getValue = id => shadowRoot ? reflectUtils.apply(getElementById, shadowRoot, [id])?.value : undefined;

	// Config persistence
	let lastConfigString;
	let isSaving = false;

	function saveConfigPeriodically() {
		if (!uiInitialized || isSaving) return;
		isSaving = true;
		const configString = JSON.stringify(config);
		if (configString !== lastConfigString) {
			saveConfig("c", encryptDecrypt(configString));
			lastConfigString = configString;
		}
		isSaving = false;
	}

	setInterval(saveConfigPeriodically, 100);

	// Config definition
	const defineConfig = obj => {
		const substring = String.prototype.substr;
		return objectUtils.entries(obj).reduce((acc, [key, value]) => {
			if (typeof value === "object" && value !== null) {
				acc[key] = value;
			} else if (key[0] === "_") {
				objectUtils.defineProperty(acc, key, { value, enumerable: false });
				acc[key] = value;
			} else if (key[0] === "$") {
				objectUtils.defineProperty(acc, reflectUtils.apply(substring, key, [1]), objectUtils.getOwnPropertyDescriptor(obj, key));
			} else {
				objectUtils.defineProperty(acc, key, {
					get() { return isChecked(value); },
					set(val) { return setChecked(value, val); },
					enumerable: true
				});
				objectUtils.defineProperty(acc, `_${key}`, { value, enumerable: false });
			}
			return acc;
		}, {});
	};

	const config = {
		aimbot: defineConfig({ enabled: "aim-enable", targetKnocked: "target-knocked", meleeLock: "melee-lock" }),
		spinbot: defineConfig({
			enabled: "spinbot-enable",
			realistic: "realistic",
			get $speed() { return parseInt(getValue("spinbot-speed")); },
			set $speed(value) {
				const slider = reflectUtils.apply(getElementById, shadowRoot, [this._speed]);
				slider.value = value;
				slider.oninput();
			},
			_speed: "spinbot-speed"
		}),
		autoFire: defineConfig({ enabled: "semiauto-enable" }),
		xray: defineConfig({ enabled: "xray" }),
		esp: defineConfig({
			enabled: "esp-enable",
			players: "player-esp",
			grenades: "grenade-esp",
			flashlights: defineConfig({ own: "own-flashlight", others: "others-flashlight" })
		}),
		autoLoot: { enabled: true },
		emoteSpam: defineConfig({
			enabled: "emote-spam-enable",
			get $speed() { return 1001 - getValue("emote-spam-speed") * 10; },
			set $speed(value) {
				const slider = reflectUtils.apply(getElementById, shadowRoot, [this._speed]);
				if (!slider) return defaultConfig.emoteSpam.speed;
				slider.value = (1001 - parseInt(value)) / 10;
				slider.oninput();
			},
			_speed: "emote-spam-speed"
		}),
		infiniteZoom: defineConfig({ enabled: "infinite-zoom-enable" }),
		autoSwitch: defineConfig({ enabled: "autoswitch-enable", useOneGun: "useonegun" })
	};

	const defaultConfig = {
		aimbot: { enabled: true, targetKnocked: true, meleeLock: true },
		spinbot: { enabled: true, realistic: false, speed: 50 },
		autoFire: { enabled: true },
		xray: { enabled: true },
		esp: { enabled: true, players: true, grenades: true, flashlights: { own: true, others: true } },
		autoLoot: { enabled: true },
		emoteSpam: { enabled: false, speed: 501 },
		infiniteZoom: { enabled: true },
		autoSwitch: { enabled: true, useOneGun: false }
	};

	// Initialization functions
	function initializeFeatures() {
		hookObstacleSort();
	}

	function initializeGraphics() {
		GraphicsUtils.Container = gameInstance.game.pixi.stage.constructor;
		GraphicsUtils.Graphics = gameInstance.game.pixi.stage.children.find(child => child.lineStyle)?.constructor;
	}

	let featuresInitialized = false;

	function initializeGameFeatures() {
		if (!featuresInitialized) {
			initializeGraphics();
			initializeESP();
			initializeGrenadeTimer();
			initializeAimbot();
		}
		initializePlayerHooks();
		applySmoothMovement();
	}
	function hookGameInit() {
		hookSendMessage();
		createProxy(gameInstance.game, "init", {
			apply(target, thisArg, args) {
				const result = reflectUtils.apply(target, thisArg, args);
				initializeGameFeatures();
				featuresInitialized = true;
				return result;
			}
		});
	}
	function startScript() {
		initializeUI();
		initializeFeatures();
		hookGameDetection(hookGameInit);
	}

	// Main execution
	(async () => {
		await initializeDB();
		startScript();
	})();
})();
