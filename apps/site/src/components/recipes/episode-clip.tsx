// A square audiogram for a podcast or interview: 1080 × 1080 at 30 fps.
// Put the episode in public/episode.mp3 and set START to the moment you want.
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AudioParticles, Circle, Waveform} from '../../../../../packages/elements/dist/components';

const START = 26.29; // seconds into the episode
const SIZE = 1080;

export const EpisodeClip = ({audioSrc = staticFile('episode.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false};
	const progress = frame / durationInFrames;
	const rise = interpolate(frame, [0, 18], [0, 1], {extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill
			style={{
				background: 'radial-gradient(circle at 50% 34%, #2b1653 0%, #0b0913 68%)',
				color: '#f5f0ff',
				fontFamily: 'Geist, Inter, system-ui, sans-serif',
			}}
		>
			<AudioParticles
				{...audio}
				width={SIZE}
				height={SIZE}
				color="#c8a6ff"
				density={30}
				size={1.3}
			/>

			{/* Cover art with a ring that breathes with the voice. */}
			<AbsoluteFill style={{top: -150}}>
				<Circle
					{...audio}
					playAudio
					width={SIZE}
					height={SIZE}
					circleVariant="glow-ring"
					startColor="#b388ff"
					endColor="#ff7ad9"
					radius={0.3}
				/>
				<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
					<div
						style={{
							display: 'grid',
							placeItems: 'center',
							width: 300,
							height: 300,
							borderRadius: '50%',
							background: 'linear-gradient(140deg, #ff7ad9, #7b3cff 55%, #1d0d3f)',
							boxShadow: '0 30px 80px rgb(0 0 0 / 0.5)',
							fontSize: 92,
							fontWeight: 800,
							letterSpacing: -4,
						}}
					>
						NS
					</div>
				</AbsoluteFill>
			</AbsoluteFill>

			<div
				style={{
					position: 'absolute',
					left: 90,
					right: 90,
					top: 640,
					textAlign: 'center',
					opacity: rise,
					transform: `translateY(${(1 - rise) * 24}px)`,
				}}
			>
				<div style={{fontSize: 24, letterSpacing: 6, color: '#b9a8d9'}}>
					NIGHT SHIFT · EPISODE 42
				</div>
				<div
					style={{
						marginTop: 22,
						fontSize: 58,
						fontWeight: 700,
						lineHeight: 1.08,
						letterSpacing: -1.5,
					}}
				>
					Why every loud record sounds quiet now
				</div>
				<div style={{marginTop: 20, fontSize: 26, color: '#b9a8d9'}}>
					with Mara Quinn, mastering engineer
				</div>
			</div>

			<div style={{position: 'absolute', left: 90, right: 90, bottom: 96}}>
				<Waveform {...audio} width={SIZE - 180} height={90} color="#e9dcff" windowInSeconds={3} />
				<div
					style={{height: 4, marginTop: 18, borderRadius: 2, background: 'rgb(255 255 255 / 0.15)'}}
				>
					<div
						style={{
							width: `${progress * 100}%`,
							height: '100%',
							borderRadius: 2,
							background: '#e9dcff',
						}}
					/>
				</div>
			</div>
		</AbsoluteFill>
	);
};
