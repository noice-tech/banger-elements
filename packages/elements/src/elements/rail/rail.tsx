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

type RailOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly textureSrc?: string;
	readonly textureScale?: number;
	readonly textureSize?: number;
	readonly textureRounded?: number;
	readonly sunPosition?: number;
	readonly sunSize?: number;
	readonly volume?: number;
	readonly sides?: number;
	readonly waves?: number;
	readonly intensity?: number;
	readonly stroke?: number;
	readonly timeOffsetInSeconds?: number;
};

type RailProps = InteractiveBaseProps & InteractiveTransformProps & RailOptions;

const railSchema = {
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
	startColor: {type: 'color', default: '#877d87', description: 'Theme'},
	endColor: {type: 'color', default: '#c800ff', description: 'Sky Color'},
	textureSrc: {type: 'asset', default: '', description: 'Flying object', keyframable: false},
	textureScale: {
		type: 'number',
		default: 15.0,
		description: 'Flying object inner scale',
		min: 0.5,
		max: 20.0,
		step: 0.5,
		hiddenFromList: false,
	},
	textureSize: {
		type: 'number',
		default: 0.15,
		description: 'Flying object size',
		min: 0.1,
		max: 0.4,
		step: 0.025,
		hiddenFromList: false,
	},
	textureRounded: {
		type: 'number',
		default: 0.0,
		description: 'Flying object rounded',
		min: 0.0,
		max: 0.5,
		step: 0.05,
		hiddenFromList: false,
	},
	sunPosition: {
		type: 'number',
		default: 0.02,
		description: 'Sun position',
		min: 0.0,
		max: 0.5,
		step: 0.01,
		hiddenFromList: false,
	},
	sunSize: {
		type: 'number',
		default: 0.0,
		description: 'Sun size',
		min: -4.0,
		max: 2.0,
		step: 0.25,
		hiddenFromList: false,
	},
	volume: {
		type: 'number',
		default: 0.25,
		description: 'Volume',
		min: 0.1,
		max: 0.5,
		step: 0.01,
		hiddenFromList: false,
	},
	sides: {
		type: 'number',
		default: 35.0,
		description: 'Sides',
		min: 1.0,
		max: 50.0,
		step: 0.5,
		hiddenFromList: false,
	},
	waves: {
		type: 'number',
		default: 0.15,
		description: 'Waves',
		min: 0.0,
		max: 0.35,
		step: 0.01,
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 20.0,
		description: 'Intensity',
		min: 1.0,
		max: 50.0,
		step: 0.5,
		hiddenFromList: false,
	},
	stroke: {
		type: 'number',
		default: 0.001,
		description: 'Stroke',
		min: 0.001,
		max: 0.005,
		step: 0.0001,
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

function railTiming(frame: number, fps: number, audioOffset: number, timeOffset: number) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function railBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85, Math.floor(bars.length * 0.1)].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

function railGeometry() {
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

type RailFrame = Pick<
	Required<RailOptions>,
	| 'width'
	| 'height'
	| 'startColor'
	| 'endColor'
	| 'textureSrc'
	| 'textureScale'
	| 'textureSize'
	| 'textureRounded'
	| 'sunPosition'
	| 'sunSize'
	| 'volume'
	| 'sides'
	| 'waves'
	| 'intensity'
	| 'stroke'
> & {readonly time: number; readonly bands: readonly number[]};

type RailState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| 'iGlobalTime'
		| 'iLowFreq'
		| 'iMidFreq'
		| 'iHighFreq'
		| 'iSunAudio'
		| 'iStartColor'
		| 'iEndColor'
		| 'iTexture'
		| 'iTextureScale'
		| 'iTextureSize'
		| 'iTextureRounded'
		| 'iSunPosition'
		| 'iSunSize'
		| 'iVolume'
		| 'iSides'
		| 'iWaves'
		| 'iIntensity'
		| 'iStroke'
		| 'iTextureExists'
		| 'iAspect',
		WebGLUniformLocation | null
	>;
};

function setupRail(canvas: HTMLCanvasElement): RailState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Rail requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Rail could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Rail could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(`Rail shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Rail shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Rail could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = railGeometry();
		gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
		for (const [name, size, offset] of [
			['position', 3, 0],
			['uv', 2, 12],
		] as const) {
			const attribute = gl.getAttribLocation(program, name);
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 20, offset);
		}
		texture = gl.createTexture();
		if (!texture) throw new Error('Rail could not create a texture.');
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([0, 0, 0, 255]),
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.generateMipmap(gl.TEXTURE_2D);
		return {
			texture,
			gl,
			program,
			buffer,
			vertexCount: geometry.length / 5,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, 'iGlobalTime'),
				iLowFreq: gl.getUniformLocation(program, 'iLowFreq'),
				iMidFreq: gl.getUniformLocation(program, 'iMidFreq'),
				iHighFreq: gl.getUniformLocation(program, 'iHighFreq'),
				iSunAudio: gl.getUniformLocation(program, 'iSunAudio'),
				iStartColor: gl.getUniformLocation(program, 'iStartColor'),
				iEndColor: gl.getUniformLocation(program, 'iEndColor'),
				iTexture: gl.getUniformLocation(program, 'iTexture'),
				iTextureScale: gl.getUniformLocation(program, 'iTextureScale'),
				iTextureSize: gl.getUniformLocation(program, 'iTextureSize'),
				iTextureRounded: gl.getUniformLocation(program, 'iTextureRounded'),
				iSunPosition: gl.getUniformLocation(program, 'iSunPosition'),
				iSunSize: gl.getUniformLocation(program, 'iSunSize'),
				iVolume: gl.getUniformLocation(program, 'iVolume'),
				iSides: gl.getUniformLocation(program, 'iSides'),
				iWaves: gl.getUniformLocation(program, 'iWaves'),
				iIntensity: gl.getUniformLocation(program, 'iIntensity'),
				iStroke: gl.getUniformLocation(program, 'iStroke'),
				iTextureExists: gl.getUniformLocation(program, 'iTextureExists'),
				iAspect: gl.getUniformLocation(program, 'iAspect'),
			},
		};
	} catch (error) {
		gl.deleteTexture(texture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function drawRail({gl, program, uniforms, vertexCount}: RailState, frame: RailFrame) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	gl.uniform1f(uniforms.iLowFreq, frame.bands[0] ?? 0);
	gl.uniform1f(uniforms.iMidFreq, frame.bands[1] ?? 0);
	gl.uniform1f(uniforms.iHighFreq, frame.bands[2] ?? 0);
	gl.uniform1f(uniforms.iSunAudio, Uint8Array.of((frame.bands[3] ?? 0) * 255)[0] / 255);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.iEndColor, linearColor(frame.endColor));
	gl.uniform1f(uniforms.iTextureScale, bounded(frame.textureScale, 0.5, 20.0, 15.0));
	gl.uniform1f(uniforms.iTextureSize, bounded(frame.textureSize, 0.1, 0.4, 0.15));
	gl.uniform1f(uniforms.iTextureRounded, bounded(frame.textureRounded, 0.0, 0.5, 0.0));
	gl.uniform1f(uniforms.iSunPosition, bounded(frame.sunPosition, 0.0, 0.5, 0.02));
	gl.uniform1f(uniforms.iSunSize, bounded(frame.sunSize, -4.0, 2.0, 0.0));
	gl.uniform1f(uniforms.iVolume, bounded(frame.volume, 0.1, 0.5, 0.25));
	gl.uniform1f(uniforms.iSides, bounded(frame.sides, 1.0, 50.0, 35.0));
	gl.uniform1f(uniforms.iWaves, bounded(frame.waves, 0.0, 0.35, 0.15));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.intensity, 1.0, 50.0, 20.0));
	gl.uniform1f(uniforms.iStroke, bounded(frame.stroke, 0.001, 0.005, 0.001));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Rail WebGL draw failed: ${error}`);
}

