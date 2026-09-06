import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
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
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type SequenceControls,
	type InteractivitySchema,
} from 'remotion';

type WaveformOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly color?: string;
	readonly windowInSeconds?: number;
};

type WaveformProps = InteractiveBaseProps & InteractiveTransformProps & WaveformOptions;

const DEFAULT_AUDIO_SRC = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_AUDIO_OFFSET = 0;
const DEFAULT_PLAY_AUDIO = true;
const DEFAULT_INPUT_GAIN_DB = 0;
const DEFAULT_INTENSITY = 1;
const DEFAULT_COLOR = '#aa8bff';
const DEFAULT_WINDOW_SECONDS = 2;

const waveformSchema = {
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
	color: {type: 'color', default: DEFAULT_COLOR, description: 'Waveform color'},
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
		description: 'Amplitude',
		hiddenFromList: false,
	},
	windowInSeconds: {
		type: 'number',
		default: DEFAULT_WINDOW_SECONDS,
		min: 0.1,
		max: 5,
		step: 0.1,
		description: 'Visible time window',
		hiddenFromList: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

// Fixed decode chunks are independent of the visible waveform window.
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

function useVisualizerAudio(src: string, time: number, fps: number, windowInSeconds: number) {
	// media-utils returns null once its requested time reaches the audio end.
	// Keep requesting the visible history until the tail has left the viewport.
	// Unlike retaining the last buffer, this also works on a direct seek.
	const analysisTime = Math.max(0, time - windowInSeconds / 2);
	const result = useWindowedAudioData({
		src,
		frame: analysisTime * fps,
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
				? {...result.audioData, resultId: `${instanceId}:${revision.current++}`}
				: null,
		[result.audioData, instanceId],
	);
	// The hook can publish the current chunk before its retained neighbors.
	const complete =
		audioData === null ||
		hasCompleteAudioWindow(audioData, result.dataOffsetInSeconds, analysisTime);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		if (complete) return;
		const handle = delayRender('Waiting for complete visualizer audio history');
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return {...result, audioData: complete ? audioData : null};
}

function waveformPath({
	audioData,
	dataOffsetInSeconds,
	sourceTime,
	width,
	height,
	inputGainDb,
	intensity,
	windowInSeconds,
}: {
	readonly audioData: MediaUtilsAudioData;
	readonly dataOffsetInSeconds: number;
	readonly sourceTime: number;
	readonly width: number;
	readonly height: number;
	readonly inputGainDb: number;
	readonly intensity: number;
	readonly windowInSeconds: number;
}) {
	const gain = 10 ** (inputGainDb / 20);
	const {sampleRate, durationInSeconds} = audioData;
	const waveform = audioData.channelWaveforms[0];
	const startSample = (sourceTime - windowInSeconds / 2) * sampleRate;
	const windowSamples = windowInSeconds * sampleRate;
	// Anchor complete bins to the source timeline, not the moving viewport.
	// Only their x coordinates change during playback. Include an extra point
	// on either side so SVG clipping preserves smooth motion at the edges.
	const binSize = Math.max(1, Math.floor(windowSamples / 2048));
	const firstBin = Math.floor(startSample / binSize) - 1;
	const lastBin = Math.ceil((startSample + windowSamples) / binSize);
	const bufferStart = Math.round(dataOffsetInSeconds * sampleRate);
	const sourceEnd = Math.round(durationInSeconds * sampleRate);
	const values = Array.from({length: lastBin - firstBin + 1}, (_, index) => {
		const binStart = (firstBin + index) * binSize;
		const end = Math.min(binStart + binSize, sourceEnd, bufferStart + waveform.length);
		let sum = 0;
		for (let sample = Math.max(0, binStart, bufferStart); sample < end; sample++) {
			sum += Math.abs(waveform[sample - bufferStart]);
		}
		return {
			x: ((binStart + binSize / 2 - startSample) / windowSamples) * width,
			amplitude: sum / binSize,
		};
	});
	const upper = values.map(
		(sample) =>
			`${sample.x},${height / 2 - Math.max(1, sample.amplitude * gain * intensity * height * 0.38)}`,
	);
	const lower = values
		.map(
			(sample) =>
				`${sample.x},${height / 2 + Math.max(1, sample.amplitude * gain * intensity * height * 0.38)}`,
		)
		.reverse();
	return `M${upper.join(' L')} L${lower.join(' L')} Z`;
}

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const WaveformContent: React.FC<Required<WaveformOptions>> = ({
	width,
	height,
	audioSrc,
	audioOffsetInSeconds,
	playAudio,
	inputGainDb,
	intensity,
	color,
	windowInSeconds,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(
		audioSrc,
		sourceTime,
		fps,
		windowInSeconds,
	);
	const path = waveformPath({
		audioData: audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
		width,
		height,
		inputGainDb,
		intensity,
		windowInSeconds,
	});
	return (
		<>
			{playAudio ? <Audio src={audioSrc} trimBefore={offsetFrames} showInTimeline={false} /> : null}
			<svg
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				style={{width: '100%', height: '100%', overflow: 'hidden'}}
			>
				<path d={path} fill={color} />
			</svg>
		</>
	);
};

const WaveformInner = forwardRef<
	HTMLDivElement,
	WaveformProps & {
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
			color = DEFAULT_COLOR,
			windowInSeconds = DEFAULT_WINDOW_SECONDS,
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
				name={name ?? 'Waveform'}
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
					<WaveformContent
						key={audioSrc}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						intensity={intensity}
						color={color}
						windowInSeconds={windowInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Waveform = Interactive.withSchema({
	Component: WaveformInner,
	componentName: '<Waveform>',
	componentIdentity: null,
	schema: waveformSchema,
	supportsEffects: false,
}) as React.FC<WaveformProps>;
