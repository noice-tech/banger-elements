import {Composition, registerRoot, staticFile} from 'remotion';
import {Root} from '../Root';
import {FisheyePreview} from '../../../site/src/components/preview/fisheye';
import {VhsPreview} from '../../../site/src/components/preview/vhs';
import {WetGlassPreview} from '../../../site/src/components/preview/wet-glass';
import {Reel} from '../../../site/src/components/reel/reel';
import {REEL_FPS, REEL_FRAMES} from '../../../site/src/components/reel/scenes';
import {DEMO_SONG, RECIPE_FPS, recipes} from '../../../site/src/components/recipes/recipes';
import {EpisodeClip} from '../../../site/src/components/recipes/episode-clip';
import {LyricVideo} from '../../../site/src/components/recipes/lyric-video';
import {MusicVisualizer} from '../../../site/src/components/recipes/music-visualizer';
import {ReleaseReel} from '../../../site/src/components/recipes/release-reel';
import {ReleaseTeaser} from '../../../site/src/components/recipes/release-teaser';
import {VerticalCanvas} from '../../../site/src/components/recipes/vertical-canvas';
import {RainyStream} from '../../../site/src/components/recipes/rainy-stream';
import {SceneVideo} from '../../../site/src/components/scenes/SceneVideo';
import {sceneFrames, SCENE_FPS, sceneTimings} from '../../../site/src/components/scenes/timing';
import {WrapDemo} from '../../../site/src/components/wrap/WrapDemo';
import {
	WRAP_FPS,
	WRAP_FRAMES,
	WRAP_HEIGHT,
	WRAP_WIDTH,
	wrapDemos,
} from '../../../site/src/components/wrap/demos';
import {withSiteFonts} from './site-fonts';

const SiteScene = withSiteFonts(SceneVideo);
const SiteWrap = withSiteFonts(WrapDemo);
const recipeComponents: Record<string, React.FC<{audioSrc?: string}>> = {
	EpisodeClip: withSiteFonts(EpisodeClip),
	LyricVideo: withSiteFonts(LyricVideo),
	MusicVisualizer: withSiteFonts(MusicVisualizer),
	ReleaseReel: withSiteFonts(ReleaseReel),
	ReleaseTeaser: withSiteFonts(ReleaseTeaser),
	VerticalCanvas: withSiteFonts(VerticalCanvas),
	RainyStream: withSiteFonts(RainyStream),
};

registerRoot(() => (
	<>
		<Root />
		<Composition
			id="WetGlass"
			component={WetGlassPreview}
			durationInFrames={960}
			fps={60}
			width={1280}
			height={720}
		/>
		<Composition
			id="Vhs"
			component={VhsPreview}
			durationInFrames={960}
			fps={60}
			width={1280}
			height={720}
		/>
		<Composition
			id="Reel"
			component={Reel}
			durationInFrames={REEL_FRAMES}
			fps={REEL_FPS}
			width={1280}
			height={720}
		/>
		{recipes.map((recipe) => (
			<Composition
				key={recipe.id}
				id={recipe.component}
				component={recipeComponents[recipe.component]!}
				durationInFrames={recipe.durationInFrames}
				fps={RECIPE_FPS}
				width={recipe.width}
				height={recipe.height}
				defaultProps={{audioSrc: recipe.audioFile ? staticFile(recipe.audioFile) : DEMO_SONG}}
			/>
		))}
		{wrapDemos.map((demo) => (
			<Composition
				key={demo.slug}
				id={`Wrap-${demo.slug}`}
				component={SiteWrap}
				durationInFrames={WRAP_FRAMES}
				fps={WRAP_FPS}
				width={WRAP_WIDTH}
				height={WRAP_HEIGHT * 2}
				defaultProps={{slug: demo.slug}}
			/>
		))}
		{sceneTimings.map((timing) => (
			<Composition
				key={timing.id}
				id={timing.component}
				component={SiteScene}
				durationInFrames={sceneFrames(timing)}
				fps={SCENE_FPS}
				width={1280}
				height={720}
				defaultProps={{id: timing.id}}
			/>
		))}
		<Composition
			id="Fisheye"
			component={FisheyePreview}
			durationInFrames={960}
			fps={60}
			width={1280}
			height={720}
		/>
	</>
));
