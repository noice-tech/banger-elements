/* eslint-disable @remotion/warn-native-media-tag -- Landing-page UI around the Player, not part of a rendered composition. */
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {Html5Audio, Internals} from 'remotion';
import {highlightLine} from './highlight';
import {usePlayerReady} from './preview/player';
import {SceneComposition} from './scenes/SceneComposition';
import {
	buildScene,
	finishes,
	formats,
	initialState,
	type BuiltScene,
	type Finish,
	type Format,
	type SceneSpec,
	type SceneState,
} from './scenes/model';
import {printScene, sceneFileName} from './scenes/print';
import {scenes} from './scenes/scenes';
import {sceneClip} from './scenes/timing';
import {loadedElements, loadSceneElements} from './scenes/lazy-elements';
import waves from './scenes/waves.json';
import {
	PlayButton,
	Segments,
	SoundButton,
	StageError,
	isContextLoss,
	TrackWave,
	toggleSound,
	usePlayerRecovery,
	usePlayerStatus,
	useVisiblePlayback,
} from './stage/parts';

const PREVIEW_PIXELS = 1280 * 720;
const COMPACT_PREVIEW_PIXELS = 960 * 540;
const SCENE_FADE_OUT_MS = 180;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const previewSize = (format: Format, pixels: number) => {
	const {width, height} = formats[format];
	const scale = Math.min(1, Math.sqrt(pixels / (width * height)));
	return {width: Math.round(width * scale), height: Math.round(height * scale)};
};

const levelsOf = waves as Record<string, number[]>;

const SceneContext = createContext<BuiltScene | null>(null);
const StageRenderScope = Internals.DelayRenderContextType;

function StageComposition() {
	const scene = useContext(SceneContext);
	if (!scene) return null;
	const clip = sceneClip(scene.spec.timing);
	return (
		<>
			<Html5Audio
				src={clip.src}
				trimBefore={Math.round(scene.start * scene.fps)}
				showInTimeline={false}
			/>
			<SceneComposition scene={scene} elements={loadedElements} audioSrc={clip.src} live />
		</>
	);
}

const finishOptions = (Object.keys(finishes) as Finish[]).map((value) => ({
	value,
	label: finishes[value].label,
}));
const formatOptions = (Object.keys(formats) as Format[]).map((value) => ({
	value,
	label: formats[value].label,
}));

type Copy = 'idle' | 'copied' | 'failed';

const copyLabels: Record<Copy, string> = {
	idle: 'Copy code',
	copied: 'Copied',
	failed: 'Select to copy',
};

const elementsFor = (spec: SceneSpec, state: SceneState) => buildScene(spec, state).elements;

const whenIdle = (task: () => void) => {
	const idle = (window as Partial<Window>).requestIdleCallback;
	if (idle) {
		const handle = idle.call(window, task, {timeout: 1500});
		return () => window.cancelIdleCallback(handle);
	}
	const handle = window.setTimeout(task, 200);
	return () => window.clearTimeout(handle);
};

