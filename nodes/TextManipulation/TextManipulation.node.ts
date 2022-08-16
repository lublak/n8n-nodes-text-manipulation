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
import { BINARY_ENCODING, IExecuteFunctions } from 'n8n-core';
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
 * @returns {string}       — Returns the trimmed string.
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
 * @returns {string}       — Returns the trimmed string.
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
 * @returns {string}       — Returns the trimmed string.
 */
function charsTrim(str: string, chars: string) {
  if (chars === ' ') return str.trim();
  chars = escapeRegExp(chars);
  return str.replace(new RegExp('^(' + chars + ')+|(' + chars + ')+$', 'g'), '');
}

/**
 * A node which allows you to manipulate string values.
 */
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
      color: '#772244',
    },
    inputs: ['main'],
    outputs: ['main'],
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
                name: 'dataSources',
                displayName: 'Data Sources',
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
                    name: 'dataSource',
                    displayName: 'Data Source',
                    values: [
                      {
                        displayName: 'Add BOM',
                        name: 'fileAddBOM',
                        type: 'boolean',
                        default: false,
                        displayOptions: {
                          show: {
                            writeOperation: ['toFile'],
                            fileEncodeWith: bomAware,
                          },
                        },
                      },
                      {
                        displayName: 'Binary Property',
                        name: 'binaryPropertyName',
                        required: true,
                        type: 'string',
                        default: 'data',
                        description:
                          'Name of the binary property from which the binary data is to be read',
                        displayOptions: {
                          show: {
                            readOperation: ['fromFile'],
                          },
                        },
                      },
                      {
                        displayName: 'Decode With',
                        name: 'fileDecodeWith',
                        type: 'options',
                        options: encodeDecodeOptions,
                        default: 'utf8',
                        displayOptions: {
                          show: {
                            readOperation: ['fromFile'],
                          },
                        },
                      },
                      {
                        displayName: 'Destination Binary Property',
                        name: 'destinationBinaryPropertyName',
                        required: true,
                        type: 'string',
                        default: 'data',
                        description:
                          'Name of the binary property where the binary data should be written',
                        displayOptions: {
                          show: {
                            writeOperation: ['toFile'],
                          },
                        },
                      },
                      {
                        displayName: 'Destination Key',
                        name: 'destinationKey',
                        type: 'string',
                        default: 'data',
                        required: true,
                        placeholder: 'data',
                        description:
                          "The name the JSON key to copy data to. It is also possible&lt;br\t/&gt;to define deep keys by using dot-notation like for example:&lt;br\t/&gt;'level1.level2.newKey'.",
                        displayOptions: {
                          show: {
                            writeOperation: ['toJSON'],
                          },
                        },
                      },
                      {
                        displayName: 'Encode With',
                        name: 'fileEncodeWith',
                        type: 'options',
                        options: encodeDecodeOptions,
                        default: 'utf8',
                        displayOptions: {
                          show: {
                            writeOperation: ['toFile'],
                          },
                        },
                      },
                      {
                        displayName: 'File Name',
                        name: 'fileName',
                        type: 'string',
                        default: '',
                        placeholder: 'example.txt',
                        description: 'The file name to set',
                        displayOptions: {
                          show: {
                            writeOperation: ['toFile'],
                          },
                        },
                      },
                      {
                        displayName: 'Get Manipulated Data',
                        name: 'getManipulatedData',
                        required: true,
                        type: 'boolean',
                        default: false,
                        description:
                          'Whether to use the newly manipulated data instead of the raw data. If none are available, raw data is used.',
                        displayOptions: {
                          show: {
                            readOperation: ['fromFile', 'fromJSON'],
                          },
                        },
                      },
                      {
                        displayName: 'Mime Type',
                        name: 'mimeType',
                        type: 'string',
                        default: 'text/plain',
                        placeholder: 'text/plain',
                        description:
                          'The mime-type to set. By default will the mime-type for plan text be set.',
                        displayOptions: {
                          show: {
                            writeOperation: ['toFile'],
                          },
                        },
                      },
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
                        displayName: 'Skip Non-String',
                        name: 'skipNonString',
                        required: true,
                        type: 'boolean',
                        default: true,
                        description:
                          'Whether to skip non-string data. If they are not skipped, they are automatically converted to a string.',
                        displayOptions: {
                          show: {
                            readOperation: ['fromJSON'],
                          },
                        },
                      },
                      {
                        displayName: 'Source Key',
                        name: 'sourceKey',
                        required: true,
                        type: 'string',
                        default: 'data',
                        description:
                          "The name of the JSON key to get data from.&lt;br\t/&gt;It is also possible to define deep keys by using dot-notation like for example:&lt;br\t/&gt;'level1.level2.currentKey'",
                        displayOptions: {
                          show: {
                            readOperation: ['fromJSON'],
                          },
                        },
                      },
                      {
                        displayName: 'Strip BOM',
                        name: 'fileStripBOM',
                        type: 'boolean',
                        default: true,
                        displayOptions: {
                          show: {
                            readOperation: ['fromFile'],
                            fileDecodeWith: bomAware,
                          },
                        },
                      },
                      {
                        displayName: 'Text',
                        name: 'text',
                        required: true,
                        type: 'string',
                        default: '',
                        description: 'Plain text',
                        displayOptions: {
                          show: {
                            readOperation: ['fromText'],
                          },
                        },
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
                            description: 'Decode and Encode HTML\t&\tXML entities',
                            action: 'Decode and encode html xml entities',
                          },
                          {
                            name: 'Letter Case',
                            value: 'letterCase',
                            description: 'Upper and lowercase letters in a string',
                            action: 'Upper and lowercase letters in a string',
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
                        displayName: 'Add BOM',
                        name: 'addBOM',
                        type: 'boolean',
                        default: false,
                        displayOptions: {
                          show: {
                            action: ['decodeEncode'],
                            encodeWith: bomAware,
                          },
                        },
                      },
                      {
                        displayName: 'After',
                        name: 'after',
                        type: 'string',
                        default: '',
                        description: 'String to be added at the end',
                        displayOptions: {
                          show: {
                            action: ['concat'],
                          },
                        },
                      },
                      {
                        displayName: 'Before',
                        name: 'before',
                        type: 'string',
                        default: '',
                        description: 'String to be added at the beginning',
                        displayOptions: {
                          show: {
                            action: ['concat'],
                          },
                        },
                      },
                      {
                        displayName: 'Case Type',
                        name: 'caseType',
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
                        displayOptions: {
                          show: {
                            action: ['letterCase'],
                          },
                        },
                      },
                      {
                        displayName: 'Decode Mode',
                        name: 'entitiesDecodeMode',
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
                        displayOptions: {
                          show: {
                            action: ['decodeEncodeEntities'],
                            decodeWithEntities: ['xml', 'html'],
                          },
                        },
                      },
                      {
                        displayName: 'Decode With',
                        name: 'decodeWith',
                        type: 'options',
                        options: encodeDecodeOptions,
                        default: 'utf8',
                        displayOptions: {
                          show: {
                            action: ['decodeEncode'],
                          },
                        },
                      },
                      {
                        displayName: 'Decode With',
                        name: 'decodeWithEntities',
                        type: 'options',
                        options: [
                          {
                            name: 'Nothing',
                            value: 'nothing',
                          },
                          {
                            name: 'Url',
                            value: 'url',
                          },
                          {
                            name: 'Xml',
                            value: 'xml',
                          },
                          {
                            name: 'Html',
                            value: 'html',
                          },
                        ],
                        default: 'nothing',
                        displayOptions: {
                          show: {
                            action: ['decodeEncodeEntities'],
                          },
                        },
                      },
                      {
                        displayName: 'Encode Mode',
                        name: 'entitiesEncodeMode',
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
                        displayOptions: {
                          show: {
                            action: ['decodeEncodeEntities'],
                            encodeWithEntities: ['xml', 'html'],
                          },
                        },
                      },
                      {
                        displayName: 'Encode With',
                        name: 'encodeWith',
                        type: 'options',
                        options: encodeDecodeOptions,
                        default: 'utf8',
                        displayOptions: {
                          show: {
                            action: ['decodeEncode'],
                          },
                        },
                      },
                      {
                        displayName: 'Encode With',
                        name: 'encodeWithEntities',
                        type: 'options',
                        options: [
                          {
                            name: 'Nothing',
                            value: 'nothing',
                          },
                          {
                            name: 'Url',
                            value: 'url',
                          },
                          {
                            name: 'Xml',
                            value: 'xml',
                          },
                          {
                            name: 'Html',
                            value: 'html',
                          },
                        ],
                        default: 'nothing',
                        displayOptions: {
                          show: {
                            action: ['decodeEncodeEntities'],
                          },
                        },
                      },
                      {
                        displayName: 'End',
                        name: 'end',
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
                        displayOptions: {
                          show: {
                            action: ['substring'],
                          },
                        },
                      },
                      {
                        displayName: 'Language',
                        name: 'language',
                        type: 'string',
                        default: 'en',
                        required: true,
                        description: 'Change the language of the localbase method',
                        displayOptions: {
                          show: {
                            action: ['letterCase'],
                            caseType: ['localeLowerCase', 'localeUpperCase'],
                          },
                        },
                      },
                      {
                        displayName: 'Length',
                        name: 'endLength',
                        type: 'number',
                        default: 1,
                        placeholder: '1',
                        description: 'The length of the substring',
                        displayOptions: {
                          show: {
                            action: ['substring'],
                            end: ['length'],
                          },
                        },
                      },
                      {
                        displayName: 'Pad',
                        name: 'pad',
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
                        displayOptions: {
                          show: {
                            action: ['pad'],
                          },
                        },
                      },
                      {
                        displayName: 'Pad String',
                        name: 'padString',
                        type: 'string',
                        default: ' ',
                        required: true,
                        description: 'The filling string',
                        displayOptions: {
                          show: {
                            action: ['pad'],
                          },
                        },
                      },
                      {
                        displayName: 'Pattern',
                        name: 'pattern',
                        type: 'string',
                        default: '',
                        placeholder: '$&',
                        description:
                          '&lt;table&gt;&lt;tr&gt;&lt;th&gt;Pattern&lt;/th&gt;&lt;th&gt;Inserts&lt;/th&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;$$&lt;/td&gt;&lt;td&gt;Inserts a "$".&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;$&&lt;/td&gt;&lt;td&gt;Inserts the matched substring.&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;$`&lt;/td&gt;&lt;td&gt;Inserts the portion of the string that precedes the matched substring.&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;$\'&lt;/td&gt;&lt;td&gt;Inserts the portion of the string that follows the matched substring.&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;$n&lt;/td&gt;&lt;td&gt;Where n is a positive integer less than 100, inserts the nth parenthesized submatch string, provided the first argument was a RegExp object. Note that this is 1-indexed. If a group n is not present (e.g., if group is 3), it will be replaced as a literal (e.g., $3).&lt;/td&gt;&lt;/tr&gt;&lt;tr&gt;&lt;td&gt;$&lt;Name&gt;&lt;/td&gt;&lt;td&gt;Where Name is a capturing group name. If the group is not in the match, or not in the regular expression, or if a string was passed as the first argument to replace instead of a regular expression, this resolves to a literal (e.g., $&lt;Name&gt;).&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;',
                        displayOptions: {
                          show: {
                            action: ['replace'],
                            replaceMode: ['regex'],
                          },
                        },
                      },
                      {
                        displayName: 'Position',
                        name: 'endPosition',
                        type: 'number',
                        default: 1,
                        placeholder: '1',
                        description: 'The end position of the substring. Can also be negative.',
                        displayOptions: {
                          show: {
                            action: ['substring'],
                            end: ['position'],
                          },
                        },
                      },
                      {
                        displayName: 'Regex',
                        name: 'regex',
                        type: 'string',
                        default: '',
                        required: true,
                        placeholder: '.*',
                        description: 'Regular expression',
                        displayOptions: {
                          show: {
                            action: ['replace'],
                            replaceMode: ['regex'],
                          },
                        },
                      },
                      {
                        displayName: 'Replace All',
                        name: 'replaceAll',
                        type: 'boolean',
                        default: true,
                        placeholder: '',
                        description:
                          'Whether all substrings should be replaced (not only the first)',
                        displayOptions: {
                          show: {
                            action: ['replace'],
                            replaceMode: ['substring'],
                          },
                        },
                      },
                      {
                        displayName: 'Replace Mode',
                        name: 'replaceMode',
                        type: 'options',
                        options: [
                          {
                            name: 'Substring',
                            value: 'substring',
                            description: 'Replace a substring with a value',
                          },
                          {
                            name: 'Regex',
                            value: 'regex',
                            description: 'Replace regex with a pattern',
                          },
                        ],
                        default: 'substring',
                        displayOptions: {
                          show: {
                            action: ['replace'],
                          },
                        },
                      },
                      {
                        displayName: 'Start Position',
                        name: 'startPosition',
                        type: 'number',
                        default: 0,
                        placeholder: '0',
                        description:
                          'The start position (string begins with 0). Can also be negativ.',
                        displayOptions: {
                          show: {
                            action: ['substring'],
                          },
                        },
                      },
                      {
                        displayName: 'Strip BOM',
                        name: 'stripBOM',
                        type: 'boolean',
                        default: true,
                        displayOptions: {
                          show: {
                            action: ['decodeEncode'],
                            decodeWith: bomAware,
                          },
                        },
                      },
                      {
                        displayName: 'Substring',
                        name: 'substring',
                        type: 'string',
                        default: '',
                        required: true,
                        placeholder: '.*',
                        description: 'The substring to be replaced',
                        displayOptions: {
                          show: {
                            action: ['replace'],
                            replaceMode: ['substring'],
                          },
                        },
                      },
                      {
                        displayName: 'Target Length',
                        name: 'targetLength',
                        type: 'number',
                        default: 1,
                        required: true,
                        placeholder: '1',
                        description: 'The length to which the string should be padded',
                        displayOptions: {
                          show: {
                            action: ['pad'],
                          },
                        },
                      },
                      {
                        displayName: 'Times',
                        name: 'times',
                        type: 'number',
                        default: 1,
                        required: true,
                        placeholder: '1',
                        description: 'The number of times the string should be repeated',
                        displayOptions: {
                          show: {
                            action: ['repeat'],
                          },
                        },
                      },
                      {
                        displayName: 'Trim',
                        name: 'trim',
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
                        displayOptions: {
                          show: {
                            action: ['trim'],
                          },
                        },
                      },
                      {
                        displayName: 'Trim String',
                        name: 'trimString',
                        type: 'string',
                        default: ' ',
                        required: true,
                        description: 'The string to trim',
                        displayOptions: {
                          show: {
                            action: ['trim'],
                          },
                        },
                      },
                      {
                        displayName: 'Trim String as an Unit',
                        name: 'trimStringUnit',
                        type: 'boolean',
                        default: true,
                        required: true,
                        description:
                          'Whether to use the trim chain as a whole unit and not each individual character in that chain',
                        displayOptions: {
                          show: {
                            action: ['trim'],
                          },
                        },
                      },
                      {
                        displayName: 'Value',
                        name: 'value',
                        type: 'string',
                        default: '',
                        placeholder: '',
                        description: 'The value that should replace the substring',
                        displayOptions: {
                          show: {
                            action: ['replace'],
                            replaceMode: ['substring'],
                          },
                        },
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

    let keepOnlySet: boolean;
    let item: INodeExecutionData;
    let text: string;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      keepOnlySet = this.getNodeParameter('keepOnlySet', itemIndex, false) as boolean;

      item = items[itemIndex];
      let newItemJson: IDataObject = {};
      const newItemBinary: IBinaryKeyData = {};

      if (!keepOnlySet) {
        if (item.binary !== undefined) {
          Object.assign(newItemBinary, item.binary);
        }

        newItemJson = JSON.parse(JSON.stringify(item.json)) as IDataObject;
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
                  switch (manipulation.decodeWithEntitie) {
                    case 'url':
                      text = decodeURI(text);
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
              case 'replace':
                switch (manipulation.replaceMode) {
                  case 'substring':
                    if (manipulation.replaceAll) {
                      text = replaceAll(
                        text,
                        manipulation.substring as string,
                        manipulation.value as string,
                      );
                    } else {
                      text = text.replace(
                        manipulation.substring as string,
                        manipulation.value as string,
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
                        manipulation.pattern as string,
                      );
                    } else if (regexMatch.length === 1) {
                      text = text.replace(
                        new RegExp(regexMatch[1]),
                        manipulation.pattern as string,
                      );
                    } else {
                      text = text.replace(
                        new RegExp(regexMatch[1], regexMatch[2]),
                        manipulation.pattern as string,
                      );
                    }
                    break;
                  }
                  default:
                    throw new NodeOperationError(
                      this.getNode(),
                      'substring or regex are valid options',
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
                if (manipulation.targetLength == null || manipulation.targetLength < 0)
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
                    if (manipulation.endLength == null || manipulation.endLength < 0) {
                      throw new NodeOperationError(
                        this.getNode(),
                        'The Length has to be set to at least 0 or higher!',
                        { itemIndex },
                      );
                    }
                    if ((manipulation.startPosition || 0) < 0)
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
                if (manipulation.times == null || manipulation.times < 0)
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
      });
    }

    return this.prepareOutputData(returnData);
  }
}
