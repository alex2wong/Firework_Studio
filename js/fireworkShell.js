
// Shell helpers
function makePistilColor(shellColor) {
	return shellColor === COLOR.White || shellColor === COLOR.Gold ? randomColor({ notColor: shellColor }) : whiteOrGold();
}

// 唯一的 shell 类型
const crysanthemumShell = (size = 1) => {
	const glitter = Math.random() < 0.25;
	const singleColor = Math.random() < 0.72;
	const color = singleColor ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
	const pistil = singleColor && Math.random() < 0.42;
	const pistilColor = pistil && makePistilColor(color);
	const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White) ? pistilColor || randomColor({ notColor: color, limitWhite: true }) : null;
	const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
	let starDensity = glitter ? 1.1 : 1.25;
	if (isLowQuality) starDensity *= 0.8;
	if (isHighQuality) starDensity = 1.2;
	return {
		shellSize: size,
		spreadSize: 300 + size * 100,
		starLife: 900 + size * 200,
		starDensity,
		color,
		secondColor,
		glitter: glitter ? "light" : "",
		glitterColor: whiteOrGold(),
		pistil,
		pistilColor,
		streamers,
	};
};

const ghostShell = (size = 1) => {
	// Extend crysanthemum shell
	const shell = crysanthemumShell(size);
	// Ghost effect can be fast, so extend star life
	shell.starLife *= 1.5;
	// Ensure we always have a single color other than white
	let ghostColor = randomColor({ notColor: COLOR.White });
	// Always use streamers, and sometimes a pistil
	shell.streamers = true;
	const pistil = Math.random() < 0.42;
	const pistilColor = pistil && makePistilColor(ghostColor);
	// Ghost effect - transition from invisible to chosen color
	shell.color = INVISIBLE;
	shell.secondColor = ghostColor;
	// We don't want glitter to be spewed by invisible stars, and we don't currently
	// have a way to transition glitter state. So we'll disable it.
	shell.glitter = "";

	return shell;
};

const strobeShell = (size = 1) => {
	const color = randomColor({ limitWhite: true });
	return {
		shellSize: size,
		spreadSize: 280 + size * 92,
		starLife: 1100 + size * 200,
		starLifeVariation: 0.4,
		starDensity: 1.1,
		color,
		glitter: "light",
		glitterColor: COLOR.White,
		strobe: true,
		strobeColor: Math.random() < 0.5 ? COLOR.White : null,
		pistil: Math.random() < 0.5,
		pistilColor: makePistilColor(color),
	};
};

const palmShell = (size = 1) => {
	const color = randomColor();
	const thick = Math.random() < 0.5;
	return {
		shellSize: size,
		color,
		spreadSize: 250 + size * 75,
		starDensity: thick ? 0.15 : 0.4,
		starLife: 1800 + size * 200,
		glitter: thick ? "thick" : "heavy",
	};
};

const ringShell = (size = 1) => {
	const color = randomColor();
	const pistil = Math.random() < 0.75;
	return {
		shellSize: size,
		ring: true,
		color,
		spreadSize: 300 + size * 100,
		starLife: 900 + size * 200,
		starCount: 2.2 * PI_2 * (size + 1),
		pistil,
		pistilColor: makePistilColor(color),
		glitter: !pistil ? "light" : "",
		glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
		streamers: Math.random() < 0.3,
	};
	// return Object.assign({}, defaultShell, config);
};

const crossetteShell = (size = 1) => {
	const color = randomColor({ limitWhite: true });
	return {
		shellSize: size,
		spreadSize: 300 + size * 100,
		starLife: 750 + size * 160,
		starLifeVariation: 0.4,
		starDensity: 0.85,
		color,
		crossette: true,
		pistil: Math.random() < 0.5,
		pistilColor: makePistilColor(color),
	};
};

const floralShell = (size = 1) => ({
	shellSize: size,
	spreadSize: 300 + size * 120,
	starDensity: 0.12,
	starLife: 500 + size * 50,
	starLifeVariation: 0.5,
	color: Math.random() < 0.65 ? "random" : Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({ notSame: true })],
	floral: true,
});

const fallingLeavesShell = (size = 1) => ({
	shellSize: size,
	color: INVISIBLE,
	spreadSize: 300 + size * 120,
	starDensity: 0.12,
	starLife: 500 + size * 50,
	starLifeVariation: 0.5,
	glitter: "medium",
	glitterColor: COLOR.Gold,
	fallingLeaves: true,
});

const willowShell = (size = 1) => ({
	shellSize: size,
	spreadSize: 300 + size * 100,
	starDensity: 0.6,
	starLife: 3000 + size * 300,
	glitter: "willow",
	glitterColor: COLOR.Gold,
	color: INVISIBLE,
});

const crackleShell = (size = 1) => {
	// favor gold
	const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
	return {
		shellSize: size,
		spreadSize: 380 + size * 75,
		starDensity: isLowQuality ? 0.65 : 1,
		starLife: 600 + size * 100,
		starLifeVariation: 0.32,
		glitter: "light",
		glitterColor: COLOR.Gold,
		color,
		crackle: true,
		pistil: Math.random() < 0.65,
		pistilColor: makePistilColor(color),
	};
};

const horsetailShell = (size = 1) => {
	const color = randomColor();
	return {
		shellSize: size,
		horsetail: true,
		color,
		spreadSize: 250 + size * 38,
		starDensity: 0.9,
		starLife: 2500 + size * 300,
		glitter: "medium",
		glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
		// Add strobe effect to white horsetails, to make them more interesting
		strobe: color === COLOR.White,
	};
};