function cleanupRail({gl, program, buffer, texture}: RailState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function RailCanvas(frame: RailFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<RailState | null>(null);
	const latestFrame = useRef(frame);
	latestFrame.current = frame;
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupRail(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Rail WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupRail(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		const current = state.current;
		if (!current) return;
		const {gl, program, uniforms, texture} = current;
		gl.useProgram(program);
		gl.uniform1i(uniforms.iTexture, 0);
		gl.uniform1i(uniforms.iTextureExists, 0);
		if (!frame.textureSrc) return;
		const handle = delayRender('Loading Rail texture');
		let disposed = false;
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => {
			if (disposed) return;
			try {
				gl.useProgram(program);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
				gl.generateMipmap(gl.TEXTURE_2D);
				gl.uniform1i(uniforms.iTextureExists, 1);
				drawRail(current, latestFrame.current);
			} catch (error) {
				cancelRender(error);
			} finally {
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (!disposed) {
				continueRender(handle);
				cancelRender(new Error(`Rail could not load texture: ${frame.textureSrc}`));
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
		const handle = delayRender('Drawing Rail');
		try {
			drawRail(state.current, frame);
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
uniform sampler2D iTexture;
uniform float iSunAudio;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iTextureScale;
uniform float iTextureSize;
uniform float iSunPosition;
uniform float iSunSize;
uniform float iVolume;
uniform float iWaves;
uniform float iSides;
uniform float iIntensity;
uniform float iStroke;
uniform float iTextureRounded;
uniform bool iTextureExists;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
in vec2 vUv;
out vec4 outColor;
vec2 iResolution = vec2(1920.0, 1080.0);
#define NYAN 
#define WAVES
#define RAY_STEPS 150
#define BRIGHTNESS 1.4
#define GAMMA 1.5
#define SATURATION .7
#define detail .001
#define t iGlobalTime*.5
const vec3 origin=vec3(-1.,.7,0.);
float det=0.0;
mat2 rot(float a) {
	return mat2(cos(a),sin(a),-sin(a),cos(a));	
}
vec4 formula(vec4 p) {
		p.xz = abs(p.xz+1.)-abs(p.xz-1.)-p.xz;
		p.y-=iVolume;
		p.xy*=rot(radians(iSides));
		p=p*2./clamp(dot(p.xyz,p.xyz),.2,1.);
	return p;
}
float de(vec3 pos) {
#ifdef WAVES
	pos.y+=sin(pos.z-t*6.)*iWaves; 
#endif
	float hid=0.;
	vec3 tpos=pos;
	tpos.z=abs(3.-mod(tpos.z,6.));
	vec4 p=vec4(tpos,1.);
	for (int i=0; i<4; i++) {p=formula(p);}
	float fr=(length(max(vec2(0.),p.yz-1.5))-1.)/p.w;
	float ro=max(abs(pos.x+1.)-.3,pos.y-.35);
		  ro=max(ro,-max(abs(pos.x+1.)-.1,pos.y-.5));
	pos.z=abs(.25-mod(pos.z,.5));
		  ro=max(ro,-max(abs(pos.z)-.2,pos.y-.3));
		  ro=max(ro,-max(abs(pos.z)-.01,-pos.y+.32));
	float d=min(fr,ro);
	return d;
}
vec3 path(float ti) {
	ti*=1.5;
	vec3  p=vec3(sin(ti),(1.-sin(ti*2.))*.5,-ti*5.)*.5;
	return p;
}
float edge=0.;
vec3 normal(vec3 p) { 
	vec3 e = vec3(0.0,det*5.,0.0);
	float d1=de(p-e.yxx),d2=de(p+e.yxx);
	float d3=de(p-e.xyx),d4=de(p+e.xyx);
	float d5=de(p-e.xxy),d6=de(p+e.xxy);
	float d=de(p);
	edge=abs(d-0.5*(d2+d1))+abs(d-0.5*(d4+d3))+abs(d-0.5*(d6+d5));
	edge=min(1.,pow(edge,.55)*15.);
	return normalize(vec3(d1-d2,d3-d4,d5-d6));
}
vec4 rainbow(vec2 p)
{
	float q = max(p.x,-0.1);
	float s = sin(p.x*7.0+t*70.0)*0.08;
	p.y+=s;
	p.y*=1.1;
	vec4 c;
	if (p.x>0.0) c=vec4(0,0,0,0); else
	if (0.0/6.0<p.y&&p.y<1.0/6.0) c= vec4(255,43,14,255)/255.0; else
	if (1.0/6.0<p.y&&p.y<2.0/6.0) c= vec4(255,168,6,255)/255.0; else
	if (2.0/6.0<p.y&&p.y<3.0/6.0) c= vec4(255,244,0,255)/255.0; else
	if (3.0/6.0<p.y&&p.y<4.0/6.0) c= vec4(51,234,5,255)/255.0; else
	if (4.0/6.0<p.y&&p.y<5.0/6.0) c= vec4(8,163,255,255)/255.0; else
	if (5.0/6.0<p.y&&p.y<6.0/6.0) c= vec4(122,85,255,255)/255.0; else
	if (abs(p.y)-.05<0.0001) c=vec4(vec3(iLowFreq * 2.25),1.); else
	if (abs(p.y-1.)-.05<0.0001) c=vec4(vec3(iLowFreq * 2.25),1.); else
		c=vec4(0,0,0,0);
	c.a*=.8-min(.8,abs(p.x*.08));
	c.xyz=mix(c.xyz,vec3(length(c.xyz)),.15);
	return c;
}
vec4 nyan(vec2 p)
{
	vec2 uv = p*vec2(0.5,0.5);
	uv.x += 0.1;
	float scaleFactor = iTextureScale / 5.;
	ivec2 texSize = textureSize(iTexture, 0); 
	float texAspectRatio = float(texSize.x) / float(texSize.y); 
	uv.x /= texAspectRatio;
	float ns=3.0;
	float nt = iGlobalTime*ns; nt-=mod(nt,240.0/256.0/6.0); nt = mod(nt,240.0/256.0);
	float ny = mod(iGlobalTime*ns,1.0); ny-=mod(ny,0.75); ny*=-0.05;
	vec2 uvAdjusted = vec2(
			((uv.x) * scaleFactor + 0.5),
			(uv.y * scaleFactor + 0.5)
	);
	vec4 color = texture(iTexture, uvAdjusted);
	float borderRadius = iTextureRounded;
	if (borderRadius == 0.0) {
		if (uv.x<-iTextureSize) color.a = 0.0;
		if (uv.x>iTextureSize) color.a=0.0;
		if (uv.y > iTextureSize) color.a = 0.0;
		if (uv.y < -iTextureSize) color.a = 0.0;
	}
	vec2 borderDist = abs(uvAdjusted - 0.5) - vec2((iTextureSize * scaleFactor) - borderRadius);
	float maxBorderDist = length(max(borderDist, 0.0));
	if (borderRadius > 0.0) {
		if (maxBorderDist < borderRadius) {
			color.a = 1.0;
		} else {
				color.a = 0.0;
		}
	}
	return color;
}
vec3 raymarch(in vec3 from, in vec3 dir) 
{
	edge=0.;
	vec3 p, norm;
	float d=100.;
	float totdist=0.;
	for (int i=0; i<RAY_STEPS; i++) {
		if (d>det && totdist<25.0) {
			p=from+totdist*dir;
			d=de(p);
			det=iStroke*exp(.13*totdist);
			totdist+=d; 
		}
	}
	vec3 col=vec3(0.);
	p-=(det-d)*dir;
	norm=normal(p);
	col=(((1.-abs(norm)) + iStartColor) / 1.5) * max(0.,1.-edge*.8);
	totdist=clamp(totdist,0.,26.);
	dir.y-=iSunPosition;
	float sunsize=7.0 - iSunSize-max(0.,iSunAudio)*iIntensity; 
	float an=atan(dir.x,dir.y)+iGlobalTime*1.5; 
	float s=pow(clamp(1.0-length(dir.xy)*sunsize-abs(.2-mod(an,.4)),0.,1.),.1); 
	float sb=pow(clamp(1.0-length(dir.xy)*(sunsize-.2)-abs(.2-mod(an,.4)),0.,1.),.1); 
	float sg=pow(clamp(1.0-length(dir.xy)*(sunsize-4.5)-.5*abs(.2-mod(an,.4)),0.,1.),3.); 
	float y=mix(.45,1.2,pow(smoothstep(0.,1.,.75-dir.y),2.))*(1.-sb*.5); 
	vec3 backg=vec3(iEndColor)*((1.-s)*(1.-sg)*y+(1.-sb)*sg*vec3(1.,.8,0.15)*3.);
    backg += vec3(1., .9, .1) * s;
    backg = max(backg, sg * vec3(1., .9, .5));
	col=mix(vec3(1.,.9,.3),col,exp(-.004*totdist*totdist));
	if (totdist>25.) col=backg; 
	col=pow(col,vec3(GAMMA))*BRIGHTNESS;
	col=mix(vec3(length(col)),col,SATURATION);
#ifdef SHOWONLYEDGES
	col=1.-vec3(length(col));
#else
	col*=vec3(1.,.9,.85);
#ifdef NYAN
	dir.yx*=rot(dir.x);
	vec2 ncatpos=(dir.xy+vec2(-1.5+mod(-t,2.),-.27));
	vec4 ncat=iTextureExists ? nyan(ncatpos*5.) : vec4(0.);
	vec4 rain=rainbow(ncatpos*10.+vec2(.8,.5));
	if (totdist>8.) col=mix(col,max(vec3(.2),rain.xyz),rain.a*.9);
	if (totdist>8. && iTextureExists) col=mix(col,max(vec3(.2),ncat.xyz),ncat.a*.9);
#endif
#endif
	return col;
}
vec3 move(inout vec3 dir) {
	vec3 go=path(t);
	vec3 adv=path(t+.7);
	float hd=de(adv);
	vec3 advec=normalize(adv-go);
	float an=adv.x-go.x; an*=min(1.,abs(adv.z-go.z))*sign(adv.z-go.z)*.7;
	dir.xy*=mat2(cos(an),sin(an),-sin(an),cos(an));
    an=advec.y*1.7;
	dir.yz*=mat2(cos(an),sin(an),-sin(an),cos(an));
	an=atan(advec.x,advec.z);
	dir.xz*=mat2(cos(an),sin(an),-sin(an),cos(an));
	return go;
}
vec3 iMouse = vec3(0.0, 0.0, 0.0);
void main()
{
    vec2 uv = (vUv - vec2(0.5, 0.5)) / vec2(0.15, 0.15);
	vec2 oriuv=uv;
	uv.y*=iResolution.y/iResolution.x;
	vec2 mouse=(iMouse.xy/iResolution.xy-.5)*3.;
	if (iMouse.z<1.) mouse=vec2(0.,-0.05);
	float fov=.9-max(0.,.7-iGlobalTime*.3);
	vec3 dir=normalize(vec3(uv*fov,1.));
	dir.yz*=rot(mouse.y);
	dir.xz*=rot(mouse.x);
	vec3 from=origin+move(dir);
	vec3 color=raymarch(from,dir); 
	#ifdef BORDER
	color=mix(vec3(0.),color,pow(max(0.,.95-length(oriuv*oriuv*oriuv*vec2(1.05,1.1))),.3));
	#endif
	outColor = vec4(color,1.);
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

const RailContent: React.FC<Required<RailOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {offsetFrames, sourceTime, time} = railTiming(
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
			<RailCanvas {...props} time={time} bands={railBands(bars, props.inputGainDb)} />
		</>
	);
};

const RailInner = forwardRef<
	HTMLDivElement,
	RailProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = railSchema.width.default,
			height = railSchema.height.default,
			audioSrc = railSchema.audioSrc.default,
			audioOffsetInSeconds = railSchema.audioOffsetInSeconds.default,
			playAudio = railSchema.playAudio.default,
			inputGainDb = railSchema.inputGainDb.default,
			startColor = railSchema.startColor.default,
			endColor = railSchema.endColor.default,
			textureSrc = railSchema.textureSrc.default,
			textureScale = railSchema.textureScale.default,
			textureSize = railSchema.textureSize.default,
			textureRounded = railSchema.textureRounded.default,
			sunPosition = railSchema.sunPosition.default,
			sunSize = railSchema.sunSize.default,
			volume = railSchema.volume.default,
			sides = railSchema.sides.default,
			waves = railSchema.waves.default,
			intensity = railSchema.intensity.default,
			stroke = railSchema.stroke.default,
			timeOffsetInSeconds = railSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Rail'}
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
					<RailContent
						key={`${audioSrc}:${textureSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						startColor={startColor}
						endColor={endColor}
						textureSrc={textureSrc}
						textureScale={textureScale}
						textureSize={textureSize}
						textureRounded={textureRounded}
						sunPosition={sunPosition}
						sunSize={sunSize}
						volume={volume}
						sides={sides}
						waves={waves}
						intensity={intensity}
						stroke={stroke}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Rail = Interactive.withSchema({
	Component: RailInner,
	componentName: '<Rail>',
	componentIdentity: null,
	schema: railSchema,
	supportsEffects: false,
}) as React.FC<RailProps>;
