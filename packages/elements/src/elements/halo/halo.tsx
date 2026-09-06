import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {
	forwardRef,
	useRef,
	useImperativeHandle,
	useId,
	useMemo,
	useLayoutEffect,
	useState,
} from 'react';
import {
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	cancelRender,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type SequenceControls,
	type InteractivitySchema,
} from 'remotion';

type HaloOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly radius?: number;
	readonly trailDepth?: number;
	readonly waveDelay?: boolean;
	readonly glowBlur?: number;
	readonly glowSpread?: number;
	readonly artworkSrc?: string;
};

type HaloProps = InteractiveBaseProps & InteractiveTransformProps & HaloOptions;
const ANALYSIS_FPS = 60;

const haloSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
		default: 'https://remotion.media/elements/remotion-made-this-picture-move.mp3',
		description: 'Audio source',
		keyframable: false,
	},
	artworkSrc: {
		type: 'asset',
		default: '',
		description: 'Optional center artwork',
		keyframable: false,
	},
	audioOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		description: 'Audio source offset in seconds',
		hiddenFromList: false,
		keyframable: false,
	},
	playAudio: {
		type: 'boolean',
		default: true,
		description: 'Play audio (disable when stacking)',
		keyframable: false,
	},

	width: {
		type: 'number',
		default: 1280,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Width',
		hiddenFromList: false,
		keyframable: false,
	},
	height: {
		type: 'number',
		default: 720,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Height',
		hiddenFromList: false,
		keyframable: false,
	},
	startColor: {type: 'color', default: '#aa8bff', description: 'Start color'},
	endColor: {type: 'color', default: '#51e8cc', description: 'End color'},
	inputGainDb: {
		type: 'number',
		default: 17,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 6,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Intensity',
		hiddenFromList: false,
	},
	radius: {
		type: 'number',
		default: 0.18,
		min: 0.05,
		max: 0.8,
		step: 0.01,
		description: 'Radius',
		hiddenFromList: false,
	},
	trailDepth: {
		type: 'number',
		default: 7,
		min: 1,
		max: 9,
		step: 1,
		description: 'Trail layers',
		hiddenFromList: false,
	},
	waveDelay: {type: 'boolean', default: true, description: 'Delayed trails'},
	glowBlur: {
		type: 'number',
		default: 35,
		min: 0,
		max: 100,
		step: 1,
		description: 'Glow blur',
		hiddenFromList: false,
	},
	glowSpread: {
		type: 'number',
		default: 20,
		min: 0,
		max: 100,
		step: 1,
		description: 'Glow spread',
		hiddenFromList: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

const decodeWindowSeconds = 20;

function hasCompleteAudioWindow(audioData: MediaUtilsAudioData, offset: number, time: number) {
	const chunk = Math.floor(time / decodeWindowSeconds);
	const expectedStart = Math.max(0, (chunk - 1) * decodeWindowSeconds);
	const expectedEnd = Math.min(audioData.durationInSeconds, (chunk + 2) * decodeWindowSeconds);
	return (
		Math.abs(offset - expectedStart) < 1 / audioData.sampleRate &&
		audioData.channelWaveforms[0].length >=
			Math.round((expectedEnd - expectedStart) * audioData.sampleRate) - 2
	);
}

function useVisualizerAudio(src: string, time: number, fps: number) {
	const result = useWindowedAudioData({
		src,
		frame: Math.max(0, time) * fps,
		fps,
		windowInSeconds: decodeWindowSeconds,
	});
	// media-utils caches analysis by resultId; distinguish decoded buffer revisions.
	const instanceId = useId();
	const revision = useRef(0);
	const audioData = useMemo(
		() =>
			result.audioData
				? {
						...result.audioData,
						resultId: `${instanceId}:${revision.current++}`,
					}
				: null,
		[result.audioData, instanceId],
	);
	// The current chunk can arrive before its retained neighbors.
	const complete =
		audioData === null || hasCompleteAudioWindow(audioData, result.dataOffsetInSeconds, time);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		if (complete) return;
		const handle = delayRender('Waiting for complete visualizer audio history');
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return {...result, audioData: complete ? audioData : null};
}

function useArtwork(src: string) {
	const [loaded, setLoaded] = useState<{
		src: string;
		image: HTMLImageElement;
	} | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		if (!src) return;
		const handle = delayRender('Loading Halo artwork');
		const image = new Image();
		let active = true;
		image.crossOrigin = 'anonymous';
		image.onload = () => {
			if (active) {
				setLoaded({src, image});
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (active) {
				continueRender(handle);
				cancelRender(new Error(`Could not load artwork: ${src}`));
			}
		};
		image.src = src;
		return () => {
			active = false;
			image.onload = null;
			image.onerror = null;
			continueRender(handle);
		};
	}, [src, delayRender, continueRender]);
	return loaded?.src === src ? loaded.image : null;
}

