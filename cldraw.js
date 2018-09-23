/*  CL Draw Probabilities
 *  Copyright (C) 2017-2018  eminga
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.

 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 */

const SET_COUNTRIES = 0;
const SET_DRAWN = 1;
const GET_PROBABILITIES_R = 2;
const GET_PROBABILITIES_W = 3;
const GET_MULTIPLE_PROBABILITIES_R = 4;
const GET_MULTIPLE_PROBABILITIES_W = 5;

var calculatedProbabilities = {};

onmessage = function(e) {
	if (e.data[0] == SET_COUNTRIES) {
		countriesW = e.data[1];
		countriesR = e.data[2];
	} else if (e.data[0] == SET_DRAWN) {
		drawnW = e.data[1];
		drawnR = e.data[2];
	} else if (e.data[0] == GET_PROBABILITIES_R) {
		postMessage(calculateProbabilities());
	} else if (e.data[0] == GET_PROBABILITIES_W) {
		postMessage(calculateProbabilities(e.data[1]));
	} else if (e.data[0] == GET_MULTIPLE_PROBABILITIES_R) {
		probabilities = [];
		for (var i = 0; i < 8; i++) {
			if (e.data[1][i]) {
				drawnR[i] = true;
				probabilities[i] = calculateProbabilities(i);
				drawnR[i] = false;
			}
		}
		postMessage(probabilities);
	} else if (e.data[0] == GET_MULTIPLE_PROBABILITIES_W) {
		probabilities = [];
		for (var i = 0; i < 8; i++) {
			if (e.data[2][i]) {
				drawnW[i] = true;
				probabilities[i] = calculateProbabilities();
				drawnW[i] = false;
			}
		}
		postMessage(probabilities);
	}
}


// generates an identifier for the remaining teams
function generateId() {
	var id = '';
	for (var i = 0; i < 8; i++) {
		var temp = 0;
		if (!drawnW[i]) {
			for (var j = 0; j < 8; j++) {
				if (!drawnR[j]) {
					temp <<= 1;
					if (i != j && countriesW[i] != countriesR[j]) {
						temp |= 1;
					}
				}
			}
			if (temp < 16) {
				id += '0' + (temp).toString(16);
			} else {
				id += (temp).toString(16);
			}
		}
	}
	return id;
}


function calculateProbabilities(unmatchedRunnerUp) {
	var probabilities = [];

	// use cached probabilities if existing (only if there is no unmatched runner-up)
	if (unmatchedRunnerUp == undefined) {
		var id = generateId();
	}
	if (unmatchedRunnerUp == undefined && calculatedProbabilities[id] != null) {
		probabilities = calculatedProbabilities[id];
	} else {
		var options = 0;
		var size = 8;
		for (var i = 0; i < 8; i++) {
			if (drawnW[i]) {
				size--;
			}
		}
		for (var i = 0; i < size; i++) {
			probabilities[i] = [];
			for (var j = 0; j < size; j++) {
				probabilities[i][j] = 0;
			}
		}

		// if the same number of winners and runners-up has been drawn
		if (unmatchedRunnerUp == undefined) {
			for (var i = 0; i < 8; i++) {
				if (!drawnR[i]) {
					options++;
					// temporarily draw runner-up i and calculate the resulting probabilities
					drawnR[i] = true;
					var temp = calculateProbabilities(i);
					if (temp === null) {
						options--;
					} else {
						for (var j = 0; j < size; j++) {
							for (var k = 0; k < size; k++) {
								probabilities[j][k] += temp[j][k];
							}
						}
					}
					drawnR[i] = false;
				}
			}
			// return null if the current draw is a dead end
			if (options == 0 && id != '') {
				calculatedProbabilities[id] = null;
				return null;
			}

		// if an opponent for team 'unmatchedRunnerUp' is to be drawn next
		} else {
			for (var i = 0; i < 8; i++) {
				if (!drawnW[i] && i != unmatchedRunnerUp && countriesW[i] != countriesR[unmatchedRunnerUp]) {
					options++;
					// temporarily match unmatchedRunnerUp with winner i and calculate the resulting probabilities
					drawnW[i] = true;

					var indexW = i;
					for (var j = 0; j < i; j++) {
						if (drawnW[j]) {
							indexW--;
						}
					}
					var indexR = unmatchedRunnerUp;
					for (var j = 0; j < unmatchedRunnerUp; j++) {
						if (drawnR[j]) {
							indexR--;
						}
					}

					var temp = calculateProbabilities();
					if (temp === null) {
						options--;
					} else {
						for (var j = 0; j < size; j++) {
							for (var k = 0; k < size; k++) {
								if (j < indexW) {
									if (k < indexR) {
										probabilities[j][k] += temp[j][k];
									}
									if (k > indexR) {
										probabilities[j][k] += temp[j][k - 1];
									}
								} else if (j > indexW) {
									if (k < indexR) {
										probabilities[j][k] += temp[j - 1][k];
									}
									if (k > indexR) {
										probabilities[j][k] += temp[j - 1][k - 1];
									}
								}
							}
						}
						probabilities[indexW][indexR] += 1;
					}
					drawnW[i] = false;
				}
			}
			// return null if the current draw is a dead end
			if (options == 0) {
				return null;
			}
		}

		if (options != 0) {
			for (var i = 0; i < size; i++) {
				for (var j = 0; j < size; j++) {
					probabilities[i][j] /= options;
				}
			}
		}

		if (unmatchedRunnerUp == undefined) {
			calculatedProbabilities[id] = probabilities;
		}
	}

	return probabilities;
}
