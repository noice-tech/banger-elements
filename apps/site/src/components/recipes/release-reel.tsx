import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Synthwave} from '../../../../../packages/elements/dist/components';

const START = 2.685; // seconds into public/single.mp3: open on the drop
const BPM = 122;
const ARTIST = 'MARA QUINN';
const TITLE = ['NIGHT', 'DRIVE'];
const RELEASE_DATE = '21.11';
const CALL_TO_ACTION = 'Pre-save · link in bio';
const AMBER = '#ffb27a';
// Reels and Shorts draw their own UI over the bottom 420 px, the top 220 px and the right edge.
const SAFE = {bottom: 440, left: 72};
const display = {fontFamily: 'Syncopate, sans-serif', fontWeight: 700, lineHeight: 0.92} as const;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const ReleaseReel = ({audioSrc = staticFile('single.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const beatLength = (60 / BPM) * fps;
	const beat = Math.floor(frame / beatLength);
	const kick = Math.exp(-(frame % beatLength) / 4);
	// Cut closer on each downbeat, then pull back wide for the date.
	const zoom = beat < 4 ? 1 : beat < 8 ? 1.35 : beat < 12 ? 2 : 1;
	const card = interpolate(frame, [12 * beatLength, 12 * beatLength + 6], [0, 1], clamp);
	const shade = Math.round(128 + card * 112).toString(16);

	return (
		<AbsoluteFill
			style={{background: '#06070d', color: '#fff7ee', fontFamily: 'Geist, sans-serif'}}
		>
			<AbsoluteFill
				style={{transformOrigin: '50% 42%', transform: `scale(${zoom * (1 + kick * 0.02)})`}}
			>
				<Synthwave
					audioSrc={audioSrc}
					audioOffsetInSeconds={START}
					playAudio
					width={width}
					height={height}
					bpm={BPM}
					startColor="#325b90"
					endColor="#ff7e5a"
					sphereColor="#e0a375"
					mountainsHeight={3}
				/>
			</AbsoluteFill>
			<AbsoluteFill
				style={{
					background: `linear-gradient(180deg, #06070dcc, transparent 30%, transparent 50%, #06070d${shade} 80%)`,
				}}
			/>

			{beat < 8 && (
				<div style={{position: 'absolute', bottom: SAFE.bottom, left: SAFE.left}}>
					<div style={{fontSize: 34, fontWeight: 600, letterSpacing: 8}}>{ARTIST}</div>
					<div
						style={{
							...display,
							marginTop: 24,
							marginLeft: -6,
							fontSize: 172,
							letterSpacing: -10,
							transformOrigin: '0 100%',
							transform: `scale(${1 + kick * 0.04})`,
						}}
					>
						<div>{TITLE[0]}</div>
						<div style={{color: AMBER}}>{TITLE[1]}</div>
					</div>
				</div>
			)}
			{beat >= 8 && beat < 12 && (
				<AbsoluteFill
					style={{
						...display,
						justifyContent: 'flex-end',
						alignItems: 'center',
						paddingBottom: SAFE.bottom + 40,
						textAlign: 'center',
						fontSize: 150,
						letterSpacing: -8,
						textShadow: '0 6px 40px #06070d',
						transform: `scale(${1 + kick * 0.05})`,
					}}
				>
					{ARTIST.split(' ').map((word) => (
						<div key={word}>{word}</div>
					))}
				</AbsoluteFill>
			)}
			{beat >= 12 && (
				<div
					style={{
						position: 'absolute',
						left: SAFE.left,
						bottom: SAFE.bottom,
						opacity: card,
						transform: `translateY(${(1 - card) * 60}px)`,
					}}
				>
					<div style={{...display, fontSize: 64, letterSpacing: -2}}>{TITLE.join(' ')}</div>
					<div
						style={{
							...display,
							margin: '28px 0 44px -10px',
							fontSize: 250,
							letterSpacing: -18,
							color: AMBER,
							transformOrigin: '0 50%',
							transform: `scale(${1 + kick * 0.04})`,
						}}
					>
						{RELEASE_DATE}
					</div>
					<div
						style={{
							display: 'inline-block',
							padding: '20px 38px',
							borderRadius: 999,
							background: '#fff7ee',
							color: '#06070d',
							fontSize: 38,
							fontWeight: 650,
						}}
					>
						{CALL_TO_ACTION}
					</div>
				</div>
			)}
		</AbsoluteFill>
	);
};
