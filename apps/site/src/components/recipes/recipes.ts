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
			'The video you upload alongside a single, styled like a now-playing screen. The cover is a live Flowers shader that blooms with the music, the same shader washes the background in its colours, and a rainbow spectrum and progress bar run under the title. Set SONG, CLIP_AT and TRACK_LENGTH, then render the full song.',
		width: 1280,
		height: 720,
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
		use: 'Landscape single release',
		description:
			'Cut to the music: a slit of the night sky during the pickup, a burst of light and the title on the hit, the artist on a close-up a bar later, then a release card where each streaming button lands on a beat. Set DROP and BPM from your track and every cut moves with them.',
		width: 1280,
		height: 720,
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
		use: 'Vertical song tease',
		description:
			'Show a song before it is finished, the way artists tease new music on Reels, Shorts and TikTok. A playhead runs through a half-written arrangement while captions talk over it, and the music stops where the track does. Edit LANES and CAPTIONS to match your session.',
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
			'An endless ride along a rainbow rail toward a low sun, made to loop behind a single on Spotify. A second copy of the shader runs one lap ahead and fades out over the first 1.5 seconds, so the last frame leads straight back into the first. Render it muted as an MP4.',
		width: 720,
		height: 1280,
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
			'A spoken excerpt from a fictional audio-engineering podcast, set like a printed pull quote. Each word darkens as it is spoken, so the hook reads with the sound off, while a ring around the microphone and the waveform follow the voice.',
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
			'A night view through a rainy window in a lamp-lit room, with the station name and a now-playing card on the glass and a clock, a steaming mug and a plant on the sill. Wet Glass covers only the panes, so the overlays and the window frame stay sharp. Loop it behind a stream, or render it for the length of your playlist.',
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
