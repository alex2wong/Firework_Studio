/*
Copyright © 2022 NianBroken. All rights reserved.
Github：https://github.com/NianBroken/Firework_Simulator
Gitee：https://gitee.com/nianbroken/Firework_Simulator
本项目采用 Apache-2.0 许可证
简而言之，你可以自由使用、修改和分享本项目的代码，但前提是在其衍生作品中必须保留原始许可证和版权信息，并且必须以相同的许可证发布所有修改过的代码。
*/

"use strict";

//这是一个从简单项目开始的典型例子
//并且雪球远远超出了它的预期大小。有点笨重
//读取/处理这个单独的文件，但不管怎样，它还是在这里:)

const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;
// Detect high end devices. This will be a moving target.
const IS_HIGH_END_DEVICE = (() => {
	const hwConcurrency = navigator.hardwareConcurrency;
	if (!hwConcurrency) {
		return false;
	}
	//大屏幕显示的是全尺寸的计算机，现在的计算机通常都有超线程技术。
	//所以一台四核台式机有8个核心。我们将在那里设置一个更高的最小阈值。
	const minCount = window.innerWidth <= 1024 ? 4 : 8;
	return hwConcurrency >= minCount;
})();
//防止画布在荒谬的屏幕尺寸上变得过大。
// 8K -如果需要，可以对此进行限制
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9; //以像素/秒为单位的加速度
let simSpeed = 1;

function getDefaultScaleFactor() {
	if (IS_MOBILE) return 0.9;
	if (IS_HEADER) return 0.75;
	return 1;
}

//考虑比例的宽度/高度值。
//使用这些来绘制位置
let stageW, stageH;

//所有质量全局变量都将被覆盖，并通过“configDidUpdate”进行更新。
let quality = 1;
let isLowQuality = false;
let isNormalQuality = false;
let isHighQuality = true;

const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;

const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_DIM = 1;
const SKY_LIGHT_NORMAL = 2;


// Stage.disableHighDPI = true;
const trailsStage = new Stage("trails-canvas");
const mainStage = new Stage("main-canvas");
const stages = [trailsStage, mainStage];

// 修改随机文字烟花内容管理
const defaultWords = ["新年快乐", "心想事成"];
const customWords = new Set(); // 用于存储用户自定义文字
const wordDotsMap = {};

// 初始化默认文字
defaultWords.forEach((word) => {
	wordDotsMap[word] = MyMath.literalLattice(word, 3, "Gabriola,华文琥珀", "90px");
});

// 获取所有可用的文字（默认+自定义）
function getAllWords() {
	return [...defaultWords, ...customWords];
}

// 添加自定义文字
function addCustomText() {
	const input = document.getElementById('customText');
	const text = input.value.trim();
	
	// 验证输入
	if (!text) {
		alert('请输入祝福语');
		return;
	}
	if (text.length > 8) {
		alert('祝福语最多8个字');
		return;
	}
	if (defaultWords.includes(text) || customWords.has(text)) {
		alert('该祝福语已存在');
		return;
	}
	if (customWords.size >= 2) {
		alert('最多只能添加2个自定义祝福语');
		return;
	}

	// 添加新文字
	customWords.add(text);
	wordDotsMap[text] = MyMath.literalLattice(text, 3, "Gabriola,华文琥珀", "90px");
	
	// 清空输入框
	input.value = '';
	
	// 更新显示
	updateCustomTextList();
}

// 删除自定义文字
function removeCustomText(text) {
	customWords.delete(text);
	delete wordDotsMap[text];
	updateCustomTextList();
}

// 更新自定义文字列表显示
function updateCustomTextList() {
	const listElement = document.getElementById('customTextList');
	listElement.innerHTML = Array.from(customWords)
		.map(text => `<span onclick="removeCustomText('${text}')" title="点击删除">✨${text}</span>`)
		.join('');
}

// 修改原有的 randomWord 函数
function randomWord() {
	const allWords = getAllWords();
	if (allWords.length === 0) return "";
	if (allWords.length === 1) return allWords[0];
	return allWords[Math.floor(Math.random() * allWords.length)];
}

// // 自定义背景
// document.addEventListener("DOMContentLoaded", function () {
// 	// 获取目标div元素
// 	var canvasContainer = document.querySelector(".canvas-container");
// 	// 设置背景图像和背景大小
// 	// 在这里输入图片路径
// 	canvasContainer.style.backgroundImage = "url()";
// 	canvasContainer.style.backgroundSize = "100%";
// });

//全屏帮助程序，使用Fscreen作为前缀。
function fullscreenEnabled() {
	return fscreen.fullscreenEnabled;
}

