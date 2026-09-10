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

type FlowersOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly strokeColor?: string;
	readonly backgroundColor?: string;
	readonly scale?: number;
	readonly responsive?: number;
	readonly rotationSpeed?: number;
	readonly flowersSpeed?: number;
	readonly volume?: number;
	readonly pattern?: number;
	readonly timeOffsetInSeconds?: number;
};
type FlowersProps = InteractiveBaseProps &
	InteractiveTransformProps &
	FlowersOptions;

const flowersSchema = {
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
	strokeColor: {
		type: "color",
		default: "#a1a1a1",
		description: "Stroke color",
	},
	backgroundColor: {
		type: "color",
		default: "#000000",
		description: "Background color",
	},
	scale: {
		type: "number",
		default: 15,
		min: 2,
		max: 30,
		step: 0.5,
		description: "Scale",
		hiddenFromList: false,
	},
	responsive: {
		type: "number",
		default: 1,
		min: 0.1,
		max: 2.7,
		step: 0.1,
		description: "Audio reactivity",
		hiddenFromList: false,
	},
	rotationSpeed: {
		type: "number",
		default: 1,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: "Rotation speed",
		hiddenFromList: false,
	},
	flowersSpeed: {
		type: "number",
		default: 0.2,
		min: 0.1,
		max: 3,
		step: 0.1,
		description: "Flowers speed",
		hiddenFromList: false,
	},
	volume: {
		type: "number",
		default: 3,
		min: 1,
		max: 4,
		step: 0.5,
		description: "Volume",
		hiddenFromList: false,
	},
	pattern: {
		type: "number",
		default: 2,
		min: 0.1,
		max: 2,
		step: 0.1,
		description: "Pattern",
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
		const handle = delayRender("Waiting for complete Flowers audio history");
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
uniform float iFlowersSpeed;
uniform float iSpeed;

uniform bool iColorful;
uniform bool iStatic;
uniform bool iDark;

uniform vec3 iStartColor;
uniform vec3 iEndColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

// CCO: Mandala flowers
//  Smoooth kaleidoscope + abstract shape + colors

#define RESOLUTION  iResolution
#define TIME        iGlobalTime
#define PI          3.141592654
#define PI_2        (0.5*3.141592654)
#define TAU         (2.0*PI)
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))

#define LOGO_DX  (0.5/sqrt(max(iVolume, 0.0001)))


float hash(vec2 p) {
  float a = dot (p, vec2 (127.1, 311.7));
  return fract (sin(a)*43758.5453123);
}


const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}

//  Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))

const float logo_radius= 0.25;
const float logo_off   = 0.25;
// const float logo_dx    = LOGO_DX;
const float logo_width = 0.1;

float rcp(float x) {
  return 1.0 / x;
}


float fast_atan2(float y, float x) {
  float cosatan2 = x * rcp(abs(x) + abs(y));
  float t = PI_2 - cosatan2 * PI_2;
  return y < 0.0 ? -t : t;
}

float circle(vec2 p, float r) {
  return length(p) - r;
}


float hex(vec2 p, float r) {
  const vec3 k = vec3(-sqrt(3.0)*0.5,0.5,sqrt(1.0/3.0));
  p = abs(p);
  p -= 2.0*min(dot(k.xy,p),0.0)*k.xy;
  p -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
  return length(p)*sign(p.y);
}


vec2 hextile(inout vec2 p) {
  // See Art of Code: Hexagonal Tiling Explained!
  // https://www.youtube.com/watch?v=VmrIDyYiJBA
  const vec2 sz       = vec2(1.0, sqrt(3.0));
  const vec2 hsz      = 0.5*sz;

  vec2 p1 = mod(p, sz)-hsz;
  vec2 p2 = mod(p - hsz, sz)-hsz;
  vec2 p3 = dot(p1, p1) < dot(p2, p2) ? p1 : p2;
  vec2 n = ((p3 - p + hsz)/sz);
  p = p3;

  n -= vec2(0.5);
  // Rounding to make hextile 0,0 well behaved
  return round(n*2.0)*0.5;
}


