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

type MoonOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly startColor?: string;
	readonly moonColor?: string;
	readonly responsive?: number;
	readonly hideMoon?: boolean;
	readonly hideAudio?: boolean;
	readonly stars?: number;
	readonly pattern?: number;
	readonly speed?: number;
	readonly volume?: number;
	readonly timeOffsetInSeconds?: number;
};
type MoonProps = InteractiveBaseProps & InteractiveTransformProps & MoonOptions;

const moonSchema = {
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
	startColor: { type: "color", default: "#c21aff", description: "Theme color" },
	moonColor: { type: "color", default: "#000000", description: "Moon color" },
	responsive: {
		type: "number",
		default: 1.3,
		min: 0,
		max: 4,
		step: 0.1,
		description: "Audio reactivity",
		hiddenFromList: false,
	},
	hideMoon: { type: "boolean", default: false, description: "Hide moon" },
	hideAudio: {
		type: "boolean",
		default: false,
		description: "Hide sound texture",
	},
	stars: {
		type: "number",
		default: 6,
		min: 1,
		max: 60,
		step: 1,
		description: "Stars density",
		hiddenFromList: false,
	},
	pattern: {
		type: "number",
		default: 0.25,
		min: 0.1,
		max: 5,
		step: 0.05,
		description: "Flickering",
		hiddenFromList: false,
	},
	speed: {
		type: "number",
		default: 0.25,
		min: 0.1,
		max: 2,
		step: 0.1,
		description: "Movement speed",
		hiddenFromList: false,
	},
	volume: {
		type: "number",
		default: 0.5,
		min: 0.1,
		max: 2,
		step: 0.1,
		description: "Volume",
		hiddenFromList: false,
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
		const handle = delayRender("Waiting for complete Moon audio history");
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
uniform float iVolume;
uniform float iPattern;
uniform float iStars;
uniform float iSpeed;

uniform bool iHideMoon;
uniform bool iHideAudio;

uniform vec3 iStartColor;
uniform vec3 iMoonColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

// CC0 - Neonwave sunrise
//  Inspired by a tweet by I wanted to create something that looked
//  a bit like the tweet. This is the result.

#define RESOLUTION    iResolution
#define TIME          iGlobalTime
#define PI            3.141592654
#define TAU           (2.0*PI)

#define SHOW_FFT



const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}

//  Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))


vec4 alphaBlend(vec4 back, vec4 front) {
  float w = front.w + back.w*(1.0-front.w);
  vec3 xyz = (front.xyz*front.w + back.xyz*back.w*(1.0-front.w))/w;
  return w > 0.0 ? vec4(xyz, w) : vec4(0.0);
}


vec3 alphaBlend(vec3 back, vec4 front) {
  return mix(back, front.xyz, front.w);
}


float tanh_approx(float x) {
  //  Found this somewhere on the interwebs
  //  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}


float hash(float co) {
  return fract(sin(co*12.9898) * 13758.5453);
}


float hash(vec2 p) {
  float a = dot (p, vec2 (127.1, 311.7));
  return fract(sin(a)*43758.5453123);
}

// Value noise: https://iquilezles.org/articles/morenoise
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  vec2 u = f*f*(3.0-2.0*f);
//  vec2 u = f;

  float a = hash(i + vec2(0.0,0.0));
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));

  float m0 = mix(a, b, u.x);
  float m1 = mix(c, d, u.x);
  float m2 = mix(m0, m1, u.y);

  return m2;
}


vec2 raySphere(vec3 ro, vec3 rd, vec4 sph) {
  vec3 oc = ro - sph.xyz;
  float b = dot( oc, rd );
  float c = dot( oc, oc ) - sph.w*sph.w;
  float h = b*b - c;
  if( h<0.0 ) return vec2(-1.0);
  h = sqrt( h );
  return vec2(-b - h, -b + h);
}


float mod1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize, size) - halfsize;
  return c;
}


vec2 mod2(inout vec2 p, vec2 size) {
  vec2 c = floor((p + size*0.5)/size);
  p = mod(p + size*0.5,size) - size*0.5;
  return c;
}


vec2 hash2(vec2 p) {
  p = vec2(dot (p, vec2 (127.1, 311.7)), dot (p, vec2 (269.5, 183.3)));
  return fract(sin(p)*43758.5453123);
}

float hifbm(vec2 p) {
  const float aa = 0.5;
  const float pp = 2.0-0.;

  float sum = 0.0;
  float a   = 1.0;

  for (int i = 0; i < 5; ++i) {
    sum += a*vnoise(p);
    a *= aa;
    p *= pp;
  }

  return sum;
}