export default function SceneStage({titles}: {titles: Record<string, string>}) {
	const [sceneId, setSceneId] = useState(scenes[0]!.timing.id);
	const [selection, setSelection] = useState<{
		id: string;
		elements: readonly string[];
		poster: string | null;
	} | null>(null);
	const [states, setStates] = useState<Record<string, SceneState>>(() =>
		Object.fromEntries(scenes.map((spec) => [spec.timing.id, initialState(spec)])),
	);
	const [codeOpen, setCodeOpen] = useState(false);
	const [copy, setCopy] = useState<Copy>('idle');
	const [pixels] = useState(() =>
		typeof window !== 'undefined' &&
		window.matchMedia('(max-width: 720px), (pointer: coarse)').matches
			? COMPACT_PREVIEW_PIXELS
			: PREVIEW_PIXELS,
	);
	const [reducedMotion] = useState(
		() => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches,
	);
	const [mounted, setMounted] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const rootRef = useRef<HTMLDivElement>(null);
	const coverRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<PlayerRef>(null);
	const codeId = useId();

	const spec = scenes.find((scene) => scene.timing.id === sceneId)!;
	const state = states[sceneId]!;
	const live = useMemo(
		() => buildScene(spec, state, previewSize(state.format, pixels)),
		[spec, state, pixels],
	);
	const full = useMemo(() => buildScene(spec, state), [spec, state]);
	const code = useMemo(() => {
		const lines = printScene(full).split('\n');
		const original = new Set(
			printScene(buildScene(spec, {...initialState(spec), format: state.format})).split('\n'),
		);
		let noted = false;
		return lines.map((text) => {
			const tuned = text.trim() !== '' && !original.has(text);
			const note = tuned && !noted ? 'from your tweaks' : undefined;
			if (tuned) noted = true;
			return {text, tuned, note, html: highlightLine(text)};
		});
	}, [full, spec, state.format]);

	const {playerKey, retry, recover} = usePlayerRecovery(rootRef, mounted);
	const renderScope = useMemo(
		() => ({
			remotion_renderReady: false,
			remotion_delayRenderHandles: [] as number[],
			remotion_delayRenderTimeouts: {},
			remotion_puppeteerTimeout: 0,
			remotion_attempt: playerKey + 1,
		}),
		[playerKey],
	);
	const isFrameReady = useCallback(
		() => renderScope.remotion_delayRenderHandles.length === 0,
		[renderScope],
	);
	const ready = usePlayerReady(playerRef, sceneId, mounted, playerKey, isFrameReady);
	const {playing, muted} = usePlayerStatus(playerRef, mounted, playerKey);
	useVisiblePlayback(rootRef, playerRef, mounted, !reducedMotion, playerKey);

	useEffect(() => {
		let live = true;
		let cancelIdle = () => {};
		setLoadError(null);
		loadSceneElements(elementsFor(scenes[0]!, initialState(scenes[0]!))).then(
			() => {
				if (live) cancelIdle = whenIdle(() => setMounted(true));
			},
			(error: unknown) =>
				live && setLoadError(error instanceof Error ? error.message : String(error)),
		);
		return () => {
			live = false;
			cancelIdle();
		};
	}, [playerKey]);

	useEffect(() => {
		if (!selection || selection.id === sceneId) return;
		let cancelled = false;
		let fade: Animation | undefined;
		const cover = coverRef.current;
		const animate = cover?.animate && !window.matchMedia(REDUCED_MOTION).matches;
		if (animate && selection.poster) cover.style.backgroundImage = `url(${selection.poster})`;
		setLoadError(null);
		loadSceneElements(selection.elements).then(
			async () => {
				if (cancelled) return;
				if (animate && playerRef.current && !document.hidden) {
					fade = cover.animate([{opacity: 0}, {opacity: 1}], {
						duration: SCENE_FADE_OUT_MS,
						easing: 'ease-in-out',
						fill: 'forwards',
					});
					await fade.finished.catch(() => {});
				}
				if (!cancelled) setSceneId(selection.id);
			},
			(error: unknown) => {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
			},
		);
		return () => {
			cancelled = true;
			fade?.cancel();
			cover?.style.removeProperty('background-image');
		};
	}, [selection, sceneId, playerKey]);

	const commitWhenLoaded = (target: SceneSpec, targetState: SceneState, commit: () => void) => {
		const needed = elementsFor(target, targetState);
		if (needed.every((slug) => loadedElements[slug])) return commit();
		loadSceneElements(needed).then(commit, (error: unknown) =>
			setLoadError(error instanceof Error ? error.message : String(error)),
		);
	};
	const prefetch = (target: SceneSpec) => {
		loadSceneElements(elementsFor(target, states[target.timing.id]!)).catch(() => {});
	};
	const selectScene = (target: SceneSpec) => {
		const id = target.timing.id;
		if (id === sceneId) {
			setSelection(null);
			return;
		}
		const next = states[id]!;
		setSelection({
			id,
			elements: elementsFor(target, next),
			poster: next.format === 'wide' ? `/scenes/${id}.webp` : null,
		});
	};

	const firstScene = useRef(true);
	useEffect(() => {
		if (firstScene.current) {
			firstScene.current = false;
			return;
		}
		playerRef.current?.seekTo(0);
	}, [sceneId]);

	useEffect(() => {
		if (copy === 'idle') return;
		const reset = window.setTimeout(() => setCopy('idle'), 1600);
		return () => window.clearTimeout(reset);
	}, [copy]);

	const update = (next: Partial<SceneState>) =>
		commitWhenLoaded(spec, {...state, ...next}, () =>
			setStates((all) => ({...all, [sceneId]: {...all[sceneId]!, ...next}})),
		);

	const toggleLayer = (slug: string) =>
		update({
			hidden: state.hidden.includes(slug)
				? state.hidden.filter((entry) => entry !== slug)
				: [...state.hidden, slug],
		});

	const copyCode = async () => {
		try {
			await navigator.clipboard.writeText(code.map((line) => line.text).join('\n'));
			setCopy('copied');
		} catch {
			setCopy('failed');
		}
	};

	const visibleLayers = spec.layers.length - state.hidden.length;
	const wide = state.format === 'wide';

	return (
		<div ref={rootRef} className="stage scenes">
			<div className="stage-ambient" aria-hidden="true">
				<img src={`/scenes/${sceneId}.webp`} alt="" />
			</div>
			<div className="stage-frame">
				<div className="stage-screen" data-ready={ready} data-format={state.format}>
					{wide ? (
						<img
							key={sceneId}
							className="stage-poster"
							src={`/scenes/${sceneId}.webp`}
							alt=""
							fetchPriority="high"
							aria-hidden="true"
						/>
					) : null}
					{loadError ? <StageError message={loadError} onRetry={retry} /> : null}
					{mounted && (
						<div className="scene-player">
							<StageRenderScope value={renderScope}>
								<SceneContext value={live}>
									<Player
										key={playerKey}
										ref={playerRef}
										component={StageComposition}
										compositionWidth={live.width}
										compositionHeight={live.height}
										fps={live.fps}
										durationInFrames={live.durationInFrames}
										autoPlay={false}
										initiallyMuted
										numberOfSharedAudioTags={0}
										loop
										clickToPlay
										doubleClickToFullscreen={false}
										style={{width: '100%', aspectRatio: '16 / 9'}}
										errorFallback={({error}) => (
											<StageError
												message={error.message}
												onRetry={retry}
												onLost={isContextLoss(error) ? recover : undefined}
											/>
										)}
									/>
								</SceneContext>
							</StageRenderScope>
						</div>
					)}
					<div ref={coverRef} className="scene-swap-cover" aria-hidden="true" />
				</div>
				<div className="stage-bar">
					<div className="stage-picks scene-picks" role="group" aria-label="Choose a scene">
						{scenes.map((scene) => (
							<button
								key={scene.timing.id}
								type="button"
								aria-pressed={scene.timing.id === sceneId}
								onPointerEnter={() => prefetch(scene)}
								onFocus={() => prefetch(scene)}
								onClick={() => selectScene(scene)}
							>
								<img src={`/scenes/thumbs/${scene.timing.id}.webp`} alt="" width="48" height="27" />
								<span>
									{scene.title}
									<small>{scene.use}</small>
								</span>
							</button>
						))}
					</div>
					<div className="stage-transport">
						<PlayButton playing={playing} onClick={() => playerRef.current?.toggle()} />
						<TrackWave
							generation={playerKey}
							key={sceneId}
							playerRef={playerRef}
							mounted={mounted}
							levels={levelsOf[sceneId] ?? null}
							fps={live.fps}
							durationInFrames={live.durationInFrames}
							initialFrame={0}
							marks={live.bars}
						/>
						<SoundButton
							playing={playing}
							muted={muted}
							onClick={() => toggleSound(playerRef.current)}
						/>
					</div>
				</div>
				<div className="stage-tune scene-tune">
					<div className="stage-color" role="group" aria-label="Palette">
						<span className="stage-control-head">
							<span aria-hidden="true">Palette</span>
							<output>{spec.palettes[state.palette]?.name}</output>
						</span>
						<span className="stage-swatches">
							{spec.palettes.map((palette, index) => (
								<button
									key={palette.name}
									type="button"
									className="stage-swatch scene-swatch"
									style={
										{
											'--a': palette.a,
											'--b': palette.b,
											'--c': palette.c,
										} as CSSProperties
									}
									aria-label={palette.name}
									aria-pressed={state.palette === index}
									onClick={() => update({palette: index})}
								/>
							))}
						</span>
					</div>
					<label className="stage-control scene-energy">
						<span className="stage-control-head">
							<span>Energy</span>
							<output>{Math.round(state.energy * 100)}%</output>
						</span>
						<input
							type="range"
							min={0}
							max={1}
							step={0.05}
							value={state.energy}
							onChange={(event) => update({energy: Number(event.currentTarget.value)})}
						/>
					</label>
					<Segments
						label="Finish"
						options={finishOptions}
						value={state.finish}
						onChange={(finish) => update({finish})}
					/>
					<Segments
						label="Format"
						options={formatOptions}
						value={state.format}
						onChange={(format) => update({format})}
					/>
				</div>
				<div className="scene-foot">
					<div className="scene-layers" role="group" aria-label="Layers, back to front">
						{spec.layers.map((layer, index) => {
							const on = !state.hidden.includes(layer.slug);
							return (
								<span key={layer.slug} className="scene-layer">
									{index > 0 ? (
										<span className="scene-plus" aria-hidden="true">
											+
										</span>
									) : null}
									<button
										type="button"
										aria-pressed={on}
										disabled={on && visibleLayers === 1}
										onClick={() => toggleLayer(layer.slug)}
									>
										<img src={`/posters/icons/${layer.slug}.webp`} alt="" width="28" height="16" />
										{titles[layer.slug] ?? layer.slug}
									</button>
								</span>
							);
						})}
						{state.finish !== 'none' ? (
							<span className="scene-wrap">in {finishes[state.finish].label}</span>
						) : null}
					</div>
					<button
						type="button"
						className="scene-code-toggle"
						aria-expanded={codeOpen}
						aria-controls={codeId}
						onClick={() => setCodeOpen((open) => !open)}
					>
						<span aria-hidden="true">{'</>'}</span>
						{codeOpen ? 'Hide the code' : 'Get the code'}
					</button>
				</div>
				<div className="scene-code code-window" id={codeId} hidden={!codeOpen}>
					<div className="code-window-bar">
						<span className="code-file">
							<span className="code-dir">src/</span>
							{sceneFileName(full)}
						</span>
						<span className="scene-code-actions">
							<span className="scene-code-count">{code.length} lines</span>
							<button type="button" className="code-copy" onClick={copyCode}>
								{copyLabels[copy]}
							</button>
						</span>
					</div>
					<pre className="code-lines">
						<code>
							{code.map((line, index) => (
								<span
									key={index}
									className="line"
									data-tuned={line.tuned || undefined}
									data-note={line.note}
									dangerouslySetInnerHTML={{__html: line.html}}
								/>
							))}
						</code>
					</pre>
				</div>
			</div>
		</div>
	);
}
