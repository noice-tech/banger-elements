import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {
	AudioParticles,
	Ferrofluid,
	Circle,
	Oscilloscope,
	Pulsar,
	Spectre,
	Halo,
	Waveform,
} from '../../../../packages/elements/dist/components';
import {compositions} from './compositions';

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
			<Halo />
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
	),
};

const Visuals = () => (
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

registerRoot(Visuals);
