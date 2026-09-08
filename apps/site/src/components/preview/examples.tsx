import {AbsoluteFill} from 'remotion';
import type {ComponentProps, ComponentType} from 'react';
import type {Control} from './controls';
import type {PreviewProps as Props} from './types';
import {range, color, select, booleanControl, numberControl} from './controls';
import {
	Waveform,
	Spectre,
	Oscilloscope,
	Pulsar,
	Circle,
	Halo,
	AudioParticles,
	Ferrofluid,
	Trip,
} from '../../../../../packages/elements/dist/components';

type PreviewExample<C extends ComponentType<Props>> = {
	component: C;
	width: number;
	height: number;
	props: Partial<ComponentProps<C>>;
	controls: readonly Control<Extract<keyof ComponentProps<C>, string>>[];
};

const DEFAULT_AUDIO = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3';
const HALO_AUDIO =
	'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-music-visualization/public/demo-track.mp3';
const AUDIO_PARTICLES_AUDIO =
	'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-recorder/public/sounds/utope-rhythmic-reverie.mp3';
const colorMode = select('colorMode', 'Color mode', [
	{value: 'gradient', label: 'Gradient'},
	{value: 'rainbow', label: 'Rainbow'},
]);
const gain = range('inputGainDb', 'Visual gain', -30, 30, 1);
const intensity = range('intensity', 'Intensity', 0.1, 10, 0.1);

