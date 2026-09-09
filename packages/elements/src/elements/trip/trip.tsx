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

type TripOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly baseColor?: string;
	readonly intensifyColor?: string;
	readonly thickness?: number;
	readonly pattern?: number;
	readonly intensity?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};

type TripProps = InteractiveBaseProps & InteractiveTransformProps & TripOptions;

const tripSchema = {
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
	baseColor: {type: 'color', default: '#ff00ff', description: 'Base color'},
	intensifyColor: {
		type: 'color',
		default: '#9333ea',
		description: 'Intensify color',
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
	thickness: {
		type: 'number',
		default: 1,
		min: 0.01,
		max: 1.5,
		step: 0.05,
		description: 'Thickness',
		hiddenFromList: false,
	},
	pattern: {
		type: 'number',
		default: 0.7,
		min: 0.7,
		max: 9,
		step: 0.25,
		description: 'Pattern',
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 10,
		min: 0,
		max: 25,
		step: 0.5,
		description: 'Raymarch intensity (whole iterations; not audio gain)',
		hiddenFromList: false,
	},
	bpm: {
		type: 'number',
		default: 120,
		min: 1,
		max: 300,
		step: 1,
		description: 'Animation tempo in BPM',
		hiddenFromList: false,
		keyframable: false,
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

// All numeric entry points are bounded, including direct JSX and non-finite values.
function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function tripTiming(frame: number, fps: number, audioOffset: number, timeOffset: number) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function tripBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

// Match the source's 32 × 32 environment sphere rather than stretching its UVs
// across a quad. The default camera is at (0, 0, 5), with a 75-degree vertical FOV.
function tripGeometry() {
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

type TripFrame = Pick<
	Required<TripOptions>,
	| 'width'
	| 'height'
	| 'baseColor'
	| 'intensifyColor'
	| 'thickness'
	| 'pattern'
	| 'intensity'
	| 'bpm'
> & {readonly time: number; readonly bands: readonly number[]};

type TripState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| 'iGlobalTime'
		| 'iBpm'
		| 'iLowFreq'
		| 'iMidFreq'
		| 'iHighFreq'
		| 'iBaseColor'
		| 'iIntensifyColor'
		| 'iThickness'
		| 'iPattern'
		| 'iIntensity'
		| 'iAspect',
		WebGLUniformLocation | null
	>;
};

function setupTrip(canvas: HTMLCanvasElement): TripState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Trip requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Trip could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Trip could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(`Trip shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Trip shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Trip could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = tripGeometry();
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
				iBpm: gl.getUniformLocation(program, 'iBpm'),
				iLowFreq: gl.getUniformLocation(program, 'iLowFreq'),
				iMidFreq: gl.getUniformLocation(program, 'iMidFreq'),
				iHighFreq: gl.getUniformLocation(program, 'iHighFreq'),
				iBaseColor: gl.getUniformLocation(program, 'iBaseColor'),
				iIntensifyColor: gl.getUniformLocation(program, 'iIntensifyColor'),
				iThickness: gl.getUniformLocation(program, 'iThickness'),
				iPattern: gl.getUniformLocation(program, 'iPattern'),
				iIntensity: gl.getUniformLocation(program, 'iIntensity'),
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

function drawTrip({gl, program, uniforms, vertexCount}: TripState, frame: TripFrame) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	gl.uniform1f(uniforms.iBpm, bounded(frame.bpm, 1, 300, 120));
	gl.uniform1f(uniforms.iLowFreq, frame.bands[0] ?? 0);
	gl.uniform1f(uniforms.iMidFreq, frame.bands[1] ?? 0);
	gl.uniform1f(uniforms.iHighFreq, frame.bands[2] ?? 0);
	gl.uniform1f(uniforms.iThickness, bounded(frame.thickness, 0.01, 1.5, 1));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 0.7, 9, 0.7));
	gl.uniform1f(uniforms.iIntensity, Math.trunc(bounded(frame.intensity, 0, 25, 10)));
	// Three's original Color uniforms are linear even though Trip's final output is display RGB.
	gl.uniform3fv(uniforms.iBaseColor, linearColor(frame.baseColor));
	gl.uniform3fv(uniforms.iIntensifyColor, linearColor(frame.intensifyColor));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Trip WebGL draw failed: ${error}`);
}

function cleanupTrip({gl, program, buffer}: TripState) {
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function TripCanvas(frame: TripFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<TripState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupTrip(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Trip WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupTrip(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Trip');
		try {
			drawTrip(state.current, frame);
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
uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;

uniform float iThickness;
uniform float iPattern;
uniform float iIntensity;

uniform vec3 iIntensifyColor;
uniform vec3 iBaseColor;

in vec2 vUv;
out vec4 outColor;

vec3 iResolution = vec3(640.,360.,1.);

float SOOP = 0.005607476635514;
float PI = 3.1415926535;

vec2 lower(vec2 a, float b){
	float np = iThickness * PI / b;

  float rBase = -0.5 - iLowFreq / 20.;
	float radius = atan(a.r,a.g)-rBase * np;

	radius = mod(radius,np)-0.5*np;

	return length(a) * vec2(cos(radius),sin(radius));
}

vec2 dool(vec2 a, float b){
	mat2 final = mat2(cos(b), sin(b), -sin(b), cos(b));

	return final * a;
}

float sauerkraut(vec3 a, vec3 b){
	vec3 U = abs(a);

	vec3 L = max(b - U, iLowFreq / 20.);
	return length(max(U - b, 0.0)) - min(min(L.r, L.g), L.b);
}

float chop(vec3 a){
	float chopBase = 1.0;
	a.b -= chopBase*SOOP*iBpm*iGlobalTime;
	a.rg = dool(a.rg,1.0*a.b);
	a.rg = lower(a.rg,6.1);

	float jeb = floor(a.b*iPattern);
	a = mod(a,iPattern)-0.5*iPattern;

	for(int i = 0; i < 4; i++){
		a = abs(a) - 0.305;

		a.rg = dool(a.rg,1.0+jeb+0.1*SOOP*iBpm*iGlobalTime);
		a.rb = dool(a.rb,1.0+4.7*jeb+0.3*SOOP*iBpm*iGlobalTime);
	}

	return min(sauerkraut(a,vec3(0.3)),length(a)-0.4);
}


void main()
{
	vec2 nuv = (vUv - vec2(0.3, 0.3)) / vec2(0.391, 0.4);
	vec2 uv = nuv;
	uv = 2.0*(uv-0.5);

	uv.y *= iResolution.y/iResolution.x;
	uv = dool(uv,SOOP*iBpm*iGlobalTime);

	vec3 jo = vec3(0.0,0.0,0.1);
	vec3 yo = normalize(vec3(uv,0.0)-jo);
	float incre = 2.0;
	float zz = 0.0;
	float pro = 0.0;

	int raysCount = int(iIntensity);

	for(int i = 0; i < raysCount; i++){
		float adjustedLowFreq = iLowFreq * 5.;
		zz = chop(jo + yo * incre) * (0.2 + adjustedLowFreq);
		zz = max(0.0000, abs(zz));
		incre += zz;
		if (zz < 0.001) pro += 0.1 + iLowFreq * 10.;
	}
	vec3 color = vec3(0.0);

	float red = iIntensifyColor.x > 0.05 ? iIntensifyColor.x + iLowFreq * 5. : iIntensifyColor.x - iLowFreq * 5.;
	float green = iIntensifyColor.y - iHighFreq * 4.;
	float blue = iIntensifyColor.z + iMidFreq * 3.;

	color = vec3(red, green ,blue)*0.2*vec3(pro);

	vec3 ii = jo+yo*incre;
	ii.b += -1.5*iGlobalTime*SOOP*iBpm;
	ii.b = mod(ii.b,.5)-0.5*.5;

	float em = ii.b == 0.0 ? 100.0 : clamp(0.01/ii.b,0.0,100.0);

	float redEnd = iBaseColor.x - iMidFreq * 2.;
	float greenEnd = iBaseColor.y > 0.05  ? iBaseColor.y + iLowFreq * 2. : iBaseColor.y - iLowFreq * 2.;
	float blueEnd = iBaseColor.z - iHighFreq * 2.;

	float co = 3.0;

	color += co*em*vec3(redEnd,greenEnd,blueEnd);

	color = clamp(color,0.0,1.0);

 // Direct canvas output: display RGB, no second sRGB encode.
 outColor = vec4(color, 1.0);
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

const TripContent: React.FC<Required<TripOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {offsetFrames, sourceTime, time} = tripTiming(
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
			<TripCanvas {...props} time={time} bands={tripBands(bars, props.inputGainDb)} />
		</>
	);
};

const TripInner = forwardRef<
	HTMLDivElement,
	TripProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = tripSchema.width.default,
			height = tripSchema.height.default,
			audioSrc = tripSchema.audioSrc.default,
			audioOffsetInSeconds = tripSchema.audioOffsetInSeconds.default,
			playAudio = tripSchema.playAudio.default,
			inputGainDb = tripSchema.inputGainDb.default,
			baseColor = tripSchema.baseColor.default,
			intensifyColor = tripSchema.intensifyColor.default,
			thickness = tripSchema.thickness.default,
			pattern = tripSchema.pattern.default,
			intensity = tripSchema.intensity.default,
			bpm = tripSchema.bpm.default,
			timeOffsetInSeconds = tripSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Trip'}
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
					<TripContent
						key={audioSrc}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						baseColor={baseColor}
						intensifyColor={intensifyColor}
						thickness={thickness}
						pattern={pattern}
						intensity={intensity}
						bpm={bpm}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Trip = Interactive.withSchema({
	Component: TripInner,
	componentName: '<Trip>',
	componentIdentity: null,
	schema: tripSchema,
	supportsEffects: false,
}) as React.FC<TripProps>;
