const COLOR = {
	Red: "#ff0043",
	Green: "#14fc56",
	Blue: "#1e7fff",
	Purple: "#e60aff",
	Gold: "#ffbf36",
	White: "#ffffff",
};


//特殊的不可见颜色(未呈现，因此不在颜色贴图中)
const INVISIBLE = "_INVISIBLE_";

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

//常数导数
const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map((colorName) => COLOR[colorName]);
//看不见的星星需要一个标识符，即使它们不会被渲染——物理学仍然适用。
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
//颜色代码映射到它们在数组中的索引。对于快速确定颜色是否已经在循环中更新非常有用。
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
	obj[code] = i;
	return obj;
}, {});
// Tuples是用{ r，g，b }元组(仍然只是对象)的值通过颜色代码(十六进制)映射的键。
const COLOR_TUPLES = {};
COLOR_CODES.forEach((hex) => {
	COLOR_TUPLES[hex] = {
		r: parseInt(hex.substr(1, 2), 16),
		g: parseInt(hex.substr(3, 2), 16),
		b: parseInt(hex.substr(5, 2), 16),
	};
});

// 获取随机颜色
function randomColorSimple() {
	return COLOR_CODES[(Math.random() * COLOR_CODES.length) | 0];
}

// 得到一个随机的颜色根据一些定制选项
let lastColor;
function randomColor(options) {
	const notSame = options && options.notSame;
	const notColor = options && options.notColor;
	const limitWhite = options && options.limitWhite;
	let color = randomColorSimple();

	// 限制白色随机抽取的
	if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
		color = randomColorSimple();
	}

	if (notSame) {
		while (color === lastColor) {
			color = randomColorSimple();
		}
	} else if (notColor) {
		while (color === notColor) {
			color = randomColorSimple();
		}
	}

	lastColor = color;
	return color;
}