type AudioInput = {
	readonly audioData: MediaUtilsAudioData;
	readonly dataOffsetInSeconds: number;
	readonly sourceTime: number;
	readonly inputGainDb: number;
};

type AnalysisParameters = {
	audioData: MediaUtilsAudioData;
	dataOffsetInSeconds: number;
	frame: number;
	fps: number;
	inputGainDb: number;
};

const bassCache = new Map<string, number>();

const smoothedMagnitudeCache = new Map<string, Float32Array>();

const FREQUENCY_BIN_COUNT = 512;

const SMOOTHING_LOOKBACK_FRAMES = 32;

const rawMagnitudeCache = new Map<string, Float32Array>();

const FFT_SIZE = 2048;

const blackmanWindow = Float64Array.from(
	{length: FFT_SIZE},
	(_, index) =>
		0.42 -
		0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1)) +
		0.08 * Math.cos((4 * Math.PI * index) / (FFT_SIZE - 1)),
);

const bitReversedIndices = new Uint16Array(FFT_SIZE);

const MAX_CACHE_ENTRIES = 800;

function setCachedValue<T>(cache: Map<string, T>, key: string, value: T) {
	cache.set(key, value);
	if (cache.size > MAX_CACHE_ENTRIES) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
}

function getRawMagnitudes({
	audioData,
	dataOffsetInSeconds,
	frame,
	fps,
}: {
	audioData: MediaUtilsAudioData;
	dataOffsetInSeconds: number;
	frame: number;
	fps: number;
}) {
	const cacheKey = `${audioData.resultId}:${dataOffsetInSeconds}:${fps}:${frame}`;
	const cached = rawMagnitudeCache.get(cacheKey);
	if (cached) return cached;
	const real = new Float64Array(FFT_SIZE);
	const imaginary = new Float64Array(FFT_SIZE);
	const waveform = audioData.channelWaveforms[0];
	const endSample = Math.floor((frame / fps - dataOffsetInSeconds) * audioData.sampleRate);
	const startSample = endSample - FFT_SIZE;
	for (let index = 0; index < FFT_SIZE; index++) {
		const waveformIndex = startSample + index;
		const sample =
			waveformIndex >= 0 && waveformIndex < waveform.length ? (waveform[waveformIndex] ?? 0) : 0;
		real[index] = sample * (blackmanWindow[index] ?? 0);
	}
	for (let index = 1; index < FFT_SIZE; index++) {
		const reversedIndex = bitReversedIndices[index] ?? 0;
		if (index < reversedIndex) {
			const realValue = real[index];
			real[index] = real[reversedIndex];
			real[reversedIndex] = realValue;
			const imaginaryValue = imaginary[index];
			imaginary[index] = imaginary[reversedIndex];
			imaginary[reversedIndex] = imaginaryValue;
		}
	}
	for (let length = 2; length <= FFT_SIZE; length <<= 1) {
		const angle = (-2 * Math.PI) / length;
		const phaseReal = Math.cos(angle);
		const phaseImaginary = Math.sin(angle);
		for (let start = 0; start < FFT_SIZE; start += length) {
			let rotationReal = 1;
			let rotationImaginary = 0;
			const halfLength = length >> 1;
			for (let offset = 0; offset < halfLength; offset++) {
				const evenIndex = start + offset;
				const oddIndex = evenIndex + halfLength;
				const oddReal = real[oddIndex] * rotationReal - imaginary[oddIndex] * rotationImaginary;
				const oddImaginary =
					real[oddIndex] * rotationImaginary + imaginary[oddIndex] * rotationReal;
				const evenReal = real[evenIndex];
				const evenImaginary = imaginary[evenIndex];
				real[evenIndex] = evenReal + oddReal;
				imaginary[evenIndex] = evenImaginary + oddImaginary;
				real[oddIndex] = evenReal - oddReal;
				imaginary[oddIndex] = evenImaginary - oddImaginary;
				const nextRotationReal = rotationReal * phaseReal - rotationImaginary * phaseImaginary;
				rotationImaginary = rotationReal * phaseImaginary + rotationImaginary * phaseReal;
				rotationReal = nextRotationReal;
			}
		}
	}
	const magnitudes = new Float32Array(FREQUENCY_BIN_COUNT);
	for (let index = 0; index < FREQUENCY_BIN_COUNT; index++) {
		magnitudes[index] = Math.hypot(real[index], imaginary[index]) / FFT_SIZE;
	}
	setCachedValue(rawMagnitudeCache, cacheKey, magnitudes);
	return magnitudes;
}

