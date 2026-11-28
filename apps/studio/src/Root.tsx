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

const NEUTRAL = '#ededed';
const NEUTRAL_DIM = '#8a8a8a';
const PURPLE = '#9333ea';
const LILAC = '#c084fc';
const LAVENDER = '#d8b4fe';
const DEEP = '#3b0764';
const NIGHT = '#0b0614';

const components = {
	Ferrofluid,
	FerrofluidPreview: () => (
		<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
			<Ferrofluid width={1280 * 1.44} height={720 * 1.44} style={{flex: 'none'}} />
		</AbsoluteFill>
	),
	FerrofluidFluid: () => <Ferrofluid fluidity={0.8} mappingMode="voronoi" quality="high" />,
	Waveform: () => <Waveform color={NEUTRAL} />,
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
	Pulse: () => <Pulse startColor={PURPLE} endColor={LAVENDER} />,
	Rooftop: () => (
		<Rooftop skyColor={NIGHT} buildingColor="#1e1030" streetColor="#120a1c" lightColor={LILAC} />
	),
	Cathedral: () => (
		<Cathedral
			stoneColor="#8b5cf6"
			glassColor1="#4c3a5e"
			glassColor2={PURPLE}
			lightColor={LAVENDER}
		/>
	),
	Liquid: () => <Liquid color1={PURPLE} color2={LILAC} glowColor={LAVENDER} />,
	Chrome: () => <Chrome color1={LAVENDER} color2={PURPLE} color3={DEEP} />,
	Neuron: () => <Neuron color1={PURPLE} color2={LILAC} glowColor={LAVENDER} />,
	Matrix: () => <Matrix color1={PURPLE} color2={LILAC} glowColor="#ffffff" />,
	Spectre: () => <Spectre startColor={NEUTRAL_DIM} endColor={NEUTRAL} />,
	SpectreSegmented: () => <Spectre spectreVariant="segmented" />,
	Oscilloscope: () => <Oscilloscope lineColor={NEUTRAL} />,
	OscilloscopeSingleCycle: () => <Oscilloscope displayMode="single-cycle" />,
	OscilloscopeFree: () => <Oscilloscope displayMode="free" timeSpanMs={100} />,
	Pulsar: () => <Pulsar startColor="#5c5c5c" endColor="#2a2a2a" />,
	Circle: () => <Circle startColor={NEUTRAL_DIM} endColor={NEUTRAL} />,
	CircleGlow: () => <Circle circleVariant="glow-ring" />,
	CircleWaveform: () => <Circle circleVariant="waveform-ring" />,
	CircleDotted: () => <Circle circleVariant="dotted-ring" count={48} lineWidth={1} />,
	Halo: () => <Halo colorMode="gradient" startColor={NEUTRAL} endColor={NEUTRAL_DIM} />,
	AudioParticles: () => <AudioParticles color={NEUTRAL} />,
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
	Fractals: () => <Fractals baseColor={PURPLE} mixColor={DEEP} />,
	Hyperloop: () => <Hyperloop baseColor={PURPLE} />,
	Downfall: () => <Downfall startColor={PURPLE} endColor={LILAC} />,
	Rail: () => <Rail startColor={PURPLE} endColor={LILAC} tintColor={PURPLE} tint={1} />,
	Rain: () => <Rain tintColor={PURPLE} tint={1} />,
	Kaleidoscope: () => <Kaleidoscope startColor={PURPLE} />,
	Eye: () => <Eye startColor={DEEP} endColor={PURPLE} />,
	Flowers: () => <Flowers colorMode="solid" color={PURPLE} strokeColor={LAVENDER} />,
	Moon: () => <Moon startColor={PURPLE} />,
	City: () => (
		<City
			startColor="#3b2652"
			endColor={DEEP}
			lightsColor={LAVENDER}
			groundColor={PURPLE}
			shineColor="#c4b5fd"
		/>
	),
	Basic: () => (
		<BasicElement enableStars backgroundColor={NIGHT} intensifyColor={DEEP} starsColor={LAVENDER} />
	),
	Space: () => <Space baseColor={PURPLE} tintColor={PURPLE} tint={1} />,
	Synthwave: () => <Synthwave startColor={PURPLE} endColor={LILAC} sphereColor={LAVENDER} />,
	Mushrooms: () => <Mushrooms baseColor={PURPLE} mixColor={DEEP} />,
	Trip: () => <Trip baseColor={PURPLE} intensifyColor={LILAC} />,
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
