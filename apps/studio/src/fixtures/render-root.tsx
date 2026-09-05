import {AbsoluteFill, Composition, registerRoot} from 'remotion';
import {
	AudioParticles,
	Circle,
	Oscilloscope,
	Pulsar,
	Spectre,
	Halo,
	Waveform,
} from '../../../../packages/elements/dist/components';

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
		<AudioParticles playAudio={false} width={720} height={720} maskHalo />
	</AbsoluteFill>
);

const compositions = [
	['Waveform', WaveformExample, 900, 300],
	['Spectre', SpectreExample, 1280, 300],
	['SpectreSegmented', SpectreSegmented, 1280, 300],
	['Oscilloscope', OscilloscopeExample, 1280, 300],
	['Pulsar', PulsarExample, 900, 500],
	['Circle', CircleExample, 600, 600],
	['CircleGlow', CircleGlow, 600, 600],
	['CircleWaveform', CircleWaveform, 600, 600],
	['CircleDotted', CircleDotted, 600, 600],
	['Halo', HaloExample, 720, 720],
	['AudioParticles', AudioParticlesExample, 1280, 720],
	['HaloAndParticles', HaloAndParticles, 720, 720],
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
