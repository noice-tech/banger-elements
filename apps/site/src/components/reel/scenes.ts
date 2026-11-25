export const REEL_FPS = 60;
/** A thirtieth of a second, in frames: the reel's fades, decays and hits are counted in these. */
export const TICK = REEL_FPS / 30;
export const BEAT = (60 / 122) * REEL_FPS;
export const BAR = BEAT * 4;
/** Where the reel starts in the song, in frames: one bar before the drop. */
export const SONG_FRAME = Math.round(2.685 * REEL_FPS - BAR);
const at = (bars: number) => Math.round(bars * BAR);
export const REEL_FRAMES = at(11);

export type ReelScene = {
	readonly id: string;
	readonly from: number;
	readonly to: number;
	/** The headline layers, back to front. The recap reuses the other scenes. */
	readonly layers: readonly string[];
};

export const reelScenes: readonly ReelScene[] = [
	{id: 'intro', from: 0, to: at(1), layers: ['Space', 'Waveform']},
	{id: 'drop', from: at(1), to: at(3), layers: ['Hyperloop', 'Halo', 'Circle']},
	{id: 'ride', from: at(3), to: at(5), layers: ['Synthwave', 'Spectre', 'Audio Particles']},
	{id: 'tape', from: at(5), to: at(7), layers: ['Trip', 'Fractals', 'Circle', 'VHS']},
	{id: 'metal', from: at(7), to: at(8), layers: ['Liquid', 'Ferrofluid']},
	{id: 'recap', from: at(8), to: at(9), layers: ['Recap']},
	{id: 'outro', from: at(9), to: REEL_FRAMES, layers: ['Pulsar', 'Space']},
];

export const DROP = at(1);
export const KICKS_END = Math.round(at(8) + BEAT * 3);
export const OUTRO = at(9);
