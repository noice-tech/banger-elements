// EXTERNAL: This forks the Halo element, so a Halo fix needs the same fix here.
import {useAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import {useLayoutEffect, useMemo, useRef, useState, type FC} from 'react';
import {
	AbsoluteFill,
	Composition,
	cancelRender,
	continueRender,
	delayRender,
	registerRoot,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

// EXTERNAL: These match the hero word in showcase.css; re-run `bun run hero-word` after changing either.
const EM = 240;
const WIDTH = 968;
const HEIGHT = 498;
const ORIGIN_X = 144;
const BASELINE = 317;
const WORD = 'shape.';
const LETTER_SPACING = -0.055;

const UNIT = 1.8 * EM;
const RIM_OFFSET = 0.07 * EM;
const CLOSING = 0.14 * EM;
const SPECTRUM_CYCLES = 3;

const AUDIO = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3';
const HALO_FPS = 60;
const FPS = 30;
const START_SECONDS = 2.5;
const DURATION = 123;
const LOOP_FADE = 8;

const HALO = {
	radius: 0.12,
	intensity: 1,
	trailDepth: 9,
	inputGainDb: 0,
	bars: 1280,
};

const ANALYSIS_SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const FREQUENCY_BIN_COUNT = 512;
const TEMPORAL_SMOOTHING = 0.8;
const MIN_DECIBELS = -100;
const MAX_DECIBELS = -30;
const SPECTRUM_SCALE = 0.08;
const RETAINED_BINS = Math.ceil(SPECTRUM_SCALE * FREQUENCY_BIN_COUNT) + 1;
const BLUR_SAMPLES = 6;
const HISTORY_ROWS = 9 + BLUR_SAMPLES - 1;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const blackmanWindow = Float64Array.from(
	{length: FFT_SIZE},
	(_, index) =>
		0.42 -
		0.5 * Math.cos((2 * Math.PI * index) / FFT_SIZE) +
		0.08 * Math.cos((4 * Math.PI * index) / FFT_SIZE),
);
const bitReversedIndices = Uint16Array.from({length: FFT_SIZE}, (_, index) => {
	let reversed = 0;
	for (let bits = FFT_SIZE; bits > 1; bits >>= 1) {
		reversed = (reversed << 1) | (index & 1);
		index >>= 1;
	}
	return reversed;
});

type AnalysisParameters = {
	audioData: MediaUtilsAudioData;
	dataOffsetInSeconds: number;
	frame: number;
	fps: number;
	inputGainDb: number;
};

function monoSample(channels: Float32Array[], index: number) {
	const sample = (channel: number) => channels[channel]?.[index] ?? 0;
	if (channels.length === 1) return sample(0);
	if (channels.length === 2) return (sample(0) + sample(1)) * 0.5;
	if (channels.length === 4) return (sample(0) + sample(1) + sample(2) + sample(3)) * 0.25;
	if (channels.length === 6)
		return Math.SQRT1_2 * (sample(0) + sample(1)) + sample(2) + 0.5 * (sample(4) + sample(5));
	return sample(0);
}

function getRawMagnitudes({
	audioData,
	dataOffsetInSeconds,
	frame,
	fps,
}: Omit<AnalysisParameters, 'inputGainDb'>) {
	const real = new Float64Array(FFT_SIZE);
	const imaginary = new Float64Array(FFT_SIZE);
	const magnitudes = new Float32Array(FREQUENCY_BIN_COUNT);
	const endSample = Math.floor((frame / fps - dataOffsetInSeconds) * audioData.sampleRate);
	const startSample = endSample - FFT_SIZE;
	if (endSample <= 0 || startSample >= audioData.channelWaveforms[0].length) return magnitudes;
	for (let index = 0; index < FFT_SIZE; index++) {
		real[bitReversedIndices[index]] =
			monoSample(audioData.channelWaveforms, startSample + index) * blackmanWindow[index];
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
	for (let index = 0; index < FREQUENCY_BIN_COUNT; index++) {
		magnitudes[index] = Math.hypot(real[index], imaginary[index]) / FFT_SIZE;
	}
	return magnitudes;
}

type AnalysisTrace = {
	magnitudes: Float32Array[];
	gains: Map<number, number[]>;
};
const analysisCache = new WeakMap<MediaUtilsAudioData, Map<string, AnalysisTrace>>();

function getAnalysisTrace(parameters: AnalysisParameters) {
	const {audioData, dataOffsetInSeconds, fps, frame} = parameters;
	let traces = analysisCache.get(audioData);
	if (!traces) {
		traces = new Map();
		analysisCache.set(audioData, traces);
	}
	const key = `${dataOffsetInSeconds}:${fps}`;
	let trace = traces.get(key);
	if (!trace) {
		trace = {magnitudes: [], gains: new Map()};
		traces.set(key, trace);
	}
	const endFrame = Math.min(frame, Math.ceil(audioData.durationInSeconds * fps));
	for (let next = trace.magnitudes.length; next <= endFrame; next++) {
		const raw = getRawMagnitudes({...parameters, frame: next});
		const previous = trace.magnitudes[next - 1];
		const smoothed = new Float32Array(RETAINED_BINS);
		for (let bin = 0; bin < RETAINED_BINS; bin++) {
			smoothed[bin] =
				TEMPORAL_SMOOTHING * (previous?.[bin] ?? 0) + (1 - TEMPORAL_SMOOTHING) * raw[bin];
		}
		trace.magnitudes.push(smoothed);
	}
	return trace;
}

function normalizeMagnitude(magnitude: number, inputGainDb: number) {
	const decibels = 20 * Math.log10(Math.max(magnitude, 1e-12)) + inputGainDb;
	return (
		Math.floor(clamp((decibels - MIN_DECIBELS) / (MAX_DECIBELS - MIN_DECIBELS), 0, 1) * 255) / 255
	);
}

function sampleFrequency(values: Float32Array, x: number) {
	const position = clamp(x * FREQUENCY_BIN_COUNT - 0.5, 0, values.length - 1);
	const left = Math.floor(position);
	const mix = position - left;
	return values[left] * (1 - mix) + values[Math.min(left + 1, values.length - 1)] * mix;
}

function normalizedSpectrum(magnitudes: Float32Array, gain: number) {
	return Float32Array.from(magnitudes, (magnitude) => normalizeMagnitude(magnitude, gain));
}

function bassFromSpectrum(values: Float32Array) {
	let sum = 0;
	for (let step = 0; step < 8; step++) sum += sampleFrequency(values, step * 0.001);
	return clamp((sum / 8 - 0.75) / 0.25, 0, 1);
}

function getBassPhase(parameters: AnalysisParameters) {
	if (parameters.frame < 0) return 0;
	const trace = getAnalysisTrace(parameters);
	let gainTrace = trace.gains.get(parameters.inputGainDb);
	if (!gainTrace) {
		if (trace.gains.size >= 4) trace.gains.delete(trace.gains.keys().next().value!);
		gainTrace = [0];
		trace.gains.set(parameters.inputGainDb, gainTrace);
	}
	const endFrame = Math.min(
		parameters.frame,
		Math.ceil(parameters.audioData.durationInSeconds * parameters.fps),
	);
	for (let next = gainTrace.length - 1; next < endFrame; next++) {
		const bass = bassFromSpectrum(
			normalizedSpectrum(trace.magnitudes[next], parameters.inputGainDb),
		);
		gainTrace.push(Math.fround(gainTrace[next] + bass));
	}
	return gainTrace[endFrame];
}

type DataTexture = {width: number; height: number; data: Float32Array};
type HistoryInput = {
	audioData: MediaUtilsAudioData;
	dataOffsetInSeconds: number;
	sourceTime: number;
	fps: number;
	inputGainDb: number;
	width?: number;
};

function createHaloHistory(input: HistoryInput) {
	const width = Math.max(1, Math.round(input.width ?? 1280));
	const data = new Float32Array(width * HISTORY_ROWS * 4);
	const headFrame = Math.round(input.sourceTime * input.fps);
	const parameters = (frame: number): AnalysisParameters => ({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame,
		fps: input.fps,
		inputGainDb: input.inputGainDb,
	});
	const trace = getAnalysisTrace(parameters(Math.max(0, headFrame)));
	for (let row = 0; row < HISTORY_ROWS; row++) {
		const frame = headFrame - row;
		const rowStart = row * width * 4;
		data[rowStart + 2] = getBassPhase(parameters(frame));
		if (frame < 0 || frame / input.fps >= input.audioData.durationInSeconds) continue;
		const values = normalizedSpectrum(trace.magnitudes[frame], input.inputGainDb);
		data[rowStart + 1] = bassFromSpectrum(values);
		for (let bar = 0; bar < width; bar++) {
			const position = (bar + 0.5) / width;
			let value = 0;
			for (let step = 0; step < 10; step++) {
				const offset = step * 0.002;
				const right = position + offset;
				value += clamp(
					(sampleFrequency(values, Math.abs(position - offset) * SPECTRUM_SCALE) - 0.8) / 0.2,
					0,
					1,
				);
				value += clamp(
					(sampleFrequency(values, (right < 1 ? right : 2 - right) * SPECTRUM_SCALE) - 0.8) / 0.2,
					0,
					1,
				);
			}
			data[rowStart + bar * 4] = value / 20;
		}
	}
	return {
		history: {width, height: HISTORY_ROWS, data} satisfies DataTexture,
	};
}

const INFINITY = 1e20;

function closerSite(y: number, above: number, below: number) {
	if (above < 0) return below;
	if (below < 0) return above;
	return y - above <= below - y ? above : below;
}

function nearestSites(isSite: Uint8Array) {
	const columnDistance = new Float64Array(WIDTH * HEIGHT);
	const columnSite = new Int32Array(WIDTH * HEIGHT);
	for (let x = 0; x < WIDTH; x++) {
		let previous = -1;
		for (let y = 0; y < HEIGHT; y++) {
			if (isSite[y * WIDTH + x]) previous = y;
			columnSite[y * WIDTH + x] = previous;
		}
		let next = -1;
		for (let y = HEIGHT - 1; y >= 0; y--) {
			const i = y * WIDTH + x;
			if (isSite[i]) next = y;
			const above = columnSite[i];
			const site = closerSite(y, above, next);
			columnSite[i] = site;
			columnDistance[i] = site < 0 ? INFINITY : (y - site) ** 2;
		}
	}
	const distance = new Float32Array(WIDTH * HEIGHT);
	const nearest = new Int32Array(WIDTH * HEIGHT);
	const f = new Float64Array(WIDTH);
	const v = new Int32Array(WIDTH);
	const z = new Float64Array(WIDTH + 1);
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) f[x] = columnDistance[y * WIDTH + x];
		let k = 0;
		v[0] = 0;
		z[0] = -Infinity;
		z[1] = Infinity;
		for (let q = 1; q < WIDTH; q++) {
			let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
			while (s <= z[k]) {
				k--;
				s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
			}
			k++;
			v[k] = q;
			z[k] = s;
			z[k + 1] = Infinity;
		}
		k = 0;
		for (let q = 0; q < WIDTH; q++) {
			while (z[k + 1] < q) k++;
			const i = y * WIDTH + q;
			distance[i] = Math.sqrt((q - v[k]) ** 2 + f[v[k]]);
			nearest[i] = columnSite[y * WIDTH + v[k]] * WIDTH + v[k];
		}
	}
	return {distance, nearest};
}

type Shape = {
	texture: Float32Array;
	center: [number, number];
	ink: Uint8Array;
};

function measureWord(context: CanvasRenderingContext2D) {
	context.font = `600 ${EM}px Geist`;
	context.letterSpacing = `${LETTER_SPACING * EM}px`;
	return context.measureText(WORD);
}

function wordShape(): Shape {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const context = canvas.getContext('2d', {willReadFrequently: true})!;
	const metrics = measureWord(context);
	context.fillStyle = '#fff';
	context.fillText(WORD, ORIGIN_X, BASELINE);
	const alpha = context.getImageData(0, 0, WIDTH, HEIGHT).data;
	const ink = new Uint8Array(WIDTH * HEIGHT);
	for (let i = 0; i < ink.length; i++) ink[i] = alpha[i * 4 + 3] >= 128 ? 1 : 0;

	const far = Uint8Array.from(nearestSites(ink).distance, (distance) =>
		distance > CLOSING ? 1 : 0,
	);
	const closed = Uint8Array.from(nearestSites(far).distance, (distance, i) =>
		distance > CLOSING || ink[i] ? 1 : 0,
	);
	const outside = new Uint8Array(WIDTH * HEIGHT);
	const stack: number[] = [];
	for (let x = 0; x < WIDTH; x++) stack.push(x, (HEIGHT - 1) * WIDTH + x);
	for (let y = 0; y < HEIGHT; y++) stack.push(y * WIDTH, y * WIDTH + WIDTH - 1);
	while (stack.length) {
		const i = stack.pop()!;
		if (outside[i] || closed[i]) continue;
		outside[i] = 1;
		const x = i % WIDTH;
		if (x > 0) stack.push(i - 1);
		if (x < WIDTH - 1) stack.push(i + 1);
		if (i >= WIDTH) stack.push(i - WIDTH);
		if (i < WIDTH * (HEIGHT - 1)) stack.push(i + WIDTH);
	}
	const solid = Uint8Array.from(outside, (value) => 1 - value);

	const centerX = ORIGIN_X + (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2;
	const centerY =
		BASELINE - (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
	const radiusX = (metrics.actualBoundingBoxRight + metrics.actualBoundingBoxLeft) / 2;
	const radius = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / 2;
	const half = Math.max(0, radiusX - radius);
	const perimeter = 4 * half + 2 * Math.PI * radius;
	const along = (x: number, y: number) => {
		const dx = x - centerX;
		const dy = y - centerY;
		if (dx > half) return half + radius * Math.atan2(dx - half, -dy);
		if (dx < -half) return 3 * half + Math.PI * radius + radius * Math.atan2(-dx - half, dy);
		if (dy < 0) return dx >= 0 ? dx : perimeter + dx;
		return 2 * half + Math.PI * radius - dx;
	};
	const position = (x: number, y: number) => {
		const cycle = (along(x, y) / perimeter) * SPECTRUM_CYCLES;
		const fraction = cycle - Math.floor(cycle);
		return 2 * Math.min(fraction, 1 - fraction);
	};

	const {distance} = nearestSites(solid);
	const texture = new Float32Array(WIDTH * HEIGHT * 2);
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			const i = y * WIDTH + x;
			const j = ((HEIGHT - 1 - y) * WIDTH + x) * 2;
			texture[j] = (Math.max(0, distance[i] - 0.5) - RIM_OFFSET) / UNIT;
			texture[j + 1] = position(x, y);
		}
	}
	return {texture, center: [centerX, HEIGHT - centerY], ink};
}

const haloFragment = `#version 300 es
/*
  SPDX-License-Identifier: 0BSD

  Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING
  ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL,
  DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
  WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE
  USE OR PERFORMANCE OF THIS SOFTWARE.
*/
precision highp float;
precision highp int;
uniform float iGlobalTime;
uniform float iAspect;
uniform sampler2D iHistoryTexture;
uniform sampler2D iShapeTexture;
uniform vec2 iResolution;
uniform vec2 iWordCenter;
uniform float iUnit;
uniform sampler2D iCenterImageTexture;
uniform float iCenterImageAspectRatio;
uniform float iHasCenterImage;
uniform int iColorMode;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform vec3 iLeadingColor;
uniform vec3 iCenterTint;
uniform bool iTransparentCenter;
uniform float iRadius;
uniform float iIntensity;
uniform float iTrailDepth;
uniform float iWaveDelay;
uniform float iMotionBlur;
uniform float iGlowBlur;
uniform float iGlowSpread;
in vec2 vUv;
out vec4 outColor;
#define TWO_PI 6.28318530718
#define CIRCLE_BORDER_SIZE 0.008

vec2 rotatePoint(vec2 point, float angle) {
  float sine = sin(angle), cosine = cos(angle);
  return point * mat2(cosine, sine, -sine, cosine);
}

float sourceCircle(float distanceFromCenter, float radius, float smoothness) {
  float halfSmoothness = smoothness * 0.5;
  return 1.0 - smoothstep(radius - halfSmoothness, radius + halfSmoothness, distanceFromCenter - radius);
}

vec4 over(vec4 back, vec4 front) {
  return vec4(front.rgb * front.a + back.rgb * (1.0 - front.a), front.a + back.a * (1.0 - front.a));
}

vec4 spectrumColor(int age) {
  const vec3 colors[9] = vec3[9](
    vec3(1,1,1), vec3(1,1,0), vec3(1,0.5,0), vec3(1,0,0),
    vec3(1,0.2,0.3), vec3(1,0,1), vec3(0,0,1), vec3(0,0.8,1), vec3(0,1,0)
  );
  const float alphas[9] = float[9](1.0, 0.95, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65);
  float position = float(age) / max(iTrailDepth - 1.0, 1.0);
  vec3 color = iColorMode == 1 ? colors[age] : mix(iStartColor, iEndColor, position);
  return vec4(age == 0 ? iLeadingColor : color, alphas[age]);
}

float getFrequency(float x, int row) {
  int width = textureSize(iHistoryTexture, 0).x;
  return texelFetch(iHistoryTexture, ivec2(clamp(int(x * float(width)), 0, width - 1), row), 0).r;
}

vec3 innerCircle(vec2 point, float time) {
  float turn = 1.0 - smoothstep(0.0, 1.0, clamp((fract(time * 0.06) - 0.8) / 0.2, 0.0, 1.0));
  vec2 rotated = rotatePoint(point, TWO_PI * turn);
  vec3 color = mix(vec3(0.0), vec3(0.15), rotated.y * 0.5 + 0.5) + 0.1;
  return mix(color, vec3(0.0), sin(length(rotated) * 80.0) * 0.05) * iCenterTint;
}

vec4 centerImageColor(vec2 point) {
  vec2 uv = point * 0.5 + 0.5;
  if (iCenterImageAspectRatio >= 1.0) uv.x = (uv.x - 0.5) / iCenterImageAspectRatio + 0.5;
  else uv.y = (uv.y - 0.5) * iCenterImageAspectRatio + 0.5;
  return texture(iCenterImageTexture, uv);
}

vec2 shakeAt(float time) { return vec2(sin(time * 9.0), cos(time * 5.0)) * 0.002; }

vec4 renderHalo(vec2 uv, int sampleAge, out float innerMask) {
  innerMask = 0.0;
  float time = iGlobalTime - float(sampleAge) / 60.0;
  vec4 audio = texelFetch(iHistoryTexture, ivec2(0, sampleAge), 0);
  float bass = audio.g, extra = audio.b;
  vec2 point = (uv * iResolution - iWordCenter) / iUnit + shakeAt(time);
  point = rotatePoint(point, sin(time * 1.5 + extra) * 0.005);
  point += vec2(cos(time * 9.0 + extra * 0.3), sin(time * 9.0 + extra * 0.3)) * 0.003;
  vec2 shape = texture(iShapeTexture, (iWordCenter + point * iUnit) / iResolution).rg;
  float distanceFromCenter = shape.r + iRadius * 2.0;
  float bassGrowth = bass * 0.03;
  float maximumRadius = min(1.0, iRadius + bassGrowth + 0.07 * iIntensity) * 2.0;
  float glowExtent = iGlowBlur > 0.0 ? iGlowBlur * 0.001 + iGlowSpread * 0.0002 : 0.0;
  if (distanceFromCenter > maximumRadius + glowExtent + 0.004) return vec4(0.0);

  float frequencyX = shape.g;
  vec4 result = vec4(0.0);
  if (iGlowBlur > 0.0) {
    float radius = min(1.0, iRadius + bassGrowth + getFrequency(frequencyX, sampleAge) * 0.07 * iIntensity);
    float distanceToEdge = max(0.0, abs(distanceFromCenter - radius * 2.0) - iGlowSpread * 0.0002);
    float glow = 1.0 - smoothstep(0.004, max(0.0041, iGlowBlur * 0.001), distanceToEdge);
    result = over(result, vec4(spectrumColor(0).rgb, glow * 0.35));
  }
  for (int age = 8; age >= 0; age--) {
    if (age >= int(iTrailDepth)) continue;
    int row = sampleAge + (iWaveDelay > 0.5 ? age : 0);
    float radius = clamp(iRadius + bassGrowth + getFrequency(frequencyX, row) * 0.07 * iIntensity, iRadius + bassGrowth, 1.0);
    vec4 layer = spectrumColor(age);
    layer.a *= sourceCircle(distanceFromCenter, radius, 0.004 + float(age) * 0.00025);
    result = over(result, layer);
  }
  float innerRadius = max(0.02, iRadius + bassGrowth - CIRCLE_BORDER_SIZE);
  innerMask = sourceCircle(distanceFromCenter, innerRadius, 0.004);
  if (iTransparentCenter) {
    result *= 1.0 - innerMask;
  } else if (innerMask > 0.0) {
    result = over(result, vec4(innerCircle(point / innerRadius, time), innerMask));
    if (iHasCenterImage > 0.5) {
      vec4 artwork = centerImageColor(point / (innerRadius * 2.0));
      artwork.a *= innerMask;
      result = over(result, artwork);
    }
  }
  result.rgb += bass * 0.05 * result.a;
  result.rgb *= smoothstep(0.0, 1.0, 1.7 - distanceFromCenter);
  return result;
}

void main() {
  vec4 result = vec4(0.0);
  vec2 uv = vUv;
  float weight = 1.0;
  float currentInnerMask = 0.0;
  for (int age = 0; age < ${BLUR_SAMPLES}; age++) {
    float time = iGlobalTime - float(age) / 60.0;
    if (time < 0.0) break;
    float innerMask;
    result += renderHalo(uv, age, innerMask) * weight * (iMotionBlur > 0.5 ? 0.8 : 1.0);
    if (age == 0) currentInnerMask = innerMask;
    if (iMotionBlur < 0.5) break;
    uv += shakeAt(time);
    weight *= 0.2;
  }
  if (iTransparentCenter && iMotionBlur > 0.5) result *= 1.0 - currentInnerMask;
  outColor = clamp(result, 0.0, 1.0);
}
`;

const haloVertex = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

type Renderer = {
	gl: WebGL2RenderingContext;
	historyTexture: WebGLTexture;
	uniforms: Record<string, WebGLUniformLocation | null>;
};

const UNIFORMS = [
	'iGlobalTime',
	'iAspect',
	'iHistoryTexture',
	'iShapeTexture',
	'iResolution',
	'iWordCenter',
	'iUnit',
	'iColorMode',
	'iStartColor',
	'iEndColor',
	'iLeadingColor',
	'iCenterTint',
	'iTransparentCenter',
	'iHasCenterImage',
	'iCenterImageAspectRatio',
	'iRadius',
	'iIntensity',
	'iTrailDepth',
	'iWaveDelay',
	'iMotionBlur',
	'iGlowBlur',
	'iGlowSpread',
];

function createRenderer(canvas: HTMLCanvasElement, shape: Shape): Renderer {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl) throw new Error('The hero halo needs WebGL2. Render with --gl=angle or --gl=swangle.');
	const program = gl.createProgram();
	for (const [type, source] of [
		[gl.VERTEX_SHADER, haloVertex],
		[gl.FRAGMENT_SHADER, haloFragment],
	] as const) {
		const shader = gl.createShader(type)!;
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
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
		gl.STATIC_DRAW,
	);
	const position = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	const uniforms = Object.fromEntries(
		UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
	);

	const historyTexture = gl.createTexture();
	const shapeTexture = gl.createTexture();
	for (const [texture, filter] of [
		[historyTexture, gl.NEAREST],
		[shapeTexture, gl.LINEAR],
	] as const) {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, shapeTexture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, WIDTH, HEIGHT, 0, gl.RG, gl.FLOAT, shape.texture);

	for (const [name, value] of Object.entries({
		iAspect: WIDTH / HEIGHT,
		iUnit: UNIT,
		iRadius: HALO.radius,
		iIntensity: HALO.intensity,
		iTrailDepth: HALO.trailDepth,
		iWaveDelay: 1,
		iMotionBlur: 1,
		iGlowBlur: 0,
		iGlowSpread: 0,
		iHasCenterImage: 0,
		iCenterImageAspectRatio: 1,
	}))
		gl.uniform1f(uniforms[name], value);
	gl.uniform1i(uniforms.iColorMode, 1);
	gl.uniform1i(uniforms.iTransparentCenter, 1);
	gl.uniform3fv(uniforms.iStartColor, [0xaa / 255, 0x8b / 255, 1]);
	gl.uniform3fv(uniforms.iEndColor, [0x51 / 255, 0xe8 / 255, 0xcc / 255]);
	gl.uniform3fv(uniforms.iLeadingColor, [1, 1, 1]);
	gl.uniform3fv(uniforms.iCenterTint, [1, 1, 1]);
	gl.uniform2f(uniforms.iResolution, WIDTH, HEIGHT);
	gl.uniform2f(uniforms.iWordCenter, ...shape.center);
	gl.uniform1i(uniforms.iHistoryTexture, 0);
	gl.uniform1i(uniforms.iShapeTexture, 1);
	return {gl, historyTexture, uniforms};
}

