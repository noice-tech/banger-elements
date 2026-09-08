import {AbsoluteFill, Composition} from 'remotion';
import {
	AudioParticles,
	Ferrofluid,
	Circle,
	Oscilloscope,
	Pulsar,
	Spectre,
	Halo,
	Waveform,
	Trip,
	Space,
	Synthwave,
	Mushrooms,
} from '../../../packages/elements/dist/components';
import {compositions} from './fixtures/compositions';

const components = {
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
};

export const Root = () => (
	<>
		{compositions.map(({id}) => (
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
