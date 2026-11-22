import {
	AbsoluteFill,
	Audio,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {Hyperloop, Moon, Spectre, Vhs} from '../../../../../packages/elements/dist/components';

// Set these from your track: where the hit lands in public/swansong.mp3 and the tempo.
// Every cut and every button moves with them.
const DROP = 2.84;
const BPM = 85;
const ARTIST = 'Josh Woodward';
const TITLE = 'Swansong';
const ALBUM = 'from the album Breadcrumbs';
const GOLD = '#ffc27a';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const display = {fontFamily: 'Syncopate, sans-serif', fontWeight: 700, lineHeight: 1} as const;

const SpotifyIcon = () => (
	<svg width={34} height={34} viewBox="0 0 24 24">
		<circle cx={12} cy={12} r={12} fill="#1ed760" />
		<path
			d="M6 9.3q6.2-1.9 12 1M6.8 12.6q5.2-1.4 10 1.2M7.6 15.8q4.3-1.1 7.9.9"
			fill="none"
			stroke="#000"
			strokeWidth={1.9}
			strokeLinecap="round"
		/>
	</svg>
);

const AppleMusicIcon = () => (
	<svg width={34} height={34} viewBox="0 0 24 24">
		<defs>
			<linearGradient id="apple-music" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stopColor="#fd5b74" />
				<stop offset="1" stopColor="#f9263f" />
			</linearGradient>
		</defs>
		<rect width={24} height={24} rx={6} fill="url(#apple-music)" />
		<path
			d="M16.4 5.6v9.1a2.1 2.1 0 1 1-1.4-2V8.3l-5.4 1.2v6.6a2.1 2.1 0 1 1-1.4-2V7.4z"
			fill="#fff"
		/>
	</svg>
);

// Where to listen. They land one per beat on the last shot.
const STORES = [
	{name: 'Spotify', Icon: SpotifyIcon},
	{name: 'Apple Music', Icon: AppleMusicIcon},
];

export const ReleaseTeaser = ({audioSrc = staticFile('swansong.mp3')}: {audioSrc?: string}) => {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();
	const beatLength = (60 / BPM) * fps;
	const drop = Math.round(DROP * fps);
	const beat = (n: number) => Math.round(drop + n * beatLength);
	// Shots: a slit of the night before the hit, the title on the hit, the artist a bar later,
	// then the release card for the last two bars.
	const cuts = [drop, beat(4), beat(8)];
	const shot = cuts.filter((cut) => frame >= cut).length;
	const sinceCut = frame - (cuts[shot - 1] ?? 0);
	const kick = frame < drop ? 0 : Math.exp(-((frame - drop) % beatLength) / 6);
	const flash = shot === 0 ? 0 : Math.exp(-sinceCut / 4);
	const slam = spring({frame: sinceCut, fps, config: {damping: 13, stiffness: 160}});
	const tape = shot === 0 ? 0.35 : 0.12 + 0.7 * flash;
	const opening = interpolate(frame, [0, drop], [0.47, 0.33], clamp);
	const audio = {audioSrc, audioOffsetInSeconds: 0, playAudio: false};

	return (
		<AbsoluteFill
			style={{background: '#07060b', color: '#fff6ec', fontFamily: 'Geist, sans-serif'}}
		>
			{/* The scenes below remount every frame, so the soundtrack plays on its own. */}
			<Audio src={audioSrc} />
			<AbsoluteFill
				style={{
					clipPath: shot === 0 ? `inset(${opening * 100}% 0)` : undefined,
					transformOrigin: '50% 18%',
					transform: shot === 2 ? `scale(${1.9 - slam * 0.25})` : `scale(${1 + kick * 0.012})`,
				}}
			>
				<Vhs width={width} height={height} strength={tape} glitch={tape * 0.1} line={0.15}>
					{/* Vhs captures WebGL children once. A new key every frame keeps them moving. */}
					<AbsoluteFill key={frame}>
						{shot === 1 ? (
							<Hyperloop {...audio} width={width} height={height} baseColor="#ff9a3d" speed={1.4} />
						) : (
							<Moon {...audio} width={width} height={height} startColor="#ff7a59" />
						)}
					</AbsoluteFill>
				</Vhs>
			</AbsoluteFill>
			{shot === 3 && (
				<AbsoluteFill
					style={{
						background: 'linear-gradient(90deg, #07060bf0 28%, #07060b99 55%, transparent 80%)',
					}}
				/>
			)}
			<AbsoluteFill style={{background: '#fff', opacity: flash * 0.8}} />
			{/* Spectre sits on the tape rather than in it, so its bars keep their motion. */}
			<Spectre
				{...audio}
				width={width}
				height={84}
				spectreVariant="segmented"
				startColor={GOLD}
				endColor="#ff6f91"
				count={56}
				inputGainDb={12}
				bottom
				style={{position: 'absolute', left: 0, bottom: 0, opacity: shot === 0 ? 0.5 : 0.9}}
			/>

			{/* All type sits outside the Vhs so it stays sharp. */}
			{shot === 0 && (
				<AbsoluteFill
					style={{
						alignItems: 'center',
						top: 150,
						fontSize: 22,
						fontWeight: 600,
						letterSpacing: 9,
						opacity: interpolate(frame, [10, 40], [0, 1], clamp),
					}}
				>
					{ARTIST.toUpperCase()}
				</AbsoluteFill>
			)}
			{shot === 1 && (
				<AbsoluteFill
					style={{
						...display,
						justifyContent: 'center',
						alignItems: 'center',
						fontSize: 128,
						letterSpacing: -4,
						transform: `scale(${1.15 - slam * 0.15 + kick * 0.03})`,
						textShadow: `${(1 - slam) * 18}px 0 #ff3d6e, ${(slam - 1) * 18}px 0 #3dd6ff, 0 8px 50px #07060b`,
					}}
				>
					{TITLE.toUpperCase()}
				</AbsoluteFill>
			)}
			{shot === 2 && (
				<AbsoluteFill
					style={{
						...display,
						justifyContent: 'flex-end',
						alignItems: 'center',
						paddingBottom: 150,
						fontSize: 84,
						letterSpacing: -3,
						textShadow: '0 4px 40px #07060b, 0 0 80px #07060b',
						transform: `translateY(${(1 - slam) * 40}px) scale(${1 + kick * 0.02})`,
						opacity: slam,
					}}
				>
					{ARTIST.toUpperCase()}
				</AbsoluteFill>
			)}
			{shot === 3 && (
				<div style={{position: 'absolute', left: 96, top: 128}}>
					<div style={{fontSize: 24, fontWeight: 600, letterSpacing: 6}}>
						{ARTIST.toUpperCase()}
					</div>
					<div style={{...display, marginTop: 18, marginLeft: -4, fontSize: 92, letterSpacing: -4}}>
						{TITLE.toUpperCase()}
					</div>
					<div style={{marginTop: 14, fontSize: 22, opacity: 0.7}}>{ALBUM}</div>
					<div
						style={{
							...display,
							marginTop: 34,
							fontSize: 54,
							color: GOLD,
							opacity: interpolate(frame, [beat(9), beat(9) + 4], [0, 1], clamp),
							transform: `scale(${1 + kick * 0.04})`,
							transformOrigin: '0 50%',
						}}
					>
						OUT NOW
					</div>
					<div style={{display: 'flex', gap: 16, marginTop: 34}}>
						{STORES.map(({name, Icon}, i) => {
							const pop = spring({frame: frame - beat(10 + i), fps, config: {damping: 12}});
							return (
								<div
									key={name}
									style={{
										display: 'flex',
										alignItems: 'center',
										gap: 12,
										padding: '12px 26px 12px 14px',
										borderRadius: 999,
										background: '#fff6ec',
										color: '#07060b',
										fontSize: 24,
										fontWeight: 650,
										opacity: Math.min(1, pop * 2),
										transform: `translateY(${(1 - pop) * 24}px) scale(${0.8 + pop * 0.2})`,
									}}
								>
									<Icon />
									{name}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</AbsoluteFill>
	);
};
