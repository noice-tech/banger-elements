import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const workspace = path.resolve(import.meta.dirname, "..");
const repository = path.resolve(workspace, "../..");
const dist = path.join(workspace, "dist");
const producer = path.join(repository, "packages/elements/dist");
const catalog = JSON.parse(
	await readFile(path.join(producer, "catalog.json"), "utf8"),
) as {
	slug: string;
	category: string;
}[];

test("site stages producer-owned artifacts byte-for-byte", async () => {
	for (const { slug } of catalog) {
		for (const [source, target] of [
			[`elements/${slug}.tsx`, `elements/${slug}.tsx`],
			[`payloads/${slug}.json`, `elements/${slug}.json`],
		]) {
			assert.deepEqual(
				await readFile(path.join(dist, target)),
				await readFile(path.join(producer, source)),
			);
		}
	}
});

test("every catalog entry has a downloadable detail page, poster and gallery preview", async () => {
	const overview = await readFile(path.join(dist, "index.html"), "utf8");
	for (const { slug } of catalog) {
		const html = await readFile(path.join(dist, `${slug}.html`), "utf8");
		assert.ok(
			html.includes(`/elements/${slug}.tsx`),
			`${slug}: missing download`,
		);
		assert.ok(
			html.includes(
				`https://github.com/noice-tech/banger-elements/blob/main/packages/elements/src/elements/${slug}/${slug}.tsx`,
			),
			`${slug}: missing GitHub source`,
		);
		assert.ok(
			overview.includes(`/posters/${slug}.webp`),
			`${slug}: missing gallery poster`,
		);
		assert.equal(
			(html.match(/<h1\b/g) ?? []).length,
			1,
			`${slug}: one page title`,
		);
		assert.ok(
			overview.includes(`/${slug}.html`),
			`${slug}: missing gallery link`,
		);
		assert.ok(
			overview.includes(`/previews/${slug}.webm`),
			`${slug}: missing preview`,
		);
		const poster = await readFile(path.join(dist, `posters/${slug}.webp`));
		assert.equal(poster.toString("ascii", 8, 12), "WEBP");
		const preview = await readFile(path.join(dist, `previews/${slug}.webm`));
		assert.deepEqual([...preview.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
	}
	assert.ok(
		!/<video[^>]*autoplay/.test(overview),
		"Gallery must not force autoplay",
	);
});

test("categories: gallery and sidebar group all elements without changing their URLs", async () => {
	const overview = await readFile(path.join(dist, "index.html"), "utf8");
	for (const category of ["visualizers", "shaders"]) {
		const section = new RegExp(
			`<section[^>]*aria-labelledby="${category}"[^>]*>([\\s\\S]*?)</section>`,
		).exec(overview)?.[1];
		assert.ok(section, `${category}: missing gallery section`);
		assert.ok(overview.includes(`aria-labelledby="nav-${category}"`));
		for (const entry of catalog) {
			assert.equal(
				section.includes(`href="/${entry.slug}.html"`),
				entry.category === category,
			);
		}
	}
	const trip = await readFile(path.join(dist, "trip.html"), "utf8");
	assert.ok(trip.includes('href="/#shaders"'));
});

test("static navigation, assets and fragment targets resolve without a backend", async () => {
	for (const file of (await readdir(dist)).filter((name) =>
		name.endsWith(".html"),
	)) {
		const html = await readFile(path.join(dist, file), "utf8");
		for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
			const url = new URL(match[1]!, `http://site.test/${file}`);
			if (url.origin !== "http://site.test") continue;
			let target =
				url.pathname === "/"
					? "index.html"
					: decodeURIComponent(url.pathname.slice(1));
			if (!path.extname(target)) target += ".html";
			await access(path.join(dist, target));
			if (url.hash && target.endsWith(".html")) {
				const content = await readFile(path.join(dist, target), "utf8");
				assert.ok(
					content.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
					`${file}: broken fragment ${url.href}`,
				);
			}
		}
	}
});

test("static output excludes local audio and video uploads", async () => {
	const files = await readdir(dist, { recursive: true });
	assert.ok(!files.some((file) => /\.(mp3|wav|mp4|mov|m4a)$/i.test(file)));
});
