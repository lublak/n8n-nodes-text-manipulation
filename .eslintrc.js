module.exports = {
	env: {
		browser: true,
		es6: true,
		node: true,
	},
	extends: ['eslint-config-n8n-nodes-base'],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**'],

	settings: {
		jsdoc: {
			mode: 'typescript',
			structuredTags: {
				type: {
					type: true,
					required: ['type'],
				},
			},
			ignoreInternal: true,
		},
	}
};