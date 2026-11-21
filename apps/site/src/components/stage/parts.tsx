import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type RefObject,
} from 'react';
import type {PlayerRef} from '@remotion/player';

export const formatTime = (seconds: number) =>
	`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** `generation` changes when the Player is remounted, so listeners move to the new instance. */
export function usePlayerStatus(
	playerRef: RefObject<PlayerRef | null>,
	mounted: boolean,
	generation = 0,
) {
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(true);
	useEffect(() => {
		if (!mounted) return;
		const player = playerRef.current;
		if (!player) return;
		const onPlay = () => setPlaying(true);
		const onPause = () => setPlaying(false);
		const onMute = (event: {detail: {isMuted: boolean}}) => setMuted(event.detail.isMuted);
		player.addEventListener('play', onPlay);
		player.addEventListener('pause', onPause);
		player.addEventListener('mutechange', onMute);
		setPlaying(player.isPlaying());
		setMuted(player.isMuted());
		return () => {
			player.removeEventListener('play', onPlay);
			player.removeEventListener('pause', onPause);
			player.removeEventListener('mutechange', onMute);
		};
	}, [playerRef, mounted, generation]);
	return {playing, muted};
}

/** Turning sound on is a request to hear it, so it also starts playback. */
export const toggleSound = (player: PlayerRef | null) => {
	if (!player) return;
	if (player.isMuted()) {
		player.unmute();
		if (!player.isPlaying()) player.play();
	} else player.mute();
};

export function PlayButton({playing, onClick}: {playing: boolean; onClick: () => void}) {
	return (
		<button
			type="button"
			className="stage-play"
			aria-label={playing ? 'Pause' : 'Play'}
			onClick={onClick}
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
	);
}

export function SoundButton({
	playing,
	muted,
	onClick,
}: {
	playing: boolean;
	muted: boolean;
	onClick: () => void;
}) {
	return (
		<button type="button" className="stage-sound" aria-pressed={!muted} onClick={onClick}>
			<span className="stage-meter" aria-hidden="true" data-live={playing && !muted}>
				<i />
				<i />
				<i />
				<i />
			</span>
			{muted ? 'Sound on' : 'Sound off'}
		</button>
	);
}

const WAVE_HEIGHT = 28;
const WAVE_PITCH = 4;

/** `levels` are loudness slices normalized to a peak of 1. */
export function TrackWave({
	playerRef,
	mounted,
	levels,
	fps,
	durationInFrames,
	initialFrame,
	marks = 0,
	generation = 0,
}: {
	playerRef: RefObject<PlayerRef | null>;
	mounted: boolean;
	levels: readonly number[] | null;
	fps: number;
	durationInFrames: number;
	initialFrame: number;
	marks?: number;
	generation?: number;
}) {
	const waveRef = useRef<HTMLDivElement>(null);
	const seekRef = useRef<HTMLInputElement>(null);
	const [bars, setBars] = useState(0);

	useEffect(() => {
		const wave = waveRef.current;
		if (!wave) return;
		const observer = new ResizeObserver(([entry]) =>
			setBars(Math.floor(entry!.contentRect.width / WAVE_PITCH)),
		);
		observer.observe(wave);
		return () => observer.disconnect();
	}, []);

	// Update the DOM directly to avoid re-rendering the stage every frame.
	useEffect(() => {
		if (!mounted) return;
		const player = playerRef.current;
		const wave = waveRef.current;
		const seek = seekRef.current;
		if (!player || !wave || !seek) return;
		const show = (frame: number) => {
			wave.style.setProperty('--progress', String(frame / (durationInFrames - 1)));
			seek.value = String(frame);
			seek.setAttribute(
				'aria-valuetext',
				`${formatTime(frame / fps)} of ${formatTime(durationInFrames / fps)}`,
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
	}, [playerRef, mounted, durationInFrames, fps, generation]);

	const heights = useMemo(() => {
		if (!levels || levels.length === 0 || bars < 2) return null;
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
			className="stage-wave"
			data-loaded={heights ? '' : undefined}
			style={
				{
					'--progress': initialFrame / (durationInFrames - 1),
					'--marks': marks,
				} as CSSProperties
			}
		>
			{marks > 1 ? <span className="stage-wave-marks" aria-hidden="true" /> : null}
			{heights
				? [false, true].map((played) => (
						<svg
							key={String(played)}
							className="stage-wave-bars"
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
				className="stage-wave-seek"
				type="range"
				aria-label="Seek"
				min={0}
				max={durationInFrames - 1}
				step={Math.max(1, Math.round(fps / 10))}
				defaultValue={initialFrame}
				onChange={(event) => playerRef.current?.seekTo(Number(event.currentTarget.value))}
			/>
		</div>
	);
}

export function Segments<V extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly {readonly value: V; readonly label: string}[];
	value: V;
	onChange: (value: V) => void;
}) {
	const labelId = useId();
	return (
		<div className="stage-choice" role="group" aria-labelledby={labelId}>
			<span className="stage-control-head">
				<span id={labelId}>{label}</span>
			</span>
			<span className="stage-segments">
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={value === option.value}
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</button>
				))}
			</span>
		</div>
	);
}

export function Swatches({
	label,
	value,
	swatches,
	onChange,
}: {
	label: string;
	value: string;
	swatches: readonly string[];
	onChange: (value: string) => void;
}) {
	const labelId = useId();
	const current = value.toLowerCase();
	const custom = !swatches.includes(current);
	return (
		<div className="stage-color" role="group" aria-labelledby={labelId}>
			<span className="stage-control-head">
				<span id={labelId}>{label}</span>
				<output>{current}</output>
			</span>
			<span className="stage-swatches">
				{swatches.map((swatch) => (
					<button
						key={swatch}
						type="button"
						className="stage-swatch"
						style={{'--swatch': swatch} as CSSProperties}
						aria-label={swatch}
						aria-pressed={current === swatch}
						onClick={() => onChange(swatch)}
					/>
				))}
				<label
					className="stage-swatch stage-swatch-custom"
					data-active={custom || undefined}
					style={custom ? ({'--swatch': current} as CSSProperties) : undefined}
				>
					<input
						type="color"
						aria-label={`Custom ${label.toLowerCase()}`}
						value={current}
						onChange={(event) => onChange(event.target.value)}
					/>
				</label>
			</span>
		</div>
	);
}

/**
 * Plays while the stage is on screen and pauses when it scrolls away, unless
 * the visitor paused it themselves. `autoPlay` false waits for a first play.
 */
export function useVisiblePlayback(
	rootRef: RefObject<HTMLElement | null>,
	playerRef: RefObject<PlayerRef | null>,
	mounted: boolean,
	autoPlay: boolean,
	generation = 0,
) {
	useEffect(() => {
		const root = rootRef.current;
		const player = playerRef.current;
		if (!mounted || !root || !player) return;
		let held = !autoPlay;
		let ours = false;
		const onPlay = () => {
			held = false;
		};
		const onPause = () => {
			if (!ours) held = true;
			ours = false;
		};
		player.addEventListener('play', onPlay);
		player.addEventListener('pause', onPause);
		const observer = new IntersectionObserver(
			(entries) => {
				// A busy main thread batches observations, so the last one is the current state.
				const entry = entries[entries.length - 1]!;
				if (entry.isIntersecting) {
					if (!held && !player.isPlaying()) player.play();
				} else if (player.isPlaying()) {
					ours = true;
					player.pause();
				}
			},
			{threshold: 0.25},
		);
		observer.observe(root);
		return () => {
			observer.disconnect();
			player.removeEventListener('play', onPlay);
			player.removeEventListener('pause', onPause);
		};
	}, [rootRef, playerRef, mounted, autoPlay, generation]);
}

const RECOVERY_WINDOW_MS = 30_000;
const MAX_AUTO_RECOVERIES = 3;
/** WebGL's CONTEXT_LOST_WEBGL, which the elements report when a draw fails after a lost context. */
const CONTEXT_LOST_CODE = '37442';

export const isContextLoss = (error: Error) => error.message.includes(CONTEXT_LOST_CODE);

/**
 * Browsers drop WebGL contexts under memory pressure or a GPU reset, and the
 * elements then throw, which would leave the Player on its error screen until
 * a reload. Remounting the Player with a new `key` builds fresh contexts.
 * `recover` retries by itself a few times; `retry` is for the visitor.
 */
export function usePlayerRecovery(rootRef: RefObject<HTMLElement | null>, mounted: boolean) {
	const [attempt, setAttempt] = useState(0);
	const recent = useRef<number[]>([]);
	const timer = useRef(0);
	const retry = useCallback(() => setAttempt((count) => count + 1), []);
	const recover = useCallback(() => {
		const now = Date.now();
		recent.current = recent.current.filter((time) => now - time < RECOVERY_WINDOW_MS);
		if (recent.current.length >= MAX_AUTO_RECOVERIES) return;
		recent.current.push(now);
		window.clearTimeout(timer.current);
		timer.current = window.setTimeout(retry, 300);
	}, [retry]);
	useEffect(() => {
		const root = rootRef.current;
		if (!mounted || !root) return;
		// While playing, the failed draw unmounts the canvas before this event arrives, and the
		// error screen calls `recover` instead. A paused stage draws nothing, so only this sees it.
		// Context events do not bubble, so listen while they travel down to the canvas.
		root.addEventListener('webglcontextlost', recover, true);
		return () => root.removeEventListener('webglcontextlost', recover, true);
	}, [rootRef, mounted, recover]);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	return {playerKey: attempt, retry, recover};
}

export function StageError({
	message,
	onRetry,
	onLost,
}: {
	message: string;
	onRetry: () => void;
	/** Called once when this error is a lost WebGL context, to start an automatic retry. */
	onLost?: () => void;
}) {
	useEffect(() => onLost?.(), [onLost]);
	return (
		<div role="alert" className="stage-error">
			<p>Preview unavailable: {message}. WebGL2 elements need graphics acceleration.</p>
			<button type="button" className="button" onClick={onRetry}>
				Reload preview
			</button>
		</div>
	);
}
