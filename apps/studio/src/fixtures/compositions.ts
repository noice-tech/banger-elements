// Shared by Studio and render scripts. Only catalog entries need static
// posters and gallery loops; the remaining fixtures are smoke-rendered only.
export const compositions = [
	{id: 'Ferrofluid', slug: 'ferrofluid'},
	{id: 'FerrofluidFluid', slug: null},
	{id: 'Waveform', slug: 'waveform'},
	{id: 'Spectre', slug: 'spectre'},
	{id: 'SpectreSegmented', slug: null},
	{id: 'Oscilloscope', slug: 'oscilloscope'},
	{id: 'Pulsar', slug: 'pulsar'},
	{id: 'Circle', slug: 'circle'},
	{id: 'CircleGlow', slug: null},
	{id: 'CircleWaveform', slug: null},
	{id: 'CircleDotted', slug: null},
	{id: 'Halo', slug: 'halo'},
	{id: 'AudioParticles', slug: 'audio-particles'},
	{id: 'HaloAndParticles', slug: null},
	{id: 'Space', slug: 'space'},
	{id: 'Synthwave', slug: 'synthwave'},
	{id: 'Mushrooms', slug: 'mushrooms'},
	{id: 'Trip', slug: 'trip'},
	{id: 'TripCustom', slug: null},
	{id: 'TripAndCircle', slug: null},
] as const;
