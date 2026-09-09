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

type SpaceOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly baseColor?: string;
	readonly zoom?: number;
	readonly stellarDensity?: number;
	readonly pattern?: number;
	readonly speed?: number;
	readonly responsive?: number;
	readonly timeOffsetInSeconds?: number;
};

type SpaceProps = InteractiveBaseProps & InteractiveTransformProps & SpaceOptions;

const spaceSchema = {
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
	baseColor: {type: 'color', default: '#ff00ff', description: 'Base color'},
	zoom: {
		type: 'number',
		default: 0.8,
		description: 'Zoom',
		min: 0.1,
		max: 3,
		step: 0.1,
		hiddenFromList: false,
	},
	stellarDensity: {
		type: 'number',
		default: 17,
		description: 'Stellar density',
		min: 5,
		max: 25,
		step: 1,
		hiddenFromList: false,
	},
	pattern: {
		type: 'number',
		default: 0.54,
		description: 'Pattern',
		min: 0.46,
		max: 0.58,
		step: 0.005,
		hiddenFromList: false,
	},
	speed: {
		type: 'number',
		default: 0.01,
		description: 'Speed',
		min: 0.001,
		max: 0.04,
		step: 0.001,
		hiddenFromList: false,
		keyframable: false,
	},
	responsive: {
		type: 'number',
		default: 1,
		description: 'Audio reactivity',
		min: 0.5,
		max: 3,
		step: 0.25,
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

function spaceTiming(frame: number, fps: number, audioOffset: number, timeOffset: number) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function spaceBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

// Match the source's 32 × 32 environment sphere rather than stretching its UVs
// across a quad. The default camera is at (0, 0, 5), with a 75-degree vertical FOV.
function spaceGeometry() {
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

type SpaceFrame = Pick<
	Required<SpaceOptions>,
	'width' | 'height' | 'baseColor' | 'zoom' | 'stellarDensity' | 'pattern' | 'speed' | 'responsive'
> & {readonly time: number; readonly bands: readonly number[]};

type SpaceState = {
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
		| 'iZoom'
		| 'iStellarDensity'
		| 'iPattern'
		| 'iSpeed'
		| 'iResponsive'
		| 'iAspect',
		WebGLUniformLocation | null
	>;
};

function setupSpace(canvas: HTMLCanvasElement): SpaceState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Space requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Space could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Space could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(`Space shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Space shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Space could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = spaceGeometry();
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
				iZoom: gl.getUniformLocation(program, 'iZoom'),
				iStellarDensity: gl.getUniformLocation(program, 'iStellarDensity'),
				iPattern: gl.getUniformLocation(program, 'iPattern'),
				iSpeed: gl.getUniformLocation(program, 'iSpeed'),
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

function drawSpace({gl, program, uniforms, vertexCount}: SpaceState, frame: SpaceFrame) {
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
	gl.uniform1f(uniforms.iZoom, bounded(frame.zoom, 0.1, 3, 0.8));
	gl.uniform1f(uniforms.iStellarDensity, Math.trunc(bounded(frame.stellarDensity, 5, 25, 17)));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 0.46, 0.58, 0.54));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.001, 0.04, 0.01));
	gl.uniform1f(uniforms.iResponsive, bounded(frame.responsive, 0.5, 3, 1));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Space WebGL draw failed: ${error}`);
}

function cleanupSpace({gl, program, buffer}: SpaceState) {
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function SpaceCanvas(frame: SpaceFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<SpaceState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupSpace(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Space WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupSpace(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Space');
		try {
			drawSpace(state.current, frame);
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


uniform vec3 iBaseColor;


uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;

uniform float iZoom;
uniform float iStellarDensity;
uniform float iPattern;
uniform float iSpeed;
uniform float iResponsive;

in vec2 vUv;
out vec4 outColor;

vec3 iResolution = vec3(1280.,720.,1.);

#define iterations 18
#define formuparam 0.54

#define volsteps 10
#define stepsize 0.1

#define zoom   0.800
#define tile   0.850
#define speed  0.005

#define brightness 0.0015
#define darkmatter 0.400
#define distfading 0.730
#define saturation 0.850

void main()
{
	vec2 nuv = (vUv - vec2(0.5, 0.5)) / vec2(0.25, 0.25);
	vec2 uv=nuv;
	uv.y*=iResolution.y/iResolution.x;
	float adjustedZoom = iZoom - (iLowFreq / 8. * iResponsive);
	vec3 dir=vec3(uv*adjustedZoom,1.);
	float time=iGlobalTime*iSpeed+.25;

	float a1=.5+0./iResolution.x*2.;
	float a2=.8+0./iResolution.y*2.;
	mat2 rot1=mat2(cos(a1),sin(a1),-sin(a1),cos(a1));
	mat2 rot2=mat2(cos(a2),sin(a2),-sin(a2),cos(a2));
	dir.xz*=rot1;
	dir.xy*=rot2;
	vec3 from=vec3(1.,.5,0.5);
	from+=vec3(time*2.,time,-2.);
	from.xz*=rot1;
	from.xy*=rot2;

	float s=0.1,fade=1.;
	vec3 v=vec3(0.);
	for (int r=0; r<volsteps; r++) {
		vec3 p=from+s*dir*.5;
		p = abs(vec3(tile)-mod(p,vec3(tile*2.))); // tiling fold
		float pa,a=pa=0.;
		int iterationsConverted = int(iStellarDensity);
		for (int i=0; i<iterationsConverted; i++) {
			p=abs(p)/max(dot(p,p), 0.000001)-iPattern; // the magic formula
			a+=abs(length(p)-pa); // absolute sum of average change
			pa=length(p);
		}
		float dm=max(0.,darkmatter-a*a*.001); //dark matter
		a*=a * a; // add contrast
		if (r>6) fade*=1.-dm; // dark matter, don't render near
		v+=fade;
		vec3 frags = vec3(s,s*s,s*s*s*s);
		vec3 dif = vec3(frags.x + (iBaseColor.x * 0.1), frags.y + (iBaseColor.y * 0.2), frags.z + (iBaseColor.z * 0.2));
		v+=fade;
		v+=dif*a*brightness*fade; // coloring based on distance
		float adjustedDistfading = distfading - 0.07 + (iLowFreq / 3. * iResponsive);
		fade*=adjustedDistfading; // distance fading
		s+=stepsize;
	}
	v=mix(vec3(length(v)),v,saturation); //color adjust

	vec3 col = v*.01;

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

const SpaceContent: React.FC<Required<SpaceOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {offsetFrames, sourceTime, time} = spaceTiming(
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
			<SpaceCanvas {...props} time={time} bands={spaceBands(bars, props.inputGainDb)} />
		</>
	);
};

const SpaceInner = forwardRef<
	HTMLDivElement,
	SpaceProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = spaceSchema.width.default,
			height = spaceSchema.height.default,
			audioSrc = spaceSchema.audioSrc.default,
			audioOffsetInSeconds = spaceSchema.audioOffsetInSeconds.default,
			playAudio = spaceSchema.playAudio.default,
			inputGainDb = spaceSchema.inputGainDb.default,
			baseColor = spaceSchema.baseColor.default,
			zoom = spaceSchema.zoom.default,
			stellarDensity = spaceSchema.stellarDensity.default,
			pattern = spaceSchema.pattern.default,
			speed = spaceSchema.speed.default,
			responsive = spaceSchema.responsive.default,
			timeOffsetInSeconds = spaceSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Space'}
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
					<SpaceContent
						key={audioSrc}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						baseColor={baseColor}
						zoom={zoom}
						stellarDensity={stellarDensity}
						pattern={pattern}
						speed={speed}
						responsive={responsive}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Space = Interactive.withSchema({
	Component: SpaceInner,
	componentName: '<Space>',
	componentIdentity: null,
	schema: spaceSchema,
	supportsEffects: false,
}) as React.FC<SpaceProps>;
