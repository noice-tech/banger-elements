import {Halo, Space, Fisheye} from '../../../../../packages/elements/dist/components';
import type {PreviewProps} from './types';

export const fisheyePreviewDefaults = {
	strength: 0.75,
	perspectiveFactor: 0.35,
};

export const FisheyePreview = ({
	width = 1280,
	height = 720,
	audioSrc = 'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-music-visualization/public/demo-track.mp3',
	audioOffsetInSeconds = 0,
	playAudio = true,
	...props
}: PreviewProps) => {
	const w = Number(width);
	const h = Number(height);
	const audio = {audioSrc: String(audioSrc), audioOffsetInSeconds: Number(audioOffsetInSeconds)};
	return (
		<Fisheye {...fisheyePreviewDefaults} {...props} width={w} height={h}>
			<Space
				{...audio}
				width={w}
				height={h}
				playAudio={false}
				style={{position: 'absolute', inset: 0}}
			/>
			<Halo
				{...audio}
				width={w}
				height={h}
				playAudio={Boolean(playAudio)}
				radius={0.12}
				intensity={0.8}
				centerMode="transparent"
				style={{position: 'absolute', inset: 0}}
			/>
			<div
				style={{
					position: 'absolute',
					inset: w * 0.035,
					border: `${Math.max(2, w * 0.002)}px solid #ffffff66`,
					backgroundImage:
						'linear-gradient(#ffffff18 1px, transparent 1px), linear-gradient(90deg, #ffffff18 1px, transparent 1px)',
					backgroundSize: `${w * 0.08}px ${w * 0.08}px`,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: w * 0.07,
					bottom: h * 0.08,
					color: '#fff4dc',
					fontFamily: 'sans-serif',
					fontSize: w * 0.018,
					letterSpacing: w * 0.005,
				}}
			>
				BANGER ELEMENTS / FISHEYE
			</div>
		</Fisheye>
	);
};
