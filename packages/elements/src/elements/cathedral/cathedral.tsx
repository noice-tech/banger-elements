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

type CathedralOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly stoneColor?: string;
	readonly glassColor1?: string;
	readonly glassColor2?: string;
	readonly lightColor?: string;
	readonly speed?: number;
	readonly columnScale?: number;
	readonly glassGlow?: number;
	readonly responsive?: number;
	readonly fog?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};
type CathedralProps = Omit<CathedralOptions, 'width' | 'height'>;
const cathedralSchema = {
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
	stoneColor: {type: 'color', default: '#6b6bff', description: 'Stone Color'},
	glassColor1: {type: 'color', default: '#4f4f4f', description: 'Glass Color 1'},
	glassColor2: {type: 'color', default: '#3366ff', description: 'Glass Color 2'},
	lightColor: {type: 'color', default: '#ffcc88', description: 'Light Color'},
	speed: {
		type: 'number',
		default: 0.5,
		min: 0.1,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Speed',
	},
	columnScale: {
		type: 'number',
		default: 1,
		min: 0.5,
		max: 2,
		step: 0.1,
		hiddenFromList: false,
		description: 'Column Scale',
	},
	glassGlow: {
		type: 'number',
		default: 2,
		min: 0.5,
		max: 5,
		step: 0.5,
		hiddenFromList: false,
		description: 'Glass Glow',
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
	fog: {
		type: 'number',
		default: 1,
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
		const handle = delayRender('Waiting for complete Cathedral audio history');
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

uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;

uniform float iSpeed;
uniform float iColumnScale;
uniform float iGlassGlow;
uniform float iResponsive;
uniform float iFog;

uniform vec3 iStoneColor;
uniform vec3 iGlassColor1;
uniform vec3 iGlassColor2;
uniform vec3 iLightColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

#define PI 3.14159265359
#define TAU 6.28318530718
#define FAR 80.0

float objID = 0.0;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n = i.x + i.y * 157.0 + 113.0 * i.z;
  return mix(
    mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
        mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y),
    f.z
  );
}

vec3 camPath(float t) {
  float s = 4.0 * iColumnScale;

  float z = -t * s * 2.0;

  float y = 2.0 + sin(t * 0.5) * 0.5;

  float x = sin(t * 0.3) * 0.2;

  return vec3(x, y, z);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCylinder(vec3 p, float r, float h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdArch(vec3 p, float width, float height, float depth) {
  float archRadius = width * 0.7;
  float archHeight = height * 0.6;

  vec3 p1 = p - vec3(-width * 0.3, archHeight, 0.0);
  vec3 p2 = p - vec3(width * 0.3, archHeight, 0.0);

  float circle1 = length(p1.xy) - archRadius;
  float circle2 = length(p2.xy) - archRadius;
  float arch = max(circle1, circle2);

  arch = max(arch, abs(p.z) - depth);

  arch = max(arch, -p.y);
  arch = max(arch, p.y - height);

  return arch;
}

float sdColumn(vec3 p, float radius, float height) {
  float col = sdCylinder(p - vec3(0.0, height * 0.5, 0.0), radius, height * 0.5);

  float base = sdBox(p - vec3(0.0, 0.15, 0.0), vec3(radius * 1.4, 0.15, radius * 1.4));

  float capital = sdBox(p - vec3(0.0, height - 0.15, 0.0), vec3(radius * 1.3, 0.15, radius * 1.3));

  return min(col, min(base, capital));
}

float sdVault(vec3 p, float width, float height) {
  vec3 rp = p;
  rp.y -= height;

  float curve = length(vec2(abs(rp.x), rp.y + width * 0.3)) - width * 0.8;

  float ribSpacing = 2.0;
  float ribZ = mod(p.z + ribSpacing * 0.5, ribSpacing) - ribSpacing * 0.5;
  float rib = sdBox(vec3(rp.x, rp.y, ribZ), vec3(width, 0.1, 0.08));
  rib = max(rib, curve + 0.1);

  return min(curve, rib - 0.05);
}

float map(vec3 p) {
  float scale = iColumnScale;
  float columnSpacing = 4.0 * scale;
  float naveWidth = 3.0 * scale;
  float ceilingHeight = 8.0 * scale;
  float columnRadius = 0.3 * scale;
  float columnHeight = 6.0 * scale;

  vec3 rp = p;
  rp.z = mod(p.z + columnSpacing * 0.5, columnSpacing) - columnSpacing * 0.5;

  vec3 columnP = vec3(abs(rp.x) - naveWidth, rp.y, rp.z);
  float columns = sdColumn(columnP, columnRadius, columnHeight);

  float floor = p.y + 0.01;

  vec2 tileP = mod(p.xz + 0.5, 1.0) - 0.5;
  float tiles = max(floor, -sdBox(vec3(tileP.x, p.y, tileP.y), vec3(0.45, 0.02, 0.45)));

  float walls = min(
    abs(p.x + naveWidth + 1.5) - 0.3,
    abs(p.x - naveWidth - 1.5) - 0.3
  );
  walls = max(walls, -p.y);
  walls = max(walls, p.y - ceilingHeight);

  vec3 winP = p;
  winP.z = mod(p.z + columnSpacing * 0.5, columnSpacing) - columnSpacing * 0.5;
  winP.y -= 3.0;

  vec3 windowP = vec3(abs(winP.x) - (naveWidth + 1.2), winP.y, winP.z);
  float windows = sdArch(windowP, 1.2, 3.5, 0.5);

  vec3 vaultP = p;
  vaultP.z = mod(p.z + columnSpacing * 0.5, columnSpacing) - columnSpacing * 0.5;
  float vault = sdVault(vaultP, naveWidth + 1.0, ceilingHeight);

  vec3 archP = rp;
  archP.y -= columnHeight;
  vec3 sideArchP = vec3(abs(archP.x) - naveWidth, archP.y, archP.z);
  float arches = sdArch(sideArchP, 1.5, 2.0, 0.15);

  float naveArch = sdArch(archP, naveWidth * 1.8, 2.5, 0.2);
  arches = min(arches, naveArch);

  float stone = min(columns, min(tiles, min(walls, min(vault, arches))));

  objID = 1.0;

  if (windows < stone && windows < 0.5) {
    objID = 2.0;
  }

  if (tiles < columns && tiles < walls && tiles < vault) {
    objID = 3.0;
  }

  float d = min(stone, windows);

  return d;
}

float trace(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 100; i++) {
    float h = map(ro + rd * t);
    if (abs(h) < 0.001 * (t * 0.25 + 1.0) || t > FAR) break;
    t += h * 0.8;
  }
  return t;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(0.005, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

float calcAO(vec3 pos, vec3 nor) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i);
    float d = map(pos + h * nor);
    occ += (h - d) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

vec3 stainedGlassColor(vec3 p) {
  float pattern = sin(p.y * 3.0) * cos(p.z * 2.0);
  pattern += sin(p.y * 5.0 + p.z * 3.0) * 0.5;

  vec3 col = mix(iGlassColor1, iGlassColor2, pattern * 0.5 + 0.5);

  float n = noise(p * 2.0);
  col = mix(col, vec3(1.0, 0.9, 0.7), n * 0.2);

  return col;
}

float lightBeam(vec3 p, vec3 lightPos, vec3 lightDir, float bassLevel) {
  vec3 toP = p - lightPos;
  float dist = length(toP);
  float angle = dot(normalize(toP), lightDir);

  float beamWidth = 0.7 - bassLevel * 0.15;
  float beam = smoothstep(beamWidth, 0.95, angle);
  beam *= exp(-dist * 0.1);
  beam *= (1.0 + bassLevel * 0.3);

  return beam;
}

void main() {
  vec2 uv = (vUv - vec2(0.5, 0.5)) / vec2(0.35, 0.65);

  float time = iGlobalTime * iSpeed * 0.5;
  float bassLevel = clamp(iLowFreq, 0.0, 1.0) * iResponsive;
  float midLevel = clamp(iMidFreq, 0.0, 1.0) * iResponsive;
  float highLevel = clamp(iHighFreq, 0.0, 1.0) * iResponsive;

  vec3 ro = camPath(time);
  vec3 lk = camPath(time + 0.5);
  vec3 lp = ro + vec3(0.0, 2.0, 2.0);

  float FOV = 1.8;
  vec3 fwd = normalize(lk - ro);
  vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, rgt);

  vec3 rd = normalize(fwd + FOV * (uv.x * rgt + uv.y * up));

  float t = trace(ro, rd);

  vec3 col = vec3(0.02, 0.02, 0.03);

  if (t < FAR) {
    float saveObjID = objID;
    vec3 pos = ro + rd * t;
    vec3 nor = calcNormal(pos);

    if (saveObjID > 1.5 && saveObjID < 2.5) {
      vec3 glassCol = stainedGlassColor(pos);
      float glow = iGlassGlow * (1.0 + bassLevel * 0.5);

      float windowLight = max(0.0, -nor.x);
      col = glassCol * glow * (0.5 + windowLight);

      col += vec3(1.0, 0.9, 0.8) * highLevel * 0.12;

    } else {
      vec3 li = normalize(lp - pos);
      float lDist = length(lp - pos);
      float atten = 1.0 / (1.0 + lDist * 0.05 + lDist * lDist * 0.01);

      float diff = max(dot(nor, li), 0.0);
      float spec = pow(max(dot(reflect(-li, nor), -rd), 0.0), 16.0);
      float ao = calcAO(pos, nor);
      vec3 matCol = iStoneColor;

      if (saveObjID > 2.5) {
        vec2 tileCoord = floor(pos.xz + 0.5);
        float checker = mod(tileCoord.x + tileCoord.y, 2.0);
        matCol = mix(iStoneColor * 0.7, iStoneColor * 1.2, checker);

        col = matCol * (diff * 0.6 + 0.4) * atten;
        col += iLightColor * spec * 0.3;
        col *= ao;

        float reflectPulse = bassLevel * 0.5;
        vec3 reflectColor = mix(iGlassColor1, iGlassColor2, sin(pos.z * 0.5) * 0.5 + 0.5);
        float reflectPattern = sin(pos.x * 2.0) * sin(pos.z * 1.5) * 0.5 + 0.5;
        col += reflectColor * reflectPattern * reflectPulse * 0.3;

      } else {
        col = matCol * (diff * 0.5 + 0.3) * atten;
        col += iLightColor * spec * 0.2;
        col *= ao;

        float stoneNoise = noise(pos * 5.0);
        col *= 0.9 + stoneNoise * 0.2;

        float rim = 1.0 - max(dot(nor, -rd), 0.0);
        rim = pow(rim, 3.0);
        col += iLightColor * rim * bassLevel * 0.3;
      }
    }

    float columnSpacing = 4.0 * iColumnScale;
    float naveWidth = 3.0 * iColumnScale;

    vec3 winPos = pos;
    winPos.z = mod(pos.z + columnSpacing * 0.5, columnSpacing) - columnSpacing * 0.5;

    float leftBeam = lightBeam(pos, vec3(-naveWidth - 1.0, 4.5, winPos.z), vec3(1.0, -0.3, 0.0), bassLevel);
    float rightBeam = lightBeam(pos, vec3(naveWidth + 1.0, 4.5, winPos.z), vec3(-1.0, -0.3, 0.0), bassLevel);

    vec3 beamColor = mix(iGlassColor1, iGlassColor2, 0.5) * iGlassGlow;
    col += beamColor * (leftBeam + rightBeam) * 0.3 * (1.0 + bassLevel * 0.5);

    float candleFlicker = 0.8 + 0.2 * sin(iGlobalTime * 10.0 + pos.z * 2.0);
    candleFlicker *= (1.0 + midLevel * 0.3);

    float candleDist = length(vec2(pos.x, mod(pos.z + 2.0, 4.0) - 2.0));
    float candleGlow = exp(-candleDist * 2.0) * candleFlicker;
    col += iLightColor * candleGlow * 0.15;
  }

  float fogDensity = iFog;
  float fogAmount = 1.0 - exp(-t * t / FAR / FAR * 10.0 * fogDensity);
  vec3 fogColor = mix(iStoneColor * 0.1, iLightColor * 0.1, 0.5);
  col = mix(col, fogColor, fogAmount);

  float dustBase = noise(vec3(uv * 10.0, iGlobalTime * 0.5)) * 0.02;
  float dustSparkle = noise(vec3(uv * 30.0, iGlobalTime * 2.0));
  dustSparkle = pow(dustSparkle, 4.0) * highLevel * 0.05;
  float dust = dustBase + dustSparkle;
  col += iLightColor * dust * (1.0 + bassLevel);

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
		if (!CSS.supports('color', color)) throw new Error(`Invalid Cathedral color: ${color}`);
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

type CathedralFrame = Required<CathedralOptions> & {
	readonly time: number;
	readonly bands: readonly number[];
};
type CathedralState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupCathedral(canvas: HTMLCanvasElement): CathedralState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
	});
	if (!gl)
		throw new Error(
			'Cathedral requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Cathedral could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Cathedral could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Cathedral shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Cathedral shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Cathedral could not create a vertex buffer.');
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

		return {
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
					'iStoneColor',
					'iGlassColor1',
					'iGlassColor2',
					'iLightColor',
					'iSpeed',
					'iColumnScale',
					'iGlassGlow',
					'iResponsive',
					'iFog',
					'iBpm',
				].map((name) => [name, gl.getUniformLocation(program, name)]),
			),
		};
	} catch (error) {
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}
function drawCathedral(state: CathedralState, frame: CathedralFrame) {
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
	gl.uniform3fv(uniforms.iStoneColor, linearColor(frame.stoneColor));
	gl.uniform3fv(uniforms.iGlassColor1, linearColor(frame.glassColor1));
	gl.uniform3fv(uniforms.iGlassColor2, linearColor(frame.glassColor2));
	gl.uniform3fv(uniforms.iLightColor, linearColor(frame.lightColor));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 2, 0.5));
	gl.uniform1f(uniforms.iColumnScale, bounded(frame.columnScale, 0.5, 2, 1));
	gl.uniform1f(uniforms.iGlassGlow, bounded(frame.glassGlow, 0.5, 5, 2));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0, 3, 1));
	gl.uniform1f(uniforms.iFog, bounded(frame.fog, 0, 2, 1));
	gl.uniform1f(uniforms.iBpm, bounded(frame.bpm, 1, 300, 120));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error('Cathedral WebGL draw failed: ' + error);
}
function cleanupCathedral({gl, program, buffer}: CathedralState) {
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function CathedralCanvas(frame: CathedralFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<CathedralState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupCathedral(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Cathedral WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupCathedral(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Cathedral');
		try {
			drawCathedral(state.current, frame);
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
const CathedralContent: React.FC<Required<CathedralOptions> & {width: number; height: number}> = (
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
			<CathedralCanvas {...props} time={time} bands={bands} />
		</>
	);
};

const CathedralInner: React.FC<CathedralProps> = ({
	audioSrc = cathedralSchema.audioSrc.default,
	audioOffsetInSeconds = cathedralSchema.audioOffsetInSeconds.default,
	playAudio = cathedralSchema.playAudio.default,
	inputGainDb = cathedralSchema.inputGainDb.default,
	stoneColor = cathedralSchema.stoneColor.default,
	glassColor1 = cathedralSchema.glassColor1.default,
	glassColor2 = cathedralSchema.glassColor2.default,
	lightColor = cathedralSchema.lightColor.default,
	speed = cathedralSchema.speed.default,
	columnScale = cathedralSchema.columnScale.default,
	glassGlow = cathedralSchema.glassGlow.default,
	responsive = cathedralSchema.responsive.default,
	fog = cathedralSchema.fog.default,
	bpm = cathedralSchema.bpm.default,
	timeOffsetInSeconds = cathedralSchema.timeOffsetInSeconds.default,
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
			<CathedralContent
				key={audioSrc}
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={playAudio}
				inputGainDb={inputGainDb}
				stoneColor={stoneColor}
				glassColor1={glassColor1}
				glassColor2={glassColor2}
				lightColor={lightColor}
				speed={speed}
				columnScale={columnScale}
				glassGlow={glassGlow}
				responsive={responsive}
				fog={fog}
				bpm={bpm}
				timeOffsetInSeconds={timeOffsetInSeconds}
				width={drawingWidth}
				height={drawingHeight}
			/>
		</div>
	);
};
export const Cathedral = Interactive.create({
	Component: CathedralInner,
	layout: 'absolute-fill',
	componentName: '<Cathedral>',
	schema: cathedralSchema,
});
