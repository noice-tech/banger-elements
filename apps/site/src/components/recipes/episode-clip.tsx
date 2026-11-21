import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Circle, Waveform} from '../../../../../packages/elements/dist/components';

const SIZE = 1080;
const GUTTER = 72;
const ACCENT = '#d9ee9d';
const START = 0; // seconds into public/episode.mp3

// Times are relative to START. Replace these cues if you swap the narration.
const CAPTIONS = [
	{at: 0, text: 'Why do loud records\nsometimes sound quiet?'},
	{at: 3.4, text: 'If every sound is\npushed to the limit,'},
	{at: 5.9, text: 'nothing stands out.'},
	{at: 7.5, text: 'Turn down the rest,'},
	{at: 9, text: 'and the kick suddenly\nfeels louder.'},
];

const RecordArtwork = ({rotation}: {rotation: number}) => (
	<svg
		width={356}
		height={356}
		viewBox="0 0 356 356"
		style={{transform: `rotate(${rotation}deg)`, filter: 'drop-shadow(0 20px 32px #07100e)'}}
	>
		<circle cx={178} cy={178} r={174} fill="#131d1a" stroke="#819084" strokeWidth={2} />
		{Array.from({length: 16}, (_, i) => (
			<circle
				key={i}
				cx={178}
				cy={178}
				r={75 + i * 6}
				fill="none"
				stroke={i % 4 === 0 ? '#56685d' : '#34463e'}
			/>
		))}
		<path
			d="M37 124a151 151 0 0 1 94-90m89 298a159 159 0 0 0 97-75"
			fill="none"
			stroke="#94a997"
			strokeWidth={3}
		/>
		<circle cx={178} cy={178} r={65} fill={ACCENT} />
		<circle cx={178} cy={178} r={56} fill="none" stroke="#6a7b4d" />
		<path
			d="M131 196q13-33 28 0t28 0 28 0h11m-94 12h93"
			fill="none"
			stroke="#263623"
			strokeWidth={3}
			strokeLinecap="round"
		/>
		<circle cx={178} cy={178} r={5} fill="#131d1a" />
	</svg>
);

export const EpisodeClip = ({audioSrc = staticFile('episode.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const time = frame / fps;
	const caption = CAPTIONS.reduce((text, cue) => (time >= cue.at ? cue.text : text), '');
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false};

	return (
		<AbsoluteFill
			style={{
				background: 'radial-gradient(ellipse at 50% 30%, #2c4034, #101a18 68%)',
				color: '#f5f3e7',
				fontFamily: 'Geist, Inter, system-ui, sans-serif',
			}}
		>
			<div
				style={{
					position: 'absolute',
					top: 60,
					left: GUTTER,
					right: GUTTER,
					display: 'flex',
					alignItems: 'baseline',
					justifyContent: 'space-between',
					paddingBottom: 20,
					borderBottom: '1px solid #53695b',
				}}
			>
				<span style={{fontSize: 31, fontWeight: 720, letterSpacing: -0.8}}>Night Shift</span>
				<span style={{fontSize: 19, letterSpacing: 3, color: '#b2bfb0'}}>EPISODE 042</span>
			</div>

			<AbsoluteFill style={{top: 126, height: 472, alignItems: 'center', justifyContent: 'center'}}>
				<RecordArtwork rotation={time * 24} />
				<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
					<Circle
						{...audio}
						playAudio
						width={840}
						height={472}
						circleVariant="waveform-ring"
						radius={0.76}
						intensity={1.1}
						lineThickness={1.3}
						startColor="#9bad7c"
						endColor={ACCENT}
					/>
				</AbsoluteFill>
			</AbsoluteFill>

			<div style={{position: 'absolute', top: 625, left: GUTTER, right: GUTTER}}>
				<div style={{color: ACCENT, fontSize: 21, fontWeight: 650, letterSpacing: 4}}>
					THE LOUDNESS EPISODE
				</div>
				<div
					style={{
						marginTop: 20,
						fontSize: 69,
						fontWeight: 730,
						letterSpacing: -2.8,
						lineHeight: 1.05,
						whiteSpace: 'pre-line',
					}}
				>
					{caption}
				</div>
			</div>

			<div
				style={{
					position: 'absolute',
					left: GUTTER,
					right: GUTTER,
					bottom: 62,
					paddingTop: 22,
					borderTop: '1px solid #53695b',
				}}
			>
				<Waveform
					{...audio}
					width={SIZE - 2 * GUTTER}
					height={58}
					color={ACCENT}
					windowInSeconds={1.8}
				/>
			</div>
		</AbsoluteFill>
	);
};
