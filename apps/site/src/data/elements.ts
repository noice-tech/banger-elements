import catalog from '../../../../packages/elements/dist/catalog.json';

export const elementCategories = [
	{id: 'visualizers', title: 'Visualizers'},
	{id: 'shaders', title: 'Shaders'},
] as const;

const details = {
	trip: {
		title: 'Trip',
		renderer: 'WebGL2',
		tagline: 'A psychedelic tunnel that moves with your music.',
		description:
			'A full-frame procedural background with twisting, audio-reactive patterns. Customize its colors, structure and tempo, or layer a visualizer on top.',
		controls: [
			'baseColor / intensifyColor — background and highlight colors',
			'thickness / pattern — tunnel structure',
			'intensity — raymarch iterations, not audio gain; fractional values truncate to whole iterations, and zero does not hide the background',
			'bpm — animation tempo (default 120); changing it changes phase, not an accumulated playback speed',
			'timeOffsetInSeconds — animation phase, independent of audioOffsetInSeconds',
			'inputGainDb — visual audio gain, without changing playback volume',
		],
		limitation:
			'Requires WebGL2. Higher intensity costs more GPU time. Opaque inside its bounds: place it behind other elements. Uses the original fixed camera and spherical projection; motion continues in silence. Analysis runs at a fixed 60 Hz.',
	},

	ferrofluid: {
		title: 'Ferrofluid',
		renderer: 'WebGL2',
		tagline: 'Liquid metal that moves with your music.',
		description:
			'A metallic sphere that pulses and forms spikes with your audio. Adjust the surface, finish and reflections.',
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
			'Requires WebGL2. High quality is GPU-intensive; dense spikes need more mesh detail. Extreme gain or deformation can clip outside the canvas. Motion continues in silence.',
	},
	waveform: {
		title: 'Waveform',
		renderer: 'SVG',
		tagline: 'Your track as a scrolling waveform.',
		description:
			'A filled waveform showing how the audio level changes over time. Adjust the color, height and visible duration.',
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
		tagline: 'A frequency spectrum in bars or segments.',
		description:
			'Bars show the strength of different audio frequencies. Choose continuous or segmented bars, set their count and customize the color gradient.',
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
		tagline: 'The audio signal, drawn in real time.',
		description:
			'A thin line traces the audio waveform. Adjust its color, thickness and height, or change how many samples it shows.',
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
		tagline: 'A glowing 3D shape that reacts to sound.',
		description:
			'Audio reshapes a glowing volume. Adjust its density, pattern and response, with gradient or rainbow colors.',
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
		tagline: 'Bars, waves, glow or dots around a ring.',
		description:
			'Four audio-reactive ring styles: radial bars, glow, waveform and dots. Customize the colors and level of detail.',
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
		tagline: 'A bass-reactive ring with trailing color.',
		description:
			'A glowing ring expands with the bass and leaves trails behind it. Customize the colors and glow, add artwork or leave the center transparent.',
		controls: [
			'artworkSrc — optional artwork URL or Studio asset',
			'colorMode — rainbow palette or custom startColor / endColor gradient',
			'leadingColor — optional front reactive layer override; unset uses white in rainbow or startColor in gradient',
			'centerMode — filled (default) or transparent cutout, including temporal trails',
			'centerColor — shaded center base color (default #2d2d2d); artwork remains untinted; both are ignored in transparent mode',
			'inputGainDb — visual gain in dB (0 = no boost)',
			'radius / intensity — ring shape and response; defaults are 0.12 / 1',
			'trailDepth / waveDelay / motionBlur — delayed trails and temporal afterglow',
			'glowBlur / glowSpread — glow treatment',
		],
		limitation:
			'Requires WebGL2. Analyzes audio at a fixed 44.1 kHz / 60 Hz and decodes the full track for deterministic bass accumulation; long tracks require more memory and first seeks may take longer. Artwork needs CORS access.',
	},
	'audio-particles': {
		title: 'Audio Particles',
		renderer: 'WebGL2',
		tagline: 'Floating particles that react to bass.',
		description:
			'A field of particles whose motion responds to bass. Adjust their size, density and color. Use them on their own or mask them around Halo.',
		controls: [
			'density / size — particle field',
			'startTimeInSeconds — emission start relative to the element: -5 pre-fills the field (default), 0 starts fresh, positive values delay emission; independent of audio trim',
			'reactiveSpeed — bass-reactive motion',
			'maskHalo — conservative Halo exclusion; match its radius, inputGainDb and intensity (defaults: 0.12, 0, 1)',
			'color / intensity — appearance',
		],
		limitation:
			'Requires WebGL2. Halo masking is opt-in; it does not automatically discover another Element. Procedural motion may continue in silence.',
	},
} as const;

export const elements = catalog.map((entry) => ({
	...entry,
	...details[entry.slug as keyof typeof details],
}));
