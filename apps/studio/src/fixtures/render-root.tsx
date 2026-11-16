import {Composition, registerRoot} from 'remotion';
import {Root} from '../Root';
import {FisheyePreview} from '../../../site/src/components/preview/fisheye';
import {VhsPreview} from '../../../site/src/components/preview/vhs';
import {WetGlassPreview} from '../../../site/src/components/preview/wet-glass';
import {Cover} from '../../../site/src/components/how/cover';
import {Reel} from '../../../site/src/components/reel/reel';
import {REEL_FPS, REEL_FRAMES} from '../../../site/src/components/reel/scenes';

registerRoot(() => (
	<>
		<Root />
		<Composition
			id="WetGlass"
			component={WetGlassPreview}
			durationInFrames={960}
			fps={60}
			width={1280}
			height={720}
		/>
		<Composition
			id="Vhs"
			component={VhsPreview}
			durationInFrames={960}
			fps={60}
			width={1280}
			height={720}
		/>
		<Composition
			id="HowCover"
			component={Cover}
			durationInFrames={1500}
			fps={30}
			width={1280}
			height={720}
		/>
		<Composition
			id="Reel"
			component={Reel}
			durationInFrames={REEL_FRAMES}
			fps={REEL_FPS}
			width={1280}
			height={720}
		/>
		<Composition
			id="Fisheye"
			component={FisheyePreview}
			durationInFrames={960}
			fps={60}
			width={1280}
			height={720}
		/>
	</>
));
