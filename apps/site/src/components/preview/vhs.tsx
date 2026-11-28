import {Vhs} from '../../../../../packages/elements/dist/components';
import {EffectScene} from './effect-scene';
import type {PreviewProps} from './types';

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
	audioSrc = 'https://banger-elements.dev/audio/tracks/banger-demo-song.mp3',
	audioOffsetInSeconds = 0,
	playAudio = true,
	...props
}: PreviewProps) => {
	const w = Number(width);
	const h = Number(height);
	return (
		<Vhs {...vhsPreviewDefaults} {...props} width={w} height={h}>
			<EffectScene
				width={w}
				height={h}
				audioSrc={String(audioSrc)}
				audioOffsetInSeconds={Number(audioOffsetInSeconds)}
				playAudio={Boolean(playAudio)}
				label="VHS"
			/>
		</Vhs>
	);
};
