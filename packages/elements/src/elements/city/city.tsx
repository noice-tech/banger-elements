import { Audio } from "@remotion/media";
import {
	useWindowedAudioData,
	visualizeAudio,
	type MediaUtilsAudioData,
} from "@remotion/media-utils";
import React, {
	forwardRef,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
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
} from "remotion";

type CityOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly lightsColor?: string;
	readonly groundColor?: string;
	readonly shineColor?: string;
	readonly responsive?: number;
	readonly stars?: number;
	readonly speed?: number;
	readonly textureSrc?: string;
	readonly timeOffsetInSeconds?: number;
};
type CityProps = InteractiveBaseProps & InteractiveTransformProps & CityOptions;

const citySchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: "asset",
		default:
			"https://remotion.media/elements/remotion-made-this-picture-move.mp3",
		description: "Audio source",
		keyframable: false,
	},
	audioOffsetInSeconds: {
		type: "number",
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		description: "Audio source offset in seconds",
		hiddenFromList: false,
		keyframable: false,
	},
	playAudio: {
		type: "boolean",
		default: true,
		description: "Play audio (disable when stacking)",
		keyframable: false,
	},
	inputGainDb: {
		type: "number",
		default: 0,
		min: -30,
		max: 30,
		step: 1,
		description: "Visual gain in dB",
		hiddenFromList: false,
	},
	startColor: { type: "color", default: "#324952", description: "Theme color" },
	endColor: {
		type: "color",
		default: "#001361",
		description: "Sky shine color",
	},
	lightsColor: {
		type: "color",
		default: "#f5fff7",
		description: "Lights color",
	},
	groundColor: { type: "color", default: "#0cb8cf", description: "Grid color" },
	shineColor: {
		type: "color",
		default: "#949494",
		description: "Grid shine color",
	},
	responsive: {
		type: "number",
		default: 1,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: "Audio reactivity",
		hiddenFromList: false,
	},
	stars: {
		type: "number",
		default: 1,
		min: 0.1,
		max: 5,
		step: 0.1,
		description: "Stars density",
		hiddenFromList: false,
	},
	speed: {
		type: "number",
		default: 1,
		min: 0,
		max: 20,
		step: 0.25,
		description: "Speed",
		hiddenFromList: false,
	},
	textureSrc: {
		type: "asset",
		default: "",
		description: "Lights pattern",
		keyframable: false,
	},
	timeOffsetInSeconds: {
		type: "number",
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		description:
			"Animation phase offset in seconds (independent of audio trim)",
		hiddenFromList: false,
		keyframable: false,
	},
	width: {
		type: "number",
		default: 1280,
		min: 16,
		max: 3840,
		step: 1,
		description: "Width",
		hiddenFromList: false,
		keyframable: false,
	},
	height: {
		type: "number",
		default: 720,
		min: 16,
		max: 3840,
		step: 1,
		description: "Height",
		hiddenFromList: false,
		keyframable: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

const decodeWindowSeconds = 20;
function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}
function hasCompleteAudioWindow(
	audioData: MediaUtilsAudioData,
	offset: number,
	time: number,
) {
	const chunk = Math.floor(time / decodeWindowSeconds);
	const start = Math.max(0, (chunk - 1) * decodeWindowSeconds);
	const end = Math.min(
		audioData.durationInSeconds,
		(chunk + 2) * decodeWindowSeconds,
	);
	return (
		Math.abs(offset - start) < 1 / audioData.sampleRate &&
		audioData.channelWaveforms[0].length >=
			Math.round((end - start) * audioData.sampleRate) - 2
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
		audioData === null ||
		hasCompleteAudioWindow(audioData, result.dataOffsetInSeconds, time);
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		if (complete) return;
		const handle = delayRender("Waiting for complete City audio history");
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return { ...result, audioData: complete ? audioData : null };
}
function computeBars(values: number[]) {
	const bars = Array.from({ length: 308 }, () => 0.0025);
	const step = (22000 - 20) / values.length;
	for (let index = 0; index < values.length; index++) {
		const frequency = 20 + index * step;
		const bin = Math.floor(
			(Math.log10(frequency / 20) / Math.log10(1100)) * 308,
		);
		if (bin < 308) bars[bin] += bin < 103 ? values[index] * 1.3 : values[index];
	}
	return bars.map((value) => (Number.isFinite(value) ? value : 0));
}
function spectrumBars(
	audioData: MediaUtilsAudioData,
	offset: number,
	time: number,
) {
	if (time < 0 || time >= audioData.durationInSeconds)
		return Array(308).fill(0) as number[];
	return computeBars(
		visualizeAudio({
			audioData,
			dataOffsetInSeconds: offset,
			frame: time * 60,
			fps: 60,
			numberOfSamples: 4096,
			optimizeFor: "speed",
			smoothing: true,
		}),
	);
}
const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: "banger-elements-silence",
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
uniform sampler2D iSoundTexture;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iScale;
uniform float iIntensity;
uniform float iStars;
uniform float iPattern;
uniform float iFlowersSpeed;
uniform float iSpeed;

uniform bool iColorful;
uniform bool iStatic;
uniform bool iDark;

uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform vec3 iShineColor;
uniform vec3 iLightsColor;
uniform vec3 iGroundColor;
uniform vec3 iSkyColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

#define EPS 1e-4

#define C(x) clamp(x, 0., 1.)
#define S(a, b, x) smoothstep(a, b, x)
#define F(x, f) (floor(x * f) / f)


#define TIME        iGlobalTime
#define RESOLUTION  iResolution

#define PI          3.141592654
#define TAU         (2.0*PI)


const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}

