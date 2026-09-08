import {Audio} from '@remotion/media';
import {
	useWindowedAudioData,
	visualizeAudio,
	type MediaUtilsAudioData,
} from '@remotion/media-utils';
import React, {
	forwardRef,
	useRef,
	useImperativeHandle,
	useId,
	useMemo,
	useLayoutEffect,
} from 'react';
import {
	Interactive,
	Sequence,
	useCurrentFrame,
	useVideoConfig,
	useDelayRender,
	cancelRender,
	type InteractiveBaseProps,
	type InteractiveTransformProps,
	type SequenceControls,
	type InteractivitySchema,
} from 'remotion';

type DownfallOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	readonly textureSrc?: string;
	readonly textureScale?: number;
	readonly textureRotation?: number;
	readonly variant?: number;
	readonly bloating?: number;
	readonly intensity?: number;
	readonly bpm?: number;
	readonly timeOffsetInSeconds?: number;
};

type DownfallProps = InteractiveBaseProps & InteractiveTransformProps & DownfallOptions;

const downfallSchema = {
	...Interactive.baseSchema,
	audioSrc: {
		type: 'asset',
		default: 'https://remotion.media/elements/remotion-made-this-picture-move.mp3',
		description: 'Audio source',
		keyframable: false,
	},
	audioOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		description: 'Audio source offset in seconds',
		hiddenFromList: false,
		keyframable: false,
	},
	playAudio: {
		type: 'boolean',
		default: true,
		description: 'Play audio (disable when stacking)',
		keyframable: false,
	},

	width: {
		type: 'number',
		default: 1280,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Width',
		hiddenFromList: false,
		keyframable: false,
	},
	height: {
		type: 'number',
		default: 720,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Height',
		hiddenFromList: false,
		keyframable: false,
	},
	inputGainDb: {
		type: 'number',
		default: 0,
		min: -30,
		max: 30,
		step: 1,
		description: 'Visual gain in dB',
		hiddenFromList: false,
	},
	startColor: {type: 'color', default: '#9333ea', description: 'Base Color'},
	endColor: {type: 'color', default: '#ff00ff', description: 'Mix Color'},
	textureSrc: {type: 'asset', default: '', description: 'Texture', keyframable: false},
	textureScale: {
		type: 'number',
		default: 1.0,
		description: 'Texture scale',
		min: 0.5,
		max: 20.0,
		step: 0.5,
		hiddenFromList: false,
	},
	textureRotation: {
		type: 'number',
		default: 1.0,
		description: 'Texture rotation',
		min: 0.0,
		max: 180.0,
		step: 1.0,
		hiddenFromList: false,
	},
	variant: {
		type: 'number',
		default: 1.0,
		description: 'Variant',
		min: 1.0,
		max: 3.0,
		step: 1.0,
		hiddenFromList: false,
	},
	bloating: {
		type: 'number',
		default: 1.0,
		description: 'Bloating',
		min: 1.0,
		max: 10.0,
		step: 0.5,
		hiddenFromList: false,
	},
	intensity: {
		type: 'number',
		default: 1.0,
		description: 'Intensity',
		min: 1.0,
		max: 50.0,
		step: 0.5,
		hiddenFromList: false,
	},
	bpm: {
		type: 'number',
		default: 120,
		description: 'Tempo (BPM)',
		min: 1,
		max: 300,
		step: 1,
		hiddenFromList: false,
		keyframable: false,
	},
	timeOffsetInSeconds: {
		type: 'number',
		default: 0,
		min: 0,
		max: 86400,
		step: 0.01,
		description: 'Animation phase offset in seconds (independent of audio trim)',
		hiddenFromList: false,
		keyframable: false,
	},
	...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

const decodeWindowSeconds = 20;

