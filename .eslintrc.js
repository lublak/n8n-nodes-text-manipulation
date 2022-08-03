module.exports = {
	root: true,

	env: {
		browser: true,
		es6: true,
		node: true,
	},

	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: [
		'.eslintrc.js',
		'**/*.js',
		'**/node_modules/**',
		'**/dist/**',
	],

  settings: {
    jsdoc: {
        mode: 'typescript',
        structuredTags: {
            type: {
                type: true,
                required: ['type']
            }
        },
        ignoreInternal: true
    }
  },

	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
			}
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
				'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
				'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
				'n8n-nodes-base/node-execute-block-operation-missing-singular-pairing': 'off',
				'n8n-nodes-base/node-execute-block-operation-missing-plural-pairing': 'off',
			},
		},
    {
      files: ['./credentials/**/*.ts', './nodes/**/*.ts'],
			plugins: ['@typescript-eslint', 'deprecation', 'jsdoc'],
			extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
      rules: {
        'indent': [
            'error',
            'tab'
        ],
        'linebreak-style': [
            'error',
            'unix'
        ],
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ],
        'no-empty': [
            'error',
            {
                'allowEmptyCatch': true
            }
        ],
        'no-console': 'error',
        'deprecation/deprecation': 'error',
        'comma-dangle': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                'vars': 'all',
                'args': 'after-used',
                'ignoreRestSiblings': false
            }
        ],
        '@typescript-eslint/explicit-module-boundary-types': [
            'error'
        ],
        '@typescript-eslint/ban-ts-comment': [
            'error',
            {
                'ts-expect-error': 'allow-with-description',
                'ts-ignore': 'allow-with-description',
                'ts-nocheck': false,
                'ts-check': false,
                'minimumDescriptionLength': 10
            }
        ],
        '@typescript-eslint/ban-types': [
            'error',
            {
                'types': {
                    'String': {
                    'message': 'Use string instead',
                    'fixWith': 'string'
                    },
                    'Boolean': {
                    'message': 'Use boolean instead',
                    'fixWith': 'boolean'
                    },
                    'Number': {
                    'message': 'Use number instead',
                    'fixWith': 'number'
                    },
                    'Symbol': {
                    'message': 'Use symbol instead',
                    'fixWith': 'symbol'
                    },
                    'Function': {
                    'message': 'The `Function` type accepts any function-like value.\nIt provides no type safety when calling the function, which can be a common source of bugs.\nIt also accepts things like class declarations, which will throw at runtime as they will not be called with `new`.\nIf you are expecting the function to accept certain arguments, you should explicitly define the function shape.'
                    },
                    'Object': {
                    'message': 'The `Object` type actually means "any non-nullish value", so it is marginally better than `unknown`.\n- If you want a type meaning "any object", you probably want `Record<string, unknown>` instead.\n- If you want a type meaning "any value", you probably want `unknown` instead.'
                    },
                    '{}': {
                    'message': '`{}` actually means "any non-nullish value".\n- If you want a type meaning "any object", you probably want `Record<string, unknown>` instead.\n- If you want a type meaning "any value", you probably want `unknown` instead.\n- If you want a type meaning "empty object", you probably want `Record<string, never>` instead.'
                    }
                },
                'extendDefaults': false
            }
        ],
        '@typescript-eslint/no-confusing-non-null-assertion': 'off',
        '@typescript-eslint/no-explicit-any': [
            'error',
            {
                'fixToUnknown': true
            }
        ],
        '@typescript-eslint/type-annotation-spacing': [
            'error',
            {
                'before': false,
                'after': true,
                'overrides': {
                    'arrow': {
                        'before': true,
                        'after': true
                    }
                }
            }
        ],
        '@typescript-eslint/typedef': [
            'error',
            {
                'arrowParameter': true,
                'memberVariableDeclaration': true,
                'parameter': true,
                'propertyDeclaration': true,
                'variableDeclaration': true
            }
        ],
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/func-call-spacing': [
            'error',
            'never'
        ],
        '@typescript-eslint/keyword-spacing': [
            'error',
            {
                'before': true,
                'after': true
            }
        ],
        '@typescript-eslint/space-before-function-paren': [
            'error',
            {
                'anonymous': 'always',
                'named': 'never',
                'asyncArrow': 'always'
            }
        ],
        '@typescript-eslint/comma-dangle': ['error'],
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/return-await': 'error',
        '@typescript-eslint/unified-signatures': 'error',
        '@typescript-eslint/comma-spacing': [
            'error',
            {
                'before': false,
                'after': true
            }
        ],
        'jsdoc/check-access': 'error',
        'jsdoc/check-alignment': 'error',
        'jsdoc/check-examples': 'off',
        'jsdoc/check-indentation': [
            'error',
            {
                'excludeTags': ['param']
            }
        ],
        'jsdoc/check-line-alignment': 'error',
        'jsdoc/check-param-names': 'error',
        'jsdoc/check-property-names': 'error',
        'jsdoc/check-syntax': 'error',
        'jsdoc/check-tag-names': 'error',
        'jsdoc/check-types': 'error',
        'jsdoc/check-values': 'error',
        'jsdoc/empty-tags': 'error',
        'jsdoc/implements-on-classes': 'error',
        'jsdoc/match-description': [
            'error',
            {
                'matchDescription': '^[a-zA-Z0-9_\\- /\\\\()[\\]{}=?!:.,;*+~#\'"%&<>|\n]+$',
                'contexts': [
                    'any'
                ]
            }
        ],
        'jsdoc/newline-after-description': 'error',
        'jsdoc/no-bad-blocks': 'error',
        'jsdoc/no-defaults': 'off',
        'jsdoc/no-types': 'off',
        'jsdoc/no-undefined-types': 'off',
        'jsdoc/require-description': [
            'error',
            {
                'contexts': [
                    ':not(:matches(MethodDefinition[key.name=constructor], MethodDefinition[key.name=constructor] *))'
                ]
            }
        ],
        'jsdoc/require-description-complete-sentence': 'off',
        'jsdoc/require-example': 'off',
        'jsdoc/require-file-overview': 'off',
        'jsdoc/require-hyphen-before-param-description': 'error',
        'jsdoc/require-jsdoc': [
            'error',
            {
                'publicOnly': true,
                'require': {
                    'ArrowFunctionExpression': true,
                    'ClassDeclaration': true,
                    'ClassExpression': true,
                    'FunctionDeclaration': true,
                    'FunctionExpression': true,
                    'MethodDefinition': false
                },
                'contexts': [
                    'MethodDefinition:not([accessibility=\'private\']) > FunctionExpression',
                    'ClassProperty:not([accessibility=\'private\'])',
                    'TSPropertySignature',
                    'TSInterfaceBody > TSMethodSignature',
                    'TSEnumMember'
                ]
            }
        ],
        'jsdoc/require-param': 'error',
        'jsdoc/require-param-description': 'error',
        'jsdoc/require-param-name': 'error',
        'jsdoc/require-param-type': 'error',
        'jsdoc/require-property': 'error',
        'jsdoc/require-property-description': 'error',
        'jsdoc/require-property-name': 'error',
        'jsdoc/require-property-type': 'error',
        'jsdoc/require-returns': 'error',
        'jsdoc/require-returns-check': 'error',
        'jsdoc/require-returns-description': 'error',
        'jsdoc/require-returns-type': 'error',
        'jsdoc/require-throws': 'off',
        'jsdoc/require-yields': 'error',
        'jsdoc/require-yields-check': 'error',
        'jsdoc/valid-types': 'error',
      },
    }
	],
};