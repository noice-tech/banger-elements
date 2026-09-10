import React, {forwardRef, useCallback, useId, useImperativeHandle, useMemo, useRef} from 'react';
import {
	HtmlInCanvas,
	Interactive,
	Sequence,
	type HtmlInCanvasOnInit,
	type HtmlInCanvasOnPaint,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type InteractivitySchema,
	type SequenceControls,
} from 'remotion';

type FisheyeOptions = {
	readonly children?: React.ReactNode;
	readonly width?: number;
	readonly height?: number;
	readonly strength?: number;
	readonly perspectiveFactor?: number;
};
type FisheyeProps = InteractiveBaseProps & InteractiveTransformProps & FisheyeOptions;
type ResolvedFisheyeProps = Required<Omit<FisheyeOptions, 'children'>> & {
	readonly children?: React.ReactNode;
};

const fisheyeSchema = {
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
		default: 0.5,
		min: 0,
		max: 2,
		step: 0.01,
		description: 'Barrel distortion strength; zero bypasses the effect',
		hiddenFromList: false,
	},
	perspectiveFactor: {
		type: 'number',
		default: 0.25,
		min: 0,
		max: 1,
		step: 0.01,
		description: 'Perspective compensation',
		hiddenFromList: false,
	},
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
uniform float strength;
uniform float perspectiveFactor;
in vec2 vUv;
out vec4 outputColor;

vec2 distortUv(vec2 uv) {
  vec2 centered = uv - 0.5;
  float r = length(centered);
  float r2 = r * r;
  float distortion = 1.0 + strength * r2;
  vec2 distorted = centered * distortion;
  float perspective = 1.0 + strength * perspectiveFactor;
  distorted /= perspective;
  return distorted + 0.5;
}

void main() {
  vec4 sourceColor = texture(inputTexture, vUv);
  vec4 distortedColor = texture(inputTexture, distortUv(vUv));
  outputColor = vec4(distortedColor.rgb, sourceColor.a);
}`;

type FisheyeWebGlState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly vao: WebGLVertexArrayObject;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly uniforms: Record<string, WebGLUniformLocation | null>;
};

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('Fisheye could not create a shader.');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`Fisheye shader compilation failed: ${message}`);
	}
	return shader;
}

function createFisheyeWebGl(canvas: OffscreenCanvas): FisheyeWebGlState {
	const gl = canvas.getContext('webgl2', {premultipliedAlpha: true});
	if (!gl) throw new Error('Fisheye requires WebGL2.');
	const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
	const program = gl.createProgram();
	if (!program) throw new Error('Fisheye could not create a WebGL program.');
	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);
	gl.deleteShader(vertex);
	gl.deleteShader(fragment);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Fisheye shader linking failed: ${message}`);
	}
	const vao = gl.createVertexArray();
	const buffer = gl.createBuffer();
	const texture = gl.createTexture();
	if (!vao || !buffer || !texture) throw new Error('Fisheye could not allocate WebGL resources.');
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
	const names = ['inputTexture', 'strength', 'perspectiveFactor'];
	return {
		gl,
		program,
		vao,
		buffer,
		texture,
		uniforms: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])),
	};
}

function cleanupFisheyeWebGl({gl, program, vao, buffer, texture}: FisheyeWebGlState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteVertexArray(vao);
	gl.deleteProgram(program);
}

function drawFisheyeWebGl(
	state: FisheyeWebGlState,
	elementImage: ElementImage,
	props: Omit<ResolvedFisheyeProps, 'children'>,
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
	gl.uniform1f(uniforms.strength, bounded(props.strength, 0, 2, 0.5));
	gl.uniform1f(uniforms.perspectiveFactor, bounded(props.perspectiveFactor, 0, 1, 0.25));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	if (gl.getError() !== gl.NO_ERROR) throw new Error('Fisheye failed to draw its WebGL frame.');
}