float modPolar(inout vec2 p, float repetitions) {
  float angle = 2.0*PI/repetitions;
  float a = atan(p.y, p.x) + angle/2.;
  float r = length(p);
  float c = floor(a/angle);
  a = mod(a,angle) - angle/2.;
  p = vec2(cos(a), sin(a))*r;
  // For an odd number of repetitions, fix cell index of the cell in -x direction
  // (cell index would be e.g. -5 and 5 in the two halves of the cell):
  if (abs(c) >= (repetitions/2.0)) c = abs(c);
  return c;
}


vec3 postProcess(vec3 col, vec2 q) {
  //  Found this somewhere on the interwebs
  col = clamp(col, 0.0, 1.0);
  // Gamma correction
  col = pow(col, 1.0/vec3(2.2));
  col = col*0.6+0.4*col*col*(3.0-2.0*col);
  col = mix(col, vec3(dot(col, vec3(0.33))), -0.4);
  // Vignetting
  return col;
}


float pmin(float a, float b, float k) {
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b, a, h) - k*h*(1.0-h);
}


float pmax(float a, float b, float k) {
  return -pmin(-a, -b, k);
}


float pabs(float a, float k) {
  return pmax(a, -a, k);
}


float modMirror1(inout float p, float size) {
  float halfsize = size*0.5;
  float c = floor((p + halfsize)/size);
  p = mod(p + halfsize,size) - halfsize;
  p *= mod(c, iPattern)* iPattern - (1.0 + iLowFreq * iIntensity * 5.);
  return c;
}


vec2 toPolar(vec2 p) {
  return vec2(length(p), atan(p.y, p.x));
}


vec2 toRect(vec2 p) {
  return vec2(p.x*cos(p.y), p.x*sin(p.y));
}

float smoothKaleidoscope(inout vec2 p, float sm, float rep) {
  vec2 hp = p;

  vec2 hpp = toPolar(hp);
  float rn = modMirror1(hpp.y, TAU/rep);

  float sa = PI/rep - pabs(PI/rep - abs(hpp.y), sm);
  hpp.y = sign(hpp.y)*(sa);

  hp = toRect(hpp);

  p = hp;

  return rn;
}

float stripes(float d) {
  float cc = 0.42;
  d = abs(d)-logo_width*cc;
  d = abs(d)-logo_width*cc*(0.5 + iHighFreq);
  return d;
}

vec4 merge(vec4 s0, vec4 s1) {
  bool dt = s0.z < s1.z;
  vec4 b = dt ? s0 : s1;
  vec4 t = dt ? s1 : s0;

  b.x *= 1.0-exp(-max((80.0) *(t.w), 0.0));

  vec4 r = vec4(
      mix(b.xy, t.xy, t.y)
    , b.w < t.w ? b.z : t.z
    , min(b.w, t.w)
    );

  return r;
}

vec4 figure_8(float aa, vec2 p) {
  vec2  p1 = p-vec2(LOGO_DX, -logo_off);
  float d1 = abs(circle(p1, logo_radius));
  float a1 = fast_atan2(-p1.x, -p1.y);
  float s1 = stripes(d1);
  float o1 = d1 - logo_width;

  vec2  p2 = p-vec2(LOGO_DX, logo_off);
  float d2 = abs(circle(p2, logo_radius));
  float a2 = fast_atan2(p2.x, p2.y);
  float s2 = stripes(d2);
  float o2 = d2 - logo_width;

  vec4 c0 = vec4(smoothstep(aa, -aa, s1), smoothstep(aa, -aa, o1), a1, o1);
  vec4 c1 = vec4(smoothstep(aa, -aa, s2), smoothstep(aa, -aa, o2), a2, o2);

  return merge(c0, c1);
}

vec4 figure_half_8(float aa, vec2 p) {
  vec2  p1 = p-vec2(LOGO_DX, -logo_off);
  float d1 = abs(circle(p1, logo_radius));
  float a1 = fast_atan2(-p1.x, -p1.y);
  float s1 = stripes(d1);
  float o1 = d1 - logo_width;

  vec4 c0 = vec4(smoothstep(aa, -aa, s1), smoothstep(aa, -aa, o1), a1, o1);

  return c0;
}

vec2 flipy(vec2 p) {
  return vec2(p.x, -p.y);
}

