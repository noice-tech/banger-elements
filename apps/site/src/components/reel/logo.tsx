import {Easing, Img, spring, staticFile, useVideoConfig} from 'remotion';
import {BEAT, BAR, TICK} from './scenes';
import {pulse, ramp} from './fx';
import {BANGER, ELEMENTS, type Letter} from './wordmark';

const VIEW = {x: -1432, y: -826, width: 5217, height: 1331};
const ICON = {x: -1432, y: -818, width: 1281, height: 1297};
const ICON_CENTER = ICON.x + ICON.width / 2;
const LOCKUP_CENTER = VIEW.x + VIEW.width / 2;
const WORDMARK_CENTER = 1862;

export const LOGO_WIDTH = 940;
const UNIT = LOGO_WIDTH / VIEW.width;
export const LOGO_HEIGHT = VIEW.height * UNIT;

const SLIDE = BEAT;
const FIRST_LETTER = BEAT + 6.5 * TICK;
const ELEMENTS_AT = BEAT * 3;
const LETTER_EVERY = (ELEMENTS_AT - FIRST_LETTER) / 6;
const IGNITE = BAR;

const springIn = (frame: number, fps: number, damping = 10) =>
	frame < 0 ? 0 : spring({frame, fps, config: {damping, stiffness: 260, mass: 0.45}});

const px = (devicePixels: number) => devicePixels / UNIT;

const Stamp = ({
	letter,
	start,
	o,
	fps,
}: {
	letter: Letter;
	start: number;
	o: number;
	fps: number;
}) => {
	const pop = springIn(o - start, fps);
	if (o < start) return null;
	const opacity = Math.min(1, (o - start) / (1.5 * TICK));
	return (
		<g
			style={{
				transformBox: 'fill-box',
				transformOrigin: '50% 60%',
				transform: `scale(${1 + 1.4 * (1 - pop)})`,
				filter: pop < 0.995 ? `blur(${px(14 * (1 - pop))}px)` : undefined,
				opacity,
			}}
		>
			<path d={letter.d} fill="url(#reel-logo-fill)" />
		</g>
	);
};

const Unfurl = ({letter, index, o}: {letter: Letter; index: number; o: number}) => {
	const start = ELEMENTS_AT + index * 0.7 * TICK;
	const spread = 1 - Easing.out(Easing.exp)(Math.min(1, Math.max(0, (o - start) / (13 * TICK))));
	if (o < start) return null;
	const center = letter.x + letter.width / 2;
	return (
		<g
			style={{
				transform: `translateX(${(WORDMARK_CENTER - center) * spread}px)`,
				filter: spread > 0.01 ? `blur(${px(10 * spread)}px)` : undefined,
				opacity: Math.min(1, (o - start) / (2 * TICK)),
			}}
		>
			<path d={letter.d} fill="url(#reel-logo-fill)" />
		</g>
	);
};

export const Logo = ({o, k}: {o: number; k: number}) => {
	const {fps} = useVideoConfig();
	const slam = springIn(o, fps, 12);
	const slide = ramp(o, SLIDE, SLIDE + 7 * TICK, Easing.bezier(0.7, 0, 0.2, 1));
	const ignite = pulse(o, IGNITE, 5 * TICK);
	const landing = pulse(o, ELEMENTS_AT, 6 * TICK);
	const breathe = 1 + 0.02 * k + 0.012 * landing;
	const markScale = (1 + 1.1 * (1 - slam)) * (1 + 0.85 * (1 - slide));
	const markShift = (LOCKUP_CENTER - ICON_CENTER) * UNIT * (1 - slide);
	const glint = ramp(o, IGNITE + 3 * TICK, IGNITE + 24 * TICK, Easing.inOut(Easing.quad));
	const glintX = -700 + glint * 5100;
	const glow = 0.45 + 0.2 * k + 0.45 * ignite;
	return (
		<div
			style={{
				position: 'absolute',
				left: '50%',
				top: '50%',
				width: LOGO_WIDTH,
				height: LOGO_HEIGHT,
				marginLeft: -LOGO_WIDTH / 2,
				marginTop: -LOGO_HEIGHT / 2,
				transform: `scale(${breathe})`,
				filter: `drop-shadow(0 0 ${14 * glow}px rgb(143 107 255 / ${Math.min(1, glow)})) drop-shadow(0 0 ${60 * glow}px rgb(122 92 255 / 0.55)) brightness(${1 + 0.3 * ignite})`,
			}}
		>
			<Img
				src={staticFile('brand/banger-mark-512.webp')}
				style={{
					position: 'absolute',
					left: (ICON.x - VIEW.x) * UNIT,
					top: (ICON.y - VIEW.y) * UNIT,
					width: ICON.width * UNIT,
					height: ICON.height * UNIT,
					transform: `translateX(${markShift}px) scale(${markScale})`,
					filter: slam < 0.99 ? `blur(${18 * (1 - slam)}px)` : undefined,
					opacity: Math.min(1, o / (1.2 * TICK) + 0.001),
				}}
			/>
			<svg
				viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
				width={LOGO_WIDTH}
				height={LOGO_HEIGHT}
				style={{position: 'absolute', inset: 0, overflow: 'visible'}}
			>
				<defs>
					<linearGradient
						id="reel-logo-fill"
						gradientUnits="userSpaceOnUse"
						x1="0"
						y1="-725"
						x2="0"
						y2="494"
					>
						<stop offset="0" stopColor="#ffffff" />
						<stop offset="1" stopColor="#e6dcff" />
					</linearGradient>
					<clipPath id="reel-logo-band">
						<polygon
							transform={`translate(${glintX} 0)`}
							points="0,-900 460,-900 100,700 -360,700"
						/>
					</clipPath>
				</defs>
				<g>
					{BANGER.map((letter, index) => (
						<Stamp
							key={index}
							letter={letter}
							start={FIRST_LETTER + index * LETTER_EVERY}
							o={o}
							fps={fps}
						/>
					))}
					{ELEMENTS.map((letter, index) => (
						<Unfurl key={index} letter={letter} index={index} o={o} />
					))}
				</g>
				{glint > 0 && glint < 1 && (
					<g
						clipPath={`url(#reel-logo-band)`}
						style={{filter: `drop-shadow(0 0 ${px(10)}px #fff)`}}
					>
						{[...BANGER, ...ELEMENTS].map((letter, index) => (
							<path key={index} d={letter.d} fill="#fff" />
						))}
					</g>
				)}
			</svg>
		</div>
	);
};
