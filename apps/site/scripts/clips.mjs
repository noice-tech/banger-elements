import {spawnSync} from 'node:child_process';
import {mkdirSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sceneClip, sceneTimings, tracks} from '../src/components/scenes/timing.ts';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(workspace, 'static/audio');
const source = (track) => path.join(workspace, 'static', tracks[track].asset);
mkdirSync(out, {recursive: true});

const only = process.argv[2]?.split(',');
for (const timing of sceneTimings) {
	if (only && !only.includes(timing.id)) continue;
	const clip = sceneClip(timing);
	const file = path.join(out, `${timing.id}.m4a`);
	const delay = Math.round(clip.from * 1000);
	const result = spawnSync(
		'ffmpeg',
		[
			...['-loglevel', 'error', '-y', '-ss', String(clip.from), '-t', String(clip.seconds)],
			...['-i', source(timing.track), '-vn', '-map_metadata', '-1'],
			...(delay > 0 ? ['-af', `adelay=${delay}|${delay}`] : []),
			...['-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-movflags', '+faststart', file],
		],
		{stdio: 'inherit'},
	);
	if (result.status !== 0) throw new Error(`ffmpeg failed for ${timing.id}`);
	console.log(
		`${timing.id}: ${(statSync(file).size / 1024).toFixed(0)} KB, ${clip.seconds}s of music from ${clip.from}s.`,
	);
}

const TUNER_SECONDS = 50;
const TUNER_TAIL_SECONDS = 2;
const TUNER_SLICES = 512;
if (!only || only.includes('tuner')) {
	const file = path.join(out, 'tuner.mp3');
	const encode = spawnSync(
		'ffmpeg',
		[
			...['-loglevel', 'error', '-y', '-t', String(TUNER_SECONDS + TUNER_TAIL_SECONDS)],
			...['-i', source('demo'), '-vn', '-map_metadata', '-1'],
			...['-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', file],
		],
		{stdio: 'inherit'},
	);
	if (encode.status !== 0) throw new Error('ffmpeg failed for tuner');
	const decode = spawnSync(
		'ffmpeg',
		[
			...['-loglevel', 'error', '-t', String(TUNER_SECONDS), '-i', source('demo')],
			...['-af', 'pan=mono|c0=c0', '-ar', '8000', '-f', 'f32le', '-'],
		],
		{maxBuffer: 64 * 1024 * 1024},
	);
	if (decode.status !== 0) throw new Error('ffmpeg failed for tuner levels');
	const samples = new Float32Array(
		decode.stdout.buffer,
		decode.stdout.byteOffset,
		decode.stdout.byteLength / 4,
	);
	const size = Math.floor(samples.length / TUNER_SLICES);
	const levels = Array.from({length: TUNER_SLICES}, (_, slice) => {
		let sum = 0;
		for (let i = slice * size; i < (slice + 1) * size; i++) sum += samples[i] ** 2;
		return Math.sqrt(sum / size);
	});
	const loudest = Math.max(...levels) || 1;
	writeFileSync(
		path.join(workspace, 'src/components/tuner-wave.json'),
		`${JSON.stringify(levels.map((level) => Math.round((level / loudest) * 1000) / 1000))}\n`,
	);
	console.log(
		`tuner: ${(statSync(file).size / 1024).toFixed(0)} KB, ${TUNER_SLICES} waveform slices.`,
	);
}
