/* eslint-disable @remotion/warn-native-media-tag -- Landing-page UI around the Player, not part of a rendered composition. */
import {
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type RefObject,
} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {getAudioData} from '@remotion/media-utils';
import {examples, type PreviewKind} from './preview/examples';
import {PreviewRenderer, PREVIEW_WIDTH, PREVIEW_HEIGHT} from './preview/PreviewRenderer';
import {ControlField} from './preview/ControlField';
import {usePlayerReady} from './preview/player';
import type {Control} from './preview/controls';
import type {PreviewProps, PreviewValue} from './preview/types';

type Pick = {slug: PreviewKind; title: string};

const FPS = 60;

/** Every pick plays the same song. It goes silent after 50 s, so the loop ends there. */
const HERO_AUDIO = 'https://cdn.banger.show/assets/banger-demo-song-min.mp3';
const HERO_SECONDS = 50;
const DURATION_IN_FRAMES = HERO_SECONDS * FPS;

/** Where the hero departs from the element pages' examples. */
const HERO_PROPS: Partial<Record<PreviewKind, PreviewProps>> = {
	halo: {centerMode: 'transparent'},
	// The song's tempo, so Trip's motion lands on the beat.
	trip: {bpm: 122},
};

/** The handful of controls worth showing on the landing page, per element. */
const HERO_CONTROLS: Partial<Record<PreviewKind, readonly string[]>> = {
	ferrofluid: ['intensity', 'pattern', 'shineColor'],
	halo: ['intensity', 'radius', 'centerMode'],
	trip: ['pattern', 'thickness', 'baseColor'],
	liquid: ['swirl', 'distortion', 'color1'],
};

/** One-click colors for the hero's color control. The first is the example's own. */
const HERO_SWATCHES: Partial<Record<PreviewKind, readonly string[]>> = {
	ferrofluid: ['#ffbc8e', '#7cc4ff', '#ff6fae', '#b9f26b', '#f2efe9'],
	trip: ['#ff00ff', '#00e5ff', '#ff5a1f', '#7dff6b', '#ffe14d'],
	liquid: ['#1e00ff', '#ff1f6b', '#00b8ff', '#8a2be2', '#ff8a00'],
};

/**
 * 5.5 s in, just after the song's intro. static/hero/<slug>.webp are captures
 * of this player at this frame, so the poster and the first live frame match.
 */
const POSTER_FRAME = 330;

const baseProps = (slug: PreviewKind): PreviewProps => {
	const example = examples[slug];
	return {
		...example.props,
		...HERO_PROPS[slug],
		width: example.width,
		height: example.height,
		audioSrc: HERO_AUDIO,
		audioOffsetInSeconds: 0,
		playAudio: true,
	};
};

const formatTime = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

const WAVE_HEIGHT = 28;
/** Each bar is half its pitch wide, so bars and gaps are equal. */
const WAVE_PITCH = 4;
const waveforms = new Map<string, Promise<number[]>>();

/** Loudness of the first `seconds` of a track in 512 slices, scaled so the loudest is 1. */
const loadWaveform = (src: string, seconds: number) => {
	const key = `${src}#${seconds}`;
	let waveform = waveforms.get(key);
	if (!waveform) {
		waveform = getAudioData(src).then(({channelWaveforms, sampleRate}) => {
			const channel = channelWaveforms[0]!;
			const length = Math.round(seconds * sampleRate);
			const slices = 512;
			const size = Math.max(1, Math.floor(length / slices));
			const levels = Array.from({length: slices}, (_, slice) => {
				let sum = 0;
				for (let i = slice * size; i < (slice + 1) * size; i++) sum += (channel[i] ?? 0) ** 2;
				return Math.sqrt(sum / size);
			});
			const loudest = Math.max(...levels) || 1;
			return levels.map((level) => level / loudest);
		});
		waveform.catch(() => waveforms.delete(key));
		waveforms.set(key, waveform);
	}
	return waveform;
};

