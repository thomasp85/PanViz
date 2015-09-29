/* Brocfile.js */

// Import Broccoli plugins
var uglify = require('broccoli-uglify-sourcemap');
var mergeTrees = require('broccoli-merge-trees');
var browserify = require('broccoli-browserify');

// Specify the directories
var cssDir = 'css';
var jsDir = 'js';
var htmlDir = 'html';

// Combine Js
jsDir = browserify(jsDir, {
	entries: ['./pangenomeClass.js'],
	outputFile: './script.js'
});

// Minify
jsDir = uglify(jsDir, {
	sourceMapConfig: {
		enabled: false
	}
});

// Merge the compiled styles and scripts into one output directory.
module.exports = mergeTrees([jsDir, cssDir, htmlDir]);