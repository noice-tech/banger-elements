import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {
	forwardRef,
	useRef,
	useImperativeHandle,
	useId,
	useMemo,
	useLayoutEffect,
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

type AudioParticlesOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	/** Emission start relative to the element; negative values pre-fill the field. */
	readonly startTimeInSeconds?: number;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly color?: string;
	readonly radius?: number;
	readonly density?: number;
	readonly size?: number;
	readonly reactiveSpeed?: boolean;
	readonly maskHalo?: boolean;
};

type AudioParticlesProps = InteractiveBaseProps & InteractiveTransformProps & AudioParticlesOptions;
const ANALYSIS_FPS = 60;
const MASK_TRAIL_DEPTH = 7;
const PARTICLE_COUNT = 3500;

const audioParticlesSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
		default: 'https://remotion.media/elements/remotion-made-this-picture-move.mp3',
		description: 'Audio source',
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
	startTimeInSeconds: {
		type: 'number',
		default: -5,
		min: -5,
		max: 86400,
		step: 0.01,
		description: 'Emission start in seconds (0: fresh start; negative: pre-filled field)',
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
	color: {type: 'color', default: '#aa8bff', description: 'Particle color'},
	inputGainDb: {
		type: 'number',
		default: 22,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 7.4,
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
		description: 'Inner radius',
		hiddenFromList: false,
	},
	density: {
		type: 'number',
		default: 35,
		min: 0,
		max: 50,
		step: 1,
		description: 'Particle density',
		hiddenFromList: false,
	},
	size: {
		type: 'number',
		default: 1,
		min: 0.25,
		max: 2,
		step: 0.25,
		description: 'Particle size',
		hiddenFromList: false,
	},
	reactiveSpeed: {
		type: 'boolean',
		default: true,
		description: 'Bass-reactive speed',
	},
	maskHalo: {
		type: 'boolean',
		default: false,
		description: 'Exclude matching Halo edge in combined scenes',
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
				? {...result.audioData, resultId: `${instanceId}:${revision.current++}`}
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

function getSourceBass(parameters: AnalysisParameters) {
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

function getMaskFrequencyData(parameters: AnalysisParameters) {
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

function createParticleHistory({
	maskHalo,
	reactiveSpeed,
	...input
}: AudioInput & Pick<Required<AudioParticlesOptions>, 'maskHalo' | 'reactiveSpeed'>) {
	// Fixed 60 Hz analysis preserves the approved 60 FPS response at every host FPS.
	const sample = (time: number) => ({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame: Math.round(Math.max(0, time) * ANALYSIS_FPS),
		fps: ANALYSIS_FPS,
		inputGainDb: input.inputGainDb,
	});
	const bassAt = (time: number) =>
		time < 0 || time >= input.audioData.durationInSeconds ? 0 : getSourceBass(sample(time));
	const bass = bassAt(input.sourceTime);
	const history = new Uint8Array(200 * 9 * 4);
	// Only build the matching Halo edge when explicit masking is enabled.
	if (maskHalo)
		for (let row = 0; row < MASK_TRAIL_DEPTH; row++) {
			const time = input.sourceTime - row / ANALYSIS_FPS;
			if (time < 0 || time >= input.audioData.durationInSeconds) continue;
			const values = getMaskFrequencyData(sample(time));
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
	const bassHistory = new Uint8Array(301 * 4);
	const endTime = Math.floor(input.sourceTime * ANALYSIS_FPS) / ANALYSIS_FPS;
	if (reactiveSpeed) {
		for (let i = 0; i < 301; i++) {
			bassHistory[i * 4 + 2] = Math.round(bassAt(endTime - (300 - i) / ANALYSIS_FPS) * 255);
			bassHistory[i * 4 + 3] = 255;
		}
		let integral = 0;
		for (let i = 300; i >= 0; i--) {
			if (i < 300) integral += bassHistory[(i + 1) * 4 + 2] / 255 / ANALYSIS_FPS;
			const encoded = Math.round(clamp(integral / 5, 0, 1) * 65535);
			bassHistory[i * 4] = encoded >> 8;
			bassHistory[i * 4 + 1] = encoded & 255;
		}
	}
	return {
		bass,
		endTime,
		history: {
			width: 200,
			height: 9,
			data: history,
		} satisfies DataTexture,
		bassHistory: {
			width: 301,
			height: 1,
			data: bassHistory,
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

type AudioParticlesFrame = Omit<
	Required<AudioParticlesOptions>,
	'audioSrc' | 'audioOffsetInSeconds' | 'playAudio' | 'inputGainDb'
> &
	ReturnType<typeof createParticleHistory> & {
		readonly sourceTime: number;
		readonly particleTime: number;
	};

type AudioParticlesState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly historyTexture: WebGLTexture;
	readonly bassTexture: WebGLTexture;
	readonly uniforms: {
		readonly time: WebGLUniformLocation | null;
		readonly startTime: WebGLUniformLocation | null;
		readonly audioTimeOffset: WebGLUniformLocation | null;
		readonly aspect: WebGLUniformLocation | null;
		readonly history: WebGLUniformLocation | null;
		readonly bassHistory: WebGLUniformLocation | null;
		readonly endTime: WebGLUniformLocation | null;
		readonly color: WebGLUniformLocation | null;
		readonly radius: WebGLUniformLocation | null;
		readonly intensity: WebGLUniformLocation | null;
		readonly bass: WebGLUniformLocation | null;
		readonly density: WebGLUniformLocation | null;
		readonly size: WebGLUniformLocation | null;
		readonly reactiveSpeed: WebGLUniformLocation | null;
		readonly outputHeight: WebGLUniformLocation | null;
		readonly maskHalo: WebGLUniformLocation | null;
	};
};

function setupAudioParticles(canvas: HTMLCanvasElement): AudioParticlesState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Audio Particles requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Audio Particles could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let historyTexture: WebGLTexture | null = null;
	let bassTexture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, shaderSource(particlesVertex, false)],
			[gl.FRAGMENT_SHADER, shaderSource(particlesFragment, true)],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Audio Particles could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(
					`Audio Particles shader compilation failed: ${gl.getShaderInfoLog(shader)}`,
				);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Audio Particles shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Audio Particles could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			Float32Array.from({length: PARTICLE_COUNT}, (_, i) => i),
			gl.STATIC_DRAW,
		);
		const index = gl.getAttribLocation(program, 'particleIndex');
		gl.enableVertexAttribArray(index);
		gl.vertexAttribPointer(index, 1, gl.FLOAT, false, 0, 0);
		historyTexture = gl.createTexture();
		if (!historyTexture) throw new Error('Audio Particles could not create a mask texture.');
		bassTexture = gl.createTexture();
		if (!bassTexture) throw new Error('Audio Particles could not create a bass texture.');
		for (const [texture, filter] of [
			[historyTexture, gl.LINEAR],
			[bassTexture, gl.NEAREST],
		] as const) {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		}
		gl.uniform1f(gl.getUniformLocation(program, 'iOpacity'), 1);
		gl.uniform1f(gl.getUniformLocation(program, 'iTrailDepth'), MASK_TRAIL_DEPTH);
		gl.uniform1f(gl.getUniformLocation(program, 'iWaveDelay'), 1);
		gl.uniform1f(gl.getUniformLocation(program, 'iParticleBassHistoryDuration'), 5);
		return {
			gl,
			program,
			buffer,
			historyTexture,
			bassTexture,
			uniforms: {
				time: gl.getUniformLocation(program, 'iGlobalTime'),
				startTime: gl.getUniformLocation(program, 'iParticleStartTime'),
				audioTimeOffset: gl.getUniformLocation(program, 'iAudioTimeOffset'),
				aspect: gl.getUniformLocation(program, 'iAspect'),
				history: gl.getUniformLocation(program, 'iHistoryTexture'),
				bassHistory: gl.getUniformLocation(program, 'iParticleBassTexture'),
				endTime: gl.getUniformLocation(program, 'iParticleBassHistoryEndTime'),
				color: gl.getUniformLocation(program, 'iParticleColor'),
				radius: gl.getUniformLocation(program, 'iRadius'),
				intensity: gl.getUniformLocation(program, 'iIntensity'),
				bass: gl.getUniformLocation(program, 'iLowFreq'),
				density: gl.getUniformLocation(program, 'iParticleDensity'),
				size: gl.getUniformLocation(program, 'iParticleSize'),
				reactiveSpeed: gl.getUniformLocation(program, 'iParticleReactiveSpeed'),
				outputHeight: gl.getUniformLocation(program, 'iOutputHeight'),
				maskHalo: gl.getUniformLocation(program, 'iMaskHalo'),
			},
		};
	} catch (error) {
		gl.deleteTexture(historyTexture);
		gl.deleteTexture(bassTexture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function drawAudioParticles(
	{gl, program, historyTexture, bassTexture, uniforms}: AudioParticlesState,
	frame: AudioParticlesFrame,
) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.time, frame.particleTime);
	gl.uniform1f(uniforms.startTime, frame.startTimeInSeconds);
	gl.uniform1f(uniforms.audioTimeOffset, frame.sourceTime - frame.particleTime);
	gl.uniform1f(uniforms.aspect, frame.width / frame.height);
	gl.uniform3fv(uniforms.color, linearColor(frame.color));
	gl.uniform1f(uniforms.radius, frame.radius);
	gl.uniform1f(uniforms.intensity, frame.intensity);
	gl.uniform1f(uniforms.bass, frame.bass);
	gl.uniform1f(uniforms.endTime, frame.endTime);
	gl.uniform1f(uniforms.density, clamp(frame.density, 0, 50));
	gl.uniform1f(uniforms.size, frame.size);
	gl.uniform1f(uniforms.reactiveSpeed, Number(frame.reactiveSpeed));
	gl.uniform1f(uniforms.outputHeight, frame.height);
	gl.uniform1i(uniforms.maskHalo, Number(frame.maskHalo));
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, historyTexture);
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
	gl.bindTexture(gl.TEXTURE_2D, bassTexture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.bassHistory.width,
		frame.bassHistory.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		frame.bassHistory.data,
	);
	gl.uniform1i(uniforms.bassHistory, 1);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Audio Particles WebGL draw failed: ${error}`);
}

function cleanupAudioParticles({
	gl,
	program,
	buffer,
	historyTexture,
	bassTexture,
}: AudioParticlesState) {
	gl.deleteTexture(historyTexture);
	gl.deleteTexture(bassTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function AudioParticlesCanvas(frame: AudioParticlesFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<AudioParticlesState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupAudioParticles(canvas);
		} catch (error) {
			cancelRender(error);
			return;
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Audio Particles WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupAudioParticles(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Audio Particles');
		try {
			drawAudioParticles(state.current, frame);
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

const particlesFragment = `
uniform vec3 iParticleColor;

varying float vGlow;
varying float vParticleOpacity;

void main() {
  float normalizedDistance = length(gl_PointCoord - vec2(0.5)) * 4.8;
  float hardCircle = 1.0 - smoothstep(0.82, 1.0, normalizedDistance);
  float softCircle = 1.0 - smoothstep(1.0, 2.4, normalizedDistance);
  float alpha = (hardCircle + softCircle * vGlow * 0.35) * vParticleOpacity;

  if (alpha <= 0.001) {
    discard;
  }

  gl_FragColor = vec4(iParticleColor, clamp(alpha, 0.0, 1.0));
}
`;

const particlesVertex = `
uniform float iAspect;
uniform bool iMaskHalo;
uniform float iGlobalTime;
uniform float iParticleStartTime;
uniform float iAudioTimeOffset;
uniform sampler2D iHistoryTexture;
uniform sampler2D iParticleBassTexture;
uniform float iParticleBassHistoryDuration;
uniform float iParticleBassHistoryEndTime;
uniform float iParticleDensity;
uniform float iParticleSize;
uniform float iParticleReactiveSpeed;
uniform float iIntensity;
uniform float iTrailDepth;
uniform float iWaveDelay;
uniform float iRadius;
uniform float iLowFreq;
uniform float iOutputHeight;
uniform float iOpacity;

attribute float particleIndex;

varying float vGlow;
varying float vParticleOpacity;

#define TWO_PI 6.28318530718
#define HISTORY_ROWS 9.0
#define MAX_PARTICLES 3500.0
#define BASE_BIRTH_RATE 35.0
#define PARTICLE_BASS_SPEEDUP 40.0
#define MAX_SPEED_MULTIPLIER 20.0
#define MAX_BIRTH_RATE (BASE_BIRTH_RATE * MAX_SPEED_MULTIPLIER)
#define PARTICLE_EVENT_WINDOW 5.0
#define PARTICLE_PREROLL_SPEEDUP 9.0
#define PARTICLE_NON_REACTIVE_SPEEDUP 7.0
#define SOURCE_BASE_HEIGHT 500.0
#define SOURCE_FRAMES_PER_SECOND 60.0
#define SOURCE_ORIGIN_Z 100.0

float hash21(vec2 value) {
  vec3 hashValue = fract(
    vec3(value.x, value.y, value.x) * vec3(0.1031, 0.1030, 0.0973)
  );
  hashValue += dot(hashValue, hashValue.yzx + 33.33);
  return fract((hashValue.x + hashValue.y) * hashValue.z);
}

float signedRandom(float seed, float salt) {
  float value = hash21(vec2(seed + salt, seed * (salt + 0.37))) * 0.1;
  return hash21(vec2(seed * 0.73, salt + 11.0)) < 0.5 ? -value : value;
}

float getFrequency(float frequencyX, float historyAge) {
  float delayedAge = iWaveDelay > 0.5 ? historyAge : 0.0;
  float historyY = (delayedAge + 0.5) / HISTORY_ROWS;
  return texture2D(
    iHistoryTexture,
    vec2(clamp(frequencyX * 0.65, 0.0, 1.0), historyY)
  ).r;
}

float decodeParticleBassIntegral(vec4 encodedIntegral) {
  float highByte = encodedIntegral.r * 255.0;
  float lowByte = encodedIntegral.g * 255.0;
  return (
    (highByte * 256.0 + lowByte) / 65535.0
  ) * iParticleBassHistoryDuration;
}

vec4 particleBassSample(float sampleTime) {
  float textureX = 1.0 - clamp(
    (iParticleBassHistoryEndTime - (sampleTime + iAudioTimeOffset)) /
      iParticleBassHistoryDuration,
    0.0,
    1.0
  );
  return texture2D(iParticleBassTexture, vec2(textureX, 0.5));
}

float particleBassIntegral(float birthTime) {
  return decodeParticleBassIntegral(particleBassSample(birthTime));
}

void hideParticle() {
  vGlow = 0.0;
  vParticleOpacity = 0.0;
  gl_PointSize = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}

void main() {
  float densityScale = clamp(iParticleDensity, 0.0, 50.0) / 50.0;
  if (densityScale <= 0.0) {
    hideParticle();
    return;
  }

  float eventPhase = particleIndex / MAX_BIRTH_RATE;
  float eventCycle = floor(
    (iGlobalTime + eventPhase) / PARTICLE_EVENT_WINDOW
  );
  float birthTime = eventCycle * PARTICLE_EVENT_WINDOW - eventPhase;
  if (iGlobalTime < iParticleStartTime || birthTime < iParticleStartTime) {
    hideParticle();
    return;
  }

  float eventIndex = eventCycle * MAX_PARTICLES +
    (MAX_PARTICLES - 1.0 - particleIndex);
  float seed = eventIndex + 1.0;
  float birthBass = particleBassSample(birthTime).b;
  float speedMultiplier = 1.0 +
    birthBass * PARTICLE_BASS_SPEEDUP * iParticleReactiveSpeed;
  float activationProbability = densityScale *
    min(speedMultiplier, MAX_SPEED_MULTIPLIER) / MAX_SPEED_MULTIPLIER;
  if (hash21(vec2(seed + 53.0, seed * 0.43)) >= activationProbability) {
    hideParticle();
    return;
  }

  float age = max(0.0, iGlobalTime - birthTime);
  float prerollAge = min(age, max(0.0, -birthTime));
  float motionAge =
    age +
    prerollAge * PARTICLE_PREROLL_SPEEDUP +
    particleBassIntegral(birthTime) * PARTICLE_BASS_SPEEDUP *
      iParticleReactiveSpeed +
    age * PARTICLE_NON_REACTIVE_SPEEDUP * (1.0 - iParticleReactiveSpeed);
  float motionFrames = motionAge * SOURCE_FRAMES_PER_SECOND;
  float wallFrames = age * SOURCE_FRAMES_PER_SECOND;

  float xSpeed = signedRandom(seed, 3.1);
  float ySpeed = signedRandom(seed, 5.7);
  float zSpeed = mix(
    0.01,
    0.1,
    hash21(vec2(seed + 7.9, seed * 0.19))
  );
  float depthExponent = min(6.0, zSpeed * motionFrames / SOURCE_ORIGIN_Z);
  float z = (SOURCE_ORIGIN_Z * 2.0) * exp(depthExponent) - SOURCE_ORIGIN_Z;
  float middleZ = (SOURCE_ORIGIN_Z * 2.0) *
    exp(depthExponent * 0.5) - SOURCE_ORIGIN_Z;

  float curveAmountX = hash21(vec2(seed + 11.3, seed * 0.61)) * 0.1;
  float curvePeriodX = mix(
    20.0,
    100.0,
    hash21(vec2(seed + 13.7, seed * 0.71))
  );
  float curvePhaseX = hash21(vec2(seed + 17.1, seed * 0.83)) * 100.0 * TWO_PI;
  float curveAverageX = sin((middleZ - curvePhaseX) / curvePeriodX);

  float curveAmountY = hash21(vec2(seed + 19.9, seed * 0.97)) * 0.1;
  float curvePeriodY = mix(
    20.0,
    100.0,
    hash21(vec2(seed + 23.3, seed * 1.07))
  );
  float curvePhaseY = hash21(vec2(seed + 29.1, seed * 1.17)) * 100.0 * TWO_PI;
  float curveAverageY = sin((middleZ - curvePhaseY) / curvePeriodY);

  vec2 sourcePosition = vec2(
    xSpeed * motionFrames + curveAmountX * wallFrames * curveAverageX,
    ySpeed * motionFrames + curveAmountY * wallFrames * curveAverageY
  );
  vec2 projected = sourcePosition * (z / SOURCE_ORIGIN_Z) /
    SOURCE_BASE_HEIGHT;

  float baseSize = mix(
    0.5,
    2.7,
    hash21(vec2(seed + 31.7, seed * 1.29))
  );
  float sourceDiameter = iParticleSize * min(
    16.0,
    baseSize * z / SOURCE_ORIGIN_Z
  );
  if (
    abs(projected.x) - sourceDiameter / SOURCE_BASE_HEIGHT > iAspect * 0.5 ||
    abs(projected.y) - sourceDiameter / SOURCE_BASE_HEIGHT > 0.5
  ) {
    hideParticle();
    return;
  }

  float polarAngle = atan(projected.x, projected.y) / TWO_PI + 0.5;
  float frequencyX = polarAngle * 2.0;
  if (frequencyX > 1.0) {
    frequencyX = 2.0 - frequencyX;
  }
  frequencyX = 1.0 - frequencyX;

  float bassGrowth = iLowFreq * 0.015;
  float outerRadius = (iRadius + bassGrowth) * 2.0;
  for (int ageIndex = 0; ageIndex < 9; ageIndex++) {
    float historyAge = float(ageIndex);
    if (historyAge >= floor(iTrailDepth + 0.5)) {
      continue;
    }

    float frequency = getFrequency(frequencyX, historyAge);
    float drawRadius = iRadius + bassGrowth + frequency * 0.03 * iIntensity;
    outerRadius = max(outerRadius, drawRadius * 2.0);
  }

  float distanceFromCenter = length(projected);
  float ringVisibility = iMaskHalo ? smoothstep(
    outerRadius + 0.004,
    outerRadius + 0.035,
    distanceFromCenter
  ) : 1.0;
  float outputScale = max(0.1, iOutputHeight / 720.0);
  float hardDiameterAt720 = sourceDiameter * 720.0 / SOURCE_BASE_HEIGHT;

  vGlow = step(0.5, hash21(vec2(seed + 37.1, seed * 1.41)));
  vParticleOpacity = mix(
    0.2,
    1.0,
    hash21(vec2(seed + 41.9, seed * 1.53))
  ) * ringVisibility * iOpacity;

  gl_PointSize = max(1.0, hardDiameterAt720 * 2.4 * outputScale);
  gl_Position = vec4(projected.x * 2.0 / iAspect, projected.y * 2.0, 0.0, 1.0);
}
`;

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

const AudioParticlesContent: React.FC<Required<AudioParticlesOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const data = useMemo(
		() =>
			createParticleHistory({
				audioData: audioData ?? silentAudio,
				dataOffsetInSeconds,
				sourceTime,
				inputGainDb: props.inputGainDb,
				maskHalo: props.maskHalo,
				reactiveSpeed: props.reactiveSpeed,
			}),
		[
			audioData,
			dataOffsetInSeconds,
			sourceTime,
			props.inputGainDb,
			props.maskHalo,
			props.reactiveSpeed,
		],
	);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<AudioParticlesCanvas
				width={props.width}
				height={props.height}
				sourceTime={sourceTime}
				particleTime={frame / fps}
				startTimeInSeconds={props.startTimeInSeconds}
				history={data.history}
				bassHistory={data.bassHistory}
				bass={data.bass}
				endTime={data.endTime}
				intensity={props.intensity}
				color={props.color}
				radius={props.radius}
				density={props.density}
				size={props.size}
				reactiveSpeed={props.reactiveSpeed}
				maskHalo={props.maskHalo}
			/>
		</>
	);
};

const AudioParticlesInner = forwardRef<
	HTMLDivElement,
	AudioParticlesProps & {
		readonly controls: SequenceControls | undefined;
	}
>(
	(
		{
			width = audioParticlesSchema.width.default,
			height = audioParticlesSchema.height.default,
			audioSrc = audioParticlesSchema.audioSrc.default,
			audioOffsetInSeconds = audioParticlesSchema.audioOffsetInSeconds.default,
			playAudio = audioParticlesSchema.playAudio.default,
			startTimeInSeconds = audioParticlesSchema.startTimeInSeconds.default,
			inputGainDb = audioParticlesSchema.inputGainDb.default,
			intensity = audioParticlesSchema.intensity.default,
			color = audioParticlesSchema.color.default,
			radius = audioParticlesSchema.radius.default,
			density = audioParticlesSchema.density.default,
			size = audioParticlesSchema.size.default,
			reactiveSpeed = audioParticlesSchema.reactiveSpeed.default,
			maskHalo = audioParticlesSchema.maskHalo.default,
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
				name={name ?? 'Audio Particles'}
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
					<AudioParticlesContent
						key={audioSrc}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						startTimeInSeconds={startTimeInSeconds}
						inputGainDb={inputGainDb}
						intensity={intensity}
						color={color}
						radius={radius}
						density={density}
						size={size}
						reactiveSpeed={reactiveSpeed}
						maskHalo={maskHalo}
					/>
				</div>
			</Sequence>
		);
	},
);

export const AudioParticles = Interactive.withSchema({
	Component: AudioParticlesInner,
	componentName: '<AudioParticles>',
	componentIdentity: null,
	schema: audioParticlesSchema,
	supportsEffects: false,
}) as React.FC<AudioParticlesProps>;
