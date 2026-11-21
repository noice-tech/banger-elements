import {SceneComposition, type ElementRegistry} from './SceneComposition';
import {sceneElements} from './elements';
import {buildScene, initialState, type SceneState} from './model';
import {sceneById} from './scenes';

// The scene posters are stills of this composition. Renders import every element up front.
export const SceneVideo = ({id, state}: {id: string; state?: Partial<SceneState>}) => {
	const spec = sceneById(id);
	return (
		<SceneComposition
			scene={buildScene(spec, {...initialState(spec), ...state})}
			elements={sceneElements as unknown as ElementRegistry}
		/>
	);
};
