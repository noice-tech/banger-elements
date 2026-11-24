import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {useId, useLayoutEffect, useMemo, useRef} from 'react';
import {
	cancelRender,
	Interactive,
	useCurrentFrame,
	useDelayRender,
	useVideoConfig,
	type InteractivitySchema,
} from 'remotion';

type ChromeOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly color1?: string;
	readonly color2?: string;
	readonly color3?: string;
	readonly textureSrc?: string;
	readonly textureScale?: number;
	readonly textureBlend?: number;
	readonly warpIntensity?: number;
	readonly warpSpeed?: number;
	readonly colorCycle?: number;
	readonly bumpStrength?: number;
	readonly specularPower?: number;
	readonly responsive?: number;
	readonly lightMovement?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};
type ChromeProps = Omit<ChromeOptions, 'width' | 'height'>;
const chromeSchema = {
	audioSrc: {
		type: 'asset',
		assetType: 'audio',
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
	color1: {type: 'color', default: '#c0c0c0', description: 'Metal Color 1'},
	color2: {type: 'color', default: '#d4af37', description: 'Metal Color 2'},
	color3: {type: 'color', default: '#b87333', description: 'Metal Color 3'},
	textureSrc: {
		type: 'asset',
		assetType: 'image',
		default: '',
		description: 'Custom Texture',
		keyframable: false,
	},
	textureScale: {
		type: 'number',
		default: 1,
		min: 0.5,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
		description: 'Texture Scale',
	},
	textureBlend: {
		type: 'number',
		default: 0.5,
		min: 0,
		max: 1,
		step: 0.1,
		hiddenFromList: false,
		description: 'Texture Blend',
	},
	warpIntensity: {
		type: 'number',
		default: 1,
		min: 0.1,
		max: 3,
		step: 0.1,
		hiddenFromList: false,
		description: 'Warp Intensity',
	},
	warpSpeed: {
		type: 'number',
		default: 1,
		min: 0.1,
		max: 3,
		step: 0.1,
		hiddenFromList: false,
		description: 'Flow Speed',
	},
	colorCycle: {
		type: 'number',
		default: 0.5,
		min: 0,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Color Cycle',
	},
	bumpStrength: {
		type: 'number',
		default: 0.05,
		min: 0.01,
		max: 0.15,
		step: 0.01,
		hiddenFromList: false,
		description: 'Bump Depth',
	},
	specularPower: {
		type: 'number',
		default: 12,
		min: 4,
		max: 32,
		step: 2,
		hiddenFromList: false,
		description: 'Specular Sharpness',
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
	lightMovement: {
		type: 'number',
		default: 1,
		min: 0,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Light Movement',
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
		const handle = delayRender('Waiting for complete Chrome audio history');
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
uniform vec3 iColor3;
uniform float iWarpIntensity;
uniform float iWarpSpeed;
uniform float iBumpStrength;
uniform float iSpecularPower;
uniform float iResponsive;
uniform float iLightMovement;
uniform float iTextureScale;
uniform float iTextureBlend;
uniform float iColorCycle;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

// Flowing warp field - creates organic wave displacement
vec2 flowingWarp(vec2 coord) {
  vec2 p = (coord + 3.0) * 4.0;
  float t = iGlobalTime * iWarpSpeed * 0.5;

  // Layered sinusoidal feedback
  for (int i = 0; i < 3; i++) {
    p += cos(p.yx * 3.0 + vec2(t, 1.57)) / 3.0;
    p += sin(p.yx + t + vec2(1.57, 0.0)) / 2.0;
    p *= 1.3;
  }

  // Subtle grain for metal texture
  p += fract(sin(p + vec2(13.0, 7.0)) * 5e5) * 0.03 - 0.015;

  return mod(p, 2.0) - 1.0;
}

// Surface height from warp field
float surfaceHeight(vec2 coord) {
  return length(flowingWarp(coord)) * 0.7071;
}

// Calculate bump-mapped normal via gradient sampling
vec3 calculateNormal(vec2 coord, float bumpScale) {
  vec2 eps = vec2(4.0 / iResolution.y, 0.0);

  float center = surfaceHeight(coord);
  float dx = surfaceHeight(coord - eps.xy);
  float dy = surfaceHeight(coord - eps.yx);

  float gradX = (dx - center) / eps.x;
  float gradY = (dy - center) / eps.x;

  vec3 normal = vec3(0.0, 0.0, -1.0);
  normal = normalize(normal + vec3(gradX, gradY, 0.0) * bumpScale);

  return normal;
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// RGB to HSV conversion
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// Spectrum reflection - chrome reflects the actual audio spectrum as colored bands
vec3 spectrumReflection(vec3 reflectDir, float time) {
  // Map reflection angle to spectrum position
  float angle = atan(reflectDir.y, reflectDir.x);
  float normalizedAngle = (angle + 3.14159) / 6.28318;

  // Flow the reflection
  float flow = time * 0.08;

  vec3 reflection = vec3(0.0);

  // Sample fewer bands for subtler effect
  for (float i = 0.0; i < 8.0; i++) {
    float bandOffset = i / 8.0;
    float sampleX = fract(normalizedAngle + bandOffset + flow);

    // Sample raw sound texture - reduced intensity
    float amplitude = texture(iSoundTexture, vec2(sampleX, 0.5)).r * iResponsive * 1.2;

    // Color based on frequency position - more muted
    vec3 bandColor = hsv2rgb(vec3(sampleX, 0.5, 0.9));
    // Mix more with user colors
    bandColor = mix(bandColor, mix(iColor1, iColor2, sampleX), 0.7);

    // Band intensity - narrower bands
    float bandWidth = 0.06 + amplitude * 0.03;
    float bandMask = smoothstep(bandWidth, 0.0, abs(fract(normalizedAngle * 8.0) - 0.5));

    reflection += bandColor * amplitude * bandMask * 0.2;
  }

  return reflection;
}

// Spectrum surface distortion - frequency data adds ripples to surface
float spectrumRipple(vec2 coord, float time) {
  float ripple = 0.0;

  // Sample spectrum at fewer positions for subtler effect
  for (float i = 0.0; i < 4.0; i++) {
    float angle = i / 4.0 * 6.28318;
    vec2 offset = vec2(cos(angle), sin(angle)) * 0.25;

    float sampleX = fract(length(coord + offset) * 0.15 + time * 0.03 + i / 4.0);
    float amplitude = texture(iSoundTexture, vec2(sampleX, 0.5)).r * iResponsive;

    // Create gentler ripples
    float dist = length(coord - offset * 1.5);
    float wave = sin(dist * 8.0 - time * 2.0 - amplitude * 3.0);
    ripple += wave * amplitude * 0.025;
  }

  return ripple;
}

// Spectrum color overlay on metal surface
vec3 spectrumMetalColor(vec2 coord, float time) {
  // Sample spectrum based on position
  float sampleX = fract(coord.x * 0.4 + 0.5 + time * 0.015);
  float sampleY = fract(coord.y * 0.25 + time * 0.02);

  float ampX = texture(iSoundTexture, vec2(sampleX, 0.5)).r * iResponsive;
  float ampY = texture(iSoundTexture, vec2(sampleY, 0.5)).r * iResponsive;

  // Create subtler flowing color bands
  float hue = fract(sampleX + ampX * 0.2);
  float sat = 0.4 + ampY * 0.25;
  float val = 0.6 + (ampX + ampY) * 0.2;

  vec3 spectrumColor = hsv2rgb(vec3(hue, sat, val));

  // Blend more with user colors
  spectrumColor = mix(spectrumColor, iColor1, 0.4 + ampX * 0.2);
  spectrumColor = mix(spectrumColor, iColor3, ampY * 0.2);

  return spectrumColor * (ampX + ampY) * 0.3;
}

// Procedural metallic color with audio-reactive color cycling
vec3 metallicBlend(vec2 coord, float height, float colorShift, float bass, float mids, float highs) {
  vec2 warped = flowingWarp(coord);

  // Create smooth blending weights based on warped coordinates
  float angle = atan(warped.y, warped.x) + colorShift;

  // Bass pulses the color rotation
  angle += bass * 1.5;

  float blend1 = max(0.0, sin(angle));
  float blend2 = max(0.0, sin(angle + 2.094)); // +120 degrees
  float blend3 = max(0.0, sin(angle + 4.188)); // +240 degrees
  float total = blend1 + blend2 + blend3 + 0.001;

  // Mix the three metal colors
  vec3 metal = (iColor1 * blend1 + iColor2 * blend2 + iColor3 * blend3) / total;

  // Audio-reactive color manipulation
  vec3 hsv = rgb2hsv(metal);

  // Mids shift the hue
  hsv.x = fract(hsv.x + mids * iColorCycle * 0.3);

  // Highs increase saturation and brightness
  hsv.y = clamp(hsv.y + highs * 0.3, 0.0, 1.0);
  hsv.z = clamp(hsv.z + highs * 0.15, 0.0, 1.0);

  // Bass adds warmth (shift toward orange/red)
  hsv.x = fract(hsv.x - bass * 0.05);

  metal = hsv2rgb(hsv);

  // Darken in valleys, brighten on peaks
  metal *= height * 0.7 + 0.3;

  return metal;
}

// Sample texture with warped coordinates
vec3 sampleTexture(vec2 coord, vec2 warpOffset) {
  vec2 texCoord = coord * iTextureScale + warpOffset * 0.125;
  vec3 texColor = texture(iTexture, texCoord).rgb;
  // sRGB to linear approximation
  texColor *= texColor;
  // Color processing for metallic look
  texColor = smoothstep(0.05, 0.75, pow(texColor, vec3(0.75, 0.8, 0.85)));
  return texColor;
}

void main() {
  vec2 fragCoord = vUv * iResolution;
  vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;

  float t = iGlobalTime;

  // Audio reactivity
  float bass = iLowFreq * iResponsive;
  float mids = iMidFreq * iResponsive;
  float highs = iHighFreq * iResponsive;

  // Surface position
  vec3 surfacePos = vec3(uv * iWarpIntensity, 0.0);

  // View direction (from camera to surface)
  vec3 viewDir = normalize(vec3(uv, 1.0));

  // Moving light position - mids affect orbit speed
  float lightOrbit = t * 0.8 * iLightMovement * (1.0 + mids * 0.5);
  vec3 lightPos = vec3(cos(lightOrbit) * 0.5, sin(lightOrbit) * 0.2, -1.0);

  // Add spectrum-driven ripples to surface position
  float ripple = spectrumRipple(surfacePos.xy, t);
  surfacePos.z += ripple;

  // Calculate bump-mapped normal with ripple influence
  float bumpScale = iBumpStrength;
  vec3 normal = calculateNormal(surfacePos.xy, bumpScale);
  // Add ripple gradient to normal - gentler effect
  vec2 rippleEps = vec2(0.01, 0.0);
  float rippleDx = spectrumRipple(surfacePos.xy + rippleEps.xy, t) - ripple;
  float rippleDy = spectrumRipple(surfacePos.xy + rippleEps.yx, t) - ripple;
  normal = normalize(normal + vec3(rippleDx, rippleDy, 0.0) * 10.0);

  // Light direction and distance
  vec3 lightDir = lightPos - surfacePos;
  float lightDist = max(length(lightDir), 0.0001);
  lightDir /= lightDist;

  // Light attenuation
  float atten = 1.0 / (1.0 + lightDist * lightDist * 0.15);

  // Surface height affects attenuation (darker in crevices)
  float height = surfaceHeight(surfacePos.xy);
  atten *= height * 0.9 + 0.1;

  // Diffuse lighting
  float diff = max(dot(normal, lightDir), 0.0);
  diff = pow(diff, 4.0) * 0.66 + pow(diff, 8.0) * 0.34;

  // Specular highlighting - highs add extra sparkle
  float specPower = iSpecularPower;
  float spec = pow(max(dot(reflect(-lightDir, normal), -viewDir), 0.0), specPower);

  // Highs create sparkle bursts
  spec *= 1.0 + highs * 2.0;

  // Color shifting based on time and mids
  float colorShift = t * iColorCycle * 0.2 + mids * 2.0;

  // Get metallic surface color with full audio reactivity
  vec3 proceduralColor = metallicBlend(surfacePos.xy, height, colorShift, bass, mids, highs);
  vec3 metalColor = proceduralColor;

  if (iTextureExists > 0.5) {
    vec2 warpOffset = flowingWarp(surfacePos.xy);
    vec3 texColor = sampleTexture(surfacePos.xy, warpOffset);
    metalColor = mix(proceduralColor, texColor, iTextureBlend);
  }

  // Audio-reactive light color
  vec3 warmLight = vec3(1.0, 0.97, 0.92);
  warmLight = mix(warmLight, vec3(1.0, 0.8, 0.6), bass * 0.5); // Warmer on bass
  warmLight = mix(warmLight, vec3(0.9, 0.95, 1.0), highs * 0.3); // Cooler on highs

  // Specular color shifts with mids
  vec3 specColor = vec3(1.0, 0.6, 0.2);
  specColor = mix(specColor, vec3(0.8, 0.4, 1.0), mids * 0.5); // Purple tint on mids

  vec3 result = (metalColor * (diff * warmLight * 2.0 + 0.5) + specColor * spec * 2.0) * atten;

  // === SPECTRUM REFLECTION - chrome reflects audio frequency bands ===
  vec3 reflectDir = reflect(viewDir, normal);
  vec3 specReflect = spectrumReflection(reflectDir, t);
  float fresnel = pow(1.0 - max(dot(-viewDir, normal), 0.0), 3.0);
  result += specReflect * fresnel * 1.0;

  // === SPECTRUM METAL COLOR OVERLAY ===
  vec3 specMetalCol = spectrumMetalColor(surfacePos.xy, t);
  result += specMetalCol * (1.0 - fresnel) * 0.3;

  // Environment reflection with audio-reactive color
  vec3 envColor = vec3(0.25, 0.5, 1.0);
  envColor = mix(envColor, vec3(1.0, 0.3, 0.5), bass * 0.4); // Pink tint on bass
  result += result * pow(fresnel, 4.0) * envColor * 1.5;

  // Gamma correction
  result = sqrt(clamp(result, 0.0, 1.0));


  outColor = vec4(result, 1.0);
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
		if (!CSS.supports('color', color)) throw new Error(`Invalid Chrome color: ${color}`);
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

type ChromeFrame = Required<ChromeOptions> & {readonly time: number; readonly bars: number[]};
type ChromeState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly audioTexture: WebGLTexture;
	readonly imageTexture: WebGLTexture | null;
	imageLoaded: boolean;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupChrome(canvas: HTMLCanvasElement): ChromeState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Chrome requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Chrome could not create a program.');
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
			if (!shader) throw new Error('Chrome could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Chrome shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Chrome shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Chrome could not create a vertex buffer.');
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
		if (!audioTexture) throw new Error('Chrome could not create an audio texture.');
		imageTexture = gl.createTexture();
		if (!imageTexture) throw new Error('Chrome could not create an image texture.');
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
					'iColor3',
					'iTextureScale',
					'iTextureBlend',
					'iWarpIntensity',
					'iWarpSpeed',
					'iColorCycle',
					'iBumpStrength',
					'iSpecularPower',
					'iResponsive',
					'iLightMovement',
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
function drawChrome(state: ChromeState, frame: ChromeFrame) {
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
	gl.uniform3fv(uniforms.iColor3, linearColor(frame.color3));
	gl.uniform1f(uniforms.iTextureScale, bounded(frame.textureScale, 0.5, 10, 1));
	gl.uniform1f(uniforms.iTextureBlend, bounded(frame.textureBlend, 0, 1, 0.5));
	gl.uniform1f(uniforms.iWarpIntensity, bounded(frame.warpIntensity, 0.1, 3, 1));
	gl.uniform1f(uniforms.iWarpSpeed, bounded(frame.warpSpeed, 0.1, 3, 1));
	gl.uniform1f(uniforms.iColorCycle, bounded(frame.colorCycle, 0, 2, 0.5));
	gl.uniform1f(uniforms.iBumpStrength, bounded(frame.bumpStrength, 0.01, 0.15, 0.05));
	gl.uniform1f(uniforms.iSpecularPower, bounded(frame.specularPower, 4, 32, 12));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 10, 2));
	gl.uniform1f(uniforms.iLightMovement, bounded(frame.lightMovement, 0, 2, 1));
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
	if (error !== gl.NO_ERROR) throw new Error('Chrome WebGL draw failed: ' + error);
}
function cleanupChrome({gl, program, buffer, audioTexture, imageTexture}: ChromeState) {
	gl.deleteTexture(audioTexture);
	gl.deleteTexture(imageTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function ChromeCanvas(frame: ChromeFrame) {
	const latestFrame = useRef(frame);
	latestFrame.current = frame;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<ChromeState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupChrome(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Chrome WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupChrome(current);
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
		const handle = delayRender('Loading Chrome texture');
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
				drawChrome(current, latestFrame.current);
			} catch (error) {
				cancelRender(error);
			} finally {
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (active) {
				continueRender(handle);
				cancelRender(new Error('Chrome could not load texture: ' + latestFrame.current.textureSrc));
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
		const handle = delayRender('Drawing Chrome');
		try {
			drawChrome(state.current, frame);
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
const ChromeContent: React.FC<Required<ChromeOptions> & {width: number; height: number}> = (
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
			<ChromeCanvas {...props} time={time} bars={bars} />
		</>
	);
};

const ChromeInner: React.FC<ChromeProps> = ({
	audioSrc = chromeSchema.audioSrc.default,
	audioOffsetInSeconds = chromeSchema.audioOffsetInSeconds.default,
	playAudio = chromeSchema.playAudio.default,
	inputGainDb = chromeSchema.inputGainDb.default,
	color1 = chromeSchema.color1.default,
	color2 = chromeSchema.color2.default,
	color3 = chromeSchema.color3.default,
	textureSrc = chromeSchema.textureSrc.default,
	textureScale = chromeSchema.textureScale.default,
	textureBlend = chromeSchema.textureBlend.default,
	warpIntensity = chromeSchema.warpIntensity.default,
	warpSpeed = chromeSchema.warpSpeed.default,
	colorCycle = chromeSchema.colorCycle.default,
	bumpStrength = chromeSchema.bumpStrength.default,
	specularPower = chromeSchema.specularPower.default,
	responsive = chromeSchema.responsive.default,
	lightMovement = chromeSchema.lightMovement.default,
	bpm = chromeSchema.bpm.default,
	timeOffsetInSeconds = chromeSchema.timeOffsetInSeconds.default,
}) => {
	const {width, height} = useVideoConfig();
	const drawingWidth = Math.round(bounded(width, 16, 3840, 1280)),
		drawingHeight = Math.round(bounded(height, 16, 3840, 720));
	return (
		<div
			style={{
				position: 'relative',
				boxSizing: 'border-box',
				width: drawingWidth,
				height: drawingHeight,
				overflow: 'hidden',
			}}
		>
			<ChromeContent
				key={audioSrc}
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={playAudio}
				inputGainDb={inputGainDb}
				color1={color1}
				color2={color2}
				color3={color3}
				textureSrc={textureSrc}
				textureScale={textureScale}
				textureBlend={textureBlend}
				warpIntensity={warpIntensity}
				warpSpeed={warpSpeed}
				colorCycle={colorCycle}
				bumpStrength={bumpStrength}
				specularPower={specularPower}
				responsive={responsive}
				lightMovement={lightMovement}
				bpm={bpm}
				timeOffsetInSeconds={timeOffsetInSeconds}
				width={drawingWidth}
				height={drawingHeight}
			/>
		</div>
	);
};
export const Chrome = Interactive.create({
	Component: ChromeInner,
	layout: 'absolute-fill',
	componentName: '<Chrome>',
	schema: chromeSchema,
});
