# PanViz
*D3 based visualisation for comparative genomics*
* * *

PanViz is a comprehensive interactive data visualization tool for investigating and understanding comparative microbial genomics data (often termed pangenomes). It is build around the idea of a dependency-free html file that makes it as easy to share with co-workers without installation of dedicated programs etc.

The visualization supports 3 different views into your pangenome data:

- A circular view with gene groups divided into pangenome groups and further divided into top level biological process GO terms (See [http://geneontology.org] for an introduction to the gene ontology). In this view gene group relocation is animated as the pangenome is slized into subsets.
- A stacked bar view where single genomes can be compared to the current selected pangenome as well as to each others.
- A zoomable treemap view where the presence of GO terms can be investigated.

Furthermore it supports a visual querying system where gene groups of interest can be reported by iteratively making set operations on visual elements.

## Showcase
[![Vimeo screenshot](https://i.vimeocdn.com/video/498974756_640x388.jpg)](https://vimeo.com/113594599)

## Installation
If a PanViz visualization is provided to you no additional installation is necessary. Just click on the PanViz.html file and enjoy the visualization in your browser.

In order to create new visualization based on your own data I would strongly suggest the [PanVizGenerator](https://github.com/thomasp85/PanVizGenerator) R package, that is developed in concert with PanViz and allows you to create PanViz visualizations from a number of data sources and also provides a GUI for those unfamiliar with CLI's

If you really want to do it the hard way, read on:

### Building PanViz
PanViz requires [node.js](https://nodejs.org) so first make sure you have that. Then download PanViz and unpack it. In the PanViz directory install all dependencies with `npm install`, and then build PanViz with `broccoli build <your-directory>`. PanViz has now been build but it still requires your data (This is what PanVizGenerator is created for).

### Formatting data for PanViz
PanViz.html looks for a data.js file that defines all relevant data for the visualization. The data.js file must define the following variables:

- **go**: An edgelist representation of the gene ontology. The object must contain 2 properties, "edges" and "vertices", with "edges" being an object with a "from", "to" and "type" property, each being arrays. "from" and "to" is a 1-based edgelist mapping onto vertices in the "vertices" property and "type" the description of the link (either "is_a" or "replaced_by" - other types are ignored). The vertices object contains "id", "name", "def", "namespace", "is_obsolete", "alt_id" and "subset" properties with "id" giving the term, "name" the term name, "def" the definition of the term, "namespace" the GO namespace (either: "biological_process", "molecular_function" or "cellular_component"), "is_obsolete" a boolean for flagging terms as obsolete, "alt_id" giving alternative terms for this term and subset giving an array of GO subsets (only "gosubset_prok" is of interest).
  Truncated example:

    {
      "vertices": {
        "name": ["mitochondrion inheritance", "mitochondrial genome maintenance", "reproduction", "obsolete ribosomal chaperone activity", "high-affinity zinc uptake transmembrane transporter activity", "low-affinity zinc ion transmembrane transporter activity"],
        "id": ["GO:0000001", "GO:0000002", "GO:0000003", "GO:0000005", "GO:0000006", "GO:0000007"],
        "alt_id": [
          [null],
          [null],
          ["GO:0019952", "GO:0050876"],
          [null],
          [null],
          [null]
        ],
        "namespace": ["biological_process", "biological_process", "biological_process", "molecular_function", "molecular_function", "molecular_function"],
        "def": ["The distribution of mitochondria, including the mitochondrial genome, into daughter cells after mitosis or meiosis, mediated by interactions between mitochondria and the cytoskeleton.", "The maintenance of the structure and integrity of the mitochondrial genome; includes replication and segregation of the mitochondrial chromosome.", "The production of new individuals that contain some portion of genetic material inherited from one or more parent organisms.", "OBSOLETE. Assists in the correct assembly of ribosomes or ribosomal subunits in vivo, but is not a component of the assembled ribosome when performing its normal biological function.", "Enables the transfer of a solute or solutes from one side of a membrane to the other according to the reaction: Zn2+(out) = Zn2+(in), probably powered by proton motive force. In high-affinity transport the transporter is able to bind the solute even if it is only present at very low concentrations.", "Catalysis of the transfer of a solute or solutes from one side of a membrane to the other according to the reaction: Zn2+ = Zn2+, probably powered by proton motive force. In low-affinity transport the transporter is able to bind the solute only if it is present at very high concentrations."],
        "is_obsolete": [false, false, false, true, false, false],
        "subset": [
          [null],
          [null],
          ["goslim_chembl", "goslim_generic", "goslim_pir", "goslim_plant", "gosubset_prok"],
          [null],
          [null],
          [null]
        ]
      },
      "edges": {
        "from": [1, 1, 2, 3, 5, 6],
        "to": [26432, 26435, 5650, 6363, 4247, 4247],
        "type": ["is_a", "is_a", "is_a", "is_a", "is_a", "is_a"]
      }
    }

- **dimReduc**: An object containing "MDS" and "PCA" properties, each being an array with an object for each genome in the pangenome, defined by name and x and y coordinates:
  Truncated example:

        {
          "MDS": [
            {
              "name": "ST01",
              "x": -654.3301,
              "y": -34.2947
            },
            {
              "name": "ST02",
              "x": -647.0739,
              "y": -49.1909
            },
            {
              "name": "ST03",
              "x": -640.2831,
              "y": 21.2383
            }
          ],
          "PCA": [
            {
              "name": "ST01",
              "x": -17.0711,
              "y": 2.5851
            },
            {
              "name": "ST02",
              "x": -16.8027,
              "y": 2.6353
            },
            {
              "name": "ST03",
              "x": -16.7187,
              "y": 2.1889
            }
          ]
        }