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

type KaleidoscopeOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly startColor?: string;
	readonly scale?: number;
	readonly responsive?: number;
	readonly randomColors?: boolean;
	readonly disableMovement?: boolean;
	readonly still?: boolean;
	readonly speed?: number;
	readonly pattern?: number;
	readonly amount?: number;
	readonly timeOffsetInSeconds?: number;
};
type KaleidoscopeProps = InteractiveBaseProps & InteractiveTransformProps & KaleidoscopeOptions;

const kaleidoscopeSchema = {
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
	startColor: {type: 'color', default: '#877d87', description: 'Theme color'},
	scale: {
		type: 'number',
		default: 5,
		min: 1,
		max: 10,
		step: 0.5,
		description: 'Scale',
		hiddenFromList: false,
	},
	responsive: {
		type: 'number',
		default: 0.3,
		min: 0,
		max: 4,
		step: 0.1,
		description: 'Audio reactivity',
		hiddenFromList: false,
	},
	randomColors: {type: 'boolean', default: false, description: 'Random colors'},
	disableMovement: {type: 'boolean', default: false, description: 'Disable movement'},
	still: {type: 'boolean', default: false, description: 'Still pattern'},
	speed: {
		type: 'number',
		default: 0.1,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Movement speed',
		hiddenFromList: false,
	},
	pattern: {
		type: 'number',
		default: 3,
		min: 0.5,
		max: 10,
		step: 0.5,
		description: 'Pattern',
		hiddenFromList: false,
	},
	amount: {
		type: 'number',
		default: 1.5,
		min: 0.5,
		max: 15,
		step: 0.5,
		description: 'Amount',
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
		const handle = delayRender('Waiting for complete Kaleidoscope audio history');
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
uniform float iSpeed;
uniform float iIntensity;
uniform float iPattern;
uniform float iAmount;

uniform bool iRandomColor;
uniform bool iStatic;
uniform bool iStill;

uniform vec3 iStartColor;

in vec2 vUv;
out vec4 outColor;

vec2 iResolution = vec2(1920.0, 1080.0);

#define PI 3.14159265359
#define rot(a) mat2(cos(a + PI*0.25*vec4(0,6,2,0)))

void main()
{
	vec2 uv = (((vUv - vec2(0.5, 0.5)) / vec2(0.3, 0.5)) / 0.0001) / iScale;

	uv /= iResolution.y;
	
	if (!iStatic) {
		uv *= cos(iGlobalTime* iSpeed) + 1.5;
	}
	
	outColor.rgb = vec3(0);
	
	float scale = PI/iPattern;
	float m = .5;
	
	for (int i = 0 ; i < 10 ; i++) {
			float scaleFactor = float(i)+(sin(iGlobalTime*0.05) + iAmount);
			uv *= rot(iGlobalTime * scaleFactor * 0.01);
			float theta = atan(uv.x, uv.y)+PI;
			theta = (floor(theta/scale)+0.5)*scale;
			vec2 dir = vec2(sin(theta), cos(theta));
			vec2 codir = dir.yx * vec2(-1, 1);
			uv = vec2(dot(dir, uv), dot(codir, uv));

			if (!iStill) {
				uv.xy += vec2(sin(iGlobalTime),cos(iGlobalTime*1.1)) * scaleFactor * (0.035); // pattern 2 also if commented out then more static movement could be as option
			}
			
			uv = abs(fract(uv+0.5)*2.0-1.0)*0.7;
			vec3 p = vec3(1,5,9);
			// outColor.rgb += exp(-min(uv.x + (iLowFreq * iIntensity * 0.25) , uv.y - (iLowFreq * iIntensity * 0.05)) * 16.) * (cos(p*float(i)+iGlobalTime*(iLowFreq * iIntensity))*.5+.5)*m ;
			outColor.rgb += exp(-min(uv.x, uv.y) * 16.) * (cos(p*float(i)+iGlobalTime*(iLowFreq * iIntensity))*.5+.5)*m ;

			if (!iRandomColor) {
				outColor.rgb += (iStartColor / 50.);
			}
			
			m *= 0.9 + (iLowFreq * (iIntensity * 0.05));
			
	}
    
  outColor.rgb *= 1.2;
	outColor.a = 1.0;

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
		if (!CSS.supports('color', color)) throw new Error(`Invalid Kaleidoscope color: ${color}`);
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

type KaleidoscopeFrame = Pick<
	Required<KaleidoscopeOptions>,
	| 'startColor'
	| 'scale'
	| 'responsive'
	| 'randomColors'
	| 'disableMovement'
	| 'still'
	| 'speed'
	| 'pattern'
	| 'amount'
> & {
	readonly width: number;
	readonly height: number;
	readonly time: number;
	readonly bars: readonly number[];
	readonly textureSrc?: string;
};
type KaleidoscopeState = {
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
		| 'iScale'
		| 'iIntensity'
		| 'iRandomColor'
		| 'iStatic'
		| 'iStill'
		| 'iSpeed'
		| 'iPattern'
		| 'iAmount',
		WebGLUniformLocation | null
	>;
};
function setupKaleidoscope(canvas: HTMLCanvasElement): KaleidoscopeState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Kaleidoscope requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Kaleidoscope could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Kaleidoscope could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Kaleidoscope shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Kaleidoscope shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Kaleidoscope could not create a vertex buffer.');
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
				iScale: gl.getUniformLocation(program, 'iScale'),
				iIntensity: gl.getUniformLocation(program, 'iIntensity'),
				iRandomColor: gl.getUniformLocation(program, 'iRandomColor'),
				iStatic: gl.getUniformLocation(program, 'iStatic'),
				iStill: gl.getUniformLocation(program, 'iStill'),
				iSpeed: gl.getUniformLocation(program, 'iSpeed'),
				iPattern: gl.getUniformLocation(program, 'iPattern'),
				iAmount: gl.getUniformLocation(program, 'iAmount'),
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
function drawKaleidoscope(state: KaleidoscopeState, frame: KaleidoscopeFrame) {
	const {gl, program, uniforms} = state;
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	const gain =
		10 **
		(bounded((frame as KaleidoscopeFrame & {inputGainDb?: number}).inputGainDb ?? 0, -30, 30, 0) /
			20);
	gl.uniform1f(uniforms.iLowFreq, (frame.bars[11] ?? 0) * gain);
	gl.uniform1f(uniforms.iMidFreq, (frame.bars[45] ?? 0) * gain);
	gl.uniform1f(uniforms.iHighFreq, (frame.bars[85] ?? 0) * gain);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.startColor));
	gl.uniform1f(uniforms.iScale, bounded(frame.scale, 1, 10, 5));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.responsive, 0, 4, 0.3));
	gl.uniform1i(uniforms.iRandomColor, Number(frame.randomColors));
	gl.uniform1i(uniforms.iStatic, Number(frame.disableMovement));
	gl.uniform1i(uniforms.iStill, Number(frame.still));
	gl.uniform1f(uniforms.iSpeed, bounded(frame.speed, 0.1, 10, 0.1));
	gl.uniform1f(uniforms.iPattern, bounded(frame.pattern, 0.5, 10, 3));
	gl.uniform1f(uniforms.iAmount, bounded(frame.amount, 0.5, 15, 1.5));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, state.vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Kaleidoscope WebGL draw failed: ${error}`);
}
function cleanupKaleidoscope(state: KaleidoscopeState) {
	const {gl, program, buffer} = state;
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}
function KaleidoscopeCanvas(frame: KaleidoscopeFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<KaleidoscopeState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupKaleidoscope(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Kaleidoscope WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			if (!current) return;
			cleanupKaleidoscope(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Kaleidoscope');
		try {
			drawKaleidoscope(state.current, frame);
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
const KaleidoscopeContent: React.FC<
	Required<KaleidoscopeOptions> & {width: number; height: number}
> = (props) => {
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
			<KaleidoscopeCanvas {...props} time={time} bars={bars} />
		</>
	);
};
const KaleidoscopeInner = forwardRef<
	HTMLDivElement,
	KaleidoscopeProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			audioSrc = kaleidoscopeSchema.audioSrc.default,
			audioOffsetInSeconds = kaleidoscopeSchema.audioOffsetInSeconds.default,
			playAudio = kaleidoscopeSchema.playAudio.default,
			inputGainDb = kaleidoscopeSchema.inputGainDb.default,
			startColor = kaleidoscopeSchema.startColor.default,
			scale = kaleidoscopeSchema.scale.default,
			responsive = kaleidoscopeSchema.responsive.default,
			randomColors = kaleidoscopeSchema.randomColors.default,
			disableMovement = kaleidoscopeSchema.disableMovement.default,
			still = kaleidoscopeSchema.still.default,
			speed = kaleidoscopeSchema.speed.default,
			pattern = kaleidoscopeSchema.pattern.default,
			amount = kaleidoscopeSchema.amount.default,
			timeOffsetInSeconds = kaleidoscopeSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Kaleidoscope'}
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
					<KaleidoscopeContent
						key={`${audioSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						startColor={startColor}
						scale={scale}
						responsive={responsive}
						randomColors={randomColors}
						disableMovement={disableMovement}
						still={still}
						speed={speed}
						pattern={pattern}
						amount={amount}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);
export const Kaleidoscope = Interactive.withSchema({
	Component: KaleidoscopeInner,
	componentName: '<Kaleidoscope>',
	componentIdentity: null,
	schema: kaleidoscopeSchema,
	supportsEffects: false,
}) as React.FC<KaleidoscopeProps>;
