import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Chrome} from '../../../../../packages/elements/dist/components';

const BPM = 122; // the single's tempo, so the light pulses with it
const FADE = 1.5; // seconds of crossfade that hide the loop point

export const VerticalCanvas = ({audioSrc = staticFile('single.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height, durationInFrames} = useVideoConfig();
	const lap = durationInFrames / fps;
	// Spotify plays the Canvas on its own clock, so it ignores the audio and runs on time alone.
	const metal = {
		audioSrc,
		playAudio: false,
		width,
		height,
		bpm: BPM,
		responsive: 0,
		color1: '#14213f',
		color2: '#ff8a57',
		color3: '#f3dfca',
		warpSpeed: 0.4,
		style: {position: 'absolute', inset: 0},
	} as const;

	return (
		<AbsoluteFill style={{background: '#06070d'}}>
			<Chrome {...metal} />
			{/* The same shader one lap ahead fades out over the opening second, so the last frame
			    leads straight back into the first. */}
			<Chrome
				{...metal}
				timeOffsetInSeconds={lap}
				style={{...metal.style, opacity: Math.max(0, 1 - frame / (FADE * fps))}}
			/>
		</AbsoluteFill>
	);
};
