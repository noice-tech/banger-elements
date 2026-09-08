import { Audio } from "@remotion/media";
import {
	useWindowedAudioData,
	visualizeAudio,
	type MediaUtilsAudioData,
} from "@remotion/media-utils";
import React, {
	forwardRef,
	useRef,
	useImperativeHandle,
	useId,
	useMemo,
	useLayoutEffect,
} from "react";
import {
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	cancelRender,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type SequenceControls,
	type InteractivitySchema,
} from "remotion";

type SynthwaveOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly sphereColor?: string;
	readonly hideSphere?: boolean;
	readonly mountainsPattern?: number;
	readonly mountainsHeight?: number;
	readonly mountainsSmoothness?: number;
	readonly mountainsDistance?: number;
	readonly responsive?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};

type SynthwaveProps = InteractiveBaseProps &
	InteractiveTransformProps &
	SynthwaveOptions;

const synthwaveSchema = {
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
	inputGainDb: {
		type: "number",
		default: 0,
		min: -30,
		max: 30,
		step: 1,
		description: "Visual gain in dB",
		hiddenFromList: false,
	},
	startColor: { type: "color", default: "#9333ea", description: "Base color" },
	endColor: {
		type: "color",
		default: "#ff00ff",
		description: "Mountain outline",
	},
	sphereColor: {
		type: "color",
		default: "#4b9dc3",
		description: "Sphere color",
	},
	hideSphere: { type: "boolean", default: false, description: "Hide sphere" },
	mountainsPattern: {
		type: "number",
		default: 1,
		description: "Mountains pattern",
		min: 1,
		max: 100,
		step: 0.5,
		hiddenFromList: false,
	},
	mountainsHeight: {
		type: "number",
		default: 4,
		description: "Mountains height",
		min: 1,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
	},
	mountainsSmoothness: {
		type: "number",
		default: 1,
		description: "Mountains smoothness",
		min: 1,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
	},
	mountainsDistance: {
		type: "number",
		default: 0,
		description: "Mountains distance",
		min: -10,
		max: 10,
		step: 0.5,
		hiddenFromList: false,
	},
	responsive: {
		type: "number",
		default: 1,
		description: "Audio reactivity",
		min: 1,
		max: 10,
		step: 1,
		hiddenFromList: false,
	},
	bpm: {
		type: "number",
		default: 120,
		description: "Animation tempo in BPM",
		min: 1,
		max: 300,
		step: 1,
		hiddenFromList: false,
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
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

const decodeWindowSeconds = 20;

function hasCompleteAudioWindow(
	audioData: MediaUtilsAudioData,
	offset: number,
	time: number,
) {
	const chunk = Math.floor(time / decodeWindowSeconds);
	const expectedStart = Math.max(0, (chunk - 1) * decodeWindowSeconds);
	const expectedEnd = Math.min(
		audioData.durationInSeconds,
		(chunk + 2) * decodeWindowSeconds,
	);
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
				? {
						...result.audioData,
						resultId: `${instanceId}:${revision.current++}`,
					}
				: null,
		[result.audioData, instanceId],
	);
	// The current chunk can arrive before its retained neighbors.
	const complete =
		audioData === null ||
		hasCompleteAudioWindow(audioData, result.dataOffsetInSeconds, time);
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		if (complete) return;
		const handle = delayRender("Waiting for complete visualizer audio history");
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return { ...result, audioData: complete ? audioData : null };
}

type AudioInput = {
	readonly audioData: MediaUtilsAudioData;
	readonly dataOffsetInSeconds: number;
	readonly sourceTime: number;
	readonly fps: number;
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
	const bars = Array.from({ length: outputBarsCount }, () => defaultFill);
	const binSize = 1 / outputBarsCount;
	for (let index = 0; index < allVisualizationValues.length; index++) {
		const frequency = minFreq + index * freqStep;
		const logFrequency =
			Math.log10(frequency / minFreq) / Math.log10(maxFreq / minFreq);
		const binIndex = Math.floor(logFrequency / binSize);
		if (binIndex < outputBarsCount) {
			bars[binIndex] +=
				binIndex < Math.floor(outputBarsCount * 0.334415584415584)
					? allVisualizationValues[index] * 1.3
					: allVisualizationValues[index];
			if (
				outputBarsCount !== 308 &&
				binIndex >= Math.floor(outputBarsCount * 0.9845)
			) {
				bars[binIndex] = defaultFill;
			}
		}
	}
	return bars.filter((b) => b !== defaultFill && !Number.isNaN(b));
}

function spectrumBars(input: AudioInput, count = 308) {
	if (
		input.sourceTime < 0 ||
		input.sourceTime >= input.audioData.durationInSeconds
	)
		return Array(count).fill(0) as number[];
	const frequencies = visualizeAudio({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame: input.sourceTime * 60,
		fps: 60,
		numberOfSamples: 4096,
		optimizeFor: "speed",
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		outputBarsCount: count,
	});
}

// All numeric entry points are bounded, including direct JSX and non-finite values.
function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

function synthwaveTiming(
	frame: number,
	fps: number,
	audioOffset: number,
	timeOffset: number,
) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function synthwaveBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

// Match the source's 32 × 32 environment sphere rather than stretching its UVs
// across a quad. The default camera is at (0, 0, 5), with a 75-degree vertical FOV.
function synthwaveGeometry() {
	const vertices: number[] = [];
	const vertex = (x: number, y: number) => {
		const u = x / 32;
		const v = y / 32;
		const longitude = u * Math.PI * 2;
		const latitude = v * Math.PI;
		const poleOffset = y === 0 ? 1 / 64 : y === 32 ? -1 / 64 : 0;
		vertices.push(
			-100 * Math.cos(longitude) * Math.sin(latitude),
			100 * Math.cos(latitude),
			100 * Math.sin(longitude) * Math.sin(latitude),
			u + poleOffset,
			1 - v,
		);
	};
	for (let y = 0; y < 32; y++) {
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
	}
	return new Float32Array(vertices);
}

const vertexShader = `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform float iAspect;
void main() {
 vUv = uv;
 float c = cos(1.6);
 float s = sin(1.6);
 vec3 p = vec3(c * position.x + s * position.z, position.y,
  -s * position.x + c * position.z - 5.0);
 float f = 1.0 / tan(radians(75.0) * 0.5);
 gl_Position = vec4(p.x * f / iAspect, p.y * f,
  -(1000.0 + 0.1) / (1000.0 - 0.1) * p.z - 2.0 * 1000.0 * 0.1 / (1000.0 - 0.1), -p.z);
}`;

type SynthwaveFrame = Pick<
	Required<SynthwaveOptions>,
	| "width"
	| "height"
	| "startColor"
	| "endColor"
	| "sphereColor"
	| "hideSphere"
	| "mountainsPattern"
	| "mountainsHeight"
	| "mountainsSmoothness"
	| "mountainsDistance"
	| "responsive"
	| "bpm"
> & { readonly time: number; readonly bands: readonly number[] };

type SynthwaveState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| "iGlobalTime"
		| "iLowFreq"
		| "iMidFreq"
		| "iHighFreq"
		| "iStartColor"
		| "iEndColor"
		| "iSphereColor"
		| "iSphereTransparency"
		| "iMountainsPattern"
		| "iMountainsHeight"
		| "iMountainsSmoothness"
		| "iMountainsDistance"
		| "iResponsive"
		| "iBpm"
		| "iAspect",
		WebGLUniformLocation | null
	>;
};