//请注意，全屏状态与存储同步，存储应该是源
//判断应用程序是否处于全屏模式。
function isFullscreen() {
	return !!fscreen.fullscreenElement;
}

// 尝试切换全屏模式。
function toggleFullscreen() {
	if (fullscreenEnabled()) {
		if (isFullscreen()) {
			fscreen.exitFullscreen();
		} else {
			fscreen.requestFullscreen(document.documentElement);
		}
	}
}

// 将全屏更改与存储同步。事件侦听器是必需的，因为用户可以
// 直接通过浏览器切换全屏模式，我们希望对此做出反应。
// 这个项目的版权归NianBroken所有！
fscreen.addEventListener("fullscreenchange", () => {
	store.setState({ fullscreen: isFullscreen() });
});

// 简单的状态容器
const store = {
	_listeners: new Set(),
	_dispatch(prevState) {
		this._listeners.forEach((listener) => listener(this.state, prevState));
	},

	//当前上下文状态
	state: {
		// 将在init()中取消挂起
		paused: true,
		soundEnabled: true,
		menuOpen: false,
		openHelpTopic: null,
		fullscreen: isFullscreen(),
		//请注意，用于<select>的配置值必须是字符串，除非手动将值转换为字符串
		//在呈现时，并在更改时解析。
		config: {
			quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL), // will be mirrored to a global variable named `quality` in `configDidUpdate`, for perf.
			shell: "Random",
			size: IS_DESKTOP
				? "3" // Desktop default
				: IS_HEADER
				? "1.2" //配置文件头默认值(不必是int)
				: "2", //手机默认
			wordShell: true, //文字烟花 默认为开启 若不开启可修改为false
			autoLaunch: true, //自动发射烟花
			finale: true, //同时放更多烟花
			skyLighting: SKY_LIGHT_NORMAL + "",
			hideControls: IS_HEADER,
			longExposure: false,
			scaleFactor: getDefaultScaleFactor(),
		},
	},

	setState(nextState) {
		const prevState = this.state;
		this.state = Object.assign({}, this.state, nextState);
		this._dispatch(prevState);
		this.persist();
	},

	subscribe(listener) {
		this._listeners.add(listener);
		return () => this._listeners.remove(listener);
	},

	// Load / persist select state to localStorage
	// Mutates state because `store.load()` should only be called once immediately after store is created, before any subscriptions.
	load() {
		const serializedData = localStorage.getItem("cm_fireworks_data");
		if (serializedData) {
			const { schemaVersion, data } = JSON.parse(serializedData);

			const config = this.state.config;
			switch (schemaVersion) {
				case "1.1":
					config.quality = data.quality;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					break;
				case "1.2":
					config.quality = data.quality;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					config.scaleFactor = data.scaleFactor;
					break;
				default:
					throw new Error("version switch should be exhaustive");
			}
			console.log(`Loaded config (schema version ${schemaVersion})`);
		}
		// Deprecated data format. Checked with care (it's not namespaced).
		else if (localStorage.getItem("schemaVersion") === "1") {
			let size;
			// Attempt to parse data, ignoring if there is an error.
			try {
				const sizeRaw = localStorage.getItem("configSize");
				size = typeof sizeRaw === "string" && JSON.parse(sizeRaw);
			} catch (e) {
				console.log("Recovered from error parsing saved config:");
				console.error(e);
				return;
			}
			// Only restore validated values
			const sizeInt = parseInt(size, 10);
			if (sizeInt >= 0 && sizeInt <= 4) {
				this.state.config.size = String(sizeInt);
			}
		}
	},

	persist() {
		const config = this.state.config;
		localStorage.setItem(
			"cm_fireworks_data",
			JSON.stringify({
				schemaVersion: "1.2",
				data: {
					quality: config.quality,
					size: config.size,
					skyLighting: config.skyLighting,
					scaleFactor: config.scaleFactor,
				},
			})
		);
	},
};

if (!IS_HEADER) {
	store.load();
}

// Actions
// ---------

function togglePause(toggle) {
	const paused = store.state.paused;
	let newValue;
	if (typeof toggle === "boolean") {
		newValue = toggle;
	} else {
		newValue = !paused;
	}

	if (paused !== newValue) {
		store.setState({ paused: newValue });
	}
}

function toggleSound(toggle) {
	if (typeof toggle === "boolean") {
		store.setState({ soundEnabled: toggle });
	} else {
		const soundEnabled = store.state.soundEnabled;
		if (soundEnabled) {
			console.log('# 音乐暂停')
			soundManager.pauseMusic();
		} else {
			console.log('# 音乐播放')
			soundManager.playMusic();
		}
		store.setState({ soundEnabled:!soundEnabled  });
	}
}

