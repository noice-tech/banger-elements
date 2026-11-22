import {useWindowedAudioData, visualizeAudio} from '@remotion/media-utils';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Moon, Waveform, WetGlass} from '../../../../../packages/elements/dist/components';

const START = 0; // seconds into public/caden-currie-lofi.mp3
const STATION = 'Window Seat';
const NOW_PLAYING = {title: 'Lofi', artist: 'Caden Currie'};
const UP_NEXT = 'Invisible Light — Josh Woodward';
const CLOCK_START = 2 * 3600 + 14 * 60; // the stream opens at 2:14 am
const LAMP = '#ffb36b';
const WALL = '#1a1113';
const WOOD = '#3b2925';
// The glass, then the sash, the wall's depth and the trim around it, in pixels.
const GLASS = {left: 236, top: 96, right: 1044, bottom: 532};
const SASH = 18;
const REVEAL = 20;
const TRIM = 28;
const SILL = {top: 552, left: 150, right: 1130};

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

// The window around the glass: sash bars, the shadowed depth of the wall, painted trim and a deep sill.
const WindowFrame = ({width, height}: {width: number; height: number}) => {
	const {left, top, right, bottom} = GLASS;
	const s = {l: left - SASH, t: top - SASH, r: right + SASH, b: bottom + SASH};
	const d = {l: s.l - REVEAL, t: s.t - REVEAL, r: s.r + REVEAL};
	const midX = (left + right) / 2;
	const midY = (top + bottom) / 2;
	return (
		<svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
			<defs>
				<linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="#5a3d33" />
					<stop offset="0.5" stopColor={WOOD} />
					<stop offset="1" stopColor="#2a1c1a" />
				</linearGradient>
				<linearGradient id="sill-top" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stopColor="#6e4a3b" />
					<stop offset="1" stopColor="#3d2a25" />
				</linearGradient>
				<linearGradient id="sill-shadow" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#000" stopOpacity="0.55" />
					<stop offset="1" stopColor="#000" stopOpacity="0" />
				</linearGradient>
			</defs>
			{/* Trim around the opening. */}
			<path
				fillRule="evenodd"
				fill="url(#trim)"
				d={`M${d.l - TRIM} ${d.t - TRIM}H${d.r + TRIM}V${SILL.top}H${d.l - TRIM}Z M${d.l} ${d.t}H${d.r}V${SILL.top}H${d.l}Z`}
			/>
			{/* The wall's depth: lit from the lamp on the left, in shadow at the top and right. */}
			<path d={`M${d.l} ${d.t}H${d.r}L${s.r} ${s.t}H${s.l}Z`} fill="#0d0809" />
			<path d={`M${d.l} ${d.t}L${s.l} ${s.t}V${SILL.top}H${d.l}Z`} fill="#4a3029" />
			<path d={`M${d.r} ${d.t}L${s.r} ${s.t}V${SILL.top}H${d.r}Z`} fill="#160e0f" />
			{/* Sash and glazing bars. */}
			<path
				fillRule="evenodd"
				fill={WOOD}
				d={`M${s.l} ${s.t}H${s.r}V${s.b}H${s.l}Z M${left} ${top}H${right}V${bottom}H${left}Z`}
			/>
			<rect x={midX - 7} y={top} width={14} height={bottom - top} fill={WOOD} />
			<rect x={left} y={midY - 11} width={right - left} height={22} fill={WOOD} />
			<path
				d={`M${left} ${top}H${right}M${left} ${midY + 11}H${right}M${midX + 7} ${top}V${bottom}`}
				stroke="#000"
				strokeOpacity={0.45}
				strokeWidth={3}
			/>
			<path
				d={`M${s.l} ${s.t}V${s.b}M${left} ${midY - 11}H${right}`}
				stroke={LAMP}
				strokeOpacity={0.25}
				strokeWidth={2}
			/>
			{/* The sill: its top catches the lamp, its front edge drops into shadow. */}
			<rect
				x={SILL.left}
				y={SILL.top}
				width={SILL.right - SILL.left}
				height={20}
				rx={3}
				fill="url(#sill-top)"
			/>
			<rect
				x={SILL.left}
				y={SILL.top + 20}
				width={SILL.right - SILL.left}
				height={22}
				fill="#24181a"
			/>
			<rect
				x={SILL.left + 10}
				y={SILL.top + 42}
				width={SILL.right - SILL.left - 20}
				height={40}
				fill="url(#sill-shadow)"
			/>
		</svg>
	);
};

const Curtain = ({side, time}: {side: 'left' | 'right'; time: number}) => (
	<div
		style={{
			position: 'absolute',
			top: 0,
			bottom: 0,
			[side]: 0,
			width: 150,
			// Folds of heavy fabric, with a slow sway from the draught under the window.
			background: `repeating-linear-gradient(90deg, #4c231f 0 10px, #6a3129 22px, #3a1a18 38px, #4c231f 48px)`,
			backgroundPositionX: Math.sin(time * 0.7) * 3,
			boxShadow: side === 'left' ? '18px 0 40px #000a' : '-18px 0 40px #000a',
			filter: side === 'left' ? 'brightness(1.15)' : 'brightness(0.75)',
		}}
	/>
);