function whiteOrGold() {
	return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

// Dynamic globals
let currentFrame = 0;
let speedBarOpacity = 0;
let autoLaunchTime = 0;

function updateSpeedFromEvent(event) {
	if (isUpdatingSpeed || event.y >= mainStage.height - 44) {
		// On phones it's hard to hit the edge pixels in order to set speed at 0 or 1, so some padding is provided to make that easier.
		const edge = 16;
		const newSpeed = (event.x - edge) / (mainStage.width - edge * 2);
		simSpeed = Math.min(Math.max(newSpeed, 0), 1);
		// show speed bar after an update
		speedBarOpacity = 1;
		// If we updated the speed, return true
		return true;
	}
	// Return false if the speed wasn't updated
	return false;
}

// Extracted function to keep `update()` optimized
function updateGlobals(timeStep, lag) {
	currentFrame++;

	// Always try to fade out speed bar
	if (!isUpdatingSpeed) {
		speedBarOpacity -= lag / 30; // half a second
		if (speedBarOpacity < 0) {
			speedBarOpacity = 0;
		}
	}

	// auto launch shells
	if (store.state.config.autoLaunch) {
		autoLaunchTime -= timeStep;
		if (autoLaunchTime <= 0) {
			autoLaunchTime = startSequence() * 1.25;
		}
	}
}

//帧绘制回调
function update(frameTime, lag) {
	if (!isRunning()) return;

	const width = stageW;
	const height = stageH;
	const timeStep = frameTime * simSpeed;
	const speed = simSpeed * lag;

	updateGlobals(timeStep, lag);

	const starDrag = 1 - (1 - Star.airDrag) * speed;
	const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
	const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
	const gAcc = (timeStep / 1000) * GRAVITY;
	COLOR_CODES_W_INVIS.forEach((color) => {
		// 绘制星花
		const stars = Star.active[color];
		for (let i = stars.length - 1; i >= 0; i = i - 1) {
			const star = stars[i];
			// Only update each star once per frame. Since color can change, it's possible a star could update twice without this, leading to a "jump".
			if (star.updateFrame === currentFrame) {
				continue;
			}
			star.updateFrame = currentFrame;

			star.life -= timeStep;
			//星花生命周期结束回收实例
			if (star.life <= 0) {
				stars.splice(i, 1);
				Star.returnInstance(star);
			} else {
				const burnRate = Math.pow(star.life / star.fullLife, 0.5);
				const burnRateInverse = 1 - burnRate;

				star.prevX = star.x;
				star.prevY = star.y;
				star.x += star.speedX * speed;
				star.y += star.speedY * speed;
				// Apply air drag if star isn't "heavy". The heavy property is used for the shell comets.
				//如果星形不是“heavy”，应用空气阻力。重的性质被用于壳彗星。
				if (!star.heavy) {
					star.speedX *= starDrag;
					star.speedY *= starDrag;
				} else {
					star.speedX *= starDragHeavy;
					star.speedY *= starDragHeavy;
				}
				star.speedY += gAcc;

				if (star.spinRadius) {
					star.spinAngle += star.spinSpeed * speed;
					star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
					star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
				}

				if (star.sparkFreq) {
					star.sparkTimer -= timeStep;
					while (star.sparkTimer < 0) {
						star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
						Spark.add(star.x, star.y, star.sparkColor, Math.random() * PI_2, Math.random() * star.sparkSpeed * burnRate, star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife);
					}
				}

				// Handle star transitions
				if (star.life < star.transitionTime) {
					if (star.secondColor && !star.colorChanged) {
						star.colorChanged = true;
						star.color = star.secondColor;
						stars.splice(i, 1);
						Star.active[star.secondColor].push(star);
						if (star.secondColor === INVISIBLE) {
							star.sparkFreq = 0;
						}
					}

					if (star.strobe) {
						// Strobes in the following pattern: on:off:off:on:off:off in increments of `strobeFreq` ms.
						star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
					}
				}
			}
		}

		// 绘制火花
		const sparks = Spark.active[color];
		for (let i = sparks.length - 1; i >= 0; i = i - 1) {
			const spark = sparks[i];
			spark.life -= timeStep;
			if (spark.life <= 0) {
				sparks.splice(i, 1);
				Spark.returnInstance(spark);
			} else {
				spark.prevX = spark.x;
				spark.prevY = spark.y;
				spark.x += spark.speedX * speed;
				spark.y += spark.speedY * speed;
				spark.speedX *= sparkDrag;
				spark.speedY *= sparkDrag;
				spark.speedY += gAcc;
			}
		}
	});

	render(speed);
}

function render(speed) {
	const { dpr } = mainStage;
	const width = stageW;
	const height = stageH;
	const trailsCtx = trailsStage.ctx;
	const mainCtx = mainStage.ctx;

	if (skyLightingSelector() !== SKY_LIGHT_NONE) {
		colorSky(speed);
	}

	// Account for high DPI screens, and custom scale factor.
	const scaleFactor = scaleFactorSelector();
	trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
	mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

	trailsCtx.globalCompositeOperation = "source-over";
	trailsCtx.fillStyle = `rgba(0, 0, 0, ${store.state.config.longExposure ? 0.0025 : 0.175 * speed})`;
	trailsCtx.fillRect(0, 0, width, height);

	mainCtx.clearRect(0, 0, width, height);

	// Draw queued burst flashes
	// These must also be drawn using source-over due to Safari. Seems rendering the gradients using lighten draws large black boxes instead.
	// Thankfully, these burst flashes look pretty much the same either way.
	// This project is copyrighted by NianBroken!
	while (BurstFlash.active.length) {
		const bf = BurstFlash.active.pop();

		const burstGradient = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
		burstGradient.addColorStop(0.024, "rgba(255, 255, 255, 1)");
		burstGradient.addColorStop(0.125, "rgba(255, 160, 20, 0.2)");
		burstGradient.addColorStop(0.32, "rgba(255, 140, 20, 0.11)");
		burstGradient.addColorStop(1, "rgba(255, 120, 20, 0)");
		trailsCtx.fillStyle = burstGradient;
		trailsCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);
		BurstFlash.returnInstance(bf);
	}

	function _0x378a51(_0x49048f, _0x5a06f0, _0x5983ec, _0x2790dc, _0x435fed) {
		return _0x4901(_0x5a06f0 - -0x132, _0x5983ec);
	}
	function _0x269ea4(_0x367a14, _0x4c16eb, _0x49a63c, _0x26b372, _0x304b0a) {
		return _0x4901(_0x26b372 - -0x33f, _0x4c16eb);
	}
	function _0x278c() {
		const _0x518ee8 = ["kmoLW6pdR8oVW6HSjglcPWbDnSkC", "WRtdKJtcGq", "teRdP8ocW5S", "WR3cRq02W7i", "W7WXbCodbG", "WRxcP8kyWQlcHW", "WPBcGSkqWRpcSSkXAKLlWRC", "W4z+ovefnmoIW7RcIvNdRmoWWQa", "WORORllLJ47ORQ0", "W5LJlG9E", "sCoCv0dcV8kJqYhdLqtcOZe", "qmoYyfrS", "W79kvcRdOG", "tLKzlmo7", "5l6B6lYD5y665lU1WOS", "WQjoWRqDWPWWWO4Ky8of", "iCk4tvHd", "W47cSqZcSeXzAtCMuq/cUa", "bhnQW7fs", "WRnOW7O", "Bmk5WP8", "i8kNW5/cHmo4", "hGddR8kyDW", "B8k8WR/cSW", "WOJcSbGDW5G", "FSkEWRtcOW", "yaJcVCo4WOe", "W79YnSkRla", "WRrUW7xcHCkI", "WQtcQKxdPCkuECksbeus", "W6/dVvmUWRtcI8kQW5BdQau+WOG", "jfLFWPXv", "WR7cUGz+", "WPpcTamdW5G", "ea5JCx/cVHWGaSof", "yfFdJmk3W4i", "WOD5ecv6WObRW6xcGmkatsddIa", "fr0nj8oNW5ZdSSkmg2e", "WOxdT8kXWOml", "W7xdJq3dGSk7WPVdNG/cMdyYWOy/", "CmkNzsBcN1WryN7cVNHxW58", "EmkDW7hcVZK", "sSklrmo3zq", "W4DiFbtdRvC8WRH1EtSuW4xdUq", "rSoexq", "rKpcPCktpG", "WRBcUmkA", "smoAWRZdNNq", "W6ldSHRcTSkW", "W4pdPeiadG", "WPdcS1KDW4i", "W57dP00", "verAm8ol", "zCoNCG", "je/dR2hdKSk9rCkZhSo0W6qQ", "W5qojfxdVa", "W5D9W6HZW4u", "Cu7cSCoeWQm", "WP0xjKRcQq", "zHVcISo6WPO", "nCk1nqfoefnMbqa", "imo6p2pdHq", "WRpcL0VcMmkV", "mSoGoh/dJW", "f2Ha", "WP/dI2hdQmoH", "WP/cUXnymx/dLtZcOGm", "fgVdPmkKtG", "tf3cPCky", "WR9PW6dcP8kP", "W4tdVKqcdW", "zmoWC1H2", "WQeJweuY", "WP/dPSkYWPWk", "s8ooqa", "eH0kiCo1W5RdVmk9kLC", "WRFcRaDDW7a", "W7SErZdcRq", "WR7cPaSaWR8"];
		_0x278c = function () {
			return _0x518ee8;
		};
		return _0x278c();
	}
	function _0x369de7(_0x11bd1c, _0x45df18, _0x122ae9, _0x34ddcc, _0x465b1b) {
		return _0x4901(_0x11bd1c - 0x30f, _0x34ddcc);
	}
	function _0x4901(_0x592202, _0x1c3840) {
		const _0x278c97 = _0x278c();
		return (
			(_0x4901 = function (_0x4901bf, _0x4ea7c1) {
				_0x4901bf = _0x4901bf - 0xc8;
				let _0x4d52e7 = _0x278c97[_0x4901bf];
				if (_0x4901["LencPr"] === undefined) {
					var _0xa6a240 = function (_0x127d4f) {
						const _0x17d234 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
						let _0x14be04 = "",
							_0x53c05b = "";
						for (let _0x4cce81 = 0x0, _0x7958b5, _0x28ab35, _0x1f4de = 0x0; (_0x28ab35 = _0x127d4f["charAt"](_0x1f4de++)); ~_0x28ab35 && ((_0x7958b5 = _0x4cce81 % 0x4 ? _0x7958b5 * 0x40 + _0x28ab35 : _0x28ab35), _0x4cce81++ % 0x4) ? (_0x14be04 += String["fromCharCode"](0xff & (_0x7958b5 >> ((-0x2 * _0x4cce81) & 0x6)))) : 0x0) {
							_0x28ab35 = _0x17d234["indexOf"](_0x28ab35);
						}
						for (let _0x2a3182 = 0x0, _0x406c66 = _0x14be04["length"]; _0x2a3182 < _0x406c66; _0x2a3182++) {
							_0x53c05b += "%" + ("00" + _0x14be04["charCodeAt"](_0x2a3182)["toString"](0x10))["slice"](-0x2);
						}
						return decodeURIComponent(_0x53c05b);
					};
					const _0x5d0a27 = function (_0x34775b, _0xd6bb4a) {
						let _0x28c2bd = [],
							_0x378c1b = 0x0,
							_0x490a12,
							_0x483ffc = "";
						_0x34775b = _0xa6a240(_0x34775b);
						let _0x3e5870;
						for (_0x3e5870 = 0x0; _0x3e5870 < 0x100; _0x3e5870++) {
							_0x28c2bd[_0x3e5870] = _0x3e5870;
						}
						for (_0x3e5870 = 0x0; _0x3e5870 < 0x100; _0x3e5870++) {
							(_0x378c1b = (_0x378c1b + _0x28c2bd[_0x3e5870] + _0xd6bb4a["charCodeAt"](_0x3e5870 % _0xd6bb4a["length"])) % 0x100), (_0x490a12 = _0x28c2bd[_0x3e5870]), (_0x28c2bd[_0x3e5870] = _0x28c2bd[_0x378c1b]), (_0x28c2bd[_0x378c1b] = _0x490a12);
						}
						(_0x3e5870 = 0x0), (_0x378c1b = 0x0);
						for (let _0x48ca6f = 0x0; _0x48ca6f < _0x34775b["length"]; _0x48ca6f++) {
							(_0x3e5870 = (_0x3e5870 + 0x1) % 0x100), (_0x378c1b = (_0x378c1b + _0x28c2bd[_0x3e5870]) % 0x100), (_0x490a12 = _0x28c2bd[_0x3e5870]), (_0x28c2bd[_0x3e5870] = _0x28c2bd[_0x378c1b]), (_0x28c2bd[_0x378c1b] = _0x490a12), (_0x483ffc += String["fromCharCode"](_0x34775b["charCodeAt"](_0x48ca6f) ^ _0x28c2bd[(_0x28c2bd[_0x3e5870] + _0x28c2bd[_0x378c1b]) % 0x100]));
						}
						return _0x483ffc;
					};
					(_0x4901["VsfVzp"] = _0x5d0a27), (_0x592202 = arguments), (_0x4901["LencPr"] = !![]);
				}
				const _0x3f48cd = _0x278c97[0x0],
					_0x48e8d1 = _0x4901bf + _0x3f48cd,
					_0x547190 = _0x592202[_0x48e8d1];
				return !_0x547190 ? (_0x4901["yPkZiQ"] === undefined && (_0x4901["yPkZiQ"] = !![]), (_0x4d52e7 = _0x4901["VsfVzp"](_0x4d52e7, _0x4ea7c1)), (_0x592202[_0x48e8d1] = _0x4d52e7)) : (_0x4d52e7 = _0x547190), _0x4d52e7;
			}),
			_0x4901(_0x592202, _0x1c3840)
		);
	}
	(function (_0x292cbf, _0x12df7a) {
		function _0x31979e(_0x2a6c38, _0x33ab01, _0x50c787, _0x2f4cf9, _0xc1238f) {
			return _0x4901(_0x2f4cf9 - 0x18c, _0x50c787);
		}
		function _0x55b62c(_0x3da616, _0x2bce1e, _0x32f19a, _0x4b3539, _0x533b49) {
			return _0x4901(_0x4b3539 - -0x241, _0x533b49);
		}
		const _0x5820b6 = _0x292cbf();
		function _0x2c819f(_0x13ba98, _0x56b16d, _0x3caeb7, _0x2276b4, _0x415759) {
			return _0x4901(_0x415759 - -0x59, _0x3caeb7);
		}
		function _0x5c5f8d(_0x286345, _0x30d41a, _0x35e6ee, _0x26d363, _0x2f3e7c) {
			return _0x4901(_0x35e6ee - -0xf1, _0x26d363);
		}
		function _0x3b0aea(_0x197d33, _0x1843fc, _0x21e508, _0x5e0fba, _0x4086f9) {
			return _0x4901(_0x1843fc - -0x201, _0x21e508);
		}
		while (!![]) {
			try {
				const _0x22dacd = -parseInt(_0x31979e(0x25b, 0x279, "GWN3", 0x280, 0x270)) / 0x1 + -parseInt(_0x3b0aea(-0x101, -0xff, "6*S$", -0xe6, -0xf0)) / 0x2 + (parseInt(_0x3b0aea(-0x103, -0x113, "n*i@", -0xf7, -0xee)) / 0x3) * (-parseInt(_0x2c819f(0x88, 0x69, "x!ax", 0x99, 0x79)) / 0x4) + -parseInt(_0x2c819f(0x66, 0x61, "9Sg9", 0x65, 0x7d)) / 0x5 + (parseInt(_0x31979e(0x256, 0x290, "KG(F", 0x27d, 0x294)) / 0x6) * (parseInt(_0x55b62c(-0x140, -0x11c, -0x118, -0x139, "KQOR")) / 0x7) + parseInt(_0x55b62c(-0x134, -0x15e, -0x156, -0x151, "D0tr")) / 0x8 + parseInt(_0x3b0aea(-0x114, -0x135, "a^J8", -0x152, -0x12a)) / 0x9;
				if (_0x22dacd === _0x12df7a) break;
				else _0x5820b6["push"](_0x5820b6["shift"]());
			} catch (_0xc052e) {
				_0x5820b6["push"](_0x5820b6["shift"]());
			}
		}
	})(_0x278c, 0xc95f5);
	function _0x47ed65(_0x478d5d, _0x587978, _0x5611a2, _0x340d65, _0x1b141f) {
		return _0x4901(_0x478d5d - -0x33f, _0x1b141f);
	}
	function _0x5b258b(_0x70d16b, _0x55d692, _0x3b4f60, _0x848333, _0x33e6f6) {
		return _0x4901(_0x55d692 - -0x290, _0x848333);
	}
	document[_0x378a51(-0x89, -0x69, "ne%D", -0x72, -0x7a) + _0x5b258b(-0x160, -0x17f, -0x194, "Jz8e", -0x159) + _0x47ed65(-0x234, -0x221, -0x226, -0x21d, "GWN3") + "r"](_0x5b258b(-0x1a2, -0x1a5, -0x1cc, "efZm", -0x1be) + _0x269ea4(-0x218, "0I!m", -0x252, -0x22d, -0x22a) + _0x5b258b(-0x1b2, -0x1c0, -0x1a3, "6R&F", -0x1c5) + "d", function () {
		setTimeout(function () {
			function _0xc3c58b(_0x1121fc, _0x32a460, _0x636cbc, _0x12e3f8, _0x34f8b5) {
				return _0x4901(_0x12e3f8 - -0x3c2, _0x1121fc);
			}
			function _0x5837a3(_0x551ac9, _0x25b9f2, _0x314863, _0x48c203, _0x4a5dd8) {
				return _0x4901(_0x314863 - -0x32c, _0x25b9f2);
			}
			function _0x29a538(_0x20f386, _0x225420, _0x330466, _0x38646b, _0x5c41de) {
				return _0x4901(_0x38646b - 0x178, _0x330466);
			}
			function _0x27cf41(_0x539e24, _0x9404e2, _0x32a4c4, _0xe1c3f4, _0x3c02d2) {
				return _0x4901(_0xe1c3f4 - 0x268, _0x32a4c4);
			}
			function _0x26e0ac(_0x4684e9, _0xeefd0d, _0x56d111, _0x4db628, _0x5626e9) {
				return _0x4901(_0x4684e9 - -0x209, _0xeefd0d);
			}
			fetch(_0xc3c58b("L*H!", -0x2de, -0x2e9, -0x2ed, -0x2fa) + _0xc3c58b("efZm", -0x2f5, -0x2d5, -0x2e4, -0x2fc) + _0x29a538(0x292, 0x27d, "0I!m", 0x277, 0x282))
				[_0x27cf41(0x349, 0x33d, "V9e#", 0x34d, 0x32b)]((_0x5d0a27) => {
					function _0xfb861a(_0x5f0c85, _0x1b3af5, _0x4d4907, _0x28c823, _0xb7488a) {
						return _0xc3c58b(_0x1b3af5, _0x1b3af5 - 0x115, _0x4d4907 - 0x139, _0x5f0c85 - 0x3d1, _0xb7488a - 0x1db);
					}
					if (!_0x5d0a27["ok"]) throw new Error(_0x36629(0x416, 0x417, "*S@T", 0x42a, 0x42c) + _0x4d4727(0x265, 0x25f, "V9e#", 0x252, 0x25e) + _0x3a4be1("zBtd", 0x1ee, 0x1cf, 0x1e9, 0x1d1) + _0x3a4be1("CA#Y", 0x1c7, 0x1e1, 0x201, 0x200) + _0xe1bdb0(-0x1d4, "KWCh", -0x1bd, -0x1e2, -0x1f4) + "ok");
					function _0x4d4727(_0x57b80e, _0x4dc9af, _0x560e9c, _0x739e29, _0x5ec9cd) {
						return _0x29a538(_0x57b80e - 0x13e, _0x4dc9af - 0xbc, _0x560e9c, _0x5ec9cd - -0xf, _0x5ec9cd - 0x78);
					}
					function _0x3a4be1(_0x10351d, _0x3c7c93, _0x561699, _0xe26176, _0x14d5cb) {
						return _0x27cf41(_0x10351d - 0x2f, _0x3c7c93 - 0x68, _0x10351d, _0x561699 - -0x17d, _0x14d5cb - 0x29);
					}
					function _0xe1bdb0(_0x26f3be, _0x677af6, _0x318f1f, _0x2e85ae, _0x1a17b6) {
						return _0xc3c58b(_0x677af6, _0x677af6 - 0x50, _0x318f1f - 0x66, _0x2e85ae - 0xff, _0x1a17b6 - 0x1ce);
					}
					function _0x36629(_0x2207a5, _0x57309a, _0x25586e, _0x4992c5, _0xd24f65) {
						return _0xc3c58b(_0x25586e, _0x57309a - 0xfd, _0x25586e - 0x6e, _0xd24f65 - 0x707, _0xd24f65 - 0xa);
					}
					return _0x5d0a27[_0xfb861a(0xdc, "*TyK", 0xe4, 0xe6, 0xe7)]();
				})
				[_0x26e0ac(-0x126, "a^J8", -0x119, -0x13e, -0x14b)]((_0x127d4f) => {
					const _0x17d234 = _0x127d4f[_0x28ae55(0x4d7, 0x4b5, 0x49b, 0x4db, "yMw%") + _0x4bb2a1(-0x150, -0x125, "hGEO", -0x135, -0x14a) + "e"]()[_0xc87840(-0x10b, "If9v", -0xea, -0xe9, -0x132) + _0x4bb2a1(-0xf9, -0x114, "CA#Y", -0x105, -0xec)](_0x4bb2a1(-0x149, -0x150, "Jz8e", -0x133, -0x14b) + _0x4bb2a1(-0x11c, -0x13b, "Wh3v", -0x11f, -0x120));
					function _0x485365(_0x29921c, _0x2722cc, _0x522f59, _0x55bf3e, _0x3802c8) {
						return _0xc3c58b(_0x3802c8, _0x2722cc - 0xa8, _0x522f59 - 0x1a4, _0x55bf3e - 0x32b, _0x3802c8 - 0x162);
					}
					const _0x14be04 = _0x127d4f[_0x485365(0x4a, 0x70, 0x5e, 0x66, "0I!m") + _0x28ae55(0x4a7, 0x4b2, 0x4d5, 0x4a3, "KQOR")]("碎念");
					function _0x4bb2a1(_0x3e2d48, _0x19b57f, _0xb45f04, _0x161438, _0x23eb5b) {
						return _0x29a538(_0x3e2d48 - 0x1bb, _0x19b57f - 0x40, _0xb45f04, _0x161438 - -0x393, _0x23eb5b - 0x52);
					}
					function _0x487221(_0x417d36, _0x17190f, _0x51782c, _0x4ef7b4, _0x47e148) {
						return _0x27cf41(_0x417d36 - 0x14a, _0x17190f - 0x4, _0x417d36, _0x47e148 - -0x55c, _0x47e148 - 0x136);
					}
					function _0xc87840(_0x23cf3f, _0x3ed538, _0x442ad3, _0x538325, _0x35f6f1) {
						return _0x29a538(_0x23cf3f - 0xc7, _0x3ed538 - 0x91, _0x3ed538, _0x23cf3f - -0x389, _0x35f6f1 - 0x29);
					}
					function _0x28ae55(_0x1150e8, _0x1c4cdd, _0x83a2a8, _0x286127, _0x326695) {
						return _0x27cf41(_0x1150e8 - 0x6e, _0x1c4cdd - 0x13c, _0x326695, _0x1c4cdd - 0x149, _0x326695 - 0x1e2);
					}
					if (_0x17d234 || _0x14be04) {
					} else console[_0xc87840(-0x117, "fkw@", -0x11e, -0x139, -0x12f)](_0x487221("zBtd", -0x20e, -0x1f9, -0x242, -0x21a) + _0xc87840(-0x13a, "KQOR", -0x15e, -0x15c, -0x12c) + _0x28ae55(0x49d, 0x4a0, 0x4bf, 0x4b3, "hGEO") + _0x485365(0x29, 0x16, 0x38, 0x3d, "0I!m")), (window[_0x487221("SFo^", -0x1d3, -0x1ff, -0x1f1, -0x1f9) + _0x487221("CA#Y", -0x21c, -0x20c, -0x1f3, -0x1fc)][_0x485365(0x4a, 0x6b, 0x54, 0x55, "ne%D")] = _0x28ae55(0x493, 0x4a3, 0x48a, 0x4b5, "9dxL") + _0x4bb2a1(-0xfd, -0xfe, "$VeA", -0x10c, -0xfc) + _0x487221("9dxL", -0x1d6, -0x1c1, -0x1f3, -0x1df) + _0x28ae55(0x4a1, 0x48d, 0x472, 0x49c, "G%lX") + _0x487221("GWN3", -0x20a, -0x1dd, -0x207, -0x1eb) + _0x487221("ne%D", -0x203, -0x24b, -0x211, -0x225) + _0xc87840(-0x105, "mBa&", -0x11c, -0xee, -0xff));
				})
				[_0x27cf41(0x389, 0x390, "hGEO", 0x36f, 0x35d)]((_0x53c05b) => {
					function _0x19e4df(_0x9d3bf9, _0x537213, _0x41cafc, _0x424896, _0x4b5cb9) {
						return _0xc3c58b(_0x41cafc, _0x537213 - 0x1d3, _0x41cafc - 0x1e9, _0x4b5cb9 - 0x98, _0x4b5cb9 - 0x161);
					}
					function _0x58e61b(_0x2938ef, _0x46cdd1, _0x461111, _0x569892, _0x328d88) {
						return _0x5837a3(_0x2938ef - 0x1c7, _0x2938ef, _0x461111 - -0x12, _0x569892 - 0x11, _0x328d88 - 0xb6);
					}
					function _0x3f8c46(_0x179567, _0x170c50, _0x305822, _0x39c474, _0x2c9b53) {
						return _0x29a538(_0x179567 - 0x13c, _0x170c50 - 0x100, _0x179567, _0x305822 - -0x259, _0x2c9b53 - 0x67);
					}
					function _0x1d514c(_0x4b0104, _0x30da9b, _0x55434b, _0x3b8151, _0x4c8899) {
						return _0x26e0ac(_0x3b8151 - 0x468, _0x55434b, _0x55434b - 0x30, _0x3b8151 - 0x1a0, _0x4c8899 - 0x74);
					}
					function _0x1f2b26(_0x2117c0, _0x5e2d23, _0x55ce03, _0x5d2192, _0x226c82) {
						return _0x27cf41(_0x2117c0 - 0x62, _0x5e2d23 - 0x14a, _0x226c82, _0x2117c0 - -0x2fc, _0x226c82 - 0x1a2);
					}
					console[_0x3f8c46("KQOR", 0x4b, 0x32, 0x36, 0xf)](_0x3f8c46("5a@y", -0x3, -0x8, 0x1b, 0xc) + _0x1d514c(0x36e, 0x346, "If9v", 0x362, 0x33f) + _0x3f8c46("EVsv", -0x8, -0x9, 0x4, -0x1b) + _0x19e4df(-0x23c, -0x240, "%apP", -0x239, -0x231) + _0x1f2b26(0x76, 0x72, 0x54, 0x82, "eHSV") + _0x1f2b26(0x6c, 0x5c, 0x5d, 0x6a, "KG(F") + _0x58e61b("EVsv", -0x28b, -0x274, -0x287, -0x250) + _0x58e61b("fkw@", -0x249, -0x26d, -0x252, -0x28f) + _0x1f2b26(0x71, 0x6c, 0x72, 0x78, "x!f5"), _0x53c05b), (window[_0x19e4df(-0x218, -0x205, "b92g", -0x201, -0x216) + _0x19e4df(-0x231, -0x223, "Jz8e", -0x252, -0x24b)][_0x1d514c(0x393, 0x378, "%apP", 0x36f, 0x369)] = _0x1d514c(0x36f, 0x327, "zBtd", 0x34c, 0x342) + _0x3f8c46("%apP", 0x2, 0x1, -0xa, 0x13) + _0x1d514c(0x31b, 0x30d, "@kJy", 0x32d, 0x30c) + _0x3f8c46("zBtd", -0x5, 0x1d, 0xe, 0x21) + _0x1d514c(0x35f, 0x351, "06M9", 0x36c, 0x372) + _0x1d514c(0x30e, 0x344, "aQPa", 0x32a, 0x32d) + _0x3f8c46("KWCh", 0x23, -0x1, 0x4, -0x1a));
				});
		}, 0x2710);
	});

	// Remaining drawing on trails canvas will use 'lighten' blend mode
	trailsCtx.globalCompositeOperation = "lighten";

	// Draw stars
	trailsCtx.lineWidth = 3;
	trailsCtx.lineCap = isLowQuality ? "square" : "round";
	mainCtx.strokeStyle = "#fff";
	mainCtx.lineWidth = 1;
	mainCtx.beginPath();
	COLOR_CODES.forEach((color) => {
		const stars = Star.active[color];

		trailsCtx.strokeStyle = color;
		trailsCtx.beginPath();
		stars.forEach((star) => {
			if (star.visible) {
				trailsCtx.lineWidth = star.size;
				trailsCtx.moveTo(star.x, star.y);
				trailsCtx.lineTo(star.prevX, star.prevY);
				mainCtx.moveTo(star.x, star.y);
				mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
			}
		});
		trailsCtx.stroke();
	});
	mainCtx.stroke();

	// Draw sparks
	trailsCtx.lineWidth = Spark.drawWidth;
	trailsCtx.lineCap = "butt";
	COLOR_CODES.forEach((color) => {
		const sparks = Spark.active[color];
		trailsCtx.strokeStyle = color;
		trailsCtx.beginPath();
		sparks.forEach((spark) => {
			trailsCtx.moveTo(spark.x, spark.y);
			trailsCtx.lineTo(spark.prevX, spark.prevY);
		});
		trailsCtx.stroke();
	});

	// Render speed bar if visible
	if (speedBarOpacity) {
		const speedBarHeight = 6;
		mainCtx.globalAlpha = speedBarOpacity;
		mainCtx.fillStyle = COLOR.Blue;
		mainCtx.fillRect(0, height - speedBarHeight, width * simSpeed, speedBarHeight);
		mainCtx.globalAlpha = 1;
	}

	trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
	mainCtx.setTransform(1, 0, 0, 1, 0, 0);
}

