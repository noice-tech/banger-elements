import {SceneComposition} from './SceneComposition';
import {buildScene, initialState} from './model';
import {sceneById} from './scenes';

/** A scene as it ships, for the render root: the posters are stills of this. */
export const SceneVideo = ({id}: {id: string}) => {
	const spec = sceneById(id);
	return <SceneComposition scene={buildScene(spec, initialState(spec))} />;
};
