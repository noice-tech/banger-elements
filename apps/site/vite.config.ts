import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, URL} from 'node:url';
import mdx from '@mdx-js/rollup';
import {reactRouter} from '@react-router/dev/vite';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import {defineConfig, type Plugin} from 'vite';

const mediaUtils = path.join(
	path.dirname(createRequire(import.meta.url).resolve('@remotion/media-utils/package.json')),
	'dist/esm/index.mjs',
);
const port = Number(process.env.PORT ?? 3300);
const guide = mdx({
	remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
	rehypePlugins: [rehypeSlug],
});

export default defineConfig({
	publicDir: 'static',
	plugins: [
		{
			...guide,
			enforce: 'pre',
			transform(code, id) {
				return id.includes('?') ? null : guide.transform.call(this, code, id);
			},
		} as Plugin,
		reactRouter(),
	],
	resolve: {
		alias: [
			{
				find: /^@remotion\/media-utils$/,
				replacement: fileURLToPath(
					new URL('./src/components/preview/media-utils.ts', import.meta.url),
				),
			},
			{find: '@banger/media-utils-original', replacement: mediaUtils},
		],
	},
	server: {host: '127.0.0.1', port},
	preview: {host: '127.0.0.1', port},
});