function hasCompleteAudioWindow(audioData: MediaUtilsAudioData, offset: number, time: number) {
	const chunk = Math.floor(time / decodeWindowSeconds);
	const expectedStart = Math.max(0, (chunk - 1) * decodeWindowSeconds);
	const expectedEnd = Math.min(audioData.durationInSeconds, (chunk + 2) * decodeWindowSeconds);
	return (
		Math.abs(offset - expectedStart) < 1 / audioData.sampleRate &&
		audioData.channelWaveforms[0].length >=
			Math.round((expectedEnd - expectedStart) * audioData.sampleRate) - 2
	);
}

function useVisualizerAudio(src: string, time: number, fps: number) {
	const result = useWindowedAudioData({
		src,
		frame: Math.max(0, time) * fps,
		fps,
		windowInSeconds: decodeWindowSeconds,
	});

	const instanceId = useId();
	const revision = useRef(0);
	const audioData = useMemo(
		() =>
			result.audioData
				? {
						...result.audioData,
						resultId: `${instanceId}:${revision.current++}`,
					}
				: null,
		[result.audioData, instanceId],
	);

	const complete =
		audioData === null || hasCompleteAudioWindow(audioData, result.dataOffsetInSeconds, time);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		if (complete) return;
		const handle = delayRender('Waiting for complete visualizer audio history');
		return () => continueRender(handle);
	}, [complete, delayRender, continueRender]);
	return {...result, audioData: complete ? audioData : null};
}

type AudioInput = {
	readonly audioData: MediaUtilsAudioData;
	readonly dataOffsetInSeconds: number;
	readonly sourceTime: number;
	readonly fps: number;
};

function computeBars({
	allVisualizationValues,
	outputBarsCount = 308,
}: {
	allVisualizationValues: number[];
	outputBarsCount?: number;
}) {
	const minFreq = 20;
	const maxFreq = 22000;
	const defaultFill = 0.0025;
	const freqStep = (maxFreq - minFreq) / allVisualizationValues.length;
	const bars = Array.from({length: outputBarsCount}, () => defaultFill);
	const binSize = 1 / outputBarsCount;
	for (let index = 0; index < allVisualizationValues.length; index++) {
		const frequency = minFreq + index * freqStep;
		const logFrequency = Math.log10(frequency / minFreq) / Math.log10(maxFreq / minFreq);
		const binIndex = Math.floor(logFrequency / binSize);
		if (binIndex < outputBarsCount) {
			bars[binIndex] +=
				binIndex < Math.floor(outputBarsCount * 0.334415584415584)
					? allVisualizationValues[index] * 1.3
					: allVisualizationValues[index];
			if (outputBarsCount !== 308 && binIndex >= Math.floor(outputBarsCount * 0.9845)) {
				bars[binIndex] = defaultFill;
			}
		}
	}
	return bars.filter((b) => b !== defaultFill && !Number.isNaN(b));
}

function spectrumBars(input: AudioInput, count = 308) {
	if (input.sourceTime < 0 || input.sourceTime >= input.audioData.durationInSeconds)
		return Array(count).fill(0) as number[];
	const frequencies = visualizeAudio({
		audioData: input.audioData,
		dataOffsetInSeconds: input.dataOffsetInSeconds,
		frame: input.sourceTime * 60,
		fps: 60,
		numberOfSamples: 4096,
		optimizeFor: 'speed',
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		outputBarsCount: count,
	});
}

