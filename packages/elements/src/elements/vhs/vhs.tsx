import React, {forwardRef, useCallback, useId, useImperativeHandle, useRef} from 'react';
import {
	HtmlInCanvas,
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	type HtmlInCanvasOnInit,
	type HtmlInCanvasOnPaint,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type InteractivitySchema,
	type SequenceControls,
} from 'remotion';

// Faithful wrapper adaptation of banger.show's current layered VHS shader.
// HtmlInCanvas supplies the composited child pixels; an SVG approximation is
// retained for browsers where Chrome's experimental capture API is unavailable.
type VhsOptions = {
	readonly children?: React.ReactNode;
	readonly width?: number;
	readonly height?: number;
	readonly strength?: number;
	readonly horizontalDistortion?: number;
	readonly glitch?: number;
	readonly line?: number;
	readonly period?: number;
	readonly timeOffsetInSeconds?: number;
};
type VhsProps = InteractiveBaseProps & InteractiveTransformProps & VhsOptions;
type ResolvedVhsProps = Required<Omit<VhsOptions, 'children'>> & {
	readonly children?: React.ReactNode;
};

const vhsSchema = {
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
	strength: {
		type: 'number',
		default: 1,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Effect strength; zero bypasses all treatment',
		hiddenFromList: false,
	},
	horizontalDistortion: {
		type: 'number',
		default: 0.02,
		min: 0.005,
		max: 0.07,
		step: 0.001,
		description: 'Horizontal distortion',
		hiddenFromList: false,
	},
	glitch: {
		type: 'number',
		default: 0.07,
		min: 0.01,
		max: 0.07,
		step: 0.01,
		description: 'Fine tape jitter',
		hiddenFromList: false,
	},
	line: {
		type: 'number',
		default: 0.28,
		min: 0.01,
		max: 1,
		step: 0.01,
		description: 'Tracking band strength',
		hiddenFromList: false,
	},
	period: {
		type: 'number',
		default: 1.2,
		min: 0.01,
		max: 2,
		step: 0.01,
		description: 'Tracking band speed; changes animation phase',
		hiddenFromList: false,
	},
	timeOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: -86400,
		max: 86400,
		step: 0.01,
		description: 'Effect phase, independent of child media trim',
		hiddenFromList: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function vhsTiming(time: number, period: number) {
	const tick = Math.floor(time * 60 + 1e-7);
	return {
		grainSeed: ((tick % 65521) + 65521) % 65521,
		warpSeed: ((Math.floor(time * 10 + 1e-7) % 65521) + 65521) % 65521,
		tracking: (((time * period * 0.25) % 1) + 1) % 1,
	};
}

const vertexShader = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// The only addition is strength, used for an exact bypass.
const fragmentShader = `#version 300 es
precision highp float;
uniform sampler2D inputTexture;
uniform float globalTime;
uniform float horizontalDistortion;
uniform float glitch;
uniform float line;
uniform float period;
uniform float strength;
in vec2 vUv;
out vec4 outputColor;

float hash(vec2 value) {
  return fract(sin(dot(value, vec2(89.44, 19.36))) * 22189.22);
}
float iHash(vec2 value, vec2 resolution) {
  vec2 scaledValue = value * resolution;
  float h00 = hash(floor(scaledValue + vec2(0.0, 0.0)) / resolution);
  float h10 = hash(floor(scaledValue + vec2(1.0, 0.0)) / resolution);
  float h01 = hash(floor(scaledValue + vec2(0.0, 1.0)) / resolution);
  float h11 = hash(floor(scaledValue + vec2(1.0, 1.0)) / resolution);
  vec2 interpolation = smoothstep(vec2(0.0), vec2(1.0), mod(scaledValue, 1.0));
  return mix(mix(h00, h10, interpolation.x), mix(h01, h11, interpolation.x), interpolation.y);
}
float noise(vec2 value) {
  float sum = 0.0;
  for (int index = 1; index < 8; index++) {
    float powValue = pow(2.0, float(index));
    sum += iHash(value + vec2(index), vec2(2.0 * powValue)) / powValue;
  }
  return sum;
}
float random(vec2 uv, float time) {
  return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + time);
}
vec2 getVhsUv(vec2 uv) {
  vec2 uvn = uv;
  float cachedNoise = noise(vec2(uvn.y * 100.0, globalTime * 10.0));
  uvn.x += (noise(vec2(uvn.y, globalTime)) - 0.5) * horizontalDistortion;
  uvn.x += (cachedNoise - 0.5) * glitch;
  float tcPhase = clamp(
    (sin(uvn.y * 8.0 - globalTime * 3.141592653589793 * period) - (1.0 - line)) * noise(vec2(globalTime)),
    0.0,
    0.01
  ) * 10.0;
  float tcNoise = max(cachedNoise - 0.5, 0.0);
  uvn.x -= tcNoise * tcPhase;
  float snPhase = smoothstep(0.03, 0.0, uvn.y);
  uvn.y += snPhase * 0.3;
  uvn.x += snPhase * ((noise(vec2(uv.y * 100.0, globalTime * 10.0)) - 0.5) * 0.2);
  return uvn;
}
void main() {
  vec2 uvn = getVhsUv(vUv);
  vec4 sourceColor = texture(inputTexture, vUv);
  vec4 distortedColor = texture(inputTexture, uvn);
  vec3 color = distortedColor.rgb;
  float cachedNoise = noise(vec2(uvn.y * 100.0, globalTime * 10.0));
  float tcPhase = clamp(
    (sin(uvn.y * 8.0 - globalTime * 3.141592653589793 * period) - (1.0 - line)) * noise(vec2(globalTime)),
    0.0,
    0.01
  ) * 10.0;
  float snPhase = smoothstep(0.03, 0.0, uvn.y);
  if (0.5 < abs(uvn.x - 0.5)) color = vec3(0.1);
  color *= 1.0 - tcPhase;
  color = mix(color, color.yzx, snPhase);
  for (float x = -4.0; x < 2.5; x += 1.0) color += distortedColor.rgb * 0.1;
  color *= 0.6;
  color *= 1.0 + clamp(noise(vec2(0.0, vUv.y + globalTime * 0.2)) * 0.6 - 0.25, 0.0, 0.1);
  float noising = 0.05 * (2.0 * random(uvn, globalTime) - 1.0);
  vec3 treated = color + noising + vec3(0.05);
  outputColor = vec4(mix(sourceColor.rgb, treated, strength), sourceColor.a);
}`;

type VhsWebGlState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly vao: WebGLVertexArrayObject;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('VHS could not create a shader.');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`VHS shader compilation failed: ${message}`);
	}
	return shader;
}

