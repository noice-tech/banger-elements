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
