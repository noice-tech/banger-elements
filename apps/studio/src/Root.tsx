import {AbsoluteFill, Composition} from 'remotion';
import {
	AudioParticles,
	Basic as BasicElement,
	Circle,
	City,
	Downfall,
	Eye,
	Ferrofluid,
	Flowers,
	Fractals,
	Halo,
	Hyperloop,
	Kaleidoscope,
	Moon,
	Mushrooms,
	Oscilloscope,
	Pulsar,
	Rail,
	Rain,
	Space,
	Spectre,
	Synthwave,
	Trip,
	Waveform,
} from '../../../packages/elements/dist/components';
import {compositions} from './fixtures/compositions';

const components = {
	Ferrofluid,
	FerrofluidFluid: () => <Ferrofluid fluidity={0.8} mappingMode="voronoi" quality="high" />,
	Waveform,
	Spectre,
	SpectreSegmented: () => <Spectre spectreVariant="segmented" />,
	Oscilloscope,
	Pulsar,
	Circle,
	CircleGlow: () => <Circle circleVariant="glow-ring" />,
	CircleWaveform: () => <Circle circleVariant="waveform-ring" />,
	CircleDotted: () => <Circle circleVariant="dotted-ring" count={48} lineWidth={1} />,
	Halo,
	AudioParticles,
	HaloAndParticles: () => (
		<AbsoluteFill style={{backgroundColor: '#080a10'}}>
			<AbsoluteFill>
				<Halo />
			</AbsoluteFill>
			<AbsoluteFill>
				<AudioParticles
					playAudio={false}
					width={1280}
					height={720}
					maskHalo
					radius={0.12}
					inputGainDb={0}
					intensity={1}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	),
	Fractals,
	Hyperloop,
	Downfall,
	Rail,
	Rain,
	Kaleidoscope,
	Eye,
	Flowers,
	Moon,
	City,
	Basic: () => <BasicElement enableStars />,
	Space,
	Synthwave,
	Mushrooms,
	Trip,
	TripCustom: () => (
		<Trip
			baseColor="#00d9ff"
			intensifyColor="#ff8533"
			pattern={1.2}
			thickness={0.6}
			intensity={18}
			bpm={90}
			timeOffsetInSeconds={3}
		/>
	),
	TripAndCircle: () => (
		<AbsoluteFill>
			<AbsoluteFill>
				<Trip />
			</AbsoluteFill>
			<AbsoluteFill>
				<Circle playAudio={false} circleVariant="glow-ring" />
			</AbsoluteFill>
		</AbsoluteFill>
	),
};

const standaloneCompositions = compositions.filter(
	(composition): composition is (typeof compositions)[number] & {id: keyof typeof components} =>
		composition.id in components,
);

export const Root = () => (
	<>
		{standaloneCompositions.map(({id}) => (
			<Composition
				key={id}
				id={id}
				component={components[id]}
				width={1280}
				height={720}
				fps={60}
				durationInFrames={960}
			/>
		))}
	</>
);
