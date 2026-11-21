// Keep this module dependency-free so scripts/scenes.mjs can import it directly.
export const SCENE_FPS = 30;
export const SCENE_BARS = 8;

export type TrackId = 'time-travel' | 'demo';

export type Track = {
	readonly src: string;
	/** The file name the generated code expects in public/. */
	readonly file: string;
	readonly title: string;
	readonly artist: string;
	readonly bpm: number;
	/** The first downbeat, in seconds. Bars are counted from here. */
	readonly downbeat: number;
};

export const tracks: Record<TrackId, Track> = {
	'time-travel': {
		src: 'https://cdn.banger.show/assets/time-travel.mp3',
		file: 'time-travel.mp3',
		title: 'Time Travel',
		artist: 'Tequila Funk',
		bpm: 100,
		downbeat: 0.08,
	},
	demo: {
		src: 'https://cdn.banger.show/assets/banger-demo-song-min.mp3',
		file: 'track.mp3',
		title: 'Demo Song',
		artist: 'Banger',
		bpm: 122,
		// The drop. The song's sections start every eight bars after it.
		downbeat: 2.685,
	},
};

export const barSeconds = (track: Track) => (60 / track.bpm) * 4;

export type SceneTiming = {
	readonly id: string;
	/** The component name in the generated code and the render root. */
	readonly component: string;
	readonly track: TrackId;
	/** The bar the loop starts on, counted from the track's first downbeat. */
	readonly bar: number;
};

export const sceneTimings: readonly SceneTiming[] = [
	// Bar 32 is where everything comes back in after a one-bar stop.
	{id: 'time-travel', component: 'TimeTravel', track: 'time-travel', bar: 32},
	// Bars 48–56 drop the bass out.
	{id: 'breakdown', component: 'Breakdown', track: 'time-travel', bar: 48},
	{id: 'the-drop', component: 'TheDrop', track: 'demo', bar: 0},
	{id: 'after-hours', component: 'AfterHours', track: 'demo', bar: 16},
];

export const sceneStart = (timing: SceneTiming) => {
	const track = tracks[timing.track];
	return Math.round((track.downbeat + timing.bar * barSeconds(track)) * 100) / 100;
};

export const sceneFrames = (timing: SceneTiming) =>
	Math.round(SCENE_BARS * barSeconds(tracks[timing.track]) * SCENE_FPS);

/** The frame the stage opens on. static/scenes/<id>.webp are renders of it. */
export const SCENE_POSTER_FRAME = 24;

/** Seconds of music kept before a scene starts, for the analysis windows that look back. */
export const CLIP_LEAD_SECONDS = 20;
/** Seconds of music kept after the loop ends, for the windows that look ahead. */
export const CLIP_TAIL_SECONDS = 2;

const hundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * The live preview plays an excerpt of the track, not the whole file: every visualizer
 * streams its own copy of the audio, and a full track is ~10 MB each. The excerpt keeps
 * the track's own timeline, with silence before `from`, because elements read absolute
 * time (Circle's glow ring brightens with it) and the copied code uses the full track.
 */
export const sceneClip = (timing: SceneTiming) => {
	const start = sceneStart(timing);
	const from = hundredths(Math.max(0, start - CLIP_LEAD_SECONDS));
	const loopSeconds = sceneFrames(timing) / SCENE_FPS;
	return {
		src: `/audio/${timing.id}.m4a`,
		/** Where the music starts, in seconds of the track. Everything before it is silent. */
		from,
		/** How much music follows `from`. */
		seconds: hundredths(start - from + loopSeconds + CLIP_TAIL_SECONDS),
	};
};
