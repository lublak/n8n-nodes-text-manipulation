<p align="center">
  <img width="180" height="180" src="/nodes/TextManipulation/TextManipulation.svg">
</p>

# n8n-nodes-text-manipulation

[![version](https://img.shields.io/npm/v/n8n-nodes-text-manipulation.svg)](https://www.npmjs.org/package/n8n-nodes-text-manipulation)
[![downloads](https://img.shields.io/npm/dt/n8n-nodes-text-manipulation.svg)](https://www.npmjs.org/package/n8n-nodes-text-manipulation)
[![status](https://github.com/lublak/n8n-nodes-text-manipulation/actions/workflows/node.js.yml/badge.svg)](https://github.com/lublak/n8n-nodes-text-manipulation/actions/workflows/node.js.yml)

Text manipulation allows various manipulations of strings.
Features:

- From
	- Text
	- File (Binary)
		- With decode options see icon-v (utf8, base64, utf16, etc...)
	- JSON
- To
	- Text
	- File (Binary)
		- With encode options see icon-v (utf8, base64, utf16, etc...)
	- JSON
- Get Manipulated Data (use previously manipulated)
- Skip Non-String
- Concat
	- Before
	- After
- Decode/Encode
	- see icon-v (utf8, base64, utf16, etc...)
	- with strip/add BOM
- Decode Entities
	- Url
	- Url Component
	- Xml
		- Legacy
		- Strict
	- Html
		- Legacy
		- Strict
- Encode Entities
	- Url
	- Url Component
	- Xml
		- Extensive
		- UTF8
		- NonAscii
	- Html
		- Extensive
		- UTF8
		- NonAscii
- Letter Case
	- Upper Case
	- Lower Case
	- Locale Upper Case
	- Locale Lower Case
	- Capitalize
	- Titlecase
	- Camel Case
	- Kebab Case
	- Snake Case
	- Start Case
- Replace
	- Substring
		- All
		- Extended
	- Extended Substring
		- All
		- Extended
	- Regex
		- Extended
	- Predefined Rule
		- Tags
			- Only Recognised HTML
		- Character Groups
			- Newline
				- Newline Min
				- Newline Max
			- Number
				- Number Min
				- Number Max
			- Alpha
				- Alpha Min
				- Alpha Max
			- Whitespace
				- Whitespace Min
				- Whitespace Mac
- Trim
	- Left
		- as an unit
	- Right
		- as an unit
	- Both
		- as an unit
- Pad
	- Start
	- End
- Substring
	- StartPosition
	- With
		- Complete
		- Position
		- Length
- Repeat
	- Times
- Normalize

## Install

1. Go to Settings (Cogwheel)
2. Click on "Community Nodes"
3. Enter "n8n-nodes-text-manipulation" into the text box
4. Click on "I understand the risk ..."
5. Click on "Install"