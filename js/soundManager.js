
//音效管理器
const soundManager = {
	baseURL: "./audio/",
	ctx: new (window.AudioContext || window.webkitAudioContext)(),
	sources: {
		lift: {
			volume: 1,
			playbackRateMin: 0.85,
			playbackRateMax: 0.95,
			fileNames: ["lift1.mp3", "lift2.mp3", "lift3.mp3"],
		},
		burst: {
			volume: 1,
			playbackRateMin: 0.8,
			playbackRateMax: 0.9,
			fileNames: ["burst1.mp3", "burst2.mp3"],
		},
		burstSmall: {
			volume: 0.25,
			playbackRateMin: 0.8,
			playbackRateMax: 1,
			fileNames: ["burst-sm-1.mp3", "burst-sm-2.mp3"],
		},
		crackle: {
			volume: 0.2,
			playbackRateMin: 1,
			playbackRateMax: 1,
			fileNames: ["crackle1.mp3"],
		},
		crackleSmall: {
			volume: 0.3,
			playbackRateMin: 1,
			playbackRateMax: 1,
			fileNames: ["crackle-sm-1.mp3"],
		},
	},

	preload() {
		const allFilePromises = [];

		function checkStatus(response) {
			if (response.status >= 200 && response.status < 300) {
				return response;
			}
			const customError = new Error(response.statusText);
			customError.response = response;
			throw customError;
		}

		const types = Object.keys(this.sources);
		types.forEach((type) => {
			const source = this.sources[type];
			const { fileNames } = source;
			const filePromises = [];
			fileNames.forEach((fileName) => {
				const fileURL = this.baseURL + fileName;
				// Promise will resolve with decoded audio buffer.
				const promise = fetch(fileURL)
					.then(checkStatus)
					.then((response) => response.arrayBuffer())
					.then(
						(data) =>
							new Promise((resolve) => {
								this.ctx.decodeAudioData(data, resolve);
							})
					);

				filePromises.push(promise);
				allFilePromises.push(promise);
			});

			Promise.all(filePromises).then((buffers) => {
				source.buffers = buffers;
			});
		});

		this.preloadMusic();
		return Promise.all(allFilePromises);
	},

	pauseAll() {
		this.ctx.suspend();
	},

	resumeAll() {
		// Play a sound with no volume for iOS. This 'unlocks' the audio context when the user first enables sound.
		this.playSound("lift", 0);
		// Chrome mobile requires interaction before starting audio context.
		// The sound toggle button is triggered on 'touchstart', which doesn't seem to count as a full
		// interaction to Chrome. I guess it needs a click? At any rate if the first thing the user does
		// is enable audio, it doesn't work. Using a setTimeout allows the first interaction to be registered.
		// Perhaps a better solution is to track whether the user has interacted, and if not but they try enabling
		// sound, show a tooltip that they should tap again to enable sound.
		setTimeout(() => {
			this.ctx.resume();
		}, 250);
	},

	// Private property used to throttle small burst sounds.
	_lastSmallBurstTime: 0,

	/**
	 * Play a sound of `type`. Will randomly pick a file associated with type, and play it at the specified volume
	 * and play speed, with a bit of random variance in play speed. This is all based on `sources` config.
	 *
	 * @param  {string} type - The type of sound to play.
	 * @param  {?number} scale=1 - Value between 0 and 1 (values outside range will be clamped). Scales less than one
	 *                             descrease volume and increase playback speed. This is because large explosions are
	 *                             louder, deeper, and reverberate longer than small explosions.
	 *                             Note that a scale of 0 will mute the sound.
	 */
	playSound(type, scale = 1) {
		// Ensure `scale` is within valid range.
		scale = MyMath.clamp(scale, 0, 1);

		// Disallow starting new sounds if sound is disabled, app is running in slow motion, or paused.
		// Slow motion check has some wiggle room in case user doesn't finish dragging the speed bar
		// *all* the way back.
		if (!canPlaySoundSelector() || simSpeed < 0.95) {
			return;
		}

		// Throttle small bursts, since floral/falling leaves shells have a lot of them.
		if (type === "burstSmall") {
			const now = Date.now();
			if (now - this._lastSmallBurstTime < 20) {
				return;
			}
			this._lastSmallBurstTime = now;
		}

		const source = this.sources[type];

		if (!source) {
			throw new Error(`Sound of type "${type}" doesn't exist.`);
		}

		const initialVolume = source.volume;
		const initialPlaybackRate = MyMath.random(source.playbackRateMin, source.playbackRateMax);

		// Volume descreases with scale.
		const scaledVolume = initialVolume * scale;
		// Playback rate increases with scale. For this, we map the scale of 0-1 to a scale of 2-1.
		// So at a scale of 1, sound plays normally, but as scale approaches 0 speed approaches double.
		const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

		const gainNode = this.ctx.createGain();
		gainNode.gain.value = scaledVolume;

		const buffer = MyMath.randomChoice(source.buffers);
		const bufferSource = this.ctx.createBufferSource();
		bufferSource.playbackRate.value = scaledPlaybackRate;
		bufferSource.buffer = buffer;
		bufferSource.connect(gainNode);
		gainNode.connect(this.ctx.destination);
		bufferSource.start(0);
	},

	preloadMusic() {
		const musicURL = "./audio/music.wav";
		const music = new Audio(musicURL);
		music.loop = true;
		music.volume = 0.2;
		music.className = 'bg-music';
		// music.style.height = 0;
		document.body.appendChild(music);
		music.play();
	},
	// play './audio/music.wav' as background music
	playMusic() {
		const music = document.querySelector('.bg-music');
		if (music) {
			music.play();
		}
	},
	pauseMusic() {
		const music = document.querySelector('.bg-music');
		if (music) {
			music.pause();
		}
	}
};
