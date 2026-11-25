import ts from 'typescript';

export type SchemaField = {
	readonly name: string;
	readonly type: string;
	readonly default: string | number | boolean | null;
	readonly description: string | null;
	readonly min: number | null;
	readonly max: number | null;
	readonly options: readonly string[] | null;
	/** Set for controls that Studio shows only for some values of an enum control. */
	readonly shownWhen: {readonly control: string; readonly values: readonly string[]} | null;
};

const unwrap = (expression: ts.Expression) => {
	while (
		ts.isAsExpression(expression) ||
		ts.isSatisfiesExpression(expression) ||
		ts.isParenthesizedExpression(expression)
	)
		expression = expression.expression;
	return expression;
};

export function schemaFields(source: string): SchemaField[] {
	const file = ts.createSourceFile(
		'element.tsx',
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const constants = new Map<string, ts.Expression>();
	let schema: ts.ObjectLiteralExpression | null = null;
	const visit = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			constants.set(node.name.text, node.initializer);
			const value = unwrap(node.initializer);
			if (node.name.text.endsWith('Schema') && ts.isObjectLiteralExpression(value)) schema = value;
		}
		ts.forEachChild(node, visit);
	};
	visit(file);
	if (!schema) throw new Error('No schema found');

	const resolve = (expression: ts.Expression): ts.Expression => {
		const value = unwrap(expression);
		return ts.isIdentifier(value) && constants.has(value.text)
			? resolve(constants.get(value.text)!)
			: value;
	};
	const literal = (expression: ts.Expression | undefined): string | number | boolean | null => {
		if (!expression) return null;
		const value = resolve(expression);
		if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
		if (ts.isNumericLiteral(value)) return Number(value.text);
		if (
			ts.isPrefixUnaryExpression(value) &&
			value.operator === ts.SyntaxKind.MinusToken &&
			ts.isNumericLiteral(value.operand)
		)
			return -Number(value.operand.text);
		if (value.kind === ts.SyntaxKind.TrueKeyword) return true;
		if (value.kind === ts.SyntaxKind.FalseKeyword) return false;
		return null;
	};
	const property = (object: ts.ObjectLiteralExpression, name: string) => {
		const found = object.properties.find(
			(p) => ts.isPropertyAssignment(p) && p.name.getText(file).replace(/['"]/g, '') === name,
		);
		return found && ts.isPropertyAssignment(found) ? found.initializer : undefined;
	};

	const fields = new Map<string, SchemaField>();
	const addField = (field: SchemaField) => {
		const existing = fields.get(field.name);
		if (!existing) {
			fields.set(field.name, field);
		} else if (existing.shownWhen && field.shownWhen?.control === existing.shownWhen.control) {
			fields.set(field.name, {
				...existing,
				shownWhen: {
					control: field.shownWhen.control,
					values: [...existing.shownWhen.values, ...field.shownWhen.values],
				},
			});
		}
	};
	const read = (object: ts.ObjectLiteralExpression, shownWhen: SchemaField['shownWhen']) => {
		for (const prop of object.properties) {
			if (!ts.isPropertyAssignment(prop)) continue;
			const field = resolve(prop.initializer);
			if (!ts.isObjectLiteralExpression(field)) continue;
			const name = prop.name.getText(file).replace(/['"]/g, '');
			const type = String(literal(property(field, 'type')));
			const variants = property(field, 'variants');
			const options =
				variants && ts.isObjectLiteralExpression(resolve(variants))
					? (resolve(variants) as ts.ObjectLiteralExpression).properties.map((p) =>
							p.name!.getText(file).replace(/['"]/g, ''),
						)
					: null;
			addField({
				name,
				type: type === 'asset' ? `${literal(property(field, 'assetType'))} asset` : type,
				default: literal(property(field, 'default')),
				description: literal(property(field, 'description')) as string | null,
				min: literal(property(field, 'min')) as number | null,
				max: literal(property(field, 'max')) as number | null,
				options,
				shownWhen,
			});
			if (variants) {
				const variantObject = resolve(variants);
				if (!ts.isObjectLiteralExpression(variantObject)) continue;
				for (const variant of variantObject.properties) {
					if (!ts.isPropertyAssignment(variant)) continue;
					const nested = resolve(variant.initializer);
					if (ts.isObjectLiteralExpression(nested))
						read(nested, {
							control: name,
							values: [variant.name.getText(file).replace(/['"]/g, '')],
						});
				}
			}
		}
	};
	read(schema, null);
	return [...fields.values()];
}
