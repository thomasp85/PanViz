/*jshint loopfunc:true*/

var Set = require('./Set.js');
var d3 = require('d3');

var clone = function(obj) {
	var newObj = (obj instanceof Array) ? [] : {};
	for (var i in obj) {
		if (!obj.hasOwnProperty(i)) continue;
		if (obj[i] && typeof obj[i] == "object") {
			newObj[i] = clone(obj[i]);
		} else newObj[i] = obj[i];
	}
	return newObj;
};

var union_arrays = function(x, y) {
	var obj = {};
	for (var i = x.length-1; i >= 0; -- i)
		obj[x[i]] = x[i];
	for (var j = y.length-1; j >= 0; -- j)
		obj[y[j]] = y[j];
	var res = [];
	for (var k in obj) {
		if (obj.hasOwnProperty(k))  // <-- optional
			res.push(obj[k]);
	}
	return res;
};

var copyTree = function(node, depth) {
	var accumulateGenes = function(d) {
		d.OG = d.genes.map(function(d) {return d.id;});
		if(d.children && d.children.length) {
			d.children.forEach(function(dd) {
				d.OG = union_arrays(d.OG, accumulateGenes(dd));
			});
		}
		return d.OG;
	};
	var countGenes = function(d) {
		var genes = d.genes.map(function(g) {return g.id;});
		if (d.offspring) {
			for (var i in d.offspring) {
				if (d.offspring[i].genes.length !== 0) {
					genes = genes.concat(d.offspring[i].genes.map(function(g) {return g.id;}));
				}
			}
		}
		var uniqueGenes = new Set(genes);
		return uniqueGenes.getElements();
	};
	var accumulateValues = function(d) {
        if (d.children && d.children.length) {
	        d.children.forEach(function(c) {accumulateValues(c);});
        }
        d.geneIDs = countGenes(d);
        d.value = d.geneIDs.length;
	};
	var pruneNodes = function(d) {
		if (d.children && d.children.length) {
			for (var i = d.children.length-1; i >= 0; i--) {
				if (d.children[i].value === 0) {
					d.children.splice(i, 1);
				} else {
					pruneNodes(d.children[i]);
				}
			}
			if (d.children.length === 0) {
				delete d.children;
			}
		}
	};
	
	var curDepth = 0;
	
	function copyChild(child, curDepth) {
		var nChild = {};
		for (var i in child) {
			if (i != 'children' && i != 'parent' && i != 'depth' && i != 'dx' && i != 'dy' && i != 'x' && i != 'y' ) {
				nChild[i] = child[i];
			}
		}
		if (curDepth < depth && child.children.length) {
			var children = child.children.map(function(d) {return copyChild(d, curDepth+1);}).filter(function(f) {return f;});
			if (children.length !== 0) {
				nChild.children = children;
			}
		}
		return nChild;
	}
	
	var ans = copyChild(node, curDepth);
	
	accumulateValues(ans);
	pruneNodes(ans);
	
	return ans;
	
};

var arc_rect = function(d) {
	var r0 = d.innerRadius,
		r1 = d.outerRadius,
		a0 = d.startAngle + (-Math.PI / 2),
		a1 = d.endAngle + (-Math.PI / 2),
		cx = d.cx,
		cy = d.cy,
		da = (a1 < a0 && (da = a0, a0 = a1, a1 = da), a1 - a0),
		df = da < Math.PI ? "0" : "1",
		c0 = Math.cos(a0),
		s0 = Math.sin(a0),
		c1 = Math.cos(a1),
		s1 = Math.sin(a1);
	
	return da >= 2 * Math.PI - 1e-6 ? (r0 ? 
		"M0," + r1 + 
		"A" + r1 + "," + r1 + " 0 1,1 0," + (-r1) + 
		"A" + r1 + "," + r1 + " 0 1,1 0," + r1 + 
		"M0," + r0 + 
		"A" + r0 + "," + r0 + " 0 1,0 0," + (-r0) + 
		"A" + r0 + "," + r0 + " 0 1,0 0," + r0 + 
		"Z" : 
		"M0," + r1 + 
		"A" + r1 + "," + r1 + " 0 1,1 0," + (-r1) + 
		"A" + r1 + "," + r1 + " 0 1,1 0," + r1 + 
		"Z") : 
	(r0 ? 
		"M" + (r1 * c0 + cx) + "," + (r1 * s0 + cy) + 
		"A" + r1 + "," + r1 + " 0 " + df + ",1 " + (r1 * c1 + cx) + "," + (r1 * s1 + cy) + 
		"L" + (r0 * c1 + cx) + "," + (r0 * s1 + cy) + 
		"A" + r0 + "," + r0 + " 0 " + df + ",0 " + (r0 * c0 + cx) + "," + (r0 * s0 + cy) + 
		"Z" : 
		"M" + (r1 * c0 + cx) + "," + (r1 * s0 + cy) + 
		"A" + r1 + "," + r1 + " 0 " + df + ",1 " + (r1 * c1 + cx) + "," + (r1 * s1 + cy) + 
		"L0,0" + 
		"Z");
};
var arcToRectTween = function(d, i, a){

// Compute start and end values
	var path = d3.select(this);
	var range = [d.startAngle/(Math.PI*2), d.endAngle/(Math.PI*2)];
	var totalRange = d.height/(range[1]-range[0]);
	var endRange = [89.99*Math.PI/180, 90.01*Math.PI/180];
	var endRadius = (totalRange/2)/Math.sin(0.01*Math.PI/180);
	var endCenterY = d.y-totalRange*range[0]+totalRange*0.5;
	var endCenterX = d.x-endRadius;
	var innerRadius = d.innerRadius;
	var x0 = d.x;
	var y0 = d.y;
	var height = d.height;
	var width = d.width;

// Create interpolators for the values
	var powScale = d3.scale.pow()
		.exponent(3);
	var radiusScale = function(t){
		
	};
	var ease = d3.ease('quad-in-out');
	var powScale2 = d3.scale.pow()
		.exponent(1/8);
	var angle = d3.scale.linear()
		.domain([1, 0.02/360])
		.range([0, 89.99*Math.PI/180]);
	var x = d3.interpolateNumber(innerRadius, d.x);
	var y = d3.interpolateNumber(0, endCenterY);
	var lengthInterpolate = d3.interpolateNumber(2*innerRadius*Math.PI, totalRange);
	var radiusInterpolate = d3.interpolateNumber(d.innerRadius, endRadius);
	var widthInterpolate = d3.interpolateNumber(d.outerRadius-d.innerRadius, d.width);
	var angleInterpolate = function(t, r){
		var length = lengthInterpolate(powScale2(t)*ease(t));
		var circumference = 2*r*Math.PI;
		var lTOc = length/circumference;
		var totA = 2*Math.PI*lTOc;
		return [angle(lTOc)+totA*range[0], angle(lTOc)+totA*range[1]];
	};
	
	return function(t) {
		if (t != 1 && height !== 0) {
			var	tWidth = widthInterpolate(t);
			var radius = radiusInterpolate(powScale(t)*ease(t));
			var tAngle = angleInterpolate(t, radius);
			var f = {
				'innerRadius': radius,
				'outerRadius': radius+tWidth,
				'startAngle': tAngle[0],
				'endAngle': tAngle[1],
				'cx': -radius+x(t),
				'cy': y(t)
			};
			path.attr('d', arc_rect(f));
		} else {
			var rect = 'M'+ x0 +','+ y0 +' l'+ width +','+ 0 +' l'+ 0 +','+ height +' l'+ -(width) +','+ 0 +'Z';
			path.attr('d', rect);
		}	
	};
};

var rectToArcTween = function(d, i, a){

// Compute start and end values
	var path = d3.select(this);
	var range = [d.startAngle/(Math.PI*2), d.endAngle/(Math.PI*2)];
	var totalRange = d.height/(range[1]-range[0]);
	var endRange = [89.9*Math.PI/180, 90.1*Math.PI/180];
	var endRadius = (totalRange/2)/Math.sin(0.1*Math.PI/180);
	var endCenterY = d.y-totalRange*range[0]+totalRange*0.5;
	var endCenterX = d.x-endRadius;
	var innerRadius = d.innerRadius;
	var x0 = d.x;
	var y0 = d.y;
	var height = d.height;
	var width = d.width;


// Create interpolators for the values
	var powScale = d3.scale.pow()
		.exponent(1/30000);
	var ease = d3.ease('quad-in-out');
	var powScale2 = d3.scale.pow()
		.exponent(20);
	var angle = d3.scale.linear()
		.domain([1, 0.2/360])
		.range([0, 89.9*Math.PI/180]);
	var x = d3.interpolateNumber(d.x, innerRadius);
	var y = d3.interpolateNumber(endCenterY, 0);
	var lengthInterpolate = d3.interpolateNumber(totalRange, 2*innerRadius*Math.PI);
	var radiusInterpolate = d3.interpolateNumber(endRadius, d.innerRadius);
	var widthInterpolate = d3.interpolateNumber(d.width, d.outerRadius-d.innerRadius);
	var angleInterpolate = function(t, r){
		var length = lengthInterpolate(ease(powScale2(t)));
		var circumference = 2*r*Math.PI;
		var lTOc = length/circumference;
		var totA = 2*Math.PI*lTOc;
		return [angle(lTOc)+totA*range[0], angle(lTOc)+totA*range[1]];
	};
	
	return function(t) {
		if (height !== 0) {
			var	tWidth = widthInterpolate(t);
			var radius = radiusInterpolate(powScale(t) * ease(t));
			var tAngle = angleInterpolate(t, radius);
			var f1 = {
				'innerRadius': radius,
				'outerRadius': radius+tWidth,
				'startAngle': tAngle[0],
				'endAngle': tAngle[1],
				'cx': -radius+x(t),
				'cy': y(t)
			};
			path.attr('d', arc_rect(f1));
		} else {
			var arc = d3.svg.arc();
			var f2 = {
				'innerRadius': d.innerRadius,
				'outerRadius': d.outerRadius,
				'startAngle': d.startAngle,
				'endAngle': d.endAngle,
				'cx': 0,
				'cy': 0
			};
			path.attr('d', arc(f2));
		}

	};
};

var numberTween = function(d, i, a){
	var interpolate = d3.interpolateRound(+(this.textContent), +(d.value));
	return function(t) {
		this.textContent = interpolate(t);
	};
};

var opacityToOneTween = function(d, i, a) {
	var interpolate = d3.interpolate(a, 1);
	return function(t) {
		var value = interpolate(t);
		if (value < 1e-6) {
			value = 1e-6;
		} else if (value == 1) {
			value = null;
		}
		return value;
	};
};

var getParent = function(node, count, miss, subset, depth, namespace) {
	if (node.is_obsolete) {
		if (node.replaced_by) {
			node = node.replaced_by;
		} else {
			return null;
		}
	}
	if (node.namespace != namespace) {
		return null;
	}
	var doMiss = (node.subset && node.subset.indexOf(subset) != -1) | subset === '' ? 0 : 1;
	if (node.parent.length) {
	
		var res = node.parent.map(function(d) {
			return getParent(d, count+1, miss+doMiss, subset, depth, namespace);
		}).filter(function(f) {return f;});
		
		var ans;

		if (res.length === 0) {
			return null;
		} else if(res.length == 1) {
			ans = res[0];
		} else {
			minMiss = d3.min(res.map(function(d) {return d.miss;}));
			res = res.filter(function(d) {return d.miss == minMiss;});
			if(res.length == 1) {
				ans = res[0];
			} else {
				minCount = d3.min(res.map(function(d) {return d.count;}));
				res = res.filter(function(d) {return d.count == minCount;});
				ans = res[0];
			}
		}
		
		ans.depth++;
		if (ans.depth == depth) {
			ans.id = node.id;
		}
		return ans;
	} else {
		return {id: node.id, count: count+1, miss: miss+doMiss, depth: 1};
	}
};

var setLogo = function() {

	var center = function(d) {return d.center;};
	var radius = function(d) {return d.radius;};
	var fill = function(d) {return d.fill;};
	
	function logo(selection) {
	
		selection.each(function(d, i) {
			var c = center.apply(this, arguments);
			var r = radius.apply(this, arguments);
			var f = fill.apply(this, arguments);
			
			var element = d3.select(this);
		
			var intersectDistance = Math.sqrt( Math.pow( r, 2 ) * 2 );
			var topPoint = [c[0], c[1]+intersectDistance/2];
			var bottomPoint = [c[0], c[1]-intersectDistance/2];
						
			var leftCircle = "M " + topPoint[0] + " " + topPoint[1] + 
			                 "A " + r + " " + r + " 0 1 1 " + bottomPoint[0] + " " + bottomPoint[1] + 
			                 "A " + r + " " + r + " 0 0 0 " + topPoint[0] + " " + topPoint[1];
						   
			var rightCircle = "M " + topPoint[0] + " " + topPoint[1] + 
			                  "A " + r + " " + r + " 0 1 0 " + bottomPoint[0] + " " + bottomPoint[1] + 
			                  "A " + r + " " + r + " 0 0 1 " + topPoint[0] + " " + topPoint[1];
			
			var eye = "M " + topPoint[0] + " " + topPoint[1] + 
			          "A " + r + " " + r + " 0 0 1 " + bottomPoint[0] + " " + bottomPoint[1] + 
			          "A " + r + " " + r + " 0 0 1 " + topPoint[0] + " " + topPoint[1];
			
			element.append("path")
				.classed('filled', f[0])
				.attr('d', leftCircle);
			element.append('path')
				.classed('filled', f[1])
				.attr('d', eye);
			element.append('path')
				.classed('filled', f[2])
				.attr('d', rightCircle);
		});
		
	}
	
	logo.center = function(point) {
		if (!arguments.length) return center;
		center = d3.functor(point);
		return logo;
	};
	logo.radius = function(value) {
		if (!arguments.length) return radius;
		radius = d3.functor(value);
		return logo;
	};
	logo.fill = function(array) {
		if (!arguments.length) return fill;
		fill = d3.functor(array);
		return logo;
	};
	
	return logo;
};

var thickDiagonal = function(d) {
	var dia = d3.svg.diagonal().projection(function(d) { return [d.y, d.x]; });
	
	var path = dia({source: {x: d.source.y0, y: d.source.x0}, target: {x: d.target.y0, y: d.target.x0}}) +
		dia({source: {x: d.target.y1, y: d.target.x1}, target: {x: d.source.y1, y: d.source.x1}}).replace(/^M/, 'L') + 
		' Z';
		
	return path;
};

var progress = function() {
	var id = 'a'+'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
	    return v.toString(16);
	});
	var title = '';
	var progressCirc;
	var formatPercent = d3.format(".0%");
	var n = 0;
	var progressArc = d3.svg.arc()
		.startAngle(0)
		.innerRadius(180)
		.outerRadius(240);
	
	function progress() {
		progressCirc = circ.append('g')
			.attr('id', id)
			.classed('progress', true);
		
		progressCirc.append('path')
			.classed('background', true)
			.attr('d', progressArc.endAngle(2*Math.PI))
			.attr('transform', 'scale(1)');
			
		progressCirc.append('path')
			.classed('foreground', true)
			.attr("d", progressArc.endAngle(0));
			
		progressCirc.append('text')
			.classed('title', true)
			.attr('text-anchor', 'middle')
			.attr('dy', '-2em');
		
		progressCirc.append('text')
			.classed('progressN', true)
			.attr('text-anchor', 'middle')
			.attr('dy', '2em');
	}
	
	progress.title = function(t) {
		title = t;
	};
	
	progress.initialize = function() {
		progressCirc.select('.foreground')
			.attr("d", progressArc.endAngle(0));
		progressCirc.select('.title')
			.text(title);
		progressCirc.select('.progressN')
			.text(formatPercent(n));
		
		return id;
	};
	progress.new = function(t) {
		progressCirc.remove();
		title = t;
		n = 0;
		id = 'a'+'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		    return v.toString(16);
		});
		
		progressCirc = circ.append('g')
			.attr('id', id)
			.classed('progress', true);
		
		progressCirc.append('path')
			.classed('background', true)
			.attr('d', progressArc.endAngle(2*Math.PI))
			.attr('transform', 'scale(1)');
			
		progressCirc.append('path')
			.classed('foreground', true)
			.attr("d", progressArc.endAngle(0));
			
		progressCirc.append('text')
			.classed('title', true)
			.attr('text-anchor', 'middle')
			.attr('dy', '-2em')
			.text(title);
		
		progressCirc.append('text')
			.classed('progressN', true)
			.attr('text-anchor', 'middle')
			.attr('dy', '2em')
			.text(formatPercent(n));
		
		return id;
	};
		
	progress.update = function(ID) {
		if (ID == id) {
			var i = d3.interpolate(n, d3.event.loaded / d3.event.total);
			var p = progressCirc;
			d3.transition().duration(10).tween("progress", function() {
				return function(t) {
					n = i(t);
					p.select('.foreground').attr("d", progressArc.endAngle(2*Math.PI * n));
					p.select('.progressN').text(formatPercent(n));	
				};
			});
		}
	};
	
	progress.remove = function(ID) {
		progressCirc.transition()
			.delay(250)
			.attr('transform', 'scale(0)')
			.remove();
	};
	
	return progress;
};

