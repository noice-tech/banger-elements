import {Audio} from '@remotion/media';
import {useAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {
	forwardRef,
	useRef,
	useImperativeHandle,
	useMemo,
	useLayoutEffect,
	useState,
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

type HaloOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly colorMode?: 'rainbow' | 'gradient';
	readonly startColor?: string;
	readonly endColor?: string;
	readonly leadingColor?: string;
	readonly centerColor?: string;
	readonly centerMode?: 'filled' | 'transparent';
	readonly radius?: number;
	readonly trailDepth?: number;
	readonly waveDelay?: boolean;
	readonly motionBlur?: boolean;
	readonly glowBlur?: number;
	readonly glowSpread?: number;
	readonly artworkSrc?: string;
};

type HaloProps = InteractiveBaseProps & InteractiveTransformProps & HaloOptions;

const haloSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
		default: 'https://remotion.media/elements/remotion-made-this-picture-move.mp3',
		description: 'Audio source',
		keyframable: false,
	},
	artworkSrc: {
		type: 'asset',
		default: '',
		description: 'Optional center artwork',
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
	colorMode: {
		type: 'enum',
		variants: {rainbow: {}, gradient: {}},
		default: 'rainbow',
		description: 'Rainbow palette or custom gradient',
	},
	startColor: {type: 'color', default: '#aa8bff', description: 'Gradient start color'},
	endColor: {type: 'color', default: '#51e8cc', description: 'Gradient end color'},
	leadingColor: {
		type: 'color',
		default: undefined,
		description: 'Leading edge override (unset: white in rainbow, startColor in gradient)',
	},
	centerMode: {
		type: 'enum',
		variants: {filled: {}, transparent: {}},
		default: 'filled',
		description: 'Filled center or transparent cutout (ignores center color and artwork)',
	},
	centerColor: {
		type: 'color',
		default: '#2d2d2d',
		description: 'Center base color; preserves shading and does not tint artwork',
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
	intensity: {
		type: 'number',
		default: 1,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Spectrum deformation',
		hiddenFromList: false,
	},
	radius: {
		type: 'number',
		default: 0.12,
		min: 0.05,
		max: 0.8,
		step: 0.01,
		description: 'Radius',
		hiddenFromList: false,
	},
	trailDepth: {
		type: 'number',
		default: 9,
		min: 1,
		max: 9,
		step: 1,
		description: 'Trail layers',
		hiddenFromList: false,
	},
	waveDelay: {type: 'boolean', default: true, description: 'Delayed trails'},
	motionBlur: {type: 'boolean', default: true, description: 'Temporal afterglow'},
	glowBlur: {
		type: 'number',
		default: 0,
		min: 0,
		max: 100,
		step: 1,
		description: 'Extra glow blur (0 disables)',
		hiddenFromList: false,
	},
	glowSpread: {
		type: 'number',
		default: 0,
		min: 0,
		max: 100,
		step: 1,
		description: 'Extra glow spread',
		hiddenFromList: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

function useArtwork(src: string) {
	const [loaded, setLoaded] = useState<{src: string; image: HTMLImageElement} | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		if (!src) return;
		const handle = delayRender('Loading Halo artwork');
		const image = new Image();
		let active = true;
		image.crossOrigin = 'anonymous';
		image.onload = () => {
			if (active) {
				setLoaded({src, image});
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (active) {
				continueRender(handle);
				cancelRender(new Error(`Could not load artwork: ${src}`));
			}
		};
		image.src = src;
		return () => {
			active = false;
			image.onload = null;
			image.onerror = null;
			continueRender(handle);
		};
	}, [src, delayRender, continueRender]);
	return loaded?.src === src ? loaded.image : null;
}

// Fixed analysis timing and frequency bins keep results independent of host FPS and audio device.
const ANALYSIS_FPS = 60;
const ANALYSIS_SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const FREQUENCY_BIN_COUNT = 512;
const TEMPORAL_SMOOTHING = 0.8;
const MIN_DECIBELS = -100;
const MAX_DECIBELS = -30;
const SPECTRUM_SCALE = 0.08;
// Retain only the low-frequency bins used by the ring (~10 KB/sec).
const RETAINED_BINS = Math.ceil(SPECTRUM_SCALE * FREQUENCY_BIN_COUNT) + 1;
const BLUR_SAMPLES = 6;
const HISTORY_ROWS = 9 + BLUR_SAMPLES - 1;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const blackmanWindow = Float64Array.from(
	{length: FFT_SIZE},
	(_, index) =>
		0.42 -
		0.5 * Math.cos((2 * Math.PI * index) / FFT_SIZE) +
		0.08 * Math.cos((4 * Math.PI * index) / FFT_SIZE),
);
const bitReversedIndices = Uint16Array.from({length: FFT_SIZE}, (_, index) => {
	let reversed = 0;
	for (let bits = FFT_SIZE; bits > 1; bits >>= 1) {
		reversed = (reversed << 1) | (index & 1);
		index >>= 1;
	}
	return reversed;
});

type AnalysisParameters = {
	audioData: MediaUtilsAudioData;
	dataOffsetInSeconds: number;
	frame: number;
	fps: number;
	inputGainDb: number;
};

// Web Audio's speakers downmix to mono, including the defined quad/5.1 layouts.
function monoSample(channels: Float32Array[], index: number) {
	const sample = (channel: number) => channels[channel]?.[index] ?? 0;
	if (channels.length === 1) return sample(0);
	if (channels.length === 2) return (sample(0) + sample(1)) * 0.5;
	if (channels.length === 4) return (sample(0) + sample(1) + sample(2) + sample(3)) * 0.25;
	if (channels.length === 6)
		return Math.SQRT1_2 * (sample(0) + sample(1)) + sample(2) + 0.5 * (sample(4) + sample(5));
	return sample(0); // Web Audio's discrete fallback for other layouts.
}

function getRawMagnitudes({
	audioData,
	dataOffsetInSeconds,
	frame,
	fps,
}: Omit<AnalysisParameters, 'inputGainDb'>) {
	const real = new Float64Array(FFT_SIZE);
	const imaginary = new Float64Array(FFT_SIZE);
	const magnitudes = new Float32Array(FREQUENCY_BIN_COUNT);
	const endSample = Math.floor((frame / fps - dataOffsetInSeconds) * audioData.sampleRate);
	const startSample = endSample - FFT_SIZE;
	if (endSample <= 0 || startSample >= audioData.channelWaveforms[0].length) return magnitudes;
	for (let index = 0; index < FFT_SIZE; index++) {
		real[bitReversedIndices[index]] =
			monoSample(audioData.channelWaveforms, startSample + index) * blackmanWindow[index];
	}
	for (let length = 2; length <= FFT_SIZE; length <<= 1) {
		const angle = (-2 * Math.PI) / length;
		const phaseReal = Math.cos(angle);
		const phaseImaginary = Math.sin(angle);
		for (let start = 0; start < FFT_SIZE; start += length) {
			let rotationReal = 1;
			let rotationImaginary = 0;
			const halfLength = length >> 1;
			for (let offset = 0; offset < halfLength; offset++) {
				const evenIndex = start + offset;
				const oddIndex = evenIndex + halfLength;
				const oddReal = real[oddIndex] * rotationReal - imaginary[oddIndex] * rotationImaginary;
				const oddImaginary =
					real[oddIndex] * rotationImaginary + imaginary[oddIndex] * rotationReal;
				const evenReal = real[evenIndex];
				const evenImaginary = imaginary[evenIndex];
				real[evenIndex] = evenReal + oddReal;
				imaginary[evenIndex] = evenImaginary + oddImaginary;
				real[oddIndex] = evenReal - oddReal;
				imaginary[oddIndex] = evenImaginary - oddImaginary;
				const nextRotationReal = rotationReal * phaseReal - rotationImaginary * phaseImaginary;
				rotationImaginary = rotationReal * phaseImaginary + rotationImaginary * phaseReal;
				rotationReal = nextRotationReal;
			}
		}
	}
	for (let index = 0; index < FREQUENCY_BIN_COUNT; index++) {
		magnitudes[index] = Math.hypot(real[index], imaginary[index]) / FFT_SIZE;
	}
	return magnitudes;
}

type AnalysisTrace = {
	magnitudes: Float32Array[];
	gains: Map<number, {bass: number[]; phase: number[]}>;
};
// Owned by the decoded audio, not by playback. Seeking can only extend a trace;
// it never changes previously computed values. No finite-window smoothing reset.
const analysisCache = new WeakMap<MediaUtilsAudioData, Map<string, AnalysisTrace>>();

function getAnalysisTrace(parameters: AnalysisParameters) {
	const {audioData, dataOffsetInSeconds, fps, frame} = parameters;
	let traces = analysisCache.get(audioData);
	if (!traces) {
		traces = new Map();
		analysisCache.set(audioData, traces);
	}
	const key = `${dataOffsetInSeconds}:${fps}`;
	let trace = traces.get(key);
	if (!trace) {
		trace = {magnitudes: [], gains: new Map()};
		traces.set(key, trace);
	}
	const endFrame = Math.min(frame, Math.ceil(audioData.durationInSeconds * fps));
	for (let next = trace.magnitudes.length; next <= endFrame; next++) {
		const raw = getRawMagnitudes({...parameters, frame: next});
		const previous = trace.magnitudes[next - 1];
		const smoothed = new Float32Array(RETAINED_BINS);
		for (let bin = 0; bin < RETAINED_BINS; bin++) {
			smoothed[bin] =
				TEMPORAL_SMOOTHING * (previous?.[bin] ?? 0) + (1 - TEMPORAL_SMOOTHING) * raw[bin];
		}
		trace.magnitudes.push(smoothed);
	}
	return trace;
}

function normalizeMagnitude(magnitude: number, inputGainDb: number) {
	const decibels = 20 * Math.log10(Math.max(magnitude, 1e-12)) + inputGainDb;
	// getByteFrequencyData quantizes BEFORE texture interpolation and thresholds.
	return (
		Math.floor(clamp((decibels - MIN_DECIBELS) / (MAX_DECIBELS - MIN_DECIBELS), 0, 1) * 255) / 255
	);
}

function sampleFrequency(values: Float32Array, x: number) {
	// Normalized GL coordinates address texel CENTERS, not x * (width - 1).
	const position = clamp(x * FREQUENCY_BIN_COUNT - 0.5, 0, values.length - 1);
	const left = Math.floor(position);
	const mix = position - left;
	return values[left] * (1 - mix) + values[Math.min(left + 1, values.length - 1)] * mix;
}

function normalizedSpectrum(magnitudes: Float32Array, gain: number) {
	return Float32Array.from(magnitudes, (magnitude) => normalizeMagnitude(magnitude, gain));
}

function bassFromSpectrum(values: Float32Array) {
	let sum = 0;
	for (let step = 0; step < 8; step++) sum += sampleFrequency(values, step * 0.001);
	return clamp((sum / 8 - 0.75) / 0.25, 0, 1);
}

function getHaloSourceBass(parameters: AnalysisParameters) {
	if (
		parameters.frame < 0 ||
		parameters.frame / parameters.fps >= parameters.audioData.durationInSeconds
	)
		return 0;
	const trace = getAnalysisTrace(parameters);
	return bassFromSpectrum(
		normalizedSpectrum(trace.magnitudes[parameters.frame], parameters.inputGainDb),
	);
}

function getBassPhase(parameters: AnalysisParameters) {
	if (parameters.frame < 0) return 0;
	const trace = getAnalysisTrace(parameters);
	let gainTrace = trace.gains.get(parameters.inputGainDb);
	if (!gainTrace) {
		if (trace.gains.size >= 4) trace.gains.delete(trace.gains.keys().next().value!);
		gainTrace = {bass: [], phase: [0]};
		trace.gains.set(parameters.inputGainDb, gainTrace);
	}
	const endFrame = Math.min(
		parameters.frame,
		Math.ceil(parameters.audioData.durationInSeconds * parameters.fps),
	);
	for (let next = gainTrace.bass.length; next < endFrame; next++) {
		const bass = bassFromSpectrum(
			normalizedSpectrum(trace.magnitudes[next], parameters.inputGainDb),
		);
		gainTrace.bass.push(bass);
		// Accumulate previous-frame bass in Float32 for stable GPU phase values.
		gainTrace.phase.push(Math.fround(gainTrace.phase[next] + bass));
	}
	return gainTrace.phase[endFrame];
}

type DataTexture = {width: number; height: number; data: Float32Array};
type HistoryInput = {
	audioData: MediaUtilsAudioData;
	dataOffsetInSeconds: number;
	sourceTime: number;
	inputGainDb: number;
	trailDepth: number;
	waveDelay: boolean;
	width?: number;
};

function createHaloHistory(input: HistoryInput) {
	const width = Math.max(1, Math.round(input.width ?? 1280));
	const data = new Float32Array(width * HISTORY_ROWS * 4);
	const headFrame = Math.round(input.sourceTime * ANALYSIS_FPS);
	const parameters = (frame: number): AnalysisParameters => ({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame,
		fps: ANALYSIS_FPS,
		inputGainDb: input.inputGainDb,
	});
	// Build from the latest frame once, then read older rows without replaying FFTs.
	const trace = getAnalysisTrace(parameters(Math.max(0, headFrame)));
	for (let row = 0; row < HISTORY_ROWS; row++) {
		const frame = headFrame - row;
		const rowStart = row * width * 4;
		data[rowStart + 2] = getBassPhase(parameters(frame));
		if (frame < 0 || frame / ANALYSIS_FPS >= input.audioData.durationInSeconds) continue;
		const values = normalizedSpectrum(trace.magnitudes[frame], input.inputGainDb);
		data[rowStart + 1] = bassFromSpectrum(values);
		for (let bar = 0; bar < width; bar++) {
			const position = (bar + 0.5) / width;
			let value = 0;
			for (let step = 0; step < 10; step++) {
				const offset = step * 0.002;
				const right = position + offset;
				value += clamp(
					(sampleFrequency(values, Math.abs(position - offset) * SPECTRUM_SCALE) - 0.8) / 0.2,
					0,
					1,
				);
				value += clamp(
					(sampleFrequency(values, (right < 1 ? right : 2 - right) * SPECTRUM_SCALE) - 0.8) / 0.2,
					0,
					1,
				);
			}
			data[rowStart + bar * 4] = value / 20;
		}
	}
	return {
		bass: getHaloSourceBass(parameters(headFrame)),
		history: {width, height: HISTORY_ROWS, data} satisfies DataTexture,
	};
}

type HaloFrame = Omit<
	Required<HaloOptions>,
	'audioSrc' | 'audioOffsetInSeconds' | 'playAudio' | 'inputGainDb' | 'artworkSrc'
> & {
	readonly sourceTime: number;
	readonly history: DataTexture;
	readonly bass: number;
	readonly image: HTMLImageElement | null;
};

type HaloState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly historyTexture: WebGLTexture;
	readonly artworkTexture: WebGLTexture;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};

function setupHalo(canvas: HTMLCanvasElement): HaloState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Halo requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Halo could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let historyTexture: WebGLTexture | null = null;
	let artworkTexture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, haloVertex],
			[gl.FRAGMENT_SHADER, haloFragment],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Halo could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new Error(`Halo shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`Halo shader linking failed: ${gl.getProgramInfoLog(program)}`);
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Halo could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const position = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		historyTexture = gl.createTexture();
		if (!historyTexture) throw new Error('Halo could not create a history texture.');
		artworkTexture = gl.createTexture();
		if (!artworkTexture) throw new Error('Halo could not create an artwork texture.');
		for (const texture of [historyTexture, artworkTexture]) {
			gl.bindTexture(gl.TEXTURE_2D, texture);
			const filter = texture === historyTexture ? gl.NEAREST : gl.LINEAR;
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		}
		const names = [
			'iGlobalTime',
			'iAspect',
			'iHistoryTexture',
			'iCenterImageTexture',
			'iHasCenterImage',
			'iCenterImageAspectRatio',
			'iColorMode',
			'iStartColor',
			'iEndColor',
			'iLeadingColor',
			'iCenterTint',
			'iTransparentCenter',
			'iRadius',
			'iIntensity',
			'iTrailDepth',
			'iWaveDelay',
			'iMotionBlur',
			'iGlowBlur',
			'iGlowSpread',
		];
		return {
			gl,
			program,
			buffer,
			historyTexture,
			artworkTexture,
			uniforms: Object.fromEntries(
				names.map((name) => [name, gl.getUniformLocation(program, name)]),
			),
		};
	} catch (error) {
		gl.deleteTexture(historyTexture);
		gl.deleteTexture(artworkTexture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function drawHalo(
	{gl, program, historyTexture, artworkTexture, uniforms}: HaloState,
	frame: HaloFrame,
) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	for (const [name, value] of Object.entries({
		iGlobalTime: frame.sourceTime,
		iAspect: frame.width / frame.height,
		iRadius: frame.radius,
		iIntensity: frame.intensity,
		iTrailDepth: frame.trailDepth,
		iWaveDelay: Number(frame.waveDelay),
		iMotionBlur: Number(frame.motionBlur),
		iGlowBlur: frame.glowBlur,
		iGlowSpread: frame.glowSpread,
		iHasCenterImage: Number(Boolean(frame.image) && frame.centerMode !== 'transparent'),
		iCenterImageAspectRatio: frame.image ? frame.image.naturalWidth / frame.image.naturalHeight : 1,
	}))
		gl.uniform1f(uniforms[name], value);
	gl.uniform1i(uniforms.iColorMode, frame.colorMode === 'rainbow' ? 1 : 0);
	gl.uniform1i(uniforms.iTransparentCenter, Number(frame.centerMode === 'transparent'));
	gl.uniform3fv(uniforms.iStartColor, displayColor(frame.startColor));
	gl.uniform3fv(uniforms.iEndColor, displayColor(frame.endColor));
	gl.uniform3fv(uniforms.iLeadingColor, displayColor(resolveLeadingColor(frame)));
	gl.uniform3fv(
		uniforms.iCenterTint,
		centerTint(frame.centerColor ?? haloSchema.centerColor.default),
	);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, historyTexture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA32F,
		frame.history.width,
		frame.history.height,
		0,
		gl.RGBA,
		gl.FLOAT,
		frame.history.data,
	);
	gl.uniform1i(uniforms.iHistoryTexture, 0);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, artworkTexture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Boolean(frame.image));
	if (frame.image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame.image);
	else
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
	gl.uniform1i(uniforms.iCenterImageTexture, 1);
	gl.disable(gl.BLEND);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Halo WebGL draw failed: ${error}`);
}