function bounded(value: number, min: number, max: number, fallback: number) {
	return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function downfallTiming(frame: number, fps: number, audioOffset: number, timeOffset: number) {
	const offsetFrames = Math.round(bounded(audioOffset, 0, 86400, 0) * fps);
	return {
		offsetFrames,
		sourceTime: (frame + offsetFrames) / fps,
		time: frame / fps + bounded(timeOffset, 0, 86400, 0),
	};
}

function downfallBands(bars: readonly number[], inputGainDb: number) {
	const gain = 10 ** (bounded(inputGainDb, -30, 30, 0) / 20);
	return [11, 45, 85].map((index) => {
		const value = bars[index] ?? 0;
		return Number.isFinite(value) ? Math.max(0, value) * gain : 0;
	});
}

function downfallGeometry() {
	const vertices: number[] = [];
	const vertex = (x: number, y: number) => {
		const u = x / 32;
		const v = y / 32;
		const longitude = u * Math.PI * 2;
		const latitude = v * Math.PI;
		const poleOffset = y === 0 ? 1 / 64 : y === 32 ? -1 / 64 : 0;
		vertices.push(
			-100 * Math.cos(longitude) * Math.sin(latitude),
			100 * Math.cos(latitude),
			100 * Math.sin(longitude) * Math.sin(latitude),
			u + poleOffset,
			1 - v,
		);
	};
	for (let y = 0; y < 32; y++) {
		for (let x = 0; x < 32; x++) {
			if (y > 0) {
				vertex(x + 1, y);
				vertex(x, y);
				vertex(x + 1, y + 1);
			}
			if (y < 31) {
				vertex(x, y);
				vertex(x, y + 1);
				vertex(x + 1, y + 1);
			}
		}
	}
	return new Float32Array(vertices);
}

const vertexShader = `#version 300 es
precision highp float;
in vec3 position;
in vec2 uv;
out vec2 vUv;
uniform float iAspect;
void main() {
 vUv = uv;
 float c = cos(1.6);
 float s = sin(1.6);
 vec3 p = vec3(c * position.x + s * position.z, position.y,
  -s * position.x + c * position.z - 5.0);
 float f = 1.0 / tan(radians(75.0) * 0.5);
 gl_Position = vec4(p.x * f / iAspect, p.y * f,
  -(1000.0 + 0.1) / (1000.0 - 0.1) * p.z - 2.0 * 1000.0 * 0.1 / (1000.0 - 0.1), -p.z);
}`;

type DownfallFrame = Pick<
	Required<DownfallOptions>,
	| 'width'
	| 'height'
	| 'startColor'
	| 'endColor'
	| 'textureSrc'
	| 'textureScale'
	| 'textureRotation'
	| 'variant'
	| 'bloating'
	| 'intensity'
	| 'bpm'
> & {readonly time: number; readonly bands: readonly number[]};

type DownfallState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly vertexCount: number;
	readonly uniforms: Record<
		| 'iGlobalTime'
		| 'iLowFreq'
		| 'iMidFreq'
		| 'iHighFreq'
		| 'iStartColor'
		| 'iEndColor'
		| 'iTexture'
		| 'iTextureScale'
		| 'iTextureRotation'
		| 'iVariant'
		| 'iBloating'
		| 'iIntensity'
		| 'iBpm'
		| 'iTextureExists'
		| 'iAspect',
		WebGLUniformLocation | null
	>;
};

function setupDownfall(canvas: HTMLCanvasElement): DownfallState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Downfall requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Downfall could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, vertexShader],
			[gl.FRAGMENT_SHADER, fragmentShader],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Downfall could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(`Downfall shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(`Downfall shader linking failed: ${gl.getProgramInfoLog(program)}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Downfall could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const geometry = downfallGeometry();
		gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);
		for (const [name, size, offset] of [
			['position', 3, 0],
			['uv', 2, 12],
		] as const) {
			const attribute = gl.getAttribLocation(program, name);
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 20, offset);
		}
		texture = gl.createTexture();
		if (!texture) throw new Error('Downfall could not create a texture.');
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			1,
			1,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			new Uint8Array([0, 0, 0, 255]),
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.generateMipmap(gl.TEXTURE_2D);
		return {
			texture,
			gl,
			program,
			buffer,
			vertexCount: geometry.length / 5,
			uniforms: {
				iGlobalTime: gl.getUniformLocation(program, 'iGlobalTime'),
				iLowFreq: gl.getUniformLocation(program, 'iLowFreq'),
				iMidFreq: gl.getUniformLocation(program, 'iMidFreq'),
				iHighFreq: gl.getUniformLocation(program, 'iHighFreq'),
				iStartColor: gl.getUniformLocation(program, 'iStartColor'),
				iEndColor: gl.getUniformLocation(program, 'iEndColor'),
				iTexture: gl.getUniformLocation(program, 'iTexture'),
				iTextureScale: gl.getUniformLocation(program, 'iTextureScale'),
				iTextureRotation: gl.getUniformLocation(program, 'iTextureRotation'),
				iVariant: gl.getUniformLocation(program, 'iVariant'),
				iBloating: gl.getUniformLocation(program, 'iBloating'),
				iIntensity: gl.getUniformLocation(program, 'iIntensity'),
				iBpm: gl.getUniformLocation(program, 'iBpm'),
				iTextureExists: gl.getUniformLocation(program, 'iTextureExists'),
				iAspect: gl.getUniformLocation(program, 'iAspect'),
			},
		};
	} catch (error) {
		gl.deleteTexture(texture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		throw error;
	} finally {
		for (const shader of shaders) gl.deleteShader(shader);
	}
}