#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))

const vec3 shineCol = HSV2RGB(vec3(0.55, 0.5, 0.75));
const vec3 gridCol  = HSV2RGB(vec3(0.60, 0.5, 1.0));
const vec3 cityCol  = HSV2RGB(vec3(0.55, 0.25, 0.4));
const vec3 skyCol1  = HSV2RGB(vec3(283.0/360.0, 0.83, 0.16));
const vec3 skyCol2  = HSV2RGB(vec3(297.0/360.0, 0.79, 0.43));


float hash(float co) {
  return fract(sin(co*12.9898) * 13758.5453);
}

float psin(float a) {
  return 0.5 + 0.5*sin(a);
}


float mod1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float planex(vec2 p, float w) {
  return abs(p.y) - w;
}

float pmin(float a, float b, float k) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}

float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}

float sun(vec2 p) {
  const float ch = 0.0125;
  vec2 sp = p;
  vec2 cp = p;
  mod1(cp.y, ch*6.0);

  float d0 = circle(sp, 0.5);
  float d1 = planex(cp, ch);
  float d2 = p.y+ch*3.0;

  float d = d0;
  d = pmax(d, -max(d1, d2), ch*2.0);

  return d;
}

float noise (in vec3 p) {
	vec3 f = fract (p);
	p = floor (p);
	f = f * f * (3.0 - 2.0 * f);
	f.xy += p.xy + p.z * vec2 (37.0, 17.0);
	f.xy = texture (iTexture, (f.xy + 0.5) / 64.0, -64.0).yx;
	return mix (f.x, f.y, f.z);
}

float fbm (in vec3 p) {
	return noise (p) + noise (p * 2.0) / 2.0 + noise (p * 4.0) / 4.0;
}


float cityLights (in vec2 uv, in float offset)
{
    vec2 grid = vec2(30., 1.);
    uv.x += offset;
    float n1 = fbm((vec2(ivec2(uv * grid)) + .5).xxx);
    uv.x *= n1 * 6.;
    vec2 id = vec2(ivec2(uv * grid)) + .5;
    float n = fbm(id.xxx);
    vec2 lightGrid = vec2(79. * (n + .5), 200. * n);
    float n2 = fbm((vec2(ivec2(uv * lightGrid + 10. * .1)) + .5).xyx);
    vec2 lPos = fract(uv * lightGrid);
    n2 = (lPos.y < .2 || lPos.y > .7) ? 0. : n2;
    n2 = (lPos.x < .5 || lPos.y > .7) ? 0. : n2;
    n2 = smoothstep(.2 + .1 * .1, .6, n2);
	return (uv.y < n - 0.01) ? n2 * -1. : 10.;
}


float cityBasic(vec2 p) {
  float fd = -(p.y+0.4);
  float cd = 1E6;

  const float count = 6.0;
  const float width = 0.2;

  for (float i = 0.0; i < count; ++i) {
    vec2 pp = p;
    pp.x += i*width/count;
    float nn = mod1(pp.x, width);
    float rr = hash(nn+sqrt(3.0)*i);
    float dd = box(pp-vec2(0.0, -0.5), vec2(0.02, 0.0*(1.0-smoothstep(0.0, 10.0, abs(nn)))*rr+0.1));
    cd = min(cd, dd);
  }

  return max(fd, cd);
}