/** The track's waveform, filled up to the playhead. Doubles as the seek bar. */
function HeroWave({
	playerRef,
	playerKey,
	src,
	durationInFrames,
}: {
	playerRef: RefObject<PlayerRef | null>;
	playerKey: string;
	src: string;
	durationInFrames: number;
}) {
	const waveRef = useRef<HTMLDivElement>(null);
	const seekRef = useRef<HTMLInputElement>(null);
	const [levels, setLevels] = useState<number[] | null>(null);
	const [bars, setBars] = useState(0);
	const seconds = durationInFrames / FPS;

	useEffect(() => {
		let live = true;
		loadWaveform(src, seconds).then(
			(next) => live && setLevels(next),
			() => {},
		);
		return () => {
			live = false;
		};
	}, [src, seconds]);

	useEffect(() => {
		const wave = waveRef.current;
		if (!wave) return;
		const observer = new ResizeObserver(([entry]) =>
			setBars(Math.floor(entry!.contentRect.width / WAVE_PITCH)),
		);
		observer.observe(wave);
		return () => observer.disconnect();
	}, []);

	// The playhead moves every frame, so it is written straight to the DOM
	// instead of re-rendering the stage 60 times a second.
	useEffect(() => {
		const player = playerRef.current;
		const wave = waveRef.current;
		const seek = seekRef.current;
		if (!player || !wave || !seek) return;
		const show = (frame: number) => {
			wave.style.setProperty('--progress', String(frame / (durationInFrames - 1)));
			seek.value = String(frame);
			seek.setAttribute(
				'aria-valuetext',
				`${formatTime(frame / FPS)} of ${formatTime(durationInFrames / FPS)}`,
			);
		};
		const onFrame = (event: {detail: {frame: number}}) => show(event.detail.frame);
		show(player.getCurrentFrame());
		player.addEventListener('frameupdate', onFrame);
		player.addEventListener('seeked', onFrame);
		return () => {
			player.removeEventListener('frameupdate', onFrame);
			player.removeEventListener('seeked', onFrame);
		};
	}, [playerRef, playerKey, durationInFrames]);

	const heights = useMemo(() => {
		if (!levels || bars < 2) return null;
		const means = Array.from({length: bars}, (_, bar) => {
			const from = Math.floor((bar / bars) * levels.length);
			const to = Math.max(from + 1, Math.floor(((bar + 1) / bars) * levels.length));
			const slice = levels.slice(from, to);
			return slice.reduce((sum, level) => sum + level, 0) / slice.length;
		});
		// Mastered tracks sit near full loudness throughout, which draws a flat
		// block. Stretching from the quiet end up brings out the song's shape.
		const floor = 0.75 * [...levels].sort((a, b) => a - b)[Math.floor(levels.length / 10)]!;
		const loudest = Math.max(...means);
		return means.map((mean) => {
			const level = Math.max(0, (mean - floor) / (loudest - floor || 1));
			return Math.max(2, Math.round(level ** 1.5 * WAVE_HEIGHT));
		});
	}, [levels, bars]);

	return (
		<div
			ref={waveRef}
			className="hero-wave"
			data-loaded={heights ? '' : undefined}
			style={{'--progress': POSTER_FRAME / (durationInFrames - 1)} as CSSProperties}
		>
			{heights
				? [false, true].map((played) => (
						<svg
							key={String(played)}
							className="hero-wave-bars"
							data-played={played || undefined}
							viewBox={`0 0 ${heights.length * WAVE_PITCH} ${WAVE_HEIGHT}`}
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							{heights.map((height, bar) => (
								<rect
									key={bar}
									x={bar * WAVE_PITCH}
									y={(WAVE_HEIGHT - height) / 2}
									width={WAVE_PITCH / 2}
									height={height}
									rx={1}
								/>
							))}
						</svg>
					))
				: null}
			<input
				ref={seekRef}
				className="hero-wave-seek"
				type="range"
				aria-label="Seek"
				min={0}
				max={durationInFrames - 1}
				step={6}
				defaultValue={POSTER_FRAME}
				onChange={(event) => playerRef.current?.seekTo(Number(event.currentTarget.value))}
			/>
		</div>
	);
}

