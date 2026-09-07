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
	cancelRender,
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type SequenceControls,
	type InteractivitySchema,
} from 'remotion';

type SpectreOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly colorMode?: 'gradient' | 'rainbow';
	readonly count?: number;
	readonly barWidth?: number;
	readonly bottom?: boolean;
	readonly spectreVariant?: 'bars' | 'segmented';
};

type SpectreProps = InteractiveBaseProps & InteractiveTransformProps & SpectreOptions;

const DEFAULT_AUDIO_SRC = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_AUDIO_OFFSET = 0;
const DEFAULT_PLAY_AUDIO = true;
const DEFAULT_INPUT_GAIN_DB = 0;
const DEFAULT_INTENSITY = 2.5;
const DEFAULT_START_COLOR = '#3373d4';
const DEFAULT_END_COLOR = '#f567f5';
const DEFAULT_COLOR_MODE = 'gradient';
const DEFAULT_COUNT = 64;
const DEFAULT_BAR_WIDTH = 3;
const DEFAULT_BOTTOM = false;
const DEFAULT_VARIANT = 'bars';
const ANALYSIS_FPS = 60;

const spectreSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
		default: DEFAULT_AUDIO_SRC,
		description: 'Audio source',
		keyframable: false,
	},
	audioOffsetInSeconds: {
		type: 'number',
		default: DEFAULT_AUDIO_OFFSET,
		min: 0,
		max: 86400,
		step: 0.01,
		description: 'Audio source offset in seconds',
		hiddenFromList: false,
		keyframable: false,
	},
	playAudio: {
		type: 'boolean',
		default: DEFAULT_PLAY_AUDIO,
		description: 'Play audio (disable when stacking)',
		keyframable: false,
	},
	width: {
		type: 'number',
		default: DEFAULT_WIDTH,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Width',
		hiddenFromList: false,
		keyframable: false,
	},
	height: {
		type: 'number',
		default: DEFAULT_HEIGHT,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Height',
		hiddenFromList: false,
		keyframable: false,
	},
	startColor: {
		type: 'color',
		default: DEFAULT_START_COLOR,
		description: 'Start color',
	},
	endColor: {
		type: 'color',
		default: DEFAULT_END_COLOR,
		description: 'End color',
	},
	colorMode: {
		type: 'enum',
		default: DEFAULT_COLOR_MODE,
		description: 'Color mode',
		variants: {gradient: {}, rainbow: {}},
	},
	count: {
		type: 'number',
		default: DEFAULT_COUNT,
		min: 5,
		max: 150,
		step: 1,
		description: 'Bar count',
		hiddenFromList: false,
	},
	barWidth: {
		type: 'number',
		default: DEFAULT_BAR_WIDTH,
		min: 0.5,
		max: 10,
		step: 0.5,
		description: 'Bar width',
		hiddenFromList: false,
	},
	bottom: {
		type: 'boolean',
		default: DEFAULT_BOTTOM,
		description: 'Align to bottom',
	},
	spectreVariant: {
		type: 'enum',
		default: DEFAULT_VARIANT,
		description: 'Treatment',
		variants: {bars: {}, segmented: {}},
	},
	inputGainDb: {
		type: 'number',
		default: DEFAULT_INPUT_GAIN_DB,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: DEFAULT_INTENSITY,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Intensity',
		hiddenFromList: false,
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
	// media-utils caches analysis by resultId. Keep each decoded buffer revision
	// distinct, including when neighboring windows arrive asynchronously.
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
	// The hook can publish the current chunk before its retained neighbors.
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
		frame: input.sourceTime * ANALYSIS_FPS,
		fps: ANALYSIS_FPS,
		numberOfSamples: 4096,
		optimizeFor: 'speed',
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		outputBarsCount: count,
	});
}

type DataTexture = {
	readonly width: number;
	readonly height: number;
	readonly data: Uint8Array;
};

const planeVertexShader = /* glsl */ `
in vec2 position;
out vec2 vUv;

void main() {
	vUv = position * 0.5 + 0.5;
	gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Original Banger Spectre shaders, adapted only for the standalone WebGL2 canvas.
const barsFragmentShader = /* glsl */ `
uniform float iGlobalTime;
uniform sampler2D iTexture;
uniform float iWidth;
uniform float iCount;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform float iIntensity;
uniform float iOpacity;
uniform bool iBottom;
uniform float iGradientAngle;
uniform int iColorMode;
uniform float iRainbowSpeed;
uniform float iRainbowSaturation;
uniform float iRainbowBrightness;
in vec2 vUv;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 getBaseColor(float t) {
	if (iColorMode == 2) {
		float hue = t + iGlobalTime * iRainbowSpeed * 0.1;
		return hsv2rgb(vec3(fract(hue), iRainbowSaturation, iRainbowBrightness));
	}
	return mix(iStartColor, iEndColor, t);
}

