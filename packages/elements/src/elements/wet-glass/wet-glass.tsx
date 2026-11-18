import React, {forwardRef, useCallback, useId, useImperativeHandle, useRef} from 'react';
import {
	HtmlInCanvas,
	useCurrentFrame,
	useVideoConfig,
	Interactive,
	Sequence,
	type HtmlInCanvasOnInit,
	type HtmlInCanvasOnPaint,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type InteractivitySchema,
	type SequenceControls,
} from 'remotion';

type WetGlassOptions = {
	readonly children?: React.ReactNode;
	readonly width?: number;
	readonly height?: number;
	readonly amount?: number;
	readonly speed?: number;
	readonly dropSize?: number;
	readonly refraction?: number;
	readonly blur?: number;
	readonly effectOpacity?: number;
	readonly seed?: number;
	readonly timeOffsetInSeconds?: number;
	readonly color?: string;
};
type WetGlassProps = InteractiveBaseProps & InteractiveTransformProps & WetGlassOptions;
type ResolvedWetGlassProps = Required<Omit<WetGlassOptions, 'children'>> & {
	readonly children?: React.ReactNode;
};

const wetGlassSchema = {
	...Interactive.baseSchema,
	width: {
		type: 'number',
		default: 1280,
		min: 16,
		max: 3840,
		step: 1,
		keyframable: false,
		hiddenFromList: false,
	},
	height: {
		type: 'number',
		default: 720,
		min: 16,
		max: 3840,
		step: 1,
		keyframable: false,
		hiddenFromList: false,
	},
	amount: {
		type: 'number',
		default: 0.65,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Rain amount; zero bypasses',
		hiddenFromList: false,
	},
	speed: {
		type: 'number',
		default: 1,
		min: 0,
		max: 4,
		step: 0.01,
		description: 'Rain speed',
		hiddenFromList: false,
	},
	dropSize: {
		type: 'number',
		default: 1,
		min: 0.25,
		max: 2,
		step: 0.01,
		description: 'Droplet size',
		hiddenFromList: false,
	},
	refraction: {
		type: 'number',
		default: 1,
		min: 0,
		max: 2,
		step: 0.01,
		description: 'Refraction',
		hiddenFromList: false,
	},
	blur: {
		type: 'number',
		default: 0.35,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Wet-glass defocus',
		hiddenFromList: false,
	},
	effectOpacity: {
		type: 'number',
		default: 1,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Effect mix; zero bypasses',
		hiddenFromList: false,
	},
	seed: {
		type: 'number',
		default: 0,
		min: 0,
		max: 32,
		step: 0.01,
		description: 'Deterministic droplet seed',
		hiddenFromList: false,
		keyframable: false,
	},
	timeOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: -86400,
		max: 86400,
		step: 0.01,
		description: 'Effect phase (independent of child timing)',
		hiddenFromList: false,
		keyframable: false,
	},
	color: {type: 'color', default: '#ffffff', description: 'Water tint (white is neutral)'},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

const vertexShader = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;

uniform sampler2D inputTexture;
uniform vec2 resolution;
uniform float time;
uniform float seed;
uniform float amount;
uniform float speed;
uniform float dropSize;
uniform float refraction;
uniform float blur;
uniform float opacity;
uniform vec3 color;
in vec2 vUv;
out vec4 outputColor;

// The original droplet field uses both ascending and descending smoothsteps.
// Define descending edges explicitly instead of relying on undefined GLSL behavior.
float S(float a, float b, float t) {
  if (abs(a - b) < 0.00001) return step(a, t);
  return a < b ? smoothstep(a, b, t) : 1.0 - smoothstep(b, a, t);
}


vec3 N13(float p) {
  // Hash by Dave Hoskins.
  vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
  return S(0., b, t) * S(1., b, t);
}

vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * .75;
  vec2 a = vec2(6., 1.);
  vec2 grid = a * 2.;
  vec2 id = floor(uv * grid);
  uv.y += N(id.x);
  id = floor(uv * grid);

  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(.5, 0);
  float x = n.x - .5;
  float y = UV.y * 20.;
  float wiggle = sin(y + sin(y));
  x += wiggle * (.5 - abs(x)) * (n.z - .5);
  x *= .7;
  float ti = fract(t + n.z);
  y = (Saw(.85, ti) - .5) * .9 + .5;
  vec2 p = vec2(x, y);
  float d = length((st - p) * a.yx);
  float mainDrop = S(.4, .0, d);

  float r = sqrt(S(1., y, st.y));
  float cd = abs(st.x - x);
  float trail = S(.23 * r, .15 * r * r, cd);
  float trailFront = S(-.02, .02, st.y - y);
  trail *= trailFront * r * r;

  y = fract(UV.y * 10.) + (st.y - .5);
  float dd = length(st - vec2(x, y));
  float droplets = S(.3, 0., dd);
  float m = mainDrop + droplets * r * trailFront;
  return vec2(m, trail);
}

float StaticDrops(vec2 uv, float t) {
  uv *= 40.;
  vec2 id = floor(uv);
  uv = fract(uv) - .5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - .5) * .7;
  float d = length(uv - p);
  float fade = Saw(.025, fract(t + n.z));
  return S(.3, 0., d) * fract(n.z * 10.) * fade;
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer2(uv, t) * l1;
  vec2 m2 = DropLayer2(uv * 1.85, t) * l2;
  float c = S(.3, 1., s + m1.x + m2.x);
  return vec2(c, max(m1.y * l0, m2.y * l1));
}


vec4 sampleScene(vec2 uv) {
  vec2 inset = 0.5 / resolution;
  vec4 sampleColor = texture(inputTexture, clamp(uv, inset, 1.0 - inset));
  vec3 rgb = sampleColor.a > 0.00001 ? sampleColor.rgb / sampleColor.a : vec3(0.0);
  rgb = mix(rgb / 12.92, pow((rgb + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), rgb));
  return vec4(rgb * sampleColor.a, sampleColor.a);
}

vec4 blurredScene(vec2 uv, vec2 radius) {
  if (blur <= 0.0) return sampleScene(uv);

  // Scene render targets have no mip chain. A fixed disk kernel gives wet-glass
  // defocus without textureLod, temporal noise, or feedback from previous frames.
  vec4 result = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float index = float(i);
    float angle = index * 2.39996323;
    vec2 offset = vec2(cos(angle), sin(angle)) * sqrt((index + 0.5) / 16.0);
    result += sampleScene(uv + offset * radius);
  }
  return result / 16.0;
}

