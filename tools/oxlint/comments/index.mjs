import {definePlugin} from '@oxlint/plugins';
import noComments from './no-comments.mjs';
import unslop from './unslop.mjs';

export default definePlugin({
	meta: {name: 'comments'},
	rules: {'no-comments': noComments, unslop},
});