function createVhsWebGl(canvas: OffscreenCanvas): VhsWebGlState {
	const gl = canvas.getContext('webgl2', {premultipliedAlpha: true});
	if (!gl) throw new Error('VHS requires WebGL2.');
	const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
	const program = gl.createProgram();
	if (!program) throw new Error('VHS could not create a WebGL program.');
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`VHS shader linking failed: ${message}`);
	}
	const vao = gl.createVertexArray();
	const buffer = gl.createBuffer();
	const texture = gl.createTexture();
	if (!vao || !buffer || !texture) throw new Error('VHS could not allocate WebGL resources.');
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
		'globalTime',
		'horizontalDistortion',
		'glitch',
		'line',
		'period',
		'strength',
	];
	return {
		gl,
		program,
		vao,
		buffer,
		texture,
		uniforms: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])),
	};
}

function cleanupVhsWebGl({gl, program, vao, buffer, texture}: VhsWebGlState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteVertexArray(vao);
	gl.deleteProgram(program);
}

function drawVhsWebGl(
	state: VhsWebGlState,
	elementImage: ElementImage,
	props: Omit<ResolvedVhsProps, 'children'>,
	time: number,
	pixelDensity: number,
) {
	const {gl, uniforms} = state;
	gl.viewport(0, 0, Math.ceil(props.width * pixelDensity), Math.ceil(props.height * pixelDensity));
	gl.useProgram(state.program);
	gl.bindVertexArray(state.vao);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.texture);
	gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, elementImage);
	gl.uniform1i(uniforms.inputTexture, 0);
	gl.uniform1f(uniforms.globalTime, time);
	gl.uniform1f(
		uniforms.horizontalDistortion,
		bounded(props.horizontalDistortion, 0.005, 0.07, 0.02),
	);
	gl.uniform1f(uniforms.glitch, bounded(props.glitch, 0.01, 0.07, 0.07));
	gl.uniform1f(uniforms.line, bounded(props.line, 0.01, 1, 0.28));
	gl.uniform1f(uniforms.period, bounded(props.period, 0.01, 2, 1.2));
	gl.uniform1f(uniforms.strength, bounded(props.strength, 0, 1, 1));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	if (gl.getError() !== gl.NO_ERROR) throw new Error('VHS failed to draw its WebGL frame.');
}

