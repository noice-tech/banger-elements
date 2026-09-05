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

type PulsarOptions = {
	readonly width?: number;
	readonly height?: number;
	readonly audioSrc?: string;
	readonly audioOffsetInSeconds?: number;
	readonly playAudio?: boolean;
	readonly inputGainDb?: number;
	readonly intensity?: number;
	readonly startColor?: string;
	readonly endColor?: string;
	// Retained for compatibility; the original shader uses start/end colors only.
	readonly colorMode?: 'gradient' | 'rainbow';
	readonly density?: number;
	readonly pattern?: number;
	readonly volume?: number;
};

type PulsarProps = InteractiveBaseProps & InteractiveTransformProps & PulsarOptions;
const ANALYSIS_FPS = 60;

const pulsarSchema = {
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
		default: 900,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Width',
		hiddenFromList: false,
		keyframable: false,
	},
	height: {
		type: 'number',
		default: 500,
		min: 16,
		max: 3840,
		step: 1,
		description: 'Height',
		hiddenFromList: false,
		keyframable: false,
	},
	startColor: {type: 'color', default: '#592bb3', description: 'Start color'},
	endColor: {type: 'color', default: '#195753', description: 'End color'},
	colorMode: {
		type: 'enum',
		default: 'gradient',
		description: 'Color mode',
		variants: {gradient: {}, rainbow: {}},
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
	intensity: {
		type: 'number',
		default: 2.5,
		min: 0.1,
		max: 10,
		step: 0.1,
		description: 'Intensity',
		hiddenFromList: false,
	},
	density: {
		type: 'number',
		default: 1.5,
		min: 0.1,
		max: 5,
		step: 0.1,
		description: 'Volume density',
		hiddenFromList: false,
	},
	pattern: {
		type: 'number',
		default: 4,
		min: 0.5,
		max: 16,
		step: 0.5,
		description: 'Pattern',
		hiddenFromList: false,
	},
	volume: {
		type: 'number',
		default: 3,
		min: 0.5,
		max: 10,
		step: 0.5,
		description: 'Volume size',
		hiddenFromList: false,
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
	// media-utils caches analysis by resultId; distinguish decoded buffer revisions.
	const instanceId = useId();
	const revision = useRef(0);
	const audioData = useMemo(
		() =>
			result.audioData
				? {...result.audioData, resultId: `${instanceId}:${revision.current++}`}
				: null,
		[result.audioData, instanceId],
	);
	// The current chunk can arrive before its retained neighbors.
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
		frame: input.sourceTime * ANALYSIS_FPS,
		fps: ANALYSIS_FPS,
		numberOfSamples: 4096,
		optimizeFor: 'speed',
		smoothing: true,
	});
	return computeBars({
		allVisualizationValues: frequencies,
		outputBarsCount: count,
	});
}

const planeVertex = `
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

type DataTexture = {
	width: number;
	height: number;
	data: Uint8Array;
};

// Adapt the known Banger GLSL sources to WebGL2, without Three's injected built-ins.
function shaderSource(source: string, fragment: boolean) {
	let code = source
		.replace(/\bvarying\b/g, fragment ? 'in' : 'out')
		.replace(/\battribute\b/g, 'in')
		.replace(/\btexture2D\b/g, 'texture')
		.replace(/\bgl_FragColor\b/g, 'outColor')
		.replace('vec2 iResolution = vec2(1920.0, 1080.0);', 'uniform vec2 iResolution;')
		.replace('point.x *= 16.0 / 9.0;', 'point.x *= iAspect;');
	if (fragment)
		code =
			code.replace(/void main\(\)/, 'void renderEffect()') +
			`
void main() {
  renderEffect();
  vec3 c = max(outColor.rgb, vec3(0.0));
  outColor.rgb = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), c));
  outColor.a = clamp(outColor.a, 0.0, 1.0);
  outColor.rgb *= outColor.a;
}`;
	return `#version 300 es\nprecision highp float;\nprecision highp int;\n${fragment ? 'out vec4 outColor;\nuniform float iAspect;\n' : ''}${code}`;
}

type PulsarFrame = Pick<
	Required<PulsarOptions>,
	'width' | 'height' | 'startColor' | 'endColor' | 'density' | 'pattern' | 'volume'
> & {readonly sourceTime: number; readonly texture: DataTexture};

type PulsarState = {
	readonly gl: WebGL2RenderingContext;
	readonly program: WebGLProgram;
	readonly buffer: WebGLBuffer;
	readonly texture: WebGLTexture;
	readonly uniforms: {
		readonly time: WebGLUniformLocation | null;
		readonly aspect: WebGLUniformLocation | null;
		readonly texture: WebGLUniformLocation | null;
		readonly startColor: WebGLUniformLocation | null;
		readonly endColor: WebGLUniformLocation | null;
		readonly density: WebGLUniformLocation | null;
		readonly pattern: WebGLUniformLocation | null;
		readonly volume: WebGLUniformLocation | null;
	};
};