vec4 clogo(vec2 p, float z, out float d) {
  float iz = 1.0/z;
  p *= iz;
  float aa = iz*2.0/RESOLUTION.y;
  float  n = modPolar(p, 3.0);

  vec4 s0 = figure_8(aa, p);
  vec4 s1 = figure_half_8(aa, p*ROT(2.0*PI/3.0));
  vec4 s2 = figure_half_8(aa, flipy(p*ROT(4.0*PI/3.0)));
  s1.z += -PI;

  vec4 s = s0;
  s = merge(s, s1);
  s = merge(s, s2);

  d = s.w;
  vec3 hsv = vec3(fract(s.z/PI+TIME*0.5), 0.9, 1.0);
  return vec4(hsv2rgb(hsv)*s.x, s.y);
}

vec3 effect(vec2 p, vec2 q) {
  float aa = 2.0/RESOLUTION.y;

  float d;
  float a = (TAU*TIME/300.0) * iSpeed;
  p += 10.0*vec2(sin(a), sin(sqrt(0.5)*a));
  vec2 hp = p;
  vec2 np = hextile(hp);
  float hd = hex(hp.yx, 0.5);
  hd = abs(hd) - 2.0*aa;
  vec2 cp = hp;
  float h = hash(np);
  float hh = fract(137.0*h);
  float sm = mix(mix(0.025, 0.25, hh), 0.025, h);
  float rep = 2.0*floor(mix(8.0, 30.0, h)); // test ilowfreq
  float cn = smoothKaleidoscope(cp, sm, rep);
  cp *= ROT(TIME*iFlowersSpeed+TAU*h);

  vec4 ccol = clogo(cp, 0.6, d);
  vec3 gcol = hsv2rgb(vec3(h, 0.8, 4.0));
  vec3 col  = vec3(iEndColor);
  col += gcol*exp(-50.0*max(d, 0.0));
  col = mix(col, iStartColor, smoothstep(aa, -aa, hd));
  col = mix(col, ccol.xyz, ccol.w);
  return col;
}

