/**
 * Bento layout for a six-column grid, laid out in blocks of six tiles:
 *
 *   ┌───────────┬─────┐   A large feature tile, two tiles stacked beside it,
 *   │  feature  │  2  │   then a row of three. Every other block mirrors the
 *   │           ├─────┤   feature to the right. Short final blocks stretch
 *   │           │  3  │   their last tiles so the grid never ends with a hole.
 *   ├─────┬─────┼─────┤
 *   │  4  │  5  │  6  │
 *   └─────┴─────┴─────┘
 */
export function bentoClass(index: number, count: number): string {
	const block = Math.floor(index / 6);
	const position = index % 6;
	const blockSize = Math.min(6, count - block * 6);
	const mirrored = block % 2 === 1;
	switch (position) {
		case 0:
			if (blockSize === 1) return 'tile-full';
			return mirrored ? 'tile-feature tile-mirrored' : 'tile-feature';
		case 1:
			return blockSize === 2 ? 'tile-tall' : '';
		case 3:
			if (blockSize === 4) return 'tile-banner';
			return blockSize === 5 ? 'tile-half' : '';
		case 4:
			return blockSize === 5 ? 'tile-half' : '';
		default:
			return '';
	}
}