function HeroColor({
	control,
	value,
	swatches,
	update,
}: {
	control: Control;
	value: string;
	swatches: readonly string[];
	update: (value: string) => void;
}) {
	const labelId = useId();
	const current = value.toLowerCase();
	const custom = !swatches.includes(current);
	return (
		<div className="hero-color" role="group" aria-labelledby={labelId}>
			<span className="hero-control-head">
				<span id={labelId}>{control.label}</span>
				<output>{current}</output>
			</span>
			<span className="hero-swatches">
				{swatches.map((swatch) => (
					<button
						key={swatch}
						type="button"
						className="hero-swatch"
						style={{'--swatch': swatch} as CSSProperties}
						aria-label={swatch}
						aria-pressed={current === swatch}
						onClick={() => update(swatch)}
					/>
				))}
				<label
					className="hero-swatch hero-swatch-custom"
					data-active={custom || undefined}
					style={custom ? ({'--swatch': current} as CSSProperties) : undefined}
				>
					<input
						type="color"
						aria-label={`Custom ${control.label.toLowerCase()}`}
						value={current}
						onChange={(event) => update(event.target.value)}
					/>
				</label>
			</span>
		</div>
	);
}

/** A select with a few options, shown as a segmented switch. */
function HeroChoice({
	control,
	value,
	update,
}: {
	control: Control;
	value: string;
	update: (value: string) => void;
}) {
	const labelId = useId();
	return (
		<div className="hero-choice" role="group" aria-labelledby={labelId}>
			<span className="hero-control-head">
				<span id={labelId}>{control.label}</span>
			</span>
			<span className="hero-segments">
				{control.options?.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={value === option.value}
						onClick={() => update(String(option.value))}
					>
						{option.label}
					</button>
				))}
			</span>
		</div>
	);
}

