import {Composition} from 'remotion';
import {New} from './New';
export const Root = () => (
	<>
		<Composition
			id="New"
			component={New}
			durationInFrames={150}
			fps={60}
			width={1920}
			height={1080}
		/>
	</>
);
