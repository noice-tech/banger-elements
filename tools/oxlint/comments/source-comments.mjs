const GLSL =
	/\b(?:uniform|varying|precision\s+(?:high|medium|low)p|gl_FragColor|gl_Position)\b|#version\b|\b(?:void|float|int|bool|[biu]?vec[234]|mat[234])\s+\w+\s*\([^)]*\)\s*\{/;

const EXPORTS = new Set(['ExportDefaultDeclaration', 'ExportNamedDeclaration']);
const MEMBERS = new Set([
	'MethodDefinition',
	'Property',
	'PropertyDefinition',
	'TSEnumMember',
	'TSMethodSignature',
	'TSPropertySignature',
]);
const FUNCTIONS = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression']);

function exported(member) {
	for (let node = member.parent; node; node = node.parent) {
		if (EXPORTS.has(node.type)) return true;
		if (FUNCTIONS.has(node.type)) return false;
	}
	return false;
}

function glslComments(raw, offset) {
	const comments = [];
	let index = 0;
	while (index < raw.length) {
		if (raw.startsWith('//', index)) {
			const lineEnd = raw.indexOf('\n', index);
			const end = lineEnd === -1 ? raw.length : lineEnd;
			comments.push({
				kind: 'Line',
				value: raw.slice(index + 2, end),
				start: offset + index,
				end: offset + end,
			});
			index = end;
		} else if (raw.startsWith('/*', index)) {
			const close = raw.indexOf('*/', index + 2);
			const end = close === -1 ? raw.length : close + 2;
			const value = raw.slice(index + 2, close === -1 ? raw.length : close);
			comments.push({kind: 'Block', value, start: offset + index, end: offset + end});
			index = end;
		} else {
			index += 1;
		}
	}
	return comments;
}

function documentsDeclaration(sourceCode, comment, commentEnds) {
	const {text} = sourceCode;
	let index = comment.end;
	for (;;) {
		while (index < text.length && /\s/.test(text[index])) index += 1;
		const next = commentEnds.get(index);
		if (next === undefined) break;
		index = next;
	}
	for (
		let node = sourceCode.getNodeByRangeIndex(index);
		node && node.start === index;
		node = node.parent
	) {
		if (EXPORTS.has(node.type)) return true;
		if (MEMBERS.has(node.type)) return exported(node);
	}
	return false;
}

/**
 * Builds a visitor that calls `check` once per file with every comment in it: JS comments and the
 * `//` and `/* *\/` comments inside template literals that hold GLSL. Comments come sorted by
 * position. `jsdoc` is true for a `/** *\/` comment directly above an export, or above a member of an
 * exported type, class, or object.
 */
export function visitComments(context, check) {
	const {sourceCode} = context;
	const shaderComments = [];
	return {
		TemplateLiteral(node) {
			if (!GLSL.test(node.quasis.map((quasi) => quasi.value.raw).join(''))) return;
			for (const quasi of node.quasis) {
				const offset = sourceCode.text.indexOf(quasi.value.raw, quasi.start);
				for (const comment of glslComments(quasi.value.raw, offset)) {
					shaderComments.push({...comment, glsl: true, jsdoc: false});
				}
			}
		},
		'Program:exit'() {
			const jsComments = sourceCode.getAllComments();
			const commentEnds = new Map(jsComments.map((comment) => [comment.start, comment.end]));
			const comments = jsComments.map((comment) => ({
				kind: comment.type,
				value: comment.value,
				start: comment.start,
				end: comment.end,
				glsl: false,
				jsdoc:
					comment.type === 'Block' &&
					comment.value.startsWith('*') &&
					documentsDeclaration(sourceCode, comment, commentEnds),
			}));
			check([...comments, ...shaderComments].sort((a, b) => a.start - b.start));
		},
	};
}