function toggleMenu(toggle) {
	if (typeof toggle === "boolean") {
		store.setState({ menuOpen: toggle });
	} else {
		store.setState({ menuOpen: !store.state.menuOpen });
	}
}

function updateConfig(nextConfig) {
	nextConfig = nextConfig || getConfigFromDOM();
	store.setState({
		config: Object.assign({}, store.state.config, nextConfig),
	});

	configDidUpdate();
}

// Map config to various properties & apply side effects
function configDidUpdate() {
	const config = store.state.config;

	quality = qualitySelector();
	isLowQuality = quality === QUALITY_LOW;
	isNormalQuality = quality === QUALITY_NORMAL;
	isHighQuality = quality === QUALITY_HIGH;

	if (skyLightingSelector() === SKY_LIGHT_NONE) {
		appNodes.canvasContainer.style.backgroundColor = "#000";
	}

	Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}

// Selectors
// -----------

const isRunning = (state = store.state) => !state.paused && !state.menuOpen;
// Whether user has enabled sound.
const soundEnabledSelector = (state = store.state) => state.soundEnabled;
// Whether any sounds are allowed, taking into account multiple factors.
const canPlaySoundSelector = (state = store.state) => isRunning(state) && soundEnabledSelector(state);
// Convert quality to number.
const qualitySelector = () => +store.state.config.quality;
const shellNameSelector = () => store.state.config.shell;
// Convert shell size to number.
const shellSizeSelector = () => +store.state.config.size;
const finaleSelector = () => store.state.config.finale;
const skyLightingSelector = () => +store.state.config.skyLighting;
const scaleFactorSelector = () => store.state.config.scaleFactor;

// Help Content
const helpContent = {
	shellType: {
		header: "烟花类型",
		body: "你要放的烟花的类型，选择“随机（Random）”可以获得非常好的体验！",
	},
	shellSize: {
		header: "烟花大小",
		body: "烟花越大绽放范围就越大，但是烟花越大，设备所需的性能也会增多，大的烟花可能导致你的设备卡顿。",
	},
	quality: {
		header: "画质",
		body: "如果动画运行不流畅，你可以试试降低画质。画质越高，烟花绽放后的火花数量就越多，但高画质可能导致你的设备卡顿。",
	},
	skyLighting: {
		header: "照亮天空",
		body: "烟花爆炸时，背景会被照亮。如果你的屏幕看起来太亮了，可以把它改成“暗”或者“不”。",
	},
	scaleFactor: {
		header: "缩放",
		body: "使你与烟花离得更近或更远。对于较大的烟花，你可以选择更小的缩放值，尤其是在手机或平板电脑上。",
	},
	wordShell: {
		header: "文字烟花",
		body: "开启后，会出现烟花形状的文字。例如：新年快乐、心想事成等等",
	},
	autoLaunch: {
		header: "自动放烟花",
		body: "开启后你就可以坐在你的设备屏幕前面欣赏烟花了，你也可以关闭它，但关闭后你就只能通过点击屏幕的方式来放烟花。",
	},
	finaleMode: {
		header: "同时放更多的烟花",
		body: "可以在同一时间自动放出更多的烟花（但需要开启先开启“自动放烟花”）。",
	},
	hideControls: {
		header: "隐藏控制按钮",
		body: "隐藏屏幕顶部的按钮。如果你要截图，或者需要一个无缝的体验，你就可以将按钮隐藏，隐藏按钮后你仍然可以在右上角打开设置。",
	},
	fullscreen: {
		header: "全屏",
		body: "切换至全屏模式",
	},
	longExposure: {
		header: "保留烟花的火花",
		body: "可以保留烟花留下的火花",
	},
};

const nodeKeyToHelpKey = {
	shellTypeLabel: "shellType",
	shellSizeLabel: "shellSize",
	qualityLabel: "quality",
	skyLightingLabel: "skyLighting",
	scaleFactorLabel: "scaleFactor",
	wordShellLabel: "wordShell",
	autoLaunchLabel: "autoLaunch",
	finaleModeLabel: "finaleMode",
	hideControlsLabel: "hideControls",
	fullscreenLabel: "fullscreen",
	longExposureLabel: "longExposure",
};

