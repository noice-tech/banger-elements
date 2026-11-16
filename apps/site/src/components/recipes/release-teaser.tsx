// A single announcement for socials and YouTube: 1280 × 720 at 30 fps.
// The clip opens on the drop; the date lands on the last bar. VHS treats the
// picture, while the type sits above it and stays sharp.
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Spectre, Synthwave, Vhs} from '../../../../../packages/elements/dist/components';

const START = 2.685; // the drop, in seconds
const BPM = 122;
const W = 1280;
const H = 720;

export const ReleaseTeaser = ({audioSrc = staticFile('single.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const bar = (60 / BPM) * 4 * fps;
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false, width: W, height: H};
	const title = interpolate(frame, [0, 10], [1.25, 1], {extrapolateRight: 'clamp'});
	const date = interpolate(frame, [bar * 3, bar * 3 + 8], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

	return (
		<AbsoluteFill style={{background: '#000'}}>
			<Vhs width={W} height={H} strength={0.8} glitch={0.04} line={0.25}>
				<Synthwave
					{...audio}
					playAudio
					bpm={BPM}
					hideSphere
					style={{position: 'absolute', inset: 0}}
				/>
				<Spectre
					{...audio}
					spectreVariant="segmented"
					colorMode="gradient"
					startColor="#ff5ad6"
					endColor="#7a5cff"
					count={40}
					style={{position: 'absolute', inset: 0}}
				/>
			</Vhs>

			{/* The type stays outside the tape so it reads at phone size. */}
			<AbsoluteFill
				style={{
					alignItems: 'center',
					justifyContent: 'center',
					paddingBottom: 40,
					color: '#fff',
					fontFamily: 'Geist, Inter, system-ui, sans-serif',
					textAlign: 'center',
					textShadow: '0 2px 24px rgb(20 0 40 / 0.8)',
				}}
			>
				<div style={{fontSize: 22, fontWeight: 600, letterSpacing: 10}}>MARA QUINN</div>
				<div
					style={{
						marginTop: 6,
						fontSize: 150,
						fontWeight: 900,
						lineHeight: 0.9,
						letterSpacing: -6,
						transform: `scale(${title})`,
						filter: 'drop-shadow(0 0 28px rgb(255 80 220 / 0.6))',
					}}
				>
					NIGHT DRIVE
				</div>
				<div
					style={{marginTop: 26, fontSize: 24, fontWeight: 600, letterSpacing: 8, opacity: date}}
				>
					NEW SINGLE · FRIDAY 21.11
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
