import {SceneComposition} from './SceneComposition';
import {buildScene, initialState, type SceneState} from './model';
import {sceneById} from './scenes';

// The scene posters are stills of this composition.
export const SceneVideo = ({id, state}: {id: string; state?: Partial<SceneState>}) => {
	const spec = sceneById(id);
	return <SceneComposition scene={buildScene(spec, {...initialState(spec), ...state})} />;
};