void main() {
	float numBars = iCount;
	float barWidth = iWidth / 800.0;
	float spaceWidth = 2.0 / 800.0;
	float totalWidth = barWidth + spaceWidth;
	float x = vUv.x;
	float barIndex = floor(x * numBars);
	float barHeight = texture(iTexture, vec2(barIndex / numBars, 0.5)).r;
	float angleRad = iGradientAngle * 3.14159265359 / 180.0;
	vec2 dir = vec2(cos(angleRad), sin(angleRad));
	float gradientT = clamp(dot(vUv - 0.5, dir) + 0.5, 0.0, 1.0);
	vec3 color = getBaseColor(gradientT);
	vec3 hsvColor = rgb2hsv(color);
	float multiplier = barHeight / iIntensity;
	color = hsv2rgb(vec3(hsvColor.x, hsvColor.y - multiplier, hsvColor.z + multiplier * 3.0));
	float borderRadius = 0.015;
	float barHeightAdjusted = max(0.06, min(72.0, barHeight * 64.0));
	vec2 posInBar = vec2(mod(x * numBars, 1.0) * totalWidth - barWidth / 2.0, (vUv.y - 0.5) * 2.0);
	if (iBottom) posInBar.y = vUv.y;
	float distToCorner = length(max(abs(posInBar) - vec2(barWidth / 2.0 - borderRadius, barHeightAdjusted * borderRadius), 0.0));
	if (distToCorner < borderRadius && posInBar.y < barHeightAdjusted && posInBar.y > -barHeightAdjusted) {
		outColor = vec4(color, iOpacity);
	} else {
		outColor = vec4(0.0);
	}
}
`;

const segmentedFragmentShader = /* glsl */ `
uniform float iGlobalTime;
uniform sampler2D iTexture;
uniform float iWidth;
uniform float iCount;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform float iIntensity;
uniform float iOpacity;
uniform bool iBottom;
uniform float iGradientAngle;
uniform float iSegmentGap;
uniform int iColorMode;
uniform float iRainbowSpeed;
uniform float iRainbowSaturation;
uniform float iRainbowBrightness;
in vec2 vUv;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	float e = 1.0e-10;
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
	vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
	vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
	return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 getBaseColor(float t) {
	if (iColorMode == 2) {
		float hue = t + iGlobalTime * iRainbowSpeed * 0.1;
		return hsv2rgb(vec3(fract(hue), iRainbowSaturation, iRainbowBrightness));
	}
	return mix(iStartColor, iEndColor, t);
}

void main() {
	float numBars = iCount;
	float barWidth = iWidth / 800.0;
	float totalWidth = barWidth + 2.0 / 800.0;
	float x = vUv.x;
	float barIndex = floor(x * numBars);
	float barHeight = texture(iTexture, vec2(barIndex / numBars, 0.5)).r;
	float angleRad = iGradientAngle * 3.14159265359 / 180.0;
	vec2 dir = vec2(cos(angleRad), sin(angleRad));
	float gradientT = clamp(dot(vUv - 0.5, dir) + 0.5, 0.0, 1.0);
	vec3 color = getBaseColor(gradientT);
	vec3 hsvColor = rgb2hsv(color);
	float multiplier = barHeight / iIntensity;
	color = hsv2rgb(vec3(hsvColor.x, hsvColor.y - multiplier, hsvColor.z + multiplier * 3.0));
	float barHeightAdjusted = max(1.0, min(72.0, barHeight * 64.0));
	float posInBarX = mod(x * numBars, 1.0) * totalWidth - barWidth / 2.0;
	float posInBarY = iBottom ? vUv.y : (vUv.y - 0.5) * 2.0;
	float segmentHeight = 0.012;
	float segmentStep = segmentHeight + segmentHeight * iSegmentGap;
	bool inGap = mod(abs(posInBarY), segmentStep) > segmentHeight;
	bool insideBar = abs(posInBarX) < barWidth / 2.0 && abs(posInBarY) < barHeightAdjusted * 0.015;
	if (insideBar && !inGap) {
		outColor = vec4(color, iOpacity);
	} else {
		outColor = vec4(0.0);
	}
}
`;

function createShaderSource(source: string, fragment: boolean) {
	if (!fragment) {
		return `#version 300 es\nprecision highp float;\nprecision highp int;\n${source}`;
	}

	const effect = source.replace(/void main\(\)/, 'void renderEffect()');
	return `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;
${effect}
void main() {
	renderEffect();
	vec3 linear = max(outColor.rgb, vec3(0.0));
	outColor.rgb = mix(
		linear * 12.92,
		1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055,
		step(vec3(0.0031308), linear)
	);
	outColor.a = clamp(outColor.a, 0.0, 1.0);
	outColor.rgb *= outColor.a;
}`;
}