function setupSynthwave(canvas: HTMLCanvasElement): SynthwaveState {
	const gl = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			"Synthwave requires WebGL2. Enable browser graphics acceleration and reload Studio.",
		);
	const program = gl.createProgram();
	if (!program) throw new Error("Synthwave could not create a program.");
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error("Synthwave could not create a shader.");
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(
					`Synthwave shader compilation failed: ${gl.getShaderInfoLog(shader)}`,
				);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(
				`Synthwave shader linking failed: ${gl.getProgramInfoLog(program)}`,
			);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error("Synthwave could not create a vertex buffer.");
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = synthwaveGeometry();
		gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
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
			vertexCount: geometry.length / 5,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, "iGlobalTime"),
				iLowFreq: gl.getUniformLocation(program, "iLowFreq"),
				iMidFreq: gl.getUniformLocation(program, "iMidFreq"),
				iHighFreq: gl.getUniformLocation(program, "iHighFreq"),
				iStartColor: gl.getUniformLocation(program, "iStartColor"),
				iEndColor: gl.getUniformLocation(program, "iEndColor"),
				iSphereColor: gl.getUniformLocation(program, "iSphereColor"),
				iSphereTransparency: gl.getUniformLocation(
					program,
					"iSphereTransparency",
				),
				iMountainsPattern: gl.getUniformLocation(program, "iMountainsPattern"),
				iMountainsHeight: gl.getUniformLocation(program, "iMountainsHeight"),
				iMountainsSmoothness: gl.getUniformLocation(
					program,
					"iMountainsSmoothness",
				),
				iMountainsDistance: gl.getUniformLocation(
					program,
					"iMountainsDistance",
				),
				iResponsive: gl.getUniformLocation(program, "iResponsive"),
				iBpm: gl.getUniformLocation(program, "iBpm"),
				iAspect: gl.getUniformLocation(program, "iAspect"),
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