// 程序dom节点列表
const appNodes = {
	stageContainer: ".stage-container",
	canvasContainer: ".canvas-container",
	controls: ".controls",
	inputs: ".inputs",
	menu: ".menu",
	menuInnerWrap: ".menu__inner-wrap",
	pauseBtn: ".pause-btn",
	pauseBtnSVG: ".pause-btn use",
	soundBtn: ".sound-btn",
	soundBtnSVG: ".sound-btn use",
	shellType: ".shell-type",
	shellTypeLabel: ".shell-type-label",
	shellSize: ".shell-size", //烟花大小
	shellSizeLabel: ".shell-size-label",
	quality: ".quality-ui",
	qualityLabel: ".quality-ui-label",
	skyLighting: ".sky-lighting",
	skyLightingLabel: ".sky-lighting-label",
	scaleFactor: ".scaleFactor",
	scaleFactorLabel: ".scaleFactor-label",
	wordShell: ".word-shell", // 文字烟花
	wordShellLabel: ".word-shell-label",
	autoLaunch: ".auto-launch", //自动烟花开关
	autoLaunchLabel: ".auto-launch-label",
	finaleModeFormOption: ".form-option--finale-mode",
	finaleMode: ".finale-mode",
	finaleModeLabel: ".finale-mode-label",
	hideControls: ".hide-controls",
	hideControlsLabel: ".hide-controls-label",
	fullscreenFormOption: ".form-option--fullscreen",
	fullscreen: ".fullscreen",
	fullscreenLabel: ".fullscreen-label",
	longExposure: ".long-exposure",
	longExposureLabel: ".long-exposure-label",

	// Help UI
	helpModal: ".help-modal",
	helpModalOverlay: ".help-modal__overlay",
	helpModalHeader: ".help-modal__header",
	helpModalBody: ".help-modal__body",
	helpModalCloseBtn: ".help-modal__close-btn",
};

// Convert appNodes selectors to dom nodes
Object.keys(appNodes).forEach((key) => {
	appNodes[key] = document.querySelector(appNodes[key]);
});

// Remove fullscreen control if not supported.
if (!fullscreenEnabled()) {
	appNodes.fullscreenFormOption.classList.add("remove");
}

//第一次渲染是在状态机 init()中调用的
function renderApp(state) {
	const pauseBtnIcon = `#icon-${state.paused ? "play" : "pause"}`;
	const soundBtnIcon = `#icon-sound-${soundEnabledSelector() ? "on" : "off"}`;
	appNodes.pauseBtnSVG.setAttribute("href", pauseBtnIcon);
	appNodes.pauseBtnSVG.setAttribute("xlink:href", pauseBtnIcon);
	appNodes.soundBtnSVG.setAttribute("href", soundBtnIcon);
	appNodes.soundBtnSVG.setAttribute("xlink:href", soundBtnIcon);
	appNodes.controls.classList.toggle("hide", state.menuOpen || state.config.hideControls);
	appNodes.inputs.classList.toggle("hide", state.menuOpen || state.config.hideControls);
	appNodes.canvasContainer.classList.toggle("blur", state.menuOpen);
	appNodes.menu.classList.toggle("hide", !state.menuOpen);
	appNodes.finaleModeFormOption.style.opacity = state.config.autoLaunch ? 1 : 0.32;

	appNodes.quality.value = state.config.quality;
	appNodes.shellType.value = state.config.shell;
	appNodes.shellSize.value = state.config.size;
	appNodes.wordShell.checked = state.config.wordShell;
	appNodes.autoLaunch.checked = state.config.autoLaunch;
	appNodes.finaleMode.checked = state.config.finale;
	appNodes.skyLighting.value = state.config.skyLighting;
	appNodes.hideControls.checked = state.config.hideControls;
	appNodes.fullscreen.checked = state.fullscreen;
	appNodes.longExposure.checked = state.config.longExposure;
	appNodes.scaleFactor.value = state.config.scaleFactor.toFixed(2);

	appNodes.menuInnerWrap.style.opacity = state.openHelpTopic ? 0.12 : 1;
	appNodes.helpModal.classList.toggle("active", !!state.openHelpTopic);
	if (state.openHelpTopic) {
		const { header, body } = helpContent[state.openHelpTopic];
		appNodes.helpModalHeader.textContent = header;
		appNodes.helpModalBody.textContent = body;
	}
}

store.subscribe(renderApp);

// Perform side effects on state changes
function handleStateChange(state, prevState) {
	const canPlaySound = canPlaySoundSelector(state);
	const canPlaySoundPrev = canPlaySoundSelector(prevState);

	if (canPlaySound !== canPlaySoundPrev) {
		if (canPlaySound) {
			soundManager.resumeAll();
		} else {
			soundManager.pauseAll();
		}
	}
}

