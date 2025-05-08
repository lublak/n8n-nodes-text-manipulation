import * as entities from 'entities';
import * as iconv from 'iconv-lite';
import {
	camelCase,
	capitalize,
	escapeRegExp,
	get,
	kebabCase,
	set,
	snakeCase,
	startCase,
	trim,
	trimEnd,
	trimStart,
} from 'lodash';
import { BINARY_ENCODING, deepCopy, IExecuteFunctions, NodeConnectionType } from 'n8n-workflow';
import {
	IBinaryData,
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	INodeParameters,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import stringStripHtml from 'string-strip-html';

iconv.encodingExists('utf8');

// Create options for bomAware and encoding
const bomAware: string[] = [];
const encodeDecodeOptions: INodePropertyOptions[] = [];
const encodings = (
	iconv as unknown as {
		encodings: Record<
			string,
			| string
			| {
				bomAware: boolean;
			}
		>;
	}
).encodings;
Object.keys(encodings).forEach((encoding) => {
	if (!(encoding.startsWith('_') || typeof encodings[encoding] === 'string')) {
		// only encodings without direct alias or internals
		if (
			(
				encodings[encoding] as {
					bomAware: boolean;
				}
			).bomAware
		) {
			bomAware.push(encoding);
		}
		encodeDecodeOptions.push({ name: encoding, value: encoding });
	}
});

/**
 * Allows to replace substrings in a string.
 *
 * @param   {string} str       - A string in which a part of the string is to be replaced.
 * @param   {string} substr    - A string that should be replaced.
 * @param   {string} newSubstr - The new string which replaces the old string.
 * @returns {string}           - String with replaced substrings.
 */
function replaceAll(str: string, substr: string, newSubstr: string) {
	return str.replace(new RegExp(escapeRegExp(substr), 'g'), newSubstr);
}

/**
 * Removes leading characters as an unit from string.
 *
 * @param   {string} str   - The string to trim.
 * @param   {string} chars - The characters to trim as a unit.
 * @returns {string}       - Returns the trimmed string.
 */
function charsTrimStart(str: string, chars: string) {
	if (chars === ' ') return str.trimStart();
	chars = escapeRegExp(chars);
	return str.replace(new RegExp('^(' + chars + ')+', 'g'), '');
}

/**
 * Removes trailing characters as an unit from string.
 *
 * @param   {string} str   - The string to trim.
 * @param   {string} chars - The characters to trim as a unit.
 * @returns {string}       - Returns the trimmed string.
 */
function charsTrimEnd(str: string, chars: string) {
	if (chars === ' ') return str.trimEnd();
	chars = escapeRegExp(chars);
	return str.replace(new RegExp('(' + chars + ')+$', 'g'), '');
}

/**
 * Removes leading and trailing characters as an unit from string.
 *
 * @param   {string} str   - The string to trim.
 * @param   {string} chars - The characters to trim as a unit.
 * @returns {string}       - Returns the trimmed string.
 */
function charsTrim(str: string, chars: string) {
	if (chars === ' ') return str.trim();
	chars = escapeRegExp(chars);
	return str.replace(new RegExp('^(' + chars + ')+|(' + chars + ')+$', 'g'), '');
}

/**
 * Escaped characters are unescaped.
 *
 * @param   {string} str - The string for which the escaped characters should be unescaped.
 * @returns {string}     - Returns string with unescaped escaped characters.
 */
function unescapeEscapedCharacters(str: string) {
	 
	const escapeCharacters: Record<string, string> = {
		'\\0': '\0',
		"\\'": "'",
		'\\"': '"',
		'\\\\': '\\',
		'\\n': '\n',
		'\\r': '\r',
		'\\v': '\v',
		'\\t': '\t',
		'\\b': '\b',
		'\\f': '\f',
	};
	 

	return str.replace(
		/(\\0|\\'|\\"|\\n|\\r|\\v|\\t|\\b|\\f)|\\u([\da-fA-F]{4})|\\x([\da-fA-F]{2})|\\u{(0*(?:10|[\da-fA-F])?[\da-fA-F]{1,4})}|\\(.)/g,
		(
			_,
			escapeCharacter,
			unicodeCharacter,
			unicodeShortCharacter,
			unicodeBracesCharacter,
			anyCharacter,
		) => {
			if (escapeCharacter) return escapeCharacters[escapeCharacter as string];
			if (anyCharacter) return anyCharacter as string;
			return String.fromCharCode(
				parseInt(
					(unicodeCharacter ?? unicodeShortCharacter ?? unicodeBracesCharacter) as string,
					16,
				),
			);
		},
	);
}

/**
 * Builds a regex string from a regex string with min and max count.
 *
 * @param   {string} base    - The regex string.
 * @param   {number} [min=0] - The minimum number of regex strings. Default is `0`
 * @param   {number} [max=0] - The maximum number of regex strings. Default is `0`
 * @returns {string}         - The new regex string with min and max.
 */
function buildRegexGroup(base: string, min = 0, max = 0): string {
	if (min) {
		if (max) {
			return `${base}{${min},${max}}`;
		} else {
			return `${base}{${min},}`;
		}
	} else if (max) {
		return `${base}{${max}}`;
	} else {
		return `${base}*`;
	}
}

/** A node which allows you to manipulate string values. */
export class TextManipulation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TextManipulation',
		name: 'textManipulation',
		icon: 'file:TextManipulation.svg',
		group: ['transform'],
		version: 1,
		description: 'Allows you to manipulate string values.',
		defaults: {
			name: 'TextManipulation',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Keep Only Set',
				name: 'keepOnlySet',
				type: 'boolean',
				default: false,
				description:
					'Whether only the values set on this node should be kept and all others removed',
			},
			{
				displayName: 'Texts with Manipulations',
				name: 'textsWithManipulations',
				placeholder: 'Add Texts Manipulations',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
					sortable: true,
				},
				description: 'The texts to manipulate',
				default: {},
				options: [
					{
						name: 'textsWithManipulationsValues',
						displayName: 'Texts with Manipulations',
						values: [
							{
								displayName: 'Data Sources',
								name: 'dataSources',
								placeholder: 'Add Data Source',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
									sortable: true,
								},
								description: 'The data sources for the manipulations',
								default: {},
								options: [
									{
										displayName: 'Data Source',
										name: 'dataSource',
										values: [
											{
												displayName: 'Read Operation',
												name: 'readOperation',
												type: 'options',
												options: [
													{
														name: 'Text',
														value: 'fromText',
														description: 'Declare text directly',
													},
													{
														name: 'Read From File',
														value: 'fromFile',
														description: 'Read text from file',
													},
													{
														name: 'Read From JSON',
														value: 'fromJSON',
														description: 'Read text from JSON',
													},
												],
												default: 'fromText',
											},
											{
												displayName: 'Binary Property',
												name: 'binaryPropertyName',
												required: true,
												displayOptions: {
													show: {
														readOperation: ['fromFile'],
													},
												},
												type: 'string',
												default: 'data',
												description:
													'Name of the binary property from which the binary data is to be read',
											},
											{
												displayName: 'Decode With',
												name: 'fileDecodeWith',
												displayOptions: {
													show: {
														readOperation: ['fromFile'],
													},
												},
												type: 'options',
												options: encodeDecodeOptions,
												default: 'utf8',
											},
											{
												displayName: 'Strip BOM',
												name: 'fileStripBOM',
												displayOptions: {
													show: {
														readOperation: ['fromFile'],
														fileDecodeWith: bomAware,
													},
												},
												type: 'boolean',
												default: true,
											},
											{
												displayName: 'Get Manipulated Data',
												name: 'getManipulatedData',
												required: true,
												displayOptions: {
													show: {
														readOperation: ['fromFile', 'fromJSON'],
													},
												},
												type: 'boolean',
												default: false,
												description:
													'Whether to use the newly manipulated data instead of the raw data. If none are available, raw data is used.',
											},
											{
												displayName: 'Source Key',
												name: 'sourceKey',
												required: true,
												displayOptions: {
													show: {
														readOperation: ['fromJSON'],
													},
												},
												type: 'string',
												default: 'data',
												description:
													'The name of the JSON key to get data from.It is also possible to define deep keys by using dot-notation like for example:"level1.level2.currentKey"',
											},
											{
												displayName: 'Skip Non-String',
												name: 'skipNonString',
												required: true,
												displayOptions: {
													show: {
														readOperation: ['fromJSON'],
													},
												},
												type: 'boolean',
												default: true,
												description:
													'Whether to skip non-string data. If they are not skipped, they are automatically converted to a string.',
											},
											{
												displayName: 'Text',
												name: 'text',
												required: true,
												displayOptions: {
													show: {
														readOperation: ['fromText'],
													},
												},
												type: 'string',
												default: '',
												description: 'Plain text',
											},
											{
												displayName: 'Write Operation',
												name: 'writeOperation',
												type: 'options',
												options: [
													{
														name: 'Write to File',
														value: 'toFile',
														description: 'Write the manipulated text to a file',
													},
													{
														name: 'Write to JSON',
														value: 'toJSON',
														description: 'Write the manipulated text to a JSON key',
													},
												],
												default: 'toJSON',
											},
											{
												displayName: 'Destination Binary Property',
												name: 'destinationBinaryPropertyName',
												required: true,
												displayOptions: {
													show: {
														writeOperation: ['toFile'],
													},
												},
												type: 'string',
												default: 'data',
												description:
													'Name of the binary property where the binary data should be written',
											},
											{
												displayName: 'Encode With',
												name: 'fileEncodeWith',
												displayOptions: {
													show: {
														writeOperation: ['toFile'],
													},
												},
												type: 'options',
												options: encodeDecodeOptions,
												default: 'utf8',
											},
											{
												displayName: 'Add BOM',
												name: 'fileAddBOM',
												displayOptions: {
													show: {
														writeOperation: ['toFile'],
														fileEncodeWith: bomAware,
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'File Name',
												name: 'fileName',
												type: 'string',
												displayOptions: {
													show: {
														writeOperation: ['toFile'],
													},
												},
												default: '',
												placeholder: 'example.txt',
												description: 'The file name to set',
											},
											{
												displayName: 'Mime Type',
												name: 'mimeType',
												type: 'string',
												displayOptions: {
													show: {
														writeOperation: ['toFile'],
													},
												},
												default: 'text/plain',
												placeholder: 'text/plain',
												description:
													'The mime-type to set. By default will the mime-type for plan text be set.',
											},
											{
												displayName: 'Destination Key',
												name: 'destinationKey',
												displayOptions: {
													show: {
														writeOperation: ['toJSON'],
													},
												},
												type: 'string',
												default: 'data',
												required: true,
												placeholder: 'data',
												description:
													'The name the JSON key to copy data to. It is also possibleto define deep keys by using dot-notation like for example:"level1.level2.newKey".',
											},
										],
									},
								],
							},
							{
								displayName: 'Manipulations',
								name: 'manipulations',
								placeholder: 'Add Manipulation',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
									sortable: true,
								},
								description: 'The manipulations for the data sources',
								default: {},
								options: [
									{
										name: 'manipulation',
										displayName: 'Manipulation',
										values: [
											{
												displayName: 'Action',
												name: 'action',
												type: 'options',
												options: [
													{
														name: 'Concat',
														value: 'concat',
														description: 'Add string to the beginning or/and end',
														action: 'Add string to the beginning or and end',
													},
													{
														name: 'Decode/Encode',
														value: 'decodeEncode',
														description: 'Decode and Encode string',
														action: 'Decode and encode string',
													},
													{
														name: 'Decode/Encode Entities',
														value: 'decodeEncodeEntities',
														description: 'Decode and Encode HTML & XML entities',
														action: 'Decode and encode html xml entities',
													},
													{
														name: 'Letter Case',
														value: 'letterCase',
														description: 'Upper and lowercase letters in a string',
														action: 'Upper and lowercase letters in a string',
													},
													{
														name: 'Normalize',
														value: 'normalize',
														description: 'Normalize a string',
														action: 'Normalize a string',
													},
													{
														name: 'Pad',
														value: 'pad',
														description: 'Pad the string at the beginning or end',
														action: 'Pad the string at the beginning or end',
													},
													{
														name: 'Repeat',
														value: 'repeat',
														description: 'Repeat the string',
														action: 'Repeat the string',
													},
													{
														name: 'Replace',
														value: 'replace',
														description: 'Replace a substring or regex',
														action: 'Replace a substring or regex',
													},
													{
														name: 'Substring',
														value: 'substring',
														description: 'Get a substring',
														action: 'Get a substring',
													},
													{
														name: 'Trim',
														value: 'trim',
														description: 'Removes characters from the beginning or/and end',
														action: 'Removes characters from the beginning or and end',
													},
												],
												default: 'letterCase',
											},
											{
												displayName: 'Normalize Form',
												name: 'normalizeForm',
												displayOptions: {
													show: {
														action: ['normalize'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'NFC',
														value: 'nfc',
														description:
															'Canonical Decomposition, followed by Canonical Composition',
													},
													{
														name: 'NFD',
														value: 'nfd',
														description: 'Canonical Decomposition',
													},
													{
														name: 'NFKC',
														value: 'nfkc',
														description:
															'Compatibility Decomposition, followed by Canonical Composition',
													},
													{
														name: 'NFKD',
														value: 'nfkd',
														description: 'Compatibility Decomposition',
													},
												],
												default: 'nfc',
											},
											{
												displayName: 'Case Type',
												name: 'caseType',
												displayOptions: {
													show: {
														action: ['letterCase'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Camel Case',
														value: 'camelCase',
														description: 'Converts string to camel case',
													},
													{
														name: 'Capitalize',
														value: 'capitalize',
														description: 'Capitalize text',
													},
													{
														name: 'Kebab Case',
														value: 'kebabCase',
														description: 'Converts string to kebab case',
													},
													{
														name: 'Locale Lower Case',
														value: 'localeLowerCase',
														description: 'Locale lower case all characters',
													},
													{
														name: 'Locale Upper Case',
														value: 'localeUpperCase',
														description: 'Locale upper case all characters',
													},
													{
														name: 'Lower Case',
														value: 'lowerCase',
														description: 'Lower case all characters',
													},
													{
														name: 'Snake Case',
														value: 'snakeCase',
														description: 'Converts string to snake case',
													},
													{
														name: 'Start Case',
														value: 'startCase',
														description: 'Converts string to start case',
													},
													{
														name: 'Titlecase',
														value: 'titlecase',
														description: 'Titlecase text',
													},
													{
														name: 'Upper Case',
														value: 'upperCase',
														description: 'Upper case all characters',
													},
												],
												default: 'lowerCase',
											},
											{
												displayName: 'Language',
												name: 'language',
												displayOptions: {
													show: {
														action: ['letterCase'],
														caseType: ['localeLowerCase', 'localeUpperCase'],
													},
												},
												type: 'string',
												default: 'en',
												required: true,
												description: 'Change the language of the localbase method',
											},
											{
												displayName: 'Before',
												name: 'before',
												displayOptions: {
													show: {
														action: ['concat'],
													},
												},
												type: 'string',
												default: '',
												description: 'String to be added at the beginning',
											},
											{
												displayName: 'After',
												name: 'after',
												displayOptions: {
													show: {
														action: ['concat'],
													},
												},
												type: 'string',
												default: '',
												description: 'String to be added at the end',
											},
											{
												displayName: 'Decode With',
												name: 'decodeWith',
												displayOptions: {
													show: {
														action: ['decodeEncode'],
													},
												},
												type: 'options',
												options: encodeDecodeOptions,
												default: 'utf8',
											},
											{
												displayName: 'Decode With',
												name: 'decodeWithEntities',
												displayOptions: {
													show: {
														action: ['decodeEncodeEntities'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Html',
														value: 'html',
													},
													{
														name: 'Nothing',
														value: 'nothing',
													},
													{
														name: 'Url',
														value: 'url',
													},
													{
														name: 'Url Component',
														value: 'urlComponent',
													},
													{
														name: 'Xml',
														value: 'xml',
													},
												],
												default: 'nothing',
											},
											{
												displayName: 'Decode Mode',
												name: 'entitiesDecodeMode',
												displayOptions: {
													show: {
														action: ['decodeEncodeEntities'],
														decodeWithEntities: ['xml', 'html'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Legacy',
														value: 'legacy',
													},
													{
														name: 'Strict',
														value: 'strict',
													},
												],
												default: 'legacy',
											},
											{
												displayName: 'Strip BOM',
												name: 'stripBOM',
												displayOptions: {
													show: {
														action: ['decodeEncode'],
														decodeWith: bomAware,
													},
												},
												type: 'boolean',
												default: true,
											},
											{
												displayName: 'Encode With',
												name: 'encodeWith',
												displayOptions: {
													show: {
														action: ['decodeEncode'],
													},
												},
												type: 'options',
												options: encodeDecodeOptions,
												default: 'utf8',
											},
											{
												displayName: 'Encode With',
												name: 'encodeWithEntities',
												displayOptions: {
													show: {
														action: ['decodeEncodeEntities'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Html',
														value: 'html',
													},
													{
														name: 'Nothing',
														value: 'nothing',
													},
													{
														name: 'Url',
														value: 'url',
													},
													{
														name: 'Url Component',
														value: 'urlComponent',
													},
													{
														name: 'Xml',
														value: 'xml',
													},
												],
												default: 'nothing',
											},
											{
												displayName: 'Encode Mode',
												name: 'entitiesEncodeMode',
												displayOptions: {
													show: {
														action: ['decodeEncodeEntities'],
														encodeWithEntities: ['xml', 'html'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Extensive',
														value: 'extensive',
													},
													{
														name: 'UTF8',
														value: 'utf8',
													},
													{
														name: 'NonAscii',
														value: 'nonAscii',
													},
												],
												default: 'extensive',
											},
											{
												displayName: 'Add BOM',
												name: 'addBOM',
												displayOptions: {
													show: {
														action: ['decodeEncode'],
														encodeWith: bomAware,
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Replace Mode',
												name: 'replaceMode',
												displayOptions: {
													show: {
														action: ['replace'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Substring',
														value: 'substring',
														description: 'Replace a substring with a value',
													},
													{
														name: 'Extended Substring',
														value: 'extendedSubstring',
														description:
															'Replace a substring including escape characters with a value',
													},
													{
														name: 'Regex',
														value: 'regex',
														description: 'Replace regex with a pattern',
													},
													{
														name: 'Predefined Rule',
														value: 'predefinedRule',
														description: 'Use a predefined rule to replace',
													},
												],
												default: 'substring',
											},
											{
												displayName: 'Regex',
												name: 'regex',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['regex'],
													},
												},
												type: 'string',
												default: '',
												required: true,
												placeholder: '.*',
												description: 'Regular expression',
											},
											{
												displayName: 'Pattern',
												name: 'pattern',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['regex'],
													},
												},
												type: 'string',
												default: '',
												placeholder: '$&',
												// eslint-disable-next-line n8n-nodes-base/node-param-description-unencoded-angle-brackets
												description:
													'<table><tr><th>Pattern</th><th>Inserts</th></tr><tr><td>$$</td><td>Inserts a "$".</td></tr><tr><td>$&</td><td>Inserts the matched substring.</td></tr><tr><td>$`</td><td>Inserts the portion of the string that precedes the matched substring.</td></tr><tr><td>$\'</td><td>Inserts the portion of the string that follows the matched substring.</td></tr><tr><td>$n</td><td>Where n is a positive integer less than 100, inserts the nth parenthesized submatch string, provided the first argument was a RegExp object. Note that this is 1-indexed. If a group n is not present (e.g., if group is 3), it will be replaced as a literal (e.g., $3).</td></tr><tr><td>$<Name></td><td>Where Name is a capturing group name. If the group is not in the match, or not in the regular expression, or if a string was passed as the first argument to replace instead of a regular expression, this resolves to a literal (e.g., $<Name>).</td></tr></table>',
											},
											{
												displayName: 'Predefined Rule',
												name: 'predefinedRule',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Tags',
														value: 'tags',
														description: 'Replace all tags',
													},
													{
														name: 'Character Groups',
														value: 'characterGroups',
														description: 'Replace all defined character groups',
													},
												],
												default: 'tags',
											},
											{
												displayName: 'Only Recognised HTML',
												name: 'onlyRecognisedHTML',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['tags'],
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Newline',
												name: 'newline',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Newline Min',
												name: 'newlineMin',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														newline: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Newline Max',
												name: 'newlineMax',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														newline: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Number',
												name: 'number',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Number Min',
												name: 'numberMin',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														number: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Number Max',
												name: 'numberMax',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														number: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Alpha',
												name: 'alpha',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Alpha Min',
												name: 'alphaMin',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														alpha: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Alpha Max',
												name: 'alphaMax',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														alpha: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Whitespace',
												name: 'whitespace',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
													},
												},
												type: 'boolean',
												default: false,
											},
											{
												displayName: 'Whitespace Min',
												name: 'whitespaceMin',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														whitespace: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Whitespace Max',
												name: 'whitespaceMax',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['predefinedRule'],
														predefinedRule: ['characterGroups'],
														whitespace: [true],
													},
												},
												type: 'number',
												default: 1,
											},
											{
												displayName: 'Substring',
												name: 'substring',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['substring', 'extendedSubstring'],
													},
												},
												type: 'string',
												default: '',
												required: true,
												placeholder: 'sub',
												description: 'The substring to be replaced',
											},
											{
												displayName: 'Value',
												name: 'value',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['substring', 'extendedSubstring', 'predefinedRule'],
													},
												},
												type: 'string',
												default: '',
												placeholder: '',
												description: 'The value that should replace the substring',
											},
											{
												displayName: 'Replace All',
												name: 'replaceAll',
												displayOptions: {
													show: {
														action: ['replace'],
														replaceMode: ['substring', 'extendedSubstring'],
													},
												},
												type: 'boolean',
												default: true,
												placeholder: '',
												description:
													'Whether all substrings should be replaced (not only the first)',
											},
											{
												displayName: 'Extended',
												name: 'extended',
												displayOptions: {
													show: {
														action: ['replace'],
													},
												},
												type: 'boolean',
												default: false,
												placeholder: '',
												description:
													'Whether all escape characters should be used for replacement (\\n, \\r, \\t, ...)',
											},
											{
												displayName: 'Trim',
												name: 'trim',
												displayOptions: {
													show: {
														action: ['trim'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Trim Both',
														value: 'trimBoth',
														description: 'Removes characters from the beginning and end',
													},
													{
														name: 'Trim Start',
														value: 'trimStart',
														description: 'Removes characters from the beginning',
													},
													{
														name: 'Trim End',
														value: 'trimEnd',
														description: 'Removes characters from the end',
													},
												],
												default: 'trimBoth',
											},
											{
												displayName: 'Trim String',
												name: 'trimString',
												displayOptions: {
													show: {
														action: ['trim'],
													},
												},
												type: 'string',
												default: ' ',
												required: true,
												description: 'The string to trim',
											},
											{
												displayName: 'Trim String as an Unit',
												name: 'trimStringUnit',
												displayOptions: {
													show: {
														action: ['trim'],
													},
												},
												type: 'boolean',
												default: true,
												required: true,
												description:
													'Whether to use the trim chain as a whole unit and not each individual character in that chain',
											},
											{
												displayName: 'Pad',
												name: 'pad',
												displayOptions: {
													show: {
														action: ['pad'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Pad Start',
														value: 'padStart',
														description: 'Pad the string at the beginning',
													},
													{
														name: 'Pad End',
														value: 'padEnd',
														description: 'Pad the string at the end',
													},
												],
												default: 'padStart',
											},
											{
												displayName: 'Target Length',
												name: 'targetLength',
												displayOptions: {
													show: {
														action: ['pad'],
													},
												},
												type: 'number',
												typeOptions: {
													minValue: 0,
												},
												default: 1,
												required: true,
												placeholder: '1',
												description: 'The length to which the string should be padded',
											},
											{
												displayName: 'Pad String',
												name: 'padString',
												displayOptions: {
													show: {
														action: ['pad'],
													},
												},
												type: 'string',
												default: ' ',
												required: true,
												description: 'The filling string',
											},
											{
												displayName: 'Start Position',
												name: 'startPosition',
												displayOptions: {
													show: {
														action: ['substring'],
													},
												},
												type: 'number',
												default: 0,
												placeholder: '0',
												description:
													'The start position (string begins with 0). Can also be negativ.',
											},
											{
												displayName: 'End',
												name: 'end',
												displayOptions: {
													show: {
														action: ['substring'],
													},
												},
												type: 'options',
												options: [
													{
														name: 'Complete',
														value: 'complete',
														description: 'Selects everything to the end',
													},
													{
														name: 'Position',
														value: 'position',
														description:
															'Selects everything up to the position (exclusive position). Can also be negative.',
													},
													{
														name: 'Length',
														value: 'length',
														description: 'The length of the selected rows',
													},
												],
												default: 'complete',
												description: 'The end of the substring',
											},
											{
												displayName: 'Position',
												name: 'endPosition',
												displayOptions: {
													show: {
														action: ['substring'],
														end: ['position'],
													},
												},
												type: 'number',
												default: 1,
												placeholder: '1',
												description: 'The end position of the substring. Can also be negative.',
											},
											{
												displayName: 'Length',
												name: 'endLength',
												displayOptions: {
													show: {
														action: ['substring'],
														end: ['length'],
													},
												},
												typeOptions: {
													minValue: 0,
												},
												type: 'number',
												default: 1,
												placeholder: '1',
												description: 'The length of the substring',
											},
											{
												displayName: 'Times',
												name: 'times',
												displayOptions: {
													show: {
														action: ['repeat'],
													},
												},
												type: 'number',
												typeOptions: {
													minValue: 0,
												},
												default: 1,
												required: true,
												placeholder: '1',
												description: 'The number of times the string should be repeated',
											},
										],
									},
								],
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		let text: string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const keepOnlySet = this.getNodeParameter('keepOnlySet', itemIndex, false) as boolean;

			const item = items[itemIndex];
			let newItemJson: IDataObject = {};
			const newItemBinary: IBinaryKeyData = {};

			if (!keepOnlySet) {
				if (item.binary !== undefined) {
					Object.assign(newItemBinary, item.binary);
				}

				newItemJson = deepCopy(item.json);
			}

			for (const textsWithManipulationsValues of (this.getNodeParameter(
				'textsWithManipulations.textsWithManipulationsValues',
				itemIndex,
				[],
			) as INodeParameters[] | null) ?? []) {
				for (const dataSource of ((textsWithManipulationsValues.dataSources as INodeParameters)
					.dataSource as INodeParameters[] | null) ?? []) {
					switch (dataSource.readOperation) {
						case 'fromFile':
							if (dataSource.getManipulatedData) {
								if (
									(newItemBinary[dataSource.binaryPropertyName as string] as
										| IBinaryData
										| undefined) === undefined
								) {
									if (
										item.binary === undefined ||
										(item.binary[dataSource.binaryPropertyName as string] as
											| IBinaryData
											| undefined) === undefined
									) {
										continue;
									}
									text = iconv.decode(
										Buffer.from(
											item.binary[dataSource.binaryPropertyName as string].data,
											BINARY_ENCODING,
										),
										dataSource.fileDecodeWith as string,
										{ stripBOM: dataSource.fileStripBOM as boolean },
									);
								} else {
									text = iconv.decode(
										Buffer.from(
											newItemBinary[dataSource.binaryPropertyName as string].data,
											BINARY_ENCODING,
										),
										dataSource.fileDecodeWith as string,
										{ stripBOM: dataSource.fileStripBOM as boolean },
									);
								}
							} else if (
								item.binary === undefined ||
								(item.binary[dataSource.binaryPropertyName as string] as
									| IBinaryData
									| undefined) === undefined
							) {
								continue;
							} else {
								text = iconv.decode(
									Buffer.from(
										item.binary[dataSource.binaryPropertyName as string].data,
										BINARY_ENCODING,
									),
									dataSource.fileDecodeWith as string,
									{ stripBOM: dataSource.fileStripBOM as boolean },
								);
							}
							break;
						case 'fromJSON': {
							const value =
								(dataSource.getManipulatedData &&
									get(newItemJson, dataSource.sourceKey as string)) ||
								get(item.json, dataSource.sourceKey as string);
							if (typeof value === 'string') {
								text = value;
							} else if (dataSource.skipNonString) {
								continue;
							} else {
								text = ((value as string | null) ?? '').toString();
							}
							break;
						}
						case 'fromText':
							text = dataSource.text as string;
							break;
						default:
							throw new NodeOperationError(
								this.getNode(),
								'fromFile, fromJSON or fromText are valid options',
								{ itemIndex },
							);
					}

					for (const manipulation of ((
						textsWithManipulationsValues.manipulations as INodeParameters
					).manipulation as INodeParameters[] | null) ?? []) {
						switch (manipulation.action) {
							case 'concat':
								text =
									((manipulation.before as string | null) ?? '') +
									text +
									((manipulation.after as string | null) ?? '');
								break;
							case 'decodeEncode':
								if (manipulation.encodeWith !== manipulation.decodeWith) {
									text = iconv
										.encode(
											iconv.decode(Buffer.from(text), manipulation.decodeWith as string, {
												addBOM: manipulation.addBOM as boolean,
											}),
											manipulation.encodeWith as string,
											{ stripBOM: manipulation.stripBOM as boolean },
										)
										.toString();
								}
								break;
							case 'decodeEncodeEntities':
								if (manipulation.encodeWithEntities !== manipulation.decodeWithEntities) {
									switch (manipulation.decodeWithEntities) {
										case 'url':
											text = decodeURI(text);
											break;
										case 'urlComponent':
											text = decodeURIComponent(text);
											break;
										case 'xml':
											switch (manipulation.entitiesDecodeMode) {
												case 'legacy':
													text = entities.decodeXML(text);
													break;
												case 'strict':
													text = entities.decodeXMLStrict(text);
													break;
												default:
													throw new NodeOperationError(
														this.getNode(),
														'legacy or strict are valid options',
														{ itemIndex },
													);
											}
											break;
										case 'html':
											switch (manipulation.entitiesDecodeMode) {
												case 'legacy':
													text = entities.decodeHTML(text);
													break;
												case 'strict':
													text = entities.decodeHTMLStrict(text);
													break;
												default:
													throw new NodeOperationError(
														this.getNode(),
														'legacy or strict are valid options',
														{ itemIndex },
													);
											}
											break;
										case 'nothing':
											break;
										default:
											throw new NodeOperationError(
												this.getNode(),
												'url, xml, html or nothing are valid options',
												{ itemIndex },
											);
									}

									switch (manipulation.encodeWithEntities) {
										case 'url':
											text = encodeURI(text);
											break;
										case 'urlComponent':
											text = encodeURIComponent(text);
											break;
										case 'xml':
											switch (manipulation.entitiesEncodeMode) {
												case 'extensive':
													text = entities.encodeXML(text);
													break;
												case 'utf8':
													text = entities.escapeUTF8(text);
													break;
												case 'nonAscii':
													text = entities.encodeXML(text);
													break;
												default:
													throw new NodeOperationError(
														this.getNode(),
														'extensive, utf8 or nonAscii are valid options',
														{ itemIndex },
													);
											}
											break;
										case 'html':
											switch (manipulation.entitiesEncodeMode) {
												case 'extensive':
													text = entities.encodeHTML(text);
													break;
												case 'utf8':
													text = entities.escapeUTF8(text);
													break;
												case 'nonAscii':
													text = entities.encodeNonAsciiHTML(text);
													break;
												default:
													throw new NodeOperationError(
														this.getNode(),
														'extensive, utf8 or nonAscii are valid options',
														{ itemIndex },
													);
											}
											break;
										case 'nothing':
											break;
										default:
											throw new NodeOperationError(
												this.getNode(),
												'url, xml, html or nothing are valid options',
												{ itemIndex },
											);
									}
								}
								break;
							case 'letterCase':
								switch (manipulation.caseType) {
									case 'camelCase':
										text = camelCase(text);
										break;
									case 'capitalize':
										text = capitalize(text);
										break;
									case 'titlecase':
										text = text.split(' ').map(capitalize).join(' ');
										break;
									case 'kebabCase':
										text = kebabCase(text);
										break;
									case 'snakeCase':
										text = snakeCase(text);
										break;
									case 'startCase':
										text = startCase(text);
										break;
									case 'upperCase':
										text = text.toUpperCase();
										break;
									case 'lowerCase':
										text = text.toLowerCase();
										break;
									case 'localeUpperCase':
										text = text.toLocaleUpperCase(manipulation.language as string);
										break;
									case 'localeLowerCase':
										text = text.toLocaleLowerCase(manipulation.language as string);
										break;
									default:
										throw new NodeOperationError(
											this.getNode(),
											'upperCase, lowerCase, capitalize, camelCase, kebabCase or snakeCase are valid options',
											{ itemIndex },
										);
								}
								break;
							case 'normalize':
								switch (manipulation.normalizeForm) {
									case 'nfc':
										text = text.normalize('NFC');
										break;
									case 'nfd':
										text = text.normalize('NFD');
										break;
									case 'nfkc':
										text = text.normalize('NFKC');
										break;
									case 'nfkd':
										text = text.normalize('NFKD');
										break;
								}
								break;
							case 'replace':
								switch (manipulation.replaceMode) {
									case 'substring':
										if (manipulation.replaceAll) {
											text = replaceAll(
												text,
												manipulation.substring as string,
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.value as string)
													: (manipulation.value as string),
											);
										} else {
											text = text.replace(
												manipulation.substring as string,
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.value as string)
													: (manipulation.value as string),
											);
										}
										break;
									case 'extendedSubstring':
										if (manipulation.replaceAll) {
											text = replaceAll(
												text,
												unescapeEscapedCharacters(manipulation.substring as string),
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.value as string)
													: (manipulation.value as string),
											);
										} else {
											text = text.replace(
												unescapeEscapedCharacters(manipulation.substring as string),
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.value as string)
													: (manipulation.value as string),
											);
										}
										break;
									case 'regex': {
										const regexMatch = (manipulation.regex as string).match(
											new RegExp('^/(.*?)/([gimusy]*)$'),
										);

										if (!regexMatch) {
											text = text.replace(
												new RegExp(manipulation.regex as string),
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.pattern as string)
													: (manipulation.pattern as string),
											);
										} else if (regexMatch.length === 1) {
											text = text.replace(
												new RegExp(regexMatch[1]),
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.pattern as string)
													: (manipulation.pattern as string),
											);
										} else {
											text = text.replace(
												new RegExp(regexMatch[1], regexMatch[2]),
												manipulation.extended
													? unescapeEscapedCharacters(manipulation.pattern as string)
													: (manipulation.pattern as string),
											);
										}
										break;
									}
									case 'predefinedRule':
										switch (manipulation.predefinedRule) {
											case 'tags': {
												const value = manipulation.extended
													? unescapeEscapedCharacters(manipulation.value as string)
													: (manipulation.value as string);
												text = stringStripHtml.stripHtml(text, {
													stripRecognisedHTMLOnly: manipulation.onlyRecognisedHTML as boolean,
													skipHtmlDecoding: true,
													cb: (obj) => {
														if (obj.deleteFrom && obj.deleteTo) {
															if (obj.tag.slashPresent)
																obj.rangesArr.push(
																	obj.deleteFrom,
																	obj.deleteTo,
																	`${value}${obj.insert ?? ''}`,
																);
															else
																obj.rangesArr.push(
																	obj.deleteFrom,
																	obj.deleteTo,
																	`${value}${obj.insert ?? ''}`,
																);
														} else obj.rangesArr.push(obj.proposedReturn);
													},
												}).result;
												break;
											}
											case 'characterGroups': {
												const groups = [];
												if (manipulation.newline)
													groups.push(
														buildRegexGroup(
															'(\\r\\n|\\r|\\n)',
															manipulation.newlineMin as number,
															manipulation.newlineMax as number,
														),
													);
												if (manipulation.number)
													groups.push(
														buildRegexGroup(
															'\\d',
															manipulation.numberMin as number,
															manipulation.numberMax as number,
														),
													);
												if (manipulation.alpha)
													groups.push(
														buildRegexGroup(
															'[a-zA-Z]',
															manipulation.alphaMin as number,
															manipulation.alphaMax as number,
														),
													);
												if (manipulation.whitespace)
													groups.push(
														buildRegexGroup(
															'\\s',
															manipulation.whitespaceMin as number,
															manipulation.whitespaceMax as number,
														),
													);
												text = text.replace(
													new RegExp(groups.join('|'), 'g'),
													manipulation.extended
														? unescapeEscapedCharacters(manipulation.value as string)
														: (manipulation.value as string),
												);
												break;
											}
											default:
												throw new NodeOperationError(
													this.getNode(),
													'tags or characterGroups are valid options',
													{ itemIndex },
												);
										}
										break;
									default:
										throw new NodeOperationError(
											this.getNode(),
											'substring, extendedSubstring, regex or predefinedRule are valid options',
											{ itemIndex },
										);
								}
								break;
							case 'trim':
								switch (manipulation.trim) {
									case 'trimBoth':
										text = manipulation.trimStringUnit
											? charsTrim(text, manipulation.trimString as string)
											: trim(text, manipulation.trimString as string);
										break;
									case 'trimStart':
										text = manipulation.trimStringUnit
											? charsTrimStart(text, manipulation.trimString as string)
											: trimStart(text, manipulation.trimString as string);
										break;
									case 'trimEnd':
										text = manipulation.trimStringUnit
											? charsTrimEnd(text, manipulation.trimString as string)
											: trimEnd(text, manipulation.trimString as string);
										break;
									default:
										throw new NodeOperationError(
											this.getNode(),
											'trimBoth, trimStart or trimEnd are valid options',
											{ itemIndex },
										);
								}
								break;
							case 'pad':
								if (manipulation.targetLength == null || (manipulation.targetLength as number) < 0)
									throw new NodeOperationError(
										this.getNode(),
										'The Target Length has to be set to at least 0 or higher!',
										{ itemIndex },
									);
								switch (manipulation.pad) {
									case 'padStart':
										text = text.padStart(
											manipulation.targetLength as number,
											manipulation.padString as string,
										);
										break;
									case 'padEnd':
										text = text.padEnd(
											manipulation.targetLength as number,
											manipulation.padString as string,
										);
										break;
									default:
										throw new NodeOperationError(
											this.getNode(),
											'padStart or padEnd are valid options',
											{ itemIndex },
										);
								}
								break;
							case 'substring':
								switch (manipulation.end) {
									case 'complete':
										text = text.substring(manipulation.startPosition as number);
										break;
									case 'position':
										text = text.substring(
											manipulation.startPosition as number,
											manipulation.endPosition as number,
										);
										break;
									case 'length':
										if (manipulation.endLength == null || (manipulation.endLength as number) < 0) {
											throw new NodeOperationError(
												this.getNode(),
												'The Length has to be set to at least 0 or higher!',
												{ itemIndex },
											);
										}
										if (((manipulation.startPosition as number | null) || 0) < 0)
											text = text.substring(
												manipulation.startPosition as number,
												text.length +
												(manipulation.startPosition as number) +
												(manipulation.endLength as number),
											);
										else
											text = text.substring(
												manipulation.startPosition as number,
												(manipulation.startPosition as number) + (manipulation.endLength as number),
											);
										break;
									default:
										throw new NodeOperationError(
											this.getNode(),
											'complete, position or length are valid options',
											{ itemIndex },
										);
								}
								break;
							case 'repeat':
								if (manipulation.times == null || (manipulation.times as number) < 0)
									throw new NodeOperationError(
										this.getNode(),
										'The Times has to be set to at least 0 or higher!',
										{ itemIndex },
									);
								text = text.repeat(manipulation.times as number);
								break;
							default:
								throw new NodeOperationError(
									this.getNode(),
									'decodeEncode, replace, trim, pad, substring or repeat are valid options',
									{ itemIndex },
								);
						}
					}
					switch (dataSource.writeOperation) {
						case 'toFile':
							newItemBinary[dataSource.destinationBinaryPropertyName as string] =
								await this.helpers.prepareBinaryData(
									iconv.encode(text, dataSource.fileEncodeWith as string, {
										addBOM: dataSource.fileAddBOM as boolean,
									}),
									dataSource.fileName as string,
									dataSource.mimeType as string,
								);
							break;
						case 'toJSON':
							set(newItemJson, dataSource.destinationKey as string, text);
							break;
						default:
							throw new NodeOperationError(this.getNode(), 'toFile or toJSON are valid options', {
								itemIndex,
							});
					}
				}
			}
			returnData.push({
				json: newItemJson,
				binary: Object.keys(newItemBinary).length === 0 ? undefined : newItemBinary,
				pairedItem: {
					item: itemIndex,
				}
			});
		}

		return this.prepareOutputData(returnData);
	}
}
