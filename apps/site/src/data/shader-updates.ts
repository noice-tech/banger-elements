export const shaderDetails = {
	pulse: {
		title: 'Pulse',
		renderer: 'WebGL2',
		tagline: 'A twisting tunnel of neon rings and spiraling particles.',
		description:
			'Layered hexagonal rings, an energy core and orbiting particles respond to bass, mids and treble.',
		controls: [
			'tunnelDepth / twist / layers / warp — tunnel structure',
			'particles / glow / speed / bpm — energy and motion',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
	rooftop: {
		title: 'Rooftop',
		renderer: 'WebGL2',
		tagline: 'Float above a city of audio-reactive rooftops.',
		description:
			'A procedural skyline with rooftop details, street lights, fog and frequency-driven lighting.',
		controls: [
			'skyColor / buildingColor / streetColor / lightColor — city palette',
			'cameraHeight / gridDensity / carDensity / fog — skyline and lights',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
	cathedral: {
		title: 'Cathedral',
		renderer: 'WebGL2',
		tagline: 'Travel through illuminated arches and stained glass.',
		description:
			'A raymarched cathedral with glowing glass, stone columns and atmospheric lighting.',
		controls: [
			'stoneColor / glassColor1 / glassColor2 / lightColor — architecture palette',
			'columnScale / glassGlow / fog / speed — architecture and movement',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
	liquid: {
		title: 'Liquid',
		renderer: 'WebGL2',
		tagline: 'Flow through a swirling, luminous liquid tunnel.',
		description: 'Organic tunnel walls, spectral ribbons and volumetric light follow the music.',
		controls: [
			'color1 / color2 / glowColor — liquid palette',
			'swirl / distortion / tunnelRadius / fog — tunnel shape',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
	chrome: {
		title: 'Chrome',
		renderer: 'WebGL2',
		tagline: 'Liquid metal reflecting the shape of your sound.',
		description:
			'A flowing, bump-mapped metallic surface with spectrum reflections, moving lights and an optional image texture.',
		controls: [
			'color1 / color2 / color3 — metal palette',
			'warpIntensity / warpSpeed / bumpStrength / specularPower — metal surface',
			'textureSrc / textureScale / textureBlend — optional CORS-accessible surface image',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
	neuron: {
		title: 'Neuron',
		renderer: 'WebGL2',
		tagline: 'Explore an illuminated network of neural structures.',
		description:
			'A procedural neural landscape with reflective surfaces, pulsing sparks and frequency-driven glow.',
		controls: [
			'color1 / color2 / glowColor — neural palette',
			'scale / thickness / reflection / fog / cameraMovement — structure and camera',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
	matrix: {
		title: 'Matrix',
		renderer: 'WebGL2',
		tagline: 'An evolving field of colorful fractal interference.',
		description:
			'Layered noise creates flowing, audio-reactive patterns with an optimized kernel supporting up to 24 iterations.',
		controls: [
			'color1 / color2 / glowColor — pattern palette',
			'scale / iterations / spread / colorCycle / glow — structure and treatment',
			'textureSrc — optional CORS-accessible noise image; empty uses procedural noise',
			'responsive / inputGainDb — visual audio response, without changing playback loudness',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds, with the original fixed camera and spherical projection. Motion continues in silence. Raymarching and dense patterns can be GPU-intensive; optional image URLs require CORS access.',
	},
} as const;
