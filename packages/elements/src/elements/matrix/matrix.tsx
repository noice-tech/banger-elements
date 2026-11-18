import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {
	forwardRef,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from 'react';
import {
	cancelRender,
	Interactive,
	Sequence,
	useCurrentFrame,
	useDelayRender,
	useVideoConfig,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type InteractivitySchema,
	type SequenceControls,
} from 'remotion';

type MatrixOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly color1?: string;
	readonly color2?: string;
	readonly glowColor?: string;
	readonly textureSrc?: string;
	readonly speed?: number;
	readonly scale?: number;
	readonly iterations?: number;
	readonly spread?: number;
	readonly colorCycle?: number;
	readonly glow?: number;
	readonly responsive?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};
type MatrixProps = InteractiveBaseProps & InteractiveTransformProps & MatrixOptions;
const matrixSchema = {
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
	playAudio: {
		type: 'boolean',
		default: true,
		description: 'Play audio (disable when stacking)',
		keyframable: false,
	},
	inputGainDb: {
		type: 'number',
		default: 0,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	color1: {type: 'color', default: '#ff6b00', description: 'Primary Color'},
	color2: {type: 'color', default: '#00a8ff', description: 'Secondary Color'},
	glowColor: {type: 'color', default: '#ffffff', description: 'Glow Color'},
	textureSrc: {type: 'asset', default: '', description: 'Noise Texture', keyframable: false},
	speed: {
		type: 'number',
		default: 0.5,
		min: 0.1,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Speed',
	},
	scale: {
		type: 'number',
		default: 1,
		min: 0.5,
		max: 3,
		step: 0.1,
		hiddenFromList: false,
		description: 'Scale',
	},
	iterations: {
		type: 'number',
		default: 24,
		min: 4,
		max: 24,
		step: 1,
		hiddenFromList: false,
		description: 'Iterations',
	},
	spread: {
		type: 'number',
		default: 0.75,
		min: 0.1,
		max: 1.5,
		step: 0.05,
		hiddenFromList: false,
		description: 'Spread',
	},
	colorCycle: {
		type: 'number',
		default: 2.5,
		min: 0.5,
		max: 5,
		step: 0.1,
		hiddenFromList: false,
		description: 'Color Cycle',
	},
	glow: {
		type: 'number',
		default: 1,
		min: 0,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Glow',
	},
	responsive: {
		type: 'number',
		default: 2,
		min: 0,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
		description: 'Audio Reactivity',
	},
	bpm: {
		type: 'number',
		default: 120,
		min: 1,
		max: 300,
		step: 1,
		hiddenFromList: false,
		description: 'Tempo (BPM)',
	},
	timeOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		hiddenFromList: false,
		description: 'Animation phase offset (independent of audio trim)',
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
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;
const decodeWindowSeconds = 20;
function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function hasCompleteAudioWindow(audioData: MediaUtilsAudioData, offset: number, time: number) {
	const chunk = Math.floor(time / decodeWindowSeconds);
	const start = Math.max(0, (chunk - 1) * decodeWindowSeconds);
	const end = Math.min(audioData.durationInSeconds, (chunk + 2) * decodeWindowSeconds);
	return (
		Math.abs(offset - start) < 1 / audioData.sampleRate &&
		audioData.channelWaveforms[0].length >= Math.round((end - start) * audioData.sampleRate) - 2
	);
}
function useVisualizerAudio(src: string, time: number, fps: number) {
	const result = useWindowedAudioData({
		src,
		frame: Math.max(0, time) * fps,
		fps,
		windowInSeconds: decodeWindowSeconds,
	});
	const instanceId = useId();
	const revision = useRef(0);
	const audioData = useMemo(
		() =>
			result.audioData
				? {...result.audioData, resultId: `${instanceId}:${revision.current++}`}
				: null,
		[result.audioData, instanceId],
	);
	const complete =
		audioData === null || hasCompleteAudioWindow(audioData, result.dataOffsetInSeconds, time);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		if (complete) return;
		const handle = delayRender('Waiting for complete Matrix audio history');
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return {...result, audioData: complete ? audioData : null};
}
type RealFftPlan = {
	size: number;
	window: Float32Array;
	amplitudeGain: number;
	bitReversed: Uint32Array;
	cos: Float64Array;
	sin: Float64Array;
	real: Float64Array;
	imaginary: Float64Array;
};

const plans = new Map<number, RealFftPlan>();

function getPlan(size: number): RealFftPlan {
	const cached = plans.get(size);

	if (cached) {
		return cached;
	}

	const half = size / 2;
	const window = new Float32Array(size);
	let windowSum = 0;

	for (let index = 0; index < size; index++) {
		window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / size);
		windowSum += window[index];
	}

	const bits = Math.log2(half);
	const bitReversed = new Uint32Array(half);

	for (let index = 0; index < half; index++) {
		let reversed = 0;

		for (let bit = 0; bit < bits; bit++) {
			reversed = (reversed << 1) | ((index >> bit) & 1);
		}

		bitReversed[index] = reversed;
	}

	const cos = new Float64Array(half);
	const sin = new Float64Array(half);

	for (let index = 0; index < half; index++) {
		cos[index] = Math.cos((2 * Math.PI * index) / size);
		sin[index] = Math.sin((2 * Math.PI * index) / size);
	}

	const plan = {
		size,
		window,
		amplitudeGain: 2 / windowSum,
		bitReversed,
		cos,
		sin,
		real: new Float64Array(half),
		imaginary: new Float64Array(half),
	};

	plans.set(size, plan);

	return plan;
}

/**
 * Hann-windowed amplitude spectrum of `size` samples centered on `center`.
 * Samples outside `samples` count as silence. Bin `k` is `k * sampleRate / size`
 * Hz; a full-scale sine centered on a bin reads 1.
 */
function computeAmplitudeSpectrum({
	samples,
	center,
	size,
}: {
	samples: Float32Array;
	center: number;
	size: number;
}): Float32Array {
	if (size < 4 || (size & (size - 1)) !== 0) {
		throw new TypeError(`FFT size must be a power of two, got ${size}`);
	}

	const plan = getPlan(size);
	const {window, bitReversed, cos, sin, real, imaginary} = plan;
	const half = size / 2;
	const start = center - half;

	for (let index = 0; index < half; index++) {
		const evenIndex = start + 2 * index;
		const oddIndex = evenIndex + 1;
		const target = bitReversed[index];

		real[target] =
			evenIndex >= 0 && evenIndex < samples.length ? samples[evenIndex] * window[2 * index] : 0;

		imaginary[target] =
			oddIndex >= 0 && oddIndex < samples.length ? samples[oddIndex] * window[2 * index + 1] : 0;
	}

	for (let length = 2; length <= half; length <<= 1) {
		const halfLength = length >> 1;
		const stride = size / length;

		for (let offset = 0; offset < half; offset += length) {
			for (let index = 0; index < halfLength; index++) {
				const twiddleReal = cos[index * stride];
				const twiddleImaginary = -sin[index * stride];
				const a = offset + index;
				const b = a + halfLength;

				const productReal = twiddleReal * real[b] - twiddleImaginary * imaginary[b];

				const productImaginary = twiddleReal * imaginary[b] + twiddleImaginary * real[b];

				real[b] = real[a] - productReal;
				imaginary[b] = imaginary[a] - productImaginary;
				real[a] += productReal;
				imaginary[a] += productImaginary;
			}
		}
	}

	const amplitudes = new Float32Array(half);

	for (let bin = 0; bin < half; bin++) {
		const mirror = bin === 0 ? 0 : half - bin;
		const a = real[bin];
		const b = imaginary[bin];
		const c = real[mirror];
		const d = imaginary[mirror];
		const evenReal = (a + c) / 2;
		const evenImaginary = (b - d) / 2;
		const oddReal = (b + d) / 2;
		const oddImaginary = (c - a) / 2;

		const spectrumReal = evenReal + cos[bin] * oddReal + sin[bin] * oddImaginary;

		const spectrumImaginary = evenImaginary + cos[bin] * oddImaginary - sin[bin] * oddReal;

		amplitudes[bin] =
			Math.sqrt(spectrumReal * spectrumReal + spectrumImaginary * spectrumImaginary) *
			plan.amplitudeGain;
	}

	return amplitudes;
}

const SPECTRUM_MIN_FREQUENCY = 20;
const SPECTRUM_MAX_FREQUENCY = 22000;
const SPECTRUM_BARS_COUNT = 308;

const SLOPE_DB_PER_OCTAVE = 4.5;
const SLOPE_PIVOT_FREQUENCY = 1000;

const OUTPUT_GAIN = 3.5;
const SILENCE = 1e-9;

type BandPlan = {
	firstBin: Int32Array;
	endBin: Int32Array;
	interpolatedBin: Float64Array;
	gain: Float64Array;
};

const bandPlans = new Map<string, BandPlan>();

function frequencyToSpectrumPosition(frequency: number): number {
	return (
		Math.log(frequency / SPECTRUM_MIN_FREQUENCY) /
		Math.log(SPECTRUM_MAX_FREQUENCY / SPECTRUM_MIN_FREQUENCY)
	);
}

function spectrumPositionToFrequency(position: number): number {
	return (
		SPECTRUM_MIN_FREQUENCY * Math.pow(SPECTRUM_MAX_FREQUENCY / SPECTRUM_MIN_FREQUENCY, position)
	);
}

function getBarAtFrequency(bars: number[], frequency: number): number {
	const index = Math.floor(frequencyToSpectrumPosition(frequency) * bars.length);

	return bars[Math.min(bars.length - 1, Math.max(0, index))] ?? 0;
}

function getBandPlan(sampleRate: number, fftSize: number, count: number): BandPlan {
	const key = `${sampleRate}:${fftSize}:${count}`;
	const cached = bandPlans.get(key);

	if (cached) {
		return cached;
	}

	const binCount = fftSize / 2;
	const binWidth = sampleRate / fftSize;
	const nyquist = sampleRate / 2;

	const plan = {
		firstBin: new Int32Array(count),
		endBin: new Int32Array(count),
		interpolatedBin: new Float64Array(count),
		gain: new Float64Array(count),
	};

	for (let band = 0; band < count; band++) {
		const low = spectrumPositionToFrequency(band / count);
		const high = spectrumPositionToFrequency((band + 1) / count);
		const center = Math.sqrt(low * high);
		const firstBin = Math.max(1, Math.ceil(low / binWidth));
		const endBin = Math.min(binCount, Math.ceil(high / binWidth));

		plan.firstBin[band] = firstBin;
		plan.endBin[band] = endBin;
		plan.interpolatedBin[band] = endBin > firstBin ? -1 : center / binWidth;

		plan.gain[band] =
			center >= nyquist
				? 0
				: OUTPUT_GAIN *
					Math.pow(10, (SLOPE_DB_PER_OCTAVE * Math.log2(center / SLOPE_PIVOT_FREQUENCY)) / 20);
	}

	if (bandPlans.size >= 32) bandPlans.clear();
	bandPlans.set(key, plan);

	return plan;
}

/**
 * Resamples an amplitude spectrum onto `outputBarsCount` log-spaced bands from
 * 20 Hz to 22 kHz. Each band reads the loudest bin it covers, so a tone keeps
 * its level and position regardless of band width or sample rate.
 */
function computeBars({
	amplitudes,
	sampleRate,
	fftSize,
	outputBarsCount = SPECTRUM_BARS_COUNT,
}: {
	amplitudes: ArrayLike<number>;
	sampleRate: number;
	fftSize: number;
	outputBarsCount?: number;
}): number[] {
	const bars = Array.from({length: outputBarsCount}, () => 0);

	if (amplitudes.length < fftSize / 2 || sampleRate <= 0) {
		return bars;
	}

	const plan = getBandPlan(sampleRate, fftSize, outputBarsCount);

	for (let band = 0; band < outputBarsCount; band++) {
		const gain = plan.gain[band];

		if (gain === 0) {
			continue;
		}

		const position = plan.interpolatedBin[band];
		let amplitude = 0;

		if (position >= 0) {
			const lower = Math.floor(position);

			const bin = Math.max(
				1,
				Math.min(fftSize / 2 - 2, amplitudes[lower + 1] > amplitudes[lower] ? lower + 1 : lower),
			);

			const offset = position - bin;
			const previous = Math.log(amplitudes[bin - 1] + SILENCE);
			const current = Math.log(amplitudes[bin] + SILENCE);
			const next = Math.log(amplitudes[bin + 1] + SILENCE);

			amplitude = Math.max(
				0,
				Math.exp(
					current +
						(offset * (next - previous)) / 2 +
						(offset * offset * (next - 2 * current + previous)) / 2,
				) - SILENCE,
			);
		} else {
			for (let bin = plan.firstBin[band]; bin < plan.endBin[band]; bin++) {
				amplitude = Math.max(amplitude, amplitudes[bin]);
			}
		}

		bars[band] = amplitude * gain;
	}

	return bars;
}

function spectrumBars(audioData: MediaUtilsAudioData, offset: number, time: number, count = 308) {
	if (time < 0 || time >= audioData.durationInSeconds) return Array.from({length: count}, () => 0);
	const size = 16384;
	const amplitudes = computeAmplitudeSpectrum({
		samples: audioData.channelWaveforms[0],
		center: Math.floor((time - offset) * audioData.sampleRate),
		size,
	});
	return computeBars({
		amplitudes,
		sampleRate: audioData.sampleRate,
		fftSize: size,
		outputBarsCount: count,
	});
}
const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

function geometry() {
	const vertices: number[] = [];
	const vertex = (x: number, y: number) => {
		const u = x / 32,
			v = y / 32,
			longitude = u * Math.PI * 2,
			latitude = v * Math.PI,
			pole = y === 0 ? 1 / 64 : y === 32 ? -1 / 64 : 0;
		vertices.push(
			-100 * Math.cos(longitude) * Math.sin(latitude),
			100 * Math.cos(latitude),
			100 * Math.sin(longitude) * Math.sin(latitude),
			u + pole,
			1 - v,
		);
	};
	for (let y = 0; y < 32; y++)
		for (let x = 0; x < 32; x++) {
			if (y > 0) {
				vertex(x + 1, y);
				vertex(x, y);
				vertex(x + 1, y + 1);
			}
			if (y < 31) {
				vertex(x, y);
				vertex(x, y + 1);
				vertex(x + 1, y + 1);
			}
		}
	return new Float32Array(vertices);
}
const vertexShader = `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform float iAspect;
void main() { vUv=uv; float c=cos(1.6), s=sin(1.6); vec3 p=vec3(c*position.x+s*position.z,position.y,-s*position.x+c*position.z-5.0); float f=1.0/tan(radians(75.0)*0.5); gl_Position=vec4(p.x*f/iAspect,p.y*f,-(1000.0+0.1)/(1000.0-0.1)*p.z-2.0*1000.0*0.1/(1000.0-0.1),-p.z); }`;

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

uniform float iGlobalTime;
uniform sampler2D iSoundTexture;
uniform sampler2D iTexture;
uniform float iTextureExists;

uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;

uniform vec3 iColor1;
uniform vec3 iColor2;
uniform vec3 iGlowColor;
uniform float iSpeed;
uniform float iScale;
uniform float iIterations;
uniform float iSpread;
uniform float iColorCycle;
uniform float iResponsive;
uniform float iGlow;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

#define PI 3.14159265358979
#define PHI 0.618033988749
#define MAX_ITERATIONS 24
#define NOISE_OCTAVES 3

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float proceduralNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fractalnoise(vec2 p, float time) {
  float q = 1.0;
  float t = 0.0;

  for (int n = 0; n < NOISE_OCTAVES; n++) {
    vec2 samplePos = p / 256.0 * q;
    samplePos += time * 0.01 * vec2(cos(float(n) * 0.5), sin(float(n) * 0.5));

    float texVal;
    if (iTextureExists > 0.5) {
      texVal = texture(iTexture, fract(samplePos)).r;
    } else {
      texVal = proceduralNoise(samplePos * 64.0);
    }

    t += (texVal - 0.5) / q / 2.0;
    q += q;
  }

  return t;
}

void main() {
  vec2 fragCoord = vUv * iResolution;
  vec2 r = iResolution.xy;
  float time = iGlobalTime * iSpeed;

  vec2 p = (fragCoord + fragCoord - r) / sqrt(r.x * r.y);
  p *= iScale;

  vec4 col = vec4(0.0);

  float specLow = texture(iSoundTexture, vec2(0.10, 0.5)).r * iResponsive;
  float specMid = texture(iSoundTexture, vec2(0.40, 0.5)).r * iResponsive;
  float specHigh = texture(iSoundTexture, vec2(0.80, 0.5)).r * iResponsive;

  float iterations = clamp(iIterations, 4.0, float(MAX_ITERATIONS));
  float timeOffset = (time + 100.0) * 0.3 + specLow * 0.25 + specHigh * 0.12;
  float noiseStrength = 1.0 + specMid * 0.18;
  float spread = iSpread * (1.0 + specMid * 0.15);

  for (int index = 0; index < MAX_ITERATIONS; index++) {
    float i = float(index);
    if (i >= iterations) break;

    float angle = i * PI * 2.0 * PHI;
    vec2 direction = sin(angle + vec2(0.0, PI * 0.5));
    vec2 offset = vec2(cos(angle), direction.y);

    float noise = fractalnoise(p * 1.5 + timeOffset * offset, time);
    col += vec4(noise * noiseStrength);

    p += direction * col.x * spread;
  }

  float colorCycle = iColorCycle * (1.0 + specHigh * 0.18);
  vec4 colorMod = vec4(1.0, 1.618, 2.618, 0.0) * colorCycle;
  col = sin(col * colorMod) * 0.5 + 0.5;
  col *= col;

  float lum = (col.r + col.g + col.b) / 3.0;
  float lumSquared = lum * lum;
  float primaryWeight = col.r * 1.65 + smoothstep(0.18, 0.82, lum) * 0.45;
  float secondaryWeight = col.g * 0.95;
  float glowWeight = col.b * 0.55;

  vec3 finalCol = primaryWeight * iColor1 + secondaryWeight * iColor2 + glowWeight * iGlowColor;
  finalCol = finalCol / (primaryWeight + secondaryWeight + glowWeight + 0.001);

  vec3 lumCol = mix(iColor2, iColor1, smoothstep(0.12, 0.78, lum));
  lumCol = mix(lumCol, iGlowColor, lumSquared * 0.35);

  finalCol = mix(lumCol, finalCol, 0.65);
  finalCol *= 0.55 + lum * 0.75;
  finalCol += iGlowColor * (lumSquared * lum) * iGlow * (0.22 + specLow * 0.12);
  finalCol = mix(finalCol, iGlowColor, specHigh * 0.05);

  outColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
}
`;
const colorCache = new Map<string, number[]>();
let colorParser: CanvasRenderingContext2D | null = null;
function linearColor(color: string) {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded =
			hex.length === 3 ? [...hex].map((character) => character + character).join('') : hex;
		bytes = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
	} else {
		if (!CSS.supports('color', color)) throw new Error(`Invalid Matrix color: ${color}`);
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

type MatrixFrame = Required<MatrixOptions> & {readonly time: number; readonly bars: number[]};
type MatrixState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly audioTexture: WebGLTexture;
	readonly imageTexture: WebGLTexture | null;
	imageLoaded: boolean;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupMatrix(canvas: HTMLCanvasElement): MatrixState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
	});
	if (!gl)
		throw new Error(
			'Matrix requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Matrix could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let audioTexture: WebGLTexture | null = null;
	let imageTexture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Matrix could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Matrix shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Matrix shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Matrix could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const data = geometry();
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		for (const [name, size, offset] of [
			['position', 3, 0],
			['uv', 2, 12],
		] as const) {
			const attribute = gl.getAttribLocation(program, name);
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 20, offset);
		}

		audioTexture = gl.createTexture();
		if (!audioTexture) throw new Error('Matrix could not create an audio texture.');
		imageTexture = gl.createTexture();
		if (!imageTexture) throw new Error('Matrix could not create an image texture.');
		for (const texture of [audioTexture, imageTexture]) {
			if (!texture) continue;
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				1,
				1,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				new Uint8Array([0, 0, 0, 255]),
			);
		}
		return {
			audioTexture,
			imageTexture,
			imageLoaded: false,
			gl,
			program,
			buffer,
			vertexCount: data.length / 5,
			uniforms: Object.fromEntries(
				[
					'iGlobalTime',
					'iLowFreq',
					'iMidFreq',
					'iHighFreq',
					'iAspect',
					'iSoundTexture',
					'iColor1',
					'iColor2',
					'iGlowColor',
					'iSpeed',
					'iScale',
					'iIterations',
					'iSpread',
					'iColorCycle',
					'iGlow',
					'iResponsive',
					'iBpm',
					'iTexture',
					'iTextureExists',
				].map((name) => [name, gl.getUniformLocation(program, name)]),
			),
		};
	} catch (error) {
		gl.deleteTexture(audioTexture);
		gl.deleteTexture(imageTexture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}
function drawMatrix(state: MatrixState, frame: MatrixFrame) {
	const {gl, program, uniforms} = state;
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	const gain = 10 ** (bounded(frame.inputGainDb, -30, 30, 0) / 20);
	gl.uniform1f(uniforms.iLowFreq, getBarAtFrequency(frame.bars, 60) * gain);
	gl.uniform1f(uniforms.iMidFreq, getBarAtFrequency(frame.bars, 1000) * gain);
	gl.uniform1f(uniforms.iHighFreq, getBarAtFrequency(frame.bars, 8000) * gain);
	gl.uniform3fv(uniforms.iColor1, linearColor(frame.color1));
	gl.uniform3fv(uniforms.iColor2, linearColor(frame.color2));
	gl.uniform3fv(uniforms.iGlowColor, linearColor(frame.glowColor));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 2, 0.5));
	gl.uniform1f(uniforms.iScale, bounded(frame.scale, 0.5, 3, 1));
	gl.uniform1f(uniforms.iIterations, bounded(frame.iterations, 4, 24, 24));
	gl.uniform1f(uniforms.iSpread, bounded(frame.spread, 0.1, 1.5, 0.75));
	gl.uniform1f(uniforms.iColorCycle, bounded(frame.colorCycle, 0.5, 5, 2.5));
	gl.uniform1f(uniforms.iGlow, bounded(frame.glow, 0, 2, 1));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 10, 2));
	gl.uniform1f(uniforms.iBpm, bounded(frame.bpm, 1, 300, 120));
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.audioTexture);
	const data = new Uint8Array(frame.bars.length * 4);
	for (let i = 0; i < frame.bars.length; i++) {
		data[i * 4] = Math.round(Math.min(1, Math.max(0, frame.bars[i] * gain)) * 255);
		data[i * 4 + 3] = 255;
	}
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.bars.length,
		1,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		data,
	);
	gl.uniform1i(uniforms.iSoundTexture, 0);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, state.imageTexture);
	gl.uniform1i(uniforms.iTexture, 1);
	gl.uniform1f(uniforms.iTextureExists, Number(state.imageLoaded));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error('Matrix WebGL draw failed: ' + error);
}
function cleanupMatrix({gl, program, buffer, audioTexture, imageTexture}: MatrixState) {
	gl.deleteTexture(audioTexture);
	gl.deleteTexture(imageTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function MatrixCanvas(frame: MatrixFrame) {
	const latestFrame = useRef(frame);
	latestFrame.current = frame;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<MatrixState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupMatrix(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Matrix WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupMatrix(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);

	useLayoutEffect(() => {
		const current = state.current;
		if (!current) return;
		current.imageLoaded = false;
		if (!frame.textureSrc) return;
		const handle = delayRender('Loading Matrix texture');
		const image = new Image();
		image.crossOrigin = 'anonymous';
		let active = true;
		image.onload = () => {
			if (!active) return;
			try {
				const {gl} = current;
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, current.imageTexture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				current.imageLoaded = true;
				drawMatrix(current, latestFrame.current);
			} catch (error) {
				cancelRender(error);
			} finally {
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (active) {
				continueRender(handle);
				cancelRender(new Error('Matrix could not load texture: ' + latestFrame.current.textureSrc));
			}
		};
		image.src = frame.textureSrc;
		return () => {
			active = false;
			image.onload = null;
			image.onerror = null;
			continueRender(handle);
		};
	}, [frame.textureSrc, delayRender, continueRender]);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Matrix');
		try {
			drawMatrix(state.current, frame);
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
const MatrixContent: React.FC<Required<MatrixOptions> & {width: number; height: number}> = (
	props,
) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(bounded(props.audioOffsetInSeconds, 0, 86400, 0) * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const time = frame / fps + bounded(props.timeOffsetInSeconds, 0, 86400, 0);
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const bars = spectrumBars(audioData ?? silentAudio, dataOffsetInSeconds, sourceTime);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<MatrixCanvas {...props} time={time} bars={bars} />
		</>
	);
};

const MatrixInner = forwardRef<
	HTMLDivElement,
	MatrixProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			audioSrc = matrixSchema.audioSrc.default,
			audioOffsetInSeconds = matrixSchema.audioOffsetInSeconds.default,
			playAudio = matrixSchema.playAudio.default,
			inputGainDb = matrixSchema.inputGainDb.default,
			color1 = matrixSchema.color1.default,
			color2 = matrixSchema.color2.default,
			glowColor = matrixSchema.glowColor.default,
			textureSrc = matrixSchema.textureSrc.default,
			speed = matrixSchema.speed.default,
			scale = matrixSchema.scale.default,
			iterations = matrixSchema.iterations.default,
			spread = matrixSchema.spread.default,
			colorCycle = matrixSchema.colorCycle.default,
			glow = matrixSchema.glow.default,
			responsive = matrixSchema.responsive.default,
			bpm = matrixSchema.bpm.default,
			timeOffsetInSeconds = matrixSchema.timeOffsetInSeconds.default,
			width = matrixSchema.width.default,
			height = matrixSchema.height.default,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		const drawingWidth = Math.round(bounded(width, 16, 3840, 1280)),
			drawingHeight = Math.round(bounded(height, 16, 3840, 720));
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? 'Matrix'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						position: 'relative',
						boxSizing: 'border-box',
						width: drawingWidth,
						height: drawingHeight,
						overflow: 'hidden',
						...style,
					}}
				>
					<MatrixContent
						key={audioSrc}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						color1={color1}
						color2={color2}
						glowColor={glowColor}
						textureSrc={textureSrc}
						speed={speed}
						scale={scale}
						iterations={iterations}
						spread={spread}
						colorCycle={colorCycle}
						glow={glow}
						responsive={responsive}
						bpm={bpm}
						timeOffsetInSeconds={timeOffsetInSeconds}
						width={drawingWidth}
						height={drawingHeight}
					/>
				</div>
			</Sequence>
		);
	},
);
export const Matrix = Interactive.withSchema({
	Component: MatrixInner,
	componentName: '<Matrix>',
	componentIdentity: null,
	schema: matrixSchema,
	supportsEffects: false,
}) as React.FC<MatrixProps>;