void main() {
  vec4 source = sampleScene(vUv);
  bool neutralGlass = refraction <= 0.0 && blur <= 0.0 && all(equal(color, vec3(1.0)));
  if (amount <= 0.0 || opacity <= 0.0 || neutralGlass) {
    outputColor = texture(inputTexture, vUv);
    return;
  }

  float shortEdge = min(resolution.x, resolution.y);
  vec2 aspect = resolution / shortEdge;
  vec2 uv = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * aspect * 1.6 / dropSize;
  uv += vec2(seed, seed * 0.37);
  float t = time * speed * 0.2 + seed;

  float staticDrops = S(0.0, 1.0, amount) * 2.0;
  float layer1 = S(0.25, 0.75, amount);
  float layer2 = S(0.0, 0.5, amount);
  vec2 c = Drops(uv, t, staticDrops, layer1, layer2);

  // Finite differences, as in the background shader: round droplets refract the
  // scene while the streams behind them clear a path through the fogged glass.
  vec2 e = vec2(0.001, 0.0);
  vec2 normal = vec2(
    Drops(uv + e, t, staticDrops, layer1, layer2).x - c.x,
    Drops(uv + e.yx, t, staticDrops, layer1, layer2).x - c.x
  );
  vec2 refractedUv = vUv + normal * refraction * dropSize / aspect;
  float clearGlass = clamp(max(c.x, c.y), 0.0, 1.0);
  vec2 radius = blur * amount * 0.05 * mix(1.0, 0.15, clearGlass) / aspect;
  vec4 wetScene = blurredScene(refractedUv, radius);
  // Colored water transmits light through droplets and cleared trails, not the
  // entire frame. White is neutral; multiplying RGB also preserves scene alpha.
  wetScene.rgb *= mix(vec3(1.0), color, clearGlass);

  // Sample and mix RGBA together: wet glass distorts existing scene coverage,
  // never paints an opaque rectangle or invents drops over an empty scene.
  vec4 result = mix(source, wetScene, opacity);
  vec3 rgb = result.a > 0.00001 ? max(vec3(0.0), result.rgb / result.a) : vec3(0.0);
  rgb = mix(rgb * 12.92, 1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), rgb));
  outputColor = vec4(rgb * result.a, result.a);
}
`;

type WetGlassWebGlState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly vao: WebGLVertexArrayObject;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	/** Size of the texture storage, for Chrome 158+'s copy-into-storage upload. */
	readonly textureSize: {width: number; height: number};
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('WetGlass could not create a shader.');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`WetGlass shader compilation failed: ${message}`);
	}
	return shader;
}

function createWetGlassWebGl(canvas: OffscreenCanvas): WetGlassWebGlState {
	const gl = canvas.getContext('webgl2', {premultipliedAlpha: true});
	if (!gl) throw new Error('WetGlass requires WebGL2.');
	const program = gl.createProgram();
	if (!program) throw new Error('WetGlass could not create a WebGL program.');
	const shaders: WebGLShader[] = [];
	let vao: WebGLVertexArrayObject | null = null;
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		shaders.push(compileShader(gl, gl.VERTEX_SHADER, vertexShader));
		shaders.push(compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader));
		for (const shader of shaders) gl.attachShader(program, shader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(`WetGlass shader linking failed: ${gl.getProgramInfoLog(program)}`);
		vao = gl.createVertexArray();
		buffer = gl.createBuffer();
		texture = gl.createTexture();
		if (!vao || !buffer || !texture)
			throw new Error('WetGlass could not allocate WebGL resources.');
		gl.bindVertexArray(vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
		const position = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		const names = [
			'inputTexture',
			'resolution',
			'time',
			'seed',
			'amount',
			'speed',
			'dropSize',
			'refraction',
			'blur',
			'opacity',
			'color',
		];
		return {
			gl,
			program,
			vao,
			buffer,
			texture,
			textureSize: {width: 0, height: 0},
			uniforms: Object.fromEntries(
				names.map((name) => [name, gl.getUniformLocation(program, name)]),
			),
		};
	} catch (error) {
		gl.deleteTexture(texture);
		gl.deleteBuffer(buffer);
		gl.deleteVertexArray(vao);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function cleanupWetGlassWebGl({gl, program, vao, buffer, texture}: WetGlassWebGlState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteVertexArray(vao);
	gl.deleteProgram(program);
}

/**
 * Upload the captured children into the bound texture at `width` x `height`
 * pixels. The HTML-in-canvas API is experimental and its WebGL entry point has
 * changed between Chrome releases: 158+ copies into storage you allocate (and
 * its ElementImage no longer reports a size), 156-157 take (target, format,
 * image), and 149 takes the full texImage2D-style overload.
 */
function uploadElementImage(
	gl: WebGL2RenderingContext,
	size: {width: number; height: number},
	elementImage: ElementImage,
	width: number,
	height: number,
) {
	if (typeof gl.texElementSubImage2D === 'function') {
		if (size.width !== width || size.height !== height) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			size.width = width;
			size.height = height;
		}
		gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, elementImage, {width, height});
	} else if (gl.texElementImage2D.length === 3) {
		(
			gl.texElementImage2D as unknown as (
				target: GLenum,
				internalformat: GLenum,
				image: ElementImage,
			) => void
		)(gl.TEXTURE_2D, gl.RGBA8, elementImage);
	} else {
		gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, elementImage);
	}
}

function drawWetGlassWebGl(
	state: WetGlassWebGlState,
	elementImage: ElementImage,
	props: Omit<ResolvedWetGlassProps, 'children'> & {time: number},
	pixelDensity: number,
) {
	const {gl, uniforms} = state;
	const width = Math.ceil(props.width * pixelDensity);
	const height = Math.ceil(props.height * pixelDensity);
	gl.viewport(0, 0, width, height);
	gl.useProgram(state.program);
	gl.bindVertexArray(state.vao);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.texture);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
	uploadElementImage(gl, state.textureSize, elementImage, width, height);
	gl.uniform1i(uniforms.inputTexture, 0);
	gl.uniform1f(uniforms.amount, bounded(props.amount, 0, 1, 0.65));
	gl.uniform1f(uniforms.speed, bounded(props.speed, 0, 4, 1));
	gl.uniform1f(uniforms.dropSize, bounded(props.dropSize, 0.25, 2, 1));
	gl.uniform1f(uniforms.refraction, bounded(props.refraction, 0, 2, 1));
	gl.uniform1f(uniforms.blur, bounded(props.blur, 0, 1, 0.35));
	gl.uniform1f(uniforms.opacity, bounded(props.effectOpacity, 0, 1, 1));
	gl.uniform1f(uniforms.seed, bounded(props.seed, 0, 32, 0));
	gl.uniform2f(uniforms.resolution, props.width, props.height);
	gl.uniform1f(uniforms.time, props.time);
	gl.uniform3fv(uniforms.color, linearColor(props.color));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	if (gl.getError() !== gl.NO_ERROR) throw new Error('WetGlass failed to draw its WebGL frame.');
}

function WetGlassCanvas(props: ResolvedWetGlassProps & {time: number}) {
	const state = useRef<WetGlassWebGlState | null>(null);
	const onInit = useCallback<HtmlInCanvasOnInit>(({canvas}) => {
		state.current = createWetGlassWebGl(canvas);
		return () => {
			if (state.current) cleanupWetGlassWebGl(state.current);
			state.current = null;
		};
	}, []);
	const onPaint = useCallback<HtmlInCanvasOnPaint>(
		({elementImage, pixelDensity}) => {
			if (!state.current) throw new Error('WetGlass WebGL was not initialized.');
			drawWetGlassWebGl(state.current, elementImage, props, pixelDensity);
		},
		[props],
	);
	return (
		<HtmlInCanvas
			width={props.width}
			height={props.height}
			showInTimeline={false}
			onInit={onInit}
			onPaint={onPaint}
		>
			{props.children}
		</HtmlInCanvas>
	);
}

const colorCache = new Map<string, number[]>();
let colorParser: CanvasRenderingContext2D | null = null;
function linearColor(color: string) {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded =
			hex.length === 3 ? [...hex].map((character) => character + character).join('') : hex;
		bytes = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
	} else {
		if (!CSS.supports('color', color)) throw new Error(`Invalid WetGlass color: ${color}`);
		if (!colorParser) {
			const canvas = document.createElement('canvas');
			canvas.width = 1;
			canvas.height = 1;
			colorParser = canvas.getContext('2d', {willReadFrequently: true})!;
		}
		colorParser.clearRect(0, 0, 1, 1);
		colorParser.fillStyle = color;
		colorParser.fillRect(0, 0, 1, 1);
		bytes = Array.from(colorParser.getImageData(0, 0, 1, 1).data).slice(0, 3);
	}
	const result = bytes.map((byte) => {
		const value = byte / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	if (colorCache.size >= 64) colorCache.clear();
	colorCache.set(color, result);
	return result;
}

function WetGlassFallback(props: ResolvedWetGlassProps & {time: number}) {
	const id = useId().replace(/:/g, '');
	const amount = bounded(props.amount, 0, 1, 0.65),
		opacity = bounded(props.effectOpacity, 0, 1, 1);
	const rgb = linearColor(props.color);
	const frequency = 0.02 / bounded(props.dropSize, 0.25, 2, 1);
	const phase = props.time * bounded(props.speed, 0, 4, 1) * 0.01;
	return (
		<>
			<svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
				<defs>
					<filter
						id={id}
						x="0%"
						y="0%"
						width="100%"
						height="100%"
						colorInterpolationFilters="linearRGB"
					>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={`${frequency} ${frequency * 2 + Math.sin(phase) * frequency * 0.3}`}
							numOctaves="2"
							result="drops"
							seed={Math.floor(bounded(props.seed, 0, 32, 0))}
						/>
						<feGaussianBlur
							in="SourceGraphic"
							stdDeviation={bounded(props.blur, 0, 1, 0.35) * amount * 8}
							result="fog"
						/>
						<feDisplacementMap
							in="fog"
							in2="drops"
							scale={
								amount *
								bounded(props.refraction, 0, 2, 1) *
								bounded(props.dropSize, 0.25, 2, 1) *
								18
							}
							xChannelSelector="R"
							yChannelSelector="G"
							result="wet"
						/>
						<feComponentTransfer in="wet">
							<feFuncR type="linear" slope={rgb[0]} />
							<feFuncG type="linear" slope={rgb[1]} />
							<feFuncB type="linear" slope={rgb[2]} />
						</feComponentTransfer>
						<feComposite in2="SourceGraphic" operator="arithmetic" k2={opacity} k3={1 - opacity} />
					</filter>
				</defs>
			</svg>
			<div style={{position: 'absolute', inset: 0, filter: `url(#${id})`}}>{props.children}</div>
		</>
	);
}
function WetGlassContent(props: ResolvedWetGlassProps) {
	const frame = useCurrentFrame(),
		{fps} = useVideoConfig();
	const time = frame / fps + bounded(props.timeOffsetInSeconds, -86400, 86400, 0);
	if (
		bounded(props.amount, 0, 1, 0.65) === 0 ||
		bounded(props.effectOpacity, 0, 1, 1) === 0 ||
		(bounded(props.refraction, 0, 2, 1) === 0 &&
			bounded(props.blur, 0, 1, 0.35) === 0 &&
			props.color === '#ffffff')
	)
		return <>{props.children}</>;
	return HtmlInCanvas.isSupported() ? (
		<WetGlassCanvas {...props} time={time} />
	) : (
		<WetGlassFallback {...props} time={time} />
	);
}

