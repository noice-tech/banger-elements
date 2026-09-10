import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./src/fixtures/render-root.tsx');
Config.setChromiumOpenGlRenderer('angle');
Config.setPublicDir('../../public');
Config.setStudioPort(3001);
Config.addElementLibrary({
	url: 'http://localhost:3300/index.html',
	displayName: 'banger-elements',
});