float lofbm(vec2 p) {
  const float aa = 0.5;
  const float pp = 2.0-0.;

  float sum = 0.0;
  float a   = 1.0;

  for (int i = 0; i < 2; ++i) {
    sum += a*vnoise(p);
    a *= aa;
    p *= pp;
  }

  return sum;
}

float hiheight(vec2 p) {
  return hifbm(p)-1.8;
}

float loheight(vec2 p) {
  return lofbm(p)-2.15;
}

vec4 plane(vec3 ro, vec3 rd, vec3 pp, vec3 npp, vec3 off, float n) {
  float h = hash(n);
  float s = mix(0.05, 0.25, h);

  vec3 hn;
  vec2 p = (pp-off*2.0*vec3(1.0, 1.0, 0.0)).xy;

  // Apply arc-like distortion
  float distortionStrength = -0.25; // Adjust this value to change the strength of the distortion
  vec2 center = vec2(0.5, 0.5); // The center of the distortion. Adjust this value to change the center.
  float distanceFromCenter = length(p - center);
  p -= distortionStrength * pow(distanceFromCenter, 2.0) * normalize(p - center);

  p.y += 0.25;

  vec2 stp = vec2(iVolume, 0.33);
  float he    = hiheight(vec2(p.x, pp.z)*stp);
  float lohe  = loheight(vec2(p.x, pp.z)*stp);

  float d = p.y-he;
  float lod = p.y - lohe;

  float aa = distance(pp, npp)*sqrt(1.0/3.0);
  float t = smoothstep(aa, -aa, d);

  float df = exp(-0.1*(distance(ro, pp)-2.));
  vec3 acol = hsv2rgb(vec3(mix(0.9, 0.6, df), 0.9, mix(1.0, 0.0, df))) * iStartColor;
  vec3 gcol = hsv2rgb(vec3(0.6, 0.5, tanh_approx(exp(-mix(2.0, 8.0, df)*lod))));

  vec3 col = vec3(0.0);
  col += acol;
  col += 0.5*gcol;

  return vec4(col, t);
}

vec3 stars(vec2 sp, float hh) {
  const vec3 scol0 = HSV2RGB(vec3(0.85, 0.8, 1.0));
  const vec3 scol1 = HSV2RGB(vec3(0.65, 0.5, 1.0));
  vec3 col = vec3(0.0);

  float m = iStars;

  for (float i = 0.0; i < m; ++i) {
    vec2 pp = sp+0.5*i;
    float s = i/(m-1.0);
    vec2 dim  = vec2(mix(0.05, 0.003, s)*PI);
    vec2 np = mod2(pp, dim);
    vec2 h = hash2(np+127.0+i);
    vec2 o = -1.0+2.0*h;
    float y = sin(sp.x);
    pp += o*dim*0.5;
    pp.y *= y;
    float l = length(pp);

    float h1 = fract(h.x*1667.0);
    float h2 = fract(h.x*1887.0);
    float h3 = fract(h.x*2997.0);

    vec3 scol = mix(8.0*h2, 0.25*h2*h2, s)*mix(scol0, scol1, h1*h1);

    vec3 ccol = col + exp(-(mix(6000.0, 2000.0, hh)/mix(2.0, 0.25, s))*max(l-0.001, 0.0))*scol;
    ccol *= mix(0.125, 1.0, smoothstep(1.0, 0.99, sin(iPattern*TIME+TAU*h.y)));
    col = h3 < y ? ccol : col;
  }

  return col;
}

vec3 toSpherical(vec3 p) {
  float r   = length(p);
  float t   = acos(p.z/r);
  float ph  = atan(p.y, p.x);
  return vec3(r, t, ph);
}

const vec3 lpos   = 1E6*vec3(0., -0.15, 1.0);
const vec3 ldir   = normalize(lpos);

