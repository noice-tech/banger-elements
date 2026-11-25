import {defineRule} from '@oxlint/plugins';
import {visitComments} from './source-comments.mjs';

const DIRECTIVE =
	/^\s*(?:eslint-disable|eslint-enable|oxlint-disable|oxlint-enable|@ts-expect-error|@ts-ignore|@ts-nocheck|prettier-ignore|oxfmt-ignore|@vite-ignore\b|webpackIgnore\b|[#@]__PURE__|\/\s*<reference\s)/;
const LANGUAGE_TAG = /^\s*(?:glsl|wgsl|html|css)\s*$/;
const EXTERNAL = /^\s*EXTERNAL:[^\n]{1,100}$/;
const LICENSE = /\bCopyright\b|SPDX-License-Identifier|@license\b|^\s*(?:Auto-)?[Gg]enerated by\b/;
const SOURCE_LINK = /^\s*(?:[A-Za-z][\w ]{0,30}:\s*)?https?:\/\/\S+\s*$/;

function allowed(comment) {
	if (comment.kind === 'Shebang' || comment.jsdoc) return true;
	return [DIRECTIVE, LANGUAGE_TAG, EXTERNAL, LICENSE, SOURCE_LINK].some((pattern) =>
		pattern.test(comment.value.trimEnd()),
	);
}

export default defineRule({
	meta: {
		type: 'suggestion',
		docs: {
			description:
				'Ban comments except tool directives, JSDoc on exports, one-line EXTERNAL notes, source links, and license headers. GLSL template strings follow the same rule.',
		},
		messages: {
			noComment:
				'Delete this comment. Make the code say it through names, types, or structure. JSDoc belongs only on exports. A trap forced by a dependency, platform, or protocol may stay as a one-line `EXTERNAL:` note of at most 100 characters.',
		},
		schema: [],
	},
	create(context) {
		return visitComments(context, (comments) => {
			let licenseLineEnd = -1;
			let previousGlsl = false;
			for (const comment of comments) {
				const line = context.sourceCode.getLocFromIndex(comment.start).line;
				const licenseContinuation =
					comment.kind === 'Line' && line === licenseLineEnd + 1 && comment.glsl === previousGlsl;
				const ok = licenseContinuation || allowed(comment);
				const license = licenseContinuation || LICENSE.test(comment.value);
				licenseLineEnd = ok && license && comment.kind === 'Line' ? line : -1;
				previousGlsl = comment.glsl;
				if (!ok) {
					context.report({
						messageId: 'noComment',
						loc: {
							start: context.sourceCode.getLocFromIndex(comment.start),
							end: context.sourceCode.getLocFromIndex(comment.end),
						},
					});
				}
			}
		});
	},
});
