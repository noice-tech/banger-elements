import catalog from '../../../../packages/elements/dist/catalog.json';

const details = {
	ferrofluid: {
		title: 'Ferrofluid',
		renderer: 'WebGL2',
		tagline: 'Liquid metal, moved by sound.',
		description:
			'A liquid-metal sphere that pulses, flows and forms spikes with your music. Shape its surface and add colorful reflections for a glossy, otherworldly look.',
		controls: [
			'intensity / pattern / fluidity — spikes and deformation',
			'color / roughness / iridescence — metallic finish',
			'shineColor — color of the warm reflection',
			'shineX / shineY / shineZ — reflection direction (not canvas coordinates; zero restores the default direction)',
			'shineIntensity / shineSize — reflection brightness and spread',
			'mappingMode — uniform, latitude, radial or voronoi frequency mapping',
			'quality — low, medium or high mesh detail',
		],
		limitation:
			'Experimental. Requires WebGL2. High quality is GPU-intensive; dense spikes need more mesh detail. Extreme gain or deformation can clip outside the canvas. Motion continues in silence.',
	},
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
			'A white-edged rainbow halo with bass-driven expansion and delayed trails, faithfully adapted from the original shader without its icon or background.',
		controls: [
			'artworkSrc — optional artwork URL or Studio asset',
			'colorMode — original rainbow or custom startColor / endColor gradient',
			'inputGainDb — visual gain; 0 matches the source analyzer',
			'radius / intensity — ring shape and response; source defaults are 0.12 / 1',
			'trailDepth / waveDelay / motionBlur — delayed trails and temporal afterglow',
			'glowBlur / glowSpread — glow treatment',
		],
		limitation:
			'Experimental. Requires WebGL2. Uses a fixed 44.1 kHz / 60 Hz reference and decodes the full audio for deterministic bass accumulation; long tracks require more memory and first seeks may take longer. Artwork needs CORS access. Legacy gain/intensity presets should be reset for the corrected FFT.',
	},
	'audio-particles': {
		title: 'Audio Particles',
		renderer: 'WebGL2',
		tagline: 'Small particles. Big energy.',
		description:
			'Independent bass-reactive particles. Use them alone, or explicitly mask them around Halo.',
		controls: [
			'density / size — particle field',
			'startTimeInSeconds — emission start relative to the element: -5 pre-fills the field (default), 0 starts fresh, positive values delay emission; independent of audio trim',
			'reactiveSpeed — bass-reactive motion',
			'maskHalo — conservative Halo exclusion; match its radius, inputGainDb and intensity (source defaults: 0.12, 0, 1)',
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
