import {SceneComposition} from './SceneComposition';
import {buildScene, initialState, type SceneState} from './model';
import {sceneById} from './scenes';

/** A scene as it ships, for the render root: the posters are stills of this. `state` tries a tweak. */
export const SceneVideo = ({id, state}: {id: string; state?: Partial<SceneState>}) => {
	const spec = sceneById(id);
	return <SceneComposition scene={buildScene(spec, {...initialState(spec), ...state})} />;
};
