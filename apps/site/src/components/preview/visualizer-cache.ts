import type {visualizeAudio} from '@remotion/media-utils';

type Visualize = typeof visualizeAudio;

/**
 * `visualizeAudio` with smoothing runs three 8192-point FFTs per call and keeps no cache,
 * even though `useWindowedAudioData` gives every element its own copy of the same audio and
 * consecutive frames overlap (a 30 fps frame re-reads two of its neighbours' three windows).
 * This wraps it with a small cache of single-frame spectra so the live preview does each
 * FFT once. It lives in the site, not in the elements: they ship as self-contained source.
 *
 * Results are identical to the original: the cache stores what the original computes for
 * one frame, and the three are averaged in the same order.
 */

const fingerprints = new WeakMap<Float32Array, string>();

/** Decoded windows of one track are equal in content but never in identity, so key by content. */
function fingerprint(data: Float32Array) {
	let known = fingerprints.get(data);
	if (known === undefined) {
		const bits = new Int32Array(data.buffer, data.byteOffset, data.length);
		let hash = 2166136261;
		const stride = Math.max(1, Math.floor(data.length / 4096));
		for (let index = 0; index < bits.length; index += stride) {
			hash = Math.imul(hash ^ bits[index]!, 16777619);
		}
		known = `${data.length}:${hash >>> 0}`;
		fingerprints.set(data, known);
	}
	return known;
}

export function cacheVisualizer(visualize: Visualize, capacity = 96) {
	const spectra = new Map<string, number[]>();
	const stats = {hits: 0, misses: 0};

	const cached: Visualize = (params) => {
		if (params.smoothing === false) return visualize(params);
		const {audioData, fps, numberOfSamples, dataOffsetInSeconds = 0} = params;
		const prefix = `${fingerprint(audioData.channelWaveforms[0]!)}|${numberOfSamples}|${params.optimizeFor}|`;
		const [before, now, after] = [params.frame - 1, params.frame, params.frame + 1].map((frame) => {
			// The original reads from this sample onwards, so frames in one sample are one spectrum.
			const start = Math.floor((frame / fps - dataOffsetInSeconds) * audioData.sampleRate);
			const key = prefix + start;
			let spectrum = spectra.get(key);
			if (spectrum) {
				stats.hits++;
				spectra.delete(key);
			} else {
				stats.misses++;
				spectrum = visualize({...params, frame, smoothing: false});
				if (spectra.size >= capacity) spectra.delete(spectra.keys().next().value!);
			}
			spectra.set(key, spectrum);
			return spectrum;
		}) as [number[], number[], number[]];
		return Array.from({length: numberOfSamples}, (_, i) => (before[i]! + now[i]! + after[i]!) / 3);
	};
	return Object.assign(cached, {stats});
}
