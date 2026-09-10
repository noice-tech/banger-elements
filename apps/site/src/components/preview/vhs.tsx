import {useCurrentFrame, useVideoConfig} from 'remotion';
import {Halo, Space, Vhs} from '../../../../../packages/elements/dist/components';
import type {PreviewProps} from './types';

// Demo children belong to the showcase, never the installed wrapper source.
// The maintained gallery render uses this same component and settings.
export const vhsPreviewDefaults = {
	strength: 1,
	horizontalDistortion: 0.02,
	glitch: 0.04,
	line: 0.28,
	period: 1.2,
	timeOffsetInSeconds: 0,
};

export const VhsPreview = ({
	width = 1280,
	height = 720,
	audioSrc = 'https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/template-music-visualization/public/demo-track.mp3',
	audioOffsetInSeconds = 0,
	playAudio = true,
	...props
}: PreviewProps) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const w = Number(width);
	const h = Number(height);
	const audio = {audioSrc: String(audioSrc), audioOffsetInSeconds: Number(audioOffsetInSeconds)};
	return (
		<Vhs {...vhsPreviewDefaults} {...props} width={w} height={h}>
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
				radius={0.09}
				intensity={0.6}
				centerMode="transparent"
				style={{position: 'absolute', inset: 0}}
			/>
			<div
				style={{
					position: 'absolute',
					left: w * 0.05,
					top: h * 0.07,
					color: '#fff4dc',
					fontFamily: 'sans-serif',
					transform: `translateX(${Math.sin((frame / fps) * 1.5) * w * 0.009}px)`,
				}}
			>
				<div style={{fontSize: w * 0.014, letterSpacing: w * 0.004}}>
					BANGER ELEMENTS / TAPE 001
				</div>
			</div>
		</Vhs>
	);
};
