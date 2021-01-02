# CL Draw Probabilities
An interactive probability calculator for the round of 16 of the UEFA Champions League and the round of 32 of the UEFA Europa League.

Try it: https://eminga.github.io/cldraw/

If you prefer exact fractions over rounded decimals, have a look at the fractions version: https://eminga.github.io/cldraw/fractions/  
The fractions version does only work in browsers which support BigInt (currently Firefox 68+, Chrome 67+, and other browsers that use V8).

## Background (Champions League)
In the round of 16 of the UEFA Champions League, the UEFA imposes some regulations on how the teams are matched:
1. Group winners play against group runners-up.
2. Winners and runners-up are drawn alternatingly, starting with a runner-up.
3. Teams from the same group cannot be matched.
4. Teams from the same country (more precisely, from the same association) cannot be matched.

Regulations 3. and 4. require a calculation after each drawn runner-up to avoid a dead end where there is no suitable opponent left for a unmatched team. Thus, sometimes a runner-up from country A cannot be matched with a winner from country B as this matching would leave another team without a suitable opponent.

These regulations lead to non-uniform probabilities regarding the outcome of the draw.

## Background (Europa League)
The regulations in the round of 32 of the UEFA Europa League are similar to those of the Champions League described above.

Regulation 1. differs: One pot consists of the twelve EL group winners and the four best third-placed teams from the CL group phase. The other pot consists of the EL group runners-up and the four other third-placed teams from the CL group phase.