const WetGlassInner = forwardRef<
	HTMLDivElement,
	WetGlassProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			children,
			width = wetGlassSchema.width.default,
			height = wetGlassSchema.height.default,
			amount = wetGlassSchema.amount.default,
			speed = wetGlassSchema.speed.default,
			dropSize = wetGlassSchema.dropSize.default,
			refraction = wetGlassSchema.refraction.default,
			blur = wetGlassSchema.blur.default,
			effectOpacity = wetGlassSchema.effectOpacity.default,
			seed = wetGlassSchema.seed.default,
			timeOffsetInSeconds = wetGlassSchema.timeOffsetInSeconds.default,
			color = wetGlassSchema.color.default,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		const drawingWidth = Math.round(bounded(width, 16, 3840, 1280));
		const drawingHeight = Math.round(bounded(height, 16, 3840, 720));
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? 'WetGlass'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						position: 'relative',
						boxSizing: 'border-box',
						width: drawingWidth,
						height: drawingHeight,
						overflow: 'hidden',
						isolation: 'isolate',
						...style,
					}}
				>
					<WetGlassContent
						width={drawingWidth}
						height={drawingHeight}
						amount={amount}
						speed={speed}
						dropSize={dropSize}
						refraction={refraction}
						blur={blur}
						effectOpacity={effectOpacity}
						seed={seed}
						timeOffsetInSeconds={timeOffsetInSeconds}
						color={color}
					>
						{children}
					</WetGlassContent>
				</div>
			</Sequence>
		);
	},
);

export const WetGlass = Interactive.withSchema({
	Component: WetGlassInner,
	componentName: '<WetGlass>',
	componentIdentity: null,
	schema: wetGlassSchema,
	supportsEffects: false,
}) as React.FC<WetGlassProps>;
