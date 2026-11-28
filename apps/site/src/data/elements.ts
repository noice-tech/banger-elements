import catalog from '../../../../packages/elements/dist/catalog.json';
import {credits} from './credits';
import {shaderDetails} from './shader-updates';

export const elementCategories = [
	{
		id: 'visualizers',
		title: 'Visualizers',
		description: 'Waveforms, spectrums, rings, fluid and particles drawn from your audio.',
		featured: ['ferrofluid', 'halo', 'spectre', 'circle', 'waveform', 'audio-particles'],
	},
	{
		id: 'shaders',
		title: 'Shaders',
		description: 'Full-frame backgrounds that react to your track.',
		featured: ['pulse', 'cathedral', 'liquid', 'chrome', 'neuron', 'matrix'],
	},
	{
		id: 'effects',
		title: 'Effects',
		description: 'Wrap your elements with lens distortion, analog texture and wet glass.',
		featured: ['wet-glass', 'vhs', 'fisheye'],
	},
] as const;

const details = {
	...shaderDetails,
	'wet-glass': {
		title: 'Wet Glass',
		renderer: 'WebGL2',
		tagline: 'A rain-soaked lens over your existing content.',
		description:
			'Wrap text, visualizers and backgrounds in sliding droplets, refraction and wet-glass defocus. Unlike the Rain background shader, this effect filters its children and preserves their transparency. The preview wraps the same Space, Halo, grid and label scene as the other effects; the installed source is only the reusable wrapper.',
		controls: [
			'amount / effectOpacity — rain coverage and effect mix; either at zero bypasses capture',
			'dropSize / speed / seed — droplet shape, motion and deterministic layout',
			'refraction / blur / color — distortion, defocus and water tint; white is neutral',
			'timeOffsetInSeconds — effect phase, independent of child media timing',
		],
		limitation:
			'The faithful shader uses HTML-in-canvas: Chrome 149+ with chrome://flags/#canvas-draw-element for preview, and Remotion 4.0.523+ with ANGLE or Swangle for rendering. Other browsers draw the same droplet field into an SVG filter that blurs and bends the children, so drops, trails and tint match closely; blur is Gaussian rather than the shader’s disk kernel, bright lights look slightly dimmer, and the outer few pixels darken. Filters children only, not siblings or portals; HTML-in-canvas wrappers cannot be nested. Clips to its bounds. Blur uses 16 samples and can be GPU-intensive.',
	},
	fisheye: {
		title: 'Fisheye',
		renderer: 'WebGL2',
		tagline: 'Bend everything inside the frame through a wide-angle lens.',
		description:
			'Wrap text, visualizers and backgrounds in adjustable barrel distortion with perspective compensation. The preview wraps the same Space, Halo, grid and label scene as the other effects; the installed source is only the reusable wrapper.',
		controls: [
			'strength — barrel distortion amount; zero bypasses capture and distortion',
			'perspectiveFactor — compensates the apparent zoom as distortion increases',
		],
		limitation:
			'The faithful path uses WebGL2 and HTML-in-canvas: Chrome 149+ with chrome://flags/#canvas-draw-element for browser preview, and Remotion 4.0.523+ with ANGLE or Swangle for rendering. Other browsers use a deterministic SVG displacement fallback, which may look slightly softer near the edges. Filters children only, never sibling layers or portals; HTML-in-canvas wrappers cannot be nested. Clips to its bounds, and large groups cost more rendering time.',
	},
	vhs: {
		title: 'VHS',
		renderer: 'WebGL2',
		tagline: 'Tape distortion for everything inside the frame.',
		description:
			'Wrap text, visualizers and backgrounds in horizontal distortion, tracking tears, grain and color treatment. Supported Chromium captures the whole group into the shader; other browsers use an SVG approximation. The preview wraps the same Space, Halo, grid and label scene as the other effects; the installed source is only the reusable wrapper.',
		controls: [
			'strength — overall treatment; zero bypasses the filter and tracking overlays',
			'horizontalDistortion / glitch — broad horizontal displacement and fine tape jitter',
			'line / period — tracking band strength and speed',
			'timeOffsetInSeconds — effect phase, independent of child media timing',
		],
		limitation:
			'The faithful shader path uses experimental HTML-in-canvas: Chrome 149+ with chrome://flags/#canvas-draw-element for browser preview, and Remotion 4.0.523+ with ANGLE or Swangle for rendering. Unsupported browsers receive an SVG approximation. Filters children only, never sibling layers or portals; HTML-in-canvas wrappers cannot be nested. Clips to its bounds, and large groups cost more rendering time.',
	},
	fractals: {
		title: 'Fractals',
		renderer: 'WebGL2',
		tagline: 'Pulsating layers of luminous fractal patterns.',
		description:
			'A colorful procedural background with repeating shapes and audio-reactive pulses.',
		controls: [
			'baseColor / mixColor — palette',
			'pulsating / zoom / pattern — fractal structure',
			'responsive / inputGainDb — audio response; responsive defaults to zero',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds. Fractal layers are capped at 64 for extreme audio gain.',
	},
	hyperloop: {
		title: 'Hyperloop',
		renderer: 'WebGL2',
		tagline: 'Race through a twisting tunnel of light.',
		description:
			'A swirling noise tunnel with adjustable depth, rotation and bass-reactive highlights.',
		controls: [
			'baseColor — tunnel tint',
			'volume / depth / pattern — tunnel structure',
			'speed / rotationSpeed — motion; changes alter phase rather than accumulating speed',
			'responsive / inputGainDb — audio response',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds. Volume changes the tunnel, not playback loudness.',
	},
	downfall: {
		title: 'Downfall',
		renderer: 'WebGL2',
		tagline: 'Dive through an intricate metallic labyrinth.',
		description:
			'A raymarched lattice with reflective surfaces, a looping camera path and audio-reactive lighting.',
		controls: [
			'startColor / endColor — surface palette',
			'textureSrc / textureScale / textureRotation — optional image surface; empty uses a procedural pattern',
			'variant / bloating / intensity — lattice shape',
			'bpm — camera tempo; changes alter phase',
			'inputGainDb / timeOffsetInSeconds — audio gain and animation phase',
		],
		limitation:
			'Requires WebGL2. Raymarching and textured reflections are GPU-intensive. Image URLs need CORS access. Opaque within its bounds.',
	},
	rail: {
		title: 'Rail',
		renderer: 'WebGL2',
		tagline: 'Ride through a colorful fractal landscape.',
		description:
			'A cartoon-shaded journey with dark outlines, rolling geometry and an audio-reactive sun.',
		controls: [
			'startColor / endColor — theme and sky',
			'tintColor / tint — recolor the whole frame in one hue; tint 0 keeps the original colors',
			'sunPosition / sunSize / intensity — sun placement and audio response',
			'volume / sides / waves / stroke — landscape shape and outlines',
			'textureSrc / textureScale / textureSize / textureRounded — optional flying image',
			'inputGainDb / timeOffsetInSeconds — audio gain and animation phase',
		],
		limitation:
			'Requires WebGL2. Raymarching can be GPU-intensive. Image URLs need CORS access. Opaque within its bounds.',
	},
	rain: {
		title: 'Rain',
		renderer: 'WebGL2',
		tagline: 'Raindrops on glass with bass-driven lightning.',
		description:
			'Animated droplets distort and blur a background image while thunderstorm flashes follow your audio.',
		controls: [
			'textureSrc / textureScale — background image and scale',
			'tintColor / tint — recolor the whole frame in one hue; tint 0 keeps the original colors',
			'distancing / blur — droplet scale and coverage; blur 0.8 animates coverage',
			'intensity / inputGainDb — lightning response and visual gain',
			'timeOffsetInSeconds — animation phase, independent of audio trim',
		],
		limitation:
			'Requires WebGL2 and a CORS-accessible background image. Opaque within its bounds. High audio gain can produce bright flashes.',
	},
	space: {
		title: 'Space',
		renderer: 'WebGL2',
		tagline: 'Drift through an audio-reactive star field.',
		description:
			'A full-frame fractal cosmos with glowing clouds and stars. Customize its color, density and drift speed, or layer a visualizer on top.',
		controls: [
			'baseColor — star field tint',
			'tintColor / tint — recolor the whole frame in one hue; tint 0 keeps the original colors',
			'zoom / stellarDensity / pattern — fractal structure; stellar density uses whole iterations',
			'speed — animation speed; changing it changes phase rather than accumulating speed',
			'responsive / inputGainDb — audio response and visual gain, without changing playback volume',
			'timeOffsetInSeconds — animation phase, independent of audioOffsetInSeconds',
		],
		limitation:
			'Requires WebGL2. Higher stellar density costs more GPU time. Opaque inside its bounds, with the original fixed camera and spherical projection. Motion continues in silence; analysis runs at a fixed 60 Hz.',
	},
	synthwave: {
		title: 'Synthwave',
		renderer: 'WebGL2',
		tagline: 'Neon mountains, a mirrored grid and a cosmic skyline.',
		description:
			'A retro-futuristic procedural landscape that reacts to your music. Shape the mountains, customize the neon palette and set the animation tempo.',
		controls: [
			'startColor / endColor / sphereColor — landscape, outline and sphere colors',
			'hideSphere — hide the sphere inside the triangle, not the background',
			'mountainsPattern / mountainsHeight / mountainsSmoothness / mountainsDistance — terrain shape',
			'bpm — animation tempo; changing it changes phase rather than accumulating speed',
			'responsive / inputGainDb — audio response and visual gain, without changing playback volume',
			'timeOffsetInSeconds — animation phase, independent of audioOffsetInSeconds',
		],
		limitation:
			'Requires WebGL2. Procedural reflections can be GPU-intensive. Opaque inside its bounds, with the original fixed camera and spherical projection. Motion continues in silence; analysis runs at a fixed 60 Hz.',
	},
	mushrooms: {
		title: 'Mushrooms',
		renderer: 'WebGL2',
		tagline: 'A swirling kaleidoscope of luminous fractals.',
		description:
			'A psychedelic procedural background, adapted from banger.show’s Shrooms shader. Mix colors, reshape the fractals and tune their response to your music.',
		controls: [
			'baseColor / mixColor — fractal palette',
			'colorful / contrast / cubeScale — pattern, contrast and scale',
			'responsive — audio response; zero turns it off',
			'inputGainDb — visual audio gain, without changing playback volume',
			'timeOffsetInSeconds — animation phase, independent of audioOffsetInSeconds',
		],
		limitation:
			'Requires WebGL2. Fractal raymarching can be GPU-intensive. Opaque inside its bounds, with the original fixed camera and spherical projection. Motion continues in silence; analysis runs at a fixed 60 Hz.',
	},
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

	kaleidoscope: {
		title: 'Kaleidoscope',
		renderer: 'WebGL2',
		tagline: 'Fold luminous geometry into a constantly evolving mirrored pattern.',
		description:
			'A layered kaleidoscopic field with configurable symmetry and motion that punches in on the kick.',
		controls: [
			'startColor / randomColors — fixed theme or procedural colors',
			'scale / pattern / amount — mirrored structure and density',
			'disableMovement / still / speed — animation behavior',
			'responsive / inputGainDb — audio response and visual gain',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds. Dense patterns can shimmer at small output sizes.',
	},
	eye: {
		title: 'Eye',
		renderer: 'WebGL2',
		tagline: 'Travel through an endless field of surreal watching eyes.',
		description:
			'A procedural eye tunnel with alternate color treatments. Pupils widen and the tunnel brightens with the bass.',
		controls: [
			'startColor / endColor / colorful / dark — color treatment',
			'amount / smoothness / volume — eye field geometry',
			'speed / bpm — camera motion',
			'responsive / inputGainDb — audio response and visual gain',
		],
		limitation:
			'Requires WebGL2. Procedural distance fields are GPU-intensive. Opaque within its bounds.',
	},
	flowers: {
		title: 'Flowers',
		renderer: 'WebGL2',
		tagline: 'A rotating garden of geometric, audio-reactive blooms.',
		description:
			'Layered flower forms repeat across a hexagonal field with animated petals and glowing edges.',
		controls: [
			'strokeColor / backgroundColor — palette',
			'colorMode / color — rainbow petals, or one solid petal color',
			'scale / pattern / volume — flower shape and repetition',
			'rotationSpeed / flowersSpeed — field and petal motion',
			'responsive / inputGainDb — audio response and visual gain',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds. Fine outlines may alias when scaled down.',
	},
	moon: {
		title: 'Moon',
		renderer: 'WebGL2',
		tagline: 'An eclipsed moon wrapped in stars and a live spectrum.',
		description:
			'A procedural night sky with a moon, atmospheric glow and spectrum lines mapped around its surface.',
		controls: [
			'startColor / moonColor — sky and moon palette',
			'hideMoon / hideAudio — independently hide the moon or spectrum',
			'stars / pattern / speed / volume — sky density and motion',
			'responsive / inputGainDb — spectrum response and visual gain',
		],
		limitation:
			'Requires WebGL2. Opaque within its bounds. The spectrum uses a 308-bin audio texture updated per frame.',
	},
	city: {
		title: 'City',
		renderer: 'WebGL2',
		tagline: 'Glide past a neon skyline and an infinite glowing grid.',
		description:
			'A procedural cityscape with animated buildings, stars and a perspective ground plane. Windows light up with the music.',
		controls: [
			'startColor / endColor — buildings and sky glow',
			'lightsColor / groundColor / shineColor — windows and grid palette',
			'textureSrc — optional noise image for the window pattern',
			'stars / speed / responsive / inputGainDb — density, motion and audio response',
		],
		limitation:
			'Requires WebGL2. External texture URLs need CORS access; an internal deterministic noise texture is used when empty. Opaque within its bounds.',
	},
	basic: {
		title: 'Basic',
		renderer: 'WebGL2',
		tagline: 'A restrained audio-reactive gradient sky with optional stars.',
		description:
			'A lightweight procedural background where the intensify color glows from the center with the bass. Add a flickering star field if you like.',
		controls: [
			'backgroundColor / intensifyColor / starsColor — palette',
			'enableStars / stars / pattern — star field and flicker',
			'starsAudioReactivity / responsive / inputGainDb — audio response',
			'speed / timeOffsetInSeconds — star-field movement and phase',
		],
		limitation: 'Requires WebGL2. Opaque within its bounds. Stars are disabled by default.',
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
			'A scrolling signed min/max envelope that preserves transients. Choose a solid color or frequency colors: bass is red, mids green and treble blue.',
		controls: [
			'colorMode / color — frequency RGB or solid fill',
			'intensity — visual amplitude',
			'windowInSeconds — visible audio window',
			'resolution — 1× to 16× envelope detail, independent of the time window',
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
			'colorMode / startColor / middleColor / endColor — two- or three-color gradient, or rainbow',
			'gradientAngle / segmentGap — gradient direction and segmented-bar spacing',
			'rainbowSpeed / saturation / brightness — rainbow treatment',
		],
		limitation:
			'Requires WebGL2 and graphics acceleration. No SVG fallback. Real-frequency log mapping spans 20 Hz–22 kHz; frequencies above the audio Nyquist limit stay silent.',
	},
	oscilloscope: {
		title: 'Oscilloscope',
		renderer: 'SVG',
		tagline: 'The audio signal, drawn in real time.',
		description:
			'A thin line traces the audio waveform with pitch-stable triggering, automatic single-cycle detection or free-running display. Resolution and visible duration are independent.',
		controls: [
			'lineColor / lineWidth — trace styling',
			'amplitude — trace height',
			'displayMode — pitch, single-cycle or free',
			'timeSpanMs — 5–200 ms visible duration; single-cycle mode detects the period instead',
			'sampleCount — 256–4096 trace points, independent of duration',
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
			'count / barWidth — radial bars and dots use mirrored, real-frequency bands',
			'lineWidth / showLines — glow-ring width and horizontal rays',
			'lineThickness / dotSize — waveform-ring thickness and dotted-ring size',
			'colorMode / startColor / middleColor / endColor — two- or three-color gradient, or rainbow',
			'rainbowSpeed / saturation / brightness — rainbow treatment',
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
	credit: credits[entry.slug],
}));
