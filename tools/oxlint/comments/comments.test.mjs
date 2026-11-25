import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');
const oxlint = join(here, '../../../node_modules/.bin/oxlint');

function lint(fixture) {
	const result = spawnSync(
		oxlint,
		['--config', join(here, 'fixtures.json'), '--format', 'json', join(fixtures, fixture)],
		{encoding: 'utf8'},
	);
	assert.ok(result.stdout, result.stderr);
	return JSON.parse(result.stdout).diagnostics.map((diagnostic) => ({
		rule: diagnostic.code,
		line: diagnostic.labels[0].span.line,
		text: diagnostic.message,
	}));
}

test('no-comments keeps directives, one-line EXTERNAL notes, source links, licenses and JSDoc on exports', () => {
	const reported = lint('no-comments.tsx').filter(({rule}) => rule === 'comments(no-comments)');
	assert.deepEqual(
		reported.map(({line}) => line),
		[8, 9, 11, 17, 26, 35, 44, 47, 53, 65],
	);
});

test('unslop flags dashes, arrows, curly quotes and listed words, but not code or file names', () => {
	const reported = lint('unslop.ts')
		.filter(({rule}) => rule === 'comments(unslop)')
		.map(({line, text}) => `${line} ${text}`);
	assert.deepEqual(reported, [
		'2 Rewrite "–": use a period, a comma, or "to" instead of an en dash.',
		'3 Rewrite "—": use a period or a comma instead of an em dash.',
		'3 Rewrite "→": spell the arrow out as a verb.',
		'3 Rewrite "seamless": replace it with a plain word.',
		'6 Rewrite "“": use straight quotes.',
		'6 Rewrite "”": use straight quotes.',
		'6 Rewrite "utilize": use the plain word ("use", "help", "many").',
		'6 Rewrite "In order to": shorten it to "to", "because", or "if".',
		'11 Rewrite "Vibrant": replace it with a plain word.',
	]);
});