function draw({gl, historyTexture, uniforms}: Renderer, sourceTime: number, history: DataTexture) {
	gl.viewport(0, 0, WIDTH, HEIGHT);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iGlobalTime, sourceTime);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, historyTexture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		history.width,
		history.height,
		0,
		gl.RGBA,
		gl.FLOAT,
		history.data,
	);
	gl.disable(gl.BLEND);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Halo WebGL draw failed: ${error}`);
}

function useGeist() {
	const [ready, setReady] = useState(false);
	const [handle] = useState(() => delayRender('Loading Geist'));
	useLayoutEffect(() => {
		const face = new FontFace('Geist', `url(${staticFile('fonts/Geist.woff2')})`, {
			weight: '100 900',
		});
		face
			.load()
			.then(() => {
				document.fonts.add(face);
				setReady(true);
				continueRender(handle);
			})
			.catch(cancelRender);
	}, [handle]);
	return ready;
}

const HaloCanvas: FC<{audioData: MediaUtilsAudioData; shape: Shape; sourceTime: number}> = ({
	audioData,
	shape,
	sourceTime,
}) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	const renderer = useRef<Renderer | null>(null);
	const history = useMemo(
		() =>
			createHaloHistory({
				audioData,
				dataOffsetInSeconds: 0,
				sourceTime,
				fps: HALO_FPS,
				inputGainDb: HALO.inputGainDb,
				width: HALO.bars,
			}).history,
		[audioData, sourceTime],
	);
	useLayoutEffect(() => {
		try {
			renderer.current ??= createRenderer(canvas.current!, shape);
			draw(renderer.current, sourceTime, history);
		} catch (error) {
			cancelRender(error);
		}
	}, [shape, history, sourceTime]);
	return (
		<canvas ref={canvas} width={WIDTH} height={HEIGHT} style={{position: 'absolute', inset: 0}} />
	);
};

const HaloWord: FC<{showWord: boolean}> = ({showWord}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const audioData = useAudioData(AUDIO, {sampleRate: ANALYSIS_SAMPLE_RATE});
	const fontReady = useGeist();
	const shape = useMemo(() => (fontReady ? wordShape() : null), [fontReady]);
	const overlay = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		if (!fontReady || !showWord) return;
		const context = overlay.current!.getContext('2d')!;
		measureWord(context);
		context.fillStyle = '#fff';
		context.fillText(WORD, ORIGIN_X, BASELINE);
	}, [fontReady, showWord]);
	if (fps !== FPS) throw new Error(`HeroWord renders at ${FPS} fps.`);
	const sourceTime = START_SECONDS + frame / fps;
	const fade = Math.max(0, (frame - (DURATION - LOOP_FADE)) / LOOP_FADE);
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{audioData && shape ? (
				<>
					<AbsoluteFill>
						<HaloCanvas audioData={audioData} shape={shape} sourceTime={sourceTime} />
					</AbsoluteFill>
					{fade > 0 ? (
						<AbsoluteFill style={{backgroundColor: '#000', opacity: fade}}>
							<HaloCanvas
								audioData={audioData}
								shape={shape}
								sourceTime={sourceTime - DURATION / FPS}
							/>
						</AbsoluteFill>
					) : null}
				</>
			) : null}
			{showWord ? (
				<canvas
					ref={overlay}
					width={WIDTH}
					height={HEIGHT}
					style={{position: 'absolute', inset: 0}}
				/>
			) : null}
		</AbsoluteFill>
	);
};

registerRoot(() => (
	<Composition
		id="HeroWord"
		component={HaloWord}
		defaultProps={{showWord: false}}
		durationInFrames={DURATION}
		fps={FPS}
		width={WIDTH}
		height={HEIGHT}
	/>
));