function cleanupHalo({gl, program, buffer, historyTexture, artworkTexture}: HaloState) {
	gl.deleteTexture(historyTexture);
	gl.deleteTexture(artworkTexture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function HaloCanvas(frame: HaloFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<HaloState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupHalo(canvas);
		} catch (error) {
			cancelRender(error);
			return;
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Halo WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupHalo(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Halo');
		try {
			drawHalo(state.current, frame);
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

// prettier-ignore
const haloFragment = `#version 300 es
/*
  Free Public License 1.0.0

  Copyright (C) 2018 by tikveel <steven@tikveel.nl>

  Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

  THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING
  ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL,
  DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
  WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE
  USE OR PERFORMANCE OF THIS SOFTWARE.
*/
precision highp float;
precision highp int;
uniform float iGlobalTime;
uniform float iAspect;
uniform sampler2D iHistoryTexture;
uniform sampler2D iCenterImageTexture;
uniform float iCenterImageAspectRatio;
uniform float iHasCenterImage;
uniform int iColorMode;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
uniform vec3 iLeadingColor;
uniform vec3 iCenterTint;
uniform bool iTransparentCenter;
uniform float iRadius;
uniform float iIntensity;
uniform float iTrailDepth;
uniform float iWaveDelay;
uniform float iMotionBlur;
uniform float iGlowBlur;
uniform float iGlowSpread;
in vec2 vUv;
out vec4 outColor;
#define TWO_PI 6.28318530718
#define CIRCLE_BORDER_SIZE 0.008

vec2 rotatePoint(vec2 point, float angle) {
  float sine = sin(angle), cosine = cos(angle);
  return point * mat2(cosine, sine, -sine, cosine);
}

// The visible radius is twice the radius parameter.
float sourceCircle(float distanceFromCenter, float radius, float smoothness) {
  float halfSmoothness = smoothness * 0.5;
  return 1.0 - smoothstep(radius - halfSmoothness, radius + halfSmoothness, distanceFromCenter - radius);
}

// Premultiplied alpha keeps layered colors and afterglow compositable.
vec4 over(vec4 back, vec4 front) {
  return vec4(front.rgb * front.a + back.rgb * (1.0 - front.a), front.a + back.a * (1.0 - front.a));
}

vec4 spectrumColor(int age) {
  const vec3 colors[9] = vec3[9](
    vec3(1,1,1), vec3(1,1,0), vec3(1,0.5,0), vec3(1,0,0),
    vec3(1,0.2,0.3), vec3(1,0,1), vec3(0,0,1), vec3(0,0.8,1), vec3(0,1,0)
  );
  const float alphas[9] = float[9](1.0, 0.95, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65);
  float position = float(age) / max(iTrailDepth - 1.0, 1.0);
  vec3 color = iColorMode == 1 ? colors[age] : mix(iStartColor, iEndColor, position);
  return vec4(age == 0 ? iLeadingColor : color, alphas[age]);
}

float getFrequency(float x, int row) {
  int width = textureSize(iHistoryTexture, 0).x;
  return texelFetch(iHistoryTexture, ivec2(clamp(int(x * float(width)), 0, width - 1), row), 0).r;
}

vec3 innerCircle(vec2 point, float time) {
  float turn = 1.0 - smoothstep(0.0, 1.0, clamp((fract(time * 0.06) - 0.8) / 0.2, 0.0, 1.0));
  vec2 rotated = rotatePoint(point, TWO_PI * turn);
  vec3 color = mix(vec3(0.0), vec3(0.15), rotated.y * 0.5 + 0.5) + 0.1;
  return mix(color, vec3(0.0), sin(length(rotated) * 80.0) * 0.05) * iCenterTint;
}

vec4 centerImageColor(vec2 point) {
  vec2 uv = point * 0.5 + 0.5;
  if (iCenterImageAspectRatio >= 1.0) uv.x = (uv.x - 0.5) / iCenterImageAspectRatio + 0.5;
  else uv.y = (uv.y - 0.5) * iCenterImageAspectRatio + 0.5;
  return texture(iCenterImageTexture, uv);
}

vec2 shakeAt(float time) { return vec2(sin(time * 9.0), cos(time * 5.0)) * 0.002; }

vec4 renderHalo(vec2 uv, int sampleAge, out float innerMask) {
  innerMask = 0.0;
  float time = iGlobalTime - float(sampleAge) / 60.0;
  vec4 audio = texelFetch(iHistoryTexture, ivec2(0, sampleAge), 0);
  float bass = audio.g, extra = audio.b;
  vec2 point = (uv - 0.5) * vec2(iAspect, 1.0) + shakeAt(time);
  point = rotatePoint(point, sin(time * 1.5 + extra) * 0.005);
  point += vec2(cos(time * 9.0 + extra * 0.3), sin(time * 9.0 + extra * 0.3)) * 0.003;
  float distanceFromCenter = length(point);
  float bassGrowth = bass * 0.03;
  float maximumRadius = min(1.0, iRadius + bassGrowth + 0.07 * iIntensity) * 2.0;
  float glowExtent = iGlowBlur > 0.0 ? iGlowBlur * 0.001 + iGlowSpread * 0.0002 : 0.0;
  if (distanceFromCenter > maximumRadius + glowExtent + 0.004) return vec4(0.0);

  float angle = atan(point.x, point.y) / TWO_PI + 0.5;
  float frequencyX = 1.0 - (angle > 0.5 ? 2.0 - angle * 2.0 : angle * 2.0);
  vec4 result = vec4(0.0);
  if (iGlowBlur > 0.0) {
    float radius = min(1.0, iRadius + bassGrowth + getFrequency(frequencyX, sampleAge) * 0.07 * iIntensity);
    float distanceToEdge = max(0.0, abs(distanceFromCenter - radius * 2.0) - iGlowSpread * 0.0002);
    float glow = 1.0 - smoothstep(0.004, max(0.0041, iGlowBlur * 0.001), distanceToEdge);
    result = over(result, vec4(spectrumColor(0).rgb, glow * 0.35));
  }
  for (int age = 8; age >= 0; age--) {
    if (age >= int(iTrailDepth)) continue;
    int row = sampleAge + (iWaveDelay > 0.5 ? age : 0);
    float radius = clamp(iRadius + bassGrowth + getFrequency(frequencyX, row) * 0.07 * iIntensity, iRadius + bassGrowth, 1.0);
    vec4 layer = spectrumColor(age);
    layer.a *= sourceCircle(distanceFromCenter, radius, 0.004 + float(age) * 0.00025);
    result = over(result, layer);
  }
  float innerRadius = max(0.02, iRadius + bassGrowth - CIRCLE_BORDER_SIZE);
  innerMask = sourceCircle(distanceFromCenter, innerRadius, 0.004);
  if (iTransparentCenter) {
    // Cut ALL premultiplied channels, including the spectrum discs and glow.
    result *= 1.0 - innerMask;
  } else if (innerMask > 0.0) {
    result = over(result, vec4(innerCircle(point / innerRadius, time), innerMask));
    if (iHasCenterImage > 0.5) {
      vec4 artwork = centerImageColor(point / (innerRadius * 2.0));
      artwork.a *= innerMask;
      result = over(result, artwork);
    }
  }
  result.rgb += bass * 0.05 * result.a;
  result.rgb *= smoothstep(0.0, 1.0, 1.7 - length(point));
  return result;
}

void main() {
  // Evaluate 0.8*current + 0.2*previous without persistent GPU state.
  // Six shifted samples approximate temporal blur; discarded weight is 0.2^6.
  vec4 result = vec4(0.0);
  vec2 uv = vUv;
  float weight = 1.0;
  float currentInnerMask = 0.0;
  for (int age = 0; age < ${BLUR_SAMPLES}; age++) {
    float time = iGlobalTime - float(age) / 60.0;
    if (time < 0.0) break;
    float innerMask;
    result += renderHalo(uv, age, innerMask) * weight * (iMotionBlur > 0.5 ? 0.8 : 1.0);
    if (age == 0) currentInnerMask = innerMask;
    if (iMotionBlur < 0.5) break;
    uv += shakeAt(time);
    weight *= 0.2;
  }
  // Old, smaller rings must not leave ghosts inside the current bass-expanded hole.
  if (iTransparentCenter && iMotionBlur > 0.5) result *= 1.0 - currentInnerMask;
  // Colors are already in display RGB; no additional color-space conversion.
  outColor = clamp(result, 0.0, 1.0);
}
`;

const haloVertex = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

function resolveLeadingColor({
	colorMode,
	startColor,
	leadingColor,
}: Pick<HaloOptions, 'colorMode' | 'startColor' | 'leadingColor'>) {
	return (
		leadingColor ??
		(colorMode === 'gradient' ? (startColor ?? haloSchema.startColor.default) : '#ffffff')
	);
}

function centerTint(color: string) {
	// Neutral charcoal maps to exactly 1, preserving the default shading.
	// Scale the existing lighting/lines, not the artwork sampled above the disc.
	return displayColor(color).map((channel) => channel / (45 / 255));
}

const colorCache = new Map<string, number[]>();
let colorParser: CanvasRenderingContext2D | null = null;
function displayColor(color: string): number[] {
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
	const result = bytes.map((byte) => byte / 255);
	if (colorCache.size >= 64) colorCache.clear();
	colorCache.set(color, result);
	return result;
}

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: ANALYSIS_SAMPLE_RATE,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const HaloContent: React.FC<Required<HaloOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	// Full audio is required for source-start bass accumulation when seeking.
	// useAudioData holds rendering until decoding completes; FFT traces grow lazily.
	const audioData = useAudioData(props.audioSrc, {sampleRate: ANALYSIS_SAMPLE_RATE});
	const image = useArtwork(props.centerMode === 'transparent' ? '' : props.artworkSrc);
	const trailDepth = clamp(Math.round(props.trailDepth), 1, 9);
	const data = useMemo(
		() =>
			createHaloHistory({
				audioData: audioData ?? silentAudio,
				dataOffsetInSeconds: 0,
				sourceTime,
				inputGainDb: props.inputGainDb,
				trailDepth,
				waveDelay: props.waveDelay,
				width: props.width,
			}),
		[audioData, sourceTime, props.inputGainDb, trailDepth, props.waveDelay, props.width],
	);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<HaloCanvas
				{...props}
				sourceTime={sourceTime}
				history={data.history}
				bass={data.bass}
				image={image}
				trailDepth={trailDepth}
			/>
		</>
	);
};

const HaloInner = forwardRef<
	HTMLDivElement,
	HaloProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = haloSchema.width.default,
			height = haloSchema.height.default,
			audioSrc = haloSchema.audioSrc.default,
			audioOffsetInSeconds = haloSchema.audioOffsetInSeconds.default,
			playAudio = haloSchema.playAudio.default,
			inputGainDb = haloSchema.inputGainDb.default,
			intensity = haloSchema.intensity.default,
			colorMode = haloSchema.colorMode.default,
			startColor = haloSchema.startColor.default,
			endColor = haloSchema.endColor.default,
			leadingColor,
			centerColor = haloSchema.centerColor.default,
			centerMode = haloSchema.centerMode.default,
			radius = haloSchema.radius.default,
			trailDepth = haloSchema.trailDepth.default,
			waveDelay = haloSchema.waveDelay.default,
			motionBlur = haloSchema.motionBlur.default,
			glowBlur = haloSchema.glowBlur.default,
			glowSpread = haloSchema.glowSpread.default,
			artworkSrc = haloSchema.artworkSrc.default,
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
				name={name ?? 'Halo'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{boxSizing: 'border-box', width, height, overflow: 'hidden', ...style}}
				>
					<HaloContent
						key={`${audioSrc}-${artworkSrc}`}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						intensity={intensity}
						colorMode={colorMode}
						startColor={startColor}
						endColor={endColor}
						leadingColor={resolveLeadingColor({colorMode, startColor, leadingColor})}
						centerColor={centerColor}
						centerMode={centerMode}
						radius={radius}
						trailDepth={trailDepth}
						waveDelay={waveDelay}
						motionBlur={motionBlur}
						glowBlur={glowBlur}
						glowSpread={glowSpread}
						artworkSrc={artworkSrc}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Halo = Interactive.withSchema({
	Component: HaloInner,
	componentName: '<Halo>',
	componentIdentity: null,
	schema: haloSchema,
	supportsEffects: false,
}) as React.FC<HaloProps>;