void main() {
  // vec2 q = fragCoord/RESOLUTION.xy;
  vec2 uv = ((vUv - vec2(.5, .5)) / vec2(0.2, 0.2)) / 0.1 / iScale;
  vec2 q = uv;

  vec2 p = -1. + 2. * q;
  p.x *= RESOLUTION.x/RESOLUTION.y;

  vec3 col = effect(p, q);
  col = postProcess(col, q);


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
			throw new Error(`Invalid Flowers color: ${color}`);
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

type FlowersFrame = Pick<
	Required<FlowersOptions>,
	| "strokeColor"
	| "backgroundColor"
	| "scale"
	| "responsive"
	| "rotationSpeed"
	| "flowersSpeed"
	| "volume"
	| "pattern"
> & {
	readonly width: number;
	readonly height: number;
	readonly time: number;
	readonly bars: readonly number[];
	readonly textureSrc?: string;
};
type FlowersState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| "iGlobalTime"
		| "iLowFreq"
		| "iMidFreq"
		| "iHighFreq"
		| "iAspect"
		| "iStartColor"
		| "iEndColor"
		| "iScale"
		| "iIntensity"
		| "iSpeed"
		| "iFlowersSpeed"
		| "iVolume"
		| "iPattern",
		WebGLUniformLocation | null
	>;
};
function setupFlowers(canvas: HTMLCanvasElement): FlowersState {
	const gl = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			"Flowers requires WebGL2. Enable browser graphics acceleration and reload Studio.",
		);
	const program = gl.createProgram();
	if (!program) throw new Error("Flowers could not create a program.");
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error("Flowers could not create a shader.");
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(
					`Flowers shader compilation failed: ${gl.getShaderInfoLog(shader)}`,
				);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(
				`Flowers shader linking failed: ${gl.getProgramInfoLog(program)}`,
			);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error("Flowers could not create a vertex buffer.");
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
		return {
			gl,
			program,
			buffer,
			vertexCount: data.length / 5,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, "iGlobalTime"),
				iLowFreq: gl.getUniformLocation(program, "iLowFreq"),
				iMidFreq: gl.getUniformLocation(program, "iMidFreq"),
				iHighFreq: gl.getUniformLocation(program, "iHighFreq"),
				iAspect: gl.getUniformLocation(program, "iAspect"),
				iStartColor: gl.getUniformLocation(program, "iStartColor"),
				iEndColor: gl.getUniformLocation(program, "iEndColor"),
				iScale: gl.getUniformLocation(program, "iScale"),
				iIntensity: gl.getUniformLocation(program, "iIntensity"),
				iSpeed: gl.getUniformLocation(program, "iSpeed"),
				iFlowersSpeed: gl.getUniformLocation(program, "iFlowersSpeed"),
				iVolume: gl.getUniformLocation(program, "iVolume"),
				iPattern: gl.getUniformLocation(program, "iPattern"),
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
function drawFlowers(state: FlowersState, frame: FlowersFrame) {
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
			(frame as FlowersFrame & { inputGainDb?: number }).inputGainDb ?? 0,
			-30,
			30,
			0,
		) /
			20);
	gl.uniform1f(uniforms.iLowFreq, (frame.bars[11] ?? 0) * gain);
	gl.uniform1f(uniforms.iMidFreq, (frame.bars[45] ?? 0) * gain);
	gl.uniform1f(uniforms.iHighFreq, (frame.bars[85] ?? 0) * gain);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.strokeColor));
	gl.uniform3fv(uniforms.iEndColor, linearColor(frame.backgroundColor));
	gl.uniform1f(uniforms.iScale, bounded(frame.scale, 2, 30, 15));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.responsive, 0.1, 2.7, 1));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.rotationSpeed, 0.1, 10, 1));
	gl.uniform1f(
		uniforms.iFlowersSpeed,
		bounded(frame.flowersSpeed, 0.1, 3, 0.2),
	);
	gl.uniform1f(uniforms.iVolume, bounded(frame.volume, 1, 4, 3));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 0.1, 2, 2));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR)
		throw new Error(`Flowers WebGL draw failed: ${error}`);
}
function cleanupFlowers(state: FlowersState) {
	const { gl, program, buffer } = state;
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function FlowersCanvas(frame: FlowersFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<FlowersState | null>(null);
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupFlowers(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error("Flowers WebGL context was lost."));
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => {
			canvas.removeEventListener("webglcontextlost", lost);
			if (!current) return;
			cleanupFlowers(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected)
					current.gl.getExtension("WEBGL_lose_context")?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender("Drawing Flowers");
		try {
			drawFlowers(state.current, frame);
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
const FlowersContent: React.FC<
	Required<FlowersOptions> & { width: number; height: number }
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
			<FlowersCanvas {...props} time={time} bars={bars} />
		</>
	);
};
const FlowersInner = forwardRef<
	HTMLDivElement,
	FlowersProps & { readonly controls: SequenceControls | undefined }
>(
	(
		{
			audioSrc = flowersSchema.audioSrc.default,
			audioOffsetInSeconds = flowersSchema.audioOffsetInSeconds.default,
			playAudio = flowersSchema.playAudio.default,
			inputGainDb = flowersSchema.inputGainDb.default,
			strokeColor = flowersSchema.strokeColor.default,
			backgroundColor = flowersSchema.backgroundColor.default,
			scale = flowersSchema.scale.default,
			responsive = flowersSchema.responsive.default,
			rotationSpeed = flowersSchema.rotationSpeed.default,
			flowersSpeed = flowersSchema.flowersSpeed.default,
			volume = flowersSchema.volume.default,
			pattern = flowersSchema.pattern.default,
			timeOffsetInSeconds = flowersSchema.timeOffsetInSeconds.default,
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
				name={name ?? "Flowers"}
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
					<FlowersContent
						key={`${audioSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						strokeColor={strokeColor}
						backgroundColor={backgroundColor}
						scale={scale}
						responsive={responsive}
						rotationSpeed={rotationSpeed}
						flowersSpeed={flowersSpeed}
						volume={volume}
						pattern={pattern}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);
export const Flowers = Interactive.withSchema({
	Component: FlowersInner,
	componentName: "<Flowers>",
	componentIdentity: null,
	schema: flowersSchema,
	supportsEffects: false,
}) as React.FC<FlowersProps>;
