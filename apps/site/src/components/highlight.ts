const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const tokenClasses = ['tm', 'ts', 'tk', 'tc', 'tp', 'tp', 'tn', 'tf'];
const tokenPattern =
	/(\/\/.*$)|('[^']*'|"[^"]*"|`[^`]*`)|\b(import|from|export|const|return)\b|(?<=<\/?)([A-Z]\w*)|\b([a-z]\w*)(?==)|(?<=<[A-Z][^>]*\s)([a-z]\w*)(?=\s*\/?>|\s+[a-z])|\b(\d+(?:\.\d+)?|true|false)\b|\b(\w+)(?=\(| = \()/g;

export const highlightLine = (line: string) => {
	let html = '';
	let last = 0;
	for (const match of line.matchAll(tokenPattern)) {
		const group = match.slice(1).findIndex((value) => value !== undefined);
		html +=
			escapeHtml(line.slice(last, match.index)) +
			`<span class="${tokenClasses[group]}">${escapeHtml(match[0])}</span>`;
		last = match.index + match[0].length;
	}
	return html + escapeHtml(line.slice(last));
};

export const highlightCode = (code: string) => code.split('\n').map(highlightLine).join('\n');