function setupPulsar(canvas: HTMLCanvasElement): PulsarState {
	const gl = canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
	});
	if (!gl)
		throw new Error(
			'Pulsar requires WebGL2. Enable browser graphics acceleration and reload Studio.',
		);
	const program = gl.createProgram();
	if (!program) throw new Error('Pulsar could not create a program.');
	const shaders: WebGLShader[] = [];
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	try {
		for (const [type, source] of [
			[gl.VERTEX_SHADER, shaderSource(planeVertex, false)],
			[gl.FRAGMENT_SHADER, shaderSource(fragmentShader, true)],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Pulsar could not create a shader.');
			shaders.push(shader);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				const message = gl.getShaderInfoLog(shader);
				throw new Error(`Pulsar shader compilation failed: ${message}`);
			}
			gl.attachShader(program, shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const message = gl.getProgramInfoLog(program);
			throw new Error(`Pulsar shader linking failed: ${message}`);
		}
		gl.useProgram(program);
		buffer = gl.createBuffer();
		if (!buffer) throw new Error('Pulsar could not create a vertex buffer.');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW,
		);
		const attribute = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(attribute);
		gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
		texture = gl.createTexture();
		if (!texture) throw new Error('Pulsar could not create an audio texture.');
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.uniform1f(gl.getUniformLocation(program, 'iOpacity'), 1);
		return {
			gl,
			program,
			buffer,
			texture,
			uniforms: {
				time: gl.getUniformLocation(program, 'iGlobalTime'),
				aspect: gl.getUniformLocation(program, 'iAspect'),
				texture: gl.getUniformLocation(program, 'iTexture'),
				startColor: gl.getUniformLocation(program, 'iStartColor'),
				endColor: gl.getUniformLocation(program, 'iEndColor'),
				density: gl.getUniformLocation(program, 'iDensity'),
				pattern: gl.getUniformLocation(program, 'iPattern'),
				volume: gl.getUniformLocation(program, 'iVolume'),
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

function drawPulsar({gl, program, texture, uniforms}: PulsarState, frame: PulsarFrame) {
	gl.useProgram(program);
	gl.viewport(0, 0, frame.width, frame.height);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.uniform1f(uniforms.time, frame.sourceTime);
	gl.uniform1f(uniforms.aspect, frame.width / frame.height);
	gl.uniform3fv(uniforms.startColor, linearColor(frame.startColor));
	gl.uniform3fv(uniforms.endColor, linearColor(frame.endColor));
	gl.uniform1f(uniforms.density, frame.density);
	gl.uniform1f(uniforms.pattern, frame.pattern);
	gl.uniform1f(uniforms.volume, frame.volume);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		frame.texture.width,
		frame.texture.height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		frame.texture.data,
	);
	gl.uniform1i(uniforms.texture, 0);
	gl.disable(gl.BLEND);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	// Finish GPU work before Remotion captures the frame.
	gl.finish();
	const error = gl.getError();
	if (error !== gl.NO_ERROR) throw new Error(`Pulsar WebGL draw failed: ${error}`);
}

function cleanupPulsar({gl, program, buffer, texture}: PulsarState) {
	gl.deleteTexture(texture);
	gl.deleteBuffer(buffer);
	gl.deleteProgram(program);
}

function PulsarCanvas(frame: PulsarFrame) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const state = useRef<PulsarState | null>(null);
	const {delayRender, continueRender} = useDelayRender();
	useLayoutEffect(() => {
		const canvas = canvasRef.current!;
		try {
			state.current = setupPulsar(canvas);
		} catch (error) {
			cancelRender(error);
			return;
		}
		const current = state.current;
		const lost = (event: Event) => {
			event.preventDefault();
			cancelRender(new Error('Pulsar WebGL context was lost.'));
		};
		canvas.addEventListener('webglcontextlost', lost);
		return () => {
			canvas.removeEventListener('webglcontextlost', lost);
			cleanupPulsar(current);
			state.current = null;
			queueMicrotask(() => {
				if (!canvas.isConnected) current.gl.getExtension('WEBGL_lose_context')?.loseContext();
			});
		};
	}, []);
	useLayoutEffect(() => {
		if (!state.current) return;
		const handle = delayRender('Drawing Pulsar');
		try {
			drawPulsar(state.current, frame);
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

// prettier-ignore
const fragmentShader = `
uniform float iGlobalTime;
uniform sampler2D iTexture;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;

uniform float iWidth;
uniform float iCount;

uniform vec3 iStartColor;
uniform vec3 iEndColor;

uniform float iIntensity;
uniform float iDensity;
uniform float iPattern;
uniform float iVolume;
uniform float iOpacity;

varying vec2 vUv;

vec3 iResolution = vec3(1280.,720.,1.);

float sphereSound( in vec3 checkedPoint )
{
    vec2 samplerSmall = vec2( 0.5 + abs(sin( atan( checkedPoint.y / ( checkedPoint.x )))) / iPattern, 0.25 );
    vec2 samplerBig = vec2( cos( atan( checkedPoint.x / ( checkedPoint.z ))) / iPattern, 0.25 );
    
    return ( texture( iTexture, samplerSmall ).r * texture( iTexture, samplerBig ).r ) * iVolume;
}

float sphereDistance( in vec3 checkedPoint )
{
    const float radius = 3.0;
    const float amplification = 5.0;
    
    return distance( checkedPoint, vec3( 0.0, 0.0, 0.0 ) ) - radius - sphereSound( checkedPoint ) * amplification;
}

vec3 sphereNormal( in vec3 checkedPoint )
{
    const float shift = 1.1;
    return normalize(
        vec3
        (
            sphereDistance(checkedPoint + vec3( shift, 0, 0 )) - sphereDistance(checkedPoint - vec3( shift, 0, 0 )),
            sphereDistance(checkedPoint + vec3( 0, shift, 0 )) - sphereDistance(checkedPoint - vec3( 0, shift, 0 )),
            sphereDistance(checkedPoint + vec3( 0, 0, shift )) - sphereDistance(checkedPoint - vec3( 0, 0, shift ))
        )
    );
}

struct FragData{
    vec2 screenCoord;
    vec2 normalCoord;
    float normalDistance;
};

vec3 background( in FragData fragData )
{    
    float sound = texture( iTexture, vec2( cos( fragData.normalDistance ), 0.25 )).r 
                + texture( iTexture, vec2( sin( fragData.normalDistance ), 0.25 )).r;
    float fragAngle = cos( atan( fragData.normalCoord.x, fragData.normalCoord.y ) * 8.0 );
    
    float shiftedTime = iGlobalTime * 3.0 - ( fragData.normalDistance * 7.0 ) + fragAngle * sin( pow(( 1.3 - fragData.normalDistance ), ( 1.3 - fragData.normalDistance )) * 100.0 + iGlobalTime * 3.0 + sound * sound * 2.0);
    
    float waveModulator = 0.35 + sin(( fragData.normalDistance-shiftedTime /  5.0 ) * 20.0 ) / 2.0 * sound * 2.0;
    
    float red = ( 0.95 + sin( shiftedTime + sound * 4.0 ) / 7.0 ) * waveModulator;
    float green = 0.1 * waveModulator;
    float blue = ( 0.55 + cos( shiftedTime + sound * 4.0 ) / 3.0 ) * waveModulator;
    
    return vec3( red, green, blue );
}

void main()
{
    const float focalLength = 5.0;
    const float camSurfaceRadius = 5.0;
    
    FragData fragData;


    fragData.screenCoord = vUv;
    // Standalone, aspect-correct framing instead of the editor plane's bottom offset.
    vec2 nuv = (vUv - vec2(0.5)) * vec2(iAspect, 1.0);
    nuv = vec2(nuv.y, -nuv.x);
    nuv.x -= 3.0 / 37.0;

    fragData.normalCoord = nuv;
    fragData.normalDistance = distance(fragData.normalCoord, vec2( 0.0, 0.0 ));
    
    float camRotation = 0. / 5.0;
    float rotationRadius = 25.0 + 10.0 * cos( camRotation / 1.3 );
    vec3 camPosition = vec3( rotationRadius * sin( camRotation ) + 3.0  * cos( camRotation * 3.0 ), 4.0 * sin( camRotation / 1.3 ), -rotationRadius * cos( camRotation ) + 3.0  * sin( camRotation * 2.3 ) );
    float camYaw = camRotation;

    vec3 camLocalSurfaceCoord = 
        vec3(
            cos( camYaw ) * fragData.normalCoord.x * camSurfaceRadius, 
            fragData.normalCoord.y * camSurfaceRadius,
            sin( camYaw ) * fragData.normalCoord.x * camSurfaceRadius
        );
    vec3 rayDirection = normalize( vec3( camLocalSurfaceCoord.x - sin( camYaw ) * focalLength, camLocalSurfaceCoord.y, camLocalSurfaceCoord.z + cos( camYaw ) * focalLength ) );
    vec3 camSurfaceCoord = camPosition + camLocalSurfaceCoord;
    
    float sphereRaysShift = camPosition.y / ( distance( camPosition, vec3(0.0,0.0,0.0) ) / focalLength ) / camSurfaceRadius;
    float sphereRaysStrength = pow( sphereSound( vec3( fragData.normalCoord  + vec2( 0.0, sphereRaysShift ), 0.0 )), 2.5 );
    vec3 color = vec3(0.);
    vec3 checkedSpherePoint = camSurfaceCoord;
    float cumulativeDensity = 1.0;
    
    // The original step is >= 0.5 over a 75-unit range. Bound GPU work explicitly.
    for (int marchStep = 0; marchStep < 160; marchStep++) {
        if (distance(checkedSpherePoint, camPosition) >= 75.0) break;
        float currentDistance = sphereDistance( checkedSpherePoint );
        checkedSpherePoint += max( 0.5, currentDistance + 0.01 ) * rayDirection;
        
        float density = pow( max( 0.0, 3.5 - currentDistance ), iDensity );
        
        float sound = sphereSound( checkedSpherePoint );
        float soundEffect = sound * sound / 50.0;
        color += (iStartColor * density + iEndColor * max( 0.0, dot( sphereNormal( checkedSpherePoint ), -rayDirection ) - 0.5 ) * density ) 
               / cumulativeDensity;
        cumulativeDensity += density;
    }

    float alpha = 1.0;
    float threshold = 0.35;
    float softness = 0.1;

    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    alpha = smoothstep(threshold - softness, threshold + softness, luminance) * iOpacity;

    gl_FragColor = vec4(color, alpha);
}
`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function barsTexture(bars: number[], multiplier: number): DataTexture {
	const data = new Uint8Array(Math.max(1, bars.length) * 4);
	for (let i = 0; i < bars.length; i++) {
		data[i * 4] = Math.round(clamp(bars[i] * multiplier, 0, 1) * 255);
		data[i * 4 + 3] = 255;
	}
	return {width: Math.max(1, bars.length), height: 1, data};
}

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

const PulsarContent: React.FC<Required<PulsarOptions>> = (props) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const offsetFrames = Math.round(props.audioOffsetInSeconds * fps);
	const sourceTime = (frame + offsetFrames) / fps;
	const {audioData, dataOffsetInSeconds} = useVisualizerAudio(props.audioSrc, sourceTime, fps);
	const bars = spectrumBars(
		{audioData: audioData ?? silentAudio, dataOffsetInSeconds, sourceTime},
		2048,
	);
	const texture = barsTexture(bars, props.intensity * 10 ** (props.inputGainDb / 20) * 60);
	return (
		<>
			{props.playAudio ? (
				<Audio src={props.audioSrc} trimBefore={offsetFrames} showInTimeline={false} />
			) : null}
			<PulsarCanvas
				width={props.width}
				height={props.height}
				sourceTime={sourceTime}
				texture={texture}
				startColor={props.startColor}
				endColor={props.endColor}
				density={props.density}
				pattern={props.pattern}
				volume={props.volume}
			/>
		</>
	);
};

const PulsarInner = forwardRef<
	HTMLDivElement,
	PulsarProps & {
		readonly controls: SequenceControls | undefined;
	}
>(
	(
		{
			width = pulsarSchema.width.default,
			height = pulsarSchema.height.default,
			audioSrc = pulsarSchema.audioSrc.default,
			audioOffsetInSeconds = pulsarSchema.audioOffsetInSeconds.default,
			playAudio = pulsarSchema.playAudio.default,
			inputGainDb = pulsarSchema.inputGainDb.default,
			intensity = pulsarSchema.intensity.default,
			startColor = pulsarSchema.startColor.default,
			endColor = pulsarSchema.endColor.default,
			colorMode = pulsarSchema.colorMode.default,
			density = pulsarSchema.density.default,
			pattern = pulsarSchema.pattern.default,
			volume = pulsarSchema.volume.default,
			controls,
			name,
			style,
			...sequenceProps
		},
		ref,
	) => {
		const outlineRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
		return (
			<Sequence
				layout="none"
				{...sequenceProps}
				controls={controls}
				name={name ?? 'Pulsar'}
				outlineRef={outlineRef}
			>
				<div
					ref={outlineRef}
					style={{
						boxSizing: 'border-box',
						width,
						height,
						overflow: 'hidden',
						...style,
					}}
				>
					<PulsarContent
						key={audioSrc}
						width={width}
						height={height}
						audioSrc={audioSrc}
						audioOffsetInSeconds={audioOffsetInSeconds}
						playAudio={playAudio}
						inputGainDb={inputGainDb}
						intensity={intensity}
						startColor={startColor}
						endColor={endColor}
						colorMode={colorMode}
						density={density}
						pattern={pattern}
						volume={volume}
					/>
				</div>
			</Sequence>
		);
	},
);

export const Pulsar = Interactive.withSchema({
	Component: PulsarInner,
	componentName: '<Pulsar>',
	componentIdentity: null,
	schema: pulsarSchema,
	supportsEffects: false,
}) as React.FC<PulsarProps>;
