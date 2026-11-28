import fields from '../../../../packages/elements/dist/fields.json';
import {elementTextureFile} from './element-payloads';
import {SITE} from '../lib/site';
import {elementCategories, elements} from './elements';

type Field = {
	name: string;
	type: string;
	default: string | number | boolean | null;
	description: string | null;
	min: number | null;
	max: number | null;
	options: string[] | null;
	shownWhen: {control: string; values: string[]} | null;
};
type Element = (typeof elements)[number];

const pageUrl = (slug: string) => `${SITE}/elements/${slug}`;
const markdownUrl = (slug: string) => `${SITE}/elements/${slug}.md`;
const fillsComposition = (element: Element) => element.category === 'shaders';
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (value: string) => `\`${value}\``;
const or = (values: readonly string[]) =>
	values.length < 2
		? values.join('')
		: `${values.slice(0, -1).join(', ')} or ${values[values.length - 1]}`;

export const absoluteLinks = (markdown: string) =>
	markdown.replace(/\]\((\/[^)\s]*)\)/g, (_, href: string) => {
		const [pathname, hash = ''] = href.split('#');
		const clean = pathname!.replace(/\.html$/, '').replace(/^\/$/, '');
		return `](${SITE}${clean}${hash ? `#${hash}` : ''})`;
	});

const sizeNote = (element: Element) => {
	if (fillsComposition(element))
		return 'Fills the composition and is opaque. Pass `width` and `height` for a fixed size.';
	if (element.category === 'effects')
		return `Wraps its children in a ${element.width}×${element.height} box. Pass \`width\` and \`height\` to match your content.`;
	return `Draws in a ${element.width}×${element.height} box with a transparent background. Change \`width\` and \`height\` to resize it.`;
};

const texture = (element: Element) => {
	const file = elementTextureFile(element.slug);
	return file ? ` The texture is copied to \`${file}\`.` : '';
};

const install = (element: Element) =>
	[
		'## Install',
		'',
		'Install this Element into a composition of your Remotion project. This needs Remotion 4.0.542 or later:',
		'',
		'```sh',
		`npx remotion elements use ${pageUrl(element.slug)} --composition <composition-id> --yes`,
		'```',
		'',
		`Replace \`<composition-id>\` with the ID of the composition. The command writes \`${element.slug}.element.tsx\` next to the composition, installs the packages it imports and inserts \`<${element.name}>\` at frame 0.${element.category === 'effects' ? '' : ' It also copies the demo track to `public/banger-elements/`, so the Element plays before you set your own audio.'}${texture(element)} Add \`--dry-run\` to see the plan first.`,
		'',
		`To install by hand, download [${element.slug}.tsx](${SITE}/elements/${element.slug}.tsx), save it as \`${element.slug}.element.tsx\` and import \`{${element.name}}\` from it. Installed Elements need Remotion 4.0.536 or later. Keep every \`@remotion/*\` package on the same version as \`remotion\`.`,
	].join('\n');

const usage = (element: Element) => {
	if (element.category === 'effects')
		return [
			'## Usage',
			'',
			`${element.title} changes only its children. Move your existing Elements and text inside it, give each child the same size as the wrapper and stack them with absolute positioning.`,
			'',
			'```tsx',
			`import {${element.name}} from './${element.slug}.element';`,
			`import {Space} from './space.element';`,
			'',
			`<${element.name} width={1280} height={720}>`,
			`  <Space style={{position: 'absolute', inset: 0}} />`,
			`</${element.name}>`,
			'```',
		].join('\n');
	return [
		'## Usage',
		'',
		'Pass your track as `audioSrc`: a file from `public/` through `staticFile()`, or an HTTPS URL that allows CORS.',
		'',
		'```tsx',
		`import {staticFile} from 'remotion';`,
		`import {${element.name}} from './${element.slug}.element';`,
		'',
		`<${element.name} audioSrc={staticFile('my-track.mp3')} />`,
		'```',
		'',
		'When you stack several audio Elements on one track, set `playAudio={false}` on all but one. `inputGainDb` changes how strongly the visuals react, not the playback volume. `audioOffsetInSeconds` sets where in the track the Element starts.',
	].join('\n');
};

const formatDefault = (field: Field) => {
	if (field.default === null) return 'unset';
	if (field.default === '') return 'empty';
	return code(typeof field.default === 'string' ? `'${field.default}'` : String(field.default));
};

const rangeOf = (field: Field) => {
	if (field.options) return field.options.map((option) => code(`'${option}'`)).join(', ');
	if (field.min !== null || field.max !== null) return `${field.min ?? ''} to ${field.max ?? ''}`;
	return '';
};

