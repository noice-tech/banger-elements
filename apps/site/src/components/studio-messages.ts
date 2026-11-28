import type {
	AddElementLibraryToStudioErrorCode,
	InstallInStudioErrorCode,
} from '@remotion/studio-protocol';

export const nextStep: Partial<
	Record<InstallInStudioErrorCode | AddElementLibraryToStudioErrorCode, string>
> = {
	'no-compatible-studio': 'Start Remotion Studio on a port between 3000 and 3009, then try again.',
	'no-installable-target': 'Focus the Remotion Studio tab to install into, then try again.',
	'no-configurable-target': 'Focus the Remotion Studio tab to add the library to, then try again.',
	'no-config-file': 'Add a remotion.config.ts file to your project, then try again.',
	'studio-upgrade-required':
		'Upgrade Remotion in your project with npx remotion upgrade, then try again.',
	'loopback-network-permission-denied':
		'Allow local network access for this site in your browser, then try again.',
};
