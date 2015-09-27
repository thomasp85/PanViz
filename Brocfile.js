/* Brocfile.js */

// Import Broccoli plugins
var concat = require('broccoli-concat');
var uglify = require('broccoli-uglify-sourcemap');
var mergeTrees = require('broccoli-merge-trees');

// Specify the directories
var cssDir = 'css/';
var jsDir = 'js/';
var htmlDir = 'html/';

// Uglify
var fullJs = concat(jsDir, {
	inputFiles: [
		'Set.js',
		'd3.v3.js',
		'pangenomeClass.js'
	],
	outputFile: '/script.js'
});
var uglyJs = uglify(fullJs);

// Merge the compiled styles and scripts into one output directory.
module.exports = mergeTrees([uglyJs, cssDir, htmlDir]);