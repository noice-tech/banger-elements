export type Control<Key extends string = string> = {
	readonly key: Key;
	readonly label: string;
	readonly type: 'range' | 'number' | 'color' | 'select' | 'boolean';
	readonly min?: number;
	readonly max?: number;
	readonly step?: number;
	readonly options?: readonly {readonly value: string; readonly label: string}[];
};

export const range = <Key extends string>(
	key: Key,
	label: string,
	min: number,
	max: number,
	step: number,
): Control<Key> => ({key, label, type: 'range', min, max, step});

export const numberControl = <Key extends string>(
	key: Key,
	label: string,
	min: number,
	max: number,
	step: number,
): Control<Key> => ({key, label, type: 'number', min, max, step});

export const color = <Key extends string>(key: Key, label: string): Control<Key> => ({
	key,
	label,
	type: 'color',
});

export const select = <Key extends string>(
	key: Key,
	label: string,
	options: readonly {readonly value: string; readonly label: string}[],
): Control<Key> => ({key, label, type: 'select', options});

export const booleanControl = <Key extends string>(key: Key, label: string): Control<Key> => ({
	key,
	label,
	type: 'boolean',
});
