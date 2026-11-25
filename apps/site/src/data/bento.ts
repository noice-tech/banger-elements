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
