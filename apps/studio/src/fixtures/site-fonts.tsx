import {useEffect, useState, type FC} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

// The site's recipes and scenes ask for these. Renders pass --public-dir=apps/site/static,
// so load them from there before the first frame.
const fonts = [
	['Geist', 'fonts/Geist.woff2', '100 900'],
	['Geist Mono', 'fonts/GeistMono.woff2', '100 900'],
	['Syncopate', 'fonts/Syncopate-Bold.woff2', '700'],
] as const;

const useSiteFonts = () => {
	const [handle] = useState(() => delayRender('Site fonts'));
	useEffect(() => {
		Promise.all(
			fonts.map(([family, file, weight]) =>
				new FontFace(family, `url(${staticFile(file)})`, {weight})
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