const TEMPORAL_SMOOTHING = 0.8;

function getSmoothedMagnitudes({audioData, dataOffsetInSeconds, frame, fps}: AnalysisParameters) {
	const smoothedCacheKey = `${audioData.resultId}:${dataOffsetInSeconds}:${fps}:${frame}`;
	const cached = smoothedMagnitudeCache.get(smoothedCacheKey);
	if (cached) return cached;
	const smoothedMagnitudes = new Float32Array(FREQUENCY_BIN_COUNT);
	// Always evaluate the same finite window, regardless of cache/render order.
	{
		const firstFrame = Math.max(0, frame - SMOOTHING_LOOKBACK_FRAMES);
		for (let analysisFrame = firstFrame; analysisFrame <= frame; analysisFrame++) {
			const magnitudes = getRawMagnitudes({
				audioData,
				dataOffsetInSeconds,
				frame: analysisFrame,
				fps,
			});
			for (let index = 0; index < FREQUENCY_BIN_COUNT; index++) {
				smoothedMagnitudes[index] =
					TEMPORAL_SMOOTHING * smoothedMagnitudes[index] +
					(1 - TEMPORAL_SMOOTHING) * (magnitudes[index] ?? 0);
			}
		}
	}
	setCachedValue(smoothedMagnitudeCache, smoothedCacheKey, smoothedMagnitudes);
	return smoothedMagnitudes;
}

const BASS_SAMPLE_COUNT = 8;

const BASS_SAMPLE_RANGE = 0.008;

const MIN_DECIBELS = -100;

const MAX_DECIBELS = -30;

function normalizeMagnitude(magnitude: number, inputGainDb: number) {
	const decibels = 20 * Math.log10(Math.max(magnitude, 1e-12)) + inputGainDb;
	return Math.max(0, Math.min(1, (decibels - MIN_DECIBELS) / (MAX_DECIBELS - MIN_DECIBELS)));
}

const BASS_VISIBILITY_THRESHOLD = 0.75;

function getHaloSourceBass(parameters: AnalysisParameters) {
	const cacheKey = `${parameters.audioData.resultId}:${parameters.dataOffsetInSeconds}:${parameters.fps}:${parameters.frame}:${parameters.inputGainDb}`;
	const cached = bassCache.get(cacheKey);
	if (cached !== undefined) return cached;
	const smoothedMagnitudes = getSmoothedMagnitudes(parameters);
	let bassAverage = 0;
	for (let bassStep = 0; bassStep < BASS_SAMPLE_COUNT; bassStep++) {
		const samplePosition =
			((bassStep * BASS_SAMPLE_RANGE) / BASS_SAMPLE_COUNT) * (FREQUENCY_BIN_COUNT - 1);
		const leftIndex = Math.floor(samplePosition);
		const rightIndex = Math.min(FREQUENCY_BIN_COUNT - 1, leftIndex + 1);
		const mix = samplePosition - leftIndex;
		const leftValue = normalizeMagnitude(
			smoothedMagnitudes[leftIndex] ?? 0,
			parameters.inputGainDb,
		);
		const rightValue = normalizeMagnitude(
			smoothedMagnitudes[rightIndex] ?? 0,
			parameters.inputGainDb,
		);
		bassAverage += leftValue * (1 - mix) + rightValue * mix;
	}
	bassAverage /= BASS_SAMPLE_COUNT;
	const bass = Math.max(
		0,
		Math.min(1, (bassAverage - BASS_VISIBILITY_THRESHOLD) / (1 - BASS_VISIBILITY_THRESHOLD)),
	);
	setCachedValue(bassCache, cacheKey, bass);
	return bass;
}

const frequencyDataCache = new Map<string, Float32Array>();

