import {
	AbsoluteFill,
	Easing,
	interpolate,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {Rail} from '../../../../../packages/elements/dist/components';

const GLARE = 0.7; // seconds the sun's glare takes to fill and clear the frame around the loop point
const SUN = '#fff3c4';

export const VerticalCanvas = ({audioSrc = staticFile('haze.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height, durationInFrames} = useVideoConfig();
	// The ride flies into the sun at the end and comes out of it at the start, so the loop point is a white frame.
	const edge = Math.min(frame, durationInFrames - 1 - frame) / (GLARE * fps);
	const glare = interpolate(edge, [0, 1], [1, 0], {
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.quad),
	});

	return (
		<AbsoluteFill style={{background: SUN}}>
			{/* Spotify plays the Canvas on its own clock, out of step with the song, so the ride ignores the audio. */}
			<Rail
				audioSrc={audioSrc}
				playAudio={false}
				volume={0}
				width={width}
				height={height}
				startColor="#ff8fd0"
				endColor="#6a3cff"
				sunPosition={0.12}
				sunSize={0.3}
			/>
			<AbsoluteFill
				style={{
					opacity: glare,
					mixBlendMode: 'screen',
					background: `radial-gradient(circle at 50% 30%, #fff, ${SUN} 45%, #ffb8e6 100%)`,
				}}
			/>
			{/* At the loop point itself the light covers everything, so both ends match exactly. */}
			<AbsoluteFill style={{opacity: Math.max(0, glare * 3 - 2), background: SUN}} />
		</AbsoluteFill>
	);
};
