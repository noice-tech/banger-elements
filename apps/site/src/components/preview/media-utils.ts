// EXTERNAL: vite.config.ts aliases @remotion/media-utils to this file to cache visualizeAudio.
import {visualizeAudio as original} from '@banger/media-utils-original';
import {cacheVisualizer} from './visualizer-cache';

export * from '@banger/media-utils-original';
export const visualizeAudio = cacheVisualizer(original);