function drawDownfall({gl, program, uniforms, vertexCount}: DownfallState, frame: DownfallFrame) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.iAspect, frame.width / frame.height);
	gl.uniform1f(uniforms.iGlobalTime, frame.time);
	gl.uniform1f(uniforms.iLowFreq, frame.bands[0] ?? 0);
	gl.uniform1f(uniforms.iMidFreq, frame.bands[1] ?? 0);
	gl.uniform1f(uniforms.iHighFreq, frame.bands[2] ?? 0);
	gl.uniform3fv(uniforms.iStartColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.iEndColor, linearColor(frame.endColor));
	gl.uniform1f(uniforms.iTextureScale, bounded(frame.textureScale, 0.5, 20.0, 1.0));
	gl.uniform1f(uniforms.iTextureRotation, bounded(frame.textureRotation, 0.0, 180.0, 1.0));
	gl.uniform1f(uniforms.iVariant, Math.trunc(bounded(frame.variant, 1.0, 3.0, 1.0)));
	gl.uniform1f(uniforms.iBloating, bounded(frame.bloating, 1.0, 10.0, 1.0));
	gl.uniform1f(uniforms.iIntensity, bounded(frame.intensity, 1.0, 50.0, 1.0));
	gl.uniform1f(uniforms.iBpm, bounded(frame.bpm, 1, 300, 120));
	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT);
	gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Downfall WebGL draw failed: ${error}`);
}

function cleanupDownfall({gl, program, buffer, texture}: DownfallState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function DownfallCanvas(frame: DownfallFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<DownfallState | null>(null);
	const latestFrame = useRef(frame);
	latestFrame.current = frame;
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupDownfall(canvas);
		} catch (error) {
			cancelRender(error);
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Downfall WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupDownfall(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		const current = state.current;
		if (!current) return;
		const {gl, program, uniforms, texture} = current;
		gl.useProgram(program);
		gl.uniform1i(uniforms.iTexture, 0);
		gl.uniform1i(uniforms.iTextureExists, 0);
		if (!frame.textureSrc) return;
		const handle = delayRender('Loading Downfall texture');
		let disposed = false;
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => {
			if (disposed) return;
			try {
				gl.useProgram(program);
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
				gl.generateMipmap(gl.TEXTURE_2D);
				gl.uniform1i(uniforms.iTextureExists, 1);
				drawDownfall(current, latestFrame.current);
			} catch (error) {
				cancelRender(error);
			} finally {
				continueRender(handle);
			}
		};
		image.onerror = () => {
			if (!disposed) {
				continueRender(handle);
				cancelRender(new Error(`Downfall could not load texture: ${frame.textureSrc}`));
			}
		};
		image.src = frame.textureSrc;
		return () => {
			disposed = true;
			image.onload = null;
			image.onerror = null;
			continueRender(handle);
		};
	}, [frame.textureSrc, delayRender, continueRender]);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Downfall');
		try {
			drawDownfall(state.current, frame);
		} catch (error) {
			cancelRender(error);
		} finally {
			continueRender(handle);
		}
	}, [frame, delayRender, continueRender]);
	return (
		<canvas
			ref={canvasRef}
			width={frame.width}
			height={frame.height}
			style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
		/>
	);
}

const fragmentShader = `#version 300 es
precision highp float;
precision highp int;