function getHaloSourceFrequencyData(parameters: AnalysisParameters) {
	const cacheKey = `${parameters.audioData.resultId}:${parameters.dataOffsetInSeconds}:${parameters.fps}:${parameters.frame}:${parameters.inputGainDb}`;
	const cached = frequencyDataCache.get(cacheKey);
	if (cached) return cached;
	const smoothedMagnitudes = getSmoothedMagnitudes(parameters);
	const frequencyData = new Float32Array(FREQUENCY_BIN_COUNT);
	for (let index = 0; index < FREQUENCY_BIN_COUNT; index++) {
		frequencyData[index] = normalizeMagnitude(
			smoothedMagnitudes[index] ?? 0,
			parameters.inputGainDb,
		);
	}
	setCachedValue(frequencyDataCache, cacheKey, frequencyData);
	return frequencyData;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type DataTexture = {
	width: number;
	height: number;
	data: Uint8Array;
};

function createHaloHistory({
	trailDepth,
	waveDelay,
	...input
}: AudioInput & Pick<Required<HaloOptions>, 'trailDepth' | 'waveDelay'>) {
	// Fixed 60 Hz analysis preserves the approved 60 FPS response at every host FPS.
	const sample = (time: number) => ({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame: Math.round(Math.max(0, time) * ANALYSIS_FPS),
		fps: ANALYSIS_FPS,
		inputGainDb: input.inputGainDb,
	});
	const bassAt = (time: number) =>
		time < 0 || time >= input.audioData.durationInSeconds ? 0 : getHaloSourceBass(sample(time));
	const bass = bassAt(input.sourceTime);
	const history = new Uint8Array(200 * 9 * 4);
	for (let row = 0; row < (waveDelay ? trailDepth : 1); row++) {
		const time = input.sourceTime - row / ANALYSIS_FPS;
		if (time < 0 || time >= input.audioData.durationInSeconds) continue;
		const values = getHaloSourceFrequencyData(sample(time));
		const frequency = (x: number) => {
			const p = clamp(x, 0, 1) * (values.length - 1);
			const left = Math.floor(p);
			return (
				values[left] * (1 - (p - left)) +
				(values[Math.min(left + 1, values.length - 1)] ?? 0) * (p - left)
			);
		};
		for (let bar = 0; bar < 200; bar++) {
			const position = (bar + 0.5) / 200;
			let value = 0;
			for (let step = 0; step < 10; step++) {
				const offset = (step * 0.02) / 10;
				const right = position + offset;
				value += clamp((frequency(Math.abs(position - offset) * 0.08) - 0.8) / 0.2, 0, 1);
				value += clamp((frequency((right < 1 ? right : 2 - right) * 0.08) - 0.8) / 0.2, 0, 1);
			}
			history[(row * 200 + bar) * 4] = Math.round((value / 20) * 255);
			history[(row * 200 + bar) * 4 + 3] = 255;
		}
	}
	return {
		bass,
		history: {
			width: 200,
			height: 9,
			data: history,
		} satisfies DataTexture,
	};
}

// Adapt the known Banger GLSL sources to WebGL2, without Three's injected built-ins.
function shaderSource(source: string, fragment: boolean) {
	let code = source
		.replace(/\bvarying\b/g, fragment ? 'in' : 'out')
		.replace(/\battribute\b/g, 'in')
		.replace(/\btexture2D\b/g, 'texture')
		.replace(/\bgl_FragColor\b/g, 'outColor')
		.replace('vec2 iResolution = vec2(1920.0, 1080.0);', 'uniform vec2 iResolution;')
		.replace('point.x *= 16.0 / 9.0;', 'point.x *= iAspect;');
	if (fragment)
		code =
			code.replace(/void main\(\)/, 'void renderEffect()') +
			`
void main() {
  renderEffect();
  vec3 c = max(outColor.rgb, vec3(0.0));
  outColor.rgb = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), c));
  outColor.a = clamp(outColor.a, 0.0, 1.0);
  outColor.rgb *= outColor.a;
}`;
	return `#version 300 es\nprecision highp float;\nprecision highp int;\n${fragment ? 'out vec4 outColor;\nuniform float iAspect;\n' : ''}${code}`;
}

type HaloFrame = Omit<
	Required<HaloOptions>,
	'audioSrc' | 'audioOffsetInSeconds' | 'playAudio' | 'inputGainDb' | 'artworkSrc'
> & {
	readonly sourceTime: number;
	readonly history: DataTexture;
	readonly bass: number;
	readonly image: HTMLImageElement | null;
};

type HaloState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly historyTexture: WebGLTexture;
	readonly artworkTexture: WebGLTexture;
	readonly uniforms: {
		readonly time: WebGLUniformLocation | null;
		readonly aspect: WebGLUniformLocation | null;
		readonly history: WebGLUniformLocation | null;
		readonly artwork: WebGLUniformLocation | null;
		readonly hasArtwork: WebGLUniformLocation | null;
		readonly artworkAspect: WebGLUniformLocation | null;
		readonly startColor: WebGLUniformLocation | null;
		readonly endColor: WebGLUniformLocation | null;
		readonly radius: WebGLUniformLocation | null;
		readonly intensity: WebGLUniformLocation | null;
		readonly trailDepth: WebGLUniformLocation | null;
		readonly waveDelay: WebGLUniformLocation | null;
		readonly glowBlur: WebGLUniformLocation | null;
		readonly glowSpread: WebGLUniformLocation | null;
		readonly bass: WebGLUniformLocation | null;
	};
};

