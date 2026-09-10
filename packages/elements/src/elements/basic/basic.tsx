import {Audio} from '@remotion/media';
import {
	useWindowedAudioData,
	visualizeAudio,
	type MediaUtilsAudioData,
} from '@remotion/media-utils';
import React, {
	forwardRef,
	useId,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from 'react';
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
} from 'remotion';

type BasicOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly backgroundColor?: string;
	readonly intensifyColor?: string;
	readonly starsColor?: string;
	readonly responsive?: number;
	readonly enableStars?: boolean;
	readonly starsAudioReactivity?: number;
	readonly stars?: number;
	readonly pattern?: number;
	readonly speed?: number;
	readonly timeOffsetInSeconds?: number;
};
type BasicProps = InteractiveBaseProps & InteractiveTransformProps & BasicOptions;

const basicSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
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
	backgroundColor: {type: 'color', default: '#070c22', description: 'Background color'},
	intensifyColor: {type: 'color', default: '#221d49', description: 'Intensify color'},
	starsColor: {type: 'color', default: '#858585', description: 'Stars color'},
	responsive: {
		type: 'number',
		default: 1.3,
		min: 0,
		max: 4,
		step: 0.1,
		description: 'Audio reactivity',
		hiddenFromList: false,
	},
	enableStars: {type: 'boolean', default: false, description: 'Enable stars'},
	starsAudioReactivity: {
		type: 'number',
		default: 1,
		min: 1,
		max: 40,
		step: 0.5,
		description: 'Stars audio reactivity',
		hiddenFromList: false,
	},
	stars: {
		type: 'number',
		default: 6,
		min: 1,
		max: 60,
		step: 1,
		description: 'Stars density',
		hiddenFromList: false,
	},
	pattern: {
		type: 'number',
		default: 0.25,
		min: 0.1,
		max: 5,
		step: 0.05,
		description: 'Flickering',
		hiddenFromList: false,
	},
	speed: {
		type: 'number',
		default: 1,
		min: 0,
		max: 10,
		step: 0.1,
		description: 'Movement speed',
		hiddenFromList: false,
	},
	timeOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		description: 'Animation phase offset in seconds (independent of audio trim)',
		hiddenFromList: false,
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
	...Interactive.transformSchema,
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
		const handle = delayRender('Waiting for complete Basic audio history');
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return {...result, audioData: complete ? audioData : null};
}
function computeBars(values: number[]) {
	const bars = Array.from({length: 308}, () => 0.0025);
	const step = (22000 - 20) / values.length;
	for (let index = 0; index < values.length; index++) {
		const frequency = 20 + index * step;
		const bin = Math.floor((Math.log10(frequency / 20) / Math.log10(1100)) * 308);
		if (bin < 308) bars[bin] += bin < 103 ? values[index] * 1.3 : values[index];
	}
	return bars.map((value) => (Number.isFinite(value) ? value : 0));
}
function spectrumBars(audioData: MediaUtilsAudioData, offset: number, time: number) {
	if (time < 0 || time >= audioData.durationInSeconds) return Array(308).fill(0) as number[];
	return computeBars(
		visualizeAudio({
			audioData,
			dataOffsetInSeconds: offset,
			frame: time * 60,
			fps: 60,
			numberOfSamples: 4096,
			optimizeFor: 'speed',
			smoothing: true,
		}),
	);
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
uniform float iStarsAudioReactivity;

uniform bool iEnableStars;

uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform vec3 iStarsColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);


#define RESOLUTION    iResolution
#define TIME          iGlobalTime
#define PI            3.141592654
#define TAU           (2.0*PI)


const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}

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

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
    
  vec2 u = f*f*(3.0-2.0*f);

  float a = hash(i + vec2(0.0,0.0));
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  
  float m0 = mix(a, b, u.x);
  float m1 = mix(c, d, u.x);
  float m2 = mix(m0, m1, u.y);
  
  return m2;
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

