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

type RainOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly textureSrc?: string;
	readonly textureScale?: number;
	readonly distancing?: number;
	readonly blur?: number;
	readonly intensity?: number;
	readonly timeOffsetInSeconds?: number;
};

type RainProps = InteractiveBaseProps & InteractiveTransformProps & RainOptions;

const rainSchema = {
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
	textureSrc: {
		type: 'asset',
		default: 'https://cdn.banger.show/assets/rain.jpg',
		description: 'Background texture',
		keyframable: false,
	},
	textureScale: {
		type: 'number',
		default: 3.5,
		description: 'Background scale',
		min: 0.5,
		max: 20.0,
		step: 0.5,
		hiddenFromList: false,
	},
	distancing: {
		type: 'number',
		default: 2.5,
		description: 'Distancing',
		min: 0.0,
		max: 3.0,
		step: 0.1,
		hiddenFromList: false,
	},
	blur: {
		type: 'number',
		default: 0.9,
		description: 'Blur',
		min: 0.2,
		max: 1.0,
		step: 0.1,
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 3.0,
		description: 'Thunderstorm',
		min: 0.0,
		max: 7.0,
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

function rainTiming(frame: number, fps: number, audioOffset: number, timeOffset: number) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function rainBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

function rainGeometry() {
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

type RainFrame = Pick<
	Required<RainOptions>,
	'width' | 'height' | 'textureSrc' | 'textureScale' | 'distancing' | 'blur' | 'intensity'
> & {readonly time: number; readonly bands: readonly number[]};

type RainState = {
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
		| 'iTexture'
		| 'iTextureScale'
		| 'iDistancing'
		| 'iBlur'
		| 'iIntensity'
		| 'iTextureExists'
		| 'iAspect',
		WebGLUniformLocation | null
	>;
};

function setupRain(canvas: HTMLCanvasElement): RainState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Rain requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Rain could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Rain could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(`Rain shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Rain shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Rain could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = rainGeometry();
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
		if (!texture) throw new Error('Rain could not create a texture.');
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
				iTexture: gl.getUniformLocation(program, 'iTexture'),
				iTextureScale: gl.getUniformLocation(program, 'iTextureScale'),
				iDistancing: gl.getUniformLocation(program, 'iDistancing'),
				iBlur: gl.getUniformLocation(program, 'iBlur'),
				iIntensity: gl.getUniformLocation(program, 'iIntensity'),
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

function drawRain({gl, program, uniforms, vertexCount}: RainState, frame: RainFrame) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	gl.uniform1f(uniforms.iLowFreq, frame.bands[0] ?? 0);
	gl.uniform1f(uniforms.iMidFreq, frame.bands[1] ?? 0);
	gl.uniform1f(uniforms.iHighFreq, frame.bands[2] ?? 0);
	gl.uniform1f(uniforms.iTextureScale, bounded(frame.textureScale, 0.5, 20.0, 3.5));
	gl.uniform1f(uniforms.iDistancing, bounded(frame.distancing, 0.0, 3.0, 2.5));
	gl.uniform1f(uniforms.iBlur, bounded(frame.blur, 0.2, 1.0, 0.9));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.intensity, 0.0, 7.0, 3.0));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Rain WebGL draw failed: ${error}`);
}

function cleanupRain({gl, program, buffer, texture}: RainState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function RainCanvas(frame: RainFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<RainState | null>(null);
	const latestFrame = useRef(frame);
	latestFrame.current = frame;
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupRain(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Rain WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupRain(current);
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
		const handle = delayRender('Loading Rain texture');
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
				drawRain(current, latestFrame.current);
			} catch (error) {
				cancelRender(error);
			} finally {
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (!disposed) {
				continueRender(handle);
				cancelRender(new Error(`Rain could not load texture: ${frame.textureSrc}`));
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
		const handle = delayRender('Drawing Rain');
		try {
			drawRain(state.current, frame);
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
uniform sampler2D iSoundTexture;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iTextureScale;
uniform float iDistancing;
uniform float iRainAmount;
uniform float iBlur;
uniform float iIntensity;
uniform bool iTextureExists;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
in vec2 vUv;
out vec4 outColor;
vec3 iResolution = vec3(1920.0, 1080.0, 1.0);
#define S(a, b, t) smoothstep(a, b, t)
#define USE_POST_PROCESSING
vec3 N13(float p) {
   vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}
vec4 N14(float t) {
	return fract(sin(t*vec4(123., 1024., 1456., 264.))*vec4(6547., 345., 8799., 1564.));
}
float N(float t) {
    return fract(sin(t*12345.564)*7658.76);
}
float Saw(float b, float t) {
	return S(0., b, t)*S(1., b, t);
}
vec2 DropLayer2(vec2 uv, float t) {
    vec2 UV = uv;
    uv.y += t*0.75;
    vec2 a = vec2(6., 1.);
    vec2 grid = a*2.;
    vec2 id = floor(uv*grid);
    float colShift = N(id.x); 
    uv.y += colShift;
    id = floor(uv*grid);
    vec3 n = N13(id.x*35.2+id.y*2376.1);
    vec2 st = fract(uv*grid)-vec2(.5, 0);
    float x = n.x-.5;
    float y = UV.y*20.;
    float wiggle = sin(y+sin(y));
    x += wiggle*(.5-abs(x))*(n.z-.5);
    x *= .7;
    float ti = fract(t+n.z);
    y = (Saw(.85, ti)-.5)*.9+.5;
    vec2 p = vec2(x, y);
    float d = length((st-p)*a.yx);
    float mainDrop = S(.4, .0, d);
    float r = sqrt(S(1., y, st.y));
    float cd = abs(st.x-x);
    float trail = S(.23*r, .15*r*r, cd);
    float trailFront = S(-.02, .02, st.y-y);
    trail *= trailFront*r*r;
    y = UV.y;
    float trail2 = S(.2*r, .0, cd);
    float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
    y = fract(y*10.)+(st.y-.5);
    float dd = length(st-vec2(x, y));
    droplets = S(.3, 0., dd);
    float m = mainDrop+droplets*r*trailFront;
    return vec2(m, trail);
}
float StaticDrops(vec2 uv, float t) {
	uv *= 40.;
    vec2 id = floor(uv);
    uv = fract(uv)-.5;
    vec3 n = N13(id.x*107.45+id.y*3543.654);
    vec2 p = (n.xy-.5)*.7;
    float d = length(uv-p);
    float fade = Saw(.025, fract(t+n.z));
    float c = S(.3, 0., d)*fract(n.z*10.)*fade;
    return c;
}
vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticDrops(uv, t)*l0; 
    vec2 m1 = DropLayer2(uv, t)*l1;
    vec2 m2 = DropLayer2(uv*1.85, t)*l2;
    float c = s+m1.x+m2.x;
    c = S(.3, 1., c);
    return vec2(c, max(m1.y*l0, m2.y*l1));
}
vec3 iMouse = vec3(0.0, 0.0, 0.0);
void main()
{
		vec2 nuv = (vUv - vec2(0.5, 0.5)) / vec2(0.18, 0.32);
		vec2 uv = (nuv-.5*nuv);
    vec2 UV = nuv;
    vec3 M = iMouse/iResolution.xyz;
    float T = iGlobalTime+M.x*2.;
    #ifdef HAS_HEART
    T = mod(iGlobalTime, 102.);
    T = mix(T, M.x*102., M.z>0.?1.:0.);
    #endif
    float t = T*.2;
    float rainAmount = iBlur != 0.8 ? iBlur : sin(T*.05)*.3+.7;
    float maxBlur = mix(3., 6., rainAmount);
    float minBlur = 2.;
    float story = 0.;
    float heart = 0.;
    #ifdef HAS_HEART
    story = S(0., 70., T);
    t = min(1., T/70.);						
    t = 1.-t;
    t = (1.-t*t)*70.;
    float zoom= mix(.3, 1.2, story);		
    minBlur = 4.+S(.5, 1., story)*3.;		
    maxBlur = 6.+S(.5, 1., story)*1.5;
    vec2 hv = uv-vec2(.0, -.1);				
    hv.x *= .5;
    float s = S(110., 70., T);				
    hv.y-=sqrt(abs(hv.x))*.5*s;
    heart = length(hv);
    heart = S(.4*s, .2*s, heart)*s;
    rainAmount = heart;						
    maxBlur-=heart;							
    uv *= 1.5;								
    t *= .25;
    #else
    float zoom = -cos(T*.2);
		if (iDistancing > 0.0) {
			uv *= iDistancing;
		}
    #endif
    float staticDrops = S(-.5, 1., rainAmount)*2.;
    float layer1 = S(.25, .75, rainAmount);
    float layer2 = S(.0, .5, rainAmount);
    vec2 c = Drops(uv, t, staticDrops, layer1, layer2);
   #ifdef CHEAP_NORMALS
    	vec2 n = vec2(dFdx(c.x), dFdy(c.x));
    #else
    	vec2 e = vec2(.001, 0.);
    	float cx = Drops(uv+e, t, staticDrops, layer1, layer2).x;
    	float cy = Drops(uv+e.yx, t, staticDrops, layer1, layer2).x;
    	vec2 n = vec2(cx-c.x, cy-c.x);		
    #endif
    #ifdef HAS_HEART
    n *= 1.-S(60., 85., T);
    c.y *= 1.-S(80., 100., T)*.8;
    #endif
    float focus = mix(maxBlur-c.y, minBlur, S(.1, .2, c.x));
		float scaleFactor = iTextureScale / 5.;
		ivec2 texSize = textureSize(iTexture, 0); 
		float texAspectRatio = float(texSize.x) / float(texSize.y); 
		UV.x /= texAspectRatio;
		vec2 uvAdjusted = vec2(
			0.0 -((UV.x) * scaleFactor) + 0.5,
			((UV.y) * scaleFactor) + 0.5
		);
		vec3 col = textureLod(iTexture, uvAdjusted + n, focus).rgb;
    #ifdef USE_POST_PROCESSING
    t = (T+3.)*.5;										
    float colFade = sin(t*.2)*.5+.5+story;
    col *= mix(vec3(1.), vec3(.8, .9, 1.3), colFade);	
    float fade = S(0., 10., T);							
		float lightning = iLowFreq * iIntensity;				
    lightning *= pow(max(0., iLowFreq * iIntensity), 2.0);		
    col *= 1.+lightning*mix(1., .1, story*story);	
    #ifdef HAS_HEART
    	col = mix(pow(col, vec3(1.2)), col, heart);
    	fade *= S(102., 97., T);
    #endif
    #endif
    outColor = vec4(col, 1.);
}
`;

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const RainContent: React.FC<Required<RainOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {offsetFrames, sourceTime, time} = rainTiming(
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
			<RainCanvas {...props} time={time} bands={rainBands(bars, props.inputGainDb)} />
		</>
	);
};

const RainInner = forwardRef<
	HTMLDivElement,
	RainProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = rainSchema.width.default,
			height = rainSchema.height.default,
			audioSrc = rainSchema.audioSrc.default,
			audioOffsetInSeconds = rainSchema.audioOffsetInSeconds.default,
			playAudio = rainSchema.playAudio.default,
			inputGainDb = rainSchema.inputGainDb.default,
			textureSrc = rainSchema.textureSrc.default,
			textureScale = rainSchema.textureScale.default,
			distancing = rainSchema.distancing.default,
			blur = rainSchema.blur.default,
			intensity = rainSchema.intensity.default,
			timeOffsetInSeconds = rainSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Rain'}
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
					<RainContent
						key={`${audioSrc}:${textureSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						textureSrc={textureSrc}
						textureScale={textureScale}
						distancing={distancing}
						blur={blur}
						intensity={intensity}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Rain = Interactive.withSchema({
	Component: RainInner,
	componentName: '<Rain>',
	componentIdentity: null,
	schema: rainSchema,
	supportsEffects: false,
}) as React.FC<RainProps>;
