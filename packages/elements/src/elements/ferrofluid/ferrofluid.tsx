import {Audio} from '@remotion/media';
import {
	useWindowedAudioData,
	visualizeAudio,
	type MediaUtilsAudioData,
} from '@remotion/media-utils';
import React, {
	forwardRef,
	useRef,
	useImperativeHandle,
	useId,
	useMemo,
	useLayoutEffect,
} from 'react';
import {
	cancelRender,
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type SequenceControls,
	type InteractivitySchema,
} from 'remotion';

type FerrofluidOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly color?: string;
	readonly shineColor?: string;
	readonly shineX?: number;
	readonly shineY?: number;
	readonly shineZ?: number;
	readonly shineIntensity?: number;
	readonly shineSize?: number;
	readonly pattern?: number;
	readonly fluidity?: number;
	readonly roughness?: number;
	readonly iridescence?: number;
	readonly envMapIntensity?: number;
	readonly audioLights?: boolean;
	readonly quality?: 'low' | 'medium' | 'high';
	readonly mappingMode?: 'uniform' | 'latitude' | 'radial' | 'voronoi';
	readonly autoRotate?: boolean;
	readonly rotationSpeed?: number;
};
type FerrofluidProps = InteractiveBaseProps & InteractiveTransformProps & FerrofluidOptions;
const ANALYSIS_FPS = 60;
const ferrofluidSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
		default:
			'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-music-visualization/public/demo-track.mp3',
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
	color: {type: 'color', default: '#161923', description: 'Metal tint'},
	shineColor: {type: 'color', default: '#ffbc8e', description: 'Shine color'},
	shineX: {
		type: 'number',
		default: -0.3,
		min: -3,
		max: 3,
		step: 0.1,
		description: 'Shine X (direction)',
		hiddenFromList: false,
	},
	shineY: {
		type: 'number',
		default: -1,
		min: -3,
		max: 3,
		step: 0.1,
		description: 'Shine Y (direction)',
		hiddenFromList: false,
	},
	shineZ: {
		type: 'number',
		default: -0.5,
		min: -3,
		max: 3,
		step: 0.1,
		description: 'Shine Z (direction)',
		hiddenFromList: false,
	},
	shineIntensity: {
		type: 'number',
		default: 2.6,
		min: 0,
		max: 10,
		step: 0.1,
		description: 'Shine intensity',
		hiddenFromList: false,
	},
	shineSize: {
		type: 'number',
		default: 1,
		min: 0.1,
		max: 3,
		step: 0.1,
		description: 'Shine size',
		hiddenFromList: false,
	},
	inputGainDb: {
		type: 'number',
		default: 10,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 2,
		min: 0.1,
		max: 12,
		step: 0.1,
		description: 'Spike intensity',
		hiddenFromList: false,
	},
	pattern: {
		type: 'number',
		default: 2,
		min: 1,
		max: 20,
		step: 0.1,
		description: 'Spike density',
		hiddenFromList: false,
	},
	fluidity: {
		type: 'number',
		default: 0.15,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Fluid deformation',
		hiddenFromList: false,
	},
	roughness: {
		type: 'number',
		default: 0.15,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Metal roughness',
		hiddenFromList: false,
	},
	iridescence: {
		type: 'number',
		default: 0.3,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Stylized iridescence',
		hiddenFromList: false,
	},
	envMapIntensity: {
		type: 'number',
		default: 1,
		min: 0,
		max: 2,
		step: 0.01,
		description: 'Procedural studio reflections',
		hiddenFromList: false,
	},
	audioLights: {type: 'boolean', default: true, description: 'Audio-reactive lighting'},
	quality: {
		type: 'enum',
		default: 'medium',
		variants: {low: {}, medium: {}, high: {}},
		description: 'Mesh quality (GPU cost)',
		keyframable: false,
	},
	mappingMode: {
		type: 'enum',
		default: 'uniform',
		variants: {uniform: {}, latitude: {}, radial: {}, voronoi: {}},
		description: 'Frequency mapping',
		keyframable: false,
	},
	autoRotate: {type: 'boolean', default: true, description: 'Rotate with bass-driven motion'},
	rotationSpeed: {
		type: 'number',
		default: 1,
		min: -3,
		max: 3,
		step: 0.1,
		description: 'Rotation speed',
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
};

