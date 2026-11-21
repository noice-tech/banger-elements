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

type LiquidOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly color1?: string;
	readonly color2?: string;
	readonly glowColor?: string;
	readonly speed?: number;
	readonly swirl?: number;
	readonly distortion?: number;
	readonly tunnelRadius?: number;
	readonly responsive?: number;
	readonly fog?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};
type LiquidProps = InteractiveBaseProps & InteractiveTransformProps & LiquidOptions;
const liquidSchema = {
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
	color1: {type: 'color', default: '#1e00ff', description: 'Color 1'},
	color2: {type: 'color', default: '#73ff00', description: 'Color 2'},
	glowColor: {type: 'color', default: '#d6d6d6', description: 'Glow Color'},
	speed: {
		type: 'number',
		default: 0.5,
		min: 0.1,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Speed',
	},
	swirl: {
		type: 'number',
		default: 1,
		min: 0,
		max: 3,
		step: 0.1,
		hiddenFromList: false,
		description: 'Swirl',
	},
	distortion: {
		type: 'number',
		default: 0.3,
		min: 0,
		max: 1.5,
		step: 0.1,
		hiddenFromList: false,
		description: 'Distortion',
	},
	tunnelRadius: {
		type: 'number',
		default: 2,
		min: 1,
		max: 5,
		step: 0.5,
		hiddenFromList: false,
		description: 'Tunnel Size',
	},
	responsive: {
		type: 'number',
		default: 0,
		min: 0,
		max: 2,
		step: 0.01,
		hiddenFromList: false,
		description: 'Audio Reactivity',
	},
	fog: {
		type: 'number',
		default: 0.5,
		min: 0,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Fog',
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
		const handle = delayRender('Waiting for complete Liquid audio history');
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

uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;

uniform float iSpeed;
uniform float iSwirl;
uniform float iDistortion;
uniform float iTunnelRadius;
uniform float iResponsive;
uniform float iFog;

uniform vec3 iColor1;
uniform vec3 iColor2;
uniform vec3 iGlowColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

// Spiral transform
vec2 spiralWarp(vec2 pt, float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return vec2(pt.x * c - pt.y * s, pt.x * s + pt.y * c);
}

// Filmic contrast curve
vec3 filmicCurve(vec3 col) {
  vec3 x = col * (col + 0.028) - 0.00012;
  vec3 y = col * (0.97 * col + 0.45) + 0.25;
  return x / y;
}

// Turbulent field for liquid distortion
float turbulentField(vec3 q) {
  const float EULER = 2.718281828;
  vec3 q1 = vec3(
    dot(q, vec3(-0.612, 0.784, 0.105)),
    dot(q, vec3(-0.315, -0.267, 0.891)),
    dot(q, vec3(0.728, 0.561, 0.445))
  );
  return dot(cos(q1 * 1.1), sin(EULER * q * 1.3));
}

// Sample spectrum as a ribbon pattern - radial bands colored by frequency
vec3 spectrumRibbons(vec3 p, float time) {
  // Radial angle determines which frequency band we sample
  float angle = atan(p.y, p.x);
  float normalizedAngle = (angle + 3.14159) / 6.28318; // 0-1

  // Flow the ribbons through the tunnel - FASTER
  float flowOffset = p.z * 0.15 + time * 0.1;
  float ribbonDist = abs(fract(normalizedAngle * 16.0 + flowOffset * 3.0) - 0.5);

  // Sample MORE ribbon bands for richer effect
  vec3 ribbonCol = vec3(0.0);
  for (float i = 0.0; i < 16.0; i++) {
    float bandAngle = fract(normalizedAngle + i / 16.0 + flowOffset);

    // Sample raw sound texture - CRANKED
    float amplitude = texture(iSoundTexture, vec2(bandAngle, 0.5)).r * iResponsive * 2.5;

    // Lower threshold to show more
    if (amplitude < 0.08) continue;

    // Wider ribbons based on amplitude
    float ribbonWidth = 0.05 + amplitude * 0.15;
    if (ribbonDist >= ribbonWidth) continue;
    float ribbon = smoothstep(ribbonWidth, 0.0, ribbonDist);

    // More vibrant colors
    vec3 bandColor = mix(iColor1, iColor2, bandAngle);
    bandColor = mix(bandColor, iGlowColor, amplitude * 0.8);
    bandColor = mix(bandColor, vec3(1.0, 0.2, 0.5), i / 16.0 * 0.3); // Pink tint

    // Square amplitude for punch
    ribbonCol += bandColor * ribbon * amplitude * amplitude * 4.0;
  }

  return ribbonCol;
}

// Spectrum-driven distortion field - samples texture to modulate turbulence
float spectrumDistortion(vec3 p, float time, float radius) {
  // Sample spectrum at MULTIPLE positions for richer effect
  float depthSample = fract(p.z * 0.08 + time * 0.04);
  float radialSample = fract(radius * 0.5);
  float angleSample = fract(atan(p.y, p.x) / 6.28318 + time * 0.02);

  // Get raw amplitudes from different parts of the spectrum - CRANKED
  float depthAmp = texture(iSoundTexture, vec2(depthSample, 0.5)).r;
  float radialAmp = texture(iSoundTexture, vec2(radialSample, 0.5)).r;
  float angleAmp = texture(iSoundTexture, vec2(angleSample, 0.5)).r;

  // Combine for complex distortion pattern - stronger effect
  float combined = (depthAmp + radialAmp + angleAmp) / 3.0;
  return combined * combined * iResponsive * 2.5; // Squared for punch
}

void main() {
  vec2 fragCoord = vUv * iResolution;
  vec2 uv = (2.0 * fragCoord - iResolution) / iResolution.y;

  float t = iGlobalTime * iSpeed;
  float bass = iLowFreq * iResponsive;
  float mids = iMidFreq * iResponsive;
  float highs = iHighFreq * iResponsive;

  // March origin through the void
  vec3 marchPos = vec3(0.0, 0.0, t);
  vec3 marchDir = normalize(vec3(uv, 1.0));

  // Light accumulation
  vec3 glow = vec3(0.0);

  // Swirl and distortion (no audio reactivity on movement)
  float swirlAmount = iSwirl;
  float distortAmount = iDistortion;

  // 12-step march through liquid space
  for (float step = 0.0; step < 12.0; step += 1.0) {
    vec3 p = marchPos;
    float radius = length(p.xy);

    // Get spectrum-driven distortion at this position - MORE INTENSE
    float specDist = spectrumDistortion(p, t, radius);

    // Liquid spiral warp - swirl CRANKED with spectrum
    vec2 warped = p.xy;
    float swirlAngle = t * 1.4 * swirlAmount + p.z * 2.8 * swirlAmount;
    swirlAngle += specDist * 3.0; // DOUBLED spectrum swirl effect
    warped = spiralWarp(sin(warped), swirlAngle);
    vec3 sampleP = vec3(warped, p.z);

    // Dual-layer turbulence - STRONGER spectrum modulation
    float turbMod = distortAmount * (1.0 + specDist * 1.5);
    float turb1 = turbulentField(sampleP * 11.0 * turbMod) / 11.0;
    float turb2 = turbulentField(sampleP * turbMod * 0.9);
    float separation = 0.0015 + abs(turb1 - turb2 * 0.35);

    // Void boundary - spectrum PULSES the tunnel radius more
    float dynamicRadius = iTunnelRadius * (1.0 + specDist * 0.6);
    separation = max(separation, dynamicRadius - radius);

    // Undulating wave - spectrum adds BIGGER ripples
    float waveAmp = 0.18 + specDist * 0.3;
    separation += abs(p.y * 0.7 + sin(p.z + t * 0.12 + p.x * 1.4)) * waveAmp;

    // Step forward
    marchPos += marchDir * separation;

    // === SPECTRUM RIBBONS - CRANKED ===
    vec3 ribbons = spectrumRibbons(p, t);

    // Chromatic layering with STRONGER spectrum influence
    float angle = step * 0.5 + p.z * 0.3 + radius * 2.0 + bass * 0.5;

    // Sample spectrum at MULTIPLE depths for color modulation
    float depthFreq = texture(iSoundTexture, vec2(fract(p.z * 0.08), 0.5)).r * iResponsive;
    float depthFreq2 = texture(iSoundTexture, vec2(fract(p.z * 0.12 + 0.3), 0.5)).r * iResponsive;
    float radialFreq = texture(iSoundTexture, vec2(fract(radius * 0.2), 0.5)).r * iResponsive;

    // Combined frequency effect - CRANKED
    float totalFreq = (depthFreq + depthFreq2 + radialFreq) * 1.2;

    // Three-way blend weights - spectrum DOMINATES the phase
    float w1 = max(0.0, sin(angle + totalFreq * 4.0));
    float w2 = max(0.0, sin(angle + 2.094 + totalFreq * 2.0));
    float w3 = max(0.0, sin(angle + 4.188 - totalFreq));
    float wSum = w1 + w2 + w3 + 0.001;

    // Normalize and mix all three colors
    vec3 tint = (iColor1 * w1 + iColor2 * w2 + iGlowColor * w3) / wSum;

    // STRONGER spectrum brightness boost
    tint *= 1.0 + totalFreq * 1.0;

    // Bass boosts glow color intensity MORE
    tint = mix(tint, iGlowColor, bass * 0.2);

    // High frequency shimmer - CRANKED
    tint += iGlowColor * highs * 0.15;

    // Add spectrum ribbons - MORE INTENSE
    tint += ribbons * 0.8;

    // Inverse-distance glow buildup
    glow += tint / separation;
  }

  // Normalize intensity with filmic response
  vec3 result = filmicCurve(glow * glow / 850.0);

  // Contrast lift
  result = pow(result, vec3(1.08));

  // === SPECTRUM WAVEFORM OVERLAY - CRANKED ===
  // Draw the actual waveform as INTENSE glowing lines across the screen
  float waveformY = uv.y;
  for (float i = 0.0; i < 64.0; i++) {
    float freqX = i / 64.0;
    float amplitude = texture(iSoundTexture, vec2(freqX, 0.5)).r * iResponsive * 2.0;

    // Map frequency position to screen x - FULL WIDTH
    float screenX = freqX * 5.0 - 2.5;
    float distToLine = abs(uv.x - screenX);

    // Waveform displacement - amplitude pushes the line up/down MORE
    float waveY = amplitude * 2.0 - 1.0;
    float distToWave = abs(waveformY - waveY);

    // BIGGER glow around the waveform point
    float waveGlow = exp(-distToLine * 15.0 - distToWave * 5.0);
    waveGlow *= amplitude * amplitude * 5.0;

    // Color based on frequency with more variation
    vec3 waveColor = mix(iColor1, iGlowColor, freqX);
    waveColor = mix(waveColor, iColor2, sin(freqX * 6.28) * 0.5 + 0.5);
    waveColor = mix(waveColor, vec3(1.0, 0.3, 0.6), amplitude * 0.3);

    result += waveColor * waveGlow * 0.25;
  }

  // === RADIAL SPECTRUM BURST ===
  // Spectrum as rays emanating from center
  float screenAngle = atan(uv.y, uv.x);
  float normalizedScreenAngle = (screenAngle + 3.14159) / 6.28318;
  float screenRadius = length(uv);

  for (float ray = 0.0; ray < 24.0; ray++) {
    float rayAngle = ray / 24.0;
    float rayAmp = texture(iSoundTexture, vec2(rayAngle, 0.5)).r * iResponsive * 2.0;

    // Ray direction
    float angleDiff = abs(fract(normalizedScreenAngle - rayAngle + 0.5) - 0.5);
    float rayWidth = 0.02 + rayAmp * 0.03;
    float inRay = smoothstep(rayWidth, 0.0, angleDiff);

    // Ray length based on amplitude
    float rayLength = rayAmp * 1.5;
    float inLength = smoothstep(rayLength, 0.0, screenRadius - 0.3);

    // Color
    vec3 rayColor = mix(iColor2, iGlowColor, rayAngle);
    rayColor = mix(rayColor, vec3(1.0, 0.5, 0.2), rayAmp * 0.4);

    result += rayColor * inRay * inLength * rayAmp * 0.3;
  }

  // Depth haze
  float haze = 1.0 - exp(-length(marchPos - vec3(0.0, 0.0, t)) * iFog * 0.012);
  vec3 hazeCol = mix(iColor1, iColor2, 0.5) * 0.04;
  result = mix(result, hazeCol, haze * 0.28);

  // Bass brightness surge - CRANKED
  result *= 1.0 + bass * 0.25;

  // Saturation enhancement - MORE VIBRANT
  float luma = dot(result, vec3(0.299, 0.587, 0.114));
  result = mix(vec3(luma), result, 1.5);

  result = clamp(result, 0.0, 1.0);


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
		if (!CSS.supports('color', color)) throw new Error(`Invalid Liquid color: ${color}`);
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

type LiquidFrame = Required<LiquidOptions> & {readonly time: number; readonly bars: number[]};
type LiquidState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly audioTexture: WebGLTexture;
	readonly imageTexture: WebGLTexture | null;
	imageLoaded: boolean;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupLiquid(canvas: HTMLCanvasElement): LiquidState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
	});
	if (!gl)
		throw new Error(
			'Liquid requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Liquid could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let audioTexture: WebGLTexture | null = null;
	const imageTexture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Liquid could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Liquid shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Liquid shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Liquid could not create a vertex buffer.');
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
		if (!audioTexture) throw new Error('Liquid could not create an audio texture.');

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
					'iSwirl',
					'iDistortion',
					'iTunnelRadius',
					'iResponsive',
					'iFog',
					'iBpm',
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
function drawLiquid(state: LiquidState, frame: LiquidFrame) {
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
	gl.uniform1f(uniforms.iSwirl, bounded(frame.swirl, 0, 3, 1));
	gl.uniform1f(uniforms.iDistortion, bounded(frame.distortion, 0, 1.5, 0.3));
	gl.uniform1f(uniforms.iTunnelRadius, bounded(frame.tunnelRadius, 1, 5, 2));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 2, 0));
	gl.uniform1f(uniforms.iFog, bounded(frame.fog, 0, 2, 0.5));
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

	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error('Liquid WebGL draw failed: ' + error);
}
function cleanupLiquid({gl, program, buffer, audioTexture, imageTexture}: LiquidState) {
	gl.deleteTexture(audioTexture);
	gl.deleteTexture(imageTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function LiquidCanvas(frame: LiquidFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<LiquidState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupLiquid(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Liquid WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupLiquid(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Liquid');
		try {
			drawLiquid(state.current, frame);
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
const LiquidContent: React.FC<Required<LiquidOptions> & {width: number; height: number}> = (
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
			<LiquidCanvas {...props} time={time} bars={bars} />
		</>
	);
};

const LiquidInner = forwardRef<
	HTMLDivElement,
	LiquidProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			audioSrc = liquidSchema.audioSrc.default,
			audioOffsetInSeconds = liquidSchema.audioOffsetInSeconds.default,
			playAudio = liquidSchema.playAudio.default,
			inputGainDb = liquidSchema.inputGainDb.default,
			color1 = liquidSchema.color1.default,
			color2 = liquidSchema.color2.default,
			glowColor = liquidSchema.glowColor.default,
			speed = liquidSchema.speed.default,
			swirl = liquidSchema.swirl.default,
			distortion = liquidSchema.distortion.default,
			tunnelRadius = liquidSchema.tunnelRadius.default,
			responsive = liquidSchema.responsive.default,
			fog = liquidSchema.fog.default,
			bpm = liquidSchema.bpm.default,
			timeOffsetInSeconds = liquidSchema.timeOffsetInSeconds.default,
			width = liquidSchema.width.default,
			height = liquidSchema.height.default,
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
				name={name ?? 'Liquid'}
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
					<LiquidContent
						key={audioSrc}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						color1={color1}
						color2={color2}
						glowColor={glowColor}
						speed={speed}
						swirl={swirl}
						distortion={distortion}
						tunnelRadius={tunnelRadius}
						responsive={responsive}
						fog={fog}
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
export const Liquid = Interactive.withSchema({
	Component: LiquidInner,
	componentName: '<Liquid>',
	componentIdentity: null,
	schema: liquidSchema,
	supportsEffects: false,
}) as React.FC<LiquidProps>;