var goMapping = {
	    name: [
			'Biological adhesion',
			'Biological regulation',
			'Cell killing',
			'Cellular component organization or biogenesis',
			'Cellular process',
			'Developmental process',
			'Establishment of localization',
			'Growth',
			'Immune system process',
			'Localization',
			'Locomotion',
			'Metabolic process',
			'Multi-organism process',
			'Multicellular organismal process',
//			'Negative regulation of biological process',
//			'Positive regulation of biological process',
//			'Regulation of biological process',
			'Reproduction',
			'Reproductive process',
			'Response to stimulus',
			'Rhythmic process',
			'Signaling',
			'Single-organism process',
			'Unknown'
	    ],
	    goTerm: [
	    	'GO:0022610',
			'GO:0065007',
			'GO:0001906',
			'GO:0071840',
			'GO:0009987',
			'GO:0032502',
			'GO:0051234',
			'GO:0040007',
			'GO:0002376',
			'GO:0051179',
			'GO:0040011',
			'GO:0008152',
			'GO:0051704',
			'GO:0032501',
//			'GO:0048519',
//			'GO:0048518',
//			'GO:0050789',
			'GO:0000003',
			'GO:0022414',
			'GO:0050896',
			'GO:0048511',
			'GO:0023052',
			'GO:0044699',
			'Unknown'
	    ],
	    description: [
	    	'The attachment of a cell or organism to a substrate or other organism.',
	    	'Any process that modulates a measurable attribute of any biological process, quality or function.',
	    	'Any process in an organism that results in the killing of its own cells or those of another organism, including in some cases the death of the other organism. Killing here refers to the induction of death in one cell by another cell, not cell-autonomous death due to internal or other environmental conditions.',
	    	'A process that results in the biosynthesis of constituent macromolecules, assembly, arrangement of constituent parts, or disassembly of a cellular component.',
	    	'Any process that is carried out at the cellular level, but not necessarily restricted to a single cell. For example, cell communication occurs among more than one cell, but occurs at the cellular level.',
	    	'A biological process whose specific outcome is the progression of an integrated living unit: an anatomical structure (which may be a subcellular structure, cell, tissue, or organ), or organism over time from an initial condition to a later condition',
	    	'The directed movement of a cell, substance or cellular entity, such as a protein complex or organelle, to a specific location.',
	    	'The increase in size or mass of an entire organism, a part of an organism or a cell.',
	    	'Any process involved in the development or functioning of the immune system, an organismal system for calibrated responses to potential internal or invasive threats.',
	    	'Any process in which a cell, a substance, or a cellular entity, such as a protein complex or organelle, is transported to, and/or maintained in a specific location.',
	    	'Self-propelled movement of a cell or organism from one location to another.',
	    	'The chemical reactions and pathways, including anabolism and catabolism, by which living organisms transform chemical substances. Metabolic processes typically transform small molecules, but also include macromolecular processes such as DNA repair and replication, and protein synthesis and degradation.',
	    	'Any process in which an organism has an effect on another organism of the same or different species.',
	    	'Any biological process, occurring at the level of a multicellular organism, pertinent to its function.',
//	    	'Any process that stops, prevents, or reduces the frequency, rate or extent of a biological process. Biological processes are regulated by many means; examples include the control of gene expression, protein modification or interaction with a protein or substrate molecule.',
//	    	'Any process that activates or increases the frequency, rate or extent of a biological process. Biological processes are regulated by many means; examples include the control of gene expression, protein modification or interaction with a protein or substrate molecule.',
//	    	'Any process that modulates the frequency, rate or extent of a biological process. Biological processes are regulated by many means; examples include the control of gene expression, protein modification or interaction with a protein or substrate molecule.',
	    	'The production by an organism of new individuals that contain some portion of their genetic material inherited from that organism.',
	    	'A biological process that directly contributes to the process of producing new individuals by one or two organisms. The new individuals inherit some proportion of their genetic material from the parent or parents.',
	    	'Any process that results in a change in state or activity of a cell or an organism (in terms of movement, secretion, enzyme production, gene expression, etc.) as a result of a stimulus. The process begins with detection of the stimulus and ends with a change in state or activity or the cell or organism.',
	    	'Any process pertinent to the generation and maintenance of rhythms in the physiology of an organism.',
	    	'The entirety of a process in which information is transmitted. This process begins with an active signal and ends when a cellular response has been triggered.',
	    	'A biological process that involves only one organism.',
	    	'No functional annotation has yet been made for these genes'
	    ]
    };