function drawSynthwave(
	{ gl, program, uniforms, vertexCount }: SynthwaveState,
	frame: SynthwaveFrame,
) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	gl.uniform1f(uniforms.iLowFreq, frame.bands[0] ?? 0);
	gl.uniform1f(uniforms.iMidFreq, frame.bands[1] ?? 0);
	gl.uniform1f(uniforms.iHighFreq, frame.bands[2] ?? 0);
	// Match the source's linear Three.js color uniforms; output is display RGB.
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.iEndColor, linearColor(frame.endColor));
	gl.uniform3fv(uniforms.iSphereColor, linearColor(frame.sphereColor));
	gl.uniform1i(uniforms.iSphereTransparency, frame.hideSphere ? 1 : 0);
	gl.uniform1f(
		uniforms.iMountainsPattern,
		bounded(frame.mountainsPattern, 1, 100, 1),
	);
	gl.uniform1f(
		uniforms.iMountainsHeight,
		bounded(frame.mountainsHeight, 1, 10, 4),
	);
	gl.uniform1f(
		uniforms.iMountainsSmoothness,
		bounded(frame.mountainsSmoothness, 1, 10, 1),
	);
	gl.uniform1f(
		uniforms.iMountainsDistance,
		bounded(frame.mountainsDistance, -10, 10, 0),
	);
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 1, 10, 1));
	gl.uniform1f(uniforms.iBpm, bounded(frame.bpm, 1, 300, 120));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR)
		throw new Error(`Synthwave WebGL draw failed: ${error}`);
}