store.subscribe(handleStateChange);

//根据dom状态获取配置
function getConfigFromDOM() {
	return {
		quality: appNodes.quality.value,
		shell: appNodes.shellType.value,
		size: appNodes.shellSize.value,
		wordShell: appNodes.wordShell.checked,
		autoLaunch: appNodes.autoLaunch.checked,
		finale: appNodes.finaleMode.checked,
		skyLighting: appNodes.skyLighting.value,
		longExposure: appNodes.longExposure.checked,
		hideControls: appNodes.hideControls.checked,
		// Store value as number.
		scaleFactor: parseFloat(appNodes.scaleFactor.value),
	};
}

const updateConfigNoEvent = () => updateConfig();
appNodes.quality.addEventListener("input", updateConfigNoEvent);
appNodes.shellType.addEventListener("input", updateConfigNoEvent);
appNodes.shellSize.addEventListener("input", updateConfigNoEvent);
appNodes.wordShell.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.autoLaunch.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.finaleMode.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.skyLighting.addEventListener("input", updateConfigNoEvent);
appNodes.longExposure.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.hideControls.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.fullscreen.addEventListener("click", () => setTimeout(toggleFullscreen, 0));
// Changing scaleFactor requires triggering resize handling code as well.
appNodes.scaleFactor.addEventListener("input", () => {
	updateConfig();
	handleResize();
});

Object.keys(nodeKeyToHelpKey).forEach((nodeKey) => {
	const helpKey = nodeKeyToHelpKey[nodeKey];
	appNodes[nodeKey].addEventListener("click", () => {
		store.setState({ openHelpTopic: helpKey });
	});
});

appNodes.helpModalCloseBtn.addEventListener("click", () => {
	store.setState({ openHelpTopic: null });
});

appNodes.helpModalOverlay.addEventListener("click", () => {
	store.setState({ openHelpTopic: null });
});

