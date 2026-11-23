import {useWindowedAudioData, visualizeAudio} from '@remotion/media-utils';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Flowers, Spectre} from '../../../../../packages/elements/dist/components';

const START = 0; // seconds into public/haze.mp3
const SONG = {title: 'Haze', artist: 'Zutsuri', album: 'Fen', year: 2016};
// For the progress bar: where this clip sits in the song, and the song's length.
// Set CLIP_AT to 0 when you render the whole track.
const CLIP_AT = 144.9;
const TRACK_LENGTH = 5 * 60 + 37;
const COVER = 400;

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

export const MusicVisualizer = ({audioSrc = staticFile('haze.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const bass = useBass(audioSrc);
	const elapsed = CLIP_AT + frame / fps;
	const audio = {audioSrc, audioOffsetInSeconds: START};

	return (
		<AbsoluteFill style={{background: '#0b0410', color: '#fff', fontFamily: 'Geist, sans-serif'}}>
			{/* The artwork again, drawn small and stretched over the frame, washes the background in its colours. */}
			<Flowers
				{...audio}
				playAudio={false}
				width={width / 8}
				height={height / 8}
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					transformOrigin: '0 0',
					transform: 'scale(8)',
					filter: `blur(3px) saturate(1.4) brightness(${0.45 + bass * 0.25})`,
				}}
			/>
			<AbsoluteFill
				style={{background: 'radial-gradient(ellipse at 30% 50%, transparent 20%, #0b0410cc 90%)'}}
			/>

			<div
				style={{
					position: 'absolute',
					left: 104,
					top: (height - COVER) / 2,
					width: COVER,
					height: COVER,
					borderRadius: 14,
					overflow: 'hidden',
					boxShadow: '0 30px 80px #000c',
					transform: `scale(${1 + bass * 0.03})`,
				}}
			>
				<Flowers {...audio} playAudio width={COVER} height={COVER} scale={26} />
			</div>

			<div style={{position: 'absolute', left: 104 + COVER + 72, right: 96, top: 186}}>
				<div style={{fontSize: 30, fontWeight: 500, opacity: 0.85}}>{SONG.artist}</div>
				<div style={{fontSize: 132, fontWeight: 800, letterSpacing: -6, lineHeight: 1}}>
					{SONG.title}
				</div>
				<div style={{marginTop: 10, fontSize: 21, opacity: 0.6}}>
					from {SONG.album} · {SONG.year}
				</div>
				<Spectre
					{...audio}
					playAudio={false}
					width={width - (104 + COVER + 72) - 96}
					height={120}
					count={40}
					barWidth={9}
					bottom
					inputGainDb={12}
					colorMode="rainbow"
					style={{marginTop: 26}}
				/>
				<div
					style={{
						marginTop: 18,
						display: 'flex',
						alignItems: 'center',
						gap: 16,
						fontFamily: 'Geist Mono, monospace',
						fontSize: 16,
					}}
				>
					<span>{clock(elapsed)}</span>
					<div style={{flex: 1, height: 4, borderRadius: 2, background: '#ffffff30'}}>
						<div
							style={{
								width: `${(elapsed / TRACK_LENGTH) * 100}%`,
								height: 4,
								borderRadius: 2,
								background: '#fff',
							}}
						/>
					</div>
					<span style={{opacity: 0.6}}>-{clock(TRACK_LENGTH - elapsed)}</span>
				</div>
			</div>
		</AbsoluteFill>
	);
};