const props = (element: Element) => {
	const rows = (fields as Record<string, Field[]>)[element.slug]!.map((field) => {
		const range = rangeOf(field);
		const shown = field.shownWhen
			? `Only used when \`${field.shownWhen.control}\` is ${or(field.shownWhen.values.map((value) => code(`'${value}'`)))}.`
			: '';
		const sentence = field.description?.replace(/([^.!?)])$/, '$1.') ?? '';
		const description = [sentence, shown].filter(Boolean).join(' ');
		return `| ${code(field.name)} | ${field.type} | ${formatDefault(field)} | ${cell(range)} | ${cell(description)} |`;
	});
	if (fillsComposition(element))
		rows.push(
			'| `width`, `height` | number | composition size | 16 to 3840 | Optional fixed size instead of filling the composition. |',
		);
	return [
		'## Props',
		'',
		'Every prop is optional. Studio shows these as controls when you select the Element.',
		'',
		'| Prop | Type | Default | Range or options | Description |',
		'| --- | --- | --- | --- | --- |',
		...rows,
		'',
		`It also accepts Remotion's timing and layout props, such as \`from\`, \`durationInFrames\`, \`trimBefore\` and \`style\`. Don't wrap it in another \`<Sequence>\`.`,
	].join('\n');
};

const render = (element: Element) =>
	[
		'## Before you render',
		'',
		element.limitation,
		...(element.renderer === 'WebGL2'
			? [
					'',
					'If it renders blank or reports a WebGL error, add `--gl=angle` to your render command. On a machine without a GPU, such as CI or a server, use `--gl=swangle`.',
				]
			: []),
	].join('\n');

export function elementMarkdown(element: Element) {
	const category = elementCategories.find((entry) => entry.id === element.category)!;
	return [
		`# ${element.title}`,
		'',
		element.tagline,
		'',
		`Element page: ${pageUrl(element.slug)}`,
		'',
		`- Category: ${category.title}`,
		`- Component: \`<${element.name}>\``,
		`- Renderer: ${element.renderer}`,
		`- Size: ${sizeNote(element)}`,
		`- Source: ${SITE}/elements/${element.slug}.tsx`,
		'',
		element.description,
		'',
		install(element),
		'',
		usage(element),
		'',
		props(element),
		'',
		'## Key controls',
		'',
		...element.controls.map((control) => `- ${control}`),
		'',
		render(element),
		'',
	].join('\n');
}

const list = (category: string) =>
	elements
		.filter((element) => element.category === category)
		.map((element) => `- [${element.title}](${markdownUrl(element.slug)}): ${element.tagline}`);

export function categoryMarkdown(id: string) {
	const category = elementCategories.find((entry) => entry.id === id)!;
	return [
		`# ${category.title}`,
		'',
		category.description,
		'',
		...list(id),
		'',
		`See ${SITE}/llms.txt for the whole collection and install instructions.`,
		'',
	].join('\n');
}

export function indexMarkdown() {
	return [
		'# Banger Elements',
		'',
		'> Audio-reactive visualizers, shaders and effects for Remotion. Each Element is one self-contained TSX file that installs into your Remotion project. MIT licensed.',
		'',
		'Use Banger Elements when a Remotion video should react to music or speech: audiograms, music visualizers, lyric videos, release teasers, podcast clips and stream backgrounds.',
		'',
		'- Visualizers draw the audio as shapes, spectra and particles on a transparent background.',
		'- Shaders are full-frame procedural backgrounds that react to the track. They fill the composition.',
		'- Effects (VHS, Fisheye, Wet Glass) wrap other content and do not play audio.',
		'- Pass your track as `audioSrc`, from `staticFile()` or an HTTPS URL that allows CORS. Turn on `playAudio` for only one layer.',
		'- WebGL2 Elements may need `--gl=angle` when you render, or `--gl=swangle` on a machine without a GPU.',
		'',
		'## Install',
		'',
		'Install one Element into a composition (Remotion 4.0.542 or later). Use the Element page URL, not the Markdown URL:',
		'',
		'```sh',
		`npx remotion elements use ${pageUrl('halo')} --composition <composition-id> --yes`,
		'```',
		'',
		"Add the whole collection to Remotion Studio's Browse Elements panel (Remotion 4.0.547 or later):",
		'',
		'```sh',
		`npx remotion elements add-library ${SITE}`,
		'```',
		'',
		'Installed Elements need Remotion 4.0.536 or later. Each Element document below lists its props, defaults and install command.',
		'',
		...elementCategories.flatMap((category) => [
			`## ${category.title}`,
			'',
			category.description,
			'',
			...list(category.id),
			'',
		]),
		'## Docs',
		'',
		`- [Getting started](${SITE}/getting-started.md): installing, audio setup, timing, effects and rendering`,
		`- [Examples](${SITE}/examples): finished compositions built from the collection, with their code`,
		`- [Source on GitHub](https://github.com/noice-tech/banger-elements)`,
		'',
	].join('\n');
}