uniform float iGlobalTime;
uniform sampler2D iTexture;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform bool iTextureExists;
uniform float iBpm;
uniform float iLowFreq;
uniform float iMidFreq;
uniform float iHighFreq;
uniform float iTextureScale;
uniform float iTextureRotation;
uniform float iVariant;
uniform float iBloating;
uniform float iIntensity;
uniform vec3 iStartColor;
uniform vec3 iEndColor;
in vec2 vUv;
out vec4 outColor;
const float FAR = 100.0; 
float objID = 2.; 
float hash( float n ){ return fract(cos(n)*45758.5453); }
mat3 rotationMatrix(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, -s, 0,
        s, c, 0,
        0, 0, 1
    );
}
vec3 fallbackTex3D(in vec3 p) {
    vec3 cell = floor(p * 2.0);
    float pattern = hash(dot(cell, vec3(17.0, 59.0, 113.0)));
    vec3 color = mix(iStartColor, iEndColor, pattern);
    return color * (0.35 + 0.65 * pattern);
}
vec3 tex3D(sampler2D t, in vec3 p, in vec3 n ){
    float angle = radians(iTextureRotation);
    p *= rotationMatrix(angle) * iTextureScale;
    n = max(abs(n), 0.001);
    n /= dot(n, vec3(1));
    if (!iTextureExists) {
        return fallbackTex3D(p);
    }
    vec3 tx = texture(t, p.yz).xyz;
    vec3 ty = texture(t, p.zx).xyz;
    vec3 tz = texture(t, p.xy).xyz;
    return (tx*tx*n.x + ty*ty*n.y + tz*tz*n.z);
}
float lengthN(in vec2 p, in float n){ p = pow(abs(p), vec2(n)); return pow(p.x + p.y, 1.0/n); }
vec3 cp[16];
void setCamPath(){
    const float sl = 2.*.96;
    const float bl = 4.*.96;
    cp[0] = vec3(0, 0, 0);	
    cp[1] = vec3(0, 0, -bl);
    cp[2] = vec3(0, bl, -bl);	
    cp[3] = vec3(-sl, bl, -bl);
    cp[4] = vec3(-sl, 0, -bl);
    cp[5] = vec3(-sl, 0, 0);
    cp[6] = vec3(-sl, -sl, 0);
    cp[7] = vec3(0, -sl, 0);
    cp[8] = vec3(0, 0, 0);
    cp[9] = vec3(0, 0, bl);
    cp[10] = vec3(sl, 0, bl);
    cp[11] = vec3(sl, 0, sl);
    cp[12] = vec3(sl, sl, sl);	
    cp[13] = vec3(-sl, sl, sl);	
    cp[14] = vec3(-sl, 0, sl);
    cp[15] = vec3(-sl, 0, 0); 
}
vec3 Catmull(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t){
    return (((-p0 + p1*3. - p2*3. + p3)*t*t*t + (p0*2. - p1*5. + p2*4. - p3)*t*t + (-p0 + p2)*t + p1*2.)*.5);
}
vec3 camPath(float t){
    const int aNum = 16;
    t = fract(t/float(aNum))*float(aNum);	
    float segNum = floor(t);
    float segTime = t - segNum; 
    if (segNum == 0.) return Catmull(cp[aNum-1], cp[0], cp[1], cp[2], segTime); 
    for(int i=1; i<aNum-2; i++){
        if (segNum == float(i)) return Catmull(cp[i-1], cp[i], cp[i+1], cp[i+2], segTime); 
    }
    if (segNum == float(aNum-2)) return Catmull(cp[aNum-3], cp[aNum-2], cp[aNum-1], cp[0], segTime); 
    if (segNum == float(aNum-1)) return Catmull(cp[aNum-2], cp[aNum-1], cp[0], cp[1], segTime);
    return vec3(0);
}
float sminP( float a, float b, float s ){
    if (iIntensity > 10.0) {
        s *= 1.0/(1.0-sqrt(0.5));
        return max(s,min(a,b)) -
               length(max(s-vec2(s,b),0.0));
    }
    float h = clamp( 0.5+0.5*(b-a)/s, 0.0, 1.0 );
    return mix( b, a, h ) - s*h*(1.0-h);
}
float map(in vec3 q){
 	vec3 p = abs(fract(q/4.)*4. - 2.);
    float modifier = 0.0;
    if (iIntensity > 20.0) {
        modifier = iIntensity / 60.;
    }
    if (iIntensity > 45.0) {
        modifier = iIntensity / 40.;
    }
 	float tube = min(max(p.x, p.y), min(max(p.y, p.z), max(p.x, p.z))) - 4./3. - .015 + modifier;
    p = abs(fract(q/2.)*2. - 1.);
 	tube = max(tube, sminP(max(p.x, p.y), sminP(max(p.y, p.z), max(p.x, p.z), .05), .05) - 2./3.);
    float panel = 0.0;
    panel = sminP(max(p.x, p.y),sminP(max(p.y, p.z),max(p.x, p.z), .125 * iIntensity), .125 * iIntensity)-0.5; 
    if (iVariant == 1.0) {
        panel = sminP(max(p.x, p.y),sminP(max(p.y, p.z),max(p.x, p.z), .125 * iIntensity), .125 * iIntensity)-0.5; 
    }
    if (iVariant == 2.0) {
        panel = sqrt(min(dot(p.xy, p.xy),min(dot(p.yz, p.yz),dot(p.xz, p.xz))))-0.25; 
    }
    if (iVariant == 3.0) {
        panel = sminP(length(p.xy),sminP(length(p.yz),length(p.xz), 0.25), 0.125)-0.45; 
    }
    float strip = step(p.x, .75)*step(p.y, .75)*step(p.z, .75);
    panel -= (strip)*.025;     
    float bulge = (max(max(p.x, p.y), p.z) - .55);
    if (iBloating > 1.0 && iBloating < 5.0) {
        tube -= bulge*(1.-step(p.x, .75)*step(p.y, .75)*step(p.z, .75))*bulge*.25 + iBloating / 200.; 
    }
    if (iBloating >= 5.0) {
        panel -= bulge*(1.-step(p.x, .75)*step(p.y, .75)*step(p.z, .75))*bulge*.55 + iBloating / 200.; 
    }
    p = abs(fract(q*2.)*.5 - .25);
    float pan2 = min(p.x, min(p.y,p.z))-.05;    
    panel = max(abs(panel), abs(pan2)) - .0425;    
    p = abs(fract(q*1.5)/1.5 - 1./3.);
 	tube = max(tube, min(max(p.x, p.y), min(max(p.y, p.z), max(p.x, p.z))) - 2./9. + .025); 
    p = abs(fract(q*3.)/3. - 1./6.);
 	tube = max(tube, min(max(p.x, p.y), min(max(p.y, p.z), max(p.x, p.z))) - 1./9. - .035); 
    objID = 1.+ step(tube, panel) + step(panel, tube)*(strip)*2.;
    return min(panel, tube);
}
float trace(in vec3 ro, in vec3 rd){
    float t = 0., h;
    for(int i = 0; i < 92; i++){
        h = map(ro+rd*t);
        if(abs(h)<.001*(t*.25 + 1.) || t>FAR) break; 
        t += h*.8;
    }
    return t;
}
float refTrace(vec3 ro, vec3 rd){
    float t = 0.;
    for(int i=0; i<16; i++){
        float d = map(ro + rd*t);
        if (d < .0025*(t*.25 + 1.) || t>FAR) break;
        t += d;
    } 
    return t;
}
vec3 calcNormal(in vec3 p) {
	const vec2 e = vec2(0.005, 0);
	return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy),	map(p + e.yyx) - map(p - e.yyx)));
}
float calcAO(in vec3 pos, in vec3 nor)
{
    float sca = 2.0, occ = iLowFreq;
    for( int i=0; i<5; i++ ){
        float hr = 0.01 + float(i)*0.5/4.0;        
        float dd = map(nor * hr + pos);
        occ += (hr - dd)*sca;
        sca *= 0.7;
    }
    return clamp( 1.0 - occ, 0.0, 1.0 );    
}
vec3 texBump( sampler2D tx, in vec3 p, in vec3 n, float bf){
    const vec2 e = vec2(0.001, 0);
    mat3 m = mat3( tex3D(tx, p - e.xyy, n), tex3D(tx, p - e.yxy, n), tex3D(tx, p - e.yyx, n));
    vec3 g = vec3(0.299, 0.587, 0.114)*m; 
    g = (g - dot(tex3D(tx,  p , n), vec3(0.299, 0.587, 0.114)) )/e.x; g -= n*dot(n, g);
    return normalize( n + g*bf ); 
}
void main() {
    vec2 nuv = (vUv - vec2(0.5, 0.5)) / vec2(0.35, 0.65);
	vec2 u = nuv;
    float speed = iGlobalTime*(iBpm / 500.);
    setCamPath();
    vec3 ro = camPath(speed); 
    vec3 lk = camPath(speed + .5);  
    vec3 lp = camPath(speed + .5) + vec3(0, .25, 0); 
    float FOV = 2.0; 
    vec3 fwd = normalize(lk-ro);
    vec3 rgt = normalize(vec3(fwd.z, 0, -fwd.x));
    vec3 up = (cross(fwd, rgt));
    vec3 rd = normalize(fwd + FOV*(u.x*rgt + u.y*up));
    float t = trace(ro, rd);
    vec3 col = vec3(0);
    if(t<FAR){
        float ts = 1.;  
        float saveObjID = objID; 
        vec3 pos = ro + rd*t; 
        vec3 nor = calcNormal(pos); 
        vec3 sNor = nor;
        if (iTextureExists) {
            nor = texBump(iTexture, pos*ts, nor, 0.002); 
        }
        vec3 ref = reflect(rd, normalize(sNor*.5 + nor*.5)); 
		col = tex3D(iTexture, pos*ts, nor); 
        vec3  li = lp - pos; 
        float lDist = max(length(li), .001); 
        float atten = 1.25/(1.0 + lDist*0.125 + lDist*lDist*.05); 
        li /= lDist; 
        float occ = calcAO( pos, nor ); 
        float dif = clamp(dot(nor, li), 0.0, 1.0); 
        dif = pow(dif, 3.)*2. * iMidFreq / 3.0;
        float spe = pow(max(dot(reflect(-li, nor), -rd), 0.), 8.); 
        float spe2 = spe*spe; 
        float refl = .35 + iMidFreq / 3.0; 
        float rSaveObjID = saveObjID;
        vec3 rCol = fallbackTex3D((pos + ref*2.)*ts);
        float rDiff = pow(max(dot(nor, li), 0.), 4.)*2.;
        float rAtten = 0.65;
        if (iTextureExists) {
            float rt = refTrace(pos + ref*0.1, ref); 
            rSaveObjID = objID; 
            vec3 rsp = pos + ref*rt; 
            vec3 rsn = calcNormal(rsp); 
            rCol = tex3D(iTexture, rsp*ts, rsn); 
            vec3 rLi = lp-rsp;
            float rlDist = max(length(rLi), 0.001);
            rLi /= rlDist;
            rDiff = max(dot(rsn, rLi), 0.); 
            rDiff = pow(rDiff, 4.)*2.;
            rAtten = 1./(1. + rlDist*0.125 + rlDist*rlDist*.05);
        }
        if(rSaveObjID>1.5 && rSaveObjID<2.5){
            rCol = vec3(1)*dot(rCol, vec3(.299, .587, .114))*.7 + rCol*.15;
        }
        if(rSaveObjID>2.5){
             vec3 rFire = pow(vec3(1.5, 1, 1)*rCol, vec3(8, 2, 1.5));
             rCol = min(mix(iEndColor, vec3(.75, .375, .3), rFire), 2.)*.5 + rCol;   
        }
        rCol *= (rDiff + .35)*rAtten; 
        if(saveObjID>1.5 && saveObjID<2.5){ 
            col = vec3(1)*dot(col, vec3(.299, .587, .114))*.7 + col*.15;
            rCol = vec3(1)*iStartColor*.7 + rCol*.15;
            refl = .5;
        }         
        if(saveObjID>2.5){
            vec3 fire = clamp(pow(max(vec3(1.5, 1, 1)*col, vec3(0)), vec3(8, 2, 1.5)), 0.0, 1.0);
            col = min(mix(iEndColor, vec3(iHighFreq, iMidFreq, iHighFreq), fire), 2.)*.5 + col;
            refl = .65;
        }
        col = col*(dif + .35  + vec3(.35, .45, .5)*spe) + vec3(.7, .9, 1)*spe2 + rCol*refl;
        col *= occ*atten; 
    }
    col = mix(min(col, 1.), vec3(0), 1.-exp(-t*t/FAR/FAR*20.));
    col = sqrt(max(col, 0.));
    outColor = vec4(col, 1.0);
}
`;

const colorCache = new Map<string, number[]>();

let colorParser: CanvasRenderingContext2D | null = null;

function linearColor(color: string): number[] {
	const cached = colorCache.get(color);
	if (cached) return cached;
	let bytes: number[];
	const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color)?.[1];
	if (hex) {
		const expanded = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
		bytes = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
	} else {
		if (!CSS.supports('color', color)) throw new Error(`Invalid visualizer color: ${color}`);
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

const silentAudio: MediaUtilsAudioData = {
	channelWaveforms: [new Float32Array(1)],
	sampleRate: 44100,
	durationInSeconds: 0,
	numberOfChannels: 1,
	resultId: 'banger-elements-silence',
	isRemote: false,
};

const DownfallContent: React.FC<Required<DownfallOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const {offsetFrames, sourceTime, time} = downfallTiming(
		frame,
		fps,
		props.audioOffsetInSeconds,
		props.timeOffsetInSeconds,
	);
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const bars = spectrumBars({
		audioData: audioData ?? silentAudio,
		dataOffsetInSeconds,
		sourceTime,
		fps,
	});
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<DownfallCanvas {...props} time={time} bands={downfallBands(bars, props.inputGainDb)} />
		</>
	);
};

const DownfallInner = forwardRef<
	HTMLDivElement,
	DownfallProps & {readonly controls: SequenceControls | undefined}
>(
	(
		{
			width = downfallSchema.width.default,
			height = downfallSchema.height.default,
			audioSrc = downfallSchema.audioSrc.default,
			audioOffsetInSeconds = downfallSchema.audioOffsetInSeconds.default,
			playAudio = downfallSchema.playAudio.default,
			inputGainDb = downfallSchema.inputGainDb.default,
			startColor = downfallSchema.startColor.default,
			endColor = downfallSchema.endColor.default,
			textureSrc = downfallSchema.textureSrc.default,
			textureScale = downfallSchema.textureScale.default,
			textureRotation = downfallSchema.textureRotation.default,
			variant = downfallSchema.variant.default,
			bloating = downfallSchema.bloating.default,
			intensity = downfallSchema.intensity.default,
			bpm = downfallSchema.bpm.default,
			timeOffsetInSeconds = downfallSchema.timeOffsetInSeconds.default,
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
				name={name ?? 'Downfall'}
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
						...style,
					}}
				>
					<DownfallContent
						key={`${audioSrc}:${textureSrc}`}
						width={drawingWidth}
						height={drawingHeight}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						startColor={startColor}
						endColor={endColor}
						textureSrc={textureSrc}
						textureScale={textureScale}
						textureRotation={textureRotation}
						variant={variant}
						bloating={bloating}
						intensity={intensity}
						bpm={bpm}
						timeOffsetInSeconds={timeOffsetInSeconds}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Downfall = Interactive.withSchema({
	Component: DownfallInner,
	componentName: '<Downfall>',
	componentIdentity: null,
	schema: downfallSchema,
	supportsEffects: false,
}) as React.FC<DownfallProps>;
