import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./src/fixtures/render-root.tsx');
Config.setPublicDir('../../public');
Config.addElementLibrary({
	url: 'http://localhost:3300/index.html',
	displayName: 'banger-elements',
});