export default function HeroStage({picks}: {picks: readonly Pick[]}) {
	const [selected, setSelected] = useState<PreviewKind>(picks[0]!.slug);
	const [tweaks, setTweaks] = useState<Partial<Record<PreviewKind, PreviewProps>>>({});
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(true);
	const [reducedMotion] = useState(
		() =>
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	);
	// The Player only mounts in the browser; the server renders the same shell
	// around the poster so the page doesn't shift when it loads.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const playerRef = useRef<PlayerRef>(null);
	const ready = usePlayerReady(playerRef, selected, mounted);
	const props = useMemo(() => ({...baseProps(selected), ...tweaks[selected]}), [selected, tweaks]);
	const durationInFrames = DURATION_IN_FRAMES;
	const controls = useMemo(() => {
		const keys = HERO_CONTROLS[selected] ?? [];
		const all: readonly Control[] = examples[selected].controls;
		return keys
			.map((key) => all.find((control) => control.key === key))
			.filter(Boolean) as Control[];
	}, [selected]);
	const current = picks.find((pick) => pick.slug === selected)!;

	useEffect(() => {
		const player = playerRef.current;
		if (!player) return;
		const onPlay = () => setPlaying(true);
		const onPause = () => setPlaying(false);
		const onMute = (event: {detail: {isMuted: boolean}}) => setMuted(event.detail.isMuted);
		player.addEventListener('play', onPlay);
		player.addEventListener('pause', onPause);
		player.addEventListener('mutechange', onMute);
		setPlaying(player.isPlaying());
		return () => {
			player.removeEventListener('play', onPlay);
			player.removeEventListener('pause', onPause);
			player.removeEventListener('mutechange', onMute);
		};
	}, [selected, mounted]);

	const update = (key: string, value: PreviewValue) =>
		setTweaks((all) => ({...all, [selected]: {...all[selected], [key]: value}}));

	const toggleSound = () => {
		const player = playerRef.current;
		if (!player) return;
		if (player.isMuted()) {
			player.unmute();
			if (!player.isPlaying()) player.play();
		} else player.mute();
	};

	return (
		<div className="hero-stage">
			<div className="hero-ambient" aria-hidden="true">
				<img src={`/hero/${selected}.webp`} alt="" />
			</div>
			<div className="hero-frame">
				<div className="hero-screen" data-ready={ready}>
					<img
						className="hero-poster"
						src={`/hero/${selected}.webp`}
						alt=""
						fetchPriority="high"
						aria-hidden="true"
					/>
					{mounted && (
						<Player
							ref={playerRef}
							key={selected}
							className="preview-player"
							component={PreviewRenderer}
							inputProps={{...props, previewKind: selected}}
							compositionWidth={PREVIEW_WIDTH}
							compositionHeight={PREVIEW_HEIGHT}
							fps={FPS}
							durationInFrames={durationInFrames}
							initialFrame={POSTER_FRAME}
							autoPlay={!reducedMotion}
							initiallyMuted={muted}
							loop
							clickToPlay
							doubleClickToFullscreen={false}
							style={{width: '100%', aspectRatio: '16 / 9'}}
							errorFallback={({error}) => (
								<p role="alert" className="hero-error">
									Preview unavailable: {error.message}. WebGL2 elements need graphics acceleration.
								</p>
							)}
						/>
					)}
				</div>
				<div className="hero-bar">
					<div className="hero-picks" role="group" aria-label="Choose an element">
						{picks.map((pick) => (
							<button
								key={pick.slug}
								type="button"
								aria-pressed={pick.slug === selected}
								onClick={() => setSelected(pick.slug)}
							>
								<img src={`/hero/thumbs/${pick.slug}.webp`} alt="" width="32" height="18" />
								{pick.title}
							</button>
						))}
					</div>
					<div className="hero-transport">
						<button
							type="button"
							className="hero-round"
							aria-label={playing ? 'Pause' : 'Play'}
							onClick={() => playerRef.current?.toggle()}
						>
							{playing ? (
								<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
									<rect x="2.5" y="2" width="3" height="10" rx="1" fill="currentColor" />
									<rect x="8.5" y="2" width="3" height="10" rx="1" fill="currentColor" />
								</svg>
							) : (
								<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
									<path
										d="M3.5 2.2v9.6a.6.6 0 0 0 .9.5l8-4.8a.6.6 0 0 0 0-1L4.4 1.7a.6.6 0 0 0-.9.5Z"
										fill="currentColor"
									/>
								</svg>
							)}
						</button>
						<HeroWave
							playerRef={playerRef}
							playerKey={`${selected}:${mounted}`}
							src={String(props.audioSrc)}
							durationInFrames={durationInFrames}
						/>
						<button
							type="button"
							className="hero-sound"
							aria-pressed={!muted}
							onClick={toggleSound}
						>
							<span className="hero-meter" aria-hidden="true" data-live={playing && !muted}>
								<i />
								<i />
								<i />
								<i />
							</span>
							{muted ? 'Sound on' : 'Sound off'}
						</button>
					</div>
				</div>
				<div className="hero-tune">
					{controls.map((control) => {
						const swatches = HERO_SWATCHES[selected];
						return (
							<div
								key={`${selected}-${control.key}`}
								className={`hero-control hero-control-${control.type}`}
							>
								{control.type === 'color' && swatches ? (
									<HeroColor
										control={control}
										value={String(props[control.key])}
										swatches={swatches}
										update={(value) => update(control.key, value)}
									/>
								) : control.type === 'select' ? (
									<HeroChoice
										control={control}
										value={String(props[control.key])}
										update={(value) => update(control.key, value)}
									/>
								) : (
									<ControlField
										control={control}
										value={(props[control.key] ?? 0) as PreviewValue}
										update={(value) => update(control.key, value)}
									/>
								)}
							</div>
						);
					})}
					<a className="hero-open" href={`/${selected}.html`}>
						Open {current.title}
						<span aria-hidden="true">→</span>
					</a>
				</div>
			</div>
		</div>
	);
}
