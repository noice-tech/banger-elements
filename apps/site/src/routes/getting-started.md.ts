import guide from '../content/docs/getting-started.mdx?raw';
import {absoluteLinks} from '../data/markdown';

export const loader = () => {
	const [, frontmatter = '', body = ''] = guide.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
	const title = frontmatter.match(/^title:\s*(.+)$/m)?.[1] ?? 'Getting started';
	return new Response(`# ${title}\n${absoluteLinks(body)}`, {
		headers: {'Content-Type': 'text/markdown; charset=utf-8'},
	});
};
