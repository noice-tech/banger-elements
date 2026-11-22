import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Spectre, Synthwave, Vhs} from '../../../../../packages/elements/dist/components';

// Set these from your own public/single.mp3: where the clip starts, where the drop lands, the tempo.
const START = 1.7;
const DROP = 2.685;
const BPM = 122;
const ARTIST = 'MARA QUINN';
const TITLE = 'NIGHT DRIVE';
const RELEASE_DATE = '21.11';
const CALL_TO_ACTION = 'Pre-save now';
const AMBER = '#ffb27a';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const display = {fontFamily: 'Syncopate, sans-serif', fontWeight: 700, lineHeight: 1} as const;

export const ReleaseTeaser = ({audioSrc = staticFile('single.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const beatLength = (60 / BPM) * fps;
	const drop = Math.round((DROP - START) * fps);
	const beat = (n: number) => Math.round(drop + n * beatLength);
	// Shots: a slit before the drop, the title on the drop, a close-up a bar later, then the date.
	const cuts = [drop, beat(4), beat(8)];
	const shot = cuts.filter((cut) => frame >= cut).length;
	const sinceCut = frame - (cuts[shot - 1] ?? 0);
	const kick = frame < drop ? 0 : Math.exp(-((frame - drop) % beatLength) / 4);
	const tape = shot === 0 ? 0.3 : 0.15 + 0.8 * Math.exp(-sinceCut / 5);
	const opening = interpolate(frame, [0, drop], [0.49, 0.36], clamp);
	const audio = {audioSrc, audioOffsetInSeconds: START};

	return (
		<AbsoluteFill
			style={{background: '#06070d', color: '#fff7ee', fontFamily: 'Geist, sans-serif'}}
		>
			<AbsoluteFill
				style={{
					clipPath: shot === 0 ? `inset(${opening * 100}% 0)` : undefined,
					transformOrigin: '50% 42%',
					transform: shot === 2 ? 'scale(1.7)' : `scale(${1 + kick * 0.015})`,
				}}
			>
				<Vhs width={width} height={height} strength={tape} glitch={tape * 0.08} line={0.2}>
					{/* Vhs captures WebGL children once. A new key every frame keeps them moving. */}
					<AbsoluteFill key={frame}>
						<Synthwave
							{...audio}
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
				</Vhs>
			</AbsoluteFill>
			{/* Spectre sits on the tape rather than in it, so its bars keep their motion. */}
			<Spectre
				{...audio}
				playAudio={false}
				width={width}
				height={96}
				spectreVariant="segmented"
				startColor="#ff7e5a"
				endColor="#84b8d8"
				count={48}
				inputGainDb={14}
				style={{position: 'absolute', left: 0, bottom: 0}}
			/>
			{shot === 3 && (
				<AbsoluteFill
					style={{
						background: 'linear-gradient(90deg, #06070df2 30%, #06070d99 58%, transparent 85%)',
					}}
				/>
			)}

			{/* All type sits outside the Vhs so it stays sharp. */}
			{shot === 0 && (
				<AbsoluteFill style={{alignItems: 'center', top: 170, fontSize: 22, letterSpacing: 6}}>
					{ARTIST}
				</AbsoluteFill>
			)}
			{shot === 1 && (
				<AbsoluteFill
					style={{
						...display,
						justifyContent: 'flex-end',
						alignItems: 'center',
						paddingBottom: 128,
						fontSize: 128,
						letterSpacing: -6,
						textShadow: '0 6px 40px #06070d',
						transform: `scale(${1 + kick * 0.05})`,
					}}
				>
					{TITLE}
				</AbsoluteFill>
			)}
			{shot === 2 && (
				<AbsoluteFill
					style={{
						...display,
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 112,
						letterSpacing: -5,
						textShadow: '0 4px 30px #06070d, 0 0 60px #06070d99',
						transform: `scale(${1 + kick * 0.05})`,
					}}
				>
					{ARTIST}
				</AbsoluteFill>
			)}
			{shot === 3 && (
				<div style={{position: 'absolute', left: 80, top: 150}}>
					<div style={{...display, fontSize: 40, letterSpacing: -1}}>{TITLE}</div>
					<div
						style={{
							...display,
							marginTop: 28,
							marginLeft: -8,
							fontSize: 200,
							letterSpacing: -14,
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
							marginTop: 40,
							padding: '14px 28px',
							borderRadius: 999,
							background: '#fff7ee',
							color: '#06070d',
							fontSize: 26,
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