function randomShellName() {
	return Math.random() < 0.5 ? "Crysanthemum" : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

function randomShell(size) {
	// Special selection for codepen header.
	if (IS_HEADER) return randomFastShell()(size);
	// Normal operation
	return shellTypes[randomShellName()](size);
}

function shellFromConfig(size) {
	return shellTypes[shellNameSelector()](size);
}

//获取随机外壳，不包括处理密集型变体
//注意，只有在配置中选择了“随机”shell时，这才是随机的。
//还有，这不创建烟花，只返回工厂函数。
const fastShellBlacklist = ["Falling Leaves", "Floral", "Willow"];
function randomFastShell() {
	const isRandom = shellNameSelector() === "Random";
	let shellName = isRandom ? randomShellName() : shellNameSelector();
	if (isRandom) {
		while (fastShellBlacklist.includes(shellName)) {
			shellName = randomShellName();
		}
	}
	return shellTypes[shellName];
}

//烟花类型
const shellTypes = {
	Random: randomShell,// 随机烟花 - 随机从以下类型中选择一种
    Crackle: crackleShell,      // 爆裂烟花 - 带有噼啪声和金色火花的烟花
    Crossette: crossetteShell,  // 交叉烟花 - 烟花在空中交叉形成十字形
    Crysanthemum: crysanthemumShell, // 菊花烟花 - 像菊花一样绽放的圆形烟花
    "Falling Leaves": fallingLeavesShell, // 落叶烟花 - 像落叶一样缓慢飘落的金色火花
    Floral: floralShell,        // 花型烟花 - 形成花朵形状的烟花
    Ghost: ghostShell,          // 幽灵烟花 - 带有渐变效果的半透明烟花
    "Horse Tail": horsetailShell, // 马尾烟花 - 像马尾一样的长拖尾效果
    Palm: palmShell,            // 棕榈烟花 - 像棕榈树展开的形状
    Ring: ringShell,            // 环形烟花 - 形成圆环形状的烟花
    Strobe: strobeShell,        // 频闪烟花 - 带有闪烁效果的烟花
    Willow: willowShell,        // 柳树烟花 - 像柳树枝条下垂的形状
};

const shellNames = Object.keys(shellTypes);

function init() {
	// Remove loading state
	document.querySelector(".loading-init").remove();
	appNodes.stageContainer.classList.remove("remove");

	// Populate dropdowns
	function setOptionsForSelect(node, options) {
		node.innerHTML = options.reduce((acc, opt) => (acc += `<option value="${opt.value}">${opt.label}</option>`), "");
	}

	// shell type
	let options = "";
	shellNames.forEach((opt) => (options += `<option value="${opt}">${opt}</option>`));
	appNodes.shellType.innerHTML = options;
	// shell size
	options = "";
	['3"', '4"', '6"', '8"', '12"', '16"'].forEach((opt, i) => (options += `<option value="${i}">${opt}</option>`));
	appNodes.shellSize.innerHTML = options;

	setOptionsForSelect(appNodes.quality, [
		{ label: "低", value: QUALITY_LOW },
		{ label: "正常", value: QUALITY_NORMAL },
		{ label: "高", value: QUALITY_HIGH },
	]);

	setOptionsForSelect(appNodes.skyLighting, [
		{ label: "不", value: SKY_LIGHT_NONE },
		{ label: "暗", value: SKY_LIGHT_DIM },
		{ label: "正常", value: SKY_LIGHT_NORMAL },
	]);

	// 0.9 is mobile default
	setOptionsForSelect(
		appNodes.scaleFactor,
		[0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0].map((value) => ({ value: value.toFixed(2), label: `${value * 100}%` }))
	);

	// Begin simulation
	togglePause(false);

	// initial render
	renderApp(store.state);

	// Apply initial config
	configDidUpdate();
}

function fitShellPositionInBoundsH(position) {
	const edge = 0.18;
	return (1 - edge * 2) * position + edge;
}

function fitShellPositionInBoundsV(position) {
	return position * 0.75;
}

function getRandomShellPositionH() {
	return fitShellPositionInBoundsH(Math.random());
}

function getRandomShellPositionV() {
	return fitShellPositionInBoundsV(Math.random());
}

// 获取随机的烟花尺寸
function getRandomShellSize() {
	const baseSize = shellSizeSelector();
	const maxVariance = Math.min(2.5, baseSize);
	const variance = Math.random() * maxVariance;
	const size = baseSize - variance;
	const height = maxVariance === 0 ? Math.random() : 1 - variance / maxVariance;
	const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
	const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
	return {
		size,
		x: fitShellPositionInBoundsH(x),
		height: fitShellPositionInBoundsV(height),
	};
}

// Launches a shell from a user pointer event, based on state.config
function launchShellFromConfig(event) {
	const shell = new Shell(shellFromConfig(shellSizeSelector()));
	const w = mainStage.width;
	const h = mainStage.height;

	shell.launch(event ? event.x / w : getRandomShellPositionH(), event ? 1 - event.y / h : getRandomShellPositionV());
}

// Sequences
// -----------

//随机生成一个烟花
function seqRandomShell() {
	const size = getRandomShellSize();
	const shell = new Shell(shellFromConfig(size.size));
	shell.launch(size.x, size.height);

	let extraDelay = shell.starLife;
	if (shell.fallingLeaves) {
		extraDelay = 4600;
	}

	return 900 + Math.random() * 600 + extraDelay;
}

function seqRandomFastShell() {
	const shellType = randomFastShell();
	const size = getRandomShellSize();
	const shell = new Shell(shellType(size.size));
	shell.launch(size.x, size.height);

	let extraDelay = shell.starLife;

	return 900 + Math.random() * 600 + extraDelay;
}

function seqTwoRandom() {
	const size1 = getRandomShellSize();
	const size2 = getRandomShellSize();
	const shell1 = new Shell(shellFromConfig(size1.size));
	const shell2 = new Shell(shellFromConfig(size2.size));
	const leftOffset = Math.random() * 0.2 - 0.1;
	const rightOffset = Math.random() * 0.2 - 0.1;
	shell1.launch(0.3 + leftOffset, size1.height);
	setTimeout(() => {
		shell2.launch(0.7 + rightOffset, size2.height);
	}, 100);

	let extraDelay = Math.max(shell1.starLife, shell2.starLife);
	if (shell1.fallingLeaves || shell2.fallingLeaves) {
		extraDelay = 4600;
	}

	return 900 + Math.random() * 600 + extraDelay;
}

function seqTriple() {
	const shellType = randomFastShell();
	const baseSize = shellSizeSelector();
	const smallSize = Math.max(0, baseSize - 1.25);

	const offset = Math.random() * 0.08 - 0.04;
	const shell1 = new Shell(shellType(baseSize));
	shell1.launch(0.5 + offset, 0.7);

	const leftDelay = 1000 + Math.random() * 400;
	const rightDelay = 1000 + Math.random() * 400;

	setTimeout(() => {
		const offset = Math.random() * 0.08 - 0.04;
		const shell2 = new Shell(shellType(smallSize));
		shell2.launch(0.2 + offset, 0.1);
	}, leftDelay);

	setTimeout(() => {
		const offset = Math.random() * 0.08 - 0.04;
		const shell3 = new Shell(shellType(smallSize));
		shell3.launch(0.8 + offset, 0.1);
	}, rightDelay);

	return 4000;
}

function seqPyramid() {
	const barrageCountHalf = IS_DESKTOP ? 7 : 4;
	const largeSize = shellSizeSelector();
	const smallSize = Math.max(0, largeSize - 3);
	const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
	const randomSpecialShell = randomShell;

	function launchShell(x, useSpecial) {
		const isRandom = shellNameSelector() === "Random";
		let shellType = isRandom ? (useSpecial ? randomSpecialShell : randomMainShell) : shellTypes[shellNameSelector()];
		const shell = new Shell(shellType(useSpecial ? largeSize : smallSize));
		const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
		shell.launch(x, useSpecial ? 0.75 : height * 0.42);
	}

	let count = 0;
	let delay = 0;
	while (count <= barrageCountHalf) {
		if (count === barrageCountHalf) {
			setTimeout(() => {
				launchShell(0.5, true);
			}, delay);
		} else {
			const offset = (count / barrageCountHalf) * 0.5;
			const delayOffset = Math.random() * 30 + 30;
			setTimeout(() => {
				launchShell(offset, false);
			}, delay);
			setTimeout(() => {
				launchShell(1 - offset, false);
			}, delay + delayOffset);
		}

		count++;
		delay += 200;
	}

	return 3400 + barrageCountHalf * 250;
}

function seqSmallBarrage() {
	seqSmallBarrage.lastCalled = Date.now();
	const barrageCount = IS_DESKTOP ? 11 : 5;
	const specialIndex = IS_DESKTOP ? 3 : 1;
	const shellSize = Math.max(0, shellSizeSelector() - 2);
	const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
	const randomSpecialShell = randomFastShell();

	// (cos(x*5π+0.5π)+1)/2 is a custom wave bounded by 0 and 1 used to set varying launch heights
	function launchShell(x, useSpecial) {
		const isRandom = shellNameSelector() === "Random";
		let shellType = isRandom ? (useSpecial ? randomSpecialShell : randomMainShell) : shellTypes[shellNameSelector()];
		const shell = new Shell(shellType(shellSize));
		const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
		shell.launch(x, height * 0.75);
	}

	let count = 0;
	let delay = 0;
	while (count < barrageCount) {
		if (count === 0) {
			launchShell(0.5, false);
			count += 1;
		} else {
			const offset = (count + 1) / barrageCount / 2;
			const delayOffset = Math.random() * 30 + 30;
			const useSpecial = count === specialIndex;
			setTimeout(() => {
				launchShell(0.5 + offset, useSpecial);
			}, delay);
			setTimeout(() => {
				launchShell(0.5 - offset, useSpecial);
			}, delay + delayOffset);
			count += 2;
		}
		delay += 200;
	}

	return 3400 + barrageCount * 120;
}
seqSmallBarrage.cooldown = 15000;
seqSmallBarrage.lastCalled = Date.now();

const sequences = [seqRandomShell, seqTwoRandom, seqTriple, seqPyramid, seqSmallBarrage];

let isFirstSeq = true;
const finaleCount = 32;
let currentFinaleCount = 0;
//随机生成一个烟花序列
function startSequence() {
	if (isFirstSeq) {
		isFirstSeq = false;
		if (IS_HEADER) {
			return seqTwoRandom();
		} else {
			const shell = new Shell(crysanthemumShell(shellSizeSelector()));
			shell.launch(0.5, 0.5);
			return 2400;
		}
	}

	if (finaleSelector()) {
		seqRandomFastShell();
		if (currentFinaleCount < finaleCount) {
			currentFinaleCount++;
			return 170;
		} else {
			currentFinaleCount = 0;
			return 6000;
		}
	}

	const rand = Math.random();

	if (rand < 0.08 && Date.now() - seqSmallBarrage.lastCalled > seqSmallBarrage.cooldown) {
		return seqSmallBarrage();
	}

	if (rand < 0.1) {
		return seqPyramid();
	}

	if (rand < 0.6 && !IS_HEADER) {
		return seqRandomShell();
	} else if (rand < 0.8) {
		return seqTwoRandom();
	} else if (rand < 1) {
		return seqTriple();
	}
}

let activePointerCount = 0;
let isUpdatingSpeed = false;

function handlePointerStart(event) {
	activePointerCount++;
	const btnSize = 50;

	if (event.y < btnSize) {
		if (event.x < btnSize) {
			togglePause();
			return;
		}
		if (event.x > mainStage.width / 2 - btnSize / 2 && event.x < mainStage.width / 2 + btnSize / 2) {
			toggleSound();
			return;
		}
		if (event.x > mainStage.width - btnSize) {
			toggleMenu();
			return;
		}
	}

	if (!isRunning()) return;

	if (updateSpeedFromEvent(event)) {
		isUpdatingSpeed = true;
	} else if (event.onCanvas) {
		launchShellFromConfig(event);
	}
}

function handlePointerEnd(event) {
	activePointerCount--;
	isUpdatingSpeed = false;
}

function handlePointerMove(event) {
	if (!isRunning()) return;

	if (isUpdatingSpeed) {
		updateSpeedFromEvent(event);
	}
}

function handleKeydown(event) {
	// P
	if (event.keyCode === 80) {
		togglePause();
	}
	// O
	else if (event.keyCode === 79) {
		toggleMenu();
	}
	// Esc
	else if (event.keyCode === 27) {
		toggleMenu(false);
	}
}

mainStage.addEventListener("pointerstart", handlePointerStart);
mainStage.addEventListener("pointerend", handlePointerEnd);
mainStage.addEventListener("pointermove", handlePointerMove);
window.addEventListener("keydown", handleKeydown);

// Account for window resize and custom scale changes.
function handleResize() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	// Try to adopt screen size, heeding maximum sizes specified
	const containerW = Math.min(w, MAX_WIDTH);
	// On small screens, use full device height
	const containerH = w <= 420 ? h : Math.min(h, MAX_HEIGHT);
	appNodes.stageContainer.style.width = containerW + "px";
	appNodes.stageContainer.style.height = containerH + "px";
	stages.forEach((stage) => stage.resize(containerW, containerH));
	// Account for scale
	const scaleFactor = scaleFactorSelector();
	stageW = containerW / scaleFactor;
	stageH = containerH / scaleFactor;
}

