import type {CSSProperties, FC} from 'react';
import {AbsoluteFill, Easing, Sequence, useVideoConfig} from 'remotion';
import {
	AudioParticles,
	Circle,
	Ferrofluid,
	Fractals,
	Halo,
	Hyperloop,
	Liquid,
	Space,
	Spectre,
	Synthwave,
	Trip,
	Vhs,
	Waveform,
} from '../../../../../packages/elements/dist/components';
import {
	Cut,
	CutScale,
	Shake,
	Shockwaves,
	Streak,
	kick,
	kicksBetween,
	ramp,
	useReelFrame,
} from './fx';
import {BAR, BEAT, REEL_FPS, SONG_FRAME, TICK} from './scenes';

export const TRACK = 'https://cdn.banger.show/assets/banger-demo-song-min.mp3';
export const W = 1280;
export const H = 720;
export const fill: CSSProperties = {position: 'absolute', inset: 0};

export const layer = (from: number) => ({
	audioSrc: TRACK,
	audioOffsetInSeconds: (SONG_FRAME + from) / REEL_FPS,
	playAudio: false,
	width: W,
	height: H,
	style: fill,
});

export type Part = FC<{from: number; length: number}>;

const Intro: Part = ({from}) => {
	const frame = useReelFrame(from);
	const {durationInFrames} = useVideoConfig();
	const rise = ramp(frame, 0, BAR * 0.75, Easing.out(Easing.cubic));
	const charge = ramp(frame, BEAT * 2, durationInFrames - 3 * TICK, Easing.in(Easing.cubic));
	const ignite = ramp(frame, 5 * TICK, BEAT * 1.6, Easing.out(Easing.cubic));
	const blackout = frame >= durationInFrames - 3 * TICK ? 1 : 0;
	return (
		<AbsoluteFill style={{background: '#000'}}>
			<AbsoluteFill
				style={{
					transform: `scale(${1.32 - rise * 0.28 + charge * 0.1})`,
					opacity: 0.35 + rise * 0.65,
				}}
			>
				<Space
					{...layer(from)}
					baseColor="#7a5cff"
					speed={1.4}
					stellarDensity={22}
					zoom={1.1}
					responsive={2}
				/>
				<AudioParticles
					{...layer(from)}
					color="#d8ccff"
					density={26}
					intensity={5}
					radius={0.08}
					size={1.2}
					style={{...fill, opacity: 0.4 + charge * 0.6}}
				/>
				<AbsoluteFill
					style={{
						justifyContent: 'center',
						clipPath: `inset(0 ${(1 - ignite) * 50}% 0 ${(1 - ignite) * 50}%)`,
						filter: `drop-shadow(0 0 ${8 + charge * 22}px #8f6bff) saturate(0.75)`,
					}}
				>
					<Waveform
						{...layer(from)}
						height={H * 0.3}
						colorMode="frequency"
						intensity={0.7 + charge * 0.9}
						windowInSeconds={1.2}
						style={{position: 'relative'}}
					/>
				</AbsoluteFill>
			</AbsoluteFill>
			{[0, 1, 2, 3].map((beat) => (
				<Shockwaves
					key={beat}
					frame={frame}
					births={[Math.round(beat * BEAT)]}
					color="#c9b8ff"
					from={10}
					to={260 + beat * 120}
					life={BEAT * 1.2}
					width={2 + beat}
					strength={0.3 + beat * 0.22}
				/>
			))}
			<AbsoluteFill style={{background: '#000', opacity: blackout}} />
		</AbsoluteFill>
	);
};

const Drop: Part = ({from}) => {
	const frame = useReelFrame(from);
	const since = frame - from;
	const k = kick(frame);
	const turn = ramp(frame, from + BAR * 0.85, from + BAR * 1.25);
	const hits = kicksBetween(from, from + BAR * 2);
	return (
		<Cut zoom={0.55} blur={20} flare={1.8} length={11 * TICK}>
			<Shake frame={frame} amount={22 * Math.exp(-since / (14 * TICK)) + 4 * k}>
				<AbsoluteFill
					style={{
						transform: `scale(${1.06 + 0.1 * (since / (BAR * 2))})`,
						filter: `hue-rotate(${52 * turn}deg) saturate(${1.2 + 0.25 * turn})`,
					}}
				>
					<Hyperloop
						{...layer(from)}
						baseColor="#8a2cff"
						speed={3.2}
						depth={6}
						responsive={8}
						rotationSpeed={4}
					/>
					<AudioParticles
						{...layer(from)}
						color="#fff0ff"
						density={42}
						intensity={9}
						radius={0.14}
						maskHalo
						size={1.3}
					/>
					{frame >= from + BAR && (
						<Circle
							{...layer(from)}
							colorMode="rainbow"
							circleVariant="radial-bars"
							radius={0.62}
							count={96}
							style={{...fill, mixBlendMode: 'screen', transform: `scale(${1 + 0.05 * k})`}}
						/>
					)}
					<Halo
						{...layer(from)}
						colorMode="rainbow"
						centerMode="transparent"
						radius={0.14}
						intensity={2}
						glowBlur={30}
						glowSpread={18}
					/>
				</AbsoluteFill>
				<Shockwaves
					frame={frame}
					births={hits}
					color="#d9c2ff"
					from={150}
					to={980}
					life={22 * TICK}
					width={5}
				/>
				<Streak amount={k * 0.9} color="#cdb4ff" thickness={6} />
			</Shake>
		</Cut>
	);
};