// Definition of Pangenome class
function Pangenome(pan, geneInfo, hc, scatter, plotDim){

// Private data
	var panGroupChanges = {
		'enter': [],
		'change': {'Accessory': [], 'Singleton': [], 'Core': []},
		'update': [],
		'exit': [],
		'empty': true
	};
	var goChange;
	var oldGOpos = [];

// Private methods
	function getChildren(root){
		var children = [];
		function recurseChildren(root){
			children.push(root);
			if(root.children && root.children.length) {
				root.children.forEach(recurseChildren);
			}
		}
		recurseChildren(root);
		return children;
	}
	function resetPanGroupChanges(){
		panGroupChanges = {
			'enter': [],
			'change': {'Accessory': [], 'Singleton': [], 'Core': []},
			'update': [],
			'exit': [],
			'empty': true
		};
	}
	function geneSort(a, b){
		return +(a.name) - +(b.name);
	}
	

// Public data
	this.scatter = scatter;
	this.currentScatter = 'MDS';
	this.currentGO = "biological_process";
	this.fullPan = pan;
	this.subPan = {};
	this.fullGeneInfo = geneInfo.map(function(d){d.origDomain = d.domain; d.inSubPan = true; return d;});
	this.subGeneInfo = [];
	this.hierachicalData = hc;
	this.allStrains = d3.keys(pan);
	this.subStrains = [];
	this.strainSelection = {'a': null, 'b': null};
	this.cluster = d3.layout.cluster()
		.size([plotDim.denDim.height, plotDim.denDim.width-100])
		.separation(function(a, b) { return 1; });
	Object.defineProperties(this, {
		"pan": {
			"get": function() {
				if(d3.keys(this.subPan).length){
					return this.subPan;
				} else {
					return this.fullPan;
				}
			}
		},
		'geneInfo': {
			"get": function() {
				if(this.subGeneInfo.length){
					return this.subGeneInfo;
				} else {
					return this.fullGeneInfo;
				}
			}
		},
		'strains': {
			'get': function(){
				if(this.subStrains.length){
					return this.subStrains;
				} else {
					return this.allStrains;
				}
			}
		},
		'oldGOpos': {
			'get': function() {return oldGOpos;}
		}
    });
    this.goMapping = goMapping;
    this.panGroupInfo = {
	    Singleton: 'Genes in the pangenome that are only represented by one genome. The group can consist both of falsly annotated orf\'s or very rare genes',
	    Accessory: 'Genes that are in some but not all of the organisms in the pangenome. These genes are not necessary for survival, but can give e.g. niché-specific advantages',
	    Core: 'The genes in a pangenome that are present in all organisms. This group is thought to converge to a minimum number of necessary genes for a specific group of organisms e.g. a species.'
    };


// Public methods	
	this.switchScatter = function(){
		this.currentScatter = this.currentScatter == 'MDS' ? 'PCA' : 'MDS';
	};
	this.getScatter = function(){
		return this.scatter[this.currentScatter];
	};
	this.createHCNodeLinks = function(dendrogram){
		this.nodes = this.cluster.nodes(this.hierachicalData).map(function(d) {d.y = dendrogram.heightScale(d.height); return d;});
		this.links = this.cluster.links(this.nodes);
	};
	this.setSubPan = function(strains){
		var fullGeneInfo = this.fullGeneInfo,
			subGeneInfo = this.subGeneInfo,
			oldGeneInfo = this.geneInfo.slice();
		
		resetPanGroupChanges(false);
		this.resetSubPan();

		
		var fullPan = this.fullPan,
			subPan = this.subPan;
			
// Create new pangenome and filter the geneinfo
			
		d3.keys(fullPan).forEach(function(d) {if(strains.indexOf(d) != -1) subPan[d] = fullPan[d];});
		
		var remove = d3.transpose(d3.values(subPan)).map(function(d) {
				return d.filter(function(f) {return f;}).length;
			});
		var nRep = remove.filter(function(f) {return f;});

		for (var i in subPan){
			subPan[i] = subPan[i].filter(function(d, j) {return remove[j] !== 0;});
		}
		this.subStrains = d3.keys(subPan);
		var nStrains = this.strains.length;
		
		subGeneInfo = fullGeneInfo.filter(function(d, i) {return remove[i] !== 0;});
		
		var oldGeneInfoMap = d3.map(oldGeneInfo, function(d) {return d.id;});

		subGeneInfo.forEach(function(d, i) {
			var geneExist = oldGeneInfoMap.has(d.id);

			if (nRep[i] == nStrains) {
				if (geneExist){
					if (d.domain == 'Core'){
						panGroupChanges.update.push(d);
					} else {
						panGroupChanges.change[d.domain].push(d);
					}
				} else {
					panGroupChanges.enter.push(d);
				}
				d.domain = 'Core';
			} else if (nRep[i] == 1) {
				if (geneExist){
					if (d.domain == 'Singleton'){
						panGroupChanges.update.push(d);
					} else {
						panGroupChanges.change[d.domain].push(d);
					}
				} else {
					panGroupChanges.enter.push(d);
				}
				d.domain = 'Singleton';
			} else if (nRep[i] > 1 && nRep[i] < nStrains){
				if (geneExist){
					if (d.domain == 'Accessory'){
						panGroupChanges.update.push(d);
					} else {
						panGroupChanges.change[d.domain].push(d);
					}
				} else {
					panGroupChanges.enter.push(d);
				}
				d.domain = 'Accessory';
			}
			return d;
		});

// Get the changes from the old pangenome	
		var subGeneInfoMap = d3.map(subGeneInfo, function(d) {return d.id;});
		oldGeneInfo.forEach(function(d) {
			if (!subGeneInfoMap.has(d.id)){
				panGroupChanges.exit.push(d);
			}
		});
		this.subGeneInfo = subGeneInfo;
		this.fullGeneInfo.forEach(function(d) {
			if (!subGeneInfoMap.has(d.id)) {
				d.inSubPan = false;
			} else {
				d.inSubPan = true;
			}
		});
		panGroupChanges.empty = false;
		
	};
	this.resetSubPan = function(domainRevert){
		this.subPan = {};
		this.subGeneInfo = [];
		this.fullGeneInfo.forEach(function(d) {d.index=-1; d.inSubPan = true;});
		if (domainRevert){
			this.fullGeneInfo.map(function(d) {d.domain = d.origDomain;});
		}
	};
	this.panGroupStat = function(){
		var Core = 0,
			Accessory = 0,
			Singleton = 0;
		
		var data = d3.values(this.pan);

		var size = data.length;
		data = d3.transpose(data);
		var counts = data.map(function(d) {return d.filter(function(f) {return f;}).length;}).filter(function(f) {return f;});
		
		counts.forEach(function(d) {
			if (d === size) Core++;
			else if (d === 1) Singleton++;
			else Accessory++;
		});
		return {
			'Core': Core,
			'Accessory': Accessory,
			'Singleton': Singleton,
			'total': Core+Accessory+Singleton};
	};
	this.goOrder = function(first){
		if (typeof first === 'undefined') { first = false; }
		
		var startClass = [];
		for (var i = 0; i < this.goMapping.name.length; i++){
			startClass.push(0);
		}
// Get overall layout
		var classCount = {'Singleton': clone(startClass), 'Accessory': clone(startClass), 'Core': clone(startClass)},
			data = this.geneInfo;
		
		var genePos = [];
		for (var j = 0; j < this.goMapping.name.length; j++){
			genePos.push([]);
		}
		var genes = {'Singleton': clone(genePos), 'Accessory': clone(genePos), 'Core': clone(genePos)};
		data.forEach(function(d) {
			classCount[d.domain][d.class-1]++;
			genes[d.domain][d.class-1].push(d);
		});
		
		var classPos = {};
		classPos.Singleton = classCount.Singleton.map(function(d,i) {return d3.sum(classCount.Singleton.slice(0,i))+1;});
		classPos.Accessory = classCount.Accessory.map(function(d,i) {return d3.sum(classCount.Accessory.slice(0,i))+1;});
		classPos.Core = classCount.Core.map(function(d,i) {return d3.sum(classCount.Core.slice(0,i))+1;});
		var overall = [];
		for (i in classCount){
			classCount[i].forEach(function(d, ii){
				overall.push({'domain': i, 'class': ii+1, 'size': d, 'start': classPos[i][ii], 'end': classPos[i][ii+1] ? classPos[i][ii+1]: classPos[i][ii]+d, 'genes': genes[i][ii].sort(geneSort).map(function(d, i) { d.index = i; return d;})});
			});
		}
		var ans = {'overall': overall};
		if (!first){
// Get the position of the transient arcs
			var updateCount = {'Singleton': clone(startClass), 'Accessory': clone(startClass), 'Core': clone(startClass)};
			var enterCount = {'Singleton': clone(startClass), 'Accessory': clone(startClass), 'Core': clone(startClass)};
			var exitCount = {'Singleton': clone(startClass), 'Accessory': clone(startClass), 'Core': clone(startClass)};
			var changeCount = {
				'Singleton': {'Accessory': clone(startClass), 'Core': clone(startClass)},
				'Accessory': {'Singleton': clone(startClass), 'Core': clone(startClass)},
				'Core': {'Singleton': clone(startClass), 'Accessory': clone(startClass)}
			};
			var counterStart = {'Singleton': clone(startClass), 'Accessory': clone(startClass), 'Core': clone(startClass)};
			oldGOpos.forEach(function(d) {
				counterStart[d.domain][d.class-1] = d.start;
			});
			var counterEnd = {'Singleton': clone(startClass), 'Accessory': clone(startClass), 'Core': clone(startClass)};
			overall.forEach(function(d) {
				counterEnd[d.domain][d.class-1] = d.start;
			});
			
			
			panGroupChanges.update.forEach(function(d) {
				updateCount[d.domain][d.class-1]++;
			});
			panGroupChanges.enter.forEach(function(d) {
				enterCount[d.domain][d.class-1]++;
			});
			panGroupChanges.exit.forEach(function(d) {
				exitCount[d.domain][d.class-1]++;
			});
			for (i in panGroupChanges.change){
				panGroupChanges.change[i].forEach(function(d) {
					changeCount[i][d.domain][d.class-1]++;
				});
			}
			
			var updateStart = [];
			var updateEnd = [];
			for (i in updateCount){
				updateCount[i].forEach(function(d, ii){
					var start = oldGOpos.filter(function(d) {return d.domain == i && d.class == ii+1;})[0].start;
					start = start ? start : 1;
					var end = overall.filter(function(d) {return d.domain == i && d.class == ii+1;})[0].start;
					end = end ? end : 1;
					updateStart.push({'domain': i, 'class': ii+1, 'size': d, 'start': start, 'end': start+d});
					updateEnd.push({'domain': i, 'class': ii+1, 'size': d, 'start': end, 'end': end+d});
					counterStart[i][ii] = start+d;
					counterEnd[i][ii] = end+d;
				});
			}
			var exit = [];
			for (i in exitCount){
				exitCount[i].forEach(function(d, ii){
					start = counterStart[i][ii] ? counterStart[i][ii] : 1;
					exit.push({'domain': i, 'class': ii+1, 'size': d, 'start': start, 'end': start+d});
					counterStart[i][ii] = start+d;
				});
			}

			var changeFrom = [];
			var changeTo = [];
			for (i in changeCount){
				for (j in changeCount[i]){
					changeCount[i][j].forEach(function(d, ii) {
						fromStart = counterStart[i][ii] ? counterStart[i][ii] : 1;
						toStart = counterEnd[j][ii] ? counterEnd[j][ii] : 1;
						changeFrom.push({'key': i+j+(ii+1), 'domain': i, 'class': ii+1, 'size': d, 'start': fromStart, 'end': fromStart+d});
						changeTo.push({'key': i+j+(ii+1), 'domain': j, 'class': ii+1, 'size': d, 'start': toStart, 'end': toStart+d});
						counterStart[i][ii] = fromStart+d;
						counterEnd[j][ii] = toStart+d;
					});
				}
			}
						
			var enter = [];
			for (i in enterCount){
				enterCount[i].forEach(function(d, ii){
					start = counterEnd[i][ii] ? counterEnd[i][ii] : 1;
					enter.push({'domain': i, 'class': ii+1, 'size': d, 'start': start, 'end': start+d});
					counterEnd[i][ii] = start+d;
				});
			}

			ans.transient = {'updateStart': updateStart, 'updateEnd': updateEnd, 'enter': enter, 'exit': exit, 'changeFrom': changeFrom, 'changeTo': changeTo};
		}
		oldGOpos = clone(overall);
		return ans;
	};
	this.goPos = function(scale, first){
		var data = this.goOrder(first);
		
		data.overall.forEach(function(d) {
			var angles = scale.circle.new(d);
			d.startAngle = angles[0];
			d.endAngle = angles[1];
		});
		
		if (data.transient){

			data.transient.updateStart.forEach(function(d) {
				var angles = scale.circle.old(d);
				d.startAngle = angles[0];
				d.endAngle = angles[1];
			});
			data.transient.updateEnd.forEach(function(d) {
				var angles = scale.circle.new(d);
				d.startAngle = angles[0];
				d.endAngle = angles[1];
			});
			data.transient.exit.forEach(function(d) {
				var angles = scale.circle.old(d);
				d.startAngle = angles[0];
				d.endAngle = angles[1];
			});
			data.transient.enter.forEach(function(d) {
				var angles = scale.circle.new(d);
				d.startAngle = angles[0];
				d.endAngle = angles[1];
			});
			data.transient.changeFrom.forEach(function(d) {
				var angles = scale.circle.old(d);
				d.startAngle = angles[0];
				d.endAngle = angles[1];
			});
			data.transient.changeTo.forEach(function(d) {
				var angles = scale.circle.new(d);
				d.startAngle = angles[0];
				d.endAngle = angles[1];
			});
		}
		goChange = data;
		return data;
	};
	this.goFlux = function(d, scale) {
		if(!panGroupChanges.empty){
			var flux = {'change': []};
			var countPos = d.startAngle;
	// Get the incoming genes
			goChange.transient.changeTo.forEach(function(t, i) {
		
				if (d.class == t.class && d.domain == t.domain && t.size){
					var sourceClass = goChange.transient.changeFrom[i].class;
					var sourceDomain = goChange.transient.changeFrom[i].domain;
					var source = goChange.overall.filter(function(v){
						return v.class == sourceClass && v.domain == sourceDomain;
					})[0];
					if(source){
						sourceAngle = d3.mean([source.startAngle, source.endAngle]);
					} else {
						while(!source){
							if (sourceClass === 0){
								break;
							}
						
							sourceClass = +(sourceClass)-1;
	
							source = goChange.overall.filter(function(v){
								return v.class == sourceClass && v.domain == sourceDomain;
							})[0];
						}
						if (source){
							sourceAngle = source.endAngle;
						} else {
							sourceAngle = scale.circle.new({'domain': sourceDomain, 'start': 0, 'end': 0})[0];
						}
						
					}
					
					
					var chord = {
						'size': t.size,
						'from': sourceDomain,
						'source': {
							'startAngle': sourceAngle,
							'endAngle': sourceAngle
						},
						'target': {
							'startAngle': t.startAngle,
							'endAngle': t.endAngle
						},
						'class': 'in'
					};
					countPos = countPos < t.endAngle ? t.endAngle : countPos;
					flux.change.push(chord);
				}
			});
			
	// Get entering genes
	
			enter = goChange.transient.enter.filter(function(t) {
				return t.domain == d.domain && t.class == d.class;
			})[0];
			
			if(enter.size){
				flux.enter = clone(enter);
				countPos = countPos < flux.enter.endAngle ? flux.enter.endAngle : countPos;
			}
	
	// Get the leaving genes
			goChange.transient.changeFrom.forEach(function(t, i) {
			
				if (d.class == t.class && d.domain == t.domain && t.size){
					var target = goChange.transient.changeTo.filter(function(v) {
						return t.key == v.key;
					})[0];
					
					
					var chord = {
						'size': target.size,
						'to': target.domain,
						'source': {
							'startAngle': countPos,
							'endAngle': countPos
						},
						'target': {
							'startAngle': target.startAngle,
							'endAngle': target.endAngle
						},
						'class': 'out'
					};
					flux.change.push(chord);
				}
			});
			
	// Get exiting genes
			exit = goChange.transient.exit.filter(function(t) {
				return t.domain == d.domain && t.class == d.class;
			})[0];
			
			if(exit.size){
				flux.exit = clone(exit);
				var mid = d3.mean([d.startAngle, d.endAngle]);
				var diff = flux.exit.endAngle - flux.exit.startAngle;
				flux.exit.startAngle = mid - diff/2;
				flux.exit.endAngle = mid + diff/2;
			}
			
			return flux;
		}
	};
	this.strainGO = function(strain) {
		var genome = this.fullPan[strain];
		var data = this.fullGeneInfo;
		
		var goCount = [];
		for (var i = 0; i < this.goMapping.name.length; i++){
			goCount.push(0);
		}
		var genePos = [];
		for (var j = 0; j < this.goMapping.name.length; j++){
			genePos.push([]);
		}
		
		data.forEach(function(d, i) {
			if(genome[i]){
				goCount[d.class-1]++;
				genePos[d.class-1].push(d);
			}
		});
		
		goCount.reverse();
		genePos.reverse();
		var goPos = goCount.map(function(d,i) {return d3.sum(goCount.slice(0,i))+1;});
		var genomeRes = [];
		goCount.forEach(function(d, i){
			genomeRes.push({'size': d, 'start': goPos[i], 'end': goPos[i+1] ? goPos[i+1] : goPos[i]+d, 'genes': genePos[i].sort(geneSort)});
		});
		genomeRes.reverse().forEach(function(d,i) {d.class = i+1;});
		return genomeRes;
	};
	this.createGeneLink = function(genome, index, barScale, goBarScale){
		var sourceX = index == 'a' ? 75 : plotDim.circleDim.width-75;
		var targetX = index == 'a' ? plotDim.circleDim.width/2-25 : plotDim.circleDim.width/2+25;
	
		var links = [];
				
		genome.forEach(function(d) {
			d.genes.forEach(function(g, i) {
				if(g.index != -1) {
					links.push({
						'domain': g.domain,
						'class': g.class,
						'source': {
							'y': sourceX,
							'x': barScale(d.end-i)
						},
						'target': {
							'y': targetX,
							'x': goBarScale(oldGOpos.filter(function(f) {return f.class == g.class && f.domain == g.domain;})[0].start+g.index, g.domain)
						}
					});
				}
			});
		});
		return links;
	};
	this.createGeneLinkBands = function(genome, index, barScale, goBarScale){
		var sourceX = index == 'a' ? 75 : plotDim.circleDim.width-75;
		var targetX = index == 'a' ? plotDim.circleDim.width/2-25 : plotDim.circleDim.width/2+25;
		
		var dualView = this.strainSelection.a && this.strainSelection.b ? true : false;
	
		var links = [];
		var simLinks = [];
		for (i = 0; i < this.goMapping.goTerm.length; i++) {
			links.push({Singleton: [], Accessory: [], Core: []});
			simLinks.push({Singleton: [], Accessory: [], Core: []});
		}
		
				
		genome.forEach(function(d) {
			d.genes.forEach(function(g, i) {
				if (g.index != -1) {
					links[g.class-1][g.domain].push(g);
				}
			});
		});
		
		if (dualView) {
			this.fullGeneInfo.forEach(function(d, i) {
				if (d.index != -1 && this.fullPan[this.strainSelection.a][i] !== 0 && this.fullPan[this.strainSelection.b][i] !== 0) {
					simLinks[d.class-1][d.domain].push(d);
				}
			}, this);
		}
		
		bands = [];
		links.forEach(function(d, i) {
			var s = d.Core.length+d.Accessory.length+d.Singleton.length;
			var a = d.Core.length+d.Accessory.length;
			var c = d.Core.length;
			if (d.Singleton.length) {
				bands.push({
					domain: 'Singleton',
					class: i+1,
					size: d.Singleton.length,
					genes: d.Singleton,
					type: 'full',
					source: {
						x0: sourceX,
						x1: sourceX,
						y0: barScale(genome[i].start+a),
						y1: barScale(genome[i].start+s)
					},
					target: {
						x0: targetX,
						x1: targetX,
						y0: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Singleton';})[0].end, 'Singleton'),
						y1: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Singleton';})[0].end-d.Singleton.length, 'Singleton')
					}
				});
				if (simLinks[i].Singleton.length) {
					bands.push({
						domain: 'Singleton',
						class: i+1,
						size: d.Singleton.length,
						genes: d.Singleton,
						type: 'similar',
						source: {
							x0: sourceX,
							x1: sourceX,
							y0: barScale(genome[i].start+a),
							y1: barScale(genome[i].start+a+simLinks[i].Singleton.length)
						},
						target: {
							x0: targetX,
							x1: targetX,
							y0: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Singleton';})[0].end, 'Singleton'),
							y1: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Singleton';})[0].end-simLinks[i].Singleton.length, 'Singleton')
						}
					});
				}
			}
			if (d.Accessory.length) {
				bands.push({
					domain: 'Accessory',
					class: i+1,
					size: d.Accessory.length,
					genes: d.Accessory,
					type: 'full',
					source: {
						x0: sourceX,
						x1: sourceX,
						y0: barScale(genome[i].start+c),
						y1: barScale(genome[i].start+a)
					},
					target: {
						x0: targetX,
						x1: targetX,
						y0: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Accessory';})[0].end, 'Accessory'),
						y1: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Accessory';})[0].end-d.Accessory.length, 'Accessory')
					}
				});
				if (simLinks[i].Accessory.length) {
					bands.push({
						domain: 'Accessory',
						class: i+1,
						size: d.Accessory.length,
						genes: d.Accessory,
						type: 'similar',
						source: {
							x0: sourceX,
							x1: sourceX,
							y0: barScale(genome[i].start+c),
							y1: barScale(genome[i].start+c+simLinks[i].Accessory.length)
						},
						target: {
							x0: targetX,
							x1: targetX,
							y0: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Accessory';})[0].end, 'Accessory'),
							y1: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Accessory';})[0].end-simLinks[i].Accessory.length, 'Accessory')
						}
					});
				}
			}
			if (d.Core.length) {
				bands.push({
					domain: 'Core',
					class: i+1,
					size: d.Core.length,
					genes: d.Core,
					type: 'full',
					source: {
						x0: sourceX,
						x1: sourceX,
						y0: barScale(genome[i].start),
						y1: barScale(genome[i].start+c)
					},
					target: {
						x0: targetX,
						x1: targetX,
						y0: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Core';})[0].end, 'Core'),
						y1: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Core';})[0].end-c, 'Core')
					}
				});
				if (simLinks[i].Core.length) {
					bands.push({
						domain: 'Core',
						class: i+1,
						size: d.Singleton.length,
						genes: d.Core,
						type: 'similar',
						source: {
							x0: sourceX,
							x1: sourceX,
							y0: barScale(genome[i].start),
							y1: barScale(genome[i].start+simLinks[i].Core.length)
						},
						target: {
							x0: targetX,
							x1: targetX,
							y0: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Core';})[0].end, 'Core'),
							y1: goBarScale(oldGOpos.filter(function(f) {return f.class == i+1 && f.domain == 'Core';})[0].end-simLinks[i].Core.length, 'Core')
						}
					});
				}
			}
		});
		return bands;
	};
	this.assignTerms = function(GO, domain) {
		for(var i in GO) {
			GO[i].genes = [];
		}
		var geneInfo = this.subGeneInfo.length === 0 ? this.fullGeneInfo : this.subGeneInfo;
		
		geneInfo.forEach(function(d) {
			if (d.go) {
				d.go.forEach(function(go) {
					if (domain) {
						if (domain == d.domain) {
							GO[go].genes.push(d);
						}
					} else GO[go].genes.push(d);
				});
			}
		});
	};
}

// Setup of major layout of plot
var PlotDim = function(){
	this.margins = {top: 20, bottom: 30, left: 50, right: 30};
	this.cDim = {width: 1700, height: 1000};
	this.mdsDim = {width: this.cDim.width - this.margins.left - this.margins.right-1000, height: (this.cDim.height - this.margins.top - this.margins.bottom)/2};
	this.denDim = {width: this.mdsDim.width, height: this.cDim.height - this.margins.top - this.margins.bottom-this.mdsDim.height-50};
	this.circleDim = {width: this.cDim.width - this.margins.left - this.margins.right - this.mdsDim.width-50, height: this.cDim.height - this.margins.top - this.margins.bottom};
	this.infoDim = {width: 400, height: this.cDim.height};
};
var plotDim = new PlotDim();

var geneListColumnSpace = [10, 30, 10, 30, 20];


// Main SVG chart area
var svg = d3.select("#chart")
	.append("svg")
	.attr("width",plotDim.cDim.width)
	.attr("height",plotDim.cDim.height);
	
// Gradient for exiting genes arc
var gradient = svg.append("svg:defs")
	.append("svg:radialGradient")
		.attr("id", "goExitGradient")
		.attr("cx", "0")
		.attr("cy", "0")
		.attr("r", "550")
		.attr("gradientUnits", "userSpaceOnUse");

gradient.append("svg:stop")
	.attr("offset", "0%")
	.attr("stop-color", "red")
	.attr("stop-opacity", 1);
	
gradient.append("svg:stop")
	.attr("offset", "84%")
	.attr("stop-color", "red")
	.attr("stop-opacity", 0.5);
	
gradient.append("svg:stop")
	.attr("offset", "92%")
	.attr("stop-color", "red")
	.attr("stop-opacity", 0.1);
	
gradient.append("svg:stop")
	.attr("offset", "100%")
	.attr("stop-color", "red")
	.attr("stop-opacity", 0);


// Sidebar with legends and extra info
var info = d3.select("#info")
	.style('left', plotDim.margins.left+plotDim.mdsDim.width+plotDim.circleDim.width+100+'px')
	.style('width', plotDim.infoDim.width+'px');


// Subareas of chart for the different plots
var mdspca = svg.append('g') // <- Scatterplot
	.attr('id', 'mdspca')
	.attr('transform', 'translate(' + plotDim.margins.left + ',' + plotDim.margins.top + ')');

var den = svg.append('g') // <- Dendrogram
	.attr('id', 'dendrogram')
	.attr('transform', 'translate(' + plotDim.margins.left + ',' + (+(plotDim.margins.top) +(plotDim.mdsDim.height) + 50) + ')');

var circ = svg.append('g') // <- Circle/bar chart (Main plotting area)
	.attr('id', 'circle')
	.attr('transform', 'translate(' + (+(plotDim.margins.left) +(plotDim.mdsDim.width) + 50 + plotDim.circleDim.width/2) + ',' + (plotDim.margins.top + plotDim.circleDim.height/2) + ')');

circ.append('g') // <- Background group of circle/bar chart for showing the GO change chords
	.attr('id', 'goChangeLayer');


// Parse GO
var GO = go.vertices.id.map(function(d, i) {
	return {
		id: d,
		name: this.name[i],
		def: this.def[i],
		namespace: this.namespace[i],
		alt_id: this.alt_id[i],
		is_obsolete: this.is_obsolete[i],
		replaced_by: null,
		subset: this.subset[i],
		children: [],
		parent: []
	};
}, go.vertices);
go.edges.from.forEach(function(d, i) {
	switch (this.type[i]) {
		case 'is_a':
			GO[this.from[i]-1].parent.push(GO[this.to[i]-1]);
			GO[this.to[i]-1].children.push(GO[this.from[i]-1]);
			break;
		case 'replaced_by':
			GO[this.from[i]-1].replaced_by = GO[this.to[i]-1];
			break;
	}
}, go.edges);
// Assign offsprings to all terms
var getOffspring = function(d) {
	if (d.offspring) return d.offspring;
	
	if (d.children.length) {
		d.offspring = {};
		
		d.children.forEach(function(c) {
			d.offspring[c.id] = c;
			var off = getOffspring(c);
			for (var i in off) {
				d.offspring[i] = off[i];
			}
		});
		return d.offspring;
	} else return {};
};

