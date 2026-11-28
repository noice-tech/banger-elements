import {Halo, Space} from '../../../../../packages/elements/dist/components';

const PURPLE = '#9333ea';

/** The scene every effect preview wraps, so the effects differ only in their treatment. */
export const EffectScene = ({
	width,
	height,
	audioSrc,
	audioOffsetInSeconds,
	playAudio,
	label,
}: {
	width: number;
	height: number;
	audioSrc: string;
	audioOffsetInSeconds: number;
	playAudio: boolean;
	label: string;
}) => (
	<>
		<Space
			audioSrc={audioSrc}
			audioOffsetInSeconds={audioOffsetInSeconds}
			width={width}
			height={height}
			playAudio={false}
			baseColor={PURPLE}
			tintColor={PURPLE}
			tint={1}
			style={{position: 'absolute', inset: 0}}
		/>
		<Halo
			audioSrc={audioSrc}
			audioOffsetInSeconds={audioOffsetInSeconds}
			width={width}
			height={height}
			playAudio={playAudio}
			radius={0.12}
			intensity={0.8}
			colorMode="gradient"
			startColor="#ededed"
			endColor="#8a8a8a"
			centerMode="transparent"
			style={{position: 'absolute', inset: 0}}
		/>
		<div
			style={{
				position: 'absolute',
				inset: width * 0.035,
				border: `${Math.max(2, width * 0.002)}px solid #ffffff66`,
				backgroundImage:
					'linear-gradient(#ffffff18 1px, transparent 1px), linear-gradient(90deg, #ffffff18 1px, transparent 1px)',
				backgroundSize: `${width * 0.08}px ${width * 0.08}px`,
			}}
		/>
		<div
			style={{
				position: 'absolute',
				left: width * 0.07,
				bottom: height * 0.08,
				color: '#ffffff',
				fontFamily: 'sans-serif',
				fontSize: width * 0.018,
				letterSpacing: width * 0.005,
			}}
		>
			BANGER ELEMENTS / {label}
		</div>
	</>
);
