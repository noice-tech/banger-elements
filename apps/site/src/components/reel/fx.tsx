import {createContext, useContext, type CSSProperties, type ReactNode} from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {BEAT, DROP, KICKS_END} from './scenes';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const outCubic = Easing.out(Easing.cubic);

/** The frame in the whole reel, from inside a scene that starts at `from`. */
export const useReelFrame = (from: number) => useCurrentFrame() + from;

/** 1 on a kick, easing to 0 before the next. Silent before the drop and on the last beat. */
export const kick = (frame: number, decay = 3) =>
	frame >= DROP && frame < KICKS_END ? Math.exp(-((frame - DROP) % BEAT) / decay) : 0;

/** The frames of every kick inside a stretch, for effects that spawn one thing per hit. */
export const kicksBetween = (from: number, to: number) => {
	const hits: number[] = [];
	for (let at = DROP; at < Math.min(to, KICKS_END); at += BEAT) if (at >= from) hits.push(at);
	return hits;
};

/** Frame-by-frame jitter, so impacts read as a hit rather than a wobble. */
export const Shake = ({
	frame,
	amount,
	children,
}: {
	frame: number;
	amount: number;
	children: ReactNode;
}) => {
	const x = (random(`shake-x-${frame}`) - 0.5) * 2 * amount;
	const y = (random(`shake-y-${frame}`) - 0.5) * 2 * amount;
	const turn = (random(`shake-r-${frame}`) - 0.5) * amount * 0.03;
	return (
		<AbsoluteFill style={{transform: `translate(${x}px, ${y}px) rotate(${turn}deg)`}}>
			{children}
		</AbsoluteFill>
	);
};

/** One expanding ring per birth frame. */
export const Shockwaves = ({
	frame,
	births,
	color,
	from = 80,
	to = 1100,
	life = 20,
	width = 4,
	strength = 1,
	y = '50%',
	x = '50%',
}: {
	frame: number;
	births: readonly number[];
	color: string;
	/** Start and end radius in px. */
	from?: number;
	to?: number;
	life?: number;
	width?: number;
	strength?: number;
	x?: string;
	y?: string;
}) => (
	<AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen'}}>
		{births.map((birth) => {
			const age = (frame - birth) / life;
			if (age < 0 || age > 1) return null;
			const radius = from + (to - from) * outCubic(age);
			const fade = (1 - age) ** 1.6 * strength;
			return (
				<div
					key={birth}
					style={{
						position: 'absolute',
						left: x,
						top: y,
						width: radius * 2,
						height: radius * 2,
						marginLeft: -radius,
						marginTop: -radius,
						borderRadius: '50%',
						border: `${width * (1 - age * 0.6)}px solid ${color}`,
						boxShadow: `0 0 ${36 * fade}px ${color}, inset 0 0 ${36 * fade}px ${color}`,
						opacity: fade,
					}}
				/>
			);
		})}
	</AbsoluteFill>
);

/** An anamorphic lens streak across the frame. */
export const Streak = ({
	amount,
	color = '#bcd4ff',
	y = '50%',
	thickness = 5,
}: {
	amount: number;
	color?: string;
	y?: string;
	thickness?: number;
}) => {
	if (amount <= 0.01) return null;
	const style: CSSProperties = {
		position: 'absolute',
		left: 0,
		right: 0,
		top: y,
		height: thickness,
		marginTop: -thickness / 2,
		background: `linear-gradient(90deg, transparent 0%, ${color} 30%, #fff 50%, ${color} 70%, transparent 100%)`,
		transform: `scaleX(${0.35 + amount * 0.65})`,
		opacity: amount,
		filter: `blur(${1 + thickness * 0.35}px)`,
		boxShadow: `0 0 ${40 * amount}px ${color}`,
		mixBlendMode: 'screen',
	};
	return <div style={style} />;
};

/** Scales every cut's punch; the recap's short cuts turn it down so a cut never outlasts its own entrance. */
export const CutScale = createContext(1);

/** Cuts in with a punch, and winds up for the next cut on its last frames. */
export const Cut = ({
	children,
	zoom: fullZoom = 0.3,
	blur: fullBlur = 14,
	flare: fullFlare = 0.9,
	length: fullLength = 9,
	anticipate = 3,
}: {
	children: ReactNode;
	zoom?: number;
	blur?: number;
	flare?: number;
	length?: number;
	anticipate?: number;
}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const scaleBy = useContext(CutScale);
	const [zoom, blur, flare] = [fullZoom * scaleBy, fullBlur * scaleBy, fullFlare * scaleBy];
	const length = Math.max(3, fullLength * scaleBy);
	const entering = 1 - outCubic(clamp(frame / length));
	const leaving = clamp((frame - (durationInFrames - anticipate)) / anticipate);
	const scale = 1 + zoom * entering + 0.06 * leaving;
	const light = 1 + flare * entering + 0.5 * leaving;
	return (
		<AbsoluteFill
			style={{
				transform: `scale(${scale})`,
				filter:
					entering > 0.004 || leaving > 0
						? `blur(${blur * entering}px) brightness(${light})`
						: undefined,
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

/** A 0..1 ramp over [start, end]. */
export const ramp = (
	frame: number,
	start: number,
	end: number,
	ease = Easing.inOut(Easing.cubic),
) =>
	interpolate(frame, [start, end], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: ease,
	});

/** Splits red and blue apart horizontally, the way a cheap lens fringes on a hit. */
export const Aberration = ({
	amount,
	brightness = 1,
	children,
}: {
	amount: number;
	brightness?: number;
	children: ReactNode;
}) => (
	<>
		<svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
			<filter
				id="reel-fringe"
				x="0"
				y="0"
				width="100%"
				height="100%"
				colorInterpolationFilters="sRGB"
			>
				<feColorMatrix
					in="SourceGraphic"
					type="matrix"
					values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
					result="r"
				/>
				<feColorMatrix
					in="SourceGraphic"
					type="matrix"
					values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
					result="g"
				/>
				<feColorMatrix
					in="SourceGraphic"
					type="matrix"
					values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
					result="b"
				/>
				<feOffset in="r" dx={-amount} result="ro" />
				<feOffset in="b" dx={amount} result="bo" />
				<feBlend in="ro" in2="g" mode="screen" result="rg" />
				<feBlend in="rg" in2="bo" mode="screen" />
			</filter>
		</svg>
		<AbsoluteFill style={{filter: `url(#reel-fringe) brightness(${brightness})`}}>
			{children}
		</AbsoluteFill>
	</>
);