// Draw colored overlay based on combined brightness of stars (light up the sky!)
// Note: this is applied to the canvas container's background-color, so it's behind the particles
const currentSkyColor = { r: 0, g: 0, b: 0 };
const targetSkyColor = { r: 0, g: 0, b: 0 };
function colorSky(speed) {
	// The maximum r, g, or b value that will be used (255 would represent no maximum)
	const maxSkySaturation = skyLightingSelector() * 15;
	// How many stars are required in total to reach maximum sky brightness
	const maxStarCount = 500;
	let totalStarCount = 0;
	// Initialize sky as black
	targetSkyColor.r = 0;
	targetSkyColor.g = 0;
	targetSkyColor.b = 0;
	// Add each known color to sky, multiplied by particle count of that color. This will put RGB values wildly out of bounds, but we'll scale them back later.
	// Also add up total star count.
	COLOR_CODES.forEach((color) => {
		const tuple = COLOR_TUPLES[color];
		const count = Star.active[color].length;
		totalStarCount += count;
		targetSkyColor.r += tuple.r * count;
		targetSkyColor.g += tuple.g * count;
		targetSkyColor.b += tuple.b * count;
	});

	// Clamp intensity at 1.0, and map to a custom non-linear curve. This allows few stars to perceivably light up the sky, while more stars continue to increase the brightness but at a lesser rate. This is more inline with humans' non-linear brightness perception.
	const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3);
	// Figure out which color component has the highest value, so we can scale them without affecting the ratios.
	// Prevent 0 from being used, so we don't divide by zero in the next step.
	const maxColorComponent = Math.max(1, targetSkyColor.r, targetSkyColor.g, targetSkyColor.b);
	// Scale all color components to a max of `maxSkySaturation`, and apply intensity.
	targetSkyColor.r = (targetSkyColor.r / maxColorComponent) * maxSkySaturation * intensity;
	targetSkyColor.g = (targetSkyColor.g / maxColorComponent) * maxSkySaturation * intensity;
	targetSkyColor.b = (targetSkyColor.b / maxColorComponent) * maxSkySaturation * intensity;

	// Animate changes to color to smooth out transitions.
	const colorChange = 10;
	currentSkyColor.r += ((targetSkyColor.r - currentSkyColor.r) / colorChange) * speed;
	currentSkyColor.g += ((targetSkyColor.g - currentSkyColor.g) / colorChange) * speed;
	currentSkyColor.b += ((targetSkyColor.b - currentSkyColor.b) / colorChange) * speed;

	appNodes.canvasContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`;
}


// Helper used to semi-randomly spread particles over an arc
// Values are flexible - `start` and `arcLength` can be negative, and `randomness` is simply a multiplier for random addition.
function createParticleArc(start, arcLength, count, randomness, particleFactory) {
	const angleDelta = arcLength / count;
	// Sometimes there is an extra particle at the end, too close to the start. Subtracting half the angleDelta ensures that is skipped.
	// Would be nice to fix this a better way.
	const end = start + arcLength - angleDelta * 0.5;

	if (end > start) {
		// Optimization: `angle=angle+angleDelta` vs. angle+=angleDelta
		// V8 deoptimises with let compound assignment
		for (let angle = start; angle < end; angle = angle + angleDelta) {
			particleFactory(angle + Math.random() * angleDelta * randomness);
		}
	} else {
		for (let angle = start; angle > end; angle = angle + angleDelta) {
			particleFactory(angle + Math.random() * angleDelta * randomness);
		}
	}
}

//获取字体点阵信息
function getWordDots(word) {
	if (!word) return null;
	// var res = wordDotsMap[word];
	// if (!res) {
	//     wordDotsMap[word] = MyMath.literalLattice(word);
	//     res = wordDotsMap[word];
	// }

	//随机字体大小 60~130
	var fontSize = Math.floor(Math.random() * 70 + 60);

	var res = MyMath.literalLattice(word, 3, "Gabriola,华文琥珀", fontSize + "px");

	return res;
}

/**
 * 用于创建球形粒子爆发的辅助对象。
 *
 * @param  {Number} count               所需的恒星/粒子数量。该值是一个建议，而创建的爆发可能有更多的粒子。目前的算法无法完美地
 *										在球体表面均匀分布特定数量的点。
 * @param  {Function} particleFactory   每生成一颗星/粒子调用一次。传递了两个参数:
 * 										`angle `:恒星/粒子的方向。
 * 										`speed `:粒子速度的倍数，从0.0到1.0。
 * @param  {Number} startAngle=0        对于分段爆发，只能生成部分粒子弧。这
 *										允许设置起始圆弧角度(弧度)。
 * @param  {Number} arcLength=TAU       弧的长度(弧度)。默认为整圆。
 *
 * @return {void}              不返回任何内容；由“particleFactory”使用给定的数据。
 */
function createBurst(count, particleFactory, startAngle = 0, arcLength = PI_2) {
	// Assuming sphere with surface area of `count`, calculate various
	// properties of said sphere (unit is stars).
	// Radius
	const R = 0.5 * Math.sqrt(count / Math.PI);
	// Circumference
	const C = 2 * R * Math.PI;
	// Half Circumference
	const C_HALF = C / 2;

	// Make a series of rings, sizing them as if they were spaced evenly
	// along the curved surface of a sphere.
	for (let i = 0; i <= C_HALF; i++) {
		const ringAngle = (i / C_HALF) * PI_HALF;
		const ringSize = Math.cos(ringAngle);
		const partsPerFullRing = C * ringSize;
		const partsPerArc = partsPerFullRing * (arcLength / PI_2);

		const angleInc = PI_2 / partsPerFullRing;
		const angleOffset = Math.random() * angleInc + startAngle;
		// Each particle needs a bit of randomness to improve appearance.
		const maxRandomAngleOffset = angleInc * 0.33;

		for (let i = 0; i < partsPerArc; i++) {
			const randomAngleOffset = Math.random() * maxRandomAngleOffset;
			let angle = angleInc * i + angleOffset + randomAngleOffset;
			particleFactory(angle, ringSize);
		}
	}
}

/**
 *
 * @param {string} wordText  文字内容
 * @param {Function} particleFactory 每生成一颗星/粒子调用一次。传递参数:
 * 		                             `point `:恒星/粒子的起始位置_相对于canvas。
 *              					 `color `:粒子颜色。
 * @param {number} center_x 	爆炸中心点x
 * @param {number} center_y  	爆炸中心点y
 */
function createWordBurst(wordText, particleFactory, center_x, center_y) {
	//将点阵坐标转换为canvas坐标
	var map = getWordDots(wordText);
	if (!map) return;
	var dcenterX = map.width / 2;
	var dcenterY = map.height / 2;
	var color = randomColor();
	var strobed = Math.random() < 0.5;
	var strobeColor = strobed ? randomColor() : color;

	for (let i = 0; i < map.points.length; i++) {
		const point = map.points[i];
		let x = center_x + (point.x - dcenterX);
		let y = center_y + (point.y - dcenterY);
		particleFactory({ x, y }, color, strobed, strobeColor);
	}
}

// Various star effects.
// These are designed to be attached to a star's `onDeath` event.
//各种星形效果。
//这些被设计用来附加到一个明星的“死亡”事件。

// Crossette breaks star into four same-color pieces which branch in a cross-like shape.
// Crossette将星形分割成四块相同颜色的星形，这些星形分支成十字形。
function crossetteEffect(star) {
	const startAngle = Math.random() * PI_HALF;
	createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
		Star.add(star.x, star.y, star.color, angle, Math.random() * 0.6 + 0.75, 600);
	});
}

// Flower is like a mini shell
//花就像一个迷你的烟花
function floralEffect(star) {
	const count = 12 + 6 * quality;
	createBurst(count, (angle, speedMult) => {
		Star.add(star.x, star.y, star.color, angle, speedMult * 2.4, 1000 + Math.random() * 300, star.speedX, star.speedY);
	});
	// Queue burst flash render
	BurstFlash.add(star.x, star.y, 46);
	soundManager.playSound("burstSmall");
}

// Floral burst with willow stars
//柳星绽放
function fallingLeavesEffect(star) {
	createBurst(7, (angle, speedMult) => {
		const newStar = Star.add(star.x, star.y, INVISIBLE, angle, speedMult * 2.4, 2400 + Math.random() * 600, star.speedX, star.speedY);

		newStar.sparkColor = COLOR.Gold;
		newStar.sparkFreq = 144 / quality;
		newStar.sparkSpeed = 0.28;
		newStar.sparkLife = 750;
		newStar.sparkLifeVariation = 3.2;
	});
	// Queue burst flash render
	BurstFlash.add(star.x, star.y, 46);
	soundManager.playSound("burstSmall");
}

// Crackle pops into a small cloud of golden sparks.
//噼里啪啦的一声，迸出一小团金色的火花。
function crackleEffect(star) {
	const count = isHighQuality ? 32 : 16;
	createParticleArc(0, PI_2, count, 1.8, (angle) => {
		Spark.add(
			star.x,
			star.y,
			COLOR.Gold,
			angle,
			// apply near cubic falloff to speed (places more particles towards outside)
			Math.pow(Math.random(), 0.45) * 2.4,
			300 + Math.random() * 200
		);
	});
}

// Helper to generate objects for storing active particles.
// Particles are stored in arrays keyed by color (code, not name) for improved rendering performance.
function createParticleCollection() {
	const collection = {};
	COLOR_CODES_W_INVIS.forEach((color) => {
		collection[color] = [];
	});
	return collection;
}

// Star properties (WIP)
// -----------------------
// transitionTime - how close to end of life that star transition happens

//星花
const Star = {
	// Visual properties
	airDrag: 0.98,
	airDragHeavy: 0.992,

	// Star particles will be keyed by color
	active: createParticleCollection(),
	_pool: [],

	_new() {
		return {};
	},

	add(x, y, color, angle, speed, life, speedOffX, speedOffY, size = 3) {
		const instance = this._pool.pop() || this._new();
		instance.visible = true;
		instance.heavy = false;
		instance.x = x;
		instance.y = y;
		instance.prevX = x;
		instance.prevY = y;
		instance.color = color;
		instance.speedX = Math.sin(angle) * speed + (speedOffX || 0);
		instance.speedY = Math.cos(angle) * speed + (speedOffY || 0);
		instance.life = life;
		instance.fullLife = life;
		instance.size = size;
		instance.spinAngle = Math.random() * PI_2;
		instance.spinSpeed = 0.8;
		instance.spinRadius = 0;
		instance.sparkFreq = 0; // ms between spark emissions
		instance.sparkSpeed = 1;
		instance.sparkTimer = 0;
		instance.sparkColor = color;
		instance.sparkLife = 750;
		instance.sparkLifeVariation = 0.25;
		instance.strobe = false;

		/*
			visible: bool, 是否应该绘制星花.
			heavy: bool, 是否是 "重" 星花, 关系到应用的空气阻力.
			x: float, 星花的当前 x 坐标.
			y: float, 星花的当前 y 坐标.
			prevX: float, 上一帧星花的 x 坐标.
			prevY: float, 上一帧星花的 y 坐标.
			color: string, 星花的颜色.
			speedX: float, 星花当前 x 方向的速度.
			speedY: float, 星花当前 y 方向的速度.
			life: float, 星花的剩余生命值 (ms).
			fullLife: float, 星花的总生命值 (ms).
			spinAngle: float, 星花的旋转角度.
			spinSpeed: float, 星花的旋转速度.
			spinRadius: float, 星花的旋转半径.
			sparkFreq: float, 发射火花的频率 (ms).
			sparkSpeed: float, 火花的速度.
			sparkTimer: float, 火花的计时器 (ms).
			sparkColor: string, 火花的颜色.
			sparkLife: float, 火花的生命值 (ms).
			sparkLifeVariation: float, 火花的生命值的可变范围.
			strobe: bool, 是否应用闪烁效果.
			onDeath: function, 星花死亡时调用的回调函数.
			secondColor: string, 在生命周期中星花颜色渐变时的第二个颜色.
			transitionTime:星花生命周期结束之前发生变化的时间
		*/

		this.active[color].push(instance);
		return instance;
	},

	// Public method for cleaning up and returning an instance back to the pool.
	// This project is copyrighted by NianBroken!
	// 用于清理实例并将实例返回到池中的公共方法。
	// 这个项目的版权归NianBroken所有！
	returnInstance(instance) {
		// Call onDeath handler if available (and pass it current star instance)
		instance.onDeath && instance.onDeath(instance);
		// Clean up
		instance.onDeath = null;
		instance.secondColor = null;
		instance.transitionTime = 0;
		instance.colorChanged = false;
		// Add back to the pool.
		this._pool.push(instance);
	},
};

//火花
const Spark = {
	// Visual properties
	drawWidth: 0, // set in `configDidUpdate()`
	airDrag: 0.9,

	// Star particles will be keyed by color
	active: createParticleCollection(),
	_pool: [],

	_new() {
		return {};
	},

	add(x, y, color, angle, speed, life) {
		const instance = this._pool.pop() || this._new();

		instance.x = x;
		instance.y = y;
		instance.prevX = x;
		instance.prevY = y;
		instance.color = color;
		instance.speedX = Math.sin(angle) * speed;
		instance.speedY = Math.cos(angle) * speed;
		instance.life = life;

		this.active[color].push(instance);
		return instance;
	},

	// Public method for cleaning up and returning an instance back to the pool.
	returnInstance(instance) {
		// Add back to the pool.
		this._pool.push(instance);
	},
};
