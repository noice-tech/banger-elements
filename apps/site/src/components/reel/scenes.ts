// Shared by the reel composition and the timeline under the clip.
export const REEL_FPS = 30;
export const BEAT = (60 / 122) * REEL_FPS;
export const BAR = BEAT * 4;
/** Where the reel starts in the song, in frames: one bar before the drop. */
export const SONG_FRAME = Math.round(2.685 * REEL_FPS - BAR);
export const REEL_FRAMES = Math.round(BAR * 9);

export const at = (bars: number) => Math.round(bars * BAR);

export type ReelScene = {
	readonly id: string;
	readonly from: number;
	readonly to: number;
	/** The headline layers, back to front. The recap reuses the other scenes. */
	readonly layers: readonly string[];
};

export const reelScenes: readonly ReelScene[] = [
	{id: 'intro', from: 0, to: at(1), layers: ['Space', 'Waveform']},
	{id: 'drop', from: at(1), to: at(3), layers: ['Hyperloop', 'Halo', 'Circle', 'Audio Particles']},
	{id: 'ride', from: at(3), to: at(5), layers: ['Synthwave', 'Spectre', 'Audio Particles']},
	{id: 'tape', from: at(5), to: at(7), layers: ['Trip', 'Fractals', 'Circle', 'VHS']},
	{id: 'metal', from: at(7), to: at(8), layers: ['Liquid', 'Ferrofluid']},
	{id: 'recap', from: at(8), to: REEL_FRAMES, layers: ['Recap']},
];

export const DROP = at(1);
/** The kick runs on every beat from the drop. The last beat of the window is a kick-less riser. */
export const KICKS_END = Math.round(at(8) + BEAT * 3);