type SpectreState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly uniforms: {
		readonly time: WebGLUniformLocation | null;
		readonly texture: WebGLUniformLocation | null;
		readonly barWidth: WebGLUniformLocation | null;
		readonly count: WebGLUniformLocation | null;
		readonly startColor: WebGLUniformLocation | null;
		readonly endColor: WebGLUniformLocation | null;
		readonly intensity: WebGLUniformLocation | null;
		readonly opacity: WebGLUniformLocation | null;
		readonly bottom: WebGLUniformLocation | null;
		readonly gradientAngle: WebGLUniformLocation | null;
		readonly segmentGap: WebGLUniformLocation | null;
		readonly colorMode: WebGLUniformLocation | null;
		readonly rainbowSpeed: WebGLUniformLocation | null;
		readonly rainbowSaturation: WebGLUniformLocation | null;
		readonly rainbowBrightness: WebGLUniformLocation | null;
	};
};

type SpectreFrame = Pick<
	Required<SpectreOptions>,
	| 'width'
	| 'height'
	| 'barWidth'
	| 'count'
	| 'startColor'
	| 'endColor'
	| 'intensity'
	| 'bottom'
	| 'colorMode'
> & {
	readonly sourceTime: number;
	readonly texture: DataTexture;
};

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Spectre could not create a shader.');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Spectre shader compilation failed: ${message}`);
	}
	return shader;
}

