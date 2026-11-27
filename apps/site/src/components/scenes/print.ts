import type {BuiltScene, PropValue, SceneNode, Style} from './model';

const WIDTH = 100;

const indent = (depth: number) => '\t'.repeat(depth);
const fits = (depth: number, text: string) => depth * 2 + text.length <= WIDTH;

const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const key = (name: string) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name));
const styleValue = (value: string | number) =>
	typeof value === 'number' ? String(value) : quote(value);
const styleEntries = (style: Style) =>
	Object.entries(style).map(([name, value]) => `${key(name)}: ${styleValue(value)}`);

const attribute = (name: string, value: PropValue) => {
	if (value === true) return name;
	if (typeof value === 'object') return `${name}={${value.expr}}`;
	if (typeof value === 'string')
		return /["\\\n{}]/.test(value) ? `${name}={${quote(value)}}` : `${name}="${value}"`;
	return `${name}={${value}}`;
};

const text = (value: string) => value.replace(/[{}<>]/g, (char) => `{'${char}'}`);

const attributeLines = (attr: string | Style, depth: number): string[] => {
	if (typeof attr === 'string') return [indent(depth) + attr];
	const inline = `style={{${styleEntries(attr).join(', ')}}}`;
	if (fits(depth, inline)) return [indent(depth) + inline];
	return [
		`${indent(depth)}style={{`,
		...styleEntries(attr).map((entry) => `${indent(depth + 1)}${entry},`),
		`${indent(depth)}}}`,
	];
};

const nodeAttributes = (node: SceneNode): (string | Style)[] => {
	const attrs: (string | Style)[] = [];
	if (node.kind === 'element') {
		if (node.shared) attrs.push('{...audio}');
		if (node.playAudio) attrs.push('playAudio');
		for (const [name, value] of Object.entries(node.props)) attrs.push(attribute(name, value));
	}
	if (node.style) attrs.push(node.style);
	return attrs;
};

const printNode = (node: SceneNode | string, depth: number): string[] => {
	if (typeof node === 'string') return [indent(depth) + text(node)];
	if (node.kind === 'box' && node.tag === 'br') return [`${indent(depth)}<br />`];

	const tag = node.kind === 'element' ? node.name : node.tag;
	const attrs = nodeAttributes(node);
	const children = node.children ?? [];

	const inlineAttrs = attrs
		.map((attr) =>
			typeof attr === 'string' ? ` ${attr}` : ` style={{${styleEntries(attr).join(', ')}}}`,
		)
		.join('');
	const open = `<${tag}${inlineAttrs}`;
	const close = `</${tag}>`;

	if (children.length === 0 && fits(depth, `${open} />`)) return [`${indent(depth)}${open} />`];
	const only = children.length === 1 ? children[0] : undefined;
	if (typeof only === 'string' && fits(depth, `${open}>${text(only)}${close}`))
		return [`${indent(depth)}${open}>${text(only)}${close}`];

	const body = children.flatMap((child) => printNode(child, depth + 1));
	if (fits(depth, `${open}>`))
		return children.length === 0
			? [`${indent(depth)}${open} />`]
			: [`${indent(depth)}${open}>`, ...body, indent(depth) + close];

	const lines = [
		`${indent(depth)}<${tag}`,
		...attrs.flatMap((attr) => attributeLines(attr, depth + 1)),
	];
	if (children.length === 0) return [...lines, `${indent(depth)}/>`];
	return [...lines, `${indent(depth)}>`, ...body, indent(depth) + close];
};

export const printScene = (built: BuiltScene): string => {
	const {spec, track, start, width, height, fps, bars, durationInFrames, root} = built;
	const component = spec.timing.component;
	const names = new Map<string, string>();
	const collect = (node: SceneNode | string) => {
		if (typeof node === 'string') return;
		if (node.kind === 'element') names.set(node.slug, node.name);
		node.children?.forEach(collect);
	};
	collect(root);
	return [
		`// ${spec.about}.`,
		`// ${width} × ${height} at ${fps} fps, ${bars} bars at ${track.bpm} BPM. Put the track in public/${track.file}.`,
		...(track.credit
			? [
					`// Music: "${track.title}" by ${track.artist}, ${track.credit.license}: ${track.credit.source}`,
				]
			: []),
		`import {AbsoluteFill, staticFile} from 'remotion';`,
		...[...names]
			.sort(([, a], [, b]) => a.localeCompare(b))
			.map(([slug, name]) => `import {${name}} from './${slug}.element';`),
		'',
		`const START = ${start}; // seconds into the track`,
		`const W = ${width};`,
		`const H = ${height};`,
		'',
		`export const ${component} = ({audioSrc = staticFile('${track.file}')}: {audioSrc?: string}) => {`,
		'\tconst audio = {audioSrc, audioOffsetInSeconds: START, playAudio: false, width: W, height: H};',
		'',
		'\treturn (',
		...printNode(root, 2),
		'\t);',
		'};',
		'',
		'// Register it in src/Root.tsx, then render with --gl=angle:',
		`// <Composition id="${component}" component={${component}} durationInFrames={${durationInFrames}} fps={${fps}} width={${width}} height={${height}} />`,
	].join('\n');
};
