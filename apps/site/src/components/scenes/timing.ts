// EXTERNAL: scripts/scenes.mjs loads this file with Node type stripping, so it imports nothing.
export const SCENE_FPS = 30;
export const SCENE_BARS = 8;

export type TrackId = 'time-travel' | 'demo';

export type Track = {
	readonly src: string;
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
		downbeat: 2.685,
	},
};

export const barSeconds = (track: Track) => (60 / track.bpm) * 4;

export type SceneTiming = {
	readonly id: string;
	readonly component: string;
	readonly track: TrackId;
	/** The bar the loop starts on, counted from the track's first downbeat. */
	readonly bar: number;
};

export const sceneTimings: readonly SceneTiming[] = [
	{id: 'time-travel', component: 'TimeTravel', track: 'time-travel', bar: 32},
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

export const SCENE_POSTER_FRAME = 24;

/** Seconds of music kept before a scene starts, for the analysis windows that look back. */
export const CLIP_LEAD_SECONDS = 20;
/** Seconds of music kept after the loop ends, for the windows that look ahead. */
export const CLIP_TAIL_SECONDS = 2;

const hundredths = (value: number) => Math.round(value * 100) / 100;

export const sceneClip = (timing: SceneTiming) => {
	const start = sceneStart(timing);
	const from = hundredths(Math.max(0, start - CLIP_LEAD_SECONDS));
	const loopSeconds = sceneFrames(timing) / SCENE_FPS;
	return {
		src: `/audio/${timing.id}.m4a`,
		from,
		seconds: hundredths(start - from + loopSeconds + CLIP_TAIL_SECONDS),
	};
};
