import {useEffect, useState, type FC} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// The site's recipes ask for Geist. Renders pass --public-dir=apps/site/static,
// so load it from there before the first frame.
const fonts = [
	['Geist', 'fonts/Geist.woff2'],
	['Geist Mono', 'fonts/GeistMono.woff2'],
] as const;

const useSiteFonts = () => {
	const [handle] = useState(() => delayRender('Site fonts'));
	useEffect(() => {
		Promise.all(
			fonts.map(([family, file]) =>
				new FontFace(family, `url(${staticFile(file)})`, {weight: '100 900'})
					.load()
					.then((font) => document.fonts.add(font)),
			),
		)
			.catch(() => {
				/* Fall back to the system font. */
			})
			.finally(() => continueRender(handle));
	}, [handle]);
};

export const withSiteFonts = <P extends object>(Component: FC<P>): FC<P> => {
	const WithFonts = (props: P) => {
		useSiteFonts();
		return <Component {...props} />;
	};
	return WithFonts;
};
