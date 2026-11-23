import {Audio} from '@remotion/media';
import {
	useWindowedAudioData,
	visualizeAudio,
	type MediaUtilsAudioData,
} from '@remotion/media-utils';
import React, {useRef, useId, useMemo, useLayoutEffect} from 'react';
import {
	Interactive,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	cancelRender,
	type InteractiveTransformProps,
	type InteractivitySchema,
} from 'remotion';

type CircleOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly colorMode?: 'gradient' | 'gradient-3' | 'rainbow';
	readonly middleColor?: string;
	readonly rainbowSpeed?: number;
	readonly saturation?: number;
	readonly brightness?: number;
	readonly barWidth?: number;
	readonly lineThickness?: number;
	readonly dotSize?: number;
	readonly showLines?: boolean;
	readonly radius?: number;
	readonly count?: number;
	readonly lineWidth?: number;
	readonly circleVariant?: 'radial-bars' | 'glow-ring' | 'waveform-ring' | 'dotted-ring';
};

type CircleProps = InteractiveTransformProps & CircleOptions;

const circleSchema = {
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
	startColor: {type: 'color', default: '#aa8bff', description: 'Start color'},
	endColor: {type: 'color', default: '#51e8cc', description: 'End color'},
	colorMode: {
		type: 'enum',
		default: 'gradient',
		description: 'Color mode',
		variants: {gradient: {}, 'gradient-3': {}, rainbow: {}},
	},
	middleColor: {
		type: 'color',
		default: '#f567f5',
		description: 'Middle color for three-stop gradients',
	},
	rainbowSpeed: {type: 'number', default: 1, min: 0, max: 10, step: 0.1, hiddenFromList: false},
	saturation: {type: 'number', default: 0.85, min: 0, max: 1, step: 0.01, hiddenFromList: false},
	brightness: {type: 'number', default: 0.85, min: 0, max: 1, step: 0.01, hiddenFromList: false},
	barWidth: {
		type: 'number',
		default: 0.5,
		min: 0.05,
		max: 1,
		step: 0.01,
		description: 'Radial bar width',
		hiddenFromList: false,
	},
	lineThickness: {
		type: 'number',
		default: 3,
		min: 0.1,
		max: 5,
		step: 0.1,
		description: 'Waveform ring thickness',
		hiddenFromList: false,
	},
	dotSize: {
		type: 'number',
		default: 3,
		min: 0.1,
		max: 5,
		step: 0.1,
		description: 'Dotted ring size',
		hiddenFromList: false,
	},
	showLines: {type: 'boolean', default: true, description: 'Glow ring horizontal rays'},
	circleVariant: {
		type: 'enum',
		default: 'radial-bars',
		description: 'Treatment',
		variants: {
			'radial-bars': {},
			'glow-ring': {},
			'waveform-ring': {},
			'dotted-ring': {},
		},
	},
	radius: {
		type: 'number',
		default: 0.5,
		min: 0.05,
		max: 0.8,
		step: 0.01,
		description: 'Radius',
		hiddenFromList: false,
	},
	count: {
		type: 'number',
		default: 64,
		min: 5,
		max: 150,
		step: 1,
		description: 'Count',
		hiddenFromList: false,
	},
	lineWidth: {
		type: 'number',
		default: 3,
		min: 0.5,
		max: 10,
		step: 0.5,
		description: 'Line or dot width',
		hiddenFromList: false,
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
	intensity: {
		type: 'number',
		default: 2.5,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Intensity',
		hiddenFromList: false,
	},
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
	readonly fps: number;
};

// Preserve every log-spaced slot, including silence and frequencies above Nyquist.
function computeBars({
	allVisualizationValues,
	sampleRate = 44100,
	outputBarsCount = 308,
}: {
	allVisualizationValues: number[];
	sampleRate?: number;
	outputBarsCount?: number;
}) {
	const binWidth = sampleRate / (allVisualizationValues.length * 2);
	return Array.from({length: outputBarsCount}, (_, band) => {
		const low = 20 * 1100 ** (band / outputBarsCount);
		const high = 20 * 1100 ** ((band + 1) / outputBarsCount);
		const center = Math.sqrt(low * high);
		if (center >= sampleRate / 2 || !Number.isFinite(binWidth) || binWidth <= 0) return 0;
		const first = Math.max(1, Math.ceil(low / binWidth));
		const end = Math.min(allVisualizationValues.length, Math.ceil(high / binWidth));
		let amplitude = 0;
		if (end > first) {
			for (let bin = first; bin < end; bin++)
				amplitude = Math.max(amplitude, allVisualizationValues[bin] || 0);
		} else {
			const position = center / binWidth,
				lower = Math.floor(position);
			amplitude =
				(allVisualizationValues[lower] || 0) * (1 - position + lower) +
				(allVisualizationValues[lower + 1] || 0) * (position - lower);
		}
		return amplitude * 3.5 * 10 ** ((4.5 * Math.log2(center / 1000)) / 20);
	});
}

function circleBands(variant: Required<CircleOptions>['circleVariant'], count: number) {
	return variant === 'glow-ring'
		? 160
		: variant === 'waveform-ring'
			? 308
			: Math.floor(count / 2) + 1;
}

function barAtFrequency(bars: number[], frequency: number) {
	return (
		bars[
			Math.max(
				0,
				Math.min(
					bars.length - 1,
					Math.floor((Math.log(frequency / 20) / Math.log(1100)) * bars.length),
				),
			)
		] ?? 0
	);
}

function spectrumBars(input: AudioInput, count = 308) {
	if (input.sourceTime < 0 || input.sourceTime >= input.audioData.durationInSeconds)
		return Array(count).fill(0) as number[];
	const frequencies = visualizeAudio({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame: input.sourceTime * input.fps,
		fps: input.fps,
		numberOfSamples: 4096,
		optimizeFor: 'speed',
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		sampleRate: input.audioData.sampleRate,
		outputBarsCount: count,
	});
}

// prettier-ignore
const dottedRingFragment = `
uniform float iGlobalTime;
uniform sampler2D iTexture;

uniform float iRadius;
uniform float iCount;
uniform float iDotSize;

uniform vec3 iStartColor;
uniform vec3 iEndColor;

uniform float iIntensity;
uniform float iOpacity;

uniform int iColorMode;
uniform float iRainbowSpeed;
uniform float iRainbowSaturation;
uniform float iRainbowBrightness;

varying vec2 vUv;

#define M_PI 3.14159265359

vec2 iResolution = vec2(1920.0, 1080.0);

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 getBaseColor(float t) {
    if (iColorMode == 2) {
        float hue = t + iGlobalTime * iRainbowSpeed * 0.1;
        return hsv2rgb(vec3(fract(hue), iRainbowSaturation, iRainbowBrightness));
    }
    return mix(iStartColor, iEndColor, t);
}

void main() {
    vec2 fragPos = (vUv - 0.5) * 2.0;
    fragPos.x *= iResolution.x / iResolution.y;

    float angle = atan(fragPos.x, fragPos.y);

    float dots = iCount;
    float angleStep = 2.0 * M_PI / dots;
    float nearestDotAngle = floor(angle / angleStep + 0.5) * angleStep;
    float dotIndex = mod(floor(angle / angleStep + 0.5), dots);
    float mirroredBand = min(dotIndex, dots - dotIndex);
    float t = mirroredBand / (iBands - 1.0);

    float freq = texture(iTexture, vec2((mirroredBand + 0.5) / iBands, 0.5)).x;

    vec2 dotCenter = vec2(sin(nearestDotAngle), cos(nearestDotAngle)) * iRadius;
    float baseDotRadius = iDotSize * 0.015;
    float pulseDotRadius = baseDotRadius * (1.0 + freq * iIntensity * 0.5);

    float d = length(fragPos - dotCenter) - pulseDotRadius;
    float aa = fwidth(d);
    float alpha = 1.0 - smoothstep(0.0, aa, d);

    float glow = pulseDotRadius * 2.0 / (length(fragPos - dotCenter) + 0.001);
    glow = clamp(glow, 0.0, 1.0) * 0.15 * freq * iIntensity;

    vec3 color = getBaseColor(t);

    vec3 hsvColor = rgb2hsv(color);
    float brightMul = freq * iIntensity * 0.4;
    hsvColor.z += brightMul;
    hsvColor.y = max(0.0, hsvColor.y - brightMul * 0.2);
    color = hsv2rgb(hsvColor);

    float finalAlpha = (alpha + glow) * iOpacity;
    float edgeFade = smoothstep(0.0, 0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    finalAlpha *= smoothstep(0.01, 0.05, finalAlpha / max(iOpacity, 0.0001)) * edgeFade;

    gl_FragColor = vec4(color, finalAlpha);
}
`;

// prettier-ignore
const waveformRingFragment = `
uniform float iGlobalTime;
uniform sampler2D iTexture;

uniform float iRadius;
uniform float iLineThickness;

uniform vec3 iStartColor;
uniform vec3 iEndColor;

uniform float iIntensity;
uniform float iOpacity;

uniform int iColorMode;
uniform float iRainbowSpeed;
uniform float iRainbowSaturation;
uniform float iRainbowBrightness;

varying vec2 vUv;

#define M_PI 3.14159265359

vec2 iResolution = vec2(1920.0, 1080.0);

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 getBaseColor(float t) {
    if (iColorMode == 2) {
        float hue = t + iGlobalTime * iRainbowSpeed * 0.1;
        return hsv2rgb(vec3(fract(hue), iRainbowSaturation, iRainbowBrightness));
    }
    return mix(iStartColor, iEndColor, t);
}

void main() {
    vec2 fragPos = (vUv - 0.5) * 2.0;
    fragPos.x *= iResolution.x / iResolution.y;

    float normalizedAngle = abs(atan(fragPos.x, fragPos.y)) / M_PI;
    float dist = length(fragPos);

    float position = normalizedAngle * iBands - 0.5;
    float index = floor(position);
    float a = texture(iTexture, vec2((clamp(index, 0.0, iBands - 1.0) + 0.5) / iBands, 0.5)).x;
    float b = texture(iTexture, vec2((clamp(index + 1.0, 0.0, iBands - 1.0) + 0.5) / iBands, 0.5)).x;
    float freq = mix(a, b, smoothstep(0.0, 1.0, position - index));
    float displacement = freq * iIntensity * 0.15;
    float waveRadius = iRadius + displacement;

    float thickness = iLineThickness * 0.005;
    float ringDist = abs(dist - waveRadius);
    float aa = fwidth(ringDist);
    float alpha = 1.0 - smoothstep(thickness - aa, thickness + aa, ringDist);

    float glow = thickness * 3.0 / (ringDist + 0.001);
    glow = clamp(glow, 0.0, 1.0) * 0.3;

    float t = normalizedAngle;
    vec3 color = getBaseColor(t);

    vec3 hsvColor = rgb2hsv(color);
    float brightMul = freq * iIntensity * 0.5;
    hsvColor.z += brightMul;
    hsvColor.y = max(0.0, hsvColor.y - brightMul * 0.3);
    color = hsv2rgb(hsvColor);

    float finalAlpha = (alpha + glow) * iOpacity;
    finalAlpha *= smoothstep(iRadius * 0.3, iRadius * 0.7, dist);
    float edgeFade = smoothstep(0.0, 0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    finalAlpha *= smoothstep(0.01, 0.05, finalAlpha / max(iOpacity, 0.0001)) * edgeFade;

    gl_FragColor = vec4(color, finalAlpha);
}
`;

// prettier-ignore
const radialBarsFragment = `
uniform float iGlobalTime;
uniform sampler2D iTexture;

uniform float iWidth;
uniform float iCount;
uniform float iRadius;

uniform vec3 iStartColor;
uniform vec3 iEndColor;

uniform float iIntensity;
uniform bool iSmooth;
uniform float iLowFreq;
uniform float iOpacity;

uniform int iColorMode;
uniform float iRainbowSpeed;
uniform float iRainbowSaturation;
uniform float iRainbowBrightness;
uniform bool iShowLines;

varying vec2 vUv;

#define M_PI 3.14159265359

vec2 iResolution = vec2(1920.0, 1080.0);

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 getBaseColor(float t) {
    if (iColorMode == 2) {
        float hue = t + iGlobalTime * iRainbowSpeed * 0.1;
        return hsv2rgb(vec3(fract(hue), iRainbowSaturation, iRainbowBrightness));
    }
    return mix(iStartColor, iEndColor, t);
}

float capsuleDistance(vec2 uv, vec2 start, float len, float radius) {
    vec2 p = uv - start;
    p.y -= clamp(p.y, 0.0, len);
    return length(p) - radius;
}

float band(float index) {
    return texture(iTexture, vec2((clamp(index, 0.0, iBands - 1.0) + 0.5) / iBands, 0.5)).x;
}

vec2 rotate(vec2 point, vec2 center, float angle)
{
    float s = sin(radians(angle));
    float c = cos(radians(angle));
    point.x -= center.x;
    point.y -= center.y;
    float x = point.x * c - point.y * s;
    float y = point.x * s + point.y * c;
    point.x = x + center.x;
    point.y = y + center.y;
    return point;
}

vec4 basic()
{
    float aspect = iResolution.x / iResolution.y;
    vec2 uv = vUv;
    uv.x *= aspect;
    vec4 color = mix(vec4(0.0, 0.0, 0.0, 0.0), vec4(0.0, 0.0, 0.0, 0.0), distance(vec2(aspect/2.0, 0.5), uv));

    float RAYS = iCount;
    float RADIUS = iRadius;
    float RAY_LENGTH = 0.6;
    float inside = (1.0 - RAY_LENGTH) * RADIUS;
    float outside = RADIUS - inside;
    float barWidth = iBarWidth * 2.0 * M_PI * inside / RAYS;
    vec2 center = vec2(aspect / 2.0, 0.5);
    float aa = max(fwidth(uv.x), fwidth(uv.y));

    for (int i = 1; float(i) <= RAYS; i++)
    {
        float ray = mod(float(i), RAYS);
        float mirroredBand = min(ray, RAYS - ray);
        float t = mirroredBand / (iBands - 1.0);
        float len = outside * band(mirroredBand) * iIntensity / 2.5;

        vec3 rayColor = getBaseColor(t);
        vec3 hsvColor = rgb2hsv(rayColor);
        float multiplyer = len / iIntensity * 6.0;
        vec3 adjustedColorHsv = vec3(hsvColor.x, hsvColor.y - multiplyer, hsvColor.z + multiplyer * 1.0 * 3.0);
        rayColor = hsv2rgb(adjustedColorHsv);

        float d = capsuleDistance(rotate(uv, center, 360.0/RAYS*float(i)), vec2(center.x, center.y+inside), len, barWidth / 2.0);
        float coverage = clamp(0.5 - d / aa, 0.0, 1.0);
        float alpha = max(color.a, coverage);
        color.rgb = mix(color.rgb, rayColor, coverage / max(alpha, 0.0001));
        color.a = alpha;
    }

    color.a *= iOpacity;
    return color;
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.5));
}

float getFrequency(float x) {
    return band(floor(x * iBands)) + 0.06;
}

float getFrequency_smooth(float x) {
    float position = x * iBands - 0.5;
    float index = floor(position);
    return mix(band(index), band(index + 1.0), smoothstep(0.0, 1.0, position - index)) + 0.06;
}

float getFrequency_blend(float x) {
    return mix(getFrequency(x), getFrequency_smooth(x), 0.5);
}

vec3 circleIllumination(vec2 fragment, float radius) {
    float distance = length(fragment);
    float ring = 1.0 / max(0.0001, abs(distance - radius - ((min(iLowFreq * iIntensity, 1.0) + 0.06) / 15.50)));

    vec3 color = vec3(0.0);
    float t = fragment.y * 0.5 + 0.5;
    vec3 rayColor = getBaseColor(t);
    color += rayColor * ring * iWidth / 20.0;

    float frequency = max(getFrequency_blend(abs(atan(fragment.x, fragment.y) / M_PI)) - 0.02, 0.0);
    color *= frequency;
    color *= smoothstep(radius * 0.5, radius, distance);

    return color;
}

vec3 doLine(vec2 fragment, float radius, float x) {
    vec3 col = getBaseColor(x * 0.5 + 0.25);
    vec3 hsvCol = rgb2hsv(col);
    hsvCol.z += iGlobalTime * 0.05;
    col = hsv2rgb(hsvCol);

    float freq = abs(fragment.x * 0.5);
    col *= (1.0 / abs(fragment.y)) * iWidth / 20.0 * getFrequency(freq);
    col = col * smoothstep(radius, radius * 1.8, abs(fragment.x));

    return col;
}

vec4 smoothed()
{
    vec2 fragPos = vUv;
    fragPos = (fragPos - 0.5) * 2.0;
    fragPos.x *= iResolution.x / iResolution.y;

    vec3 color = vec3(0.0);
    color += circleIllumination(fragPos, iRadius);

    if (iShowLines) {
        color += doLine(fragPos, iRadius, fragPos.x);
    }

    color += max(luma(color) - 1.0, 0.0);

    float alpha = smoothstep(0.0, 0.65, length(color)) * iOpacity;
    return vec4(color, alpha);
}


void main()
{
    vec4 color = iSmooth ? smoothed() : basic();
    float edgeFade = smoothstep(0.0, 0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    color.a *= smoothstep(0.01, 0.05, color.a / max(iOpacity, 0.0001)) * edgeFade;
    gl_FragColor = color;
}

`;

const planeVertex = `
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

type DataTexture = {
	width: number;
	height: number;
	data: Uint8Array;
};

// Adapt the known Banger GLSL sources to WebGL2, without Three's injected built-ins.
function shaderSource(source: string, fragment: boolean) {
	let code = source
		.replace(/\bvarying\b/g, fragment ? 'in' : 'out')
		.replace(/\bgl_FragColor\b/g, 'outColor')
		.replace('vec2 iResolution = vec2(1920.0, 1080.0);', 'uniform vec2 iResolution;')
		.replace(
			'return mix(iStartColor, iEndColor, t);',
			'if (iColorMode == 1) return t < 0.5 ? mix(iStartColor, iMiddleColor, t * 2.0) : mix(iMiddleColor, iEndColor, (t - 0.5) * 2.0); return mix(iStartColor, iEndColor, t);',
		);
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
	return `#version 300 es\nprecision highp float;\nprecision highp int;\n${fragment ? 'out vec4 outColor;\nuniform float iAspect;\nuniform float iBands;\nuniform float iBarWidth;\nuniform vec3 iMiddleColor;\n' : ''}${code}`;
}

