import {City, WetGlass} from '../../../../../packages/elements/dist/components';
import type {PreviewProps} from './types';

export const wetGlassPreviewDefaults = {
	amount: 0.65,
	speed: 1,
	dropSize: 1,
	refraction: 1,
	blur: 0.35,
	effectOpacity: 1,
	color: '#ffffff',
	seed: 4,
	timeOffsetInSeconds: 0,
};

export const WetGlassPreview = ({
	width = 1280,
	height = 720,
	audioSrc = 'https://remotion.media/elements/remotion-made-this-picture-move.mp3',
	audioOffsetInSeconds = 0,
	playAudio = true,
	...props
}: PreviewProps) => {
	const w = Number(width),
		h = Number(height);
	return (
		<WetGlass {...wetGlassPreviewDefaults} {...props} width={w} height={h}>
			<City
				width={w}
				height={h}
				audioSrc={String(audioSrc)}
				audioOffsetInSeconds={Number(audioOffsetInSeconds)}
				playAudio={Boolean(playAudio)}
				lightsColor="#ffbb88"
				startColor="#465269"
				style={{position: 'absolute', inset: 0}}
			/>
			<div
				style={{
					position: 'absolute',
					left: w * 0.08,
					top: h * 0.14,
					color: '#ffffff',
					fontFamily: 'sans-serif',
				}}
			>
				<div style={{fontSize: w * 0.014, letterSpacing: w * 0.005}}>
					BANGER ELEMENTS / WET GLASS
				</div>
				<div style={{fontSize: w * 0.07, fontWeight: 800, lineHeight: 1.1, marginTop: h * 0.03}}>
					AFTER
					<br />
					THE RAIN
				</div>
			</div>
		</WetGlass>
	);
};
