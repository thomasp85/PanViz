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
var fullJs = browserify(jsDir, {
	entries: ['./pangenomeClass.js'],
	outputFile: './script.js'
});

// Minify
var uglyJs = uglify(fullJs, {
	sourceMapConfig: {
		enabled: false
	}
});

// Merge the compiled styles and scripts into one output directory.
module.exports = mergeTrees([uglyJs, cssDir, htmlDir]);