type CircleFrame = Omit<
	Required<CircleOptions>,
	'audioSrc' | 'audioOffsetInSeconds' | 'playAudio' | 'inputGainDb'
> & {
	readonly sourceTime: number;
	readonly texture: DataTexture;
	readonly bass: number;
};

type CircleState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly uniforms: {
		readonly time: WebGLUniformLocation | null;
		readonly resolution: WebGLUniformLocation | null;
		readonly texture: WebGLUniformLocation | null;
		readonly startColor: WebGLUniformLocation | null;
		readonly endColor: WebGLUniformLocation | null;
		readonly colorMode: WebGLUniformLocation | null;
		readonly intensity: WebGLUniformLocation | null;
		readonly width: WebGLUniformLocation | null;
		readonly count: WebGLUniformLocation | null;
		readonly radius: WebGLUniformLocation | null;
		readonly smooth: WebGLUniformLocation | null;
		readonly bass: WebGLUniformLocation | null;
		readonly lineThickness: WebGLUniformLocation | null;
		readonly dotSize: WebGLUniformLocation | null;
		readonly bands: WebGLUniformLocation | null;
		readonly barWidth: WebGLUniformLocation | null;
		readonly middleColor: WebGLUniformLocation | null;
		readonly rainbowSpeed: WebGLUniformLocation | null;
		readonly saturation: WebGLUniformLocation | null;
		readonly brightness: WebGLUniformLocation | null;
		readonly showLines: WebGLUniformLocation | null;
	};
};