function setupHalo(canvas: HTMLCanvasElement): HaloState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Halo requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Halo could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let historyTexture: WebGLTexture | null = null;
	let artworkTexture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, shaderSource(haloVertex, false)],
			[gl.FRAGMENT_SHADER, shaderSource(haloFragment, true)],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Halo could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Halo shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Halo shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Halo could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const position = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		historyTexture = gl.createTexture();
		if (!historyTexture) throw new Error('Halo could not create a history texture.');
		artworkTexture = gl.createTexture();
		if (!artworkTexture) throw new Error('Halo could not create an artwork texture.');
		for (const texture of [historyTexture, artworkTexture]) {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		}
		gl.uniform1f(gl.getUniformLocation(program, 'iOpacity'), 1);
		gl.uniform1f(gl.getUniformLocation(program, 'iBackgroundOpacity'), 0);
		return {
			gl,
			program,
			buffer,
			historyTexture,
			artworkTexture,
			uniforms: {
				time: gl.getUniformLocation(program, 'iGlobalTime'),
				aspect: gl.getUniformLocation(program, 'iAspect'),
				history: gl.getUniformLocation(program, 'iHistoryTexture'),
				artwork: gl.getUniformLocation(program, 'iCenterImageTexture'),
				hasArtwork: gl.getUniformLocation(program, 'iHasCenterImage'),
				artworkAspect: gl.getUniformLocation(program, 'iCenterImageAspectRatio'),
				startColor: gl.getUniformLocation(program, 'iStartColor'),
				endColor: gl.getUniformLocation(program, 'iEndColor'),
				radius: gl.getUniformLocation(program, 'iRadius'),
				intensity: gl.getUniformLocation(program, 'iIntensity'),
				trailDepth: gl.getUniformLocation(program, 'iTrailDepth'),
				waveDelay: gl.getUniformLocation(program, 'iWaveDelay'),
				glowBlur: gl.getUniformLocation(program, 'iGlowBlur'),
				glowSpread: gl.getUniformLocation(program, 'iGlowSpread'),
				bass: gl.getUniformLocation(program, 'iLowFreq'),
			},
		};
	} catch (error) {
		gl.deleteTexture(historyTexture);
		gl.deleteTexture(artworkTexture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function drawHalo(
	{gl, program, historyTexture, artworkTexture, uniforms}: HaloState,
	frame: HaloFrame,
) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.time, frame.sourceTime);
	gl.uniform1f(uniforms.aspect, frame.width / frame.height);
	gl.uniform3fv(uniforms.startColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.endColor, linearColor(frame.endColor));
	gl.uniform1f(uniforms.radius, frame.radius);
	gl.uniform1f(uniforms.intensity, frame.intensity);
	gl.uniform1f(uniforms.trailDepth, frame.trailDepth);
	gl.uniform1f(uniforms.waveDelay, Number(frame.waveDelay));
	gl.uniform1f(uniforms.glowBlur, frame.glowBlur);
	gl.uniform1f(uniforms.glowSpread, frame.glowSpread);
	gl.uniform1f(uniforms.bass, frame.bass);
	gl.uniform1f(uniforms.hasArtwork, Number(Boolean(frame.image)));
	gl.uniform1f(
		uniforms.artworkAspect,
		frame.image ? frame.image.naturalWidth / frame.image.naturalHeight : 1,
	);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, historyTexture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.history.width,
		frame.history.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		frame.history.data,
	);
	gl.uniform1i(uniforms.history, 0);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Boolean(frame.image));
	if (frame.image) {
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame.image);
	} else {
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			emptyTexture.width,
			emptyTexture.height,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			emptyTexture.data,
		);
	}
	gl.uniform1i(uniforms.artwork, 1);
	gl.disable(gl.BLEND);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Halo WebGL draw failed: ${error}`);
}

function cleanupHalo({gl, program, buffer, historyTexture, artworkTexture}: HaloState) {
	gl.deleteTexture(historyTexture);
	gl.deleteTexture(artworkTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function HaloCanvas(frame: HaloFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<HaloState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupHalo(canvas);
		} catch (error) {
			cancelRender(error);
			return;
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Halo WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupHalo(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Halo');
		try {
			drawHalo(state.current, frame);
		} catch (error) {
			cancelRender(error);
		} finally {
			continueRender(handle);
		}
	}, [frame, delayRender, continueRender]);
	return (
		<canvas
			ref={canvasRef}
			width={frame.width}
			height={frame.height}
			style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
		/>
	);
}

// prettier-ignore
const haloFragment = `
/*
  Adapted from "Colorful Music Visualizer" by tikveel:
  https://www.shadertoy.com/view/llycWD

  Free Public License 1.0.0

  Copyright (C) 2018 by tikveel <steven@tikveel.nl>

  Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING
  ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL,
  DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
  WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE
  USE OR PERFORMANCE OF THIS SOFTWARE.
*/

