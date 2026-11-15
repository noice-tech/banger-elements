/* eslint-disable @remotion/warn-native-media-tag -- Landing-page UI around the Player, not part of a rendered composition. */
import {useEffect, useMemo, useRef, useState} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {examples, defaultAudioFor, type PreviewKind} from './preview/examples';
import {PreviewRenderer, PREVIEW_WIDTH, PREVIEW_HEIGHT} from './preview/PreviewRenderer';
import {ControlField} from './preview/ControlField';
import {previewDurationInSeconds, usePlayerReady} from './preview/player';
import type {Control} from './preview/controls';
import type {PreviewProps, PreviewValue} from './preview/types';

type Pick = {slug: PreviewKind; title: string};

/** The handful of controls worth showing on the landing page, per element. */
const HERO_CONTROLS: Partial<Record<PreviewKind, readonly string[]>> = {
	ferrofluid: ['intensity', 'pattern', 'shineColor'],
	halo: ['intensity', 'radius', 'trailDepth'],
	pulse: ['twist', 'glow', 'startColor'],
	liquid: ['swirl', 'distortion', 'color1'],
};

/**
 * static/hero/<slug>.webp are captures of this player at this frame, so the
 * poster and the first live frame are the same picture.
 */
const POSTER_FRAME = 96;

const baseProps = (slug: PreviewKind): PreviewProps => {
	const example = examples[slug];
	return {
		...example.props,
		width: example.width,
		height: example.height,
		audioSrc: defaultAudioFor(slug),
		audioOffsetInSeconds: 0,
		playAudio: true,
	};
};

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
							fps={60}
							durationInFrames={previewDurationInSeconds(selected) * 60}
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
								<img src={`/posters/${pick.slug}.webp`} alt="" width="28" height="16" />
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
					{controls.map((control) => (
						<div
							key={`${selected}-${control.key}`}
							className={`hero-control hero-control-${control.type}`}
						>
							<ControlField
								control={control}
								value={(props[control.key] ?? 0) as PreviewValue}
								update={(value) => update(control.key, value)}
							/>
						</div>
					))}
					<a className="hero-open" href={`/${selected}.html`}>
						Open {current.title}
						<span aria-hidden="true">→</span>
					</a>
				</div>
			</div>
		</div>
	);
}
