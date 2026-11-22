import {
	AbsoluteFill,
	Audio,
	Freeze,
	Sequence,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {Spectre, Waveform} from '../../../../../packages/elements/dist/components';

// Set these from your own public/single.mp3: where the clip starts (a bar before the drop), the tempo,
// and the bar where the finished part ends. The music stops there.
const START = 0.718;
const BPM = 122;
const WRITTEN_BARS = 5;
const SHOWN_BARS = 8;
const PROJECT = 'untitled_v7';
const DETAILS = '122 BPM · F minor';

// What the arrangement looks like, in bars from the start of the clip.
const LANES = [
	{name: 'Drums', color: '#ff9b54', clips: [[1, 5]]},
	{name: 'Bass', color: '#ffd166', clips: [[1, 5]]},
	{name: 'Pads', color: '#62d4e8', clips: [[0, 5]]},
	{
		name: 'Lead',
		color: '#ff7eb0',
		clips: [
			[1, 2],
			[3, 4.5],
		],
	},
	{
		name: 'FX',
		color: '#b7a2ff',
		clips: [
			[0.5, 1],
			[4.5, 5],
		],
	},
	{name: 'Vocals', color: '#e9e4da', clips: []},
] as const;

// Typed over the clip, the way you would in the app. Each one appears on its bar.
const CAPTIONS = [
	{bar: 0, text: 'this one has been stuck in my head for weeks'},
	{bar: 1, text: 'the drop finally works'},
	{bar: 3, text: 'no idea what comes after it'},
	{bar: WRITTEN_BARS, text: 'that’s all I have so far.\nfinish it?'},
];

const CARD = {left: 40, top: 560, width: 1000};
const LABEL = 200;
const BAR = (CARD.width - LABEL - 26) / SHOWN_BARS;
const LANE = 100;
const mono = {fontFamily: 'Geist Mono, monospace'} as const;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// A rough drawing of each part, from 0 to 1, so the clips read like audio regions.
const level = (lane: string, bar: number, from: number, to: number) => {
	const beat = (bar * 4) % 1;
	if (lane === 'Drums') return 0.2 + 0.8 * Math.exp(-beat * 7);
	if (lane === 'Bass') return beat < 0.6 ? 0.75 : 0.3;
	if (lane === 'Pads') return 0.5 + 0.12 * Math.sin(bar * 9);
	if (lane === 'Lead')
		return ((bar * 8) % 1 < 0.55 ? 0.35 : 0.1) + 0.4 * Math.abs(Math.sin(bar * 21));
	return from < 1 ? (bar - from) / (to - from) : 1 - (bar - from) / (to - from);
};

const Clip = ({lane, color, from, to}: {lane: string; color: string; from: number; to: number}) => {
	const w = (to - from) * BAR - 4;
	const h = LANE - 14;
	const steps = Math.floor(w / 4);
	const path = Array.from({length: steps}, (_, i) => {
		const amp = level(lane, from + ((i + 0.5) / steps) * (to - from), from, to) * (h / 2 - 8);
		return `M${i * 4 + 2} ${h / 2 + 4 - amp}v${amp * 2}`;
	}).join('');
	return (
		<svg
			width={w}
			height={h}
			style={{position: 'absolute', left: from * BAR, top: 7, borderRadius: 8, background: color}}
		>
			<path d={path} stroke="#0000004d" strokeWidth={2} strokeLinecap="round" />
		</svg>
	);
};

export const ReleaseReel = ({audioSrc = staticFile('single.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const barLength = (60 / BPM) * 4 * fps;
	const beatLength = barLength / 4;
	const end = Math.round(WRITTEN_BARS * barLength);
	const position = frame >= end ? WRITTEN_BARS : frame / barLength; // in bars
	const kick = position < 1 || frame >= end ? 0 : Math.exp(-((frame - barLength) % beatLength) / 5);
	const caption = CAPTIONS.filter((cue) => position >= cue.bar).at(-1)!;
	const shown = Math.round(caption.bar * barLength);
	const pop = spring({frame: frame - shown, fps, config: {damping: 14, stiffness: 180}});
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false};

	return (
		<AbsoluteFill
			style={{background: '#0f0f11', color: '#f4f1ea', fontFamily: 'Geist, sans-serif'}}
		>
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 70% 40% at 50% 52%, #ff9b54${Math.round(20 + kick * 30).toString(16)}, transparent 70%)`,
				}}
			/>
			{/* The music plays up to the unfinished part, then stops. */}
			<Sequence durationInFrames={end}>
				<Audio
					src={audioSrc}
					trimBefore={Math.round(START * fps)}
					volume={(f) => interpolate(f, [end - 8, end], [1, 0], clamp)}
				/>
			</Sequence>

			<div
				style={{
					position: 'absolute',
					left: 70,
					right: 70,
					top: 300,
					textAlign: 'center',
					fontSize: 50,
					fontWeight: 700,
					lineHeight: 1.42,
					whiteSpace: 'pre-line',
					transform: `scale(${0.85 + pop * 0.15})`,
					opacity: Math.min(1, pop * 2),
				}}
			>
				<span
					style={{
						background: '#fff',
						color: '#111',
						padding: '6px 20px',
						borderRadius: 14,
						boxDecorationBreak: 'clone',
						WebkitBoxDecorationBreak: 'clone',
					}}
				>
					{caption.text}
				</span>
			</div>

			<div
				style={{
					position: 'absolute',
					...CARD,
					padding: '26px 0 24px',
					borderRadius: 28,
					background: '#1a1a1d',
					boxShadow: '0 40px 100px #000a, inset 0 1px 0 #ffffff14',
					transform: `scale(${1 + kick * 0.008})`,
				}}
			>
				<div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px 22px'}}>
					<span
						style={{
							width: 16,
							height: 16,
							borderRadius: 8,
							background: '#ff4d4d',
							opacity: frame >= end && Math.floor(frame / 20) % 2 ? 0.25 : 1,
						}}
					/>
					<span style={{...mono, fontSize: 38, fontWeight: 600}}>{PROJECT}</span>
					<span style={{...mono, marginLeft: 'auto', fontSize: 25, opacity: 0.55}}>{DETAILS}</span>
				</div>

				{/* Bar numbers, then one row per part. */}
				<div style={{position: 'relative', marginLeft: LABEL, height: 40}}>
					{Array.from({length: SHOWN_BARS}, (_, bar) => (
						<span
							key={bar}
							style={{
								...mono,
								position: 'absolute',
								left: bar * BAR + 4,
								fontSize: 24,
								opacity: bar < position ? 0.9 : 0.35,
							}}
						>
							{bar + 1}
						</span>
					))}
				</div>
				<div style={{position: 'relative'}}>
					{LANES.map((lane, row) => {
						const playing = lane.clips.some(([from, to]) => position >= from && position < to);
						return (
							<div
								key={lane.name}
								style={{display: 'flex', height: LANE, borderTop: '1px solid #ffffff0f'}}
							>
								<div
									style={{
										width: LABEL,
										display: 'flex',
										alignItems: 'center',
										gap: 14,
										paddingLeft: 28,
										fontSize: 30,
										fontWeight: 600,
									}}
								>
									<span
										style={{
											width: 8,
											height: 38,
											borderRadius: 4,
											background: lane.color,
											opacity: playing && frame < end ? 0.45 + 0.55 * (row < 2 ? kick : 0.8) : 0.18,
										}}
									/>
									{lane.name}
								</div>
								<div style={{position: 'relative', flex: 1}}>
									{lane.clips.map(([from, to]) => (
										<Clip key={from} lane={lane.name} color={lane.color} from={from} to={to} />
									))}
									{lane.clips.length === 0 && (
										<div
											style={{
												position: 'absolute',
												left: BAR,
												top: 7,
												width: 4 * BAR - 4,
												height: LANE - 14,
												border: '2px dashed #ffffff40',
												borderRadius: 8,
												display: 'flex',
												alignItems: 'center',
												paddingLeft: 16,
												fontSize: 26,
												opacity: 0.6,
											}}
										>
											vocals?
										</div>
									)}
								</div>
							</div>
						);
					})}
					{/* The bars nobody has written yet. */}
					<div
						style={{
							position: 'absolute',
							left: LABEL + WRITTEN_BARS * BAR,
							width: (SHOWN_BARS - WRITTEN_BARS) * BAR,
							top: 0,
							bottom: 0,
							background:
								'repeating-linear-gradient(135deg, #ffffff08 0 12px, transparent 12px 24px)',
							borderLeft: '2px dashed #ffffff30',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							...mono,
							fontSize: 26,
							color: '#ffffff70',
						}}
					>
						empty
					</div>
					<div
						style={{
							position: 'absolute',
							left: LABEL + position * BAR - 1.5,
							top: -40,
							bottom: 0,
							width: 3,
							background: '#fff',
							boxShadow: '0 0 18px #ffffffaa',
						}}
					/>
				</div>

				<Freeze frame={end - 1} active={frame >= end}>
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 20,
							margin: '18px 28px 0',
							paddingTop: 18,
							borderTop: '1px solid #ffffff14',
						}}
					>
						<Waveform {...audio} width={580} height={120} color="#f4f1ea" windowInSeconds={2} />
						<Spectre
							{...audio}
							width={CARD.width - 56 - 580 - 20}
							height={120}
							spectreVariant="segmented"
							count={24}
							startColor="#ffd166"
							endColor="#ff7eb0"
							inputGainDb={10}
							bottom
						/>
					</div>
				</Freeze>
			</div>
		</AbsoluteFill>
	);
};