uniform float iGlobalTime;
uniform sampler2D iHistoryTexture;
uniform sampler2D iCenterImageTexture;
uniform float iCenterImageAspectRatio;
uniform float iHasCenterImage;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform float iRadius;
uniform float iIntensity;
uniform float iTrailDepth;
uniform float iWaveDelay;
uniform float iGlowBlur;
uniform float iGlowSpread;
uniform float iBackgroundOpacity;
uniform float iLowFreq;
uniform float iOpacity;

varying vec2 vUv;
varying vec3 vBackgroundBottom;
varying vec3 vBackgroundTop;

#define TWO_PI 6.28318530718
#define HISTORY_ROWS 9.0
#define CIRCLE_BORDER_SIZE 0.003

vec3 displayToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
  return mix(low, high, step(vec3(0.04045), color));
}

float cutLower(float value, float low) {
  return clamp((value - low) / (1.0 - low), 0.0, 1.0);
}

vec2 rotatePoint(vec2 point, float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return point * mat2(cosine, sine, -sine, cosine);
}

// Preserve the source shader's circle response, including its intentionally
// broad radius. This shape is what gives the visualizer its large center disc.
float sourceCircle(float distanceFromCenter, float radius, float smoothness) {
  float distanceFromRadius = distanceFromCenter - radius;
  float halfSmoothness = smoothness * 0.5;
  return 1.0 - smoothstep(
    radius - halfSmoothness,
    radius + halfSmoothness,
    distanceFromRadius
  );
}

vec4 over(vec4 back, vec4 front) {
  float alpha = front.a + back.a * (1.0 - front.a);
  vec3 color = (
    front.rgb * front.a + back.rgb * back.a * (1.0 - front.a)
  ) / max(alpha, 0.00001);
  return vec4(color, alpha);
}

vec3 backgroundColor(vec2 uv) {
  vec3 tint = mix(vBackgroundBottom, vBackgroundTop, uv.y + 0.1);
  return mix(vec3(0.004, 0.006, 0.01), tint, 0.06);
}

vec4 spectrumColor(float age) {
  float layerPosition = clamp(
    age / max(iTrailDepth - 1.0, 1.0),
    0.0,
    1.0
  );
  return vec4(
    mix(iStartColor, iEndColor, layerPosition),
    mix(1.0, 0.85, layerPosition)
  );
}

float getFrequency(float frequencyX, float historyAge) {
  float delayedAge = iWaveDelay > 0.5 ? historyAge : 0.0;
  float historyY = (delayedAge + 0.5) / HISTORY_ROWS;
  return texture2D(
    iHistoryTexture,
    vec2(clamp(frequencyX * 0.65, 0.0, 1.0), historyY)
  ).r;
}

vec3 innerCircle(vec2 point) {
  float turn = 1.0 - smoothstep(
    0.0,
    1.0,
    cutLower(fract(iGlobalTime * 0.06), 0.8)
  );
  vec2 rotated = rotatePoint(point, TWO_PI * turn);
  vec3 color = mix(vec3(0.005), vec3(0.035), rotated.y * 0.5 + 0.5);
  color += sin(length(rotated) * 80.0) * 0.008;

  return displayToLinear(clamp(color, 0.0, 1.0));
}

