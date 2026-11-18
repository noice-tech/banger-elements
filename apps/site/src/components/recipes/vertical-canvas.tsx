// Four bars at 122 BPM, so it loops on the beat.
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Ferrofluid, Liquid} from '../../../../../packages/elements/dist/components';

const START = 18.42; // seconds into the track, on a downbeat
const W = 1080;
const H = 1920;

export const VerticalCanvas = ({audioSrc = staticFile('track.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false};

	return (
		<AbsoluteFill
			style={{background: '#000', color: '#fff', fontFamily: 'Geist, Inter, system-ui, sans-serif'}}
		>
			<Liquid {...audio} playAudio width={W} height={H} glowColor="#ff5a1f" bpm={122} />
			<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 260}}>
				<Ferrofluid
					{...audio}
					width={W * 1.1}
					height={W * 1.1}
					shineColor="#ffd2a8"
					style={{flex: 'none'}}
				/>
			</AbsoluteFill>

			<div style={{position: 'absolute', left: 80, right: 80, bottom: 170}}>
				<div style={{fontSize: 34, letterSpacing: 9, opacity: 0.8}}>MARA QUINN</div>
				<div
					style={{
						marginTop: 12,
						fontSize: 120,
						fontWeight: 800,
						letterSpacing: -5,
						lineHeight: 0.95,
					}}
				>
					Low Light
				</div>
				<div
					style={{height: 6, marginTop: 48, borderRadius: 3, background: 'rgb(255 255 255 / 0.25)'}}
				>
					<div
						style={{
							width: `${(frame / durationInFrames) * 100}%`,
							height: '100%',
							borderRadius: 3,
							background: '#fff',
						}}
					/>
				</div>
			</div>
		</AbsoluteFill>
	);
};