float city(vec2 p) {
  float fd = -(p.y+0.4);
  float cd = 1E6;

  const float count = 6.0;
  const float width = 0.2;

  float cityLightsValue = cityLights(p, 1.1); // Calculate city lights value

  for (float i = 0.0; i < count; ++i) {
    vec2 pp = p;
    pp.x += i*width/count;
    float nn = mod1(pp.x, width);
    float rr = hash(nn+sqrt(3.0)*i);
    float dd = box(pp-vec2(0.0, -0.5), vec2(0.02, 0.35*(1.0-smoothstep(0.0, 10.0, abs(nn)))*rr+0.1));
    cd = min(cd, dd);
  }


  float result = max(fd, max(cityLightsValue, cd));

  return result;
}

vec3 cityEffectBasic(vec2 p, float dc) {
  float aa = 5.0 / RESOLUTION.y;
  dc = abs(dc) - aa;
  vec3 col = vec3(0.0);
  col = mix(col, cityCol*0.25, smoothstep(aa, -aa, dc));
  return col;
}


vec3 cityEffect(vec2 p, float dc) {
  float aa = 10.0 / RESOLUTION.y;
  dc = abs(dc) - aa;
  float alpha = smoothstep(-aa, aa, dc);


  vec3 col = vec3(0.2);


  col *= 1.0 - alpha;

  return col;
}


float windows (vec2 uv, float offset)
{
  vec2 grid = vec2(1., 1.);
  uv.x += offset;
  float n1 = fbm((vec2(ivec2(uv * grid)) + .5).xxx);
  uv.x *= n1 * 7.;
  uv.x -= 4.0;
  vec2 id = vec2(ivec2(uv * grid)) + 1.5;
  float n = fbm(id.xxx);
  vec2 lightGrid = vec2(9. * (n + .5), 50. * n);
  float n2 = fbm((vec2(ivec2(uv * lightGrid + floor(1.0) * .1)) + .1).xyx);
  vec2 lPos = fract(uv * lightGrid);
  n2 = (lPos.y < .4 || lPos.y > .8) ? 0. : n2;
  n2 = (lPos.x < .4 || lPos.y > .8) ? 0. : n2;
  n2 = smoothstep(.225, .5, n2);

  if (uv.y < -.3) {
    return 0.;
  }

  if (uv.y > 0.055) {
    return 0.;
  }

	return (uv.y < n + .01) ? n2 : 0.;
}

// Building skyline
float buildings(vec2 st)
{

    float b = .1 * F(cos(st.x*4.0 + 1.7), 1.0);
    b += (b + .3) * 0.3 * F(cos(st.x*4.-0.1), 2.0);
    b += (b-.01) * 0.1 * F(cos(st.x*12.0), 4.);
    b += (b-.05) * 0.3 * F(cos(st.x*24.0), 1.0);
    return C((st.y + b - .1) * 100.);
}
vec3 sunEffect(vec2 p, float dc) {
  float aa = 4.0 / RESOLUTION.y;

  vec3 col = vec3(0.1);
  col = mix(iStartColor, iEndColor, pow(clamp(0.5*(1.0+p.y+0.1*sin(4.0*p.x+TIME*iSpeed*0.5)), 0.0, 1.0), 4.0));

  p.y -= 0.49;
  float ds = sun(p);

  float dd = circle(p, 0.5);

  vec3 sunCol = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 1.0), clamp(0.5 - 1.0*p.y, 0.0, 1.0));
  vec3 glareCol = sqrt(sunCol);
  vec3 cityCol = sunCol*sunCol;

  //col += glareCol*(exp(-30.0*ds))*step(0.0, ds);


  float t1 = smoothstep(0.0, 0.075, -dd);
  float t2 = smoothstep(0.0, 0.3, -dd);

  return col;
}

