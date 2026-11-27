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
type MatrixProps = Omit<MatrixOptions, 'width' | 'height'>;
const matrixSchema = {
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
	color1: {type: 'color', default: '#ff6b00', description: 'Primary Color'},
	color2: {type: 'color', default: '#00a8ff', description: 'Secondary Color'},
	glowColor: {type: 'color', default: '#ffffff', description: 'Glow Color'},
	textureSrc: {
		type: 'asset',
		assetType: 'image',
		default: '',
		description: 'Noise Texture',
		keyframable: false,
	},
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
		default: 1,
		min: 0,
		max: 3,
		step: 0.1,
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
const bandRate = 60;
const bandFftSize = 2048;
const bandRangeDb = 18;
const bandPeakSeconds = 6;
const bandPeakDecayDbPerSecond = 2;
const bandPeakStep = 4;
const audioBandRanges = [
	{from: 40, to: 140, floorDb: -42, releaseSeconds: 0.3},
	{from: 300, to: 2000, floorDb: -45, releaseSeconds: 0.25},
	{from: 4000, to: 12000, floorDb: -55, releaseSeconds: 0.15},
] as const;
const bandWindow = Float64Array.from(
	{length: bandFftSize},
	(_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / bandFftSize),
);
const bandReversed = Uint16Array.from({length: bandFftSize}, (_, index) => {
	let reversed = 0;
	for (let bit = 1; bit < bandFftSize; bit <<= 1)
		reversed = (reversed << 1) | (index & bit ? 1 : 0);
	return reversed;
});
const bandCos = Float64Array.from({length: bandFftSize / 2}, (_, index) =>
	Math.cos((2 * Math.PI * index) / bandFftSize),
);
const bandSin = Float64Array.from(
	{length: bandFftSize / 2},
	(_, index) => -Math.sin((2 * Math.PI * index) / bandFftSize),
);
const silentBandLevels = audioBandRanges.map(() => -120);
const bandLevelCache = new Map<string, number[]>();
function bandLevels(audioData: MediaUtilsAudioData, offset: number, tap: number) {
	const time = tap / bandRate;
	if (time < 0 || time >= audioData.durationInSeconds) return silentBandLevels;
	const key = `${audioData.resultId}:${offset}:${tap}`;
	const cached = bandLevelCache.get(key);
	if (cached) return cached;
	const samples = audioData.channelWaveforms[0];
	const start = Math.floor((time - offset) * audioData.sampleRate) - bandFftSize / 2;
	const real = new Float64Array(bandFftSize);
	const imaginary = new Float64Array(bandFftSize);
	for (let index = 0; index < bandFftSize; index++)
		real[bandReversed[index]] = (samples[start + index] ?? 0) * bandWindow[index];
	for (let size = 2; size <= bandFftSize; size <<= 1) {
		const half = size >> 1;
		const stride = bandFftSize / size;
		for (let block = 0; block < bandFftSize; block += size)
			for (let index = 0; index < half; index++) {
				const a = block + index;
				const b = a + half;
				const cos = bandCos[index * stride];
				const sin = bandSin[index * stride];
				const re = real[b] * cos - imaginary[b] * sin;
				const im = real[b] * sin + imaginary[b] * cos;
				real[b] = real[a] - re;
				imaginary[b] = imaginary[a] - im;
				real[a] += re;
				imaginary[a] += im;
			}
	}
	const binWidth = audioData.sampleRate / bandFftSize;
	const levels = audioBandRanges.map(({from, to}) => {
		let power = 0;
		const end = Math.min(bandFftSize / 2, Math.ceil(to / binWidth));
		for (let bin = Math.ceil(from / binWidth); bin < end; bin++)
			power += real[bin] * real[bin] + imaginary[bin] * imaginary[bin];
		return 10 * Math.log10((power * 16) / (bandFftSize * bandFftSize) + 1e-12);
	});
	if (bandLevelCache.size >= 4096) bandLevelCache.clear();
	bandLevelCache.set(key, levels);
	return levels;
}
function audioBands(
	audioData: MediaUtilsAudioData,
	offset: number,
	time: number,
	inputGainDb: number,
) {
	if (time < 0 || time >= audioData.durationInSeconds) return audioBandRanges.map(() => 0);
	const now = Math.floor(time * bandRate + 1e-6);
	const gain = bounded(inputGainDb, -30, 30, 0);
	return audioBandRanges.map(({floorDb, releaseSeconds}, band) => {
		let reference = Math.max(floorDb, bandLevels(audioData, offset, now)[band]);
		const first = now - bandPeakSeconds * bandRate;
		for (
			let tap = first - (first % bandPeakStep);
			tap <= now + bandPeakSeconds * bandRate;
			tap += bandPeakStep
		)
			reference = Math.max(
				reference,
				bandLevels(audioData, offset, tap)[band] -
					(Math.abs(now - tap) / bandRate) * bandPeakDecayDbPerSecond,
			);
		const releaseTaps = Math.round(releaseSeconds * bandRate);
		let envelope = 0;
		for (let step = 0; step <= releaseTaps; step++) {
			const level = bandLevels(audioData, offset, now - step)[band];
			const value = (level - reference + bandRangeDb + gain) / bandRangeDb;
			envelope = Math.max(envelope, Math.min(1, value) - step / releaseTaps);
		}
		return envelope;
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

  float specLow = clamp(iLowFreq, 0.0, 1.0) * iResponsive;
  float specMid = clamp(iMidFreq, 0.0, 1.0) * iResponsive;
  float specHigh = clamp(iHighFreq, 0.0, 1.0) * iResponsive;

  float iterations = clamp(iIterations, 4.0, float(MAX_ITERATIONS));
  float timeOffset = (time + 100.0) * 0.3;
  float spread = iSpread * (1.0 + specMid * 0.04);

  for (int index = 0; index < MAX_ITERATIONS; index++) {
    float i = float(index);
    if (i >= iterations) break;

    float angle = i * PI * 2.0 * PHI;
    vec2 direction = sin(angle + vec2(0.0, PI * 0.5));
    vec2 offset = vec2(cos(angle), direction.y);

    float noise = fractalnoise(p * 1.5 + timeOffset * offset, time);
    col += vec4(noise);

    p += direction * col.x * spread;
  }

  vec4 colorMod = vec4(1.0, 1.618, 2.618, 0.0) * iColorCycle;
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
  finalCol *= (0.55 + lum * 0.75) * (0.92 + 0.16 * specLow);
  finalCol += iGlowColor * (lumSquared * lum) * iGlow * (0.22 + specLow * 0.14);
  finalCol = mix(finalCol, iGlowColor, specHigh * 0.08 * lumSquared);

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

type MatrixFrame = Required<MatrixOptions> & {
	readonly time: number;
	readonly bands: readonly number[];
};
type MatrixState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
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

		imageTexture = gl.createTexture();
		if (!imageTexture) throw new Error('Matrix could not create an image texture.');
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, imageTexture);
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
		return {
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
	gl.uniform1f(uniforms.iLowFreq, frame.bands[0] ?? 0);
	gl.uniform1f(uniforms.iMidFreq, frame.bands[1] ?? 0);
	gl.uniform1f(uniforms.iHighFreq, frame.bands[2] ?? 0);
	gl.uniform3fv(uniforms.iColor1, linearColor(frame.color1));
	gl.uniform3fv(uniforms.iColor2, linearColor(frame.color2));
	gl.uniform3fv(uniforms.iGlowColor, linearColor(frame.glowColor));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 2, 0.5));
	gl.uniform1f(uniforms.iScale, bounded(frame.scale, 0.5, 3, 1));
	gl.uniform1f(uniforms.iIterations, bounded(frame.iterations, 4, 24, 24));
	gl.uniform1f(uniforms.iSpread, bounded(frame.spread, 0.1, 1.5, 0.75));
	gl.uniform1f(uniforms.iColorCycle, bounded(frame.colorCycle, 0.5, 5, 2.5));
	gl.uniform1f(uniforms.iGlow, bounded(frame.glow, 0, 2, 1));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 3, 1));
	gl.uniform1f(uniforms.iBpm, bounded(frame.bpm, 1, 300, 120));
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.imageTexture);
	gl.uniform1i(uniforms.iTexture, 0);
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
function cleanupMatrix({gl, program, buffer, imageTexture}: MatrixState) {
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
				gl.activeTexture(gl.TEXTURE0);
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
	const bands = audioBands(
		audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
		props.inputGainDb,
	);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<MatrixCanvas {...props} time={time} bands={bands} />
		</>
	);
};

const MatrixInner: React.FC<MatrixProps> = ({
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
	);
};
export const Matrix = Interactive.create({
	Component: MatrixInner,
	layout: 'absolute-fill',
	componentName: '<Matrix>',
	schema: matrixSchema,
});
