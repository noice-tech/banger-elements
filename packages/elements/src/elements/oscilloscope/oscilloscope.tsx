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
};

type OscilloscopeProps = InteractiveBaseProps & InteractiveTransformProps & OscilloscopeOptions;
const ANALYSIS_FPS = 60;

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
		max: 2048,
		step: 256,
		description: 'PCM samples',
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

function triggeredSamples(
	audioData: MediaUtilsAudioData,
	time: number,
	fps: number,
	count: number,
	dataOffsetInSeconds: number,
) {
	const samples = new Float32Array(count);
	if (time < 0 || time >= audioData.durationInSeconds) return samples;
	const waveform = audioData.channelWaveforms[0];
	const start = Math.floor((time - dataOffsetInSeconds) * audioData.sampleRate);
	let trigger = Math.max(0, start - Math.floor(Math.min(audioData.sampleRate / fps, 4096) / 2));
	for (let i = trigger; i < start; i++) {
		if (i > 0 && waveform[i - 1] < 0 && waveform[i] >= 0) {
			trigger = i;
			break;
		}
	}
	for (let i = 0; i < count; i++) samples[i] = waveform[trigger + i] ?? 0;
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
	const samples = triggeredSamples(
		audioData ?? silentAudio,
		sourceTime,
		ANALYSIS_FPS,
		props.sampleCount,
		dataOffsetInSeconds,
	);
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
