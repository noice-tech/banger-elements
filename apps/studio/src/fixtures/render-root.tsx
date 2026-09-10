import {Composition, registerRoot} from 'remotion';
import {Root} from '../Root';
import {FisheyePreview} from '../../../site/src/components/preview/fisheye';
import {VhsPreview} from '../../../site/src/components/preview/vhs';

registerRoot(() => (
	<>
		<Root />
		<Composition
			id="Vhs"
			component={VhsPreview}
			durationInFrames={960}
			fps={60}
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
