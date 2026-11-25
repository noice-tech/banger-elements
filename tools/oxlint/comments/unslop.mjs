import {defineRule} from '@oxlint/plugins';
import {visitComments} from './source-comments.mjs';

const PATTERNS = [
	[/—/g, 'use a period or a comma instead of an em dash'],
	[/–/g, 'use a period, a comma, or "to" instead of an en dash'],
	[/[→←⇒↔]/g, 'spell the arrow out as a verb'],
	[/[“”‘’]/g, 'use straight quotes'],
	[
		/\b(?:additionally|crucial(?:ly)?|delv(?:e|es|ed|ing)|enduring|enhanc(?:e|es|ed|ing|ement)|foster(?:s|ed|ing)?|garner(?:s|ed)?|interplay|intricate|pivotal|showcas(?:e|es|ed|ing)|tapestry|testament|vibrant|seamless(?:ly)?)\b/gi,
		'replace it with a plain word',
	],
	[
		/\b(?:utili[sz](?:e|es|ed|ing|ation)|leverag(?:e|es|ed|ing)|facilitat(?:e|es|ed|ing)|numerous)\b/gi,
		'use the plain word ("use", "help", "many")',
	],
	[/\b(?:serves as|stands as|boasts)\b/gi, 'say "is" or "has"'],
	[
		/\b(?:in order to|due to the fact that|in the event that)\b/gi,
		'shorten it to "to", "because", or "if"',
	],
	[
		/\b(?:it is (?:important|worth) (?:to note|noting)|please note|I hope this helps|let me know)\b/gi,
		'delete the filler',
	],
	[
		/\b(?:substrate|nexus|locus|paradigm|north star|flywheel|bedrock|modality)\b/gi,
		'name the concrete thing',
	],
];

const CODE = /`[^`\n]*`|[\w./-]*\.(?:astro|css|glsl|html|js|json|md|mjs|mp3|mp4|ts|tsx|webp)\b/g;

function blankCode(value) {
	return value.replace(CODE, (code) => ' '.repeat(code.length));
}

export default defineRule({
	meta: {
		type: 'suggestion',
		docs: {description: 'Flag unslop patterns in comments, JSDoc, and GLSL comments.'},
		messages: {slop: 'Rewrite "{{match}}": {{fix}}.'},
		schema: [],
	},
	create(context) {
		return visitComments(context, (comments) => {
			for (const comment of comments) {
				const valueStart = comment.start + 2;
				for (const [pattern, fix] of PATTERNS) {
					for (const match of blankCode(comment.value).matchAll(pattern)) {
						const start = valueStart + match.index;
						context.report({
							messageId: 'slop',
							data: {match: match[0], fix},
							loc: {
								start: context.sourceCode.getLocFromIndex(start),
								end: context.sourceCode.getLocFromIndex(start + match[0].length),
							},
						});
					}
				}
			}
		});
	},
});
