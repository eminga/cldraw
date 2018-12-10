'use strict';

importScripts('bigfraction.js');
importScripts('../cldraw.js');


computeProbabilities = function(compatibilityMatrix, unmatchedRunnerUp) {
	let id;
	if (unmatchedRunnerUp == undefined) {
		// use cached probabilities if existing
		id = generateSortedId(compatibilityMatrix);
		let cachedProbabilities = loadProbabilities(id);
		if (cachedProbabilities !== undefined) {
			return cachedProbabilities;
		}
	}

	let probabilities = [];
	let options = 0;
	let size = compatibilityMatrix.length;

	for (let i = 0; i < size; i++) {
		probabilities[i] = [];
		for (let j = 0; j < size; j++) {
			probabilities[i][j] = new Fraction(0);
		}
	}

	// if the same number of winners and runners-up has been drawn
	if (unmatchedRunnerUp == undefined) {
		for (let i = 0; i < size; i++) {
			options++;
			// temporarily draw runner-up i and compute the resulting probabilities
			let conditionalProbabilities = computeProbabilities(compatibilityMatrix, i);
			if (conditionalProbabilities === null) {
				options--;
			} else {
				for (let j = 0; j < size; j++) {
					for (let k = 0; k < size; k++) {
						probabilities[j][k] = probabilities[j][k].add(conditionalProbabilities[j][k]);
					}
				}
			}
		}
		// return null if the current draw is a dead end
		if (options == 0 && size > 0) {
			probabilities = null;
		}

	// if an opponent for team 'unmatchedRunnerUp' is to be drawn next
	} else {
		for (let i = 0; i < size; i++) {
			if (compatibilityMatrix[i][unmatchedRunnerUp]) {
				options++;
				// temporarily match unmatchedRunnerUp with winner i and compute the resulting probabilities
				let subMatrix = [];
				for (let j = 0; j < size; j++) {
					if (j != i) {
						let row = [];
						for (let k = 0; k < size; k++) {
							if (k != unmatchedRunnerUp) {
								row.push(compatibilityMatrix[j][k]);
							}
						}
						subMatrix.push(row);
					}
				}
				let conditionalProbabilities = computeProbabilities(subMatrix);
				if (conditionalProbabilities === null) {
					options--;
				} else {
					for (let j = 0; j < size; j++) {
						for (let k = 0; k < size; k++) {
							if (j < i) {
								if (k < unmatchedRunnerUp) {
									probabilities[j][k] = probabilities[j][k].add(conditionalProbabilities[j][k]);
								}
								if (k > unmatchedRunnerUp) {
									probabilities[j][k] = probabilities[j][k].add(conditionalProbabilities[j][k - 1]);
								}
							} else if (j > i) {
								if (k < unmatchedRunnerUp) {
									probabilities[j][k] = probabilities[j][k].add(conditionalProbabilities[j - 1][k]);
								}
								if (k > unmatchedRunnerUp) {
									probabilities[j][k] = probabilities[j][k].add(conditionalProbabilities[j - 1][k - 1]);
								}
							}
						}
					}
					probabilities[i][unmatchedRunnerUp] = probabilities[i][unmatchedRunnerUp].add(1);
				}
			}
		}
		// return null if the current draw is a dead end
		if (options == 0) {
			probabilities = null;
		}
	}

	if (options != 0) {
		for (let i = 0; i < size; i++) {
			for (let j = 0; j < size; j++) {
				probabilities[i][j] = probabilities[i][j].div(options);
			}
		}
	}

	if (unmatchedRunnerUp == undefined) {
		saveProbabilities(id, probabilities);
	}

	return probabilities;
}
