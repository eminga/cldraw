# CL Draw Probabilities
An interactive probability calculator for the round of 16 of the UEFA Champions League.

Try it: https://eminga.github.io/cldraw/

## Background
In the round of 16 of the UEFA Champions League, the UEFA imposes some regulations on how the teams are matched:
1. Group winners play against group runners-up.
2. Winners and runners-up are drawn alternatingly, starting with a runner-up.
3. Teams from the same group cannot be matched.
4. Teams from the same country (more precisely, from the same association) cannot be matched.

Regulations 3. and 4. require a calculation after each drawn runner-up to avoid a dead end where there is no suitable opponent left for a unmatched team. Thus, sometimes a runner-up from country A cannot be matched with a winner from country B as this matching would leave another team without a suitable opponent.

These regulations lead to non-uniform probabilities regarding the outcome of the draw.

## How this tool works
This tool simply computes the conditional probabilities of all possible pairings with respect to the calculation step described in the background section.

To speed up the computation, memoization is used.

## Host yourself
If this tool wasn't updated in time or you want to host it yourself for another reason, feel free to do so! To host it on GitHub, fork this repo and enable the GitHub Pages feature.

You can edit the teams and other settings in the settings.js file.

It is also possible to use the calculation part without the UI. Here is a minimal example for using it as a Web Worker:
```javascript
var calculator = new Worker('cldraw.js');
// set the countries
countriesWinners = ["EN", "FR", "IT", "ES", "EN", "EN", "TR", "EN"];
countriesRunnersUp = ["CH", "DE", "EN", "IT", "ES", "UA", "PT", "ES"];
calculator.postMessage([0, countriesWinners, countriesRunnersUp]);
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

## License
This project is licensed under MIT License, read the LICENSE file for more information.

It uses [bootstrap](https://github.com/twbs/bootstrap) by [Twitter, Inc. and The Bootstrap Authors](https://github.com/twbs).