GO.forEach(function(d) {
	if (!d.offspring && d.children.length) {
		getOffspring(d);
	}
});

GOmap = {};
GO.forEach(function(d) {
	GOmap[d.id] = d;
	if (d.alt_id) {
		d.alt_id.forEach(function(dd) {
			GOmap[dd] = d;
		});
	}
});

// Find second level term for all OG's
geneInfo.forEach(function(d, i) {
	d.id = i; // <- store the index as an id inside each gene object
	if (d.go) {
		if (typeof d.go === 'string') {
			d.go = [d.go];
		}
		var bp = d.go.filter(function(f) {return GOmap[f].namespace == "biological_process";});
		if (bp.length) {
			bp = bp.map(function(dd) {
				return getParent(GOmap[dd], 0, 0, "gosubset_prok", 2, "biological_process");
			}).filter(function(f) {return f;});
			if (bp.length === 0) {
				d.class = 21;
			} else {
				var ans;
				if (bp.length == 1) {
					ans = bp[0];
				} else {
					minMiss = d3.min(bp.map(function(d) {return d.miss;}));
					bp = bp.filter(function(d) {return d.miss == minMiss;});
					if(bp.length == 1) {
						ans = bp[0];
					} else {
						maxCount = d3.max(bp.map(function(d) {return d.count;}));
						bp = bp.filter(function(d) {return d.count == maxCount;});
						ans = bp[0];
					}
				}
				d.class = goMapping.goTerm.indexOf(ans.id)+1;
			}
		} else {
			d.class = 21;
		}
	} else {
		d.class = 21;
	}
});




// Create main data object
var pgObject = new Pangenome(pan, geneInfo, root, dimReduc, plotDim);


// Object handling geneList
var GeneList = function(){
	
// PRIVATE

// Data
	var genes = new Set();
	var fullGenes;
	var selected = null;
// Methods
	var createHeaderButtons = function(radius) {
	
		var xTrans = plotDim.cDim.width/2;
		var yTrans = radius*2;
	
		var container = d3.select("#geneList").insert('svg', 'table')
//				.attr('transform', 'translate('+plotDim.cDim.width/2+","+radius*2+")")
			.attr('width', plotDim.cDim.width)
			.attr('height', radius*4)
			.classed('buttons', true);
		
		var unionLogo = setLogo().radius(radius);
		
		container.append('circle')
			.attr('cx', -14*radius+xTrans)
			.attr('cy', yTrans)
			.attr('r', radius)
			.attr('id', 'set')
			.on('click', onMouseClick);
		container.selectAll('g').data([
				{center: [-9*radius+xTrans, yTrans], fill: [true,true,true]},
				{center: [-3*radius+xTrans, yTrans], fill: [false,true,false]},
				{center: [3*radius+xTrans, yTrans], fill: [false, false, true]},
				{center: [9*radius+xTrans, yTrans], fill: [true,false,false]},
				{center: [15*radius+xTrans, yTrans], fill: [true,false,true]},
			])
			.enter().append('g')
				.attr('id', function(d, i) {
					var names = ['union', 'intersection', 'complement', 'revComplement', 'symmetric'];
					return names[i];
				})
				.on('click', onMouseClick)
				.call(unionLogo);
	};
	var onMouseClick = function(d) {
		if (d3.select(this).classed('selected')){
			d3.selectAll('#geneList svg g,circle')
				.classed('selected', false);
			d3.select('#chart').style('cursor', null);
			d3.selectAll('.geneSet')
				.classed('selectOn', false)
				.style('cursor', null);
			
			selected = null;
		} else {
			d3.selectAll('#geneList svg g,circle')
				.classed('selected', false);
			d3.select(this).classed('selected', true);
			d3.select('#chart').style('cursor', 'not-allowed');
			d3.selectAll('.geneSet')
				.classed('selectOn', true)
				.style('cursor', 'pointer');
			
			selected = d3.select(this).attr('id');
		}
	};
	var setOperations = {
		set: function(g) {
			genes = new Set(g.map(function(d) {return d.id;}));
		},
		union: function(g) {
			genes = genes.union(new Set(g.map(function(d) {return d.id;})));
		},
		intersection: function(g) {
			genes = genes.intersection(new Set(g.map(function(d) {return d.id;})));
		},
		complement: function(g) {
			var tempGenes = new Set(g.map(function(d) {return d.id;}));
			
			genes = tempGenes.difference(genes);
		},
		revComplement: function(g) {
			genes = genes.difference(new Set(g.map(function(d) {return d.id;})));
		},
		symmetric: function(g) {
			var newSet = new Set(g.map(function(d) {return d.id;}));
			var diff1 = genes.difference(newSet);
			var diff2 = newSet.difference(genes);
			
			genes = diff1.union(diff2);
		}
	};
	var updateListRows = function() {

		d3.select('#geneListBody').selectAll('tr')
			.classed('hidden', function(d) {
				return !genes.contains(d.id);
			});
	};
	var updateListColor = function() {
		d3.selectAll('.geneRow')
			.filter(function(d) {
				return !this.classList.contains(d.domain);
			})
			.attr('class', function(d) {
				return d.domain;
			})
			.classed('geneRow', true);
		d3.selectAll('.geneRow')
			.filter(function(d) {
				return this.classList.contains('inSubPan') ? !d.inSubPan : d.inSubPan;
			})
			.classed('inSubPan', function(d) {return d.inSubPan;});
	};
	var rowHover = function(d) {
		var geneIndex = pgObject.fullGeneInfo.indexOf(d);
		
		var strains = [];
		
		for (var strain in pgObject.fullPan) {
			if (pgObject.fullPan[strain][geneIndex]) {
				strains.push(strain);
			}
		}
		mdspca.selectAll('circle')
			.filter(function(f) {return strains.indexOf(f.name) != -1;})
			.classed('hover', true);
		den.selectAll('.leaf')
			.filter(function(f) {return strains.indexOf(f.name) != -1;})
			.classed('hover', true);
	};
	var rowUnhover = function() {
		mdspca.selectAll('circle')
			.classed('hover', false);
		den.selectAll('.leaf')
			.classed('hover', false);
	};


// PUBLIC

// Data

// Methods
	this.createTable = function() {
		createHeaderButtons(10);
		
		var table = d3.select('#geneListBody');

		table.selectAll('tr').data(fullGenes)
			.enter()
			.append('tr')
			.attr('class', function(d) {
				return d.domain;
			})
			.classed('inSubPan', function(d) {return d.inSubPan;})
			.classed('geneRow', true)
			.on('mouseover', rowHover)
			.on('mouseout', rowUnhover)
			.selectAll('td').data(function(d,i) {return [d.id, d.name, '', d.go, d.ec];})
				.enter()
				.append('td')
				.classed('domainCell', function(d, i) {return i == 2;})
				.text(function(d) {
					if( Object.prototype.toString.call(d) === '[object Array]' ) {
					    d = d.join('\n');
					}
					return d;
				});
	};
	this.isSelected = function() {
		return selected;
	};
	this.setFullGenes = function(g) {
		fullGenes = g;
		genes = new Set(g.map(function(d) {return d.id;}));
	};
	this.updateList = function(g) {
		if(selected) {
			setOperations[selected](g);
			updateListRows();
		}
		updateListColor();
	};
};

var geneList = new GeneList();

geneList.setFullGenes(pgObject.fullGeneInfo);
geneList.createTable();

// Create hoverinfo object
var InfoObject = function(){

// PRIVATE

// Data
	var panStat = {
		size: null,
		Singleton: null,
		Accessory: null,
		Core: null,
		nStrain:null
	};
	var panGroupStat=[];
	var panGroupHeight;

// Methods
	var panGroupScale = d3.scale.linear()
		.range([5, 395]);
	var panGroupNameScale = d3.scale.ordinal();
	var sort = function(a, b) {
        return b.size - a.size;
    };
    var GOPanStat = {};
    var GOPanHeight = 3*15;
    var GOPanRawScale = d3.scale.linear()
    	.range([5, 395]);
    var GOPanNormalizedScale = d3.scale.linear()
    	.range([5, 395]);
    var GOPanNameScale = d3.scale.ordinal()
    	.domain(d3.range(3))
    	.rangeRoundBands([0, GOPanHeight], 0.2);
	
// PUBLIC

// Data

// Methods		
	this.setPanStat = function(d){
		panStat.size = d.size;
		panStat.Singleton = d.Singleton;
		panStat.Accessory = d.Accessory;
		panStat.Core = d.Core;
		panStat.nStrain = d.nStrain;
	};
	this.resetPanStat = function(){
		panStat = {
			size: null,
			Singleton: null,
			Accessory: null,
			Core: null,
			nStrain:null
		};
	};
	this.updatePanStat = function(duration){
		info.selectAll('.nOverall').data([
				{value: panStat.size},
				{value: panStat.Singleton},
				{value: panStat.Accessory},
				{value: panStat.Core},
				{value: panStat.nStrain},
			])
			.transition()
				.duration(duration)
				.tween('text', numberTween);
	};
	this.initializePanStat = function(){
		info.selectAll('.nOverall').data([
				{value: panStat.size},
				{value: panStat.Singleton},
				{value: panStat.Accessory},
				{value: panStat.Core},
				{value: panStat.nStrain},
			])
			.text(function(d) {return d.value;});
	};
	this.setPanGroupStat = function(d){
		panGroupStat = d.filter(function(f) {return f.size;}).sort(sort);
		panGroupScale.domain([0, panGroupStat[0].size]);
		panGroupHeight = panGroupStat.length*15;
		panGroupNameScale
			.domain(d3.range(panGroupStat.length))
			.rangeRoundBands([0, panGroupHeight], 0.2);
	};
	this.resetPanGroupStat = function(){
		panGroupStat = [];
	};
	this.createPanGroupPlot = function(){
		var color = circle.goColorScale;
		var xaxis = d3.svg.axis()
			.scale(panGroupScale)
			.orient('bottom')
			.ticks(5);
		
		d3.select('#info').append('div')
			.attr('id', 'pangroupplot');
		
		d3.select('#pangroupplot').append('div')
			.html('<p><br/><strong>'+panGroupStat[0].domain+':&nbsp</strong>'+pgObject.panGroupInfo[panGroupStat[0].domain]+'</p>');
		
		subSVG = d3.select('#pangroupplot').append('svg')
			.attr('width', 400)
			.attr('height', panGroupHeight+40);
			
		
		subSVG.selectAll('rect').data(panGroupStat)
			.enter().append('rect')
				.attr('x', panGroupScale(0))
				.attr('y', function(d,i) {return panGroupNameScale(i);})
				.attr('width', function(d) {return panGroupScale(d.size)-panGroupScale(0);})
				.attr('height', panGroupNameScale.rangeBand())
				.style('fill', function(d) {return color(d.class);});
		
		subSVG.append('g')
			.attr('transform', 'translate(0,'+(panGroupHeight+1)+')')
			.style('fill', 'none')
			.style('stroke', 'grey')
			.style('shape-rendering', 'crispEdges')
			.call(xaxis)
				.selectAll('text')
					.style('fill', 'black')
					.style('stroke', 'none');
	};
	this.setGOPanStat = function(d){
		var panGroupSize = pgObject.panGroupStat();
		GOPanStat = {
			'raw': d,
			'normalized': d.map(function(dd) {
				var size = (dd.size / panGroupSize[dd.domain])*100;
				return {
					'class': dd.class,
					'domain': dd.domain,
					'size': size
				};
			})	
		};
		GOPanRawScale.domain([0, d3.max(GOPanStat.raw.map(function(d){return d.size;}))]);
		GOPanNormalizedScale.domain([0, d3.max(GOPanStat.normalized.map(function(d){return d.size;}))]);
	};
	this.resetGOPanStat = function() {
		GOPanStat = {};
	};
	this.createGOPanPlot = function() {
		var color = circle.domainColorScale;
		var xaxisRaw = d3.svg.axis()
			.scale(GOPanRawScale)
			.orient('bottom')
			.ticks(5);
		var xaxisNormalized = d3.svg.axis()
			.scale(GOPanNormalizedScale)
			.orient('bottom')
			.ticks(5);
		
		d3.select('#info').append('div')
			.attr('id', 'GOPanPlot');
		
		d3.select('#GOPanPlot').append('div')
			.html('<em>Raw count</em>');
		
		var rawSVG = d3.select('#GOPanPlot').append('svg')
			.attr('width', 400)
			.attr('height', GOPanHeight+40);
		
		rawSVG.selectAll('rect').data(GOPanStat.raw)
			.enter().append('rect')
				.attr('x', GOPanRawScale(0))
				.attr('y', function(d,i) {return GOPanNameScale(i);})
				.attr('width', function(d) {return GOPanRawScale(d.size)-GOPanRawScale(0);})
				.attr('height', GOPanNameScale.rangeBand())
				.style('fill', function(d) {return color(d.domain);});
		
		rawSVG.append('g')
			.attr('transform', 'translate(0,'+(GOPanHeight+1)+')')
			.style('fill', 'none')
			.style('stroke', 'grey')
			.style('shape-rendering', 'crispEdges')
			.call(xaxisRaw)
				.selectAll('text')
					.style('fill', 'black')
					.style('stroke', 'none');
		
		d3.select('#GOPanPlot').append('div')
			.html('<em>Normalized count (in %)</em>');
			
		var normalizedSVG = d3.select('#GOPanPlot').append('svg')
			.attr('width', 400)
			.attr('height', GOPanHeight+40);
		
		normalizedSVG.selectAll('rect').data(GOPanStat.normalized)
			.enter().append('rect')
				.attr('x', GOPanNormalizedScale(0))
				.attr('y', function(d,i) {return GOPanNameScale(i);})
				.attr('width', function(d) {return GOPanNormalizedScale(d.size)-GOPanNormalizedScale(0);})
				.attr('height', GOPanNameScale.rangeBand())
				.style('fill', function(d) {return color(d.domain);});
		
		normalizedSVG.append('g')
			.attr('transform', 'translate(0,'+(GOPanHeight+1)+')')
			.style('fill', 'none')
			.style('stroke', 'grey')
			.style('shape-rendering', 'crispEdges')
			.call(xaxisNormalized)
				.selectAll('text')
					.style('fill', 'black')
					.style('stroke', 'none');
	};
	this.createGoDescription = function(d){
		d3.select('#info').append('div')
			.attr('id', 'godescription')
			.html('<p><br/><strong>'+pgObject.goMapping.name[d.class-1]+'</strong></p><p><em>Number of gene families:&nbsp</em>'+d.size+'</p><p><em>GO Term:&nbsp</em>'+ pgObject.goMapping.goTerm[d.class-1]+'</p><p><em>Definition:&nbsp</em>'+pgObject.goMapping.description[d.class-1]+'</p>');
	};
	this.createGoStat = function(d){
		var html = '';
		var changeFrom = d.change.filter(function(f) {return f.class == 'in';});
		var changeTo = d.change.filter(function(f) {return f.class == 'out';});
		if(d.enter || changeFrom.length){
			html += '<p><strong>In:</strong></p><table><col class="first"><col class="second">';
			if(d.enter) {
				html += '<tr><td><em>New:&nbsp</em></td><td>'+d.enter.size+'</td></tr>';
			}
			changeFrom.forEach(function(d) {
				html += '<tr><td><em>From&nbsp'+d.from+':&nbsp</em></td><td>'+d.size+'</td></tr>';
			});
			html += '</table>';
		}
		if(d.exit || changeTo.length){
			html += '<p><strong>Out:</strong></p><table><col class="first"><col class="second">';
			if(d.exit) {
				html += '<tr><td><em>Gone:&nbsp</em></td><td>'+d.exit.size+'</td></tr>';
			}
			changeTo.forEach(function(d) {
				html += '<tr><td><em>To&nbsp'+d.to+':&nbsp</em></td><td>'+d.size+'</td></tr>';
			});
			html += '</table>';
		}
		d3.select('#info').append('div')
			.attr('id', 'goflux')
			.html(html);
	};
};
var infoObject = new InfoObject();

