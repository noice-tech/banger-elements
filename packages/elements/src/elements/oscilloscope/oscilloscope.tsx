import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {forwardRef, useRef, useImperativeHandle, useLayoutEffect} from 'react';
import {
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

type OscilloscopeOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly amplitude?: number;
	readonly lineColor?: string;
	readonly lineWidth?: number;
	readonly sampleCount?: number;
	readonly timeSpanMs?: number;
	readonly displayMode?: 'pitch' | 'single-cycle' | 'free';
};

type OscilloscopeProps = InteractiveBaseProps & InteractiveTransformProps & OscilloscopeOptions;

const oscilloscopeSchema = {
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
	lineColor: {type: 'color', default: '#51e8cc', description: 'Line color'},
	lineWidth: {
		type: 'number',
		default: 3,
		min: 0.5,
		max: 10,
		step: 0.5,
		description: 'Line width',
		hiddenFromList: false,
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
	amplitude: {
		type: 'number',
		default: 1,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Amplitude',
		hiddenFromList: false,
	},
	sampleCount: {
		type: 'number',
		default: 1024,
		min: 256,
		max: 4096,
		step: 256,
		description: 'Trace resolution (independent of time span)',
		hiddenFromList: false,
		keyframable: false,
	},
	timeSpanMs: {
		type: 'number',
		default: 46.4,
		min: 5,
		max: 200,
		step: 0.1,
		description: 'Visible time span in milliseconds (pitch and free modes)',
		hiddenFromList: false,
	},
	displayMode: {
		type: 'enum',
		default: 'pitch',
		description: 'Trigger mode',
		variants: {pitch: {}, 'single-cycle': {}, free: {}},
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
	const {audioData} = result;
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

const DETECTOR_RATE = 4000;
const FILTER_RADIUS = 32;
const CUTOFF = 300 / DETECTOR_RATE;
const detectorFilter = Float64Array.from({length: FILTER_RADIUS * 2 + 1}, (_, i) => {
	const x = i - FILTER_RADIUS;
	const sinc = x === 0 ? 2 * CUTOFF : Math.sin(2 * Math.PI * CUTOFF * x) / (Math.PI * x);
	return sinc * (0.5 + 0.5 * Math.cos((Math.PI * x) / FILTER_RADIUS));
});
const filterSum = detectorFilter.reduce((sum, value) => sum + value, 0);
for (let i = 0; i < detectorFilter.length; i++) detectorFilter[i] /= filterSum;

// Source-anchored triggering.
function findPitchWindow(
	waveform: Float32Array,
	sampleRate: number,
	dataOffsetInSeconds: number,
	anchor: number,
	singleCycle: boolean,
) {
	const detectorEnd = Math.floor(anchor * DETECTOR_RATE);
	const detectorStart = detectorEnd - Math.ceil(0.093 * DETECTOR_RATE);
	const length = detectorEnd - detectorStart + 1;
	const raw = new Float64Array(length + FILTER_RADIUS * 2);
	for (let i = 0; i < raw.length; i++) {
		const tick = detectorStart - FILTER_RADIUS + i;
		const start = Math.round((tick / DETECTOR_RATE - dataOffsetInSeconds) * sampleRate);
		const end = Math.max(
			start + 1,
			Math.round(((tick + 1) / DETECTOR_RATE - dataOffsetInSeconds) * sampleRate),
		);
		let sum = 0;
		for (let j = start; j < end; j++) sum += waveform[j] ?? 0;
		raw[i] = sum / (end - start);
	}
	const detector = new Float64Array(length);
	let rawMin = Infinity,
		rawMax = -Infinity,
		filteredMin = Infinity,
		filteredMax = -Infinity;
	for (let i = 0; i < length; i++) {
		for (let tap = 0; tap < detectorFilter.length; tap++)
			detector[i] += raw[i + tap] * detectorFilter[tap];
		filteredMin = Math.min(filteredMin, detector[i]);
		filteredMax = Math.max(filteredMax, detector[i]);
		rawMin = Math.min(rawMin, raw[i + FILTER_RADIUS]);
		rawMax = Math.max(rawMax, raw[i + FILTER_RADIUS]);
	}
	if (filteredMax - filteredMin < (rawMax - rawMin) * 0.02) {
		detector.set(raw.subarray(FILTER_RADIUS, FILTER_RADIUS + length));
		filteredMin = rawMin;
		filteredMax = rawMax;
	}
	const center = (filteredMin + filteredMax) / 2;
	const hysteresis = (filteredMax - filteredMin) * 0.05;
	let armed = false,
		startTime = anchor;
	if (filteredMax - filteredMin > 0.00001) {
		for (let i = 1; i < length; i++) {
			const previous = detector[i - 1] - center,
				current = detector[i] - center;
			if (previous < -hysteresis) armed = true;
			if (armed && previous <= 0 && current > 0) {
				startTime = (detectorStart + i - 1 - previous / (current - previous) + 0.5) / DETECTOR_RATE;
				armed = false;
			}
		}
	}
	let period: number | undefined;
	if (singleCycle && rawMax - rawMin > 0.00001) {
		const maxLag = Math.ceil(DETECTOR_RATE / 40),
			minLag = Math.floor(DETECTOR_RATE / 1000);
		const scores = new Float64Array(maxLag + 2);
		let cumulativeDifference = 0;
		for (let lag = 1; lag <= maxLag + 1; lag++) {
			let difference = 0;
			for (let i = maxLag + 1; i < length; i++) {
				const delta = raw[i + FILTER_RADIUS] - raw[i + FILTER_RADIUS - lag];
				difference += delta * delta;
			}
			cumulativeDifference += difference;
			scores[lag] = cumulativeDifference > 1e-12 ? (difference * lag) / cumulativeDifference : 1;
		}
		for (let lag = minLag; lag <= maxLag; lag++) {
			const left = scores[lag - 1],
				middle = scores[lag],
				right = scores[lag + 1];
			if (middle >= left || middle > right) continue;
			const curvature = left - 2 * middle + right;
			const offset =
				curvature > 1e-12 ? Math.max(-0.5, Math.min(0.5, (left - right) / (2 * curvature))) : 0;
			if (middle - ((left - right) * offset) / 4 < 0.12) {
				const candidatePeriod = (lag + offset) / DETECTOR_RATE;
				let difference = 0,
					sumA = 0,
					sumB = 0,
					energy = 0,
					count = 0;
				for (let i = maxLag + 1; i < length; i++) {
					const position =
						((detectorStart + i + 0.5) / DETECTOR_RATE - dataOffsetInSeconds) * sampleRate;
					const delayed = position - candidatePeriod * sampleRate;
					const indexA = Math.floor(position),
						indexB = Math.floor(delayed);
					const a0 = waveform[indexA] ?? 0,
						b0 = waveform[indexB] ?? 0;
					const a = a0 + ((waveform[indexA + 1] ?? 0) - a0) * (position - indexA);
					const b = b0 + ((waveform[indexB + 1] ?? 0) - b0) * (delayed - indexB);
					difference += (a - b) ** 2;
					sumA += a;
					sumB += b;
					energy += a * a + b * b;
					count++;
				}
				const centeredEnergy = energy - (sumA * sumA + sumB * sumB) / count;
				if (centeredEnergy > 1e-8 && difference / centeredEnergy < 0.03) {
					period = candidatePeriod;
					break;
				}
			}
		}
	}
	return {startTime, period};
}

function getOscilloscopeSamples({
	waveform,
	sampleRate,
	timeInSeconds,
	dataOffsetInSeconds = 0,
	timeSpanMs = 46.4,
	displayMode = 'pitch',
	sampleCount,
}: {
	waveform: Float32Array;
	sampleRate: number;
	timeInSeconds: number;
	dataOffsetInSeconds?: number;
	timeSpanMs?: number;
	displayMode?: 'pitch' | 'single-cycle' | 'free';
	sampleCount: number;
}) {
	const samples = new Float32Array(sampleCount);
	const localTime = timeInSeconds - dataOffsetInSeconds;
	if (sampleRate <= 0 || localTime < 0 || localTime * sampleRate >= waveform.length) return samples;
	let duration =
		displayMode === 'single-cycle' ? 0.0464 : Math.min(200, Math.max(5, timeSpanMs)) / 1000;
	let startTime = timeInSeconds - duration / 2;
	if (displayMode !== 'free') {
		const window = findPitchWindow(
			waveform,
			sampleRate,
			dataOffsetInSeconds,
			startTime,
			displayMode === 'single-cycle',
		);
		startTime = window.startTime;
		duration = window.period ?? duration;
	}
	for (let i = 0; i < sampleCount; i++) {
		const position =
			(startTime + (duration * i) / Math.max(1, sampleCount - 1) - dataOffsetInSeconds) *
			sampleRate;
		const index = Math.floor(position),
			fraction = position - index;
		const a = waveform[index] ?? 0,
			b = waveform[index + 1] ?? 0;
		samples[i] = a + (b - a) * fraction;
	}
	return samples;
}

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const OscilloscopeContent: React.FC<Required<OscilloscopeOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const data = audioData ?? silentAudio;
	const samples = getOscilloscopeSamples({
		waveform: data.channelWaveforms[0],
		sampleRate: data.sampleRate,
		timeInSeconds: sourceTime,
		dataOffsetInSeconds,
		sampleCount: Math.round(Math.max(256, Math.min(4096, props.sampleCount))),
		timeSpanMs: props.timeSpanMs,
		displayMode: props.displayMode,
	});
	const gain = 10 ** (props.inputGainDb / 20);
	const path = Array.from(
		samples,
		(sample, index) =>
			`${index === 0 ? 'M' : 'L'}${(index / (samples.length - 1)) * props.width},${props.height / 2 - sample * gain * props.amplitude * props.height * 0.4}`,
	).join(' ');
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<svg
				width={props.width}
				height={props.height}
				viewBox={`0 0 ${props.width} ${props.height}`}
				style={{width: '100%', height: '100%', overflow: 'hidden'}}
			>
				<path
					d={path}
					stroke="#050609"
					strokeOpacity={0.6}
					strokeWidth={props.lineWidth + 2}
					fill="none"
				/>
				<path
					d={path}
					stroke={props.lineColor}
					strokeWidth={props.lineWidth}
					strokeLinejoin="round"
					fill="none"
				/>
			</svg>
		</>
	);
};

const OscilloscopeInner = forwardRef<
	HTMLDivElement,
	OscilloscopeProps & {
		readonly controls: SequenceControls | undefined;
	}
>(
	(
		{
			width = oscilloscopeSchema.width.default,
			height = oscilloscopeSchema.height.default,
			audioSrc = oscilloscopeSchema.audioSrc.default,
			audioOffsetInSeconds = oscilloscopeSchema.audioOffsetInSeconds.default,
			playAudio = oscilloscopeSchema.playAudio.default,
			inputGainDb = oscilloscopeSchema.inputGainDb.default,
			amplitude = oscilloscopeSchema.amplitude.default,
			lineColor = oscilloscopeSchema.lineColor.default,
			lineWidth = oscilloscopeSchema.lineWidth.default,
			sampleCount = oscilloscopeSchema.sampleCount.default,
			timeSpanMs = oscilloscopeSchema.timeSpanMs.default,
			displayMode = oscilloscopeSchema.displayMode.default,
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
				name={name ?? 'Oscilloscope'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						boxSizing: 'border-box',
						width,
						height,
						overflow: 'hidden',
						...style,
					}}
				>
					<OscilloscopeContent
						key={audioSrc}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						amplitude={amplitude}
						lineColor={lineColor}
						lineWidth={lineWidth}
						sampleCount={sampleCount}
						timeSpanMs={timeSpanMs}
						displayMode={displayMode}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Oscilloscope = Interactive.withSchema({
	Component: OscilloscopeInner,
	componentName: '<Oscilloscope>',
	componentIdentity: null,
	schema: oscilloscopeSchema,
	supportsEffects: false,
}) as React.FC<OscilloscopeProps>;
