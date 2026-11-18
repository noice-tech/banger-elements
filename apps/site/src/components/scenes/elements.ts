import {
	AudioParticles,
	Cathedral,
	Circle,
	Fisheye,
	Hyperloop,
	Moon,
	Oscilloscope,
	Spectre,
	Synthwave,
	Vhs,
	Waveform,
	WetGlass,
} from '../../../../../packages/elements/dist/components';

export const sceneElements = {
	'audio-particles': AudioParticles,
	cathedral: Cathedral,
	circle: Circle,
	fisheye: Fisheye,
	hyperloop: Hyperloop,
	moon: Moon,
	oscilloscope: Oscilloscope,
	spectre: Spectre,
	synthwave: Synthwave,
	vhs: Vhs,
	waveform: Waveform,
	'wet-glass': WetGlass,
} as const;

export type SceneElementSlug = keyof typeof sceneElements;