function FisheyeCanvas(props: ResolvedFisheyeProps) {
	const state = useRef<FisheyeWebGlState | null>(null);
	const onInit = useCallback<HtmlInCanvasOnInit>(({canvas}) => {
		state.current = createFisheyeWebGl(canvas);
		return () => {
			if (state.current) cleanupFisheyeWebGl(state.current);
			state.current = null;
		};
	}, []);
	const onPaint = useCallback<HtmlInCanvasOnPaint>(
		({elementImage, pixelDensity}) => {
			if (!state.current) throw new Error('Fisheye WebGL was not initialized.');
			drawFisheyeWebGl(state.current, elementImage, props, pixelDensity);
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

function setUint32(bytes: Uint8Array, offset: number, value: number) {
	bytes[offset] = value & 255;
	bytes[offset + 1] = (value >>> 8) & 255;
	bytes[offset + 2] = (value >>> 16) & 255;
	bytes[offset + 3] = (value >>> 24) & 255;
}

function bytesToBase64(bytes: Uint8Array) {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let result = '';
	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index] ?? 0;
		const second = bytes[index + 1] ?? 0;
		const third = bytes[index + 2] ?? 0;
		const value = (first << 16) | (second << 8) | third;
		result += alphabet[(value >>> 18) & 63];
		result += alphabet[(value >>> 12) & 63];
		result += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : '=';
		result += index + 2 < bytes.length ? alphabet[value & 63] : '=';
	}
	return result;
}

function fisheyeDisplacementMap(
	strength: number,
	perspectiveFactor: number,
	width: number,
	height: number,
) {
	const resolution = 96;
	const headerSize = 54;
	const bytes = new Uint8Array(headerSize + resolution * resolution * 4);
	bytes[0] = 0x42;
	bytes[1] = 0x4d;
	setUint32(bytes, 2, bytes.length);
	setUint32(bytes, 10, headerSize);
	setUint32(bytes, 14, 40);
	setUint32(bytes, 18, resolution);
	setUint32(bytes, 22, -resolution);
	bytes[26] = 1;
	bytes[28] = 32;
	setUint32(bytes, 34, resolution * resolution * 4);
	const amount = bounded(strength, 0, 2, 0.5);
	const perspective = bounded(perspectiveFactor, 0, 1, 0.25);
	let maximumDisplacement = 0;
	for (let y = 0; y <= resolution; y++) {
		for (let x = 0; x <= resolution; x++) {
			const centeredX = x / resolution - 0.5;
			const centeredY = y / resolution - 0.5;
			const radiusSquared = centeredX * centeredX + centeredY * centeredY;
			const factor = (1 + amount * radiusSquared) / (1 + amount * perspective);
			maximumDisplacement = Math.max(
				maximumDisplacement,
				Math.abs(centeredX * (factor - 1) * width),
				Math.abs(centeredY * (factor - 1) * height),
			);
		}
	}
	const scale = Math.max(1, maximumDisplacement * 2);
	for (let y = 0; y < resolution; y++) {
		for (let x = 0; x < resolution; x++) {
			const u = (x + 0.5) / resolution;
			const v = (y + 0.5) / resolution;
			const centeredX = u - 0.5;
			const centeredY = v - 0.5;
			const radiusSquared = centeredX * centeredX + centeredY * centeredY;
			const factor = (1 + amount * radiusSquared) / (1 + amount * perspective);
			const red = Math.round(
				bounded(0.5 + (centeredX * (factor - 1) * width) / scale, 0, 1, 0.5) * 255,
			);
			const green = Math.round(
				bounded(0.5 + (centeredY * (factor - 1) * height) / scale, 0, 1, 0.5) * 255,
			);
			const offset = headerSize + (y * resolution + x) * 4;
			bytes[offset] = 128;
			bytes[offset + 1] = green;
			bytes[offset + 2] = red;
			bytes[offset + 3] = 255;
		}
	}
	return {uri: `data:image/bmp;base64,${bytesToBase64(bytes)}`, scale};
}

function FisheyeSvgFallback(props: ResolvedFisheyeProps) {
	const filterId = `fisheye-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
	const strength = bounded(props.strength, 0, 2, 0.5);
	const perspectiveFactor = bounded(props.perspectiveFactor, 0, 1, 0.25);
	const map = useMemo(
		() => fisheyeDisplacementMap(strength, perspectiveFactor, props.width, props.height),
		[strength, perspectiveFactor, props.width, props.height],
	);
	return (
		<>
			<svg width={0} height={0} aria-hidden style={{position: 'absolute', pointerEvents: 'none'}}>
				<defs>
					<filter
						id={filterId}
						x={0}
						y={0}
						width={props.width}
						height={props.height}
						filterUnits="userSpaceOnUse"
						primitiveUnits="userSpaceOnUse"
						colorInterpolationFilters="sRGB"
					>
						<feImage
							href={map.uri}
							x={0}
							y={0}
							width={props.width}
							height={props.height}
							preserveAspectRatio="none"
							result="displacement"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="displacement"
							scale={map.scale}
							xChannelSelector="R"
							yChannelSelector="G"
							result="distorted"
						/>
						<feComposite in="distorted" in2="SourceGraphic" operator="over" />
					</filter>
				</defs>
			</svg>
			<div style={{position: 'absolute', inset: 0, filter: `url(#${filterId})`}}>
				{props.children}
			</div>
		</>
	);
}

function FisheyeContent(props: ResolvedFisheyeProps) {
	if (bounded(props.strength, 0, 2, 0.5) === 0) return <>{props.children}</>;
	return HtmlInCanvas.isSupported() ? (
		<FisheyeCanvas {...props} />
	) : (
		<FisheyeSvgFallback {...props} />
	);
}

const FisheyeInner = forwardRef<
	HTMLDivElement,
	FisheyeProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			children,
			width = fisheyeSchema.width.default,
			height = fisheyeSchema.height.default,
			strength = fisheyeSchema.strength.default,
			perspectiveFactor = fisheyeSchema.perspectiveFactor.default,
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
				name={name ?? 'Fisheye'}
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
					<FisheyeContent
						width={drawingWidth}
						height={drawingHeight}
						strength={strength}
						perspectiveFactor={perspectiveFactor}
					>
						{children}
					</FisheyeContent>
				</div>
			</Sequence>
		);
	},
);

export const Fisheye = Interactive.withSchema({
	Component: FisheyeInner,
	componentName: '<Fisheye>',
	componentIdentity: null,
	schema: fisheyeSchema,
	supportsEffects: false,
}) as React.FC<FisheyeProps>;
