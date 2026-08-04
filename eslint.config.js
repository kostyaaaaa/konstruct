import base from '@konstruct/eslint-config/base';

/**
 * Root config. Covers repo-level files and any package that has not defined its
 * own `eslint.config.js`. Apps are excluded: each app owns its lint run so it
 * can add framework layers without affecting the rest of the workspace.
 */
export default [...base, { ignores: ['apps/**'] }];