const OPEN = 1e6;

const Ride: Part = ({from, length}) => {
	const frame = useReelFrame(from);
	const k = kick(frame);
	const second = ramp(frame, from + BAR, from + BAR * 1.15);
	const fillStart = from + length - BEAT;
	const wind = ramp(frame, fillStart, from + length, Easing.in(Easing.cubic));
	const stutter =
		frame >= fillStart ? Math.max(0, 1 - ((frame - fillStart) % (BEAT / 4)) / (BEAT / 8)) : 0;
	return (
		<Cut zoom={0.35} blur={16} flare={1.2}>
			<Shake frame={frame} amount={3 * k + 14 * wind}>
				<AbsoluteFill
					style={{
						transform: `scale(${1.02 + 0.05 * ((frame - from) / BAR / 2) + 0.5 * wind})`,
						transformOrigin: '50% 38%',
						filter: `saturate(${1.25 + 0.2 * second}) contrast(1.06)`,
					}}
				>
					<Synthwave
						{...layer(from)}
						bpm={122}
						sphereColor="#ff8a3d"
						endColor="#ff2bd6"
						responsive={4}
						mountainsHeight={4 + 3 * second}
					/>
					<AbsoluteFill
						style={{
							background: `repeating-conic-gradient(from ${((frame - from) / TICK) * 0.5}deg at 50% 29%, rgb(255 214 150 / 0.6) 0deg 4deg, transparent 4deg 14deg)`,
							maskImage: 'radial-gradient(circle at 50% 29%, #000 0%, transparent 72%)',
							mixBlendMode: 'screen',
							opacity: (0.18 + 0.3 * second) * (0.55 + 0.45 * k),
						}}
					/>
					<AudioParticles
						{...layer(from)}
						color="#ffd9f6"
						density={34}
						intensity={6}
						radius={0.5}
						size={1.1}
					/>
					<Spectre
						{...layer(from)}
						height={H * 0.46}
						style={{position: 'absolute', left: 0, bottom: 0, mixBlendMode: 'screen'}}
						colorMode="gradient"
						startColor="#ff2bd6"
						endColor="#38f0ff"
						spectreVariant="segmented"
						count={64}
						intensity={3.4 + 1.2 * second}
						bottom
					/>
				</AbsoluteFill>
				<Streak amount={k * 0.55 + stutter * 0.9} color="#ff9ee6" y="46%" thickness={4} />
				<AbsoluteFill
					style={{background: '#fff', opacity: stutter * 0.3 * wind, mixBlendMode: 'screen'}}
				/>
			</Shake>
		</Cut>
	);
};

// EXTERNAL: A scaling wrapper above the Vhs changes how Trip and Fractals render inside it.
const Tape: Part = ({from}) => {
	const frame = useReelFrame(from);
	const k = kick(frame);
	const second = frame >= from + BAR;
	const tear = Math.exp(-(frame - (second ? from + BAR : from)) / (9 * TICK));
	return (
		<Shake frame={frame} amount={1.5 * k + 7 * tear}>
			<Vhs
				width={W}
				height={H}
				strength={0.8 + 0.2 * k}
				horizontalDistortion={0.02 + 0.05 * tear + 0.01 * k}
				glitch={0.03 + 0.04 * tear}
				line={0.28 + 0.6 * tear}
				period={1.2}
			>
				{/* EXTERNAL: Vhs snapshots WebGL children once, so a new key each frame keeps them moving. */}
				<AbsoluteFill key={frame}>
					{second ? (
						<Fractals
							{...layer(from)}
							baseColor="#ff2bd6"
							mixColor="#3a5bff"
							zoom={1.2}
							responsive={4}
						/>
					) : (
						<Trip {...layer(from)} bpm={122} />
					)}
				</AbsoluteFill>
			</Vhs>
			<AbsoluteFill
				style={{
					mixBlendMode: 'screen',
					filter: 'blur(0.4px)',
					transform: `scale(${1 + 0.05 * k})`,
				}}
			>
				{second ? (
					<Circle
						{...layer(from)}
						colorMode="rainbow"
						circleVariant="radial-bars"
						radius={0.42}
						count={72}
						barWidth={0.6}
						intensity={5}
						rainbowSpeed={3}
					/>
				) : (
					<>
						<Circle
							{...layer(from)}
							colorMode="rainbow"
							circleVariant="radial-bars"
							radius={0.46}
							count={96}
							barWidth={0.55}
							intensity={6}
							rainbowSpeed={3}
						/>
						<Circle
							{...layer(from)}
							colorMode="rainbow"
							circleVariant="waveform-ring"
							radius={0.3}
							intensity={5}
							lineWidth={4}
							rainbowSpeed={3}
						/>
					</>
				)}
			</AbsoluteFill>
		</Shake>
	);
};

