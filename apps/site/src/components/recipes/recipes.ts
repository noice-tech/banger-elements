// /examples shows the same TSX that `bun run recipes` renders.
export const RECIPE_FPS = 30;
const FOUR_BARS = Math.round((60 / 122) * 4 * 4 * RECIPE_FPS);

export type Recipe = {
	readonly id: string;
	/** The exported component, which is also the Remotion composition ID. */
	readonly component: string;
	readonly title: string;
	readonly use: string;
	readonly description: string;
	readonly width: number;
	readonly height: number;
	readonly durationInFrames: number;
	/** Local demo audio, relative to the site's static directory. Otherwise use the demo song. */
	readonly audioFile?: string;
	readonly scale: number;
	/** VP9 quality for the site clip; noisy pictures need a higher value to stay small. */
	readonly crf?: number;
	/** Element slugs, back to front. */
	readonly layers: readonly string[];
	readonly poster: number;
};

export const recipes: readonly Recipe[] = [
	{
		id: 'episode-clip',
		component: 'EpisodeClip',
		title: 'Episode clip',
		use: 'Podcast audiogram',
		description:
			'A spoken excerpt from a fictional audio-engineering podcast. A ring and waveform respond to the same voice, while large, timed captions carry the hook even with sound off.',
		width: 1080,
		height: 1080,
		durationInFrames: 345,
		audioFile: 'recipes/episode.mp3',
		scale: 0.6,
		layers: ['circle', 'waveform'],
		poster: 45,
	},
	{
		id: 'release-teaser',
		component: 'ReleaseTeaser',
		title: 'Release teaser',
		use: 'Single announcement',
		description:
			'Opens on the drop with the title punching in, then lands the release date on the last bar. Synthwave and a segmented spectrum run through one VHS wrapper; the type sits above the tape so it stays readable on a phone.',
		width: 1280,
		height: 720,
		durationInFrames: FOUR_BARS,
		scale: 0.75,
		// VHS grain is expensive to encode.
		crf: 50,
		layers: ['synthwave', 'spectre', 'vhs'],
		poster: 200,
	},
	{
		id: 'vertical-canvas',
		component: 'VerticalCanvas',
		title: 'Vertical canvas',
		use: 'Reels, Shorts, streaming canvas',
		description:
			'A 9:16 loop that starts on a downbeat and lasts four bars, so it repeats seamlessly. Ferrofluid floats over a Liquid tunnel, with the artist and title kept clear of the platform UI.',
		width: 1080,
		height: 1920,
		durationInFrames: FOUR_BARS,
		scale: 0.4,
		layers: ['liquid', 'ferrofluid'],
		poster: 90,
	},
	{
		id: 'rainy-stream',
		component: 'RainyStream',
		title: 'Rainy stream',
		use: 'Livestream background',
		description:
			'A calm city at night behind wet glass, with rain running down the frame. Wet Glass only treats its children, so the title and now-playing card sit in front of it and stay sharp.',
		width: 1280,
		height: 720,
		durationInFrames: FOUR_BARS,
		scale: 0.75,
		layers: ['city', 'wet-glass', 'waveform'],
		poster: 60,
	},
];