vec3 stars(vec2 sp, float hh) {
  vec3 scol0 = iStarsColor;
  vec3 scol1 = iStarsColor;
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

    vec3 ccol = col + exp(-(mix(6000.0, 2000.0, hh)/mix(2.0 + iLowFreq * iStarsAudioReactivity, 0.25, s))*max(l-0.001, 0.0))*scol;
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

vec3 skyColor(vec3 ro, vec3 rd) {
  vec2 sp     = toSpherical(rd.xzy).yz;

  vec3 col = iStartColor;

  col += mix(iStartColor, iEndColor, iLowFreq * iIntensity);

  if (iEnableStars) {
    col += stars(sp, .15);  
  }
  
  return col;
}

vec3 color(vec3 ww, vec3 uu, vec3 vv, vec3 ro, vec2 p) {
  float rdd = 2.0;
  vec3 rd = normalize(p.x*uu + p.y*vv + rdd*ww);

  vec3 skyCol = skyColor(ro, rd);

  return skyCol;
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
  vec3 col = vec3(1.0);
  col = effect(p, q);
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
			hex.length === 3 ? [...hex].map((character) => character + character).join('') : hex;
		bytes = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
	} else {
		if (!CSS.supports('color', color)) throw new Error(`Invalid Basic color: ${color}`);
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

type BasicFrame = Pick<
	Required<BasicOptions>,
	| 'backgroundColor'
	| 'intensifyColor'
	| 'starsColor'
	| 'responsive'
	| 'enableStars'
	| 'starsAudioReactivity'
	| 'stars'
	| 'pattern'
	| 'speed'
> & {
	readonly width: number;
	readonly height: number;
	readonly time: number;
	readonly bars: readonly number[];
	readonly textureSrc?: string;
};
type BasicState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| 'iGlobalTime'
		| 'iLowFreq'
		| 'iMidFreq'
		| 'iHighFreq'
		| 'iAspect'
		| 'iStartColor'
		| 'iEndColor'
		| 'iStarsColor'
		| 'iIntensity'
		| 'iEnableStars'
		| 'iStarsAudioReactivity'
		| 'iStars'
		| 'iPattern'
		| 'iSpeed',
		WebGLUniformLocation | null
	>;
};
function setupBasic(canvas: HTMLCanvasElement): BasicState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Basic requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Basic could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Basic could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Basic shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Basic shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Basic could not create a vertex buffer.');
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
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, 'iGlobalTime'),
				iLowFreq: gl.getUniformLocation(program, 'iLowFreq'),
				iMidFreq: gl.getUniformLocation(program, 'iMidFreq'),
				iHighFreq: gl.getUniformLocation(program, 'iHighFreq'),
				iAspect: gl.getUniformLocation(program, 'iAspect'),
				iStartColor: gl.getUniformLocation(program, 'iStartColor'),
				iEndColor: gl.getUniformLocation(program, 'iEndColor'),
				iStarsColor: gl.getUniformLocation(program, 'iStarsColor'),
				iIntensity: gl.getUniformLocation(program, 'iIntensity'),
				iEnableStars: gl.getUniformLocation(program, 'iEnableStars'),
				iStarsAudioReactivity: gl.getUniformLocation(program, 'iStarsAudioReactivity'),
				iStars: gl.getUniformLocation(program, 'iStars'),
				iPattern: gl.getUniformLocation(program, 'iPattern'),
				iSpeed: gl.getUniformLocation(program, 'iSpeed'),
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
function drawBasic(state: BasicState, frame: BasicFrame) {
	const {gl, program, uniforms} = state;
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	const gain =
		10 **
		(bounded((frame as BasicFrame & {inputGainDb?: number}).inputGainDb ?? 0, -30, 30, 0) / 20);
	gl.uniform1f(uniforms.iLowFreq, (frame.bars[11] ?? 0) * gain);
	gl.uniform1f(uniforms.iMidFreq, (frame.bars[45] ?? 0) * gain);
	gl.uniform1f(uniforms.iHighFreq, (frame.bars[85] ?? 0) * gain);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.backgroundColor));
	gl.uniform3fv(uniforms.iEndColor, linearColor(frame.intensifyColor));
	gl.uniform3fv(uniforms.iStarsColor, linearColor(frame.starsColor));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.responsive, 0, 4, 1.3));
	gl.uniform1i(uniforms.iEnableStars, Number(frame.enableStars));
	gl.uniform1f(uniforms.iStarsAudioReactivity, bounded(frame.starsAudioReactivity, 1, 40, 1));
	gl.uniform1f(uniforms.iStars, bounded(frame.stars, 1, 60, 6));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 0.1, 5, 0.25));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0, 10, 1));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Basic WebGL draw failed: ${error}`);
}
function cleanupBasic(state: BasicState) {
	const {gl, program, buffer} = state;
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function BasicCanvas(frame: BasicFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<BasicState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupBasic(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Basic WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupBasic(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Basic');
		try {
			drawBasic(state.current, frame);
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
const BasicContent: React.FC<Required<BasicOptions> & {width: number; height: number}> = (
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
			<BasicCanvas {...props} time={time} bars={bars} />
		</>
	);
};
const BasicInner = forwardRef<
	HTMLDivElement,
	BasicProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			audioSrc = basicSchema.audioSrc.default,
			audioOffsetInSeconds = basicSchema.audioOffsetInSeconds.default,
			playAudio = basicSchema.playAudio.default,
			inputGainDb = basicSchema.inputGainDb.default,
			backgroundColor = basicSchema.backgroundColor.default,
			intensifyColor = basicSchema.intensifyColor.default,
			starsColor = basicSchema.starsColor.default,
			responsive = basicSchema.responsive.default,
			enableStars = basicSchema.enableStars.default,
			starsAudioReactivity = basicSchema.starsAudioReactivity.default,
			stars = basicSchema.stars.default,
			pattern = basicSchema.pattern.default,
			speed = basicSchema.speed.default,
			timeOffsetInSeconds = basicSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Basic'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						position: 'relative',
						boxSizing: 'border-box',
						width: drawingWidth,
						height: drawingHeight,
						overflow: 'hidden',
						...style,
					}}
				>
					<BasicContent
						key={`${audioSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						backgroundColor={backgroundColor}
						intensifyColor={intensifyColor}
						starsColor={starsColor}
						responsive={responsive}
						enableStars={enableStars}
						starsAudioReactivity={starsAudioReactivity}
						stars={stars}
						pattern={pattern}
						speed={speed}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);
export const Basic = Interactive.withSchema({
	Component: BasicInner,
	componentName: '<Basic>',
	componentIdentity: null,
	schema: basicSchema,
	supportsEffects: false,
}) as React.FC<BasicProps>;
