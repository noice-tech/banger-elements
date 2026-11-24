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

type RooftopOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly skyColor?: string;
	readonly buildingColor?: string;
	readonly streetColor?: string;
	readonly lightColor?: string;
	readonly cameraHeight?: number;
	readonly gridDensity?: number;
	readonly carDensity?: number;
	readonly responsive?: number;
	readonly speed?: number;
	readonly fog?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};
type RooftopProps = Omit<RooftopOptions, 'width' | 'height'>;
const rooftopSchema = {
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
	skyColor: {type: 'color', default: '#0a0a1a', description: 'Atmosphere Color'},
	buildingColor: {type: 'color', default: '#1a1a2e', description: 'Boxes Color'},
	streetColor: {type: 'color', default: '#0d0d15', description: 'Lines Color'},
	lightColor: {type: 'color', default: '#ffaa44', description: 'Light Color'},
	cameraHeight: {
		type: 'number',
		default: 3,
		min: 1,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
		description: 'Camera Height',
	},
	gridDensity: {
		type: 'number',
		default: 2,
		min: 1,
		max: 5,
		step: 0.5,
		hiddenFromList: false,
		description: 'Grid Density',
	},
	carDensity: {
		type: 'number',
		default: 25,
		min: 0,
		max: 50,
		step: 5,
		hiddenFromList: false,
		description: 'Lights Density',
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
	speed: {
		type: 'number',
		default: 1,
		min: 0.1,
		max: 3,
		step: 0.1,
		hiddenFromList: false,
		description: 'Speed',
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
		const handle = delayRender('Waiting for complete Rooftop audio history');
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

uniform float iCameraHeight;
uniform float iGridDensity;
uniform float iCarDensity;
uniform float iResponsive;
uniform float iSpeed;
uniform float iFog;

uniform vec3 iSkyColor;
uniform vec3 iBuildingColor;
uniform vec3 iStreetColor;
uniform vec3 iLightColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash1(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  f += 0.5 * noise(p); p *= 2.01;
  f += 0.25 * noise(p); p *= 2.02;
  f += 0.125 * noise(p);
  return f;
}

float buildingHeight(vec2 id) {
  float h = hash(id);
  h = pow(h, 0.7);
  float variation = noise(id * 0.5) * 0.3;
  return h * 0.6 + variation + 0.1;
}

float rooftopDetail(vec2 uv, vec2 clipId) {
  float detail = 0.0;
  float h = hash(clipId);

  vec2 acPos = vec2(0.3 + h * 0.4, 0.3 + fract(h * 7.0) * 0.4);
  float acSize = 0.08 + h * 0.05;
  float ac = smoothstep(acSize, acSize - 0.02, length(uv - acPos));
  detail += ac * 0.3;

  if (h > 0.5) {
    vec2 tankPos = vec2(0.7, 0.6);
    float tank = smoothstep(0.06, 0.04, length(uv - tankPos));
    detail += tank * 0.25;
  }

  return detail;
}

// Street wet reflection of sound texture
vec3 streetSpectrumReflection(vec2 streetUV, float time) {
  vec3 col = vec3(0.0);

  // Sample multiple points across the spectrum for richer effect
  for (float i = 0.0; i < 8.0; i++) {
    float offset = i / 8.0;
    float sampleX = fract(streetUV.x * 0.3 + offset + time * 0.1);

    // Get raw amplitude - cranked up
    float amplitude = texture(iSoundTexture, vec2(sampleX, 0.5)).r * iResponsive * 3.0;

    // Color varies across spectrum bands
    vec3 bandColor = mix(iStreetColor, iLightColor, sampleX);
    bandColor = mix(bandColor, vec3(1.0, 0.3, 0.5), offset * 0.3);

    // Intensity based on amplitude
    float intensity = amplitude * 1.5;

    // Shimmer effect
    float shimmer = sin(streetUV.y * 80.0 + time * 5.0 + i * 2.0) * 0.5 + 0.5;
    intensity *= 0.5 + shimmer * 0.5;

    col += bandColor * intensity * 0.3;
  }

  return col;
}

vec3 cityGrid(vec2 uv, float time, float bassLevel, float globalTime) {
  vec3 col = vec3(0.0);

  float gridScale = iGridDensity * 8.0;
  vec2 gridUV = uv * gridScale;
  vec2 clipId = floor(gridUV);
  vec2 blockUV = fract(gridUV);

  float streetWidth = 0.12;
  bool isStreetX = blockUV.x < streetWidth || blockUV.x > (1.0 - streetWidth);
  bool isStreetY = blockUV.y < streetWidth || blockUV.y > (1.0 - streetWidth);
  bool isStreet = isStreetX || isStreetY;
  bool isIntersection = isStreetX && isStreetY;

  if (isStreet) {
    col = iStreetColor * 0.3;

    // Add spectrum reflection on streets (wet pavement effect)
    col += streetSpectrumReflection(uv, globalTime);

    // Street line markings - glow on bass
    float lineGlow = 0.3 + bassLevel * 0.7;
    if (isStreetX && !isStreetY) {
      float lineY = mod(blockUV.y * 10.0 + time * 0.5, 1.0);
      if (lineY > 0.4 && lineY < 0.6) {
        col += vec3(0.8, 0.7, 0.2) * lineGlow;
      }
    }
    if (isStreetY && !isStreetX) {
      float lineX = mod(blockUV.x * 10.0 + time * 0.5, 1.0);
      if (lineX > 0.4 && lineX < 0.6) {
        col += vec3(0.8, 0.7, 0.2) * lineGlow;
      }
    }

    // Street edge strokes - highlight on bass
    float edgeStroke = 0.0;
    if (isStreetX) {
      float distFromEdge = min(blockUV.x, 1.0 - blockUV.x);
      edgeStroke = max(edgeStroke, exp(-abs(distFromEdge - streetWidth) * 80.0));
    }
    if (isStreetY) {
      float distFromEdge = min(blockUV.y, 1.0 - blockUV.y);
      edgeStroke = max(edgeStroke, exp(-abs(distFromEdge - streetWidth) * 80.0));
    }
    col += iLightColor * edgeStroke * bassLevel * 0.5;

    float lampSpacing = 0.25;
    for (float i = 0.0; i < 4.0; i++) {
      vec2 lampPos;
      if (isStreetX && !isStreetY) {
        lampPos = vec2(streetWidth * 0.5, lampSpacing * (i + 0.5));
        if (blockUV.x > 0.5) lampPos.x = 1.0 - streetWidth * 0.5;
      } else if (isStreetY && !isStreetX) {
        lampPos = vec2(lampSpacing * (i + 0.5), streetWidth * 0.5);
        if (blockUV.y > 0.5) lampPos.y = 1.0 - streetWidth * 0.5;
      } else {
        continue;
      }

      float lampDist = length(blockUV - lampPos);
      float lampGlow = exp(-lampDist * 40.0) * (1.0 + bassLevel * 0.5);
      col += iLightColor * lampGlow * 0.8;
    }
  } else {
    float height = buildingHeight(clipId);
    height += bassLevel * 0.1;

    float brightness = 0.3 + height * 0.4;
    col = iBuildingColor * brightness;

    vec2 roofUV = (blockUV - streetWidth) / (1.0 - 2.0 * streetWidth);
    col += iBuildingColor * rooftopDetail(roofUV, clipId) * 0.5;

    vec2 windowGrid = roofUV * vec2(4.0, 6.0);
    vec2 windowId = floor(windowGrid);
    vec2 windowUV = fract(windowGrid);

    float windowOn = step(0.6, hash(clipId * 100.0 + windowId));
    float windowFlicker = step(0.95, hash(clipId + windowId + floor(time * 2.0)));
    windowOn = max(windowOn, windowFlicker);

    float windowShape = step(0.2, windowUV.x) * step(windowUV.x, 0.8) *
                        step(0.15, windowUV.y) * step(windowUV.y, 0.85);

    col += iLightColor * windowOn * windowShape * 0.6;

    float edgeDist = min(min(roofUV.x, 1.0 - roofUV.x), min(roofUV.y, 1.0 - roofUV.y));
    float edgeGlow = exp(-edgeDist * 30.0) * 0.3;
    col += iLightColor * edgeGlow * (0.5 + bassLevel * 0.5);
  }

  return col;
}

vec3 carLights(vec2 uv, float time, float bassLevel, float midLevel, float highLevel) {
  vec3 col = vec3(0.0);

  float gridScale = iGridDensity * 8.0;
  float streetWidth = 0.12;

  float numCars = iCarDensity;

  for (float i = 0.0; i < 50.0; i++) {
    if (i >= numCars) break;

    float seed = i * 127.1;
    vec2 r = hash2(vec2(seed, seed * 0.7));

    bool horizontal = r.x > 0.5;
    float lane = floor(r.y * gridScale);
    float speed = 0.3 + hash1(seed + 1.0) * 0.4;
    float offset = hash1(seed + 2.0) * 100.0;

    vec2 carPos;
    vec2 carDir;
    if (horizontal) {
      float progress = fract((time * speed * iSpeed + offset) * 0.1);
      carPos.x = progress;
      carPos.y = (lane + streetWidth * 0.5) / gridScale;
      carDir = vec2(1.0, 0.0);

      if (fract(r.y * 3.0) > 0.5) {
        carPos.y = (lane + 1.0 - streetWidth * 0.5) / gridScale;
        progress = 1.0 - progress;
        carPos.x = progress;
        carDir = vec2(-1.0, 0.0);
      }
    } else {
      float progress = fract((time * speed * iSpeed + offset) * 0.1);
      carPos.y = progress;
      carPos.x = (lane + streetWidth * 0.5) / gridScale;
      carDir = vec2(0.0, 1.0);

      if (fract(r.y * 5.0) > 0.5) {
        carPos.x = (lane + 1.0 - streetWidth * 0.5) / gridScale;
        progress = 1.0 - progress;
        carPos.y = progress;
        carDir = vec2(0.0, -1.0);
      }
    }

    vec2 toLight = uv - carPos;
    float carDist = length(toLight);

    // Trail effect on bass - elongate glow in direction of travel
    float trailStretch = 1.0 + bassLevel * 2.0;
    vec2 stretchedPos = toLight;
    float alongDir = dot(toLight, -carDir);
    if (alongDir > 0.0) {
      stretchedPos -= carDir * alongDir * (1.0 - 1.0/trailStretch);
    }
    float trailDist = length(stretchedPos);

    // Colors with audio reactivity
    vec3 headlight = vec3(1.0, 0.95, 0.8);
    headlight = mix(headlight, vec3(0.8, 0.9, 1.0), highLevel * 0.3); // Blue shift on highs

    vec3 taillight = vec3(1.0, 0.1, 0.05);
    taillight *= (1.0 + midLevel * 0.5); // Brighter on mids

    bool isHeadlight = horizontal ? (fract(r.y * 3.0) < 0.5) : (fract(r.y * 5.0) < 0.5);
    vec3 lightCol = isHeadlight ? headlight : taillight;

    // Glow size pulses with bass
    float glowFactor = 150.0 - bassLevel * 30.0;
    float glow = exp(-trailDist * glowFactor) * (1.0 + midLevel * 0.3);
    col += lightCol * glow * 0.6;
  }

  return col;
}

vec3 atmosphere(vec2 uv, float dist) {
  float fogAmount = 1.0 - exp(-dist * iFog * 0.5);
  vec3 fogColor = iSkyColor * 0.3 + vec3(0.1, 0.05, 0.15);
  return fogColor * fogAmount;
}

// Aurora sky effect - uses raw sound texture as light bands
vec3 spectrumAurora(vec2 uv, float time) {
  vec3 col = vec3(0.0);

  // Wider horizon mask - more visible area
  float horizonMask = smoothstep(0.0, -1.2, uv.y);
  if (horizonMask < 0.01) return col;

  float flow = time * 0.2;

  // More layers, more intensity
  for (float layer = 0.0; layer < 6.0; layer++) {
    float layerOffset = layer * 0.1;
    float layerSpeed = 1.0 + layer * 0.5;

    // Sample multiple frequency bands per layer
    for (float band = 0.0; band < 16.0; band++) {
      float bandOffset = band / 16.0;

      // Map to texture coordinate
      float sampleX = fract(uv.x * 0.5 + 0.5 + bandOffset + sin(uv.y * 4.0 + flow * layerSpeed + layer) * 0.2);
      sampleX = fract(sampleX + flow * 0.1 * layerSpeed);

      // Sample raw sound texture - CRANKED
      float amplitude = texture(iSoundTexture, vec2(sampleX, 0.5)).r * iResponsive * 2.5;

      // Skip low amplitude
      if (amplitude < 0.1) continue;

      // Band position varies with frequency
      float bandY = -0.4 - layerOffset - bandOffset * 0.3;
      float bandHeight = amplitude * 0.8;

      // Sharp band shape
      float bandMask = smoothstep(bandHeight, 0.0, abs(uv.y - bandY));
      bandMask *= amplitude * amplitude; // Square for more punch

      // Vibrant color per band
      vec3 auroraColor = mix(iSkyColor, iLightColor, sampleX);
      auroraColor = mix(auroraColor, iStreetColor, layer / 6.0);
      auroraColor = mix(auroraColor, vec3(1.0, 0.2, 0.6), bandOffset * 0.4);

      col += auroraColor * bandMask * 2.5 * horizonMask / 16.0;
    }
  }

  return col;
}

void main() {
  vec2 uv = (vUv - vec2(0.5, 0.5)) / vec2(0.25, 0.25);
  uv.y *= iResolution.y / iResolution.x;

  float time = iGlobalTime * iSpeed;
  float globalTime = iGlobalTime;
  float bassLevel = iLowFreq * iResponsive;
  float midLevel = iMidFreq * iResponsive;
  float highLevel = iHighFreq * iResponsive;

  vec3 ro = vec3(0.0, iCameraHeight * 2.0, 0.0);
  vec3 rd = normalize(vec3(uv.x, -1.0, uv.y));

  float groundDist = -ro.y / rd.y;
  vec2 groundPos = ro.xz + rd.xz * groundDist;

  groundPos += time * 0.02;
  groundPos += vec2(sin(time * 0.1), cos(time * 0.13)) * 0.1;

  vec3 col = iSkyColor * 0.1;

  // Add spectrum aurora to sky
  col += spectrumAurora(uv, globalTime);

  if (groundDist > 0.0) {
    vec2 cityUV = groundPos * 0.1;

    col = cityGrid(cityUV, time, bassLevel, globalTime);
    col += carLights(fract(cityUV), time, bassLevel, midLevel, highLevel);

    float dist = length(groundPos);
    col = mix(col, atmosphere(uv, dist), smoothstep(5.0, 15.0, dist));

    float vignette = 1.0 - length(uv) * 0.3;
    col *= vignette;
  }

  float horizonGlow = exp(-abs(uv.y + 0.5) * 3.0);
  col += iLightColor * horizonGlow * 0.2 * (1.0 + bassLevel * 0.5);

  col = clamp(col, 0.0, 1.0);


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
		if (!CSS.supports('color', color)) throw new Error(`Invalid Rooftop color: ${color}`);
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

type RooftopFrame = Required<RooftopOptions> & {readonly time: number; readonly bars: number[]};
type RooftopState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly audioTexture: WebGLTexture;
	readonly imageTexture: WebGLTexture | null;
	imageLoaded: boolean;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupRooftop(canvas: HTMLCanvasElement): RooftopState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
	});
	if (!gl)
		throw new Error(
			'Rooftop requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Rooftop could not create a program.');
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
			if (!shader) throw new Error('Rooftop could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Rooftop shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Rooftop shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Rooftop could not create a vertex buffer.');
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
		if (!audioTexture) throw new Error('Rooftop could not create an audio texture.');

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
					'iSkyColor',
					'iBuildingColor',
					'iStreetColor',
					'iLightColor',
					'iCameraHeight',
					'iGridDensity',
					'iCarDensity',
					'iResponsive',
					'iSpeed',
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
function drawRooftop(state: RooftopState, frame: RooftopFrame) {
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
	gl.uniform3fv(uniforms.iSkyColor, linearColor(frame.skyColor));
	gl.uniform3fv(uniforms.iBuildingColor, linearColor(frame.buildingColor));
	gl.uniform3fv(uniforms.iStreetColor, linearColor(frame.streetColor));
	gl.uniform3fv(uniforms.iLightColor, linearColor(frame.lightColor));
	gl.uniform1f(uniforms.iCameraHeight, bounded(frame.cameraHeight, 1, 10, 3));
	gl.uniform1f(uniforms.iGridDensity, bounded(frame.gridDensity, 1, 5, 2));
	gl.uniform1f(uniforms.iCarDensity, bounded(frame.carDensity, 0, 50, 25));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 10, 2));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 3, 1));
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
	if (error !== gl.NO_ERROR) throw new Error('Rooftop WebGL draw failed: ' + error);
}
function cleanupRooftop({gl, program, buffer, audioTexture, imageTexture}: RooftopState) {
	gl.deleteTexture(audioTexture);
	gl.deleteTexture(imageTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function RooftopCanvas(frame: RooftopFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<RooftopState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupRooftop(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Rooftop WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupRooftop(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Rooftop');
		try {
			drawRooftop(state.current, frame);
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
const RooftopContent: React.FC<Required<RooftopOptions> & {width: number; height: number}> = (
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
			<RooftopCanvas {...props} time={time} bars={bars} />
		</>
	);
};

const RooftopInner: React.FC<RooftopProps> = ({
	audioSrc = rooftopSchema.audioSrc.default,
	audioOffsetInSeconds = rooftopSchema.audioOffsetInSeconds.default,
	playAudio = rooftopSchema.playAudio.default,
	inputGainDb = rooftopSchema.inputGainDb.default,
	skyColor = rooftopSchema.skyColor.default,
	buildingColor = rooftopSchema.buildingColor.default,
	streetColor = rooftopSchema.streetColor.default,
	lightColor = rooftopSchema.lightColor.default,
	cameraHeight = rooftopSchema.cameraHeight.default,
	gridDensity = rooftopSchema.gridDensity.default,
	carDensity = rooftopSchema.carDensity.default,
	responsive = rooftopSchema.responsive.default,
	speed = rooftopSchema.speed.default,
	fog = rooftopSchema.fog.default,
	bpm = rooftopSchema.bpm.default,
	timeOffsetInSeconds = rooftopSchema.timeOffsetInSeconds.default,
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
			<RooftopContent
				key={audioSrc}
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={playAudio}
				inputGainDb={inputGainDb}
				skyColor={skyColor}
				buildingColor={buildingColor}
				streetColor={streetColor}
				lightColor={lightColor}
				cameraHeight={cameraHeight}
				gridDensity={gridDensity}
				carDensity={carDensity}
				responsive={responsive}
				speed={speed}
				fog={fog}
				bpm={bpm}
				timeOffsetInSeconds={timeOffsetInSeconds}
				width={drawingWidth}
				height={drawingHeight}
			/>
		</div>
	);
};
export const Rooftop = Interactive.create({
	Component: RooftopInner,
	layout: 'absolute-fill',
	componentName: '<Rooftop>',
	schema: rooftopSchema,
});
