type ElementCategory = 'visualizers' | 'shaders' | 'effects';

type CatalogEntry = {
	readonly slug: string;
	readonly name: string;
	readonly category: ElementCategory;
	readonly width: number;
	readonly height: number;
};

export const catalog = [
	{slug: 'vhs', name: 'Vhs', category: 'effects', width: 1280, height: 720},
	{slug: 'fisheye', name: 'Fisheye', category: 'effects', width: 1280, height: 720},
	{
		slug: 'ferrofluid',
		name: 'Ferrofluid',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'waveform',
		name: 'Waveform',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'spectre',
		name: 'Spectre',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'oscilloscope',
		name: 'Oscilloscope',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'pulsar',
		name: 'Pulsar',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'circle',
		name: 'Circle',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'halo',
		name: 'Halo',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'audio-particles',
		name: 'AudioParticles',
		category: 'visualizers',
		width: 1280,
		height: 720,
	},
	{
		slug: 'trip',
		name: 'Trip',
		category: 'shaders',
		width: 1280,
		height: 720,
	},
	{
		slug: 'space',
		name: 'Space',
		category: 'shaders',
		width: 1280,
		height: 720,
	},
	{
		slug: 'synthwave',
		name: 'Synthwave',
		category: 'shaders',
		width: 1280,
		height: 720,
	},
	{
		slug: 'mushrooms',
		name: 'Mushrooms',
		category: 'shaders',
		width: 1280,
		height: 720,
	},
	{slug: 'fractals', name: 'Fractals', category: 'shaders', width: 1280, height: 720},
	{slug: 'hyperloop', name: 'Hyperloop', category: 'shaders', width: 1280, height: 720},
	{slug: 'downfall', name: 'Downfall', category: 'shaders', width: 1280, height: 720},
	{slug: 'rail', name: 'Rail', category: 'shaders', width: 1280, height: 720},
	{slug: 'rain', name: 'Rain', category: 'shaders', width: 1280, height: 720},
] as const satisfies readonly CatalogEntry[];
