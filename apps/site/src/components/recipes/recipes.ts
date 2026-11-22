// /examples shows the same TSX that `bun run recipes` renders.
export const RECIPE_FPS = 30;
export const DEMO_SONG = 'https://cdn.banger.show/assets/banger-demo-song-min.mp3';
const FOUR_BARS = Math.round((60 / 122) * 4 * 4 * RECIPE_FPS);
// The demo song from 1.7 s: one beat before the drop, then four bars.
const PICKUP_AND_FOUR_BARS = Math.round((2.685 - 1.7) * RECIPE_FPS) + FOUR_BARS;

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
	readonly audioCredit?: {
		readonly title: string;
		readonly artist: string;
		readonly source: string;
		readonly license: string;
		readonly licenseUrl: string;
	};
	/** Render without an audio track and omit the preview's sound control. */
	readonly silent?: true;
	readonly scale: number;
	/** VP9 quality for the site clip; noisy pictures need a higher value to stay small. */
	readonly crf?: number;
	/** Element slugs, back to front. */
	readonly layers: readonly string[];
	readonly poster: number;
};

export const recipes: readonly Recipe[] = [
	{
		id: 'lyric-video',
		component: 'LyricVideo',
		title: 'Lyric video',
		use: 'Lyrics timed to the vocal',
		description:
			'Each line appears word by word as it is sung, above a ring of light rising from the bottom edge. The ring stays white until the title line, then opens up in full colour. For your own song, replace LINES with your lyrics and the seconds each line starts and ends.',
		width: 1280,
		height: 720,
		durationInFrames: Math.round(19.5 * RECIPE_FPS),
		audioFile: 'recipes/haze.mp3',
		audioCredit: {
			title: 'Haze',
			artist: 'Zutsuri',
			source: 'https://ccmixter.org/files/Zutsuri/56384',
			license: 'CC BY 3.0',
			licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
		},
		scale: 0.75,
		crf: 48,
		layers: ['audio-particles', 'halo'],
		poster: 366,
	},
	{
		id: 'music-visualizer',
		component: 'MusicVisualizer',
		title: 'Music visualizer',
		use: 'Full-track visualizer',
		description:
			'The video you upload alongside a single. The title sits inside a spectrum ring over a tunnel that pulses with the kick, and the progress bar counts through the whole track. Set TITLE, ARTIST and TRACK_LENGTH, then render the full song.',
		width: 1280,
		height: 720,
		durationInFrames: PICKUP_AND_FOUR_BARS,
		scale: 0.75,
		crf: 46,
		layers: ['neuron', 'circle'],
		poster: 150,
	},
	{
		id: 'release-teaser',
		component: 'ReleaseTeaser',
		title: 'Release trailer',
		use: 'Landscape single announcement',
		description:
			'Cut to the music: a slit of the artwork during the pickup, the title on the drop, the artist on a close-up a bar later, then the release date. Set START, DROP and BPM from your track and every cut moves with them.',
		width: 1280,
		height: 720,
		durationInFrames: PICKUP_AND_FOUR_BARS,
		scale: 0.75,
		// VHS grain is expensive to encode.
		crf: 48,
		layers: ['synthwave', 'vhs', 'spectre'],
		poster: 60,
	},
	{
		id: 'release-reel',
		component: 'ReleaseReel',
		title: 'Release reel',
		use: 'Vertical single announcement',
		description:
			'The same release for Reels, Shorts and TikTok. It opens on the drop with the title already on screen, cuts closer on each bar and ends on the date. All text stays clear of the captions and buttons the apps draw on top.',
		width: 1080,
		height: 1920,
		durationInFrames: Math.round((60 / 122) * 18 * RECIPE_FPS),
		scale: 0.5,
		layers: ['synthwave'],
		poster: 30,
	},
	{
		id: 'vertical-canvas',
		component: 'VerticalCanvas',
		title: 'Spotify Canvas',
		use: 'Silent cover-art loop',
		description:
			'Liquid chrome in the single’s colours, with no text. A second copy of the shader runs one loop ahead and fades out over the first 1.5 seconds, so the last frame leads straight back into the first. Render it muted as an MP4.',
		width: 720,
		height: 1280,
		durationInFrames: FOUR_BARS,
		silent: true,
		scale: 0.6,
		// Chrome's fine grain is expensive to encode.
		crf: 50,
		layers: ['chrome'],
		poster: 60,
	},
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
		id: 'rainy-stream',
		component: 'RainyStream',
		title: 'Lo-fi stream background',
		use: 'Livestream backdrop',
		description:
			'A night view through a rainy window, with the station name, a now-playing card and a clock on the sill. Wet Glass covers only the view, so the overlays stay sharp. Loop it behind a stream, or render it for the length of your playlist.',
		width: 1280,
		height: 720,
		durationInFrames: 16 * RECIPE_FPS,
		audioFile: 'recipes/caden-currie-lofi.mp3',
		audioCredit: {
			title: 'Lofi',
			artist: 'Caden Currie',
			source: 'https://commons.wikimedia.org/wiki/File:Lofi_by_Caden_Currie.mp3',
			license: 'CC BY 3.0',
			licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
		},
		scale: 0.75,
		layers: ['moon', 'wet-glass', 'waveform'],
		poster: 60,
	},
];
