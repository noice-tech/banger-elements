import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Circle, Waveform} from '../../../../../packages/elements/dist/components';

const START = 0; // seconds into public/episode.mp3
const CLIP_AT = 12 * 60 + 41; // where this excerpt sits in the full episode, for the timestamp
const SHOW = 'Night Shift';
const EPISODE = 'Episode 42';
const EPISODE_TITLE = 'The loudness episode';
const PAPER = '#efe7da';
const INK = '#1d1b18';
const TOMATO = '#e2462c';
const GUTTER = 72;
const serif = {fontFamily: 'Newsreader, Georgia, serif'} as const;

// When each sentence starts, in seconds after START. Words light up evenly across their sentence.
const CAPTIONS = [
	{at: 0, text: 'Why do loud records sometimes sound quiet?'},
	{at: 3.4, text: 'If every sound is pushed to the limit,'},
	{at: 5.9, text: 'nothing stands out.'},
	{at: 7.5, text: 'Turn down the rest,'},
	{at: 9, text: 'and the kick suddenly feels louder.'},
];
const END = 11.2;

const clock = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const Cover = () => (
	<div
		style={{
			width: 156,
			height: 156,
			flex: 'none',
			borderRadius: 6,
			background: TOMATO,
			color: PAPER,
			padding: '16px 18px',
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-between',
		}}
	>
		<svg width={34} height={34} viewBox="0 0 34 34">
			<path d="M24 4a14 14 0 1 0 6 21A12 12 0 0 1 24 4z" fill={INK} />
		</svg>
		<div style={{...serif, fontSize: 40, fontWeight: 650, lineHeight: 0.92, letterSpacing: -1}}>
			Night
			<br />
			Shift
		</div>
	</div>
);

export const EpisodeClip = ({audioSrc = staticFile('episode.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width} = useVideoConfig();
	const time = frame / fps;
	const index = CAPTIONS.reduce((last, cue, i) => (time >= cue.at ? i : last), 0);
	const cue = CAPTIONS[index]!;
	const until = (CAPTIONS[index + 1]?.at ?? END) - 0.3;
	const words = cue.text.split(' ');
	const spoken = ((time - cue.at) / (until - cue.at)) * words.length;
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false};

	return (
		<AbsoluteFill style={{background: PAPER, color: INK, fontFamily: 'Geist, sans-serif'}}>
			<div
				style={{
					position: 'absolute',
					top: GUTTER,
					left: GUTTER,
					right: GUTTER,
					display: 'flex',
					gap: 28,
				}}
			>
				<Cover />
				<div style={{paddingTop: 8}}>
					<div style={{fontSize: 21, fontWeight: 600, letterSpacing: 0.3, color: TOMATO}}>
						{SHOW} · {EPISODE}
					</div>
					<div style={{...serif, marginTop: 10, fontSize: 50, fontWeight: 560, letterSpacing: -1}}>
						{EPISODE_TITLE}
					</div>
				</div>
				{/* The ring breathes with the voice, so it reads as someone speaking. */}
				<div
					style={{position: 'relative', marginLeft: 'auto', width: 156, height: 156, flex: 'none'}}
				>
					<Circle
						{...audio}
						playAudio
						width={156}
						height={156}
						circleVariant="waveform-ring"
						radius={0.7}
						lineThickness={2}
						startColor={TOMATO}
						endColor={TOMATO}
						style={{position: 'absolute', inset: 0}}
					/>
					<svg
						width={156}
						height={156}
						viewBox="0 0 156 156"
						style={{position: 'absolute', inset: 0}}
					>
						<circle cx={78} cy={78} r={34} fill={INK} />
						<rect x={71} y={58} width={14} height={26} rx={7} fill={PAPER} />
						<path
							d="M64 76a14 14 0 0 0 28 0M78 90v8"
							fill="none"
							stroke={PAPER}
							strokeWidth={3}
							strokeLinecap="round"
						/>
					</svg>
				</div>
			</div>

			<div style={{position: 'absolute', top: 318, left: GUTTER, right: GUTTER}}>
				<div style={{...serif, height: 96, fontSize: 200, lineHeight: 1, color: TOMATO}}>“</div>
				<div
					style={{...serif, fontSize: 94, fontWeight: 520, letterSpacing: -2.5, lineHeight: 1.04}}
				>
					{words.map((word, i) => (
						<span
							key={`${index}-${i}`}
							style={{
								color: INK,
								opacity: interpolate(spoken - i, [0, 0.6], [0.22, 1], {
									extrapolateLeft: 'clamp',
									extrapolateRight: 'clamp',
								}),
							}}
						>
							{word}{' '}
						</span>
					))}
				</div>
			</div>

			<div style={{position: 'absolute', left: GUTTER, right: GUTTER, bottom: GUTTER}}>
				<Waveform
					{...audio}
					width={width - 2 * GUTTER}
					height={120}
					color={INK}
					windowInSeconds={2.4}
				/>
				<div
					style={{
						marginTop: 18,
						paddingTop: 16,
						borderTop: `2px solid ${INK}`,
						display: 'flex',
						justifyContent: 'space-between',
						fontSize: 21,
						fontWeight: 600,
					}}
				>
					<span>Listen to the full episode</span>
					<span style={{fontFamily: 'Geist Mono, monospace', fontWeight: 500}}>
						{clock(CLIP_AT + time)}
					</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};
