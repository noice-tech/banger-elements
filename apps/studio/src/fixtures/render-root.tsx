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

const FerrofluidExample = () => <Ferrofluid />;
const FerrofluidFluid = () => <Ferrofluid fluidity={0.8} mappingMode="voronoi" quality="high" />;
const WaveformExample = () => <Waveform />;
const SpectreExample = () => <Spectre />;
const SpectreSegmented = () => <Spectre spectreVariant="segmented" />;
const OscilloscopeExample = () => <Oscilloscope />;
const PulsarExample = () => <Pulsar />;
const CircleExample = () => <Circle />;
const CircleGlow = () => <Circle circleVariant="glow-ring" />;
const CircleWaveform = () => <Circle circleVariant="waveform-ring" />;
const CircleDotted = () => <Circle circleVariant="dotted-ring" count={48} lineWidth={1} />;
const HaloExample = () => <Halo />;
const AudioParticlesExample = () => <AudioParticles />;
const HaloAndParticles = () => (
	<AbsoluteFill style={{backgroundColor: '#080a10'}}>
		<Halo />
		<AudioParticles playAudio={false} width={1280} height={720} maskHalo />
	</AbsoluteFill>
);

const compositions = [
	['Ferrofluid', FerrofluidExample, 1280, 720],
	['FerrofluidFluid', FerrofluidFluid, 1280, 720],
	['Waveform', WaveformExample, 1280, 720],
	['Spectre', SpectreExample, 1280, 720],
	['SpectreSegmented', SpectreSegmented, 1280, 720],
	['Oscilloscope', OscilloscopeExample, 1280, 720],
	['Pulsar', PulsarExample, 1280, 720],
	['Circle', CircleExample, 1280, 720],
	['CircleGlow', CircleGlow, 1280, 720],
	['CircleWaveform', CircleWaveform, 1280, 720],
	['CircleDotted', CircleDotted, 1280, 720],
	['Halo', HaloExample, 1280, 720],
	['AudioParticles', AudioParticlesExample, 1280, 720],
	['HaloAndParticles', HaloAndParticles, 1280, 720],
] as const;

const Visuals = () => (
	<>
		{compositions.map(([id, component, width, height]) => (
			<Composition
				key={id}
				id={id}
				component={component}
				width={width}
				height={height}
				fps={60}
				durationInFrames={960}
			/>
		))}
	</>
);

registerRoot(Visuals);
