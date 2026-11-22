import {useWindowedAudioData, visualizeAudio} from '@remotion/media-utils';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Circle, Neuron} from '../../../../../packages/elements/dist/components';

const START = 1.7; // seconds into public/single.mp3: one beat before the drop
const BPM = 122;
const ARTIST = 'Mara Quinn';
const TITLE = 'Night Drive';
const TRACK_LENGTH = 3 * 60 + 34; // seconds, for the progress bar
const AMBER = '#ffb27a';

// How loud the low end is on this frame, from 0 to 1.
const useBass = (src: string) => {
	const {fps} = useVideoConfig();
	const frame = useCurrentFrame() + Math.round(START * fps);
	const {audioData, dataOffsetInSeconds} = useWindowedAudioData({
		src,
		frame,
		fps,
		windowInSeconds: 10,
	});
	if (!audioData) return 0;
	const bins = visualizeAudio({audioData, frame, fps, numberOfSamples: 32, dataOffsetInSeconds});
	return Math.min(1, (bins[0] + bins[1] + bins[2] + bins[3]) * 1.5);
};

const clock = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export const MusicVisualizer = ({audioSrc = staticFile('single.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const bass = useBass(audioSrc);
	const elapsed = START + frame / fps;
	const audio = {audioSrc, audioOffsetInSeconds: START};

	return (
		<AbsoluteFill style={{background: '#04060c', color: '#fff', fontFamily: 'Geist, sans-serif'}}>
			<Neuron
				{...audio}
				playAudio={false}
				width={width}
				height={height}
				bpm={BPM}
				color1="#1d3566"
				color2="#ff7e5a"
				glowColor={AMBER}
				cameraMovement={0.6}
				style={{transform: `scale(${1 + bass * 0.05})`}}
			/>
			<AbsoluteFill
				style={{
					background: 'radial-gradient(circle, #04060c 14%, transparent 36%, #04060cb0 100%)',
				}}
			/>
			<Circle
				{...audio}
				playAudio
				width={width}
				height={height}
				circleVariant="radial-bars"
				colorMode="gradient"
				startColor={AMBER}
				endColor="#fff4e6"
				radius={0.7}
				count={120}
				style={{position: 'absolute', inset: 0}}
			/>
			{/* The title sits in the tunnel's dark centre and kicks with the bass. */}
			<AbsoluteFill
				style={{
					alignItems: 'center',
					justifyContent: 'center',
					textAlign: 'center',
					transform: `scale(${1 + bass * 0.08})`,
				}}
			>
				<div style={{fontFamily: 'Syncopate, sans-serif', fontSize: 34, fontWeight: 700}}>
					{TITLE.toUpperCase()}
				</div>
				<div style={{marginTop: 8, fontSize: 20, color: AMBER}}>{ARTIST}</div>
			</AbsoluteFill>

			<div
				style={{
					position: 'absolute',
					left: 64,
					right: 64,
					bottom: 44,
					display: 'flex',
					alignItems: 'center',
					gap: 18,
					fontFamily: 'Geist Mono, monospace',
					fontSize: 17,
				}}
			>
				<span>{clock(elapsed)}</span>
				<div style={{flex: 1, height: 3, background: '#ffffff33'}}>
					<div
						style={{width: `${(elapsed / TRACK_LENGTH) * 100}%`, height: 3, background: AMBER}}
					/>
				</div>
				<span style={{opacity: 0.6}}>{clock(TRACK_LENGTH)}</span>
			</div>
		</AbsoluteFill>
	);
};
