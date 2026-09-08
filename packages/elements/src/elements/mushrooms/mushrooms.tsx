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

type MushroomsOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly baseColor?: string;
	readonly mixColor?: string;
	readonly colorful?: number;
	readonly contrast?: number;
	readonly cubeScale?: number;
	readonly responsive?: number;
	readonly timeOffsetInSeconds?: number;
};

type MushroomsProps = InteractiveBaseProps &
	InteractiveTransformProps &
	MushroomsOptions;

const mushroomsSchema = {
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
	baseColor: { type: "color", default: "#ff00ff", description: "Base color" },
	mixColor: { type: "color", default: "#9333ea", description: "Mix color" },
	colorful: {
		type: "number",
		default: 0,
		description: "Colorful",
		min: -2,
		max: 12,
		step: 0.5,
		hiddenFromList: false,
	},
	contrast: {
		type: "number",
		default: 6,
		description: "Contrast",
		min: 1,
		max: 9,
		step: 0.5,
		hiddenFromList: false,
	},
	cubeScale: {
		type: "number",
		default: 1,
		description: "Cube scale",
		min: 0.5,
		max: 2,
		step: 0.25,
		hiddenFromList: false,
	},
	responsive: {
		type: "number",
		default: 0,
		description: "Audio reactivity",
		min: -10,
		max: 30,
		step: 0.5,
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

function mushroomsTiming(
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

function mushroomsBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

// Match the source's 32 × 32 environment sphere rather than stretching its UVs
// across a quad. The default camera is at (0, 0, 5), with a 75-degree vertical FOV.
function mushroomsGeometry() {
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

type MushroomsFrame = Pick<
	Required<MushroomsOptions>,
	| "width"
	| "height"
	| "baseColor"
	| "mixColor"
	| "colorful"
	| "contrast"
	| "cubeScale"
	| "responsive"
> & { readonly time: number; readonly bands: readonly number[] };

type MushroomsState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| "iGlobalTime"
		| "iLowFreq"
		| "iMidFreq"
		| "iHighFreq"
		| "iBaseColor"
		| "iMixColor"
		| "iColorful"
		| "iContrast"
		| "iCubeScale"
		| "iResponsive"
		| "iAspect",
		WebGLUniformLocation | null
	>;
};

function setupMushrooms(canvas: HTMLCanvasElement): MushroomsState {
	const gl = canvas.getContext("webgl2", {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			"Mushrooms requires WebGL2. Enable browser graphics acceleration and reload Studio.",
		);
	const program = gl.createProgram();
	if (!program) throw new Error("Mushrooms could not create a program.");
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error("Mushrooms could not create a shader.");
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(
					`Mushrooms shader compilation failed: ${gl.getShaderInfoLog(shader)}`,
				);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(
				`Mushrooms shader linking failed: ${gl.getProgramInfoLog(program)}`,
			);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error("Mushrooms could not create a vertex buffer.");
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = mushroomsGeometry();
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
				iBaseColor: gl.getUniformLocation(program, "iBaseColor"),
				iMixColor: gl.getUniformLocation(program, "iMixColor"),
				iColorful: gl.getUniformLocation(program, "iColorful"),
				iContrast: gl.getUniformLocation(program, "iContrast"),
				iCubeScale: gl.getUniformLocation(program, "iCubeScale"),
				iResponsive: gl.getUniformLocation(program, "iResponsive"),
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

function drawMushrooms(
	{ gl, program, uniforms, vertexCount }: MushroomsState,
	frame: MushroomsFrame,
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
	gl.uniform3fv(uniforms.iBaseColor, linearColor(frame.baseColor));
	gl.uniform3fv(uniforms.iMixColor, linearColor(frame.mixColor));
	gl.uniform1f(uniforms.iColorful, bounded(frame.colorful, -2, 12, 0));
	gl.uniform1f(uniforms.iContrast, bounded(frame.contrast, 1, 9, 6));
	gl.uniform1f(uniforms.iCubeScale, bounded(frame.cubeScale, 0.5, 2, 1));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, -10, 30, 0));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR)
		throw new Error(`Mushrooms WebGL draw failed: ${error}`);
}

function cleanupMushrooms({ gl, program, buffer }: MushroomsState) {
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function MushroomsCanvas(frame: MushroomsFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<MushroomsState | null>(null);
	const { delayRender, continueRender } = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupMushrooms(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error("Mushrooms WebGL context was lost."));
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => {
			canvas.removeEventListener("webglcontextlost", lost);
			cleanupMushrooms(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected)
					current.gl.getExtension("WEBGL_lose_context")?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender("Drawing Mushrooms");
		try {
			drawMushrooms(state.current, frame);
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

uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;

uniform vec3 iBaseColor;
uniform vec3 iMixColor;

uniform float iColorful;
uniform float iContrast;
uniform float iCubeScale;
uniform float iResponsive;

in vec2 vUv;
out vec4 outColor;

vec3 drat(float LL)
{
    vec3 R = iBaseColor;
    vec3 G = iMixColor;

    vec3 B = vec3(1.0,1.0,1.0);
    vec3 E = vec3(0.254, 0.421, 0.557);

    float coefficient = 0.0;
    if (iResponsive > 0.0) {
        coefficient = iHighFreq * iResponsive / 20.0;
    }


    return R + G * cos((6.28 + coefficient) * (B*LL+E));
}

#define XY(xx)(cos((xx)*6.3+vec3(0,23,21))*.5+.5)
float obj3d(vec2 uv, float trans)
{
    uv = max(abs(uv), vec2(0.000001));
    vec2 pos = min(uv.xy/uv.yx, trans);

    float pBase = 2.0 + iLowFreq * 2.;
    float JJ = (pBase - pos.r - pos.g);

    return (2.0+JJ*(JJ*JJ-1.5)) / (uv.r+uv.g);
}
vec2 spinning(vec2 A, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(A.r * c - A.g * s, A.r * s + A.g * c);
}
void main()
{
    vec2 nuv = (vUv - vec2(0.495, 0.5)) / vec2(0.35, 0.65);
    vec2 uv = nuv;
    vec2 viewing = nuv;
    vec2 uv0 = uv;
    vec3 compiled = vec3(0.2);
    vec4 O=vec4(0.0);
    vec2 C = vUv;
    vec2 m = vec2(0.5, 0.5);
    vec3 e = vec3(cos(iGlobalTime*0.2) * cos(iGlobalTime*0.2), sin(iGlobalTime*0.2) * cos(iGlobalTime*0.2), sin(iGlobalTime*0.2));
    vec3 u = normalize(vec3(e.y, -e.x, 0));
    vec3 v = cross(e, u);

    vec2 luv;
    luv = uv;
    if (iCubeScale > 0.0) {
        luv /= max(0.0001, iCubeScale + iLowFreq * iResponsive / 20.0);
    } else {
        luv /= iCubeScale;
    }

    vec3 d2 = e + luv.x * u + luv.y * v;
    vec3 a = (e + .1) / d2;
    vec3 b = (e - .1) / d2;
    float lol = max(max(min(a.x, b.x), min(a.y, b.y)), min(a.z, b.z));
    float magic = min(min(max(a.r, b.r), max(a.g, b.g)), max(a.b, b.b));
    float CH = lol < magic ? lol : 10.;
    vec3 XxX = e - d2 * CH;
    vec3 Rg = (step(-.099, XxX) + step(.099, XxX) - 1.) * d2;
    O=vec4(0);
    uv.xy*=spinning(uv.xy,-iGlobalTime/15.-length(uv.xy)*10.5);

    float steps = 5.;

    for (float i = 0.0; i < steps; i++) {
        uv = fract(uv * 2.2) - 0.5;

        float d = length(uv) * exp(-length(uv0));

        vec3 col = drat(length(uv0) + i*.4 + iGlobalTime*.4);

        d = sin(d*8. + (0.1 * iGlobalTime))/6.;
        d = abs(d);
        d = pow(0.02 / (d + 0.001), 1.1);
        compiled += col * d;

    }

    vec3 FF,q,r = vec3(1280., 720., 1),
    d=normalize(vec3((C*2.-r.xy)/r.y,1));

    for(float i=0.,a,s,e,g=0.;++i<40.;O.rgb+=mix(vec3(1),XY(g*.1),sin(.8))*1./max(e, 0.000001)/8e3)
    {
        FF=g*d2+d;
        FF.b+=iGlobalTime*2.5;
        a=15. - iColorful;
        FF=mod(FF-a,a*2.)-a*Rg;
        s=iContrast;
        for (int i=0;i++<8;) {
            FF=.3-abs(FF);

            FF.x<FF.z?FF=FF.bgr:FF;
            FF.z<FF.y?FF=FF.rbg:FF;

            s*=e=1.4+sin(iGlobalTime*.234)*.1;
            FF=abs(FF)*e-
                vec3(
                    5.+cos(iGlobalTime*.3+.5*cos(iGlobalTime*.3))*3.,
                    50,
                    4.+cos(iGlobalTime*.5)*5.
                 )* compiled;
         }

        g+=e=length(FF.yz)/s;
        g+=e=length(FF.xz)/s;
    }
    viewing *= 2.0 * ( cos(iGlobalTime * 2.0) -2.5);

    float trans = sin(iGlobalTime * 12.0) * 0.1 + 1.0;

    vec3 col = compiled*O.rgb;
    col += smoothstep(0.0, 1.0, obj3d(viewing,trans)) * vec3(0.50,0.50,0.50)*0.08;

    // When post-processing is active, convert to linear space to compensate
    // for EffectComposer's automatic color management

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

const MushroomsContent: React.FC<Required<MushroomsOptions>> = (props) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const { offsetFrames, sourceTime, time } = mushroomsTiming(
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
			<MushroomsCanvas
				{...props}
				time={time}
				bands={mushroomsBands(bars, props.inputGainDb)}
			/>
		</>
	);
};

const MushroomsInner = forwardRef<
	HTMLDivElement,
	MushroomsProps & { readonly controls: SequenceControls | undefined }
>(
	(
		{
			width = mushroomsSchema.width.default,
			height = mushroomsSchema.height.default,
			audioSrc = mushroomsSchema.audioSrc.default,
			audioOffsetInSeconds = mushroomsSchema.audioOffsetInSeconds.default,
			playAudio = mushroomsSchema.playAudio.default,
			inputGainDb = mushroomsSchema.inputGainDb.default,
			baseColor = mushroomsSchema.baseColor.default,
			mixColor = mushroomsSchema.mixColor.default,
			colorful = mushroomsSchema.colorful.default,
			contrast = mushroomsSchema.contrast.default,
			cubeScale = mushroomsSchema.cubeScale.default,
			responsive = mushroomsSchema.responsive.default,
			timeOffsetInSeconds = mushroomsSchema.timeOffsetInSeconds.default,
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
				name={name ?? "Mushrooms"}
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
					<MushroomsContent
						key={audioSrc}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						baseColor={baseColor}
						mixColor={mixColor}
						colorful={colorful}
						contrast={contrast}
						cubeScale={cubeScale}
						responsive={responsive}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Mushrooms = Interactive.withSchema({
	Component: MushroomsInner,
	componentName: "<Mushrooms>",
	componentIdentity: null,
	schema: mushroomsSchema,
	supportsEffects: false,
}) as React.FC<MushroomsProps>;
