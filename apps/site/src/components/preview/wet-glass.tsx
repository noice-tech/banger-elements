import {WetGlass} from '../../../../../packages/elements/dist/components';
import {EffectScene} from './effect-scene';
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
	audioSrc = 'https://banger-elements.dev/audio/tracks/banger-demo-song.mp3',
	audioOffsetInSeconds = 0,
	playAudio = true,
	...props
}: PreviewProps) => {
	const w = Number(width);
	const h = Number(height);
	return (
		<WetGlass {...wetGlassPreviewDefaults} {...props} width={w} height={h}>
			<EffectScene
				width={w}
				height={h}
				audioSrc={String(audioSrc)}
				audioOffsetInSeconds={Number(audioOffsetInSeconds)}
				playAudio={Boolean(playAudio)}
				label="WET GLASS"
			/>
		</WetGlass>
	);
};