function setupSpectre(canvas: HTMLCanvasElement, fragment: string): SpectreState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Spectre requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Spectre could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		shaders.push(compileShader(gl, gl.VERTEX_SHADER, createShaderSource(planeVertexShader, false)));
		shaders.push(compileShader(gl, gl.FRAGMENT_SHADER, createShaderSource(fragment, true)));
		for (const shader of shaders) gl.attachShader(program, shader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Spectre shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Spectre could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const position = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		texture = gl.createTexture();
		if (!texture) throw new Error('Spectre could not create an audio texture.');
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return {
			gl,
			program,
			buffer,
			texture,
			uniforms: {
				time: gl.getUniformLocation(program, 'iGlobalTime'),
				texture: gl.getUniformLocation(program, 'iTexture'),
				barWidth: gl.getUniformLocation(program, 'iWidth'),
				count: gl.getUniformLocation(program, 'iCount'),
				startColor: gl.getUniformLocation(program, 'iStartColor'),
				endColor: gl.getUniformLocation(program, 'iEndColor'),
				intensity: gl.getUniformLocation(program, 'iIntensity'),
				opacity: gl.getUniformLocation(program, 'iOpacity'),
				bottom: gl.getUniformLocation(program, 'iBottom'),
				gradientAngle: gl.getUniformLocation(program, 'iGradientAngle'),
				segmentGap: gl.getUniformLocation(program, 'iSegmentGap'),
				colorMode: gl.getUniformLocation(program, 'iColorMode'),
				rainbowSpeed: gl.getUniformLocation(program, 'iRainbowSpeed'),
				rainbowSaturation: gl.getUniformLocation(program, 'iRainbowSaturation'),
				rainbowBrightness: gl.getUniformLocation(program, 'iRainbowBrightness'),
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

function drawSpectre(state: SpectreState, frame: SpectreFrame) {
	const {gl, program, texture, uniforms} = state;
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	// WebGL ignores null locations for uniforms optimized out of a variant.
	gl.uniform1f(uniforms.time, frame.sourceTime);
	gl.uniform1f(uniforms.barWidth, frame.barWidth);
	gl.uniform1f(uniforms.count, Math.round(frame.count));
	gl.uniform3fv(uniforms.startColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.endColor, linearColor(frame.endColor));
	gl.uniform1f(uniforms.intensity, frame.intensity);
	gl.uniform1f(uniforms.opacity, 1);
	gl.uniform1i(uniforms.bottom, Number(frame.bottom));
	gl.uniform1f(uniforms.gradientAngle, 0);
	gl.uniform1f(uniforms.segmentGap, 0.4);
	gl.uniform1i(uniforms.colorMode, frame.colorMode === 'rainbow' ? 2 : 0);
	gl.uniform1f(uniforms.rainbowSpeed, 1);
	gl.uniform1f(uniforms.rainbowSaturation, 0.85);
	gl.uniform1f(uniforms.rainbowBrightness, 0.85);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.texture.width,
		frame.texture.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		frame.texture.data,
	);
	gl.uniform1i(uniforms.texture, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	// Complete GPU work before Remotion captures this frame.
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Spectre WebGL draw failed: ${error}`);
}

function cleanupSpectre({gl, program, buffer, texture}: SpectreState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function SpectreCanvas({fragment, ...frame}: SpectreFrame & {readonly fragment: string}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<SpectreState | null>(null);
	const {delayRender, continueRender} = useDelayRender();

	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupSpectre(canvas, fragment);
		} catch (error) {
			cancelRender(error);
		}
		const onContextLost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Spectre WebGL context was lost.'));
		};
		const current = state.current;
		canvas.addEventListener('webglcontextlost', onContextLost);
		return () => {
			canvas.removeEventListener('webglcontextlost', onContextLost);
			cleanupSpectre(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, [fragment]);

	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Spectre');
		try {
			drawSpectre(state.current, frame);
		} catch (error) {
			cancelRender(error);
		} finally {
			continueRender(handle);
		}
	}, [frame, fragment, delayRender, continueRender]);

	return (
		<canvas
			ref={canvasRef}
			width={frame.width}
			height={frame.height}
			style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
		/>
	);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function createAudioTexture(bars: number[], multiplier: number): DataTexture {
	const data = new Uint8Array(Math.max(1, bars.length) * 4);
	for (let index = 0; index < bars.length; index++) {
		data[index * 4] = Math.round(clamp(bars[index] * multiplier, 0, 1) * 255);
		data[index * 4 + 3] = 255;
	}
	return {width: Math.max(1, bars.length), height: 1, data};
}

const colorCache = new Map<string, number[]>();
let colorParser: CanvasRenderingContext2D | null = null;

function linearColor(color: string): number[] {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded =
			hex.length === 3 ? [...hex].map((character) => character + character).join('') : hex;
		bytes = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
	} else {
		if (!CSS.supports('color', color)) throw new Error(`Invalid Spectre color: ${color}`);
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

const SpectreContent: React.FC<Required<SpectreOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const bars = spectrumBars({
		audioData: audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
	});
	const gain = 10 ** (props.inputGainDb / 20);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<SpectreCanvas
				fragment={
					props.spectreVariant === 'segmented' ? segmentedFragmentShader : barsFragmentShader
				}
				sourceTime={sourceTime}
				texture={createAudioTexture(bars, props.intensity * gain)}
				width={props.width}
				height={props.height}
				intensity={props.intensity}
				startColor={props.startColor}
				endColor={props.endColor}
				colorMode={props.colorMode}
				count={props.count}
				barWidth={props.barWidth}
				bottom={props.bottom}
			/>
		</>
	);
};

const SpectreInner = forwardRef<
	HTMLDivElement,
	SpectreProps & {
		readonly controls: SequenceControls | undefined;
	}
>(
	(
		{
			width = DEFAULT_WIDTH,
			height = DEFAULT_HEIGHT,
			audioSrc = DEFAULT_AUDIO_SRC,
			audioOffsetInSeconds = DEFAULT_AUDIO_OFFSET,
			playAudio = DEFAULT_PLAY_AUDIO,
			inputGainDb = DEFAULT_INPUT_GAIN_DB,
			intensity = DEFAULT_INTENSITY,
			startColor = DEFAULT_START_COLOR,
			endColor = DEFAULT_END_COLOR,
			colorMode = DEFAULT_COLOR_MODE,
			count = DEFAULT_COUNT,
			barWidth = DEFAULT_BAR_WIDTH,
			bottom = DEFAULT_BOTTOM,
			spectreVariant = DEFAULT_VARIANT,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? 'Spectre'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						position: 'relative',
						boxSizing: 'border-box',
						width,
						height,
						overflow: 'hidden',
						...style,
					}}
				>
					<SpectreContent
						key={audioSrc}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						intensity={intensity}
						startColor={startColor}
						endColor={endColor}
						colorMode={colorMode}
						count={count}
						barWidth={barWidth}
						bottom={bottom}
						spectreVariant={spectreVariant}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Spectre = Interactive.withSchema({
	Component: SpectreInner,
	componentName: '<Spectre>',
	componentIdentity: null,
	schema: spectreSchema,
	supportsEffects: false,
}) as React.FC<SpectreProps>;