float ground(vec2 p) {
  p.y += TIME*iSpeed*40.0;
  p *= 0.075;
  vec2 gp = p;
  gp = fract(gp) - vec2(0.5);
  float d0 = abs(gp.x);
  float d1 = abs(gp.y);
  float d2 = circle(gp, 0.05);

  const float rw = 4.5;
  const float sw = 0.0225;

  vec2 rp = p;
  mod1(rp.y, 12.0);
  float d3 = abs(rp.x) - rw;
  float d4 = abs(d3) - sw*2.0;
  float d5 = box(rp, vec2(sw*2.0, 2.0));
  vec2 sp = p;
  mod1(sp.y, 4.0);
  sp.x = abs(sp.x);
  sp -= vec2(rw - 0.125, 0.0);
  float d6 = box(sp, vec2(sw, 1.0));

  float d = d0;
  d = pmin(d, d1, 0.1);
  d = max(d, -d3);
  d = min(d, d4);
  d = min(d, d5);
  d = min(d, d6);

  return d;
}

vec3 groundEffect(vec2 p) {
  vec3 ro = vec3(0.0, 20.0, 0.0);
  vec3 ww = normalize(vec3(0.0, -0.025, 1.0));
  vec3 uu = normalize(cross(vec3(0.0,1.0,0.0), ww));
  vec3 vv = normalize(cross(ww,uu));
  vec3 rd = normalize(p.x*uu + p.y*vv + 2.5*ww);

  float distg = (-9.0 - ro.y)/rd.y;

  vec3 col = vec3(0.0);
  if (distg > 0.0) {
    vec3 pg = ro + rd*distg;
    float aa = length(dFdx(pg))*0.0002*RESOLUTION.x;

    float dg = ground(pg.xz);

    col = mix(col, iGroundColor, smoothstep(-aa, 0.0, -(dg+0.0175)));
    col += iShineColor*(exp(-10.0*clamp(dg, 0.0, 1.0)));
    col = clamp(col, 0.0, 1.0);

    col *= pow(1.0-smoothstep(ro.y*3.0, 260.0+ro.y*30.0, distg), 2.0);
  }

  return col;
}

vec2 hash21(float p)
{
	vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);

}

float stars(vec2 st, vec2 fragCoord)
{
    vec2 uv = fragCoord;
    uv.y += .3;
    uv.y = abs(uv.y);
    float t = TIME * iSpeed * .05;
    vec2 h = pow(hash21(uv.x * iResolution.y + uv.y), vec2(50.));
    float twinkle = sin((st.x + t + cos(st.y * 50. + t)) * 25.);
    twinkle *= cos((st.y * .187 - t * 4.16 + sin(st.x * 11.8 + t * .347)) * 6.57);
    twinkle = twinkle * .5 + .5;
    return h.x * h.y * twinkle * 1.5 * iStars;
}


vec3 postProcess(vec3 col, vec2 q)  {
  col = clamp(col,0.0,1.0);

  col=col*0.6+0.4*col*col*(3.0-2.0*col);
  col=mix(col, vec3(dot(col, vec3(0.33))), -0.4);

  return col;
}

vec3 effect(vec2 p, vec2 q) {
  vec3 col = vec3(0.0);

  vec2 off = vec2(0.0, 0.15);

  float dc = cityBasic(p-vec2(0.0, 0.375)+off);
  float lc = city(p-vec2(0.0, 0.375)+off);

  float building = buildings(vec2(p) * 3.0);
  col += vec3(.18 - q.y * .1, .18 - q.y * .1, .1 + q.y * .03);

  col *= building;

  vec3 lightsColor = iIntensity > 0.5 ? iLightsColor * 0.6 + iLowFreq * iIntensity : iLightsColor;
  col += windows(p * 1.8, 2.) * (1.-building) * lightsColor;

  col += stars(p, p) * building;

  col += cityEffectBasic(p+off, dc);

  col += sunEffect(p+off,dc);
  col += groundEffect(p+off);

  col = postProcess(col, q);
  return col;
}