function VhsCanvas(props: ResolvedVhsProps) {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const state = useRef<VhsWebGlState | null>(null);
	const onInit = useCallback<HtmlInCanvasOnInit>(({canvas}) => {
		state.current = createVhsWebGl(canvas);
		return () => {
			if (state.current) cleanupVhsWebGl(state.current);
			state.current = null;
		};
	}, []);
	const onPaint = useCallback<HtmlInCanvasOnPaint>(
		({elementImage, pixelDensity}) => {
			if (!state.current) throw new Error('VHS WebGL was not initialized.');
			drawVhsWebGl(
				state.current,
				elementImage,
				props,
				frame / fps + bounded(props.timeOffsetInSeconds, -86400, 86400, 0),
				pixelDensity,
			);
		},
		[frame, fps, props],
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

function VhsFallback(props: ResolvedVhsProps) {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const filterId = `vhs-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const amount = bounded(props.strength, 0, 1, 1);
	const time = frame / fps + bounded(props.timeOffsetInSeconds, -86400, 86400, 0);
	const timing = vhsTiming(time, bounded(props.period, 0.01, 2, 1.2));
	return (
		<>
			<svg width={0} height={0} aria-hidden style={{position: 'absolute', pointerEvents: 'none'}}>
				<defs>
					<filter
						id={filterId}
						x="-20%"
						y="-20%"
						width="140%"
						height="140%"
						colorInterpolationFilters="sRGB"
					>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={`0 ${5 / props.height}`}
							numOctaves={2}
							seed={timing.warpSeed}
							result="broadNoise"
						/>
						<feColorMatrix
							in="broadNoise"
							type="matrix"
							values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"
							result="broadMap"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="broadMap"
							scale={props.width * bounded(props.horizontalDistortion, 0.005, 0.07, 0.02) * amount}
							xChannelSelector="R"
							yChannelSelector="G"
							result="warped"
						/>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={`0 ${150 / props.height}`}
							numOctaves={1}
							seed={timing.grainSeed}
							result="fineNoise"
						/>
						<feColorMatrix
							in="fineNoise"
							type="matrix"
							values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"
							result="fineMap"
						/>
						<feDisplacementMap
							in="warped"
							in2="fineMap"
							scale={props.width * bounded(props.glitch, 0.01, 0.07, 0.07) * amount * 0.3}
							xChannelSelector="R"
							yChannelSelector="G"
							result="distorted"
						/>
						<feTurbulence
							type="fractalNoise"
							baseFrequency={0.7}
							numOctaves={1}
							seed={timing.grainSeed}
							result="grain"
						/>
						<feColorMatrix in="grain" type="saturate" values="0" result="grayGrain" />
						<feComponentTransfer in="grayGrain" result="faintGrain">
							<feFuncA type="linear" slope={0.15 * amount} />
						</feComponentTransfer>
						<feComposite in="faintGrain" in2="distorted" operator="in" result="maskedGrain" />
						<feBlend in="distorted" in2="maskedGrain" mode="soft-light" />
					</filter>
				</defs>
			</svg>
			<div
				style={{
					position: 'absolute',
					inset: 0,
					filter: amount === 0 ? undefined : `url(#${filterId})`,
				}}
			>
				{props.children}
			</div>
			{amount > 0 ? (
				<div
					aria-hidden
					style={{
						position: 'absolute',
						inset: 0,
						pointerEvents: 'none',
						opacity: amount,
					}}
				>
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							top: `${timing.tracking * 100}%`,
							height: Math.max(2, props.height * 0.018),
							background: '#000',
							opacity: bounded(props.line, 0.01, 1, 0.28) * 0.35,
						}}
					/>
					<div
						style={{
							position: 'absolute',
							left: 0,
							right: 0,
							bottom: 0,
							height: props.height * 0.025,
							background:
								'repeating-linear-gradient(0deg, #ffffff18 0px, #ffffff18 1px, transparent 1px, transparent 3px)',
						}}
					/>
				</div>
			) : null}
		</>
	);
}

function VhsContent(props: ResolvedVhsProps) {
	if (bounded(props.strength, 0, 1, 1) === 0) return <>{props.children}</>;
	return HtmlInCanvas.isSupported() ? <VhsCanvas {...props} /> : <VhsFallback {...props} />;
}

const VhsInner = forwardRef<
	HTMLDivElement,
	VhsProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			children,
			width = vhsSchema.width.default,
			height = vhsSchema.height.default,
			strength = vhsSchema.strength.default,
			horizontalDistortion = vhsSchema.horizontalDistortion.default,
			glitch = vhsSchema.glitch.default,
			line = vhsSchema.line.default,
			period = vhsSchema.period.default,
			timeOffsetInSeconds = vhsSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'VHS'}
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
					<VhsContent
						width={drawingWidth}
						height={drawingHeight}
						strength={strength}
						horizontalDistortion={horizontalDistortion}
						glitch={glitch}
						line={line}
						period={period}
						timeOffsetInSeconds={timeOffsetInSeconds}
					>
						{children}
					</VhsContent>
				</div>
			</Sequence>
		);
	},
);

export const Vhs = Interactive.withSchema({
	Component: VhsInner,
	componentName: '<Vhs>',
	componentIdentity: null,
	schema: vhsSchema,
	supportsEffects: false,
}) as React.FC<VhsProps>;