const Metal: Part = ({from, length}) => {
	const frame = useReelFrame(from);
	const k = kick(frame);
	const local = frame - from;
	const grow = ramp(frame, from, from + Math.min(length, BAR), Easing.out(Easing.quad));
	return (
		<Cut zoom={0.5} blur={18} flare={1.6}>
			<Shake frame={frame} amount={10 * Math.exp(-local / (8 * TICK)) + 5 * k}>
				<AbsoluteFill
					style={{filter: 'saturate(1.2) contrast(1.1)', transform: `scale(${1.04 + 0.1 * grow})`}}
				>
					<Liquid
						{...layer(from)}
						color1="#ff3d00"
						color2="#ffb300"
						glowColor="#ffe9c2"
						bpm={122}
						speed={0.9}
						swirl={1.6}
						distortion={0.5}
						responsive={1.2}
					/>
					<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
						<Ferrofluid
							{...layer(from)}
							width={W * 1.2}
							height={H * 1.2}
							color="#4a0b08"
							shineColor="#ff4a24"
							shineIntensity={6}
							shineSize={2.4}
							envMapIntensity={1.3}
							intensity={3.4}
							pattern={3}
							iridescence={0.15}
							rotationSpeed={1.6}
							style={{flex: 'none', transform: `scale(${1 + 0.07 * k})`}}
						/>
					</AbsoluteFill>
					<AudioParticles
						{...layer(from)}
						color="#ffd9a8"
						density={36}
						intensity={8}
						radius={0.3}
						size={1.1}
					/>
				</AbsoluteFill>
				<Shockwaves
					frame={frame}
					births={kicksBetween(from, from + length)}
					color="#ffb878"
					from={200}
					to={1000}
					life={20 * TICK}
					width={5}
				/>
			</Shake>
		</Cut>
	);
};

export const parts: Record<string, Part> = {
	intro: Intro,
	drop: Drop,
	ride: Ride,
	tape: Tape,
	metal: Metal,
};

export const Recap: Part = ({from, length}) => {
	const frame = useReelFrame(from);
	const eighth = BEAT / 2;
	const cuts = (['drop', 'ride', 'tape', 'metal'] as const).map((id, index) => ({
		id,
		start: Math.round(index * eighth),
		end: Math.round((index + 1) * eighth),
	}));
	const wallStart = Math.round(BEAT * 2);
	const fall = ramp(frame, from + BEAT * 3, from + length - 4 * TICK, Easing.in(Easing.quad));
	const white = ramp(
		frame,
		from + length - 12 * TICK,
		from + length - 5 * TICK,
		Easing.in(Easing.quad),
	);
	const tile = (index: number) => ({
		left: (index % 2) * (W / 2),
		top: Math.floor(index / 2) * (H / 2),
	});
	return (
		<AbsoluteFill style={{background: '#000'}}>
			{cuts.map(({id, start, end}) => {
				const Scene = parts[id]!;
				return (
					<Sequence key={id} from={start} durationInFrames={end - start} layout="none">
						<CutScale.Provider value={0.4}>
							<Scene from={from + start} length={OPEN} />
						</CutScale.Provider>
					</Sequence>
				);
			})}
			<Sequence from={wallStart} layout="none">
				<AbsoluteFill
					style={{
						background: '#000',
						transform: `scale(${Math.exp(Math.log(7) * fall)})`,
						filter: `brightness(${1 + 1.2 * fall})`,
					}}
				>
					{(['drop', 'ride', 'tape', 'metal'] as const).map((id, index) => {
						const Scene = parts[id]!;
						const delay = Math.round(index * (BEAT / 4));
						return (
							<Sequence key={id} from={delay} layout="none">
								<div
									style={{
										position: 'absolute',
										...tile(index),
										width: W / 2 - 2,
										height: H / 2 - 2,
										margin: 1,
										overflow: 'hidden',
									}}
								>
									<div
										style={{
											position: 'absolute',
											width: W,
											height: H,
											transform: 'scale(0.5)',
											transformOrigin: '0 0',
										}}
									>
										<CutScale.Provider value={0.6}>
											<Scene from={from + wallStart + delay} length={OPEN} />
										</CutScale.Provider>
									</div>
								</div>
							</Sequence>
						);
					})}
				</AbsoluteFill>
			</Sequence>
			<AbsoluteFill style={{background: '#fff', opacity: white}} />
		</AbsoluteFill>
	);
};
