# CL Draw Probabilities
An interactive probability calculator for the round of 16 of the UEFA Champions League and the round of 32 of the UEFA Europa League.

Try it: https://eminga.github.io/cldraw/

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

## Host yourself
If this tool wasn't updated in time or you want to host it yourself for another reason, feel free to do so! To host it on GitHub, fork this repo and enable the GitHub Pages feature.

You can edit the teams in the config.xml file. In EL mode, you can provide precomputed probabilities. To do so, press the "Export probabilities" button and upload the JSON file to the probabilities folder afterwards.

It is also possible to use the calculation part without the UI. Here is a minimal example for using it as a Web Worker:
```javascript
var calculator = new Worker('cldraw.js');
// set groups and countries
winners = [["A","EN"], ["B","FR"], ["C","IT"], ["D","ES"], ["E","EN"], ["F","EN"], ["G","TR"], ["H","EN"]];
runnersUp = ["A","CH"], ["B","DE"], ["C","EN"], ["D","IT"], ["E","ES"], ["F","UA"], ["G","PT"], ["H","ES"]];
calculator.postMessage([0, winners, runnersUp]);
// write output to console
calculator.onmessage = function(e) {
  var probabilities = e.data;
  console.log(probabilities);
}
// calculate overall probabilities, returns 8x8 matrix
calculator.postMessage([1]);
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
// calculate probabilities after winners B and F and runners-up A and G have been drawn, returns 6x6 matrix
drawnWinners = [false, true, false, false, false, true, false, false];
drawnRunnersUp = [true, false, false, false, false, false, true, false];
calculator.postMessage([1, drawnWinners, drawnRunnersUp]);
// draw runner-up H (still unmatched) and calculate probabilites, returns 6x6 matrix
drawnRunnersUp[7] = true;
calculator.postMessage([1, drawnWinners, drawnRunnersUp, 7]);
```

## Algorithm
The algorithm (cldraw.js:computeProbabilities()) computes the probabilities of all possible pairings using the [law of total probability](https://en.wikipedia.org/wiki/Law_of_total_probability). To determine the possible opponents of drawn runners-up (calculation step described in the background section), an implicit "dead end check" is included: All opponents which meet the regulations are tried, the ones that lead to a dead end are ignored afterwards.

To avoid redundant computations, [memoization](https://en.wikipedia.org/wiki/Memoization) is used. Intermediate results are stored and identified using Boolean matrices of size m x m (m := number of unmatched winners). Entry e[i,j] states whether teams i and j can be matched.

Rows and columns of the probability table can be ordered arbitrarily without changing the probabilities. Hence, as a further optimization, each matrix is sorted by alternatingly sorting rows and columns until the order doesn't change anymore. 

## Performance
The memoization technique described above works better the more similar the teams are (e.g. the algorithm is faster if there are 2 runners-up and 2 winners from country A and 2 runners-up and 2 winners from country B, compared to 1 runner-up and 3 winners from country A and 2 runners-up and 1 winner from country B).

Tests with a Pentium G4600 in Firefox 62 yield computation times of 120ms for the CL draw 2017/18 and 3:40 minutes (1.2GB RAM usage) for the EL draw 2017/18. However, there are cases where the EL draw takes much longer, like season 2015/16 which takes around 20 minutes and up to 3GB of RAM.

To bypass the long computation times, precomputed probabilities can be used in EL mode. With a gzipped filesize of 5MB all possible combinations of the first 4 or 6 draw steps can be stored. The probabilities for the remaining 26/28 teams are then computed locally which takes a couple of seconds / up to 1 minute.

## License
This project is licensed under MIT License, read the LICENSE file for more information.

It uses CSS by [bootstrap](https://github.com/twbs/bootstrap) ([Twitter, Inc. and The Bootstrap Authors](https://github.com/twbs)), the favicons were generated with [RealFaviconGenerator](https://realfavicongenerator.net/).
