import ts from 'typescript';

// Record edit locations at build time. No TypeScript parser is sent to the browser.
export function sourceSettings(source: string) {
	const file = ts.createSourceFile(
		'element.tsx',
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const constants = new Map<string, ts.Expression>();
	const settings: Record<string, {start: number; end: number; value: unknown}> = {};
	const visit = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			constants.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	const scan = (node: ts.Node) => {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text.endsWith('Schema') &&
			node.initializer
		) {
			let schema = node.initializer;
			while (ts.isAsExpression(schema) || ts.isSatisfiesExpression(schema))
				schema = schema.expression;
			if (ts.isObjectLiteralExpression(schema)) {
				for (const prop of schema.properties) {
					if (!ts.isPropertyAssignment(prop) || !ts.isObjectLiteralExpression(prop.initializer))
						continue;
					const def = prop.initializer.properties.find(
						(p) => ts.isPropertyAssignment(p) && p.name.getText(file) === 'default',
					);
					if (!def || !ts.isPropertyAssignment(def)) continue;
					const expression = ts.isIdentifier(def.initializer)
						? (constants.get(def.initializer.text) ?? def.initializer)
						: def.initializer;
					const text = expression.getText(file);
					const value = ts.isStringLiteral(expression)
						? expression.text
						: text === 'true'
							? true
							: text === 'false'
								? false
								: text === 'undefined'
									? null
									: Number(text);
					if (typeof value === 'number' && !Number.isFinite(value))
						throw new Error(`Unsupported default: ${text}`);
					settings[prop.name.getText(file)] = {
						start: expression.getStart(file),
						end: expression.end,
						value,
					};
				}
			}
		}
		ts.forEachChild(node, scan);
	};
	scan(file);
	return settings;
}