function computeBars({
	allVisualizationValues,
	outputBarsCount = 308,
}: {
	allVisualizationValues: number[];
	outputBarsCount?: number;
}) {
	const minFreq = 20;
	const maxFreq = 22000;
	const defaultFill = 0.0025;
	const freqStep = (maxFreq - minFreq) / allVisualizationValues.length;
	const bars = Array.from({length: outputBarsCount}, () => defaultFill);
	const binSize = 1 / outputBarsCount;
	for (let index = 0; index < allVisualizationValues.length; index++) {
		const frequency = minFreq + index * freqStep;
		const logFrequency = Math.log10(frequency / minFreq) / Math.log10(maxFreq / minFreq);
		const binIndex = Math.floor(logFrequency / binSize);
		if (binIndex < outputBarsCount) {
			bars[binIndex] +=
				binIndex < Math.floor(outputBarsCount * 0.334415584415584)
					? allVisualizationValues[index] * 1.3
					: allVisualizationValues[index];
			if (outputBarsCount !== 308 && binIndex >= Math.floor(outputBarsCount * 0.9845)) {
				bars[binIndex] = defaultFill;
			}
		}
	}
	return bars.filter((b) => b !== defaultFill && !Number.isNaN(b));
}

function spectrumBars(input: AudioInput, count = 308) {
	if (input.sourceTime < 0 || input.sourceTime >= input.audioData.durationInSeconds)
		return Array(count).fill(0) as number[];
	const frequencies = visualizeAudio({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame: input.sourceTime * ANALYSIS_FPS,
		fps: ANALYSIS_FPS,
		numberOfSamples: 4096,
		optimizeFor: 'speed',
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		outputBarsCount: count,
	});
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const audioCache = new Map<string, number[]>();
function barsAt(input: AudioInput, time: number) {
	const frame = Math.round(Math.max(0, time) * ANALYSIS_FPS);
	if (time < 0 || time >= input.audioData.durationInSeconds) return [];
	const key = `${input.audioData.resultId}:${input.dataOffsetInSeconds}:${frame}`;
	const cached = audioCache.get(key);
	if (cached) return cached;
	const bars = spectrumBars({...input, sourceTime: frame / ANALYSIS_FPS});
	audioCache.set(key, bars);
	if (audioCache.size > 600) audioCache.delete(audioCache.keys().next().value!);
	return bars;
}
function createFerrofluidAudio(input: AudioInput, inputGainDb: number) {
	const gain = 10 ** (clamp(inputGainDb, -30, 30) / 20);
	const bars = barsAt(input, input.sourceTime).map((value) => value * gain);
	const texture = new Uint8Array(Math.max(1, bars.length) * 4);
	for (let i = 0; i < Math.max(1, bars.length); i++) {
		texture[i * 4] = Math.round(clamp(bars[i] ?? 0, 0, 1) * 255);
		texture[i * 4 + 3] = 255;
	}
	const last = Math.round(input.sourceTime * ANALYSIS_FPS);
	let momentum = 0;
	for (let f = Math.max(0, last - 240); f <= last; f++) {
		const bass = barsAt(input, f / ANALYSIS_FPS)[11] ?? 0;
		momentum = (momentum + bass * gain) * 0.95;
	}
	return {bars, texture, momentum};
}

function createSphere(segments: number) {
	const positions = new Float32Array((segments + 1) ** 2 * 3);
	const indices: number[] = [];
	for (let y = 0; y <= segments; y++) {
		const theta = (y / segments) * Math.PI;
		for (let x = 0; x <= segments; x++) {
			const phi = (x / segments) * Math.PI * 2;
			const offset = (y * (segments + 1) + x) * 3;
			positions.set(
				[
					2 * Math.sin(theta) * Math.cos(phi),
					2 * Math.cos(theta),
					2 * Math.sin(theta) * Math.sin(phi),
				],
				offset,
			);
			if (y < segments && x < segments) {
				const a = y * (segments + 1) + x;
				const b = a + segments + 1;
				if (y > 0) indices.push(a, a + 1, b);
				if (y < segments - 1) indices.push(a + 1, b + 1, b);
			}
		}
	}
	return {positions, indices: new Uint32Array(indices)};
}

const displacementSource = `
uniform float iGlobalTime;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iIntensity;
uniform float iPatternDensity;
uniform float iFluidity;
uniform sampler2D iSoundTexture;

out float vDisplacement;
out vec3 vWorldNormal;
out vec3 vWorldPosition;

vec4 _permute(vec4 x) { return mod(((x * 34.0) + 10.0) * x, 289.0); }
vec4 _taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod(i, 289.0);
  vec4 p = _permute(_permute(_permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = _taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 _hash3(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

vec2 voronoi3d(vec3 p, float density) {
  vec3 scaledP = p * density;
  vec3 i = floor(scaledP);
  vec3 f = fract(scaledP);

  float minDist = 1.0;
  float cellHash = 0.0;

  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 neighbor = vec3(float(x), float(y), float(z));
    vec3 randomOffset = _hash3(i + neighbor);
    randomOffset = 0.5 + 0.5 * sin(iGlobalTime * 0.3 + 6.2831 * randomOffset);
    vec3 diff = neighbor + randomOffset - f;
    float dist = length(diff);
    if (dist < minDist) {
      minDist = dist;
      cellHash = fract(dot(i + neighbor, vec3(7.13, 157.97, 113.37)));
    }
  }

  return vec2(minDist, cellHash);
}

float sampleAudio(vec3 pos, vec3 norm, float cellHash) {
  float texCoord;

  #if MAPPING_MODE == 0
    texCoord = 0.15;
  #elif MAPPING_MODE == 1
    texCoord = clamp(abs(norm.y), 0.0, 0.99);
  #elif MAPPING_MODE == 2
    texCoord = clamp((norm.y + 1.0) * 0.5, 0.0, 0.99);
  #elif MAPPING_MODE == 3
    texCoord = clamp(cellHash, 0.0, 0.99);
  #endif

  return texture(iSoundTexture, vec2(texCoord, 0.5)).r;
}

float computeDisplacement(vec3 pos, vec3 norm) {
  float time = iGlobalTime;
  float intensity = iIntensity;
  float fluidity = iFluidity;

  float warp = 0.0;
  float warpSpeed = 0.15 + fluidity * 0.35;
  float warpScale = 0.3 + fluidity * 0.2;
  warp += fluidity * 1.2 * snoise(pos * warpScale + vec3(time * warpSpeed, 0.0, time * warpSpeed * 0.7));
  warp += fluidity * 0.5 * snoise(pos * warpScale * 2.3 + vec3(0.0, time * warpSpeed * 1.3, 0.0));

  float base = 0.0;
  float amp = 0.2 + fluidity * 0.5;
  float baseSpeed = 0.2 + fluidity * 0.4;
  float freq = 0.8;

  #if NOISE_OCTAVES >= 1
    base += amp * snoise(pos * freq + vec3(time * baseSpeed));
  #endif
  #if NOISE_OCTAVES >= 2
    base += (amp * 0.5) * snoise(pos * freq * 2.0 + vec3(time * baseSpeed * 1.5));
  #endif
  #if NOISE_OCTAVES >= 3
    base += (amp * 0.25) * snoise(pos * freq * 4.0 + vec3(time * baseSpeed * 2.0));
  #endif
  #if NOISE_OCTAVES >= 4
    base += (amp * 0.125) * snoise(pos * freq * 8.0 + vec3(time * baseSpeed * 2.8));
  #endif

  float lowEnergy = iLowFreq;
  float midEnergy = iMidFreq;
  float globalEnergy = mix(lowEnergy, midEnergy, 0.3);
  base *= 0.3 + globalEnergy * 1.5;

  float density = iPatternDensity;
  vec2 vor = voronoi3d(pos, density);
  float distToCenter = vor.x;
  float cellHash = vor.y;

  float audioEnergy = sampleAudio(pos, norm, cellHash);
  float spikeRaw = 1.0 - clamp(distToCenter / 0.5, 0.0, 1.0);
  float spikeSharpness = 3.0 + intensity * 2.0;
  float spike = pow(spikeRaw, spikeSharpness);

  float spikeHeight = spike * audioEnergy * intensity * 1.5;
  spikeHeight += spike * lowEnergy * intensity * 0.5;

  float displacement = warp + base * intensity * 0.3 + spikeHeight;
  displacement += 0.02 * sin(pos.x * 2.0 + time) * sin(pos.y * 2.0 + time * 0.7);

  return displacement;
}
`;

function vertexSource(
	quality: Required<FerrofluidOptions>['quality'],
	mapping: Required<FerrofluidOptions>['mappingMode'],
) {
	const mode = {uniform: 0, latitude: 1, radial: 2, voronoi: 3}[mapping];
	const octaves = {low: 1, medium: 2, high: 3}[quality];
	return `#version 300 es
precision highp float;
#define MAPPING_MODE ${mode}
#define NOISE_OCTAVES ${octaves}
in vec3 position;
uniform vec2 uRotation;
uniform float uAspect;
${displacementSource}
mat3 rotation() {
 float x = uRotation.x, y = uRotation.y;
 return mat3(cos(y), 0., -sin(y), 0., 1., 0., sin(y), 0., cos(y)) *
  mat3(1., 0., 0., 0., cos(x), sin(x), 0., -sin(x), cos(x));
}
void main() {
 vec3 n = normalize(position);
 float disp = computeDisplacement(position, n);
 float eps = 0.01;
 vec3 t1 = normalize(cross(n, abs(n.y) < 0.999 ? vec3(0., 1., 0.) : vec3(1., 0., 0.)));
 vec3 t2 = normalize(cross(n, t1));
 float d1 = computeDisplacement(position + t1 * eps, normalize(position + t1 * eps));
 float d2 = computeDisplacement(position + t2 * eps, normalize(position + t2 * eps));
 vec3 displacedNormal = normalize(n - (d1 - disp) / eps * t1 - (d2 - disp) / eps * t2);
 mat3 model = rotation();
 vWorldNormal = model * displacedNormal;
 vWorldPosition = model * (position + n * disp);
 vDisplacement = disp;
 vec3 p = vWorldPosition - vec3(0., 0., 10.);
 float f = 2.747477;
 vec2 fit = vec2(min(1., 1. / uAspect), min(1., uAspect));
 gl_Position = vec4(p.xy * f * fit, -1.004008 * p.z - 0.200401, -p.z);
}`;
}

const fragmentSource = `#version 300 es
precision highp float;
in vec3 vWorldNormal;
in vec3 vWorldPosition;
in float vDisplacement;
uniform vec3 uColor;
uniform vec3 uShineColor;
uniform vec3 uShinePosition;
uniform float uShineIntensity;
uniform float uShineSize;
uniform float uRoughness;
uniform float uIridescence;
uniform float uEnvironment;
uniform float uAudioLights;
uniform float uHighQuality;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
out vec4 outColor;
const float PI = 3.14159265359;
vec3 fresnel(float c, vec3 f0) { return f0 + (1. - f0) * pow(1. - c, 5.); }
vec3 light(vec3 n, vec3 v, vec3 direction, vec3 radiance, vec3 f0, float rough) {
 vec3 l = normalize(direction), h = normalize(l + v);
 float nl = max(dot(n, l), 0.), nv = max(dot(n, v), 0.001);
 float nh = max(dot(n, h), 0.), vh = max(dot(v, h), 0.);
 float a = rough * rough, a2 = a * a;
 float d = nh * nh * (a2 - 1.) + 1.;
 float distribution = a2 / max(PI * d * d, 0.00001);
 float k = (rough + 1.) * (rough + 1.) / 8.;
 float visibility = (nl / (nl * (1. - k) + k)) * (nv / (nv * (1. - k) + k));
 return radiance * distribution * visibility * fresnel(vh, f0) / max(4. * nv, 0.001);
}
float softbox(vec3 r, vec3 center, vec3 axis, vec2 size) {
 vec3 c = normalize(center);
 vec3 up = abs(dot(c, axis)) > 0.999 ? (abs(c.x) < 0.9 ? vec3(1., 0., 0.) : vec3(0., 1., 0.)) : axis;
 vec3 x = normalize(cross(c, up)), y = cross(x, c);
 vec2 p = vec2(dot(r, x), dot(r, y)) / size;
 return exp(-dot(p * p, p * p)) * smoothstep(0., 0.25, dot(r, c));
}
void main() {
 vec3 n = normalize(vWorldNormal);
 vec3 v = normalize(vec3(0., 0., 10.) - vWorldPosition);
 float nv = max(dot(n, v), 0.);
 float rough = clamp(uRoughness, 0.07, 1.);
 vec3 f0 = clamp(uColor + vec3(0.08), vec3(0.04), vec3(0.95));
 vec3 film = 0.5 + 0.5 * cos(vec3(0., 2.1, 4.2) + (1. - nv) * 13. + vDisplacement * 1.5);
 f0 = mix(f0, f0 * (0.5 + film * 1.6), uIridescence * 0.65);
 vec3 r = reflect(-v, n);
 vec2 spread = vec2(0.12, 0.48) + rough * 0.48;
 vec3 environment = vec3(0.12, 0.15, 0.21) * (0.6 + 0.4 * n.y);
 environment += vec3(4.8, 4.5, 4.2) * softbox(r, vec3(-1., 1.2, 1.), vec3(0., 1., 0.), spread);
 environment += vec3(1.6, 2.5, 4.) * softbox(r, vec3(1.3, 0.2, 0.5), vec3(0., 1., 0.), spread * vec2(0.55, 1.));
 environment += uShineColor * uShineIntensity * softbox(r, uShinePosition, vec3(1., 0., 0.), spread * uShineSize);
 vec3 result = environment * fresnel(nv, f0) * uEnvironment / (1. + rough * 2.);
 vec3 direct = light(n, v, vec3(0., 2., 0.1), vec3(1.) * (0.3 + iLowFreq * uAudioLights * 2.5), f0, rough);
 direct += light(n, v, vec3(1., 2., 1.), vec3(1., 0.88, 0.72) * (0.25 + iLowFreq * uAudioLights * 2.), f0, rough);
 direct += light(n, v, vec3(-1., -2., -1.), vec3(1.) * (0.15 + iMidFreq * uAudioLights * 1.8), f0, rough);
 direct += light(n, v, vec3(-1., 2., 1.), vec3(0.7, 0.82, 1.) * (0.15 + iHighFreq * uAudioLights * 1.5), f0, rough);
 direct += light(n, v, vec3(1., -2., -1.), vec3(1.) * 0.15, f0, rough);
 result += direct * (1. + pow(1. - nv, 3.) * 0.5);
 result += uColor * 0.15;
 result += vec3(0.15, 0.04, 0.02) * smoothstep(0.3, 1.5, vDisplacement) * (1. + iLowFreq * 2.) * uHighQuality;
 result = max(result, vec3(0.));
 result = result / (1. + result);
 result = mix(result * 12.92, 1.055 * pow(result, vec3(1. / 2.4)) - 0.055, step(vec3(0.0031308), result));
 outColor = vec4(result, 1.);
}`;

type FerrofluidState = {
	gl: WebGL2RenderingContext;
	program: WebGLProgram;
	buffers: WebGLBuffer[];
	vao: WebGLVertexArrayObject;
	texture: WebGLTexture;
	count: number;
	uniforms: Record<string, WebGLUniformLocation | null>;
};
function setupFerrofluid(
	canvas: HTMLCanvasElement,
	quality: Required<FerrofluidOptions>['quality'],
	mapping: Required<FerrofluidOptions>['mappingMode'],
): FerrofluidState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
		depth: true,
	});
	if (!gl) throw new Error('Ferrofluid requires WebGL2. Enable browser graphics acceleration.');
	const program = gl.createProgram();
	if (!program) throw new Error('Ferrofluid could not create a program.');
	const shaders: WebGLShader[] = [],
		buffers: WebGLBuffer[] = [];
	let texture: WebGLTexture | null = null;
	let vao: WebGLVertexArrayObject | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexSource(quality, mapping)],
			[gl.FRAGMENT_SHADER, fragmentSource],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Ferrofluid could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Ferrofluid shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Ferrofluid shader linking failed: ${gl.getProgramInfoLog(program)}`);
		vao = gl.createVertexArray();
		if (!vao) throw new Error('Ferrofluid could not create a vertex array.');
		gl.bindVertexArray(vao);
		const mesh = createSphere({low: 64, medium: 128, high: 256}[quality]);
		for (const [target, data] of [
			[gl.ARRAY_BUFFER, mesh.positions],
			[gl.ELEMENT_ARRAY_BUFFER, mesh.indices],
		] as const) {
			const buffer = gl.createBuffer();
			if (!buffer) throw new Error('Ferrofluid could not create a mesh buffer.');
			buffers.push(buffer);
			gl.bindBuffer(target, buffer);
			gl.bufferData(target, data, gl.STATIC_DRAW);
		}
		const position = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
		texture = gl.createTexture();
		if (!texture) throw new Error('Ferrofluid could not create an audio texture.');
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const uniforms = Object.fromEntries(
			[
				'iGlobalTime',
				'iLowFreq',
				'iMidFreq',
				'iHighFreq',
				'iIntensity',
				'iPatternDensity',
				'iFluidity',
				'iSoundTexture',
				'uRotation',
				'uAspect',
				'uColor',
				'uShineColor',
				'uShinePosition',
				'uShineIntensity',
				'uShineSize',
				'uRoughness',
				'uIridescence',
				'uEnvironment',
				'uAudioLights',
				'uHighQuality',
			].map((name) => [name, gl.getUniformLocation(program, name)]),
		);
		return {gl, program, buffers, vao, texture, count: mesh.indices.length, uniforms};
	} catch (error) {
		gl.deleteTexture(texture);
		gl.deleteVertexArray(vao);
		for (const buffer of buffers) gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}
type FerrofluidFrame = Required<FerrofluidOptions> & {
	time: number;
	audio: ReturnType<typeof createFerrofluidAudio>;
};
function drawFerrofluid(state: FerrofluidState, frame: FerrofluidFrame) {
	const {gl, program, uniforms: u} = state;
	gl.useProgram(program);
	gl.bindVertexArray(state.vao);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
	gl.disable(gl.BLEND);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	const intensity = clamp(frame.intensity, 0.1, 12);
	for (const [name, value] of Object.entries({
		iGlobalTime: frame.time,
		iLowFreq: frame.audio.bars[11] ?? 0,
		iMidFreq: frame.audio.bars[45] ?? 0,
		iHighFreq: frame.audio.bars[85] ?? 0,
		iIntensity: intensity,
		iPatternDensity: clamp(frame.pattern, 1, 20),
		iFluidity: clamp(frame.fluidity, 0, 1),
		uAspect: frame.width / frame.height,
		uRoughness: clamp(frame.roughness, 0, 1),
		uIridescence: frame.quality === 'low' ? 0 : clamp(frame.iridescence, 0, 1),
		uEnvironment: clamp(frame.envMapIntensity, 0, 2),
		uShineIntensity: clamp(frame.shineIntensity, 0, 10),
		uShineSize: clamp(frame.shineSize, 0.1, 3),
		uAudioLights: Number(frame.audioLights),
		uHighQuality: Number(frame.quality === 'high'),
	}))
		gl.uniform1f(u[name], value);
	const motion = frame.audio.momentum * intensity;
	gl.uniform2f(
		u.uRotation,
		frame.autoRotate ? (frame.time * 0.6 + motion * 0.02) * frame.rotationSpeed : 0,
		frame.autoRotate ? (-frame.time * 0.402 + motion * 0.015) * frame.rotationSpeed : 0,
	);
	gl.uniform3fv(u.uColor, linearColor(frame.color));
	gl.uniform3fv(u.uShineColor, linearColor(frame.shineColor));
	const shinePosition = [frame.shineX, frame.shineY, frame.shineZ].map((value) =>
		clamp(value, -3, 3),
	);
	gl.uniform3fv(
		u.uShinePosition,
		Math.hypot(...shinePosition) < 1e-6 ? [-0.3, -1, -0.5] : shinePosition,
	);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.audio.texture.length / 4,
		1,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		frame.audio.texture,
	);
	gl.uniform1i(u.iSoundTexture, 0);
	gl.drawElements(gl.TRIANGLES, state.count, gl.UNSIGNED_INT, 0);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Ferrofluid WebGL draw failed: ${error}`);
}
function cleanupFerrofluid({gl, program, texture, buffers, vao}: FerrofluidState) {
	gl.deleteTexture(texture);
	for (const buffer of buffers) gl.deleteBuffer(buffer);
	gl.deleteVertexArray(vao);
	gl.deleteProgram(program);
}
function FerrofluidCanvas(frame: FerrofluidFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<FerrofluidState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupFerrofluid(canvas, frame.quality, frame.mappingMode);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Ferrofluid WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupFerrofluid(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, [frame.quality, frame.mappingMode]);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Ferrofluid');
		try {
			drawFerrofluid(state.current, frame);
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
	resultId: 'ferrofluid-silence',
	isRemote: false,
};
function FerrofluidContent(props: Required<FerrofluidOptions>) {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const audio = useMemo(
		() =>
			createFerrofluidAudio(
				{audioData: audioData ?? silentAudio, dataOffsetInSeconds, sourceTime},
				props.inputGainDb,
			),
		[audioData, dataOffsetInSeconds, sourceTime, props.inputGainDb],
	);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<FerrofluidCanvas {...props} time={frame / fps} audio={audio} />
		</>
	);
}
const FerrofluidInner = forwardRef<
	HTMLDivElement,
	FerrofluidProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = ferrofluidSchema.width.default,
			height = ferrofluidSchema.height.default,
			audioSrc = ferrofluidSchema.audioSrc.default,
			audioOffsetInSeconds = ferrofluidSchema.audioOffsetInSeconds.default,
			playAudio = ferrofluidSchema.playAudio.default,
			inputGainDb = ferrofluidSchema.inputGainDb.default,
			intensity = ferrofluidSchema.intensity.default,
			color = ferrofluidSchema.color.default,
			shineColor = ferrofluidSchema.shineColor.default,
			shineX = ferrofluidSchema.shineX.default,
			shineY = ferrofluidSchema.shineY.default,
			shineZ = ferrofluidSchema.shineZ.default,
			shineIntensity = ferrofluidSchema.shineIntensity.default,
			shineSize = ferrofluidSchema.shineSize.default,
			pattern = ferrofluidSchema.pattern.default,
			fluidity = ferrofluidSchema.fluidity.default,
			roughness = ferrofluidSchema.roughness.default,
			iridescence = ferrofluidSchema.iridescence.default,
			envMapIntensity = ferrofluidSchema.envMapIntensity.default,
			audioLights = ferrofluidSchema.audioLights.default,
			quality = ferrofluidSchema.quality.default,
			mappingMode = ferrofluidSchema.mappingMode.default,
			autoRotate = ferrofluidSchema.autoRotate.default,
			rotationSpeed = ferrofluidSchema.rotationSpeed.default,
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
				name={name ?? 'Ferrofluid'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{boxSizing: 'border-box', width, height, overflow: 'hidden', ...style}}
				>
					<FerrofluidContent
						key={audioSrc}
						{...{
							width,
							height,
							audioSrc,
							audioOffsetInSeconds,
							playAudio,
							inputGainDb,
							intensity,
							color,
							shineColor,
							shineX,
							shineY,
							shineZ,
							shineIntensity,
							shineSize,
							pattern,
							fluidity,
							roughness,
							iridescence,
							envMapIntensity,
							audioLights,
							quality,
							mappingMode,
							autoRotate,
							rotationSpeed,
						}}
					/>
				</div>
			</Sequence>
		);
	},
);
export const Ferrofluid = Interactive.withSchema({
	Component: FerrofluidInner,
	componentName: '<Ferrofluid>',
	componentIdentity: null,
	schema: ferrofluidSchema,
	supportsEffects: false,
}) as React.FC<FerrofluidProps>;
