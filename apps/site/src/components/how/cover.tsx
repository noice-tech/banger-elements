/*
 * The composition in the home page's "From preview to project" code window.
 * `npm run how-clip` renders it to static/how/cover.webm, the clip under the
 * code, so keep this and the snippet in src/pages/index.astro the same.
 */
import {AbsoluteFill} from 'remotion';
import {Halo, Hyperloop} from '../../../../../packages/elements/dist/components';

/** The snippet reads staticFile('track.mp3'); the clip uses the site's demo song. */
const track = 'https://cdn.banger.show/assets/banger-demo-song-min.mp3';

export const Cover = () => (
	<AbsoluteFill>
		<Hyperloop audioSrc={track} playAudio={false} />
		<AbsoluteFill>
			<Halo audioSrc={track} colorMode="rainbow" centerMode="transparent" intensity={1.2} />
		</AbsoluteFill>
	</AbsoluteFill>
);
