import React, {forwardRef, useCallback, useImperativeHandle, useRef} from 'react';
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

function FisheyeContent(props: ResolvedFisheyeProps) {
	if (bounded(props.strength, 0, 2, 0.5) === 0) return <>{props.children}</>;
	if (!HtmlInCanvas.isSupported())
		throw new Error('Fisheye requires HTML-in-canvas support in this browser or renderer.');
	return <FisheyeCanvas {...props} />;
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