function cleanupSynthwave({ gl, program, buffer }: SynthwaveState) {
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function SynthwaveCanvas(frame: SynthwaveFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<SynthwaveState | null>(null);
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupSynthwave(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error("Synthwave WebGL context was lost."));
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => {
			canvas.removeEventListener("webglcontextlost", lost);
			cleanupSynthwave(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected)
					current.gl.getExtension("WEBGL_lose_context")?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender("Drawing Synthwave");
		try {
			drawSynthwave(state.current, frame);
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

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

uniform float iGlobalTime;

uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iResponsive;

uniform float iMountainsPattern;
uniform float iMountainsDistance;
uniform float iMountainsHeight;
uniform float iMountainsSmoothness;
uniform bool iSphereTransparency;

uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform vec3 iSphereColor;

in vec2 vUv;
out vec4 outColor;

vec3 iResolution = vec3(1920., 1080., 1.);

// #define THAT_CRT_FEELING
#define TIME        iGlobalTime * (iBpm / 60.0)
#define RESOLUTION  iResolution
#define PI          3.141592654
#define PI_2        (0.5*PI)
#define TAU         (2.0*PI)
#define SCA(a)      vec2(sin(a), cos(a))
#define ROT(a)      mat2(cos(a), sin(a), -sin(a), cos(a))


const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}
//  Macro version of above to enable compile-time constants
#define HSV2RGB(c)  (c.z * mix(hsv2rgb_K.xxx, clamp(abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www) - hsv2rgb_K.xxx, 0.0, 1.0), c.y))
vec3 rgb2hsv(vec3 c) {
  const vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

const vec3 skyCol       = HSV2RGB(vec3(0.58, 0.86, 1.0));
const vec3 speCol1      = HSV2RGB(vec3(0.60, 0.25, 1.0));
const vec3 speCol2      = HSV2RGB(vec3(0.55, 0.25, 1.0));
const vec3 diffCol1     = HSV2RGB(vec3(0.60, 0.90, 1.0));
const vec3 diffCol2     = HSV2RGB(vec3(0.55, 0.90, 1.0));
const vec3 sunCol1      = HSV2RGB(vec3(0.60, 0.50, 0.5));
const vec3 sunDir2      = normalize(vec3(0., 0.72, 1.0));
const vec3 sunDir       = normalize(vec3(0.0, 0.05, 1.0));
const vec3 sunCol       = HSV2RGB(vec3(0.58, 0.86, 0.0005));
const float mountainPos = -20.0;

float atan_approx(float y, float x) {
  float cosatan2 = x / (abs(x) + abs(y));
  float t = PI_2 - cosatan2 * PI_2;
  return y < 0.0 ? -t : t;
}

float tanh_approx(float x) {
  //  Found this somewhere on the interwebs
  //  return tanh(x);
  float x2 = x*x;
  return clamp(x*(27.0 + x2)/(27.0+9.0*x2), -1.0, 1.0);
}

vec3 toSpherical(vec3 p) {
  float r   = max(length(p), 0.0001);
  float t   = acos(clamp(p.z/r, -1.0, 1.0));
  float ph  = atan_approx(p.y, p.x);
  return vec3(r, t, ph);
}

vec3 sRGB(vec3 t) {
  t = max(t, vec3(0.0));
  return mix(1.055*pow(t, vec3(1./2.4)) - 0.055, 12.92*t, step(t, vec3(0.0031308)));
}

// Inverse sRGB: convert from sRGB to linear
vec3 sRGBToLinear(vec3 t) {
  t = max(t, vec3(0.0));
  return mix(pow((t + 0.055) / 1.055, vec3(2.4)), t / 12.92, step(t, vec3(0.04045)));
}

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

float rayPlane(vec3 ro, vec3 rd, vec4 p) {
  return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}


float equilateralTriangle(vec2 p) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - 1.0;
  p.y = p.y + 1.0/k;
  if( p.x+k*p.y>0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
  p.x -= clamp( p.x, -2.0, 0.0 );
  return -length(p)*sign(p.y);
}


float box(vec2 p, vec2 b) {
  vec2 d = abs(p)-b;
  return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p-a, ba = b-a;
  float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
  return length(pa - ba*h);
}

float hash(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,58.233))) * 13758.5453);
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

vec2 raySphere(vec3 ro, vec3 rd, vec4 dim) {
  vec3 ce = dim.xyz;
  float ra = dim.w;
  vec3 oc = ro - ce;
  float b = dot( oc, rd );
  float c = dot( oc, oc ) - ra*ra;
  float h = b*b - c;
  if( h<0.0 ) return vec2(-1.0); // no intersection
  h = sqrt( h );
  return vec2( -b-h, -b+h );
}

vec3 skyRender(vec3 ro, vec3 rd) {

  vec3 dcol = iSphereColor;

  vec3 col = vec3(0.0);
  col += 0.025*dcol;
  // col += skyCol*0.0093/pow((1.001+((dot(sunDir2, rd)))), 10.0);
  col += dcol*0.0033/pow((1.001+((dot(sunDir2, rd)))), 2.0);

  float tp0  = rayPlane(ro, rd, vec4(vec3(0.0, 1.0, 0.0), 4.0));
  float tp1  = rayPlane(ro, rd, vec4(vec3(0.0, -1.0, 0.0), 6.0));
  float tp = tp1;
  tp = max(tp0,tp1);


  if (tp1 > 0.0) {
    vec3 pos  = ro + tp1*rd;
    vec2 pp = pos.xz;
    float db = box(pp, vec2(5.0, 9.0))-3.0;

    col += vec3(4.0)*dcol*rd.y*rd.y*smoothstep(0.25, 0.0, db);
    col += vec3(0.8)*dcol*exp(-0.5*max(db, 0.0));
    col += 0.25*sqrt(dcol)*max(-db, 0.0);
  }

  if (tp0 > 0.0) {
    vec3 pos  = ro + tp0*rd;
    vec2 pp = pos.xz;
    float ds = length(pp) - 0.5;

    col += (0.25)*dcol*exp(-.5*max(ds, 0.0));
  }

  return clamp(col, 0.0, 10.0);
}

vec4 sphere(vec3 ro, vec3 rd, vec4 sdim) {
  vec2 si = raySphere(ro, rd, sdim);

  vec3 nsp = ro + rd*si.x;

  const vec3 lightPos1   = vec3(0.0, 10.0, 10.0);
  const vec3 lightPos2   = vec3(0.0, -80.0, 10.0);

  vec3 nld1   = normalize(lightPos1-nsp);
  vec3 nld2   = normalize(lightPos2-nsp);

  vec3 nnor   = normalize(nsp - sdim.xyz);

  vec3 nref   = reflect(rd, nnor);

  vec3 hsv = rgb2hsv(iSphereColor);
  hsv.y = clamp(hsv.y * 1.5, 0.0, 1.0);
  vec3 saturatedColor = hsv2rgb(hsv);

  const float sf = 4.0;
  float ndif1 = max(dot(nld1, nnor), 0.0);
  ndif1       *= ndif1;
  vec3 nspe1  = pow((iSphereColor * 2.0) * max(dot(nld1, nref), 0.25), sf*vec3(1.0, 0.8, 0.5));

  float ndif2 = max(dot(nld2, nnor), 0.0);
  ndif2       *= ndif2;
  vec3 nspe2  = pow(saturatedColor*max(dot(nld2, nref), 0.0), sf*vec3(0.9, 0.5, 0.5));

  vec3 nsky   = skyRender(nsp, nref);
  float nfre  = 1.0+dot(rd, nnor);
  nfre        *= nfre;


  vec3 hsv2 = rgb2hsv(iSphereColor);
  hsv2.y = clamp(hsv.y * 2.5, 1.0, 1.5); // Increase saturation by 50%
  vec3 ySaturatedColor = hsv2rgb(hsv2);

  vec3 scol = vec3(0.0);
  scol += nsky*mix(iSphereColor, saturatedColor + 0.05, 1.25);
  scol += iSphereColor*ndif1;
  scol += diffCol2*ndif2; // todo
  scol += nspe1; // todo
  scol += ySaturatedColor;

  float t = tanh_approx(2.0*(si.y-si.x)/sdim.w);

  return vec4(scol, t);
}

vec3 sphereRender(vec3 ro, vec3 rd) {
  vec3 skyCol = skyRender(ro, rd);
  float contrast = 0.6;
  vec3 mcol = (iSphereColor - 0.5) * contrast + 0.5;

  float blackAmount = 0.7;
  mcol = mix(mcol, vec3(0.0), blackAmount);
  // vec3 col = mcol;
  vec3 col = skyCol;

  const vec4 sdim0 = vec4(vec3(0.0), 2.0);
  vec4 scol0 = sphere(ro, rd, sdim0);
  if (!iSphereTransparency) {
    col = mix(col, scol0.xyz, scol0.w);
  }

  return col;
}

vec3 sphereEffect(vec2 p) {
  const float fov = tan(TAU/6.0);
  const vec3 ro = 1.0*vec3(0.0, 2.0, 5.0);
  const vec3 la = vec3(0.0, 0.0, 0.0);
  const vec3 up = vec3(0.0, 1.0, 0.0);

  vec3 ww = normalize(la - ro);
  vec3 uu = normalize(cross(up, ww));
  vec3 vv = cross(ww,uu);
  vec3 rd = normalize(-p.x*uu + p.y*vv + fov*ww);

  vec3 col = sphereRender(ro, rd);

  return col;
}

vec3 cityOfKali(vec2 p) {
  vec2 c = -vec2(0.5, 0.5)*1.12;

  float s = 2.0;
  vec2 kp = p/s;

  const float a = PI/4.0;
  const vec2 n = vec2(cos(a), sin(a));

  float ot2 = 1E6;
  float ot3 = 1E6;
  float n2 = 0.0;
  float n3 = 0.0;

  const float mx = 12.0;
  for (float i = 0.0; i < mx; ++i) {
    float m = (dot(kp, kp));
    s *= m;
    kp = abs(kp)/m + c;
    float d2 = (abs(dot(kp,n)))*s;
    if (d2 < ot2) {
      n2 = i;
      ot2 = d2;
    }
    float d3 = (dot(kp, kp));
    if (d3 < ot3) {
      n3 = i;
      ot3 = d3;
    }
  }
  vec3 col = vec3(0.0);
  n2 /= mx;
  n3 /= mx;
  col += 0.25*(hsv2rgb(vec3(0.8-0.2*n2*n2, 0.90, 0.025))/(sqrt(ot2)+0.0025));
  col += hsv2rgb(vec3(0.55+0.8*n3, 0.85, 0.00000025))/(ot3*ot3+0.000000025);
  return col;
}

vec3 outerSkyRender(vec3 ro, vec3 rd) {
  vec3 center = ro+vec3(-100.0, 40.0, 100.0);
  vec4 sdim = vec4(center, 50);
  vec2 pi = raySphere(ro, rd, sdim);
  const vec3 pn = normalize(vec3(0., 1.0, -0.8));
  vec4 pdim = vec4(pn, -dot(pn, center));
  float ri = rayPlane(ro, rd, pdim);

  vec3 col = vec3(0.0);

  col += sunCol/pow((1.001-((dot(sunDir, rd)))), 2.0);

  if (pi.x != -1.0) {
    vec3 pp = ro + rd*pi.x;
    vec3 psp= pp-sdim.xyz;
    vec3 pn = normalize(pp-sdim.xyz);
    psp = psp.zxy;
    psp.yz *= ROT(-0.5);
    psp.xy *= ROT(0.025*TIME);
    vec3 pss= toSpherical(psp);
    vec3 pcol = vec3(0.0);
    float dif = max(dot(pn, sunDir), 0.0);
    vec3 sc = 2000.0*sunCol;
    pcol += sc*dif;
    pcol += (cityOfKali(pss.yz))*smoothstep(0.125, 0.0, dif);
    pcol += pow(max(dot(reflect(rd, pn), sunDir), 0.0), 9.0)*sc;
    col = mix(col, pcol, tanh_approx(0.125*(pi.y-pi.x)));

  }

  vec3 gcol = vec3(0.0);

  vec3 rp = ro + rd*ri;
  float rl = length(rp-center);
  float rb = 1.55*sdim.w;
  float re = 2.45*sdim.w;
  float rw = 0.1*sdim.w;
  //
//   vec3 rcol = hsv2rgb(vec3(clamp((0.005*(rl+32.0)), 0.6, 0.8), 0.9, 1.0));
    vec3 rcol = mix(iStartColor, iEndColor, clamp((0.0012*(rl+32.0)), 0., 1.0)) * 2.0;
    vec3 hsv = rgb2hsv(rcol);
    hsv.y = clamp(hsv.y * 5.5, 1.0, 1.0); // Increase saturation by 50%
    rcol = hsv2rgb(hsv);
  gcol = rcol*(0.025 + iHighFreq / 2.);
  if (ri > 0.0 && (pi.x == -1.0 || ri < pi.x)) {
    float mrl = rl;
    float nrl = mod1(mrl, rw);
    float rfre = 1.0+dot(rd, pn);
    vec3 rrcol = (rcol/max(abs(mrl), 0.1+smoothstep(0.7, 1.0, rfre)));
    rrcol *= smoothstep(1.0, 0.3, rfre);
    rrcol *= smoothstep(re, re-0.5*rw, rl);
    rrcol *= smoothstep(rb-0.5*rw, rb, rl);
    col += rrcol;;
  }

  col += gcol/max(abs(rd.y), 0.0033);

return col;
}

float circle(vec2 p, float r) {
    return length(p) - r;
}

vec3 triRender(vec3 col, vec3 ro, vec3 rd, inout float maxt) {
    const vec3 tpn = normalize(vec3(0.0, 0.0, 1.0));
    const vec4 tpdim = vec4(tpn, -2.0);
    float tpd = rayPlane(ro, rd, tpdim);

    if (tpd < 0.0 || tpd > maxt) {
        return col;
    }

    vec3 pp = ro+rd*tpd;
    vec2 p = pp.xy;
    p *= 0.5;

    const float off = 1.2-0.02;
    vec2 op = p;
    p.y -= off;
    const vec2 n = SCA(-PI/3.0);
    vec2 gp = p;
    float hoff = 0.15*dot(n, p);
    // vec3 gcol = hsv2rgb(vec3(clamp(0.7+hoff, 0.6, 0.8), 0.90, 0.02));
    vec3 gcol = mix(iStartColor, iEndColor, clamp(sin(hoff * 2.0 * 3.14159), 0.0, 1.0)) / 60.;
    vec3 hsv = rgb2hsv(gcol);
    hsv.y = clamp(hsv.y * 5.5, 5.0, 1.0); // Increase saturation by 50%
    gcol = hsv2rgb(hsv);
    vec2 pt = p;
    pt.y = -pt.y;
    const float zt = 1.0;
    float dt = equilateralTriangle(pt/zt)*zt;
    float roundness = 0.15; // Adjust this value to change the roundness
    float dt_rounded = mix(dt, circle(pt/zt, zt), roundness);

    // Replace dt with dt_rounded in the rest of your code
    col = dt_rounded < 0.0 ? sphereEffect(1.5*(p)) : col;
    col += (gcol/max(abs(dt_rounded), 0.001))*smoothstep(0.25, 0.0, dt_rounded);
    if (dt_rounded < 0.0) {
        maxt = tpd;
    }
    return col;
}

float heightFactor(vec2 p) {
  return iMountainsHeight*smoothstep(7.0, 0.5, abs(p.x))+.5;
}

float hifbm(vec2 p) {
  p *= 0.25; // todo
  float hf = heightFactor(p);
  float aa = 0.5;
  float pp = 2.0 -0. + iMountainsPattern;

  float sum = 0.0;
  float a   = 1.0;

  for (int i = 0; i < 5; ++i) {
    sum += a*vnoise(p);
    a *= aa;
    p *= pp;

    if (iResponsive > 1.0) {
      a += iLowFreq * iResponsive * 0.1;
      p += iLowFreq * iResponsive * 0.1;
    }

    if (iMountainsSmoothness > 1.0) {
      a /= iMountainsSmoothness / 2.0;
      p /= iMountainsSmoothness / 2.0;
    }
  }

  return hf*sum;
}

float hiheight(vec2 p) {
  return hifbm(p);
}

float lofbm(vec2 p) {
  p *= 0.25;
  float hf = heightFactor(p);
  const float aa = 0.5;
  const float pp = 2.0-0.;

  float sum = 0.0;
  float a   = 1.0;

  for (int i = 0; i < 3; ++i) {
    sum += a*vnoise(p);
    a *= aa;
    p *= pp;
  }

  return hf*sum;
}

float loheight(vec2 p) {
  return lofbm(p)-0.5;
}

vec3 mountainRender(vec3 col, vec3 ro, vec3 rd, bool flip, inout float maxt) {
    const vec3 tpn = normalize(vec3(0.0, 0.0, 1.0));
    vec4 tpdim = vec4(tpn, (mountainPos + iMountainsDistance));
    float tpd = rayPlane(ro, rd, tpdim);

    if (tpd < 0.0 || tpd > maxt) {
        return col;
    }

    vec3 pp = ro+rd*tpd;
    vec2 p = pp.xy;
    const float cw = 1.0-0.25;
    float hz = 0.0*TIME+1.0;
    float lo = loheight(vec2(p.x, hz));
    vec2 cp = p;
    float cn = mod1(cp.x, cw);


    const float reps = 1.0;

    float d = 1E3;

    for (float i = -reps; i <= reps; ++i) {
        float x0 = (cn -0.5 + (i))*cw;
        float x1 = (cn -0.5 + (i + 1.0))*cw;

        float y0 = hiheight(vec2(x0, hz));
        float y1 = hiheight(vec2(x1, hz));

        float dd = segment(cp, vec2(-cw*0.5 + cw * float(i), y0), vec2(cw*0.5 + cw * float(i), y1));

        d = min(d, dd);
    }

    // vec3 rcol = hsv2rgb(vec3(clamp(.7+(0.5*(rd.x)), 0.6, 0.8), 0.95, 0.125));

    vec3 rcol = mix(iStartColor, iEndColor, clamp(rd.x, 0.0, 1.0));

    float sd = 1.0001-((dot(sunDir, rd)));

    vec3 mcol = col;
    float aa = fwidth(p.y);
    vec3 hsv = rgb2hsv(iSphereColor);

    if ((dFdy(d) < 0.0) == !flip) {
        mcol *= mix(0.0, 1.0, smoothstep(aa, -aa, d-aa));
        mcol += HSV2RGB(hsv)*smoothstep(0.0, 5.0, lo-p.y);
        col = mcol;
        maxt = tpd;
    }
    col += 1.*rcol/max(abs(d), 0.001);
    col += HSV2RGB(hsv)/(abs(p.y)+0.05);

    return col;
}

vec3 groundRender(vec3 col, vec3 ro, vec3 rd, inout float maxt) {
  const vec3 gpn = normalize(vec3(0.0, 1.0, 0.0));
  const vec4 gpdim = vec4(gpn, 0.0);
  float gpd = rayPlane(ro, rd, gpdim);

  if (gpd < 0.0) {
    return col;
  }

  maxt = gpd;

  vec3 gp     = ro + rd*gpd;
  float gpfre = 1.0 + dot(rd, gpn);
  gpfre *= gpfre;
  gpfre *= gpfre;
  gpfre *= gpfre;

  vec3 grr = reflect(rd, gpn);

  vec2 ggp    = gp.xz;
  ggp.y += TIME;
  float dfy   = dFdy(ggp.y);
  float gcf = sin(ggp.x)*sin(ggp.y);

  if (iResponsive > 8.0) {
    gcf += iLowFreq * 10.;
  }

  vec2 ggn    = mod2(ggp, vec2(1.0));
  float ggd   = min(abs(ggp.x), abs(ggp.y));

//   vec3 gcol = hsv2rgb(vec3(0.7+0.1*gcf, 0.90, 0.02));
  vec3 gcol = mix(iStartColor, iEndColor, clamp(gcf + iLowFreq * 3., 0.0, 1.0)) / 55.;

  float rmaxt = 1E6;
  vec3 rcol = outerSkyRender(gp, grr);
  rcol = mountainRender(rcol, gp, grr, true, rmaxt) / 1.25;
  rcol = triRender(rcol, gp, grr, rmaxt);

  // TODO enhance this with low freqs
  col = gcol/max(max(ggd, 0.01*dfy), 0.001)*exp((-0.15 - iLowFreq * 2.)*gpd);
  rcol += HSV2RGB(vec3(0.65, 0.85, 1.0))*gpfre; // todo
  rcol = (2.0 + iHighFreq) *tanh(rcol*0.25);
  col += rcol*gpfre;

  return col;
}

vec3 render(vec3 ro, vec3 rd) {
  float maxt = 1E6;

  vec3 col = outerSkyRender(ro, rd);
  col = groundRender(col, ro, rd, maxt);
  col = mountainRender(col, ro, rd, false, maxt);
  col = triRender(col, ro, rd, maxt);

  return col;
}

vec3 effect(vec2 p, vec2 pp) {
  const float fov = tan(TAU/6.0);
  const vec3 ro = 1.0*vec3(0.0, 1.0, -4.);
  const vec3 la = vec3(0.0, 1.0, 0.0);
  const vec3 up = vec3(0.0, 1.0, 0.0);

  vec3 ww = normalize(la - ro);
  vec3 uu = normalize(cross(up, ww));
  vec3 vv = cross(ww,uu);
  vec3 rd = normalize(-p.x*uu + p.y*vv + fov*ww);

  float aa = 2.0/RESOLUTION.y;

  vec3 col = render(ro, rd);
#if defined(THAT_CRT_FEELING)
  col *= smoothstep(1.5, 0.5, length(pp));
  col *= 1.25*mix(vec3(0.5), vec3(1.0),smoothstep(-0.9, 0.9, sin(0.25*TAU*p.y/aa+TAU*vec3(0.0, 1., 2.0)/3.0)));
#endif
  col -= 0.05*vec3(.00, 1.0, 2.0).zyx;
  return col;
}

void main() {

  vec2 nuv = (vUv - vec2(.281, .297)) / vec2(.43, .43);
  vec2 q = nuv;

  vec2 p = -1. + 2. * q;
  vec2 pp = p;
  p.x *= 1.9;
  vec3 col = effect(p, pp);

  // Apply tonemapping and gamma correction
  col = aces_approx(col);
  col = sRGB(col);

  // When post-processing is active, darken the output to compensate
  // for EffectComposer's brightness boost

  outColor = vec4(col, 1.0);
}


`;

const colorCache = new Map<string, number[]>();

let colorParser: CanvasRenderingContext2D | null = null;

function linearColor(color: string): number[] {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded =
			hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
		bytes = [0, 2, 4].map((index) =>
			parseInt(expanded.slice(index, index + 2), 16),
		);
	} else {
		if (!CSS.supports("color", color))
			throw new Error(`Invalid visualizer color: ${color}`);
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

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: "banger-elements-silence",
	isRemote: false,
};

const SynthwaveContent: React.FC<Required<SynthwaveOptions>> = (props) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const { offsetFrames, sourceTime, time } = synthwaveTiming(
		frame,
		fps,
		props.audioOffsetInSeconds,
		props.timeOffsetInSeconds,
	);
	const { audioData, dataOffsetInSeconds } = useVisualizerAudio(
		props.audioSrc,
		sourceTime,
		fps,
	);
	const bars = spectrumBars({
		audioData: audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
		fps,
	});
	return (
		<>
			{props.playAudio ? (
				<Audio
					src={props.audioSrc}
					trimBefore={offsetFrames}
					showInTimeline={false}
				/>
			) : null}
			<SynthwaveCanvas
				{...props}
				time={time}
				bands={synthwaveBands(bars, props.inputGainDb)}
			/>
		</>
	);
};

const SynthwaveInner = forwardRef<
	HTMLDivElement,
	SynthwaveProps & { readonly controls: SequenceControls | undefined }
>(
	(
		{
			width = synthwaveSchema.width.default,
			height = synthwaveSchema.height.default,
			audioSrc = synthwaveSchema.audioSrc.default,
			audioOffsetInSeconds = synthwaveSchema.audioOffsetInSeconds.default,
			playAudio = synthwaveSchema.playAudio.default,
			inputGainDb = synthwaveSchema.inputGainDb.default,
			startColor = synthwaveSchema.startColor.default,
			endColor = synthwaveSchema.endColor.default,
			sphereColor = synthwaveSchema.sphereColor.default,
			hideSphere = synthwaveSchema.hideSphere.default,
			mountainsPattern = synthwaveSchema.mountainsPattern.default,
			mountainsHeight = synthwaveSchema.mountainsHeight.default,
			mountainsSmoothness = synthwaveSchema.mountainsSmoothness.default,
			mountainsDistance = synthwaveSchema.mountainsDistance.default,
			responsive = synthwaveSchema.responsive.default,
			bpm = synthwaveSchema.bpm.default,
			timeOffsetInSeconds = synthwaveSchema.timeOffsetInSeconds.default,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		const drawingWidth = Math.round(bounded(width, 16, 3840, 1280));
		const drawingHeight = Math.round(bounded(height, 16, 3840, 720));
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? "Synthwave"}
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
					<SynthwaveContent
						key={audioSrc}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						startColor={startColor}
						endColor={endColor}
						sphereColor={sphereColor}
						hideSphere={hideSphere}
						mountainsPattern={mountainsPattern}
						mountainsHeight={mountainsHeight}
						mountainsSmoothness={mountainsSmoothness}
						mountainsDistance={mountainsDistance}
						responsive={responsive}
						bpm={bpm}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Synthwave = Interactive.withSchema({
	Component: SynthwaveInner,
	componentName: "<Synthwave>",
	componentIdentity: null,
	schema: synthwaveSchema,
	supportsEffects: false,
}) as React.FC<SynthwaveProps>;