// Compute initial dimensions
handleResize();

window.addEventListener("resize", handleResize);

mainStage.addEventListener("ticker", update);


/// backgroundImage controller

// 添加背景图片处理函数
function handleBackgroundUpload() {
    const fileInput = document.getElementById('bgUpload');
    const resetBtn = document.getElementById('resetBgBtn');
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                // 创建图片对象来获取尺寸
                const img = new Image();
                img.onload = function() {
                    // 创建 canvas 来处理图片透明度
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    
                    // 设置透明度
                    ctx.globalAlpha = 0.3; // 设置70%透明度
                    ctx.drawImage(img, 0, 0);
                    
                    // 将处理后的图片设置为背景
                    const canvasContainer = document.querySelector('.canvas-container');
                    canvasContainer.style.backgroundImage = `url(${canvas.toDataURL()})`;
                    canvasContainer.style.backgroundSize = 'cover';
                    canvasContainer.style.backgroundPosition = 'center';
                    
                    // 显示重置按钮
                    resetBtn.style.display = 'inline-block';
                    
                    // 清空 input 以允许重复选择同一文件
                    fileInput.value = '';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
}

// 重置背景函数
function resetBackground() {
    const canvasContainer = document.querySelector('.canvas-container');
    canvasContainer.style.backgroundImage = `none`;
    document.getElementById('resetBgBtn').style.display = 'none';
}

function loadDefaultBg() {
    const canvasContainer = document.querySelector('.canvas-container');
	canvasContainer.style.backgroundImage = `url('./images/cover.webp')`;
	canvasContainer.style.backgroundSize = 'cover';
	canvasContainer.style.backgroundPosition = 'center';
	const resetBtn = document.getElementById('resetBgBtn');
	
	// 显示重置按钮
	resetBtn.style.display = 'inline-block';
}

// 在页面加载完成后初始化上传功能
window.addEventListener('load', function() {
	// loadDefaultBg();
    handleBackgroundUpload();
});


// imageTemplateManager.preload().then(() => {
//     if(imageTemplateManager.sources.length>0){
//         var img = imageTemplateManager.sources[0];
//     }
// });

// Kick things off.

function setLoadingStatus(status) {
	document.querySelector(".loading-init__status").textContent = status;
}

// CodePen profile header doesn't need audio, just initialize.
if (IS_HEADER) {
	init();
} else {
	// Allow status to render, then preload assets and start app.
	setLoadingStatus("正在点燃导火线");
	setTimeout(() => {
		// 只加载 soundManager
		var promises = [soundManager.preload()];

		// 在 soundManager 加载完毕后调用 init
		Promise.all(promises).then(init, (reason) => {
			console.log("资源文件加载失败");
			init();
			return Promise.reject(reason);
		});
	}, 0);
}
