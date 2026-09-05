import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readManifest = async (relativePath) =>
	JSON.parse(await readFile(path.join(repository, relativePath), 'utf8'));
const root = await readManifest('package.json');
const manifests = await Promise.all([
	readManifest('packages/elements/package.json'),
	readManifest('apps/site/package.json'),
	readManifest('apps/studio/package.json'),
]);

assert.equal(root.packageManager, 'bun@1.3.8');
assert.equal(process.versions.node, '24.18.1');
assert.deepEqual(root.workspaces, ['apps/*', 'packages/*']);
for (const manifest of [root, ...manifests]) assert.equal(manifest.private, true);
assert.deepEqual(
	manifests.map(({name}) => name),
	['@banger-elements/collection', '@banger-elements/site', '@banger-elements/studio'],
);
for (const consumer of manifests.slice(1)) {
	assert.equal(consumer.devDependencies['@banger-elements/collection'], 'workspace:*');
}
for (const [dependency, version] of [
	['react', '19.1.1'],
	['remotion', '4.0.520'],
]) {
	assert.equal(manifests[0].dependencies[dependency], version);
	assert.ok(manifests.every((manifest) => manifest.dependencies[dependency] === version));
}
console.log('Workspace names, graph, privacy and pinned runtime versions are aligned.');