const HaloAndParticles = (props: Props) => {
	const audioSrc = String(props.audioSrc ?? AUDIO_PARTICLES_AUDIO);
	const audioOffsetInSeconds = Number(props.audioOffsetInSeconds ?? 0);
	return (
		<AbsoluteFill style={{backgroundColor: '#080a10'}}>
			<AbsoluteFill>
				<Halo
					audioSrc={audioSrc}
					audioOffsetInSeconds={audioOffsetInSeconds}
					playAudio={Boolean(props.playAudio ?? true)}
					intensity={1}
					inputGainDb={0}
					radius={0.12}
					trailDepth={9}
				/>
			</AbsoluteFill>
			<AbsoluteFill>
				<AudioParticles
					audioSrc={audioSrc}
					audioOffsetInSeconds={audioOffsetInSeconds}
					playAudio={false}
					width={1280}
					height={720}
					maskHalo
					inputGainDb={0}
					intensity={1}
					radius={0.12}
					density={45}
					size={1.5}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
export const examples = {
	trip: {
		component: Trip,
		width: 1280,
		height: 720,
		props: {
			baseColor: '#ff00ff',
			intensifyColor: '#9333ea',
			thickness: 1,
			pattern: 0.7,
			intensity: 10,
			bpm: 120,
			timeOffsetInSeconds: 0,
			inputGainDb: 0,
		},
		controls: [
			color('baseColor', 'Base color'),
			color('intensifyColor', 'Intensify color'),
			// A native range with min 0.01 / step 0.05 silently snaps the source default 1 to 1.01.
			range('thickness', 'Thickness', 0.01, 1.5, 0.01),
			range('pattern', 'Pattern', 0.7, 9, 0.25),
			range('intensity', 'Raymarch intensity', 0, 25, 0.5),
			range('bpm', 'Tempo (BPM)', 1, 300, 1),
			numberControl('timeOffsetInSeconds', 'Animation offset (s)', 0, 86400, 0.01),
			gain,
		],
	} satisfies PreviewExample<typeof Trip>,
	ferrofluid: {
		component: Ferrofluid,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 10,
			intensity: 2,
			pattern: 2,
			fluidity: 0.15,
			color: '#161923',
			shineColor: '#ffbc8e',
			shineX: -0.3,
			shineY: -1,
			shineZ: -0.5,
			shineIntensity: 2.6,
			shineSize: 1,
			roughness: 0.15,
			iridescence: 0.3,
			envMapIntensity: 1,
			audioLights: true,
			quality: 'medium',
			mappingMode: 'uniform',
			autoRotate: true,
			rotationSpeed: 1,
		},
		controls: [
			color('color', 'Metal tint'),
			color('shineColor', 'Shine color'),
			range('shineX', 'Shine X', -3, 3, 0.1),
			range('shineY', 'Shine Y', -3, 3, 0.1),
			range('shineZ', 'Shine Z', -3, 3, 0.1),
			range('shineIntensity', 'Shine intensity', 0, 10, 0.1),
			range('shineSize', 'Shine size', 0.1, 3, 0.1),
			gain,
			range('intensity', 'Intensity', 0.1, 12, 0.1),
			range('pattern', 'Spike density', 1, 20, 0.1),
			range('fluidity', 'Fluidity', 0, 1, 0.01),
			range('roughness', 'Roughness', 0, 1, 0.01),
			range('iridescence', 'Iridescence', 0, 1, 0.01),
			range('envMapIntensity', 'Studio reflections', 0, 2, 0.01),
			select('quality', 'Quality', [
				{value: 'low', label: 'Low'},
				{value: 'medium', label: 'Medium'},
				{value: 'high', label: 'High'},
			]),
			select('mappingMode', 'Frequency mapping', [
				{value: 'uniform', label: 'Uniform'},
				{value: 'latitude', label: 'Latitude'},
				{value: 'radial', label: 'Radial'},
				{value: 'voronoi', label: 'Voronoi'},
			]),
			booleanControl('audioLights', 'Audio-reactive lights'),
			booleanControl('autoRotate', 'Auto rotate'),
			range('rotationSpeed', 'Rotation speed', -3, 3, 0.1),
		],
	} satisfies PreviewExample<typeof Ferrofluid>,
	waveform: {
		component: Waveform,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 1.6,
			color: '#b794ff',
			windowInSeconds: 2,
		},
		controls: [
			color('color', 'Color'),
			gain,
			intensity,
			range('windowInSeconds', 'Time window', 0.1, 5, 0.1),
		],
	} satisfies PreviewExample<typeof Waveform>,
	spectre: {
		component: Spectre,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 4,
			startColor: '#3373d4',
			endColor: '#f567f5',
			colorMode: 'gradient',
			count: 64,
			barWidth: 3,
			bottom: false,
			spectreVariant: 'bars',
		},
		controls: [
			select('spectreVariant', 'Treatment', [
				{value: 'bars', label: 'Bars'},
				{value: 'segmented', label: 'Segmented'},
			]),
			colorMode,
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('count', 'Bar count', 5, 150, 1),
			range('barWidth', 'Bar width', 0.5, 10, 0.5),
			booleanControl('bottom', 'Align to bottom'),
		],
	} satisfies PreviewExample<typeof Spectre>,
	segmented: {
		component: Spectre,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 4,
			startColor: '#3373d4',
			endColor: '#f567f5',
			colorMode: 'gradient',
			count: 64,
			barWidth: 3,
			bottom: false,
			spectreVariant: 'segmented',
		},
		controls: [],
	} satisfies PreviewExample<typeof Spectre>,
	oscilloscope: {
		component: Oscilloscope,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			amplitude: 1.5,
			lineColor: '#51e8cc',
			lineWidth: 3,
			sampleCount: 1024,
		},
		controls: [
			color('lineColor', 'Line color'),
			gain,
			range('amplitude', 'Amplitude', 0.1, 10, 0.1),
			range('lineWidth', 'Line width', 0.5, 10, 0.5),
			select('sampleCount', 'PCM samples', [
				{value: '256', label: '256'},
				{value: '512', label: '512'},
				{value: '1024', label: '1024'},
				{value: '2048', label: '2048'},
			]),
		],
	} satisfies PreviewExample<typeof Oscilloscope>,
	pulsar: {
		component: Pulsar,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 1,
			intensity: 1,
			density: 1.5,
			pattern: 4,
			volume: 2,
			startColor: '#592bb3',
			endColor: '#195753',
			colorMode: 'gradient',
		},
		controls: [
			colorMode,
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('density', 'Density', 0.1, 5, 0.1),
			range('pattern', 'Pattern', 0.5, 16, 0.5),
			range('volume', 'Volume size', 0.5, 10, 0.5),
		],
	} satisfies PreviewExample<typeof Pulsar>,
	circle: {
		component: Circle,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			count: 64,
			lineWidth: 3,
			startColor: '#b794ff',
			endColor: '#51e8cc',
			colorMode: 'gradient',
			circleVariant: 'radial-bars',
		},
		controls: [
			select('circleVariant', 'Treatment', [
				{value: 'radial-bars', label: 'Radial bars'},
				{value: 'glow-ring', label: 'Glow ring'},
				{value: 'waveform-ring', label: 'Waveform ring'},
				{value: 'dotted-ring', label: 'Dotted ring'},
			]),
			colorMode,
			color('startColor', 'Start color'),
			color('endColor', 'End color'),
			gain,
			intensity,
			range('radius', 'Radius', 0.05, 0.8, 0.01),
			range('count', 'Count', 5, 150, 1),
			range('lineWidth', 'Line / dot width', 0.5, 10, 0.5),
		],
	} satisfies PreviewExample<typeof Circle>,
	glow: {
		component: Circle,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			circleVariant: 'glow-ring',
		},
		controls: [],
	} satisfies PreviewExample<typeof Circle>,
	'ring-waveform': {
		component: Circle,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			circleVariant: 'waveform-ring',
		},
		controls: [],
	} satisfies PreviewExample<typeof Circle>,
	dotted: {
		component: Circle,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 4,
			intensity: 4,
			radius: 0.46,
			circleVariant: 'dotted-ring',
			count: 48,
			lineWidth: 1,
		},
		controls: [],
	} satisfies PreviewExample<typeof Circle>,
	halo: {
		component: Halo,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 0,
			intensity: 1,
			radius: 0.12,
			trailDepth: 9,
			waveDelay: true,
			motionBlur: true,
			glowBlur: 0,
			glowSpread: 0,
			colorMode: 'rainbow',
			startColor: '#aa8bff',
			endColor: '#51e8cc',
			centerColor: '#2d2d2d',
			centerMode: 'filled',
			artworkSrc: '',
		},
		controls: [
			colorMode,
			color('startColor', 'Gradient start color'),
			color('endColor', 'Gradient end color'),
			color('leadingColor', 'Leading edge'),
			select('centerMode', 'Center mode', [
				{value: 'filled', label: 'Filled'},
				{value: 'transparent', label: 'Transparent'},
			]),
			color('centerColor', 'Center color'),
			gain,
			intensity,
			range('radius', 'Radius', 0.05, 0.8, 0.01),
			range('trailDepth', 'Trail layers', 1, 9, 1),
			booleanControl('waveDelay', 'Delayed trails'),
			booleanControl('motionBlur', 'Temporal afterglow'),
			range('glowBlur', 'Glow blur', 0, 100, 1),
			range('glowSpread', 'Glow spread', 0, 100, 1),
		],
	} satisfies PreviewExample<typeof Halo>,
	'audio-particles': {
		component: AudioParticles,
		width: 1280,
		height: 720,
		props: {
			inputGainDb: 22,
			intensity: 7.4,
			radius: 0.2,
			density: 45,
			size: 1.5,
			startTimeInSeconds: -5,
			reactiveSpeed: true,
			maskHalo: false,
			color: '#b794ff',
		},
		controls: [
			color('color', 'Particle color'),
			gain,
			intensity,
			range('radius', 'Inner radius', 0.05, 0.8, 0.01),
			range('density', 'Density', 0, 50, 1),
			range('size', 'Particle size', 0.25, 2, 0.25),
			range('startTimeInSeconds', 'Emission start (s)', -5, 10, 0.01),
			booleanControl('reactiveSpeed', 'Bass-reactive speed'),
			booleanControl('maskHalo', 'Mask Halo edge'),
		],
	} satisfies PreviewExample<typeof AudioParticles>,
	combined: {
		component: HaloAndParticles,
		width: 1280,
		height: 720,
		props: {},
		controls: [],
	} satisfies PreviewExample<typeof HaloAndParticles>,
} as const;
export type PreviewKind = keyof typeof examples;
export const defaultAudioFor = (kind: PreviewKind) => {
	if (kind === 'halo' || kind === 'ferrofluid' || kind === 'trip') return HALO_AUDIO;
	if (kind === 'audio-particles' || kind === 'combined') return AUDIO_PARTICLES_AUDIO;
	return DEFAULT_AUDIO;
};
