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

You can edit the teams in the beginning of the cldraw.js file.

## License
This project is licensed under MIT License, read the LICENSE file for more information.

It uses [bootstrap](https://github.com/twbs/bootstrap) by [Twitter, Inc. and The Bootstrap Authors](https://github.com/twbs).
