import {useWindowedAudioData, visualizeAudio} from '@remotion/media-utils';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Moon, Waveform, WetGlass} from '../../../../../packages/elements/dist/components';

const START = 0; // seconds into public/caden-currie-lofi.mp3
const STATION = 'Window Seat';
const NOW_PLAYING = {title: 'Lofi', artist: 'Caden Currie'};
const UP_NEXT = 'Rooftops — Mara Quinn';
const CLOCK_START = 2 * 3600 + 14 * 60; // the stream opens at 2:14 am
const LAMP = '#ffb36b';
const FRAME = '#110c10';
// The window: a frame, one mullion and a deep sill. Everything inside it is behind wet glass.
const WINDOW = {left: 40, right: 1240, top: 36, sill: 628, mullion: 812, bar: 22};

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

const clockText = (seconds: number) => {
	const minutes = Math.floor(seconds / 60);
	return `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, '0')}`;
};

export const RainyStream = ({
	audioSrc = staticFile('caden-currie-lofi.mp3'),
}: {
	audioSrc?: string;
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const bass = useBass(audioSrc);
	const seconds = CLOCK_START + frame / fps;
	const audio = {audioSrc, audioOffsetInSeconds: START};
	const {left, right, top, sill, mullion, bar} = WINDOW;

	return (
		<AbsoluteFill style={{background: FRAME, color: '#fff4ea', fontFamily: 'Geist, sans-serif'}}>
			<WetGlass
				width={right - left}
				height={sill - top}
				amount={0.75}
				speed={0.5}
				blur={0.35}
				seed={7}
				style={{position: 'absolute', left, top}}
			>
				<Moon
					{...audio}
					playAudio
					width={right - left}
					height={sill - top}
					startColor="#7b5cff"
					speed={0.2}
					responsive={0.8}
				/>
			</WetGlass>

			{/* The lamp in the room reflects in the glass and catches the frame. */}
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 55% 70% at 8% 100%, ${LAMP}33, transparent 70%)`,
				}}
			/>
			<svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
				<defs>
					<linearGradient id="sill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="#4a3026" />
						<stop offset="0.12" stopColor="#22161a" />
						<stop offset="1" stopColor={FRAME} />
					</linearGradient>
					<linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
						<stop offset="0" stopColor={LAMP} stopOpacity="0.4" />
						<stop offset="0.6" stopColor={LAMP} stopOpacity="0.06" />
					</linearGradient>
				</defs>
				<path
					fillRule="evenodd"
					fill={FRAME}
					d={`M0 0H${width}V${height}H0Z M${left} ${top}H${mullion}V${sill}H${left}Z M${mullion + bar} ${top}H${right}V${sill}H${mullion + bar}Z`}
				/>
				<rect x={0} y={sill} width={width} height={height - sill} fill="url(#sill)" />
				<path
					d={`M${left} ${sill}V${top}H${mullion}V${sill}M${mullion + bar} ${sill}V${top}H${right}`}
					fill="none"
					stroke="url(#edge)"
					strokeWidth={2}
				/>
			</svg>

			{/* A clock on the sill: the time keeps moving while the stream is live. */}
			<div
				style={{
					position: 'absolute',
					right: 96,
					bottom: height - sill - 6,
					padding: '10px 18px',
					borderRadius: 10,
					background: '#1b1214',
					boxShadow: `0 -1px 0 #ffffff14, 0 10px 30px #000a`,
					fontFamily: 'Geist Mono, monospace',
					fontSize: 30,
					color: LAMP,
					textShadow: `0 0 12px ${LAMP}99`,
				}}
			>
				{clockText(seconds).replace(':', Math.floor(seconds) % 2 ? ' ' : ':')}
			</div>

			<div style={{position: 'absolute', left: left + 40, top: top + 36}}>
				<div style={{fontSize: 52, fontWeight: 650, letterSpacing: -1.5}}>{STATION}</div>
				<div
					style={{
						marginTop: 10,
						display: 'flex',
						alignItems: 'center',
						gap: 10,
						fontSize: 20,
						opacity: 0.85,
					}}
				>
					<span
						style={{
							width: 10,
							height: 10,
							borderRadius: 5,
							background: '#ff5a4e',
							boxShadow: `0 0 ${4 + bass * 14}px #ff5a4e`,
						}}
					/>
					lo-fi radio, live all night
				</div>
			</div>

			<div
				style={{
					position: 'absolute',
					left: left + 40,
					bottom: height - sill + 36,
					width: 400,
					padding: '18px 22px',
					borderRadius: 16,
					background: 'rgb(16 12 18 / 0.66)',
					border: '1px solid rgb(255 255 255 / 0.1)',
				}}
			>
				<div style={{fontSize: 15, letterSpacing: 2, opacity: 0.7}}>NOW PLAYING</div>
				<div style={{marginTop: 6, fontSize: 26, fontWeight: 600}}>
					{NOW_PLAYING.title}{' '}
					<span style={{opacity: 0.6, fontWeight: 400}}>{NOW_PLAYING.artist}</span>
				</div>
				<Waveform
					{...audio}
					playAudio={false}
					width={356}
					height={44}
					color={LAMP}
					inputGainDb={5}
					windowInSeconds={1.5}
					style={{marginTop: 12}}
				/>
				<div style={{marginTop: 12, fontSize: 16, opacity: 0.55}}>Up next: {UP_NEXT}</div>
			</div>
		</AbsoluteFill>
	);
};
