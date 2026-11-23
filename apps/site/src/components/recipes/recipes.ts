// /examples shows the same TSX that `bun run recipes` renders.
export const RECIPE_FPS = 60;
export const DEMO_SONG = 'https://cdn.banger.show/assets/banger-demo-song-min.mp3';

export type Recipe = {
	readonly id: string;
	/** The exported component, which is also the Remotion composition ID. */
	readonly component: string;
	readonly title: string;
	readonly use: string;
	readonly description: string;
	readonly width: number;
	readonly height: number;
	/** Render scale that brings a 720p composition to the 1080p it ships at. */
	readonly outputScale?: number;
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
			'The lyrics appear word by word in time with the vocal, above a ring of light that rises from the bottom edge. The ring stays white until the title line, then turns full colour. For your own song, put your lyrics in LINES and set the second each line starts and ends.',
		width: 1280,
		height: 720,
		outputScale: 1.5,
		durationInFrames: 21 * RECIPE_FPS,
		audioFile: 'recipes/invisible-light.mp3',
		audioCredit: {
			title: 'Invisible Light',
			artist: 'Josh Woodward',
			source:
				'https://commons.wikimedia.org/wiki/File:Josh_Woodward_-_The_Wake_-_07_-_Invisible_Light.ogg',
			license: 'CC BY 3.0 US',
			licenseUrl: 'https://creativecommons.org/licenses/by/3.0/us/',
		},
		scale: 0.75,
		crf: 48,
		layers: ['audio-particles', 'halo'],
		poster: 666,
	},
	{
		id: 'music-visualizer',
		component: 'MusicVisualizer',
		title: 'Music visualizer',
		use: 'Full-track visualizer',
		description:
			'This is the video you upload with a single, laid out like a now-playing screen. The cover is a Flowers shader that reacts to the music. A small copy of the same shader, stretched and blurred, fills the background with its colours. A rainbow spectrum and a progress bar sit under the title. Set SONG, CLIP_AT and TRACK_LENGTH, then render the full song.',
		width: 1280,
		height: 720,
		outputScale: 1.5,
		durationInFrames: Math.round(13.5 * RECIPE_FPS),
		audioFile: 'recipes/haze.mp3',
		audioCredit: {
			title: 'Haze',
			artist: 'Zutsuri',
			source: 'https://archive.org/details/jamendo-165035',
			license: 'CC BY 3.0',
			licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
		},
		scale: 0.75,
		// The flowers' fine line work is expensive to encode.
		crf: 50,
		layers: ['flowers', 'spectre'],
		poster: 300,
	},
	{
		id: 'release-teaser',
		component: 'ReleaseTeaser',
		title: 'Release trailer',
		use: 'Trailer for a new single',
		description:
			"Every cut follows the music. During the pickup you see a slit of night sky. On the hit, a burst of light reveals the title, and a bar later the artist's name appears in close-up. On the release card, each streaming button appears on a beat. Set DROP and BPM from your track and the cuts move with them.",
		width: 1280,
		height: 720,
		outputScale: 1.5,
		durationInFrames: Math.round(14.1 * RECIPE_FPS),
		audioFile: 'recipes/swansong.mp3',
		audioCredit: {
			title: 'Swansong',
			artist: 'Josh Woodward',
			source: 'https://commons.wikimedia.org/wiki/File:Josh_Woodward_-_Swansong.ogg',
			license: 'CC BY 3.0 US',
			licenseUrl: 'https://creativecommons.org/licenses/by/3.0/us/',
		},
		scale: 0.75,
		// VHS grain is expensive to encode.
		crf: 48,
		layers: ['moon', 'hyperloop', 'vhs', 'spectre'],
		poster: 700,
	},
	{
		id: 'release-reel',
		component: 'ReleaseReel',
		title: 'Work-in-progress reel',
		use: 'Teaser for an unfinished song',
		description:
			'Post this on Reels, Shorts or TikTok to tease a song you have not finished. A playhead moves through a half-written arrangement while captions appear over it, and the music stops where the written part ends. Edit LANES and CAPTIONS to match your session.',
		width: 1080,
		height: 1920,
		// Five bars at 122 BPM, then a hold on the stopped playhead.
		durationInFrames: Math.round((60 / 122) * 4 * 5 * RECIPE_FPS) + Math.round(1.4 * RECIPE_FPS),
		scale: 0.5,
		layers: ['waveform', 'spectre'],
		poster: 200,
	},
	{
		id: 'vertical-canvas',
		component: 'VerticalCanvas',
		title: 'Spotify Canvas',
		use: 'Silent cover-art loop',
		description:
			"The camera moves along a rainbow rail toward a low sun, in a loop made for a single's Spotify Canvas. A second copy of the shader runs one lap ahead and fades out over the first 1.5 seconds, so the end joins the start without a jump. Render it muted as an MP4.",
		width: 720,
		height: 1280,
		outputScale: 1.5,
		durationInFrames: 8 * RECIPE_FPS,
		silent: true,
		scale: 0.6,
		// The rail's outlines are expensive to encode.
		crf: 53,
		layers: ['rail'],
		poster: 240,
	},
	{
		id: 'episode-clip',
		component: 'EpisodeClip',
		title: 'Episode clip',
		use: 'Podcast audiogram',
		description:
			'This clip is from a made-up audio-engineering podcast, laid out like a printed pull quote. Each word darkens as the host says it, so viewers can follow the quote with the sound off. A ring around the microphone and the waveform move with the voice.',
		width: 1080,
		height: 1080,
		durationInFrames: Math.round(11.5 * RECIPE_FPS),
		audioFile: 'recipes/episode.mp3',
		scale: 0.6,
		layers: ['circle', 'waveform'],
		poster: 240,
	},
	{
		id: 'rainy-stream',
		component: 'RainyStream',
		title: 'Lo-fi stream background',
		use: 'Livestream backdrop',
		description:
			'You look out of a rainy window at night from a lamp-lit room. The station name and a now-playing card sit on the glass, and a clock, a steaming mug and a plant sit on the sill. Wet Glass covers only the panes, so the overlays and the window frame stay sharp. Loop it behind a stream, or render it for the length of your playlist.',
		width: 1280,
		height: 720,
		outputScale: 1.5,
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