vec4 centerImageColor(vec2 normalizedPoint) {
  vec2 imageUv = normalizedPoint * 0.5 + 0.5;
  if (iCenterImageAspectRatio >= 1.0) {
    imageUv.x = (imageUv.x - 0.5) / iCenterImageAspectRatio + 0.5;
  } else {
    imageUv.y = (imageUv.y - 0.5) * iCenterImageAspectRatio + 0.5;
  }
  vec4 image = texture2D(iCenterImageTexture, imageUv);
  image.rgb = displayToLinear(image.rgb);
  return image;
}

void main() {
  vec2 point = vUv - 0.5;
  point.x *= 16.0 / 9.0;

  float motionExtra = iLowFreq * 3.0;
  vec2 shake = vec2(sin(iGlobalTime * 9.0), cos(iGlobalTime * 5.0)) * 0.002;
  vec2 scenePoint = point + shake;
  vec2 backgroundUv = vUv + shake;
  vec4 result = vec4(
    backgroundColor(backgroundUv),
    clamp(iBackgroundOpacity, 0.0, 1.0)
  );

  vec2 spectrumPoint = rotatePoint(
    scenePoint,
    sin(iGlobalTime * 1.5 + motionExtra) * 0.005
  );
  spectrumPoint += vec2(
    cos(iGlobalTime * 9.0 + motionExtra * 0.3),
    sin(iGlobalTime * 9.0 + motionExtra * 0.3)
  ) * 0.003;

  float bassGrowth = iLowFreq * 0.015;
  float distanceFromCenter = length(spectrumPoint);
  float maximumDrawRadius = clamp(
    iRadius + bassGrowth + 0.03 * iIntensity,
    iRadius + bassGrowth,
    1.0
  );

  if (distanceFromCenter > maximumDrawRadius * 2.0 + 0.028) {
    result.rgb += iLowFreq * 0.05;
    result.rgb *= smoothstep(0.0, 1.0, 1.7 - length(scenePoint));
    result.a *= iOpacity;
    gl_FragColor = result;
    return;
  }

  float polarAngle = atan(spectrumPoint.x, spectrumPoint.y) / TWO_PI + 0.5;
  float frequencyX = polarAngle * 2.0;
  if (frequencyX > 1.0) {
    frequencyX = 2.0 - frequencyX;
  }
  frequencyX = 1.0 - frequencyX;

  float leadFrequency = getFrequency(frequencyX, 0.0);
  float leadRadius = iRadius + bassGrowth + leadFrequency * 0.03 * iIntensity;
  float glowDistance = max(
    0.0,
    abs(distanceFromCenter - leadRadius * 2.0) - iGlowSpread * 0.0002
  );
  float leadGlow = 1.0 - smoothstep(
    0.004,
    max(0.0041, iGlowBlur * 0.001),
    glowDistance
  );
  result = over(result, vec4(iStartColor, leadGlow * 0.35));

  for (int ageIndex = 8; ageIndex >= 0; ageIndex--) {
    float age = float(ageIndex);
    if (age >= floor(iTrailDepth + 0.5)) {
      continue;
    }

    float frequency = getFrequency(frequencyX, age);
    float drawRadius = clamp(
      iRadius + bassGrowth + frequency * 0.03 * iIntensity,
      iRadius + bassGrowth,
      1.0
    );
    float smoothness = 0.004 + age * 0.00025;
    float spectrumMask = sourceCircle(
      distanceFromCenter,
      drawRadius,
      smoothness
    );
    vec4 layerColor = spectrumColor(age);
    layerColor.a *= spectrumMask;
    result = over(result, layerColor);
  }

  float innerRadius = max(0.02, iRadius + bassGrowth - CIRCLE_BORDER_SIZE);
  float innerMask = sourceCircle(distanceFromCenter, innerRadius, 0.004);
  if (innerMask > 0.0) {
    vec2 innerPoint = spectrumPoint / innerRadius;
    result = over(result, vec4(innerCircle(innerPoint), innerMask));
    if (iHasCenterImage > 0.5) {
      vec4 centerImage = centerImageColor(innerPoint * 0.5);
      centerImage.a *= innerMask;
      result = over(result, centerImage);
    }
  }

  result.rgb += iLowFreq * 0.05;
  result.rgb *= smoothstep(0.0, 1.0, 1.7 - length(scenePoint));
  result.a *= iOpacity;

  gl_FragColor = result;
}
`;

const haloVertex = `
in vec2 position;
uniform float iGlobalTime;
uniform vec3 iStartColor;
uniform vec3 iEndColor;

