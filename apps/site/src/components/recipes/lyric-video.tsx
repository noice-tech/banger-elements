import {useWindowedAudioData, visualizeAudio} from '@remotion/media-utils';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {AudioParticles, Halo} from '../../../../../packages/elements/dist/components';

const START = 0; // seconds into public/haze.mp3
const CREDIT = 'Zutsuri — Haze';
// Seconds after START: when each line is sung. Two lines share a screen.
const LINES = [
	{from: 2.1, to: 5.8, text: 'Sleepless nights and endless fights'},
	{from: 6.2, to: 10.6, text: 'You’re the one that she’s begun to'},
	{from: 11.0, to: 12.0, text: 'Love to hate', title: true},
	{from: 15.3, to: 17.6, text: 'Yeah, she loves to hate you'},
];
// The words fill the top two thirds. The light rises from the bottom edge like a sun.
const WORDS_HEIGHT = 0.64; // share of the frame height the lyrics are centred in
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

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

// Each word fades up as it is sung. Timing is spread by word length, so cues only need line times.
const Line = ({text, sung, glow}: {text: string; sung: number; glow: string}) => {
	const length = text.length + 1;
	let start = 0;
	return (
		<div>
			{text.split(' ').map((word, i) => {
				const from = start / length;
				start += word.length + 1;
				const shown = interpolate(sung, [from, start / length], [0, 1], clamp);
				return (
					<span
						key={i}
						style={{
							display: 'inline-block',
							marginRight: '0.24em',
							opacity: shown,
							transform: `translateY(${(1 - shown) * 12}px)`,
							textShadow: glow,
						}}
					>
						{word}
					</span>
				);
			})}
		</div>
	);
};

export const LyricVideo = ({audioSrc = staticFile('haze.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const time = frame / fps;
	const bass = useBass(audioSrc);

	// Show the couplet whose first line has started.
	const started = LINES.filter((line) => time >= line.from).length;
	const first = Math.max(0, started - 1 - ((started - 1) % 2));
	const screen = LINES.slice(first, first + 2);
	const title = LINES.find((line) => line.title)!;
	// The light turns visible on the title line, then settles but keeps its colour.
	const seen = time >= title.from;
	const rise = interpolate(
		time,
		[title.from, title.from + 0.4, title.to + 1, title.to + 3],
		[0, 1, 1, 0.3],
		clamp,
	);
	const glow = `0 2px 18px #000, 0 0 ${8 + bass * 28}px rgb(255 244 230 / ${0.3 + rise * 0.4})`;
	const audio = {audioSrc, audioOffsetInSeconds: START};
	// Halo scales with its canvas height, so a taller canvas draws a bigger ring, flares and glow alike.
	const haloHeight = height * 1.25;

	return (
		<AbsoluteFill
			style={{
				background: `radial-gradient(ellipse 70% 90% at 50% 100%, rgb(${90 + rise * 80} 60 255 / ${0.2 + rise * 0.25}), #05050b 70%)`,
				color: '#fff',
				fontFamily: 'Geist, sans-serif',
			}}
		>
			{/* Both layers draw around the middle of their canvas, so each canvas is centred on the
			    bottom edge. The particles get one twice the frame's size so they reach the top;
			    halving size and radius keeps them looking as they would at frame size. */}
			<AudioParticles
				{...audio}
				playAudio={false}
				width={width * 2}
				height={height * 2}
				style={{position: 'absolute', left: -width / 2, top: 0}}
				color={seen ? '#ffe9cf' : '#a99cff'}
				density={40}
				radius={0.15}
				size={0.5}
			/>
			<Halo
				{...audio}
				playAudio
				width={width}
				height={haloHeight}
				style={{position: 'absolute', left: 0, top: height - haloHeight / 2}}
				colorMode={seen ? 'rainbow' : 'gradient'}
				startColor="#ffffff"
				endColor="#6f5cff"
				centerMode="transparent"
				inputGainDb={-6}
				// Kept small enough that the tallest flares stay inside the canvas.
				radius={0.135 + rise * 0.02}
				intensity={0.45 + rise * 0.45}
				glowBlur={24}
				glowSpread={8}
			/>

			<div style={{position: 'absolute', top: 48, left: 64, fontSize: 22, opacity: 0.55}}>
				{CREDIT}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 100,
					right: 100,
					top: 0,
					height: height * WORDS_HEIGHT,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					textAlign: 'center',
					gap: 18,
					textWrap: 'balance',
					fontWeight: 650,
					letterSpacing: -2.5,
					lineHeight: 1.08,
				}}
			>
				{screen.map((line, i) => {
					// Once the second line starts, the first steps back.
					const next = screen[i + 1];
					const dim = next ? interpolate(time, [next.from, next.from + 0.3], [1, 0.4], clamp) : 1;
					return (
						<div key={line.text} style={{fontSize: line.title ? 80 : 60, opacity: dim}}>
							<Line
								text={line.text}
								glow={glow}
								sung={interpolate(time, [line.from, line.to], [0, 1], clamp)}
							/>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
