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

type NeuronOptions = {
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
	readonly scale?: number;
	readonly thickness?: number;
	readonly reflection?: number;
	readonly fog?: number;
	readonly responsive?: number;
	readonly cameraMovement?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};
type NeuronProps = Omit<NeuronOptions, 'width' | 'height'>;
const neuronSchema = {
	audioSrc: {
		type: 'asset',
		assetType: 'audio',
		default: 'https://banger-elements.dev/audio/tracks/banger-demo-song.mp3',
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
	color1: {type: 'color', default: '#3b82f6', description: 'Color 1'},
	color2: {type: 'color', default: '#f97316', description: 'Color 2'},
	glowColor: {type: 'color', default: '#ec4899', description: 'Glow Color'},
	speed: {
		type: 'number',
		default: 0.5,
		min: 0.1,
		max: 25,
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
	thickness: {
		type: 'number',
		default: 1,
		min: 0.5,
		max: 1.3,
		step: 0.01,
		hiddenFromList: false,
		description: 'Thickness',
	},
	reflection: {
		type: 'number',
		default: 0.5,
		min: 0,
		max: 1,
		step: 0.1,
		hiddenFromList: false,
		description: 'Reflection',
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
	responsive: {
		type: 'number',
		default: 2,
		min: 0,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
		description: 'Audio Reactivity',
	},
	cameraMovement: {
		type: 'number',
		default: 2.5,
		min: 0,
		max: 5,
		step: 0.1,
		hiddenFromList: false,
		description: 'Camera Movement',
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
		const handle = delayRender('Waiting for complete Neuron audio history');
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

uniform vec3 iColor1;
uniform vec3 iColor2;
uniform vec3 iGlowColor;
uniform float iSpeed;
uniform float iScale;
uniform float iThickness;
uniform float iReflection;
uniform float iFog;
uniform float iResponsive;
uniform float iCameraMovement;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

#define FAR_DIST 30.0
#define TAU 3.14159265

int materialId = 0;

float getFreq(float x) {
  return texture(iSoundTexture, vec2(clamp(x, 0.0, 1.0), 0.5)).r * iResponsive;
}

mat2 rot2d(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

mat3 lookAtDir(vec3 dir) {
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 rt = normalize(cross(dir, up));
  return mat3(rt, cross(rt, dir), dir);
}

float gyroidField(vec3 p) {
  return dot(cos(p * iScale), sin(p.zxy * iScale)) + iThickness;
}

float sceneMap(vec3 p, float bassOffset) {
  float result = 1e5;
  float d;

  d = gyroidField(p) + bassOffset;
  if (d < result) { result = d; materialId = 1; }

  d = gyroidField(p - vec3(0.0, 0.0, TAU / iScale)) + bassOffset;
  if (d < result) { result = d; materialId = 2; }

  return result;
}

float march(vec3 ro, vec3 rd, float bassOffset) {
  float t = 0.0;
  for (int i = 0; i < 150; i++) {
    float d = sceneMap(ro + rd * t, bassOffset);
    if (abs(d) < 0.001) break;
    t += d;
    if (t > FAR_DIST) break;
  }
  return t;
}

float calcAO(vec3 p, vec3 n, float bassOffset) {
  float occ = 0.0;
  for (float i = 0.0; i < 4.0; i++) {
    float h = i * 0.08;
    float d = sceneMap(p + n * h, bassOffset);
    occ += h - d;
  }
  return clamp(1.0 - occ, 0.0, 1.0);
}

vec3 calcNormal(vec3 p, float bassOffset) {
  vec2 e = vec2(0.5773, -0.5773) * 0.001;
  return normalize(
    e.xyy * sceneMap(p + e.xyy, bassOffset) +
    e.yyx * sceneMap(p + e.yyx, bassOffset) +
    e.yxy * sceneMap(p + e.yxy, bassOffset) +
    e.xxx * sceneMap(p + e.xxx, bassOffset)
  );
}

float synapseSpark(vec3 p, float time) {
  vec3 cellId = floor(p * 3.0);
  vec3 cellUv = fract(p * 3.0) - 0.5;

  float hash = fract(sin(dot(cellId, vec3(127.1, 311.7, 74.7))) * 43758.5453);

  float freqBand = hash;
  float freq = getFreq(freqBand);

  float threshold = 0.4 + hash * 0.3;
  float spark = smoothstep(threshold, threshold + 0.1, freq);

  float dist = length(cellUv);
  spark *= smoothstep(0.5, 0.0, dist);

  return spark;
}

float pulseWave(vec3 p, float time, float freq) {
  float wave = sin(p.z * 2.0 - time * 3.0 + freq * 10.0);
  wave = smoothstep(0.7, 1.0, wave);
  return wave * freq;
}

vec3 traceScene(vec3 ro, vec3 rd, float bass, float mids, float highs) {
  vec3 accum = vec3(0.0);
  vec3 throughput = vec3(1.0);

  float bassOffset = 0.15;
  float time = iGlobalTime;

  for (int bounce = 0; bounce < 2; bounce++) {
    float d = march(ro, rd, bassOffset);
    if (d > FAR_DIST) break;

    float fog = 1.0 - exp(-0.008 * d * d * iFog);
    accum += throughput * fog * vec3(0.0);
    throughput *= 1.0 - fog;

    vec3 p = ro + rd * d;
    vec3 n = calcNormal(p, bassOffset);

    float freqLow = getFreq(0.1);
    float freqMid = getFreq(0.4);
    float freqHigh = getFreq(0.8);

    float posFreq = getFreq(fract(p.z * 0.05));
    float posFreq2 = getFreq(fract(p.x * 0.03 + 0.5));

    float depthNorm = clamp(d / FAR_DIST, 0.0, 1.0);
    float depthFreq = getFreq(1.0 - depthNorm);

    float detailAmt = 0.1 + highs * 0.05 + posFreq * 0.03;
    n = normalize(n + pow(abs(cos(p * 64.0)), vec3(16.0)) * detailAmt);

    vec3 lightPos1 = vec3(10.0, -10.0, -10.0 + ro.z);
    vec3 lightPos2 = vec3(-8.0, 8.0, -5.0 + ro.z);
    vec3 lightPos3 = vec3(0.0, -12.0, -8.0 + ro.z);

    vec3 lightDir1 = normalize(lightPos1 - p);
    vec3 lightDir2 = normalize(lightPos2 - p);
    vec3 lightDir3 = normalize(lightPos3 - p);

    float diff1 = max(0.0, dot(n, lightDir1));
    float diff2 = max(0.0, dot(n, lightDir2));
    float diff3 = max(0.0, dot(n, lightDir3));

    float intensity1 = 0.5 + freqLow * 1.5;
    float intensity2 = 0.3 + freqMid * 1.2;
    float intensity3 = 0.2 + freqHigh * 1.0;

    vec3 lightCol1 = vec3(1.0, 0.6, 0.3) * intensity1;
    vec3 lightCol2 = vec3(0.3, 0.6, 1.0) * intensity2;
    vec3 lightCol3 = vec3(1.0, 0.3, 0.8) * intensity3;

    float spec = max(0.0, dot(reflect(-lightDir1, n), -rd));
    float fres = 1.0 - max(0.0, dot(-rd, n));
    fres *= 1.0 + depthFreq * 0.3;

    vec3 col = vec3(0.0);
    vec3 alb = vec3(0.0);

    col += lightCol1 * diff1;
    col += lightCol2 * diff2;
    col += lightCol3 * diff3;
    col += vec3(0.3, 0.25, 0.25) * pow(spec, 4.0) * 8.0;

    float spark = synapseSpark(p, time);
    vec3 sparkColor = mix(iColor1, iGlowColor, 0.5);
    col += sparkColor * spark * 3.0;

    float bassPulse = pulseWave(p, time, freqLow);
    col += iColor1 * bassPulse * 0.4;

    float highPulse = pulseWave(p * 2.0, time * 2.0, freqHigh);
    col += iGlowColor * highPulse * 0.3;

    float surfaceFreq = getFreq(fract(length(p.xy) * 0.1));
    float glowMask = smoothstep(0.3, 0.6, surfaceFreq);

    float freck = dot(cos(p * 23.0), vec3(1.0));

    if (materialId == 1) {
      alb = iColor1;
      alb *= max(0.6, step(2.5, freck) + posFreq * 0.4);
      alb += iGlowColor * glowMask * 0.15;
    }
    if (materialId == 2) {
      alb = iColor2;
      alb *= max(0.8, step(-2.5, freck) + posFreq2 * 0.4);
      alb += iGlowColor * glowMask * 0.15;
    }

    col *= alb;
    col *= calcAO(p, n, bassOffset);

    vec3 rimColor = mix(iColor1, iGlowColor, freqHigh);
    rimColor = mix(rimColor, iColor2, freqLow * 0.5);
    col += rimColor * pow(fres, 3.0) * (0.25 + depthFreq * 0.2);

    col += iGlowColor * depthFreq * 0.1;

    accum += throughput * col;

    rd = reflect(rd, n);
    ro = p + n * 0.01;
    throughput *= iReflection * pow(fres, 1.0);
  }

  return accum;
}

void main() {
  vec2 fragCoord = vUv * iResolution;
  vec2 uv = (fragCoord - iResolution * 0.5) / iResolution.y;

  float t = iGlobalTime;

  float bass = iLowFreq * iResponsive;
  float mids = iMidFreq * iResponsive;
  float highs = iHighFreq * iResponsive;

  vec2 centerOffset = vec2(1.5, 0.1) / iScale;

  float camMove = iCameraMovement;
  float speedMult = 0.5 + iSpeed * 0.5;
  float sway = sin(t * 0.3 * speedMult) * 0.15 * camMove;
  float drift = cos(t * 0.2 * speedMult) * 0.1 * camMove;
  float vertBob = sin(t * 0.4 * speedMult) * 0.08 * camMove + cos(t * 0.25 * speedMult) * 0.05 * camMove;

  vec3 ro = vec3(centerOffset.x + sway, centerOffset.y + drift + vertBob, -t * iSpeed);
  vec3 rd = normalize(vec3(uv, -1.0));

  float tilt = sin(t * 0.25 * speedMult) * 0.04 * camMove;
  float roll = cos(t * 0.15 * speedMult) * 0.03 * camMove;
  float pitch = sin(t * 0.18 * speedMult) * 0.025 * camMove;

  float bassWobble = 0.02 * camMove;

  rd.xy *= rot2d(tilt + bassWobble);
  rd.xz *= rot2d(roll);
  rd.yz *= rot2d(pitch);

  vec3 col = traceScene(ro, rd, bass, mids, highs);

  col *= smoothstep(0.0, 1.0, 1.2 - length(uv * 0.9));

  col = pow(clamp(col, 0.0, 1.0), vec3(0.4545));


  outColor = vec4(col, 1.0);
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
		if (!CSS.supports('color', color)) throw new Error(`Invalid Neuron color: ${color}`);
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

type NeuronFrame = Required<NeuronOptions> & {readonly time: number; readonly bars: number[]};
type NeuronState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly audioTexture: WebGLTexture;
	readonly imageTexture: WebGLTexture | null;
	imageLoaded: boolean;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupNeuron(canvas: HTMLCanvasElement): NeuronState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
	});
	if (!gl)
		throw new Error(
			'Neuron requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Neuron could not create a program.');
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
			if (!shader) throw new Error('Neuron could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Neuron shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Neuron shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Neuron could not create a vertex buffer.');
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
		if (!audioTexture) throw new Error('Neuron could not create an audio texture.');

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
					'iThickness',
					'iReflection',
					'iFog',
					'iResponsive',
					'iCameraMovement',
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
function drawNeuron(state: NeuronState, frame: NeuronFrame) {
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
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 25, 0.5));
	gl.uniform1f(uniforms.iScale, bounded(frame.scale, 0.5, 3, 1));
	gl.uniform1f(uniforms.iThickness, bounded(frame.thickness, 0.5, 1.3, 1));
	gl.uniform1f(uniforms.iReflection, bounded(frame.reflection, 0, 1, 0.5));
	gl.uniform1f(uniforms.iFog, bounded(frame.fog, 0, 2, 0.5));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 10, 2));
	gl.uniform1f(uniforms.iCameraMovement, bounded(frame.cameraMovement, 0, 5, 2.5));
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
	if (error !== gl.NO_ERROR) throw new Error('Neuron WebGL draw failed: ' + error);
}
function cleanupNeuron({gl, program, buffer, audioTexture, imageTexture}: NeuronState) {
	gl.deleteTexture(audioTexture);
	gl.deleteTexture(imageTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function NeuronCanvas(frame: NeuronFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<NeuronState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupNeuron(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Neuron WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupNeuron(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Neuron');
		try {
			drawNeuron(state.current, frame);
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
const NeuronContent: React.FC<Required<NeuronOptions> & {width: number; height: number}> = (
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
			<NeuronCanvas {...props} time={time} bars={bars} />
		</>
	);
};

const NeuronInner: React.FC<NeuronProps> = ({
	audioSrc = neuronSchema.audioSrc.default,
	audioOffsetInSeconds = neuronSchema.audioOffsetInSeconds.default,
	playAudio = neuronSchema.playAudio.default,
	inputGainDb = neuronSchema.inputGainDb.default,
	color1 = neuronSchema.color1.default,
	color2 = neuronSchema.color2.default,
	glowColor = neuronSchema.glowColor.default,
	speed = neuronSchema.speed.default,
	scale = neuronSchema.scale.default,
	thickness = neuronSchema.thickness.default,
	reflection = neuronSchema.reflection.default,
	fog = neuronSchema.fog.default,
	responsive = neuronSchema.responsive.default,
	cameraMovement = neuronSchema.cameraMovement.default,
	bpm = neuronSchema.bpm.default,
	timeOffsetInSeconds = neuronSchema.timeOffsetInSeconds.default,
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
			<NeuronContent
				key={audioSrc}
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={playAudio}
				inputGainDb={inputGainDb}
				color1={color1}
				color2={color2}
				glowColor={glowColor}
				speed={speed}
				scale={scale}
				thickness={thickness}
				reflection={reflection}
				fog={fog}
				responsive={responsive}
				cameraMovement={cameraMovement}
				bpm={bpm}
				timeOffsetInSeconds={timeOffsetInSeconds}
				width={drawingWidth}
				height={drawingHeight}
			/>
		</div>
	);
};
export const Neuron = Interactive.create({
	Component: NeuronInner,
	layout: 'absolute-fill',
	componentName: '<Neuron>',
	schema: neuronSchema,
});