varying vec2 vUv;
varying vec3 vBackgroundBottom;
varying vec3 vBackgroundTop;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  float extra = iGlobalTime * 0.05;
  vec3 bottomHsv = rgb2hsv(iEndColor);
  vec3 topHsv = rgb2hsv(iStartColor);
  bottomHsv.x = fract(bottomHsv.x + (iGlobalTime * 0.25 + extra) * 0.02);
  topHsv.x = fract(topHsv.x + (iGlobalTime * 0.15 - extra) * 0.1);

  vUv = position * 0.5 + 0.5;
  vBackgroundBottom = hsv2rgb(bottomHsv);
  vBackgroundTop = hsv2rgb(topHsv);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const emptyTexture: DataTexture = {
	width: 1,
	height: 1,
	data: new Uint8Array(4),
};

const colorCache = new Map<string, number[]>();

let colorParser: CanvasRenderingContext2D | null = null;

function linearColor(color: string): number[] {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
		bytes = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
	} else {
		if (!CSS.supports('color', color)) throw new Error(`Invalid visualizer color: ${color}`);
		if (!colorParser) {
			const canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = 1;
			colorParser = canvas.getContext('2d', {willReadFrequently: true})!;
		}
		colorParser.clearRect(0, 0, 1, 1);
		colorParser.fillStyle = color;
		colorParser.fillRect(0, 0, 1, 1);
		bytes = Array.from(colorParser.getImageData(0, 0, 1, 1).data).slice(0, 3);
	}
	const result = bytes.map((byte) => {
		const value = byte / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	if (colorCache.size >= 64) colorCache.clear();
	colorCache.set(color, result);
	return result;
}

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const HaloContent: React.FC<Required<HaloOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const image = useArtwork(props.artworkSrc);
	const trailDepth = Math.round(props.trailDepth);
	const data = useMemo(
		() =>
			createHaloHistory({
				audioData: audioData ?? silentAudio,
				dataOffsetInSeconds,
				sourceTime,
				inputGainDb: props.inputGainDb,
				trailDepth,
				waveDelay: props.waveDelay,
			}),
		[audioData, dataOffsetInSeconds, sourceTime, props.inputGainDb, trailDepth, props.waveDelay],
	);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<HaloCanvas
				width={props.width}
				height={props.height}
				sourceTime={sourceTime}
				history={data.history}
				bass={data.bass}
				image={image}
				intensity={props.intensity}
				startColor={props.startColor}
				endColor={props.endColor}
				radius={props.radius}
				trailDepth={trailDepth}
				waveDelay={props.waveDelay}
				glowBlur={props.glowBlur}
				glowSpread={props.glowSpread}
			/>
		</>
	);
};

const HaloInner = forwardRef<
	HTMLDivElement,
	HaloProps & {
		readonly controls: SequenceControls | undefined;
	}
>(
	(
		{
			width = haloSchema.width.default,
			height = haloSchema.height.default,
			audioSrc = haloSchema.audioSrc.default,
			audioOffsetInSeconds = haloSchema.audioOffsetInSeconds.default,
			playAudio = haloSchema.playAudio.default,
			inputGainDb = haloSchema.inputGainDb.default,
			intensity = haloSchema.intensity.default,
			startColor = haloSchema.startColor.default,
			endColor = haloSchema.endColor.default,
			radius = haloSchema.radius.default,
			trailDepth = haloSchema.trailDepth.default,
			waveDelay = haloSchema.waveDelay.default,
			glowBlur = haloSchema.glowBlur.default,
			glowSpread = haloSchema.glowSpread.default,
			artworkSrc = haloSchema.artworkSrc.default,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? 'Halo'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						boxSizing: 'border-box',
						width,
						height,
						overflow: 'hidden',
						...style,
					}}
				>
					<HaloContent
						key={`${audioSrc}-${artworkSrc}`}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						intensity={intensity}
						startColor={startColor}
						endColor={endColor}
						radius={radius}
						trailDepth={trailDepth}
						waveDelay={waveDelay}
						glowBlur={glowBlur}
						glowSpread={glowSpread}
						artworkSrc={artworkSrc}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Halo = Interactive.withSchema({
	Component: HaloInner,
	componentName: '<Halo>',
	componentIdentity: null,
	schema: haloSchema,
	supportsEffects: false,
}) as React.FC<HaloProps>;
