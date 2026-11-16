/*
 * The cut list of the home page's closing reel, shared by the composition
 * (reel.tsx) and the timeline under the clip, so the two cannot drift apart.
 *
 * The demo song runs at 122 BPM and its drop lands at 2.685 s. The reel opens
 * one bar before the drop and runs eight bars past it.
 */
export const REEL_FPS = 30;
export const BEAT = (60 / 122) * REEL_FPS;
export const BAR = BEAT * 4;
/** Where the reel starts in the song, in frames: one bar before the drop. */
export const SONG_FRAME = Math.round(2.685 * REEL_FPS - BAR);
export const REEL_FRAMES = Math.round(BAR * 9);

const at = (bars: number) => Math.round(bars * BAR);

export type ReelScene = {
	readonly id: string;
	readonly from: number;
	readonly to: number;
	/** Element titles, back to front. The recap reuses the other scenes. */
	readonly layers: readonly string[];
};

export const reelScenes: readonly ReelScene[] = [
	{id: 'intro', from: 0, to: at(1), layers: ['Space', 'Waveform']},
	{id: 'drop', from: at(1), to: at(3), layers: ['Hyperloop', 'Halo']},
	{id: 'ride', from: at(3), to: at(5), layers: ['Synthwave', 'Spectre', 'Audio Particles']},
	{id: 'tape', from: at(5), to: at(7), layers: ['Trip', 'Circle', 'VHS']},
	{id: 'metal', from: at(7), to: at(8), layers: ['Liquid', 'Ferrofluid']},
	{id: 'recap', from: at(8), to: REEL_FRAMES, layers: ['Recap']},
];