function setupCircle(canvas: HTMLCanvasElement, fragment: string): CircleState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: false,
	});
	if (!gl)
		throw new Error(
			'Circle requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Circle could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, shaderSource(planeVertex, false)],
			[gl.FRAGMENT_SHADER, shaderSource(fragment, true)],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Circle could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Circle shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Circle shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Circle could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const position = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		texture = gl.createTexture();
		if (!texture) throw new Error('Circle could not create an audio texture.');
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		// These treatment constants do not change between frames.
		gl.uniform1f(gl.getUniformLocation(program, 'iRainbowSpeed'), 1);
		gl.uniform1f(gl.getUniformLocation(program, 'iRainbowSaturation'), 0.85);
		gl.uniform1f(gl.getUniformLocation(program, 'iRainbowBrightness'), 0.85);
		gl.uniform1f(gl.getUniformLocation(program, 'iOpacity'), 1);
		gl.uniform1i(gl.getUniformLocation(program, 'iShowLines'), 1);
		return {
			gl,
			program,
			buffer,
			texture,
			uniforms: {
				time: gl.getUniformLocation(program, 'iGlobalTime'),
				resolution: gl.getUniformLocation(program, 'iResolution'),
				texture: gl.getUniformLocation(program, 'iTexture'),
				startColor: gl.getUniformLocation(program, 'iStartColor'),
				endColor: gl.getUniformLocation(program, 'iEndColor'),
				colorMode: gl.getUniformLocation(program, 'iColorMode'),
				intensity: gl.getUniformLocation(program, 'iIntensity'),
				width: gl.getUniformLocation(program, 'iWidth'),
				count: gl.getUniformLocation(program, 'iCount'),
				radius: gl.getUniformLocation(program, 'iRadius'),
				smooth: gl.getUniformLocation(program, 'iSmooth'),
				bass: gl.getUniformLocation(program, 'iLowFreq'),
				lineThickness: gl.getUniformLocation(program, 'iLineThickness'),
				dotSize: gl.getUniformLocation(program, 'iDotSize'),
				bands: gl.getUniformLocation(program, 'iBands'),
				barWidth: gl.getUniformLocation(program, 'iBarWidth'),
				middleColor: gl.getUniformLocation(program, 'iMiddleColor'),
				rainbowSpeed: gl.getUniformLocation(program, 'iRainbowSpeed'),
				saturation: gl.getUniformLocation(program, 'iRainbowSaturation'),
				brightness: gl.getUniformLocation(program, 'iRainbowBrightness'),
				showLines: gl.getUniformLocation(program, 'iShowLines'),
			},
		};
	} catch (error) {
		gl.deleteTexture(texture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function drawCircle({gl, program, texture, uniforms}: CircleState, frame: CircleFrame) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	// WebGL ignores null locations for uniforms optimized out of a variant.
	gl.uniform1f(uniforms.time, frame.sourceTime);
	gl.uniform2f(uniforms.resolution, frame.width, frame.height);
	gl.uniform3fv(uniforms.startColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.endColor, linearColor(frame.endColor));
	gl.uniform1i(
		uniforms.colorMode,
		frame.colorMode === 'rainbow' ? 2 : frame.colorMode === 'gradient-3' ? 1 : 0,
	);
	gl.uniform3fv(uniforms.middleColor, linearColor(frame.middleColor ?? '#f567f5'));
	gl.uniform1f(uniforms.bands, frame.texture.width);
	gl.uniform1f(uniforms.barWidth, frame.barWidth ?? 0.5);
	gl.uniform1f(uniforms.rainbowSpeed, frame.rainbowSpeed ?? 1);
	gl.uniform1f(uniforms.saturation, frame.saturation ?? 0.85);
	gl.uniform1f(uniforms.brightness, frame.brightness ?? 0.85);
	gl.uniform1i(uniforms.showLines, Number(frame.showLines ?? true));
	gl.uniform1f(uniforms.intensity, frame.intensity);
	gl.uniform1f(uniforms.width, frame.lineWidth);
	gl.uniform1f(uniforms.count, frame.count);
	gl.uniform1f(uniforms.radius, frame.radius);
	gl.uniform1i(uniforms.smooth, Number(frame.circleVariant === 'glow-ring'));
	gl.uniform1f(uniforms.bass, frame.bass);
	gl.uniform1f(uniforms.lineThickness, frame.lineThickness ?? frame.lineWidth);
	gl.uniform1f(uniforms.dotSize, frame.dotSize ?? frame.lineWidth);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.texture.width,
		frame.texture.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		frame.texture.data,
	);
	gl.uniform1i(uniforms.texture, 0);
	gl.disable(gl.BLEND);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Circle WebGL draw failed: ${error}`);
}

function cleanupCircle({gl, program, buffer, texture}: CircleState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function CircleCanvas(frame: CircleFrame) {
	const fragment =
		frame.circleVariant === 'dotted-ring'
			? dottedRingFragment
			: frame.circleVariant === 'waveform-ring'
				? waveformRingFragment
				: radialBarsFragment;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<CircleState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupCircle(canvas, fragment);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Circle WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupCircle(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, [fragment]);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Circle');
		try {
			drawCircle(state.current, frame);
		} catch (error) {
			cancelRender(error);
		} finally {
			continueRender(handle);
		}
	}, [frame, fragment, delayRender, continueRender]);
	return (
		<canvas
			ref={canvasRef}
			width={frame.width}
			height={frame.height}
			style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
		/>
	);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function barsTexture(bars: number[], multiplier: number): DataTexture {
	const data = new Uint8Array(Math.max(1, bars.length) * 4);
	for (let i = 0; i < bars.length; i++) {
		data[i * 4] = Math.round(clamp(bars[i] * multiplier, 0, 1) * 255);
		data[i * 4 + 3] = 255;
	}
	return {width: Math.max(1, bars.length), height: 1, data};
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
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const CircleContent: React.FC<Required<CircleOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const count = Math.round(clamp(props.count, 5, 150));
	const bars = spectrumBars(
		{
			audioData: audioData ?? silentAudio,
			dataOffsetInSeconds,
			sourceTime,
			fps,
		},
		circleBands(props.circleVariant, count),
	);
	const gain = 10 ** (props.inputGainDb / 20);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<CircleCanvas
				{...props}
				sourceTime={sourceTime}
				texture={barsTexture(bars, props.intensity * gain)}
				bass={barAtFrequency(bars, 60) * gain}
				width={props.width}
				height={props.height}
				intensity={props.intensity}
				startColor={props.startColor}
				endColor={props.endColor}
				colorMode={props.colorMode}
				radius={props.radius}
				count={count}
				lineWidth={props.lineWidth}
				circleVariant={props.circleVariant}
			/>
		</>
	);
};

const CircleInner: React.FC<CircleProps> = ({
	width = circleSchema.width.default,
	height = circleSchema.height.default,
	audioSrc = circleSchema.audioSrc.default,
	audioOffsetInSeconds = circleSchema.audioOffsetInSeconds.default,
	playAudio = circleSchema.playAudio.default,
	inputGainDb = circleSchema.inputGainDb.default,
	intensity = circleSchema.intensity.default,
	startColor = circleSchema.startColor.default,
	endColor = circleSchema.endColor.default,
	colorMode = circleSchema.colorMode.default,
	radius = circleSchema.radius.default,
	count = circleSchema.count.default,
	lineWidth = circleSchema.lineWidth.default,
	circleVariant = circleSchema.circleVariant.default,
	middleColor = circleSchema.middleColor.default,
	rainbowSpeed = circleSchema.rainbowSpeed.default,
	saturation = circleSchema.saturation.default,
	brightness = circleSchema.brightness.default,
	barWidth = circleSchema.barWidth.default,
	lineThickness = lineWidth === circleSchema.lineWidth.default
		? circleSchema.lineThickness.default
		: lineWidth,
	dotSize = lineWidth === circleSchema.lineWidth.default ? circleSchema.dotSize.default : lineWidth,
	showLines = circleSchema.showLines.default,
	style,
}) => {
	return (
		<div
			style={{
				position: 'relative',
				boxSizing: 'border-box',
				width,
				height,
				overflow: 'hidden',
				...style,
			}}
		>
			<CircleContent
				key={audioSrc}
				width={width}
				height={height}
				audioSrc={audioSrc}
				audioOffsetInSeconds={audioOffsetInSeconds}
				playAudio={playAudio}
				inputGainDb={inputGainDb}
				intensity={intensity}
				startColor={startColor}
				endColor={endColor}
				colorMode={colorMode}
				radius={radius}
				count={count}
				lineWidth={lineWidth}
				circleVariant={circleVariant}
				middleColor={middleColor}
				rainbowSpeed={rainbowSpeed}
				saturation={saturation}
				brightness={brightness}
				barWidth={barWidth}
				lineThickness={lineThickness}
				dotSize={dotSize}
				showLines={showLines}
			/>
		</div>
	);
};

export const Circle = Interactive.create({
	Component: CircleInner,
	componentName: '<Circle>',
	schema: circleSchema,
});
