import {Audio} from '@remotion/media';
import {useWindowedAudioData, type MediaUtilsAudioData} from '@remotion/media-utils';
import React, {useLayoutEffect, useMemo} from 'react';
import {
	Interactive,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	type InteractiveTransformProps,
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
	readonly colorMode?: 'solid' | 'frequency';
	readonly resolution?: number;
};

type WaveformProps = InteractiveTransformProps & WaveformOptions;

const DEFAULT_AUDIO_SRC = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3';
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_AUDIO_OFFSET = 0;
const DEFAULT_PLAY_AUDIO = true;
const DEFAULT_INPUT_GAIN_DB = 0;
const DEFAULT_INTENSITY = 1;
const DEFAULT_COLOR = '#aa8bff';
const DEFAULT_WINDOW_SECONDS = 2;

const colorField = {type: 'color', default: DEFAULT_COLOR, description: 'Waveform color'} as const;

const waveformSchema = {
	audioSrc: {
		type: 'asset',
		assetType: 'audio',
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
	colorMode: {
		type: 'enum',
		default: 'solid',
		description: 'Waveform colors',
		variants: {
			solid: {
				color: colorField,
			},
			frequency: {},
		},
	},
	resolution: {
		type: 'number',
		default: 1,
		min: 1,
		max: 16,
		step: 1,
		description: 'Resolution multiplier',
		hiddenFromList: false,
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

function useVisualizerAudio(src: string, time: number, fps: number, windowInSeconds: number) {
	const analysisTime = Math.max(0, time - windowInSeconds / 2);
	const result = useWindowedAudioData({
		src,
		frame: analysisTime * fps,
		fps,
		windowInSeconds: decodeWindowSeconds,
	});
	const {audioData} = result;
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
	resolution = 1,
}: {
	readonly resolution?: number;
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
	const binSize = Math.max(
		1,
		Math.floor(windowSamples / (2048 * Math.max(1, Math.min(16, resolution)))),
	);
	const firstBin = Math.floor(startSample / binSize) - 1;
	const lastBin = Math.ceil((startSample + windowSamples) / binSize);
	const bufferStart = Math.round(dataOffsetInSeconds * sampleRate);
	const sourceEnd = Math.round(durationInSeconds * sampleRate);
	const values = Array.from({length: lastBin - firstBin + 1}, (_, index) => {
		const binStart = (firstBin + index) * binSize;
		const end = Math.min(binStart + binSize, sourceEnd, bufferStart + waveform.length);
		let min = 0,
			max = 0;
		for (let sample = Math.max(0, binStart, bufferStart); sample < end; sample++) {
			const raw = waveform[sample - bufferStart];
			const value = Number.isFinite(raw) ? raw : 0;
			min = Math.min(min, value);
			max = Math.max(max, value);
		}
		return {
			x: ((binStart + binSize / 2 - startSample) / windowSamples) * width,
			min,
			max,
		};
	});
	const upper = values.map(
		(sample) =>
			`${sample.x},${height / 2 - Math.max(1, sample.max * gain * intensity * height * 0.38)}`,
	);
	const lower = values
		.map(
			(sample) =>
				`${sample.x},${height / 2 + Math.max(1, -sample.min * gain * intensity * height * 0.38)}`,
		)
		.reverse();
	return `M${upper.join(' L')} L${lower.join(' L')} Z`;
}

function createFrequencyColors(waveform: Float32Array, sampleRate: number, offset: number) {
	const cache = new Map<number, Float32Array>();
	return (time: number) => {
		const second = Math.floor(time);
		let colors = cache.get(second);
		if (!colors) {
			const filters = [
				{frequency: 200, highpass: false},
				{frequency: 200, highpass: true},
				{frequency: 2000, highpass: false},
				{frequency: 2000, highpass: true},
			].map(({frequency, highpass}) => {
				const omega = (2 * Math.PI * Math.min(frequency, sampleRate * 0.45)) / sampleRate;
				const cosine = Math.cos(omega),
					alpha = Math.sin(omega) / (2 * Math.SQRT1_2),
					a0 = 1 + alpha;
				const b0 = (highpass ? 1 + cosine : 1 - cosine) / (2 * a0);
				return {
					b0,
					b1: (highpass ? -2 : 2) * b0,
					b2: b0,
					a1: (-2 * cosine) / a0,
					a2: (1 - alpha) / a0,
					z1: 0,
					z2: 0,
				};
			});
			colors = new Float32Array(3000);
			const energy = [0, 0, 0],
				bands = [0, 0, 0];
			const smoothing = 1 - Math.exp(-1 / (sampleRate * 0.015));
			for (let tick = -100; tick < 1000; tick++) {
				const from = Math.round((second + tick / 1000 - offset) * sampleRate);
				const to = Math.round((second + (tick + 1) / 1000 - offset) * sampleRate);
				for (let i = from; i < to; i++) {
					const raw = waveform[i] ?? 0,
						input = Number.isFinite(raw) ? raw : 0;
					let midInput = input;
					for (let f = 0; f < filters.length; f++) {
						const filter = filters[f],
							x = f === 2 ? midInput : input,
							y = filter.b0 * x + filter.z1;
						filter.z1 = filter.b1 * x - filter.a1 * y + filter.z2;
						filter.z2 = filter.b2 * x - filter.a2 * y;
						if (f === 1) midInput = y;
						else bands[f === 0 ? 0 : f - 1] = y;
					}
					for (let band = 0; band < 3; band++)
						energy[band] += smoothing * (bands[band] ** 2 - energy[band]);
				}
				if (tick < 0) continue;
				const loudest = Math.sqrt(Math.max(...energy));
				for (let band = 0; band < 3; band++)
					colors[tick * 3 + band] =
						loudest > 1e-8 ? Math.sqrt(Math.max(0, energy[band])) / loudest : 1;
			}
			if (cache.size >= 8) cache.delete(cache.keys().next().value!);
			cache.set(second, colors);
		}
		const index = Math.min(999, Math.floor((time - second) * 1000)) * 3;
		return `rgb(${[0, 1, 2].map((band) => Math.round(colors![index + band] * 255)).join(',')})`;
	};
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
	colorMode,
	resolution,
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
	const data = audioData ?? silentAudio;
	const frequencyColor = useMemo(
		() => createFrequencyColors(data.channelWaveforms[0], data.sampleRate, dataOffsetInSeconds),
		[data, dataOffsetInSeconds],
	);
	const gradientId = React.useId().replace(/:/g, '');
	const colorStops = Math.max(2, Math.ceil(width / 2));
	const path = waveformPath({
		audioData: audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
		width,
		height,
		inputGainDb,
		intensity,
		windowInSeconds,
		resolution,
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
				{colorMode === 'frequency' ? (
					<defs>
						<linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0" colorInterpolation="sRGB">
							{Array.from({length: colorStops}, (_, i) => (
								<stop
									key={i}
									offset={i / (colorStops - 1)}
									stopColor={frequencyColor(
										sourceTime - windowInSeconds / 2 + (windowInSeconds * i) / (colorStops - 1),
									)}
								/>
							))}
						</linearGradient>
					</defs>
				) : null}
				<path d={path} fill={colorMode === 'frequency' ? `url(#${gradientId})` : color} />
			</svg>
		</>
	);
};

const WaveformInner: React.FC<WaveformProps> = ({
	width = DEFAULT_WIDTH,
	height = DEFAULT_HEIGHT,
	audioSrc = DEFAULT_AUDIO_SRC,
	audioOffsetInSeconds = DEFAULT_AUDIO_OFFSET,
	playAudio = DEFAULT_PLAY_AUDIO,
	inputGainDb = DEFAULT_INPUT_GAIN_DB,
	intensity = DEFAULT_INTENSITY,
	color = DEFAULT_COLOR,
	windowInSeconds = DEFAULT_WINDOW_SECONDS,
	colorMode = waveformSchema.colorMode.default,
	resolution = waveformSchema.resolution.default,
	style,
}) => {
	return (
		<div
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
				colorMode={colorMode}
				resolution={resolution}
			/>
		</div>
	);
};

export const Waveform = Interactive.create({
	Component: WaveformInner,
	componentName: '<Waveform>',
	schema: waveformSchema,
});