// Components related to the MDS/PCA scatterplot	
var Scatter = function(){

// PRIVATE

// Data

// Methods
	var xscale = d3.scale.linear()
		.range([0, plotDim.mdsDim.width])
		.nice(4)
		.domain(d3.extent(pgObject.getScatter(), function(d) { return +d.x; }));
	var yscale = d3.scale.linear()
		.range([plotDim.mdsDim.height, 0])
		.nice(4)
		.domain(d3.extent(pgObject.getScatter(), function(d) { return +d.y; }));
	var xaxis = d3.svg.axis()
		.scale(xscale)
		.orient('bottom')
		.ticks(6);
	var yaxis = d3.svg.axis()
		.scale(yscale)
		.orient('left')
		.ticks(6);
	var switchScatter = function(d){
		if(d.name != pgObject.currentScatter){
			pgObject.switchScatter();
			scatter.updatePlot();
			mdspca.selectAll('.scatterSwitch')
				.classed('selected', false)
				.filter(function(p) { return p.name === d.name;})
				.classed('selected', true);
		}
	};
		
// PUBLIC

// Data

// Methods
	this.createPlot = function(){
		var data = pgObject.getScatter();
		
// Setting up the switch
		var scatterSwitch = mdspca.append('g')
			.attr('id', 'mdspca-switch')
			.selectAll('g')
			.data([{'x': 0, 'y': 0, 'name': 'MDS'}, {'x': 40, 'y': 0, 'name': 'PCA'}])
			.enter().append('g')
				.classed('scatterSwitch', true)
				.on('click', switchScatter);
				
		scatterSwitch.append('rect')
			.attr('x', function(d) {return d.x;})
			.attr('y', function(d) {return d.y;})
			.attr('width', 40)
			.attr('height', 20);
		scatterSwitch.append('text')
			.style('text-anchor', 'middle')
			.style('alignment-baseline', 'central')
			.attr('dx', function(d) {return d.x+20;})
			.attr('dy', 10)
			.text(function(d) {return d.name;});
		mdspca.selectAll('.scatterSwitch')
			.filter(function(p) { return p.name === 'MDS';})
			.classed('selected', true);
		
// Setting up the plot
		mdspca.append('g')
			.classed('axis', true)
			.classed('xaxis', true)
			.attr('transform', 'translate(0,' + yscale(0) + ')')
			.call(xaxis);
		
		mdspca.append('g')
			.classed('axis', true)
			.classed('yaxis', true)
			.attr('transform', 'translate(' + xscale(0) + ',0)')
			.call(yaxis);
			
		mdspca.selectAll('.points').data(data)
			.enter()
				.append('circle')
				.attr('class', 'points')
				.classed('geneSet', true)
				.attr('cx', function(d) { return xscale(d.x); })
				.attr('cy', function(d) { return yscale(d.y); })
				.attr('r', 5)
				.on('click', this.onMouseclick)
				.on('mouseover', this.onMouseover)
				.on('mouseout', this.onMouseout);
	};
	this.updatePlot = function(){
		var data = pgObject.getScatter();
		
		xscale.domain(d3.extent(data, function(d) { return +d.x; }));
		yscale.domain(d3.extent(data, function(d) { return +d.y; }));
		
// Rebind updated data
		mdspca.selectAll('.points')
			.data(data, function(d) {return d.name;});
			
// Setup transition
		var transition = mdspca.transition().duration(1000);

		transition.select('.xaxis')
			.attr('transform', 'translate(0,' + yscale(0) + ')')
			.call(xaxis);
		transition.select('.yaxis')
			.attr('transform', 'translate(' + xscale(0) + ',0)')
			.call(yaxis);
		transition.selectAll('.points')
			.delay(function(d, i) {return i*40;})
			.attr('cx', function(d) { return xscale(d.x); })
			.attr('cy', function(d) { return yscale(d.y); });
	};
	this.onMouseclick = function(d){
		if (geneList.isSelected()) {
			var genes = pgObject.fullGeneInfo.filter(function(f,i) {
				return pgObject.fullPan[d.name][i] === 0 ? false : true;
			});
			geneList.updateList(genes);
		} else {
			var remove = false;
			var select;
			var selectClass;

			if (d.name === pgObject.strainSelection.a){
				select = 'a';
				selectClass = 'selectedA';
				pgObject.strainSelection.a = null;
				remove = true;
			} else if (d.name === pgObject.strainSelection.b){
				select = 'b';
				selectClass = 'selectedB';
				pgObject.strainSelection.b = null;
				remove = true;
			} else if (!pgObject.strainSelection.a){
				select = 'a';
				selectClass = 'selectedA';
				pgObject.strainSelection.a = d.name;
			} else if (!pgObject.strainSelection.b){
				select = 'b';
				selectClass = 'selectedB';
				pgObject.strainSelection.b = d.name;
			} else {
				return;
			}
			
			den.selectAll('.leaf')
				.filter(function(p) {return p.name === d.name;})
				.classed(selectClass, !remove);
				
			mdspca.selectAll('circle')
				.filter(function(p) {return p.name === d.name;})
				.classed(selectClass, !remove);
				
			if (remove) {
				circle.exitStrainBar(select);
				if(!(pgObject.strainSelection.a || pgObject.strainSelection.b) && circle.plotState != 'circle') {
					circle.toCircle();
				}
			} else {
				if (circle.plotState != 'bar') {
					circle.toBar(select);
				} else {
					circle.enterStrainBar(select);
				}
			}
		}
	};
	this.onMouseover = function(d){
		mdspca.selectAll('circle')
			.filter(function(p) {return p.name === d.name;})
			.classed('hover', true);
		
		den.selectAll('.leaf')
			.filter(function(p) {return p.name === d.name;})
			.classed('hover', true);
	};
	this.onMouseout = function(d){
		mdspca.selectAll('circle')
			.filter(function(p) {return p.name === d.name;})
			.classed('hover', false);
			
		den.selectAll('.leaf')
			.filter(function(p) {return p.name === d.name;})
			.classed('hover', false);
	};
};
var scatter = new Scatter();

scatter.createPlot();



// Components related to the dendrogram	
var Dendrogram = function(){

// PRIVATE

// Data

// Methods
	var getChildren = function(root){
		var children = [];
		function recurseChildren(root){
			children.push(root);
			if(root.children && root.children.length) {
				root.children.forEach(recurseChildren);
			}
		}
		recurseChildren(root);
		return children;
	};
	var elbow = function(d, i) {
		return "M" + d.source.y + "," + d.source.x + "V" + d.target.x + "H" + d.target.y;
	};
	var heightScale = d3.scale.linear()
		.domain(d3.extent(pgObject.cluster(pgObject.hierachicalData), function(d) {return d.height;}))
		.range([plotDim.denDim.width-120, 0]);
// PUBLIC

// Data

// Methods
	this.heightScale = heightScale; // <- expose as Pangenome.createHCNodeLinks refer to it
	this.createPlot = function(){
		den.append('g')
			.attr('id', 'selectLayer'); // <- For selection bounding box
		
		den.selectAll(".link")
			.data(pgObject.links)
			.enter().append("path")
				.attr("class", "link")
				.attr("d", elbow);
		
		// Invisible links for better selectivity	
		den.selectAll(".hoverLink")
			.data(pgObject.links)
			.enter().append("path")
				.attr("class", "hoverLink")
				.classed('geneSet', true)
				.attr("d", elbow)
				.on('mouseover', this.onLinkMouseover)
				.on('mouseout', this.onLinkMouseout)
				.on('click', this.onLinkMouseclick);
			
		den.selectAll(".node")
			.data(pgObject.nodes)
			.enter().append("g")
				.attr("class", "node")
		        .attr("class", function(n) {
		          if (n.children) {
		            return "inner";
		          } else {
		            return "leaf";
		          }
		        })
				.attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });
			
		
		den.selectAll(".leaf")
			.on('click', this.onLeafMouseclick)
			.on('mouseover', this.onLeafMouseover)
			.on('mouseout', this.onLeafMouseout)
			.classed('geneSet', true)
			.append('circle')
				.attr('r', 5);
				
		den.selectAll(".leaf")
			.append("text")
				.attr("dx", 8)
				.attr("dy", 3)
				.style("text-anchor", "start" )
				.text(function(d) { return d.name; });
	};
	this.onLinkMouseover = function(d){
		var childPos = getChildren(d.source).map(function(c) {return c.x + '-' + c.y;});

		den.selectAll('.link')
			.classed('unhover', true)
			.filter(function(d) {return childPos.indexOf(d.source.x + '-' + d.source.y) != -1;})
			.classed('unhover', false);
	};
	this.onLinkMouseout = function(d){
		den.selectAll('.link')
			.classed('unhover', false);
	};
	this.onLinkMouseclick = function(d){
		var children = getChildren(d.source);
		var childYRange = d3.extent(children, function(d) {return +d.y;});
		var childXRange = d3.extent(children, function(d) {return +d.x;});
		var childRange = {yMin: childYRange[0]-7, yMax: childYRange[1]+7, xMin: childXRange[0]-7, xMax: childXRange[1]+7};
		var childStrains = children.map(function(d) {if (d.name) return d.name;}).filter(function(n) {return n;});
		var doUpdate = true;
		
		if (geneList.isSelected()) {
			var subpan = [];
			childStrains.forEach(function(d) {subpan.push(pgObject.fullPan[d]);});
			var genes = pgObject.fullGeneInfo.filter(function(f, i) {
				return subpan.map(function(d) {return d[i];}).some(function(s) {return s !== 0;});
			});
			
			geneList.updateList(genes);
			
		} else {
			var selector = den.select('#selectLayer').selectAll('.tempPan');
			
			if (JSON.stringify(selector.data()) === JSON.stringify([childRange])){ // <- Test whether the clicked subpan is the same as the already selected
				
				doUpdate = !(pgObject.allStrains.every(function(d) {return childStrains.indexOf(d) != -1;})); // <- Special case of de-selecting the full pangenome
				
				pgObject.setSubPan(pgObject.allStrains);
				
				selector.transition()
					.duration(500)
					.attr('x', function(d) {return d3.mean([d.yMin, d.yMax]);})
					.attr('y', function(d) {return d3.mean([d.xMin, d.xMax]);})
					.attr('width', 0)
					.attr('height', 0)
					.remove();
				
					
			} else {
			
				selector = selector.data([childRange]);
				selector.enter().append('rect')
					.classed('tempPan', true)
					.attr('x', function(d) {return d3.mean([d.yMin, d.yMax]);})
					.attr('y', function(d) {return d3.mean([d.xMin, d.xMax]);})
					.attr('width', 0)
					.attr('height', 0)
					.attr('rx', 10)
					.attr('ry', 10);
					
				selector.transition()
					.duration(1000)
					.attr('x', function(d) {return d.yMin;})
					.attr('y', function(d) {return d.xMin;})
					.attr('width', function(d) {return d.yMax-d.yMin;})
					.attr('height', function(d) {return d.xMax-d.xMin;});
				
				pgObject.setSubPan(childStrains);
			}
			
			circle.barScale.domain([0, pgObject.geneInfo.length]);
			
			var transition;
			if(doUpdate){
				transition = circle.updatePlot();
			} else {
				transition = d3.transition();
			}
			
			transition.each('end', function() {
				geneList.updateList();					
			});
		}
	};
	this.onLeafMouseclick = function(d){
		scatter.onMouseclick(d);
	};
	this.onLeafMouseover = function(d){
		scatter.onMouseover(d);
	};
	this.onLeafMouseout = function(d){
		scatter.onMouseout(d);
	};
};
var dendrogram = new Dendrogram();

pgObject.createHCNodeLinks(dendrogram);
dendrogram.createPlot();