vec4 moon(vec3 ro, vec3 rd) {
  const vec4 mdim   = vec4(1E5*vec3(0., 0.4, 1.0), 20000.0);
  // const vec3 mcol0  = HSV2RGB(vec3(0.75, 0.7, 1.0));
  vec3 mcol0  = iStartColor;
  const vec3 mcol3  = HSV2RGB(vec3(0.75, 0.55, 1.0));

  vec2 md     = raySphere(ro, rd, mdim);
  vec3 mpos   = ro + rd*md.x;
  vec3 mnor   = normalize(mpos-mdim.xyz);
  float mdif  = max(dot(ldir, mnor), 0.0);
  float mf    = smoothstep(0.0, 10000.0, md.y - md.x);
  float mfre  = 1.0+dot(rd, mnor);
  float imfre = 1.0-mfre;

  vec3 col = vec3(0.) + iMoonColor;
  col += mdif*mcol0*4.0;

#if defined(SHOW_FFT)
  vec3 fcol = vec3(0.0);
  vec2 msp    = toSpherical(-mnor.zxy).yz;
  vec2 omsp   = msp;
  float msf   = sin(msp.x);
  msp.x       -= PI*0.5;
  const float mszy = (TAU/(4.0))*0.125;
  float msny  = mod1(msp.y, mszy);
  msp.y *= msf;

  const int limit = 1;
  for (int i = -limit; i <= limit; ++i) {
    vec2 pp     = msp+vec2(0.0, mszy*float(i));
    float d0    = abs(pp.y);
    vec2 cp     = vec2(0.055*abs(msny-float(i)), 0.25);
    float fft   = texture(iSoundTexture, cp).x * 2. * iIntensity;
    float d1    = length(pp)-0.05*fft;
    float h     =mix(0.66, 0.99, fft);
    vec3 mcol1  = hsv2rgb(vec3(h, 0.55, 1.0)) * iStartColor;
    vec3 mcol2  = hsv2rgb(vec3(h, 0.85, 1.0)) * iStartColor + (vec3(1.) / 10.);
    fcol += mcol1*0.5*tanh_approx(0.0025/max(d0, 0.0))*imfre*pow(msf, mix(100.0, 10.0, fft));
    fcol += mcol2*5.0*tanh_approx(0.00025/(max(d1, 0.0)*max(d1, 0.0)))*imfre*msf;
  }
  float d0   = abs(msp.x);
  fcol += mcol3*0.5*tanh_approx(0.0025/max(d0, 0.0))*imfre;

  const float start = 0.0;

  if (!iHideAudio) {
    col += fcol;
  }

#endif

  return vec4(col, mf);
}


vec3 skyColor(vec3 ro, vec3 rd) {
  // const vec3 acol   = HSV2RGB(vec3(0.6, 0.9, 0.075));

  vec3 acol;
  const vec3 lpos   = 1E6*vec3(0., -0.15, 1.0);

  vec3 lcol;

  if (iStartColor.x < 0.05 && iStartColor.y < 0.05 && iStartColor.z < 0.05) {
    acol = (iStartColor) / 10.;
    lcol = (iStartColor) / 5.0;
  } else {
    acol = (iStartColor + (vec3(1.0, 1.0, 1.0) * iStartColor.x)) / 10.;
    lcol = (iStartColor + (vec3(1.0, 1.0, 1.0) * iStartColor.x * 3.)) / 5.0;
  }

  vec2 sp     = toSpherical(rd.xzy).yz;

  float lf    = pow(max(dot(ldir, rd), 0.0), 80.0);
  float li    = 0.02*mix(1.0, 10.0, lf)/(abs((rd.y+0.055))+0.025);
  float lz    = step(-0.055, rd.y);

  vec4 mcol   = moon(ro, rd);

  vec3 col = vec3(0.0);
  col += stars(sp, 0.25)*smoothstep(0.5, 0.0, li)*lz;

  if (!iHideMoon) {
    col  = mix(col, mcol.xyz, mcol.w);
  }

  col += smoothstep(-0.4, 0.0, (sp.x-PI*0.5))*acol;
  col += tanh(lcol*li); // line
  return col;
}

vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {
  float lp = length(p);
  vec2 np = p + 2.0/RESOLUTION.y;
//  float rdd = (2.0-1.0*tanh_approx(lp));  // Playing around with rdd can give interesting distortions
  float rdd = 2.0;
  vec3 rd = normalize(p.x*uu + p.y*vv + rdd*ww);
  vec3 nrd = normalize(np.x*uu + np.y*vv + rdd*ww);

  const float planeDist = 1.0;
  const int furthest = 12;
  const int fadeFrom = max(furthest-2, 0);

  const float fadeDist = planeDist*float(fadeFrom);
  const float maxDist  = planeDist*float(furthest);
  float nz = floor(ro.z / planeDist);

  vec3 skyCol = skyColor(ro, rd);


  vec4 acol = vec4(0.0);
  const float cutOff = 0.95;
  bool cutOut = false;

  // Steps from nearest to furthest plane and accumulates the color
  for (int i = 1; i <= furthest; ++i) {
    float pz = planeDist*nz + planeDist*float(i);

    float pd = (pz - ro.z)/rd.z;

    vec3 pp = ro + rd*pd;

    if (pp.y < 0. && pd > 0.0 && acol.w < cutOff) {
      vec3 npp = ro + nrd*pd;

      vec3 off = vec3(0.0);

      vec4 pcol = plane(ro, rd, pp, npp, off, nz+float(i));

      float nz = pp.z-ro.z;
      float fadeIn = smoothstep(maxDist, fadeDist, pd);
      pcol.xyz = mix(skyCol, pcol.xyz, fadeIn);
//      pcol.w *= fadeOut;
      pcol = clamp(pcol, 0.0, 1.0);

      acol = alphaBlend(pcol, acol);
    } else {
      cutOut = true;
      acol.w = acol.w > cutOff ? 1.0 : acol.w;
      break;
    }

  }

  vec3 col = alphaBlend(skyCol, acol);
// To debug cutouts due to transparency
//  col += cutOut ? vec3(1.0, -1.0, 0.0) : vec3(0.0);
  return col;
}

