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
} from 'remotion';

type HyperloopOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly baseColor?: string;
	readonly volume?: number;
	readonly depth?: number;
	readonly speed?: number;
	readonly rotationSpeed?: number;
	readonly pattern?: number;
	readonly responsive?: number;
	readonly timeOffsetInSeconds?: number;
};

type HyperloopProps = InteractiveBaseProps & InteractiveTransformProps & HyperloopOptions;

const hyperloopSchema = {
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
	inputGainDb: {
		type: 'number',
		default: 0,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	baseColor: {type: 'color', default: '#9333ea', description: 'Base Color'},
	volume: {
		type: 'number',
		default: 0.15,
		description: 'Volume',
		min: 0.05,
		max: 10.5,
		step: 0.1,
		hiddenFromList: false,
	},
	depth: {
		type: 'number',
		default: 4.0,
		description: 'Depth',
		min: 1.0,
		max: 50.0,
		step: 0.5,
		hiddenFromList: false,
	},
	speed: {
		type: 'number',
		default: 2.0,
		description: 'Speed',
		min: 0.5,
		max: 4.0,
		step: 0.25,
		hiddenFromList: false,
		keyframable: false,
	},
	rotationSpeed: {
		type: 'number',
		default: 2.3,
		description: 'Rotation speed',
		min: 1.0,
		max: 20.0,
		step: 0.25,
		hiddenFromList: false,
		keyframable: false,
	},
	pattern: {
		type: 'number',
		default: 1.0,
		description: 'Pattern',
		min: 1.0,
		max: 3.0,
		step: 0.01,
		hiddenFromList: false,
	},
	responsive: {
		type: 'number',
		default: 2.0,
		description: 'Audio reactivity',
		min: 0.0,
		max: 50.0,
		step: 0.5,
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
		frame: input.sourceTime * 60,
		fps: 60,
		numberOfSamples: 4096,
		optimizeFor: 'speed',
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		outputBarsCount: count,
	});
}

function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function hyperloopTiming(frame: number, fps: number, audioOffset: number, timeOffset: number) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function hyperloopBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

function hyperloopGeometry() {
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

type HyperloopFrame = Pick<
	Required<HyperloopOptions>,
	| 'width'
	| 'height'
	| 'baseColor'
	| 'volume'
	| 'depth'
	| 'speed'
	| 'rotationSpeed'
	| 'pattern'
	| 'responsive'
> & {readonly time: number; readonly bands: readonly number[]};

type HyperloopState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| 'iGlobalTime'
		| 'iLowFreq'
		| 'iMidFreq'
		| 'iHighFreq'
		| 'iBaseColor'
		| 'iVolume'
		| 'iDepth'
		| 'iSpeed'
		| 'iRotationSpeed'
		| 'iPattern'
		| 'iResponsive'
		| 'iAspect',
		WebGLUniformLocation | null
	>;
};

function setupHyperloop(canvas: HTMLCanvasElement): HyperloopState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Hyperloop requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Hyperloop could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Hyperloop could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(`Hyperloop shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Hyperloop shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Hyperloop could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = hyperloopGeometry();
		gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
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
			vertexCount: geometry.length / 5,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, 'iGlobalTime'),
				iLowFreq: gl.getUniformLocation(program, 'iLowFreq'),
				iMidFreq: gl.getUniformLocation(program, 'iMidFreq'),
				iHighFreq: gl.getUniformLocation(program, 'iHighFreq'),
				iBaseColor: gl.getUniformLocation(program, 'iBaseColor'),
				iVolume: gl.getUniformLocation(program, 'iVolume'),
				iDepth: gl.getUniformLocation(program, 'iDepth'),
				iSpeed: gl.getUniformLocation(program, 'iSpeed'),
				iRotationSpeed: gl.getUniformLocation(program, 'iRotationSpeed'),
				iPattern: gl.getUniformLocation(program, 'iPattern'),
				iResponsive: gl.getUniformLocation(program, 'iResponsive'),
				iAspect: gl.getUniformLocation(program, 'iAspect'),
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

function drawHyperloop(
	{gl, program, uniforms, vertexCount}: HyperloopState,
	frame: HyperloopFrame,
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
	gl.uniform3fv(uniforms.iBaseColor, linearColor(frame.baseColor));
	gl.uniform1f(uniforms.iVolume, bounded(frame.volume, 0.05, 10.5, 0.15));
	gl.uniform1f(uniforms.iDepth, bounded(frame.depth, 1.0, 50.0, 4.0));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.5, 4.0, 2.0));
	gl.uniform1f(uniforms.iRotationSpeed, bounded(frame.rotationSpeed, 1.0, 20.0, 2.3));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 1.0, 3.0, 1.0));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0.0, 50.0, 2.0));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Hyperloop WebGL draw failed: ${error}`);
}

