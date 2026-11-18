// Stands in for `@remotion/media-utils` in the site's bundle (see `astro.config.mjs`).
// The package is re-exported untouched except for a cache around `visualizeAudio`.
import {visualizeAudio as original} from '@banger/media-utils-original';
import {cacheVisualizer} from './visualizer-cache';

export * from '@banger/media-utils-original';
export const visualizeAudio = cacheVisualizer(original);
