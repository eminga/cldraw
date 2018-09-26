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
const GET_PROBABILITIES = 1;
const GET_PROBABILITIES_PREVIEW = 2;
const GET_ALL_PROBABILITIES = 3;
const IMPORT_PROBABILITIES = 4;

var calculatedProbabilities = {};

onmessage = function(e) {
	if (e.data[0] == SET_COUNTRIES) {
		countriesW = e.data[1];
		countriesR = e.data[2];
		fullSize = countriesW.length;
	} else if (e.data[0] == GET_PROBABILITIES) {
		if (e.data.length < 3) {
			var drawnW = [];
			var drawnR = [];
			for (var i = 0; i < fullSize; i++) {
				drawnW[i] = false;
				drawnR[i] = false;
			}
		} else {
			var drawnW = e.data[1];
			var drawnR = e.data[2];
		}
		if (e.data.length < 4) {
			postMessage(calculateProbabilities(drawnW, drawnR));
		} else {
			postMessage(calculateProbabilities(drawnW, drawnR, e.data[3]));
		}
	} else if (e.data[0] == GET_PROBABILITIES_PREVIEW) {
		probabilities = [];
		var drawnW = e.data[1];
		var drawnR = e.data[2];
		var possibleOpponent = e.data[3];
		var num = 0;
		for (var i = 0; i < fullSize; i++) {
			if (drawnR[i]) {
				num++;
			}
			if (drawnW[i]) {
				num--;
			}
		}
		if (num == 0) {
			for (var i = 0; i < fullSize; i++) {
				if (possibleOpponent[i]) {
					drawnR[i] = true;
					probabilities[i] = calculateProbabilities(drawnW, drawnR, i);
					drawnR[i] = false;
				}
			}
		} else {
			for (var i = 0; i < fullSize; i++) {
				if (possibleOpponent[i]) {
					drawnW[i] = true;
					probabilities[i] = calculateProbabilities(drawnW, drawnR);
					drawnW[i] = false;
				}
			}
		}
		postMessage(probabilities);
	} else if (e.data[0] == GET_ALL_PROBABILITIES) {
		var limit = 0;
		if (e.data.length > 1) {
			limit = e.data[1];
		}
		var croppedProbabilities = {};
		for (var id in calculatedProbabilities) {
			// only consider probabilities for cases where >= 'limit' teams are in the winners pot
			if (id.length >= limit * 4) {
				croppedProbabilities[id] = calculatedProbabilities[id];
			}
		}
		postMessage(croppedProbabilities);
	} else if (e.data[0] == IMPORT_PROBABILITIES) {
		// if available, load precalculated probabilities
		var drawnW = [];
		var drawnR = [];
		for (var i = 0; i < fullSize; i++) {
			drawnW[i] = false;
			drawnR[i] = false;
		}
		var id = generateId(drawnW, drawnR);
		var s = idToString(id);
		var filename = 'probabilities/' + s + '.json';
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (this.readyState == 4) {
				if (this.status == 200) {
					calculatedProbabilities = JSON.parse(this.responseText);
					postMessage(true);
				} else {
					postMessage(false);
				}
			}
		};
		xhr.open('GET', filename);
		xhr.send();
	}
}


// generates an identifier for the remaining teams
// each entry of the id array characterizes a column of the remaining table
function generateId(drawnW, drawnR) {
	var id = [];
	var c = 0;
	for (var i = 0; i < fullSize; i++) {
		var temp = 0;
		if (!drawnW[i]) {
			var l2 = 0;
			for (var j = 0; j < fullSize; j++) {
				if (!drawnR[j]) {
					temp <<= 1;
					if ((i > 11 || j > 11 || i != j) && countriesW[i] != countriesR[j]) {
						temp |= 1;
					}
				}
			}
			id.push([temp, c]);
			c++;
		}
	}
	id.sort(function(a,b){
		return a[0] - b[0];
	});
	return id;
}


function idToString(id) {
	var s = '';
	for (var i = 0; i < id.length; i++) {
		if (id[i][0] < 16) {
			s += '000' + (id[i][0]).toString(16);
		} else if (id[i][0] < 256) {
			s += '00' + (id[i][0]).toString(16);
		} else if (id[i][0] < 4096) {
			s += '0' + (id[i][0]).toString(16);
		} else {
			s += (id[i][0]).toString(16);
		}
	}
	return s;
}

// returns cached probabilities, null if dead end or undefined if not cached yet
function loadProbabilities(id) {
	var s = idToString(id);
	var temp = calculatedProbabilities[s];
	if (temp == null) {
		return temp;
	}
	var probabilities = [];
	for (var i = 0; i < id.length; i++) {
		probabilities[id[i][1]] = temp[i];
	}
	return probabilities;
}

// caches probabilities
function saveProbabilities(id, probabilities) {
	var s = idToString(id);
	if (probabilities == null) {
		calculatedProbabilities[s] = null;
	} else {
		var temp = [];
		for (var i = 0; i < id.length; i++) {
			temp[i] = probabilities[id[i][1]];
		}
		calculatedProbabilities[s] = temp;
	}
}


function calculateProbabilities(drawnW, drawnR, unmatchedRunnerUp) {
	// use cached probabilities if existing (only if there is no unmatched runner-up)
	if (unmatchedRunnerUp == undefined) {
		var id = generateId(drawnW, drawnR);
		var cachedProbabilities = loadProbabilities(id);
		if (cachedProbabilities !== undefined) {
			return cachedProbabilities;
		}
	}

	var probabilities = [];
	var options = 0;
	var size = fullSize;
	for (var i = 0; i < fullSize; i++) {
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
		for (var i = 0; i < fullSize; i++) {
			if (!drawnR[i]) {
				options++;
				// temporarily draw runner-up i and calculate the resulting probabilities
				drawnR[i] = true;
				var temp = calculateProbabilities(drawnW, drawnR, i);
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
			probabilities = null;
		}

	// if an opponent for team 'unmatchedRunnerUp' is to be drawn next
	} else {
		for (var i = 0; i < fullSize; i++) {
			if (!drawnW[i] && (i > 11 || unmatchedRunnerUp > 11 || i != unmatchedRunnerUp) && countriesW[i] != countriesR[unmatchedRunnerUp]) {
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

				var temp = calculateProbabilities(drawnW, drawnR);
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
			probabilities = null;
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
		saveProbabilities(id, probabilities);
	}

	return probabilities;
}