function cleanupHyperloop({gl, program, buffer}: HyperloopState) {
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function HyperloopCanvas(frame: HyperloopFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<HyperloopState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupHyperloop(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Hyperloop WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupHyperloop(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Hyperloop');
		try {
			drawHyperloop(state.current, frame);
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

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

uniform float iGlobalTime;
uniform sampler2D iChannel0;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iVolume;
uniform float iDepth;
uniform float iSpeed;
uniform float iRotationSpeed;
uniform float iPattern;
uniform float iResponsive;
uniform vec3 iBaseColor;
in vec2 vUv;
out vec4 outColor;
#define TAU 6.28318
const float energy  = 1.0/1.;
const float forward_energy  = 2.0 * energy;
const float rotation_energy = 2.3 * energy;
const float sec = 4.0;
vec3 iResolution = vec3(1280.,720.,1.);
#define Forer vec3(.1031,.11369,.13787)
vec3 elementor(vec3 NN)
{
	NN = fract(NN * Forer);
    NN += dot(NN, NN.yxz+19.19);
    return -1.0 + 2.0 * fract(vec3((NN.r + NN.g)*NN.b, (NN.r+NN.b)*NN.g, (NN.g+NN.b)*NN.r));
}
float processing(vec3 AA)
{
    const float first = 0.333333333;
    const float second = 0.166666667;
    vec3 i = floor(AA + (AA.r + AA.g + AA.b) * first);
    vec3 d0 = AA - (i - (i.x + i.y + i.z) * second);
    vec3 e = step(vec3(0.0), d0 - d0.gbr);
	vec3 i1 = e * (1.0 - e.brg);
	vec3 i2 = 1.0 - e.brg * (1.0 - e);
    vec3 d1 = d0 - (i1 - 1.0 * second);
    vec3 d2 = d0 - (i2 - 2.0 * second);
    vec3 d3 = d0 - (1.0 - 3.0 * second);
    vec4 je = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
    vec4 fi = je * je * je * je * vec4(dot(d0, elementor(i)), dot(d1, elementor(i + i1)), dot(d2, elementor(i + i2)), dot(d3, elementor(i + 1.0)));
    return dot(vec4(31.316), fi);
}
float mutagen(in vec3 DD)
{
	float L = 0.0;
	float multiplier = 18.0;
    DD = mod(DD, multiplier);
	float gimp = 0.8;
	for (int i = 0; i < 5; i++)
	{
		L += processing(DD * multiplier) * gimp;
		gimp *= 0.45;
		multiplier *= 4.0;
	}
	return min(L, 1.0);
}
void main()
{
    float t = mod(iGlobalTime, sec);
    t = t / sec;
    vec4 col = vec4(0.0);
	vec2 q = vUv;
    vec2 nuv = (vUv - vec2(0.495, 0.473)) / vec2(0.12, 0.24);
	vec2 p = nuv;
    vec2 fooo = (2.0 * vec2(.0, .0) - iResolution.xy) / min(iResolution.x, iResolution.y);
    p += vec2(0.0, -0.1);
    float cop = 0.0, ax = 0.0, az = 0.0;
    if (.0 > 0.0) {
        cop = 3.0 * fooo.r;
        ax = 3.0 * fooo.g;
    }
    mat3 nB = mat3(
         cos(cop), 0.0,  sin(cop),
         0.0,     1.0,      0.0,
        -sin(cop), 0.0,  cos(cop)
    );
    mat3 nR = mat3(
        1.0,      0.0,     0.0,
        0.0,  cos(ax), sin(ax),
        0.0, -sin(ax), cos(ax)
    );
    mat3 m = nR * nB;
    vec3 v = vec3(p, 1.0);
    v = m * v;
    float v_xy = max(length(v.xy), 0.000001);
    float z = v.z / v_xy;
	float volume_field = iVolume;
    vec2 star;
    float p_len = length(v.xy);
    star.y = z * volume_field + iGlobalTime * iSpeed * energy;
    float a = atan(v.y, v.x);
    a -= iGlobalTime * iRotationSpeed * energy;
    float x = fract(a / TAU);
    star.x = x + star.y / TAU * 1.25;
    star *= vec2(iPattern, 0.2);
    vec3 xyt = vec3(star, 0.15 * iGlobalTime * energy);
    float val = mix(mutagen(xyt + vec3(1.,0.,0.)), mutagen(xyt), smoothstep(0.0, 1.0, x));
    val = clamp(0.45 + 0.55 * val, 0.0, 1.0);
    col.rgb = 1.25*iBaseColor * vec3(val);
    vec3 white = iLowFreq * iResponsive * vec3(smoothstep(0.55, 1.0, val));
    col.rgb += white;
    col.rgb = clamp(col.rgb, 0.0, 1.0);
    float vi = 0.0, vo = 0.0;
    float circle_radius = max(0.025 - iDepth / 10., 1.5 * vo);
    float circle_amount = exp(-(p_len - circle_radius) * iDepth);
    col.rgb += clamp(vec3(circle_amount), 0.0, 1.0);
    outColor = vec4(col.rgb,1);
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

const HyperloopContent: React.FC<Required<HyperloopOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {offsetFrames, sourceTime, time} = hyperloopTiming(
		frame,
		fps,
		props.audioOffsetInSeconds,
		props.timeOffsetInSeconds,
	);
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const bars = spectrumBars({
		audioData: audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
		fps,
	});
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<HyperloopCanvas {...props} time={time} bands={hyperloopBands(bars, props.inputGainDb)} />
		</>
	);
};

const HyperloopInner = forwardRef<
	HTMLDivElement,
	HyperloopProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = hyperloopSchema.width.default,
			height = hyperloopSchema.height.default,
			audioSrc = hyperloopSchema.audioSrc.default,
			audioOffsetInSeconds = hyperloopSchema.audioOffsetInSeconds.default,
			playAudio = hyperloopSchema.playAudio.default,
			inputGainDb = hyperloopSchema.inputGainDb.default,
			baseColor = hyperloopSchema.baseColor.default,
			volume = hyperloopSchema.volume.default,
			depth = hyperloopSchema.depth.default,
			speed = hyperloopSchema.speed.default,
			rotationSpeed = hyperloopSchema.rotationSpeed.default,
			pattern = hyperloopSchema.pattern.default,
			responsive = hyperloopSchema.responsive.default,
			timeOffsetInSeconds = hyperloopSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Hyperloop'}
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
					<HyperloopContent
						key={audioSrc}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						baseColor={baseColor}
						volume={volume}
						depth={depth}
						speed={speed}
						rotationSpeed={rotationSpeed}
						pattern={pattern}
						responsive={responsive}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Hyperloop = Interactive.withSchema({
	Component: HyperloopInner,
	componentName: '<Hyperloop>',
	componentIdentity: null,
	schema: hyperloopSchema,
	supportsEffects: false,
}) as React.FC<HyperloopProps>;
