import {Fisheye} from '../../../../../packages/elements/dist/components';
import {EffectScene} from './effect-scene';
import type {PreviewProps} from './types';

export const fisheyePreviewDefaults = {
	strength: 0.75,
	perspectiveFactor: 0.35,
};

export const FisheyePreview = ({
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
		<Fisheye {...fisheyePreviewDefaults} {...props} width={w} height={h}>
			<EffectScene
				width={w}
				height={h}
				audioSrc={String(audioSrc)}
				audioOffsetInSeconds={Number(audioOffsetInSeconds)}
				playAudio={Boolean(playAudio)}
				label="FISHEYE"
			/>
		</Fisheye>
	);
};