export const RainyStream = ({
	audioSrc = staticFile('caden-currie-lofi.mp3'),
}: {
	audioSrc?: string;
}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const bass = useBass(audioSrc);
	const time = frame / fps;
	const seconds = CLOCK_START + time;
	const audio = {audioSrc, audioOffsetInSeconds: START};
	const {left, top, right, bottom} = GLASS;

	return (
		<AbsoluteFill style={{background: WALL, color: '#fff4ea', fontFamily: 'Geist, sans-serif'}}>
			<WetGlass
				width={right - left}
				height={bottom - top}
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
					height={bottom - top}
					startColor="#7b5cff"
					speed={0.2}
					responsive={0.8}
				/>
			</WetGlass>

			<WindowFrame width={width} height={height} />
			<Curtain side="left" time={time} />
			<Curtain side="right" time={time + 1.3} />
			<div
				style={{position: 'absolute', left: 0, right: 0, top: 6, height: 12, background: '#2a1a16'}}
			/>

			{/* The lamp in the room warms the wall, the curtain and the trim on the left. */}
			<AbsoluteFill
				style={{
					background: `radial-gradient(ellipse 50% 80% at 4% 100%, ${LAMP}40, transparent 70%)`,
				}}
			/>

			{/* On the sill: a mug that still steams, and a clock that keeps the stream's time. */}
			<svg width={120} height={140} style={{position: 'absolute', left: 708, top: SILL.top - 138}}>
				{[0, 1, 2].map((i) => (
					<path
						key={i}
						d={`M${44 + i * 14} 70q${-8 + Math.sin(time * 1.3 + i) * 6} -16 0 -30t0 -30`}
						fill="none"
						stroke="#fff"
						strokeOpacity={0.16 + 0.08 * Math.sin(time * 2 + i * 2)}
						strokeWidth={4}
						strokeLinecap="round"
					/>
				))}
				<rect x={30} y={82} width={58} height={56} rx={8} fill="#c9b8a6" />
				<path d="M88 94a14 14 0 0 1 0 28" fill="none" stroke="#c9b8a6" strokeWidth={7} />
				<rect x={30} y={82} width={14} height={56} rx={6} fill="#fff" fillOpacity={0.25} />
			</svg>
			<div
				style={{
					position: 'absolute',
					left: 830,
					top: SILL.top - 56,
					padding: '8px 16px',
					borderRadius: 10,
					background: '#120c0d',
					boxShadow: `0 -1px 0 #ffffff14, 0 10px 24px #000a`,
					fontFamily: 'Geist Mono, monospace',
					fontSize: 28,
					color: LAMP,
					textShadow: `0 0 12px ${LAMP}99`,
				}}
			>
				{clockText(seconds).replace(':', Math.floor(seconds) % 2 ? ' ' : ':')}
			</div>
			{/* A plant leaning towards the glass. */}
			<svg width={150} height={170} style={{position: 'absolute', left: 968, top: SILL.top - 168}}>
				{[
					[-38, 70],
					[-12, 92],
					[16, 82],
					[42, 64],
					[-62, 50],
				].map(([angle, length]) => (
					<ellipse
						key={angle}
						cx={75}
						cy={118 - length! / 2}
						rx={14}
						ry={length! / 2}
						fill="#2f4a33"
						transform={`rotate(${angle! + Math.sin(time * 0.8 + angle!) * 2} 75 118)`}
					/>
				))}
				<path d="M46 116h58l-8 52H54z" fill="#a4573c" />
				<rect x={42} y={110} width={66} height={12} rx={3} fill="#b9664a" />
			</svg>

			<div style={{position: 'absolute', left: left + 36, top: top + 30}}>
				<div style={{fontSize: 50, fontWeight: 650, letterSpacing: -1.5}}>{STATION}</div>
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
					left: left + 36,
					bottom: height - bottom + 24,
					width: 360,
					padding: '14px 20px',
					borderRadius: 16,
					background: 'rgb(16 12 18 / 0.66)',
					border: '1px solid rgb(255 255 255 / 0.1)',
				}}
			>
				<div style={{fontSize: 14, letterSpacing: 2, opacity: 0.7}}>NOW PLAYING</div>
				<div style={{marginTop: 4, fontSize: 24, fontWeight: 600}}>
					{NOW_PLAYING.title}{' '}
					<span style={{opacity: 0.6, fontWeight: 400}}>{NOW_PLAYING.artist}</span>
				</div>
				<Waveform
					{...audio}
					playAudio={false}
					width={320}
					height={34}
					color={LAMP}
					inputGainDb={5}
					windowInSeconds={1.5}
					style={{marginTop: 8}}
				/>
				<div style={{marginTop: 8, fontSize: 15, opacity: 0.55}}>Up next: {UP_NEXT}</div>
			</div>
		</AbsoluteFill>
	);
};