vec3 effect(vec2 p, vec2 q) {
  float tm= TIME*iSpeed;
  vec3 ro = vec3(0.0, 0.0, tm);
  vec3 dro= normalize(vec3(0.0, 0.09, 1.0));
  vec3 ww = normalize(dro);
  vec3 uu = normalize(cross(normalize(vec3(0.0,1.0,0.0)), ww));
  vec3 vv = normalize(cross(ww, uu));

  vec3 col = color(ww, uu, vv, ro, p);

  return col;
}


float sRGB(float t) { return mix(1.055*pow(t, 1./2.4) - 0.055, 12.92*t, step(t, 0.0031308)); }

vec3 sRGB(in vec3 c) { return vec3 (sRGB(c.x), sRGB(c.y), sRGB(c.z)); }

vec3 aces_approx(vec3 v) {
  v = max(v, 0.0);
  v *= 0.6f;
  float a = 2.51f;
  float b = 0.03f;
  float c = 2.43f;
  float d = 0.59f;
  float e = 0.14f;
  return clamp((v*(a*v+b))/(v*(c*v+d)+e), 0.0f, 1.0f);
}

void main() {
  vec2 uv = ((vUv - vec2(.25, .25)) / vec2(0.49, 0.5));
  vec2 q = uv;
  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x/RESOLUTION.y;
  vec3 col = vec3(0.0);
  col = effect(p, q);
  //col *= smoothstep(0.0, 0.0, TIME-abs(q.y));
  col = aces_approx(col);
  col = sRGB(col);


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
			throw new Error(`Invalid Moon color: ${color}`);
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

type MoonFrame = Pick<
	Required<MoonOptions>,
	| "startColor"
	| "moonColor"
	| "responsive"
	| "hideMoon"
	| "hideAudio"
	| "stars"
	| "pattern"
	| "speed"
	| "volume"
> & {
	readonly width: number;
	readonly height: number;
	readonly time: number;
	readonly bars: readonly number[];
	readonly textureSrc?: string;
};
type MoonState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly soundTexture: WebGLTexture;
	readonly uniforms: Record<
		| "iGlobalTime"
		| "iLowFreq"
		| "iMidFreq"
		| "iHighFreq"
		| "iAspect"
		| "iStartColor"
		| "iMoonColor"
		| "iIntensity"
		| "iHideMoon"
		| "iHideAudio"
		| "iStars"
		| "iPattern"
		| "iSpeed"
		| "iVolume"
		| "iSoundTexture",
		WebGLUniformLocation | null
	>;
};
function setupMoon(canvas: HTMLCanvasElement): MoonState {
	const gl = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			"Moon requires WebGL2. Enable browser graphics acceleration and reload Studio.",
		);
	const program = gl.createProgram();
	if (!program) throw new Error("Moon could not create a program.");
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error("Moon could not create a shader.");
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(
					`Moon shader compilation failed: ${gl.getShaderInfoLog(shader)}`,
				);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(
				`Moon shader linking failed: ${gl.getProgramInfoLog(program)}`,
			);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error("Moon could not create a vertex buffer.");
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
		const soundTexture = gl.createTexture();
		if (!soundTexture)
			throw new Error("Moon could not create an audio texture.");
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, soundTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return {
			gl,
			program,
			buffer,
			vertexCount: data.length / 5,
			soundTexture,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, "iGlobalTime"),
				iLowFreq: gl.getUniformLocation(program, "iLowFreq"),
				iMidFreq: gl.getUniformLocation(program, "iMidFreq"),
				iHighFreq: gl.getUniformLocation(program, "iHighFreq"),
				iAspect: gl.getUniformLocation(program, "iAspect"),
				iStartColor: gl.getUniformLocation(program, "iStartColor"),
				iMoonColor: gl.getUniformLocation(program, "iMoonColor"),
				iIntensity: gl.getUniformLocation(program, "iIntensity"),
				iHideMoon: gl.getUniformLocation(program, "iHideMoon"),
				iHideAudio: gl.getUniformLocation(program, "iHideAudio"),
				iStars: gl.getUniformLocation(program, "iStars"),
				iPattern: gl.getUniformLocation(program, "iPattern"),
				iSpeed: gl.getUniformLocation(program, "iSpeed"),
				iVolume: gl.getUniformLocation(program, "iVolume"),
				iSoundTexture: gl.getUniformLocation(program, "iSoundTexture"),
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
function drawMoon(state: MoonState, frame: MoonFrame) {
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
			(frame as MoonFrame & { inputGainDb?: number }).inputGainDb ?? 0,
			-30,
			30,
			0,
		) /
			20);
	gl.uniform1f(uniforms.iLowFreq, (frame.bars[11] ?? 0) * gain);
	gl.uniform1f(uniforms.iMidFreq, (frame.bars[45] ?? 0) * gain);
	gl.uniform1f(uniforms.iHighFreq, (frame.bars[85] ?? 0) * gain);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.iMoonColor, linearColor(frame.moonColor));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.responsive, 0, 4, 1.3));
	gl.uniform1i(uniforms.iHideMoon, Number(frame.hideMoon));
	gl.uniform1i(uniforms.iHideAudio, Number(frame.hideAudio));
	gl.uniform1f(uniforms.iStars, bounded(frame.stars, 1, 60, 6));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 0.1, 5, 0.25));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 2, 0.25));
	gl.uniform1f(uniforms.iVolume, bounded(frame.volume, 0.1, 2, 0.5));
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.soundTexture);
	const audioBytes = new Uint8Array(308 * 4);
	for (let index = 0; index < 308; index++) {
		audioBytes[index * 4] = Math.round(
			Math.min(1, Math.max(0, (frame.bars[index] ?? 0) * gain)) * 255,
		);
		audioBytes[index * 4 + 3] = 255;
	}
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		308,
		1,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		audioBytes,
	);
	gl.uniform1i(uniforms.iSoundTexture, 0);
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR)
		throw new Error(`Moon WebGL draw failed: ${error}`);
}
function cleanupMoon(state: MoonState) {
	const { gl, program, buffer } = state;
	gl.deleteTexture(state.soundTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function MoonCanvas(frame: MoonFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<MoonState | null>(null);
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupMoon(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error("Moon WebGL context was lost."));
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => {
			canvas.removeEventListener("webglcontextlost", lost);
			if (!current) return;
			cleanupMoon(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected)
					current.gl.getExtension("WEBGL_lose_context")?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender("Drawing Moon");
		try {
			drawMoon(state.current, frame);
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
const MoonContent: React.FC<
	Required<MoonOptions> & { width: number; height: number }
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
			<MoonCanvas {...props} time={time} bars={bars} />
		</>
	);
};
const MoonInner = forwardRef<
	HTMLDivElement,
	MoonProps & { readonly controls: SequenceControls | undefined }
>(
	(
		{
			audioSrc = moonSchema.audioSrc.default,
			audioOffsetInSeconds = moonSchema.audioOffsetInSeconds.default,
			playAudio = moonSchema.playAudio.default,
			inputGainDb = moonSchema.inputGainDb.default,
			startColor = moonSchema.startColor.default,
			moonColor = moonSchema.moonColor.default,
			responsive = moonSchema.responsive.default,
			hideMoon = moonSchema.hideMoon.default,
			hideAudio = moonSchema.hideAudio.default,
			stars = moonSchema.stars.default,
			pattern = moonSchema.pattern.default,
			speed = moonSchema.speed.default,
			volume = moonSchema.volume.default,
			timeOffsetInSeconds = moonSchema.timeOffsetInSeconds.default,
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
				name={name ?? "Moon"}
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
					<MoonContent
						key={`${audioSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						startColor={startColor}
						moonColor={moonColor}
						responsive={responsive}
						hideMoon={hideMoon}
						hideAudio={hideAudio}
						stars={stars}
						pattern={pattern}
						speed={speed}
						volume={volume}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);
export const Moon = Interactive.withSchema({
	Component: MoonInner,
	componentName: "<Moon>",
	componentIdentity: null,
	schema: moonSchema,
	supportsEffects: false,
}) as React.FC<MoonProps>;
