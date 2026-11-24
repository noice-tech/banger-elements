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
	Pulse,
	Rooftop,
	Cathedral,
	Liquid,
	Chrome,
	Neuron,
	Matrix,
	WetGlass,
} from '../../../packages/elements/dist/components';
import {compositions} from './fixtures/compositions';

const components = {
	Ferrofluid,
	// Enlarge Ferrofluid to fill about 80% of the gallery card.
	FerrofluidPreview: () => (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<Ferrofluid width={1280 * 1.44} height={720 * 1.44} style={{flex: 'none'}} />
		</AbsoluteFill>
	),
	FerrofluidFluid: () => <Ferrofluid fluidity={0.8} mappingMode="voronoi" quality="high" />,
	Waveform,
	WaveformFrequency: () => <Waveform colorMode="frequency" />,
	WaveformHighResolution: () => <Waveform resolution={16} />,
	WetGlassBypass: () => (
		<WetGlass amount={0}>
			<div style={{color: 'white', fontSize: 100}}>BYPASS</div>
		</WetGlass>
	),
	WetGlassTransparent: () => (
		<WetGlass>
			<div
				style={{
					position: 'absolute',
					left: 400,
					top: 150,
					width: 400,
					height: 400,
					borderRadius: '50%',
					background: '#00ffff80',
				}}
			/>
		</WetGlass>
	),
	Pulse,
	Rooftop,
	Cathedral,
	Liquid,
	Chrome,
	Neuron,
	Matrix,
	Spectre,
	SpectreSegmented: () => <Spectre spectreVariant="segmented" />,
	Oscilloscope,
	OscilloscopeSingleCycle: () => <Oscilloscope displayMode="single-cycle" />,
	OscilloscopeFree: () => <Oscilloscope displayMode="free" timeSpanMs={100} />,
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
	TripVertical: Trip,
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
		{standaloneCompositions.map((composition) => (
			<Composition
				key={composition.id}
				id={composition.id}
				component={components[composition.id]}
				width={'width' in composition ? composition.width : 1280}
				height={'height' in composition ? composition.height : 720}
				fps={60}
				durationInFrames={960}
			/>
		))}
	</>
);
