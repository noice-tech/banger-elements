import catalog from '../../../../packages/elements/dist/catalog.json';

const details = {
	waveform: {
		title: 'Waveform',
		renderer: 'SVG',
		tagline: 'Let the whole track take shape.',
		description:
			'A moving, filled envelope of the source audio. A clean foundation for lyric videos, podcasts and track excerpts.',
		controls: [
			'color — envelope fill',
			'intensity — visual amplitude',
			'windowInSeconds — visible audio window',
		],
		limitation: 'An amplitude envelope, not a frequency spectrum. Analysis uses the first channel.',
	},
	spectre: {
		title: 'Spectre',
		renderer: 'WebGL2',
		tagline: 'Every frequency, in focus.',
		description:
			'Frequency bars with crisp gradients, or a segmented treatment. Both use the original shaders.',
		controls: [
			'spectreVariant — bars or segmented',
			'count — frequency bar count',
			'startColor / endColor — gradient',
		],
		limitation: 'Requires WebGL2 and graphics acceleration. No SVG fallback.',
	},
	oscilloscope: {
		title: 'Oscilloscope',
		renderer: 'SVG',
		tagline: 'The signal, stripped back.',
		description:
			'A triggered PCM trace that follows the shape of the audio signal. Fine lines, fast detail, no extra ornament.',
		controls: [
			'lineColor / lineWidth — trace styling',
			'amplitude — trace height',
			'sampleCount — source sample span',
		],
		limitation: 'A time-domain trace, not a loudness meter. Analysis uses the first channel.',
	},
	pulsar: {
		title: 'Pulsar',
		renderer: 'WebGL2',
		tagline: 'Sound with another dimension.',
		description:
			'An audio-deformed volume drawn by the original raymarch shader. Dense, luminous and always in motion.',
		controls: [
			'colorMode — gradient or rainbow',
			'density / pattern — volume structure',
			'volume / intensity — visual shape and response',
		],
		limitation:
			'Raymarching can be GPU-intensive. The volume control changes the visual, not playback loudness. Requires WebGL2.',
	},
	circle: {
		title: 'Circle',
		renderer: 'WebGL2',
		tagline: 'Put your sound at the center.',
		description:
			'Four reactive ring treatments: radial bars, glow, waveform and dots, rendered with the original WebGL2 shaders.',
		controls: [
			'circleVariant — radial-bars, glow-ring, waveform-ring or dotted-ring',
			'count / lineWidth — detail and stroke',
			'startColor / endColor — gradient',
		],
		limitation:
			'Requires WebGL2. Treatment controls have different visual effects across variants.',
	},
	halo: {
		title: 'Halo',
		renderer: 'WebGL2',
		tagline: 'Leave a little afterglow.',
		description:
			'Layered audio-reactive trails with optional artwork. An experimental treatment built from the original shader.',
		controls: [
			'artworkSrc — optional artwork URL or Studio asset',
			'radius / intensity — ring shape and response',
			'trailDepth / waveDelay — delayed trails',
			'glowBlur / glowSpread — glow treatment',
		],
		limitation:
			'Experimental. Requires WebGL2; stacked canvases may reduce preview speed. Artwork needs CORS access. Source component is named Halo.',
	},
	'audio-particles': {
		title: 'Audio Particles',
		renderer: 'WebGL2',
		tagline: 'Small particles. Big energy.',
		description:
			'Independent bass-reactive particles. Use them alone, or explicitly mask them around Halo.',
		controls: [
			'density / size — particle field',
			'reactiveSpeed — bass-reactive motion',
			'maskHalo / radius — optional explicit Halo mask',
			'color / intensity — appearance',
		],
		limitation:
			'Experimental. Requires WebGL2. Halo masking is opt-in; it does not automatically discover another Element. Procedural motion may continue in silence.',
	},
} as const;

export const elements = catalog.map((entry) => ({
	...entry,
	...details[entry.slug as keyof typeof details],
}));