// Components related to the circle chart
var Circle = function(){

// PRIVATE

// Data
	var padding = 0.05;
	var arcBarwidth = 20;
	var arcBarGutter = 10;
	var panGroupInner = 430;
	var panGroupOuter = panGroupInner + arcBarwidth;
	var panGroupText = panGroupOuter + arcBarGutter;
	var goGroupInner = panGroupInner - arcBarwidth - arcBarGutter;
	var goGroupOuter = goGroupInner + arcBarwidth;
	var treeParent = {top: {}, route: []};
	var grandparent;
	var oldTree;
	var newTree;
	
// Methods
	// Scales and axes
	var panGroupScale = d3.scale.linear()
		.range([0, Math.PI*2 - 3*padding]);
	var panGroupScaleToBar = d3.scale.linear()
		.domain([0, Math.PI*2])
		.range([0, plotDim.circleDim.height]);
	var barScale = d3.scale.linear()
		.domain([0, pgObject.geneInfo.length])
		.range([plotDim.circleDim.height, 0]);
	var barAxis = d3.svg.axis()
		.scale(barScale)
		.orient('right')
		.ticks(6)
		.tickSize(-900, 0, 0);
	var panGroupTextScale = function(d){
		var ans = {},
			r = d3.mean([d.endAngle, d.startAngle]);
		ans.x = Math.sin(r)*panGroupText;
		ans.y = -Math.cos(r)*panGroupText;
		ans.r = r*180/Math.PI % 360;
		if (ans.r > 90 && ans.r < 270){
			ans.r = ans.r-180;
		}
		ans.rText = 'rotate('+ans.r+','+ans.x+','+ans.y+')';
		return ans;
	};
	var singletonScale = {'circle': d3.scale.linear(), 'bar': d3.scale.linear()};
	var AccessoryScale = {'circle': d3.scale.linear(), 'bar': d3.scale.linear()};
	var coreScale = {'circle': d3.scale.linear(), 'bar': d3.scale.linear()};
	var oldSingletonScale = {'circle': d3.scale.linear(), 'bar': d3.scale.linear()};
	var oldAccessoryScale = {'circle': d3.scale.linear(), 'bar': d3.scale.linear()};
	var oldCoreScale = {'circle': d3.scale.linear(), 'bar': d3.scale.linear()};
	var goScale = {
		'circle': {
			'new': function(d){
				
				switch(d.domain) {
					case 'Singleton':
						return [singletonScale.circle(d.start), singletonScale.circle(d.end)];
					case 'Accessory':
						return [AccessoryScale.circle(d.start), AccessoryScale.circle(d.end)];
					case 'Core':
						return [coreScale.circle(d.start), coreScale.circle(d.end)];
				}
			},
			'old': function(d){
				
				switch(d.domain) {
					case 'Singleton':
						return [oldSingletonScale.circle(d.start), oldSingletonScale.circle(d.end)];
					case 'Accessory':
						return [oldAccessoryScale.circle(d.start), oldAccessoryScale.circle(d.end)];
					case 'Core':
						return [oldCoreScale.circle(d.start), oldCoreScale.circle(d.end)];
				}
			}
		},
		'bar': {
			'new': function(d){
				
				switch(d.domain) {
					case 'Singleton':
						return [singletonScale.bar(d.start), singletonScale.bar(d.end)];
					case 'Accessory':
						return [AccessoryScale.bar(d.start), AccessoryScale.bar(d.end)];
					case 'Core':
						return [coreScale.bar(d.start), coreScale.bar(d.end)];
				}
			},
			'old': function(d){
				
				switch(d.domain) {
					case 'Singleton':
						return [oldSingletonScale.bar(d.start), oldSingletonScale.bar(d.end)];
					case 'Accessory':
						return [oldAccessoryScale.bar(d.start), oldAccessoryScale.bar(d.end)];
					case 'Core':
						return [oldCoreScale.bar(d.start), oldCoreScale.bar(d.end)];
				}
			}
		}

	};
	var goBarScale = function(d, domain){
		switch(domain) {
			case 'Singleton':
				return singletonScale.bar(d);
			case 'Accessory':
				return AccessoryScale.bar(d);
			case 'Core':
				return coreScale.bar(d);
		}
	};
	var goColorScale = d3.scale.ordinal()
		.domain(d3.range(1,21))
		.range(["#1f77b4", "#aec7e8", "#ff7f0e", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "#c49c94", "#e377c2", "#f7b6d2", "#7f7f7f", "#c7c7c7", "#bcbd22", "#dbdb8d", "#17becf", "#9edae5", 'indigo']);
	var domainColorScale = d3.scale.ordinal()
		.domain(['Singleton', 'Accessory', 'Core'])
		.range(['goldenrod', 'forestgreen', 'brown']);
		
	var xTree = d3.scale.linear()
		.domain([0, plotDim.circleDim.width-70])
		.range([0, plotDim.circleDim.width-70]);
	
	var yTree = d3.scale.linear()
		.domain([0, plotDim.circleDim.height])
		.range([0, plotDim.circleDim.height]);
	
	
	// Generators
	var panGroupArc = d3.svg.arc()
		.innerRadius(panGroupInner)
		.outerRadius(panGroupOuter);
	var goChangeChord = d3.svg.chord()
		.radius(goGroupInner);
	var goGroupArc = d3.svg.arc()
		.innerRadius(goGroupInner)
		.outerRadius(goGroupOuter);
	var goGroupChangeEnter = d3.svg.arc()
		.innerRadius(0)
		.outerRadius(goGroupInner);
	var goGroupChangeExit = d3.svg.arc()
		.innerRadius(goGroupOuter)
		.outerRadius(600);			
	var goGroupArcMark = d3.svg.arc()
		.innerRadius(goGroupInner+arcBarwidth/2)
		.outerRadius(goGroupOuter);
	var goGroupArcExit = d3.svg.arc()
		.innerRadius(goGroupInner+200)
		.outerRadius(goGroupOuter+200);
	var goGroupArcEnter = d3.svg.arc()
		.innerRadius(1)
		.outerRadius(1+arcBarwidth);
	var goGroupArcChange = d3.svg.arc()
		.innerRadius(goGroupInner-arcBarwidth-arcBarGutter)
		.outerRadius(goGroupOuter-arcBarwidth-arcBarGutter);
	var goGroupArcChangeMark = d3.svg.arc()
		.innerRadius(goGroupInner-arcBarwidth-arcBarGutter+arcBarwidth/2)
		.outerRadius(goGroupOuter-arcBarwidth-arcBarGutter);
		
	var treemap = d3.layout.treemap()
//			.size([plotDim.circleDim.width-100, plotDim.circleDim.height])
		//.sticky(true)
//		.children(function(d, depth) {return depth ? null : d.children;})
		.round(false);
		//.value(function(d) {return d.OG.values().length})
	this.treemap = treemap;
	
	// Custom tween
	var panGroupArcTween = function(a) {
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return panGroupArc(i(t));
		};
	};
	var goGroupArcTween = function(a) {
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return goGroupArc(i(t));
		};
	};
	var goGroupArcTweenChange = function(a) {
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return goGroupArcChange(i(t));
		};
	};
	var goGroupArcTweenChangeMark = function(a) {
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return goGroupArcChangeMark(i(t));
		};
	};
	var arcTextXTween = function(a){
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return panGroupTextScale(i(t)).x;
		};
	};
	var arcTextYTween = function(a){
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return panGroupTextScale(i(t)).y;
		};
	};
	var arcTextRTween = function(a){
		var i = d3.interpolate(this._current, a);
		this._current = i(0);
		return function(t) {
			return panGroupTextScale(i(t)).rText;
		};
	};
	
	
	// Helper functions
	var panGroupDim = function(panGroup){
		return [
			{
				'name': 'Singleton',
				'startAngle': padding/2,
				'endAngle': panGroupScale(panGroup.Singleton)+padding/2,
				'start': panGroup.Accessory+panGroup.Core,
				'end': panGroup.total
			}, {
				'name': 'Accessory',
				'startAngle': panGroupScale(panGroup.Singleton)+padding*1.5,
				'endAngle': panGroupScale(panGroup.Singleton+panGroup.Accessory)+padding*1.5,
				'start': panGroup.Core,
				'end': panGroup.Accessory+panGroup.Core
			}, {
				'name': 'Core',
				'startAngle': panGroupScale(panGroup.Singleton+panGroup.Accessory)+padding*2.5,
				'endAngle': panGroupScale(panGroup.Singleton+panGroup.Accessory+panGroup.Core)+padding*2.5,
				'start': 0,
				'end': panGroup.Core
			}
		];
	};
	var updatePanGroupScales = function(dims){
		
// Save old scales
		oldSingletonScale.circle.range(singletonScale.circle.range())
			.domain(singletonScale.circle.domain());
		oldSingletonScale.bar.range(singletonScale.bar.range())
			.domain(singletonScale.bar.domain());
			
		oldAccessoryScale.circle.range(AccessoryScale.circle.range())
			.domain(AccessoryScale.circle.domain());
		oldAccessoryScale.bar.range(AccessoryScale.bar.range())
			.domain(AccessoryScale.bar.domain());
			
		oldCoreScale.circle.range(coreScale.circle.range())
			.domain(coreScale.circle.domain());
		oldCoreScale.bar.range(coreScale.bar.range())
			.domain(coreScale.bar.domain());
		
// Set new scales

		singletonScale.bar.range([barScale(dims[0].end), barScale(dims[0].start)])
			.domain([1, dims[0].end-dims[0].start+1]);
		singletonScale.circle.range([dims[0].startAngle, dims[0].endAngle])
			.domain([1, dims[0].end-dims[0].start+1]);
			
		AccessoryScale.bar.range([barScale(dims[1].end), barScale(dims[1].start)])
			.domain([1, dims[1].end-dims[1].start+1]);
		AccessoryScale.circle.range([dims[1].startAngle, dims[1].endAngle])
			.domain([1, dims[1].end-dims[1].start+1]);	
			
		coreScale.bar.range([barScale(dims[2].end), barScale(dims[2].start)])
			.domain([1, dims[2].end-dims[2].start+1]);
		coreScale.circle.range([dims[2].startAngle, dims[2].endAngle])
			.domain([1, dims[2].end-dims[2].start+1]);
			
	};
	
	var updateCircle = function(goPosition, panGroup) {
	
// Add transient arcs and remove the static						
		circ.selectAll('.update').data(goPosition.transient.updateStart)
			.enter()
			.append('path')
				.classed('update', true)
				.classed('transientArc', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('fill', function(d) { return goColorScale(d.class);})
				.attr('d', goGroupArc)
				.each(function(d) { this._current = d; });
		
		circ.selectAll('.exit').data(goPosition.transient.exit)
			.enter()
			.append('path')
				.classed('exit', true)
				.classed('transientArc', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('fill', function(d) { return goColorScale(d.class);})
				.attr('d', goGroupArc)
				.each(function(d) { this._current = d; });
				
		circ.selectAll('.change').data(goPosition.transient.changeFrom)
			.enter()
			.append('path')
				.each(function(d) { this._current = d; })
				.classed('change', true)
				.classed('transientArc', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('fill', function(d) { return goColorScale(d.class);})
				.attr('d', goGroupArc);
		
		circ.selectAll('.changeMark').data(goPosition.transient.changeFrom)
			.enter()
			.append('path')
				.each(function(d) { this._current = d; })
				.attr('class', function(d) {return d.domain;})
				.classed('changeMark', true)
				.classed('transientArc', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('opacity', 0)
				.attr('d', goGroupArcMark);
		
		circ.selectAll('.enter').data(goPosition.transient.enter)
			.enter()
			.append('path')
				.classed('enter', true)
				.classed('transientArc', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('fill', function(d) { return goColorScale(d.class);})
				.attr('d', goGroupArcEnter)
				.style('opacity', 0);
				
		circ.selectAll('.classArc').remove();
		
// Remove exiting genes and change position of changing genes
		var startTransition = d3.transition()
			.duration(2000)
			.each(function(){
				circ.selectAll('.exit')
					.transition()
						.ease(d3.ease('linear'))
						.attr('d', goGroupArcExit)
						.style('opacity', 1e-6)
						.remove();
				
				circ.selectAll('.change')
					.transition()
						.ease(d3.ease('linear'))
						.attr('d', goGroupArcChange);
				
				circ.selectAll('.changeMark')
					.transition()
						.ease(d3.ease('linear'))
						.attr('d', goGroupArcChangeMark)
						.style('opacity', 1);
			});
					
// Update circle to reflect new data		
		var updateTransition = startTransition.transition()
			.duration(2000)
			.each(function() {
				circ.selectAll('.domainArc').data(panGroup)
					.transition()
						.attrTween('d', panGroupArcTween);
				
				circ.selectAll('.domainText')
					.data(panGroup)
					.transition()
						.attrTween("x", arcTextXTween)
						.attrTween("y", arcTextYTween)
						.attrTween('transform', arcTextRTween);
						
				circ.selectAll('.change').data(goPosition.transient.changeTo, function(d) {return d.key;})
					.transition()
						.ease(d3.ease('linear'))
						.attrTween('d', goGroupArcTweenChange);
				
				circ.selectAll('.changeMark').data(goPosition.transient.changeTo, function(d) {return d.key;})
					.transition()
						.ease(d3.ease('linear'))
						.attrTween('d', goGroupArcTweenChangeMark);
				
				circ.selectAll('.update').data(goPosition.transient.updateEnd)
					.transition()
						.attrTween('d', goGroupArcTween);
			});
		
// Insert changing and new genes	
		var endTransition = updateTransition.transition()
			.duration(2000)
			.each(function(d) {
				circ.selectAll('.change')
					.transition()
						.attr('d', goGroupArc);
				
				circ.selectAll('.changeMark')
					.transition()
						.attr('d', goGroupArcMark);
				
				circ.selectAll('.enter')
					.transition()
						.attr('d', goGroupArc)
						.style('opacity', 1);
			});
			
// Change to static arcs	
			
						
		endTransition.transition()
			.duration(2000)
			.each(function() {
				circ.selectAll('.classArc').data(goPosition.overall)
					.enter().append('path')
						.classed('classArc', true)
						.classed('geneSet', true)
						.classed('emptyClass', function(d) {return d.size === 0;})
						.style('fill', function(d) { return goColorScale(d.class);})
						.attr('d', goGroupArc)
						.each(function(d) { this._current = d; })
						.style('opacity', 0);
					
				circ.selectAll('.classArc')
						.transition()
							.styleTween('opacity', opacityToOneTween);
			})
			.each('end', function() {
				circ.selectAll('.classArc')
					.on('mouseover', circle.goHover)
					.on('mouseout', circle.goUnhover)
					.on('click', circle.goClick);
				
				circ.selectAll('.transientArc').remove();
				
				unmuteInteraction();
			});
		return endTransition;
	};
	var updateBar = function(goPosition, panGroup, state) {
		
		updateGeneLink();
		var transition = d3.transition()
			.duration(2000)
			.each(function() {
				circ.selectAll('.domainRect')
					.data(panGroup)
					.each(function(d) {
						d.innerRadius = panGroupInner;
						d.outerRadius = panGroupOuter;
						d.height = barScale(d.start) - barScale(d.end);
						d.y = barScale(d.end);
						d.x = state == 'bar' ? plotDim.circleDim.width/2 + arcBarGutter : plotDim.circleDim.width-10;
						d.width = 10;
					})
					.transition()
						.attr('y', function(d) {return d.y;})
						.attr('height', function(d) {return d.height;});
				
				circ.selectAll('.classRect')
					.data(goPosition.overall, function(d) {return d.domain+d.class;})
					.each(function(d) {
						d.innerRadius = goGroupInner;
						d.outerRadius = goGroupOuter;
						d.height = goScale.bar.new(d)[1] - goScale.bar.new(d)[0];
						d.y = goScale.bar.new(d)[0];
						d.x = state == 'bar' ? plotDim.circleDim.width/2 - arcBarwidth: plotDim.circleDim.width-arcBarwidth-arcBarGutter-10;
						d.width = arcBarwidth;					
					})
					.transition()
						.attr('y', function(d) {return d.y;})
						.attr('height', function(d) {return d.height;});
				
				circ.selectAll('.strainBar')
					.each(function(d) {
						d.y = barScale(d.end);
						d.height = barScale(d.start)-d.y;
					})
					.transition()
						.attr('y', function(d) {return d.y;})
						.attr('height', function(d) {return d.height;});
				
				circ.select('.barGrid')
					.transition()
						.call(barAxis);
			});
		transition.transition()
			.each('end', function() {
				unmuteInteraction();
			});
		
		return transition;
	};
	var changeTree = function(d) {
		d.y = goBarScale(d.start, d.domain);
		d.height = goBarScale(d.end, d.domain) - d.y;
		
		var trapezoid = getTrapezoidCoor(d);
		
		grandparent.select('.trapez').datum(trapezoid);
		
		treeParent.top = d;
		treeParent.route = [];
		
		pgObject.assignTerms(GOmap, d.domain);
		var tree = copyTree(GOmap[pgObject.goMapping.goTerm[d.class-1]], 2);
		treeParent.route.push(tree);			
		xTree.domain([0, plotDim.circleDim.width-70]);
	
		yTree.domain([0, plotDim.circleDim.height]);

		
		oldTree = newTree;
		initializeTree(tree);
		layoutTree(tree);
		displayTree(tree);
		
		d3.transition()
			.duration(750)
			.each(function(d) {
				oldTree.selectAll('rect').transition()
					.style('opacity', 0)
					.remove();
				oldTree.selectAll('text').transition()
					.style('opacity', 0)
					.remove();
					
				newTree.selectAll('rect').transition()
					.style('opacity', 1);
				newTree.selectAll('text').transition()
					.style('opacity', 1);
				
				grandparent.selectAll('.trapez').transition()			
					.attr('points', function(d) {return d.join(' ');});
			});
	};
	var updateTree = function(d, duration) {
		d.y = goBarScale(d.start, d.domain);
		d.height = goBarScale(d.end, d.domain) - d.y;
		var trapezoid = getTrapezoidCoor(d);
		
		grandparent.select('.trapez').datum(trapezoid);
		
		pgObject.assignTerms(GOmap, d.domain);
		
		var tempTreeParent = [];
		
		var tree = copyTree(GOmap[treeParent.route[0].id], 2);
		tempTreeParent.push(tree);
		
		initializeTree(tree);
		layoutTree(tree);
		
		var transition = d3.transition();
		
		for (var i = 1; i < treeParent.route.length; i++) {
			tree = tempTreeParent[i-1].children.filter(function(f) {return f.id == treeParent.route[i].id;})[0];
			if (tree) {
				tree.children = copyTree(GOmap[tree.id], 2).children;
				layoutTree(tree);
				
				tempTreeParent.push(tree);
			} else {
				tree = tempTreeParent[tempTreeParent.length-1];
				
/*					for(var j = 0; j < treeParent.route.length-1; j++) {
					transition = transition
						.duration(750)
						.each(function() {
							transitionOut()
						}).transition()
				}
				transition = transition
					.duration(1000)
					.transition()*/
				break;
			}
			
		}
		
		transition
			.duration(duration)
			.each(function(d) {
				xTree.domain([tree.x, tree.x + tree.dx]);
				yTree.domain([tree.y, tree.y + tree.dy]);
				
				treeParent.route = tempTreeParent;
				oldTree = newTree;
				displayTree(tree);
				
				oldTree.selectAll('rect').transition()
					.style('opacity', 0)
					.remove();
				oldTree.selectAll('text').transition()
					.style('opacity', 0)
					.remove();
					
				newTree.selectAll('rect').transition().ease(d3.ease('cubic-out'))
					.style('opacity', 1);
				newTree.selectAll('text').transition()
					.style('opacity', 1);
				
				grandparent.selectAll('.trapez').transition()			
					.attr('points', function(d) {return d.join(' ');});
			})
			.each('end', function() {
				unmuteInteraction();
			});
		return transition;
	};
	var addGeneLink = function() {
		['a', 'b'].forEach(function(i) {
			if (pgObject.strainSelection[i]) {
				var data = pgObject.strainGO(pgObject.strainSelection[i]);
				var links = pgObject.createGeneLinkBands(data, i, barScale, goBarScale);
				
				var selection = circ.selectAll('.geneLink'+'-'+i).data(links, function(d) {return d.domain+'-'+d.class+'-'+d.type;});
				
				selection.enter().append('path')
					.attr('class', 'geneLink'+'-'+i)
					.classed('geneLink', true)
					.classed('geneSet', true)
					.classed('simLink', function(d) {return d.type == 'similar';})
					.attr('d', function(d) {return thickDiagonal(d);})
					.attr('fill', function(d) {return domainColorScale(d.domain);})
					.style('opacity', 0)
					.on('click', geneLinkClick);
				
				circ.selectAll('.geneLink'+'-'+i).transition()
					.duration(1000)
					.styleTween('opacity', opacityToOneTween);
			}
		});
	};
	var updateGeneLink = function(d) {
		['a', 'b'].forEach(function(i) {
			if (pgObject.strainSelection[i]) {
				var data = pgObject.strainGO(pgObject.strainSelection[i]);
				var links = pgObject.createGeneLinkBands(data, i, barScale, goBarScale);
				var selection = circ.selectAll('.geneLink'+'-'+i).data(links, function(d) {return d.domain+'-'+d.class+'-'+d.type;});
				
				selection.exit()
					.remove();
				
				d3.transition()
					.duration(2000)
					.each(function() {
						selection.transition()
							.attr('d', function(d) {return thickDiagonal(d);});
						
						selection.enter().append('path')
								.attr('class', 'geneLink'+'-'+i)
								.classed('geneLink', true)
								.classed('geneSet', true)
								.classed('simLink', function(d) {return d.type == 'similar';})
								.attr('d', function(d) {return thickDiagonal(d);})
								.attr('fill', function(d) {return domainColorScale(d.domain);})
								.style('opacity', 0)
								.on('click', geneLinkClick);
					})
					.transition()
						.duration(500)
						.each(function() {
							circ.selectAll('.geneLink'+'-'+i).transition()
								.style('opacity', 1);
						});
			}
		});
	};
	var muteInteraction = function() {
		den.selectAll('.hoverLink')
			.on('click', null);
		den.selectAll(".leaf")
			.on('click', null);
		mdspca.selectAll('.points')
			.on('click', null);
	};
	var unmuteInteraction = function() {
		den.selectAll('.hoverLink')
			.on('click', dendrogram.onLinkMouseclick);
		den.selectAll(".leaf")
			.on('click', dendrogram.onLeafMouseclick);
		mdspca.selectAll('.points')
			.on('click', scatter.onMouseclick);
	};
	var addBarGrid = function() {
		circ.insert('g', ':first-child')
			.classed('barGrid', true)
			.attr('transform', 'translate(925,0)')
			.style('opacity', 0)
			.call(barAxis);
			
		circ.selectAll('.barGrid').append('text')
			.attr("class", "label")
		    .style("text-anchor", "middle")
		    .attr('dx', 500)
		    .attr('dy', -40)
		    .attr("transform", "rotate(90)")
		    .text("Number of genes");
		    
		circ.selectAll('.barGrid')
			.transition()
			.style('opacity', 1);
	};
	var removeBarGrid = function() {
		circ.selectAll('.barGrid')
			.transition()
			.style('opacity', 0)
			.remove();
	};
	var arcToRect = function() {
		circ.selectAll('.domainRect').data(circ.selectAll('.domainArc').data())
			.enter().append('rect')
				.attr('class', function(d) {return d.name;})
				.classed('domainRect', true)
				.classed('geneSet', true)
				.attr('x', function(d) {return d.x;})
				.attr('y', function(d) {return d.y;})
				.attr('height', function(d) {return d.height;})
				.attr('width', function(d) {return d.width;})
				.on('mouseover', circle.panGroupHover)
				.on('mouseout', circle.panGroupUnhover)
				.on('click', circle.panGroupClick);
		
		circ.selectAll('.classRect').data(circ.selectAll('.classArc').data())
			.enter().append('rect')
				.classed('classRect', true)
				.classed('geneSet', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.attr('x', function(d) {return d.x;})
				.attr('y', function(d) {return d.y;})
				.attr('height', function(d) {return d.height;})
				.attr('width', function(d) {return d.width;})
				.style('fill', function(d) {return goColorScale(d.class);})
				.on('mouseover', circle.goHover)
				.on('mouseout', circle.goUnhover)
				.on('click', circle.goClick);
			
		circ.selectAll('.domainArc, .classArc').remove();
	};
	var arcTextToLegend = function() {
		circ.selectAll('.domainLegend').data(circ.selectAll('.domainText').data())
			.enter().append('rect')
				.attr('class', function(d) {return d.name;})
				.classed('domainLegend', true)
				.attr('x', 0)
				.attr('y', function(d, i) {return plotDim.circleDim.height + 100 + 5+20*i;})
				.attr('height', 10)
				.attr('width', 10)
				.style('opacity', 0);
		
		var transition = d3.transition()
			.each(function() {
				circ.selectAll('.domainText')
					.transition()
						.attr('x', 15)
						.attr('y', function(d, i) {return plotDim.circleDim.height + 100 + 10+20*i;})
						.attr('transform', 'rotate(0, 10, '+ function(d, i) {return 10+20*i;} +')')
						.style('text-anchor', 'start');
			}).transition()
				.duration(500)
				.each(function() {
					circ.selectAll('.domainLegend').transition()
						.style('opacity', 1);
				});
		
		return transition;
	}; // <- Puts the legend outside view until I know where to position it
	var legendToArcText = function() {
		circ.selectAll('.domainLegend').transition()
			.ease(d3.ease('exp-out'))
			.style('opacity', 0)
			.remove();
			
		circ.selectAll('.domainText')
			.data(circ.selectAll('.domainArc').data())
			.transition()
				.attr('x', function(d) {return panGroupTextScale(d).x;})
				.attr('y', function(d) {return panGroupTextScale(d).y;})
				.attr('transform', function(d) {return panGroupTextScale(d).rText;})
				.style('text-anchor', 'middle');
	};

	
	// All treemap functions inspired by http://bost.ocks.org/mike/treemap/ with modifications
	var initializeTree = function(root) {
		root.x = root.y = 0;
		root.dx = plotDim.circleDim.width-70;
		root.dy = plotDim.circleDim.height;
		root.depth = 0;
	};
	var layoutTree = function(d) {
		if (d.children) {
			treemap.nodes({children: d.children});
			d.children.forEach(function(c) {
				c.x = d.x + c.x * d.dx;
				c.y = d.y + c.y * d.dy;
				c.dx *= d.dx;
				c.dy *= d.dy;
				c.parent = d;
				layoutTree(c);
			});
		}
	};
	var transition = function(d) {
		if (!d) return;
		
		d.children = copyTree(GOmap[d.id], 2).children;
		layoutTree(d);
		
		oldTree = newTree;
		displayTree(d);
		var	t1 = oldTree.transition().ease(d3.ease('linear')).duration(500);
		var	t2 = newTree.transition().ease(d3.ease('linear')).duration(500);
		
		
		
		// Update the domain only after entering new elements.
		xTree.domain([d.x, d.x + d.dx]);
		yTree.domain([d.y, d.y + d.dy]);
		
		// Enable anti-aliasing during the transition.
//			svg.style("shape-rendering", null);
		
		// Draw child nodes on top of parent nodes.
		svg.selectAll(".depth").sort(function(a, b) { return a.depth - b.depth; });
		
		// Fade-in entering text.
		
		// Transition to the new view.
		t1.selectAll("text").call(textTree).style("opacity", 0);
		t2.selectAll("text").call(textTree).styleTween("opacity", opacityToOneTween);
		t1.selectAll("rect").call(rectTree)
			.style('opacity', 0);
		t2.selectAll("rect").call(rectTree)		
			.styleTween('opacity', opacityToOneTween);
		
		// Remove the old node when the transition is finished.
		t1.remove().each("end", function() {
//				t2.selectAll("text").call(textTree).style("fill-opacity", 1);
//				t2.selectAll("rect").call(rectTree);			
//				svg.style("shape-rendering", "crispEdges");
		});
	};
	var transitionIn = function(d) {
		if (geneList.isSelected()) {
			var genes = pgObject.fullGeneInfo.filter(function(f) {return d.geneIDs.indexOf(f.id) != -1;});
			
			geneList.updateList(genes);
		} else if (d3.select(this).classed('children')){
			transition(d);
			treeParent.route.push(d);
		}
	};
	var transitionOut = function() {
		if (!geneList.isSelected()) {
			treeParent.route.pop();
			if (treeParent.route.length === 0) {
				circle.toCircle();
			} else {
				transition(treeParent.route[treeParent.route.length-1]);
			}
		}
	};
	var displayTree = function(d) {
		grandparent
			.datum(d)
			.on("click", transitionOut)
			.select("text")
			.text(nameTree(d)+': '+d.name)
			.on('mouseover', circle.grandparentHover)
			.on('mouseout', circle.treeChildUnhover);
	
		newTree = circ.insert("g", ".grandparent")
			.datum(d)
			.attr("class", "depth");
		
		var g = newTree.selectAll("g")
			.data(d.children)
			.enter().append("g")
			.classed('geneSet', true)
			.on("click", transitionIn)
			.on('mouseover', circle.treeChildHover)
			.on('mouseout', circle.treeChildUnhover);
		
		g.filter(function(d) { return d.children; })
			.classed("children", true);
			
		
		g.selectAll(".child")
			.data(function(d) { return d.children || [d]; })
			.enter().append("rect")
			.attr("class", "child")
			.style('opacity', 0)
			.style('fill', goColorScale(pgObject.goMapping.goTerm.indexOf(treeParent.route[0].id)+1))
			.call(rectTree);
		
		g.append("rect")
			.attr("class", "parent")
			.style('opacity', 0)
			.call(rectTree);
		
		g.append("text")
			.attr("dy", ".75em")
			.text(function(d) { return d.name; })
			.style('opacity', 0)
			.call(textTree);
			
		
		return g;
	};
	var textTree = function(text) {
		text.attr("x", function(d) { return xTree(d.x) + 6; })
			.attr("y", function(d) { return yTree(d.y) + 6; });
	};
	var rectTree = function(rect) {
		rect.attr("x", function(d) { return xTree(d.x); })
			.attr("y", function(d) { return yTree(d.y); })
			.attr("width", function(d) { return xTree(d.x + d.dx) - xTree(d.x); })
			.attr("height", function(d) { return yTree(d.y + d.dy) - yTree(d.y); });
	};
	var nameTree = function(d) {
		return d.parent ? 
			nameTree(d.parent) + "  >  " + d.id : 
			d.id;
	};
	var toBarDataPrep = function(state) {
		circ.selectAll('.domainArc')
			.each(function(d) {
				d.innerRadius = panGroupInner;
				d.outerRadius = panGroupOuter;
				d.height = barScale(d.start) - barScale(d.end);
				d.y = barScale(d.end);
				d.x = state == 'bar' ? plotDim.circleDim.width/2 + arcBarGutter : plotDim.circleDim.width-10;
				d.width = 10;
			});
		circ.selectAll('.classArc')
			.each(function(d) {
				d.innerRadius = goGroupInner;
				d.outerRadius = goGroupOuter;
				d.height = goScale.bar.new(d)[1] - goScale.bar.new(d)[0];
				d.y = goScale.bar.new(d)[0];
				d.x = state == 'bar' ? plotDim.circleDim.width/2 - arcBarwidth: plotDim.circleDim.width-arcBarwidth-arcBarGutter-10;
				d.width = arcBarwidth;					
			});
	};
	var toCircleDataPrep = function(state) {
		circ.selectAll('.domainArc').data(circ.selectAll('.domainRect').data())
			.enter().append('path')
				.each(function(d) {
					d.innerRadius = panGroupInner;
					d.outerRadius = panGroupOuter;
					d.height = barScale(d.start) - barScale(d.end);
					d.y = barScale(d.end);
					d.x = state == 'bar' ? plotDim.circleDim.width/2 + arcBarGutter : plotDim.circleDim.width-10;
					d.width = 10;
				})
				.attr('class', function(d) {return d.name;})
				.classed('domainArc', true)
				.classed('geneSet', true)
				.attr('d', function(d) {
					return 'M'+ d.x +','+ d.y +' l'+ d.width +','+ 0 +' l'+ 0 +','+ d.height +' l'+ -(d.width) +','+ 0 +'Z';
				})
				.each(function(d) { this._current = d; })
				.on('mouseover', circle.panGroupHover)
				.on('mouseout', circle.panGroupUnhover)
				.on('click', circle.panGroupClick);
				
		circ.selectAll('.classArc').data(circ.selectAll('.classRect').data())
			.enter().append('path')
				.each(function(d) {
					d.innerRadius = goGroupInner;
					d.outerRadius = goGroupOuter;
					d.height = goScale.bar.old(d)[1] - goScale.bar.old(d)[0];
					d.y = goScale.bar.old(d)[0];
					d.x = state == 'bar' ? plotDim.circleDim.width/2 - arcBarwidth: plotDim.circleDim.width-arcBarwidth-arcBarGutter-10;
					d.width = arcBarwidth;
				})
				.classed('classArc', true)
				.classed('geneSet', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('fill', function(d) { return goColorScale(d.class);})
				.attr('d', function(d) {
					return 'M'+ d.x +','+ d.y +' l'+ d.width +','+ 0 +' l'+ 0 +','+ d.height +' l'+ -(d.width) +','+ 0 +'Z';
				})
				.each(function(d) { this._current = d; })
				.on('mouseover', circle.goHover)
				.on('mouseout', circle.goUnhover)
				.on('click', circle.goClick);
				
		circ.selectAll('.domainRect, .classRect').remove();
	};
	var getTrapezoidCoor = function(d) {
		var x0 = plotDim.circleDim.width-70;
		var x1 = plotDim.circleDim.width-40;
		return [[x0, 0], [x1, d.y], [x1, d.y+d.height], [x0, plotDim.circleDim.height]];
	};
	var barToCircle = function(duration) {
		toCircleDataPrep('bar');
		
		var transition = d3.transition()
			.duration(500)
			.each(function() {
				removeBarGrid();
			});
			
		transition = transition.transition()
			.each(function() {
				closeCircle(duration);
			});
		
		return transition;
	};
	var barToTree = function(d, duration) {
		var transition = moveBar(duration, 'side')
			.each(function() {
				removeBarGrid();
			});
		
		transition = transition.transition()
			.each(function() {
				enterTreemap(d, 750);
			});
		
		return transition;
	};
	var circleToBar = function(index, duration) {
	
		toBarDataPrep('bar');
		
		var transition = openCircle(duration);
		
		transition = transition.transition()
				.duration(500)
				.each(function() {
					addBarGrid();
					circle.enterStrainBar(index);
				});
		
		return transition;
	};
	var circleToTree = function(d, duration) {
			
		toBarDataPrep('tree');

		var transition = openCircle(duration);
		
		transition = transition.transition()
			.each(function() {
				enterTreemap(d, 500);
			});
		
		return transition;
	};
	var treeToCircle = function(duration) {
		toCircleDataPrep('tree');
		
		var transition = exitTreemap(500);
		
		transition = transition.transition()
			.each(function() {
				closeCircle(duration);
			});
		
		
		return transition;
	};
	var treeToBar = function(index, duration) {
		var transition = exitTreemap(750);
	
		transition = transition.transition()
			.each(function() {
				moveBar(duration, 'center');
			});
		
		transition = transition.transition()
			.duration(500)
			.each(function() {
				addBarGrid();
				circle.enterStrainBar(index);
			});
			
		return transition;
	};
	var openCircle = function(duration) {
	
		muteInteraction();

		var transition = d3.transition()
			.duration(duration)
			.each(function() {
				circ.transition()
					.attr('transform', 'translate(' + (+(plotDim.margins.left) +(plotDim.mdsDim.width) + 50) + ',' + (plotDim.margins.top) + ')');
				
				circ.selectAll('.domainArc')
					.transition()
					.tween('arc', arcToRectTween);
					
				circ.selectAll('.classArc')
					.on('mouseover', null)
					.on('mouseout', null)
						.transition()
						.tween('arc', arcToRectTween);
					
				arcTextToLegend();
				
		}).each('end', function(){
			arcToRect();
			
			unmuteInteraction();

		});
		
		return transition;
	};
	var closeCircle = function(duration) {
		muteInteraction();
		
		var transition = d3.transition()
			.duration(duration)
			.each(function() {
			
				circ.transition()
					.attr('transform', 'translate(' + (+(plotDim.margins.left) +(plotDim.mdsDim.width) + 50 + plotDim.circleDim.width/2) + ',' + (plotDim.margins.top + plotDim.circleDim.height/2) + ')');
				
				circ.selectAll('.domainArc')
					.transition()
					.tween('arc', rectToArcTween);
					
				circ.selectAll('.classArc')
					.transition()
					.tween('arc', rectToArcTween);
					
				legendToArcText();
			})
			.each('end', function() {
				unmuteInteraction();
			});
		
		return transition;
	};
	var moveBar = function(duration, moveTo) {
	
		var transition = d3.transition()
			.duration(duration)
			.each(function() {
				circ.selectAll('.domainRect')
					.each(function(d) {
						d.x = moveTo == 'center' ? plotDim.circleDim.width/2 + arcBarGutter : plotDim.circleDim.width-10;
					})
					.transition()
						.attr('x', function(d) {return d.x;});
				
				circ.selectAll('.classRect')
					.each(function(d) {
						d.x = moveTo == 'center' ? plotDim.circleDim.width/2 - arcBarwidth: plotDim.circleDim.width-arcBarwidth-arcBarGutter-10;
					})
					.transition()
						.attr('x', function(d) {return d.x;});
			});
		
		return transition;
			
	};
	var enterTreemap = function(d, duration) {
		pgObject.assignTerms(GOmap, d.domain);
		
		treeParent.top = d;
		var tree = copyTree(GOmap[pgObject.goMapping.goTerm[d.class-1]], 2);
		treeParent.route.push(tree);

		grandparent = circ.append("g")
			.attr("class", "grandparent");
		
		grandparent.append("rect")
			.attr("y", -20)
			.attr("width", plotDim.circleDim.width-70)
			.attr("height", 20);
		
		grandparent.append("text")
			.attr("x", 6)
			.attr("y", 6 - 20)
			.attr("dy", ".75em");
			
		trapezoid = getTrapezoidCoor(d);
		grandparent.append('polygon')
			.datum(trapezoid)
			.classed('trapez', true)
			.attr('points', function(d) {return d.join(' ');});
			
		initializeTree(tree);
		layoutTree(tree);
		displayTree(tree);
		grandparent
			.style('opacity', 0);
		
		
		var transition = d3.transition()
			.duration(duration)
			.each(function() {
				newTree.selectAll('rect').transition()
					.styleTween('opacity', opacityToOneTween);
				newTree.selectAll('text').transition()
					.styleTween('opacity', opacityToOneTween);
				grandparent.transition()
					.styleTween('opacity', opacityToOneTween);
			});
		
		return transition;
	};
	var exitTreemap = function(duration) {
		var transition = d3.transition()
			.duration(duration)
			.each(function() {
				newTree.selectAll('rect, text')
					.transition()
						.style('opacity', 0)
						.remove();
				
				grandparent.selectAll('rect, text, polygon')
					.transition()
						.style('opacity', 0)
						.remove();
			});
		
		return transition;
	};
	var circleGoHover = function(d) {
		infoObject.createGoDescription(d);
		
		info.selectAll('#legend td')
			.classed('hover', function(f) {return f.index == d.class;});
		
		infoObject.setGOPanStat(pgObject.goOrder().overall.filter(function(f) {return f.class == d.class;}));
		
		infoObject.createGOPanPlot();
		
		var flux = pgObject.goFlux(d, goScale);
		
		if(flux){
			infoObject.createGoStat(flux);
			var layer = circ.select('#goChangeLayer');
			
			layer.selectAll('.goChange').data(flux.change)
				.enter()
					.append('path')
						.attr('class', function(d) {return d.class;})
						.classed('goChord', true)
						.attr('d', goChangeChord);
				
			if(flux.enter){
				layer.selectAll('.goWedge').data([flux.enter])
					.enter()
						.append('path')
							.classed('in', true)
							.classed('goChord', true)
							.attr('d', goGroupChangeEnter);
			}
			if(flux.exit){
				layer.selectAll('.goBurst').data([flux.exit])
					.enter()
						.append('path')
							.classed('goChord', true)
							.attr('d', goGroupChangeExit)
							.style('fill', "url(#goExitGradient)");
			}
		}
	};
	var circleGoUnhover = function() {
		info.selectAll('#legend td')
			.classed('hover', false);
		info.select('#godescription').remove();
		info.select('#goflux').remove();
		info.select('#GOPanPlot').remove();
		circ.selectAll('.goChord').remove();
	};
	var circleGoClick = function(d) {
		circle.toTree(d);
	};
	var treeGoClick = function(d) {
		changeTree(d);
	};
	var barGoClick = function(d) {
		var transition = d3.transition()
			.duration(500)
			.each(function() {
				for(var i in pgObject.strainSelection) {
					if (pgObject.strainSelection[i]) {
						circle.exitStrainBar(i);
						pgObject.strainSelection[i] = null;
					}
				}
				den.selectAll('.leaf')
					.classed('selectedA', false)
					.classed('selectedB', false);
					
				mdspca.selectAll('circle')
					.classed('selectedA', false)
					.classed('selectedB', false);

			});
			
		transition = transition.transition()
			.each(function() {
				circle.toTree(d);
			});
		
	};
	var circlePanGroupHover = function(d) {
		infoObject.setPanGroupStat(pgObject.goOrder().overall.filter(function(f) {return f.domain == d.name;}));
		infoObject.createPanGroupPlot();
	};
	var circlePanGroupUnhover = function() {
		infoObject.resetPanGroupStat();
		info.select('#pangroupplot').remove();
	};
	var treePanGroupClick = function(d) {
		var curClass = pgObject.goMapping.goTerm.indexOf(treeParent.route[0].id)+1;
		d = circ.selectAll('.classRect').data().filter(function(f) {return f.domain == d.name && f.class == curClass;})[0];
		updateTree(d, 750);
	};
	var geneLinkClick = function(d) {
		if (geneList.isSelected()) {
			geneList.updateList(d.genes);
		}
	};
	


// PUBLIC	

// Data
	this.plotState = 'circle';
	
// Methods
	this.barScale = barScale; // <- Access when setting subpan
	this.goColorScale = goColorScale; // <- Access from infoObject to get Legends etc.
	this.domainColorScale = domainColorScale; // <- Access from infoObject to get Legends etc.

	
	// Plotting functions
	this.createPlot = function(){
		
		var panGroupCount = pgObject.panGroupStat();
		panGroupScale.domain([0,panGroupCount.total]);
		
		var panGroup = panGroupDim(panGroupCount);
		updatePanGroupScales(panGroup);
		
		var goPosition = pgObject.goPos(goScale, true);
		
		circ.selectAll('.domainArc').data(panGroup)
			.enter().append('path')
				.attr('class', function(d) {return d.name;})
				.classed('domainArc', true)
				.classed('geneSet', true)
				.attr('d', panGroupArc)
				.each(function(d) { this._current = d; })
				.on('mouseover', this.panGroupHover)
				.on('mouseout', this.panGroupUnhover)
				.on('click', this.panGroupClick);
						
		circ.selectAll('.domainText').data(panGroup)
			.enter().append("text")
				.classed('domainText', true)
		        .attr("x", function(d) {return panGroupTextScale(d).x;})
		        .attr("y", function(d) {return panGroupTextScale(d).y;})
		        .attr('transform', function(d) {return panGroupTextScale(d).rText;})
		        .style('text-anchor', 'middle')
		        .style('alignment-baseline', 'central')
		        .text(function(d) { return d.name; })
		        .each(function(d) { this._current = d; });
		
		circ.selectAll('.classArc').data(goPosition.overall)
			.enter().append('path')
				.classed('classArc', true)
				.classed('geneSet', true)
				.classed('emptyClass', function(d) {return d.size === 0;})
				.style('fill', function(d) { return goColorScale(d.class);})
				.attr('d', goGroupArc)
				.each(function(d) { this._current = d; })
				.on('mouseover', this.goHover)
				.on('mouseout', this.goUnhover)
				.on('click', this.goClick);
		
		infoObject.setPanStat({
			size: panGroupCount.total,
			Singleton: panGroupCount.Singleton,
			Accessory: panGroupCount.Accessory,
			Core: panGroupCount.Core,
			nStrain: pgObject.strains.length
		});
		infoObject.initializePanStat();
	};
	this.updatePlot = function(){
	
		var panGroupCount = pgObject.panGroupStat();
		panGroupScale.domain([0,panGroupCount.total]);
		
		var panGroup = panGroupDim(panGroupCount);
		updatePanGroupScales(panGroup);

		var goPosition = pgObject.goPos(goScale);

		infoObject.setPanStat({
			'size': panGroupCount.total,
			'Singleton': panGroupCount.Singleton,
			'Accessory': panGroupCount.Accessory,
			'Core': panGroupCount.Core,
			'nStrain': pgObject.strains.length
		});
		infoObject.updatePanStat(6000);
		
		muteInteraction();
		
		switch (this.plotState) {
			case 'circle':
				return updateCircle(goPosition, panGroup);
			case 'bar':
				return updateBar(goPosition, panGroup, this.plotState);
			case 'tree':
				var transition = updateBar(goPosition, panGroup, this.plotState);
				var d = pgObject.oldGOpos.filter(function(f) {return f.domain == treeParent.top.domain && f.class == treeParent.top.class;})[0];
				if (d.size !== 0) {
					updateTree(d, 2000);
				} else {
					exitTreemap(2000);
					transition.transition()
						.each(function() {
							circle.toCircle();
						});
				}
				return transition;
		}

	};
	this.toBar = function(index){
		var transition;
		if (this.plotState == 'circle') {
			barScale.domain([0, pgObject.geneInfo.length]);
			updatePanGroupScales(circ.selectAll('.domainArc').data(), true);
			transition = circleToBar(index, 2000);
		} else if (this.plotState == 'tree') {
			transition = treeToBar(index, 1000);
		}
		
		this.plotState = 'bar';
		
		return transition;
	};
	this.toCircle = function(){
		updatePanGroupScales(circ.selectAll('.domainRect').data());
		var transition;
		
		if (this.plotState == 'bar') {
			transition = barToCircle(2000);
		} else if (this.plotState == 'tree') {
			transition = treeToCircle(2000);
		}
					
		this.plotState = 'circle';

		return transition;
	};
	this.toTree = function(d) {
		var transition;

		if (this.plotState == 'circle') {
			barScale.domain([0, pgObject.geneInfo.length]);
			updatePanGroupScales(circ.selectAll('.domainArc').data(), true);
			transition = circleToTree(d, 2000);
		} else if (this.plotState == 'bar') {
			transition = barToTree(d, 1000);
		}

		this.plotState = 'tree';
		
		return transition;
	};
	this.enterStrainBar = function(index) {
		var data = pgObject.strainGO(pgObject.strainSelection[index]);
		var linkBands = pgObject.createGeneLinkBands(data, index, barScale, goBarScale);
				
		data.forEach(function(d) {
			d.y = barScale(d.end);
			d.height = barScale(d.start)-d.y;
		});
		circ.selectAll('.strainBar'+'-'+index).data(data)
			.enter()
				.append('rect')
					.attr('class', 'strainBar'+'-'+index)
					.classed('strainBar', true)
					.classed('geneSet', true)
					.attr('y', function(d) { return d.y;})
					.attr('x', function(d) {
						if(index == 'a'){
							return 50-100;
						} else {
							return plotDim.circleDim.width-70+100;
						}
					})
					.attr('height', function(d) { return d.height;})
					.attr('width', 20)
					.style('fill', function(d) {return goColorScale(d.class);})
					.style('opacity', 0)
					.on('click', circle.strainGoClick);
		//			.on('mouseover', circle.strainGoHover)
		//			.on('mouseout', circle.strainGoUnhover)
		
		circ.append('circle')
			.attr('cx', index == 'a' ? 50-100+10 : plotDim.circleDim.width-70+100+10)
			.attr('cy', plotDim.circleDim.height+10)
			.attr('r', 5)
			.attr('class', index == 'a' ? 'strainMark-a' : 'strainMark-b')
			.classed('strainMark', true)
			.style('opacity', 0);
		
/*			circ.append('g')
			.classed('geneLinkGroup', true)
			.attr('id', 'geneLink'+'-'+index)
			.style('opacity', 0)
			.selectAll('.geneLink'+'-'+index).data(linkBands)
			.enter().append('path')
				.attr('class', 'geneLink'+'-'+index)
				.classed('geneLink', true)
				.classed('simLink', function(d) {return d.type == 'similar'})
				.attr('d', function(d) {return thickDiagonal(d)})
				.attr('fill', function(d) {return domainColorScale(d.domain)})*/
					
		circ.selectAll('.strainBar'+'-'+index).transition()
			.duration(1000)
				.attr('x', function(d) {
					if(index == 'a'){
						return 50;
					} else {
						return plotDim.circleDim.width-70;
					}
				})
				.styleTween('opacity', opacityToOneTween);
		circ.selectAll('.strainMark'+'-'+index).transition()
			.duration(1000)
			.style('opacity', 1)
			.attr('cx', index == 'a' ? 50+10 : plotDim.circleDim.width-70+10);
/*			circ.selectAll('#geneLink'+'-'+index).transition()
			.duration(1000)
			.style('opacity', 1)
		*/
		addGeneLink();
				
	};
	this.exitStrainBar = function(index) {
		circ.selectAll('.strainBar'+'-'+index).transition()
			.duration(1000)
				.attr('x', function(d) {
					if(index == 'a'){
						return 50-100;
					} else {
						return plotDim.circleDim.width-70+100;
					}
				})
				.style('opacity', 0)
				.remove();
		
		circ.selectAll('.strainMark'+'-'+index).transition()
			.duration(1000)
				.attr('cx', index == 'a' ? 50-100+10 : plotDim.circleDim.width-70+100+10)
				.style('opacity', 0)
				.remove();
		
		circ.selectAll('.geneLink'+'-'+index).transition()
			.duration(1000)
				.style('opacity', 0)
				.remove();
		circ.selectAll('.geneLink.simLink').transition()
			.duration(1000)
				.style('opacity', 0)
				.remove();
	};
	
	// Event functions
	this.goHover = function(d){
		if (circle.plotState == 'circle') {
			circleGoHover(d);
		}
	};
	this.goUnhover = function(){
		if (circle.plotState == 'circle') {
			circleGoUnhover();
		}
	};
	this.goClick = function(d) {
		if (geneList.isSelected()) {
			geneList.updateList(d.genes);
		} else {
			if (d.class != 21) {
				circle.goUnhover();
				
				if(circle.plotState == 'circle') {
					circleGoClick(d);
				} else if (circle.plotState == 'tree') {
					treeGoClick(d);
				} else if (circle.plotState == 'bar') {
					barGoClick(d);
				}
			}
		}
	};
	this.panGroupHover = function(d){
		if (circle.plotState == 'circle') {
			circlePanGroupHover(d);
		}
	};
	this.panGroupUnhover = function() {
		if (circle.plotState == 'circle') {
			circlePanGroupUnhover();
		}
	};
	this.panGroupClick = function(d) {
		if (geneList.isSelected()) {
			var genes = pgObject.geneInfo.filter(function(f) {return f.domain == d.name;});
			
			geneList.updateList(genes);
		} else {
			if (circle.plotState == 'tree') {
				treePanGroupClick(d);
			}
		}
	};
	this.strainGoHover = function(d) {
		infoObject.createGoDescription(d);
		
		var selector = d3.select(this).classed('strainBar-a') ? '#geneLink-a' : '#geneLink-b';
		
		info.selectAll('#legend td')
			.classed('hover', function(f) {return f.index == d.class;});
			
		circ.selectAll(selector + ' ' + '.geneLink')
			.style('stroke', 'lightgrey');
		
		circ.selectAll(selector + ' ' + '.geneLink').filter(function(f) { return d.class == f.class;})
			.style('stroke', function(d) {return domainColorScale(d.domain);})
			.style('stroke-width', 0.5);
	};
	this.strainGoUnhover = function() {
		info.selectAll('#legend td')
			.classed('hover', false);
		info.select('#godescription').remove();
		
		circ.selectAll('.geneLink')
			.style('stroke', function(d) { return goColorScale(d.class);})
			.style('stroke-width', null);
	};
	this.strainGoClick = function(d) {
		if (geneList.isSelected()) {
			geneList.updateList(d.genes);
		}
	};
	this.treeChildHover = function(d) {
		
		d3.select('#info').append('div')
			.attr('id', 'godescription')
			.html('<p><br/><strong>'+d.name[0].toUpperCase()+d.name.slice(1)+'</strong></p><p><em>Number of gene families:&nbsp</em>'+d.value+'</p><p><em>GO Term:&nbsp</em>'+ d.id+'</p><p><em>Definition:&nbsp</em>'+d.def+'</p>');
	};
	this.treeChildUnhover = function(d) {
		d3.selectAll('#godescription').remove();
	};
	this.grandparentHover = function() {
		d = treeParent.route[treeParent.route.length-1];
		circle.treeChildHover(d);
	};
};
var circle = new Circle();

circle.createPlot();

// Create legends
var legendCol = 3;
var legend = [[]];
var rowIndex = 0;
var colIndex = 0;
for (var i = 0; i < pgObject.goMapping.name.length; i++){
	if(colIndex == legendCol){
		rowIndex++;
		colIndex = 0;
		legend[rowIndex] = [];
	}
	legend[rowIndex][colIndex] = {name: pgObject.goMapping.name[i], index: i+1};
	colIndex++;
}
d3.select('#info').append('table')
	.attr('id', 'legend')
	.selectAll('tr').data(legend)
		.enter()
		.append('tr')
			.selectAll('td').data(function(d,i) {return d;})
				.enter()
				.append('td')
				.text(function(d) {return d.name;})
				.style('border-left', function(d) {return '7px solid '+circle.goColorScale(d.index);});


d3.selectAll('.invisible')
	.classed('invisible', false);

