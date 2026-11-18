/* eslint-disable @remotion/warn-native-media-tag -- Landing-page UI around the Player, not part of a rendered composition. */
import {
	createContext,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from 'react';
import {Player, type PlayerRef} from '@remotion/player';
import {Html5Audio} from 'remotion';
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
	type SceneState,
} from './scenes/model';
import {printScene, sceneFileName} from './scenes/print';
import {scenes} from './scenes/scenes';
import waves from './scenes/waves.json';
import {
	PlayButton,
	Segments,
	SoundButton,
	TrackWave,
	toggleSound,
	usePlayerStatus,
	useVisiblePlayback,
} from './stage/parts';

/** The live preview renders about as many pixels as 16:9 at 1280 × 720, in any format. */
const PREVIEW_PIXELS = 1280 * 720;

const previewSize = (format: Format) => {
	const {width, height} = formats[format];
	const scale = Math.min(1, Math.sqrt(PREVIEW_PIXELS / (width * height)));
	return {width: Math.round(width * scale), height: Math.round(height * scale)};
};

const levelsOf = waves as Record<string, number[]>;

// Swap scenes and props without changing the Player's composition.
const SceneContext = createContext<BuiltScene | null>(null);

// The stage plays the track itself, so tweaks never restart the audio.
function StageComposition() {
	const scene = useContext(SceneContext);
	if (!scene) return null;
	return (
		<>
			<Html5Audio
				src={scene.track.src}
				trimBefore={Math.round(scene.start * scene.fps)}
				showInTimeline={false}
			/>
			<SceneComposition scene={scene} live />
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

export default function SceneStage({titles}: {titles: Record<string, string>}) {
	const [sceneId, setSceneId] = useState(scenes[0]!.timing.id);
	const [states, setStates] = useState<Record<string, SceneState>>(() =>
		Object.fromEntries(scenes.map((spec) => [spec.timing.id, initialState(spec)])),
	);
	const [codeOpen, setCodeOpen] = useState(false);
	const [copy, setCopy] = useState<Copy>('idle');
	const [reducedMotion] = useState(
		() =>
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches,
	);
	// Render the same shell on the server to avoid layout shift when the Player mounts.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const rootRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<PlayerRef>(null);
	const codeId = useId();

	const spec = scenes.find((scene) => scene.timing.id === sceneId)!;
	const state = states[sceneId]!;
	const live = useMemo(() => buildScene(spec, state, previewSize(state.format)), [spec, state]);
	const full = useMemo(() => buildScene(spec, state), [spec, state]);
	const code = useMemo(() => {
		const lines = printScene(full).split('\n');
		// Lines your tweaks changed, against the scene as it ships in this format.
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

	const ready = usePlayerReady(playerRef, `${sceneId}-${state.format}`, mounted);
	const {playing, muted} = usePlayerStatus(playerRef, mounted);
	useVisiblePlayback(rootRef, playerRef, mounted, !reducedMotion);

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
		setStates((all) => ({...all, [sceneId]: {...all[sceneId]!, ...next}}));

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
							className="stage-poster"
							src={`/scenes/${sceneId}.webp`}
							alt=""
							fetchPriority="high"
							aria-hidden="true"
						/>
					) : null}
					{mounted && (
						<SceneContext value={live}>
							<Player
								ref={playerRef}
								className="preview-player"
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
									<p role="alert" className="stage-error">
										Preview unavailable: {error.message}. WebGL2 elements need graphics
										acceleration.
									</p>
								)}
							/>
						</SceneContext>
					)}
				</div>
				<div className="stage-bar">
					<div className="stage-picks scene-picks" role="group" aria-label="Choose a scene">
						{scenes.map((scene) => (
							<button
								key={scene.timing.id}
								type="button"
								aria-pressed={scene.timing.id === sceneId}
								onClick={() => setSceneId(scene.timing.id)}
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
										<img src={`/posters/${layer.slug}.webp`} alt="" width="28" height="16" />
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
								{copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Select to copy' : 'Copy code'}
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