## Algorithm
### Summary
The algorithm (cldraw.js:computeProbabilities()) iterates over all possible draw sequences and computes the probabilities of the possible pairings using the [law of total probability](https://en.wikipedia.org/wiki/Law_of_total_probability). To determine the possible opponents of drawn runners-up (calculation step described in the background section), an implicit "dead end check" is included: All opponents which meet the regulations are tried, the ones that lead to a dead end are ignored afterwards.

### Details
#### Initialization
Create a bipartite graph G where each node represents a team and two nodes are connected by an edge iff the teams are allowed to be matched based on the regulations.

#### Computation
##### Case 1: a runner-up is to be drawn next
Iterate over all runners-up in G and recursively call the computation function with parameters (G, runner-up). Ignore the runners-up for which the recursive call returned null. The remaining recursive calls returned conditional probabilities. Use the [law of total probability](https://en.wikipedia.org/wiki/Law_of_total_probability) to compute the overall probabilities.

Return null if all recursive calls returned null, otherwise return a complete bipartite graph containing all nodes in G where each edge has a weight in [0,1] which indicates the matching probability of the teams connected by the edge.

##### Case 2: a winner is to be drawn next
If G contains only two nodes: If the nodes are connected by an edge, return G with edge weight 1. If there is no edge (dead end), return null.

If G contains more than two nodes: Iterate over all neighbors of the unmatched runner-up and recursively call the computation function with parameter G' = G \ {unmatched runner-up, winner}. Ignore the winners for which the recursive call returned null. The remaining recursive calls returned conditional probabilities. Use the law of total probability to compute the overall probabilities.

Return null if the unmatched runner-up has no neighbor (i.e. the draw is in a dead end) or all recursive calls returned null, otherwise return a complete bipartite graph containing all nodes in G where each edge has a weight in [0,1] which indicates the matching probability of the teams connected by the edge.

#### [Memoization](https://en.wikipedia.org/wiki/Memoization)
Intermediate results are stored based on the team graph G.

If the probabilities for a given graph have already been computed, they can be reused directly. If the probabilities of an [isomorphic graph](https://en.wikipedia.org/wiki/Graph_isomorphism) have already been computed, they can be reused after bringing them into the right order.

The memoization function takes advantage of these properties by sorting the (boolean) adjacency matrices of the graphs. Each matrix is sorted by alternatingly sorting rows and columns until the order doesn't change anymore. Rows/columns are compared by mapping each row/column to an integer x ∈ {0,..., 2^n-1}, x += 2^i if element i of the row/column is true.
This method does not ensure that two isomorphic graphs are mapped to the same graph (see [graph isomorphism problem](https://en.wikipedia.org/wiki/Graph_isomorphism_problem) and [graph canonization](https://en.wikipedia.org/wiki/Graph_canonization) for details on this problem). However, many of them are and therefore the number of computation steps can be reduced by 80%-90% compared to not sorting the adjacency matrices *(Example CL Draw 2017/18: don't sort: 4002 stored elements, sort: 495 stored elements)*.


## Performance
The memoization technique described above works better the more similar the teams are (e.g. the algorithm is faster if there are 2 runners-up and 2 winners from country A and 2 runners-up and 2 winners from country B, compared to 1 runner-up and 3 winners from country A and 2 runners-up and 1 winner from country B).

Tests with a Pentium G4600 using Node.js 10.13.0 yield computation times of 110ms for the CL draw 2017/18 and 2:02 minutes (310MB RAM usage) for the EL draw 2017/18. However, there are cases where the computation is much more expensive, like EL season 2014/15 where it takes 88 minutes and 5.3GB of RAM.

To bypass the long computation times, precomputed probabilities can be used in EL mode. With a gzipped filesize of 5MB all possible combinations of the first 4 or 6 draw steps can be stored. The probabilities for the remaining 26/28 teams are then computed locally which usually takes a couple of seconds / up to 1 minute.

## Host yourself
If this tool wasn't updated in time or you want to host it yourself for another reason, feel free to do so! To host it on GitHub, fork this repo and enable the GitHub Pages feature.

You can edit the teams in the config.xml file. In EL mode, you can provide precomputed probabilities. To do so, press the "Export probabilities" button and upload the JSON file to the probabilities folder afterwards.

### cldraw.js
It is also possible to use the calculation part without the UI, either as a Web Worker or in Node.js.

Here is a minimal example for using it as a Web Worker:

```javascript
var cldraw = new Worker('cldraw.js');
// set groups and countries
var winners = [["A","EN"], ["B","FR"], ["C","IT"], ["D","ES"], ["E","EN"], ["F","EN"], ["G","TR"], ["H","EN"]];
var runnersUp = [["A","CH"], ["B","DE"], ["C","EN"], ["D","IT"], ["E","ES"], ["F","UA"], ["G","PT"], ["H","ES"]];
cldraw.postMessage([0, winners, runnersUp]);
// write output to console
cldraw.onmessage = function(e) {
  var probabilities = e.data;
  console.log(probabilities);
}
// compute overall probabilities, returns 8x8 matrix
cldraw.postMessage([1]);
/*
Array(8) [
0: Array(8) [ 0, 0.1479738518753526, 0, … ]
1: Array(8) [ 0.10848842627136879, 0, 0.2936778574215287, … ]
2: Array(8) [ 0.1593314896731272, 0.15155718280510136, 0, … ]
3: Array(8) [ 0.14959847732923084, 0.14407938009229784, 0.41264428515694257, … ]
4: Array(8) [ 0.1593314896731272, 0.15155718280510136, 0, … ]
5: Array(8) [ 0.1554302011086499, 0.14797385187535264, 0, … ]
6: Array(8) [ 0.1084884262713688, 0.10530136774169269, 0.2936778574215287, … ]
7: Array(8) [ 0.1593314896731272, 0.15155718280510136, 0, … ]
]
*/
// compute probabilities after winners B and F and runners-up A and G have been drawn, returns 6x6 matrix
var drawnWinners = [false, true, false, false, false, true, false, false];
var drawnRunnersUp = [true, false, false, false, false, false, true, false];
cldraw.postMessage([1, drawnWinners, drawnRunnersUp]);
// draw runner-up H (still unmatched) and compute probabilites, returns 6x6 matrix
drawnRunnersUp[7] = true;
cldraw.postMessage([1, drawnWinners, drawnRunnersUp, 7]);
```

The same example in Node.js:
```javascript
var cldraw = require('./cldraw.js');
// set groups and countries
var winners = [["A","EN"], ["B","FR"], ["C","IT"], ["D","ES"], ["E","EN"], ["F","EN"], ["G","TR"], ["H","EN"]];
var runnersUp = [["A","CH"], ["B","DE"], ["C","EN"], ["D","IT"], ["E","ES"], ["F","UA"], ["G","PT"], ["H","ES"]];
cldraw.initialize(winners, runnersUp);

// compute overall probabilities, returns 8x8 matrix
cldraw.getProbabilities();
/*
[ [ 0,
    0.1479738518753526,
    0,
    0.18287403171354827,
    ...
    0,
    0.12801464076468033 ],
  [ 0.15933148967312719,
    0.15155718280510136,
    ... ] ]
*/
// compute probabilities after winners B and F and runners-up A and G have been drawn, returns 6x6 matrix
var drawnWinners = [false, true, false, false, false, true, false, false];
var drawnRunnersUp = [true, false, false, false, false, false, true, false];
cldraw.getProbabilities(drawnWinners, drawnRunnersUp);
// draw runner-up H (still unmatched) and compute probabilites, returns 6x6 matrix
drawnRunnersUp[7] = true;
cldraw.getProbabilities(drawnWinners, drawnRunnersUp, 7);
```

## License
This project is licensed under MIT License, read the LICENSE file for more information.

It uses [bootstrap](https://github.com/twbs/bootstrap) by [Twitter, Inc. and The Bootstrap Authors](https://github.com/twbs).  
Furthermore, the fractions version uses [Fraction.js](https://github.com/infusion/Fraction.js) by [Robert Eisele](https://github.com/infusion) and [MathJax](https://github.com/mathjax/MathJax).  
The favicons were generated with [RealFaviconGenerator](https://realfavicongenerator.net/).
