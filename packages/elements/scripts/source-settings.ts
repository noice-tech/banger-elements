import ts from 'typescript';

type SourceSetting = {start: number; end: number; value: unknown};

const unwrap = (expression: ts.Expression) => {
	while (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))
		expression = expression.expression;
	return expression;
};

const keywords = new Map<string, unknown>([
	['true', true],
	['false', false],
	['undefined', null],
]);

function defaultValue(expression: ts.Expression, file: ts.SourceFile) {
	if (ts.isStringLiteral(expression)) return expression.text;
	const text = expression.getText(file);
	if (keywords.has(text)) return keywords.get(text);
	const value = Number(text);
	if (!Number.isFinite(value)) throw new Error(`Unsupported default: ${text}`);
	return value;
}

export function sourceSettings(source: string) {
	const file = ts.createSourceFile(
		'element.tsx',
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const constants = new Map<string, ts.Expression>();
	const settings: Record<string, SourceSetting> = {};
	const visit = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			constants.set(node.name.text, node.initializer);
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	const resolve = (expression: ts.Expression) => {
		const unwrapped = unwrap(expression);
		return ts.isIdentifier(unwrapped)
			? unwrap(constants.get(unwrapped.text) ?? unwrapped)
			: unwrapped;
	};
	const property = (object: ts.ObjectLiteralExpression, name: string) => {
		const found = object.properties.find(
			(p) => ts.isPropertyAssignment(p) && p.name.getText(file) === name,
		);
		return found && ts.isPropertyAssignment(found) ? found : null;
	};
	const readSchema = (schema: ts.ObjectLiteralExpression) => {
		for (const prop of schema.properties) {
			if (!ts.isPropertyAssignment(prop)) continue;
			const field = resolve(prop.initializer);
			if (!ts.isObjectLiteralExpression(field)) continue;
			const variants = property(field, 'variants');
			if (variants && ts.isObjectLiteralExpression(variants.initializer)) {
				for (const variant of variants.initializer.properties) {
					if (!ts.isPropertyAssignment(variant)) continue;
					const nested = resolve(variant.initializer);
					if (ts.isObjectLiteralExpression(nested)) readSchema(nested);
				}
			}
			const def = property(field, 'default');
			if (!def) continue;
			const expression = ts.isIdentifier(def.initializer)
				? (constants.get(def.initializer.text) ?? def.initializer)
				: def.initializer;
			const value = defaultValue(expression, file);
			const key = prop.name.getText(file).replace(/^['"]|['"]$/g, '');
			const setting = {start: expression.getStart(file), end: expression.end, value};
			const existing = settings[key];
			if (existing && (existing.start !== setting.start || existing.end !== setting.end))
				throw new Error(`${key} has more than one default in the source`);
			settings[key] = setting;
		}
	};
	const scan = (node: ts.Node) => {
		if (
			ts.isVariableDeclaration(node) &&
			ts.isIdentifier(node.name) &&
			node.name.text.endsWith('Schema') &&
			node.initializer
		) {
			const schema = unwrap(node.initializer);
			if (ts.isObjectLiteralExpression(schema)) readSchema(schema);
		}
		ts.forEachChild(node, scan);
	};
	scan(file);
	return settings;
}