void main() {
  vec2 uv = ((vUv - vec2(0.295, .335)) / vec2(0.4, 0.4));
  vec2 q = uv;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x / RESOLUTION.y;

  vec3 col = effect(p, q);


  outColor = vec4(col, 1.0);
}`;

const colorCache = new Map<string, number[]>();
let colorParser: CanvasRenderingContext2D | null = null;
function linearColor(color: string) {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded =
			hex.length === 3
				? [...hex].map((character) => character + character).join("")
				: hex;
		bytes = [0, 2, 4].map((index) =>
			parseInt(expanded.slice(index, index + 2), 16),
		);
	} else {
		if (!CSS.supports("color", color))
			throw new Error(`Invalid City color: ${color}`);
		if (!colorParser) {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			colorParser = canvas.getContext("2d", { willReadFrequently: true })!;
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

type CityFrame = Pick<
	Required<CityOptions>,
	| "startColor"
	| "endColor"
	| "lightsColor"
	| "groundColor"
	| "shineColor"
	| "responsive"
	| "stars"
	| "speed"
> & {
	readonly width: number;
	readonly height: number;
	readonly time: number;
	readonly bars: readonly number[];
	readonly textureSrc?: string;
};
type CityState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly imageTexture: WebGLTexture;
	readonly uniforms: Record<
		| "iGlobalTime"
		| "iLowFreq"
		| "iMidFreq"
		| "iHighFreq"
		| "iAspect"
		| "iStartColor"
		| "iEndColor"
		| "iLightsColor"
		| "iGroundColor"
		| "iShineColor"
		| "iIntensity"
		| "iStars"
		| "iSpeed"
		| "iTexture",
		WebGLUniformLocation | null
	>;
};
function setupCity(canvas: HTMLCanvasElement): CityState {
	const gl = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			"City requires WebGL2. Enable browser graphics acceleration and reload Studio.",
		);
	const program = gl.createProgram();
	if (!program) throw new Error("City could not create a program.");
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error("City could not create a shader.");
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(
					`City shader compilation failed: ${gl.getShaderInfoLog(shader)}`,
				);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(
				`City shader linking failed: ${gl.getProgramInfoLog(program)}`,
			);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error("City could not create a vertex buffer.");
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const data = geometry();
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		for (const [name, size, offset] of [
			["position", 3, 0],
			["uv", 2, 12],
		] as const) {
			const attribute = gl.getAttribLocation(program, name);
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 20, offset);
		}
		const imageTexture = gl.createTexture();
		if (!imageTexture) throw new Error("City could not create a texture.");
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, imageTexture);
		const noise = new Uint8Array(64 * 64 * 4);
		for (let index = 0; index < 64 * 64; index++) {
			const value = (Math.imul(index + 17, 1103515245) >>> 16) & 255;
			noise.set(
				[value, (value * 73) & 255, (value * 151) & 255, 255],
				index * 4,
			);
		}
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			64,
			64,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			noise,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		return {
			gl,
			program,
			buffer,
			vertexCount: data.length / 5,
			imageTexture,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, "iGlobalTime"),
				iLowFreq: gl.getUniformLocation(program, "iLowFreq"),
				iMidFreq: gl.getUniformLocation(program, "iMidFreq"),
				iHighFreq: gl.getUniformLocation(program, "iHighFreq"),
				iAspect: gl.getUniformLocation(program, "iAspect"),
				iStartColor: gl.getUniformLocation(program, "iStartColor"),
				iEndColor: gl.getUniformLocation(program, "iEndColor"),
				iLightsColor: gl.getUniformLocation(program, "iLightsColor"),
				iGroundColor: gl.getUniformLocation(program, "iGroundColor"),
				iShineColor: gl.getUniformLocation(program, "iShineColor"),
				iIntensity: gl.getUniformLocation(program, "iIntensity"),
				iStars: gl.getUniformLocation(program, "iStars"),
				iSpeed: gl.getUniformLocation(program, "iSpeed"),
				iTexture: gl.getUniformLocation(program, "iTexture"),
			},
		};
	} catch (error) {
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}
function drawCity(state: CityState, frame: CityFrame) {
	const { gl, program, uniforms } = state;
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	const gain =
		10 **
		(bounded(
			(frame as CityFrame & { inputGainDb?: number }).inputGainDb ?? 0,
			-30,
			30,
			0,
		) /
			20);
	gl.uniform1f(uniforms.iLowFreq, (frame.bars[11] ?? 0) * gain);
	gl.uniform1f(uniforms.iMidFreq, (frame.bars[45] ?? 0) * gain);
	gl.uniform1f(uniforms.iHighFreq, (frame.bars[85] ?? 0) * gain);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.iEndColor, linearColor(frame.endColor));
	gl.uniform3fv(uniforms.iLightsColor, linearColor(frame.lightsColor));
	gl.uniform3fv(uniforms.iGroundColor, linearColor(frame.groundColor));
	gl.uniform3fv(uniforms.iShineColor, linearColor(frame.shineColor));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.responsive, 0.1, 10, 1));
	gl.uniform1f(uniforms.iStars, bounded(frame.stars, 0.1, 5, 1));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0, 20, 1));
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.imageTexture);
	gl.uniform1i(uniforms.iTexture, 0);
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR)
		throw new Error(`City WebGL draw failed: ${error}`);
}
function cleanupCity(state: CityState) {
	const { gl, program, buffer } = state;
	gl.deleteTexture(state.imageTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function CityCanvas(frame: CityFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<CityState | null>(null);
	const latestFrame = useRef(frame);
	latestFrame.current = frame;
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupCity(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error("City WebGL context was lost."));
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => {
			canvas.removeEventListener("webglcontextlost", lost);
			if (!current) return;
			cleanupCity(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected)
					current.gl.getExtension("WEBGL_lose_context")?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		const current = state.current;
		if (!current || !frame.textureSrc) return;
		const handle = delayRender("Loading City texture");
		let disposed = false;
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			if (disposed) return;
			try {
				const { gl } = current;
				gl.bindTexture(gl.TEXTURE_2D, current.imageTexture);
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					image,
				);
				drawCity(current, latestFrame.current);
			} catch (error) {
				cancelRender(error);
			} finally {
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (!disposed) {
				continueRender(handle);
				cancelRender(
					new Error(`City could not load texture: ${frame.textureSrc}`),
				);
			}
		};
		image.src = frame.textureSrc;
		return () => {
			disposed = true;
			image.onload = null;
			image.onerror = null;
			continueRender(handle);
		};
	}, [frame.textureSrc, delayRender, continueRender]);

	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender("Drawing City");
		try {
			drawCity(state.current, frame);
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
			style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
		/>
	);
}
const CityContent: React.FC<
	Required<CityOptions> & { width: number; height: number }
> = (props) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const offsetFrames = Math.round(
		bounded(props.audioOffsetInSeconds, 0, 86400, 0) * fps,
	);
	const sourceTime = (frame + offsetFrames) / fps;
	const time = frame / fps + bounded(props.timeOffsetInSeconds, 0, 86400, 0);
	const { audioData, dataOffsetInSeconds } = useVisualizerAudio(
		props.audioSrc,
		sourceTime,
		fps,
	);
	const bars = spectrumBars(
		audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
	);
	return (
		<>
			{props.playAudio ? (
				<Audio
					src={props.audioSrc}
					trimBefore={offsetFrames}
					showInTimeline={false}
				/>
			) : null}
			<CityCanvas {...props} time={time} bars={bars} />
		</>
	);
};
const CityInner = forwardRef<
	HTMLDivElement,
	CityProps & { readonly controls: SequenceControls | undefined }
>(
	(
		{
			audioSrc = citySchema.audioSrc.default,
			audioOffsetInSeconds = citySchema.audioOffsetInSeconds.default,
			playAudio = citySchema.playAudio.default,
			inputGainDb = citySchema.inputGainDb.default,
			startColor = citySchema.startColor.default,
			endColor = citySchema.endColor.default,
			lightsColor = citySchema.lightsColor.default,
			groundColor = citySchema.groundColor.default,
			shineColor = citySchema.shineColor.default,
			responsive = citySchema.responsive.default,
			stars = citySchema.stars.default,
			speed = citySchema.speed.default,
			textureSrc = citySchema.textureSrc.default,
			timeOffsetInSeconds = citySchema.timeOffsetInSeconds.default,
			width = 1280,
			height = 720,
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
				name={name ?? "City"}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						position: "relative",
						boxSizing: "border-box",
						width: drawingWidth,
						height: drawingHeight,
						overflow: "hidden",
						...style,
					}}
				>
					<CityContent
						key={`${audioSrc}:${textureSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						startColor={startColor}
						endColor={endColor}
						lightsColor={lightsColor}
						groundColor={groundColor}
						shineColor={shineColor}
						responsive={responsive}
						stars={stars}
						speed={speed}
						textureSrc={textureSrc}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);
export const City = Interactive.withSchema({
	Component: CityInner,
	componentName: "<City>",
	componentIdentity: null,
	schema: citySchema,
	supportsEffects: false,
}) as React.FC<CityProps>;
