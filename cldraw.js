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
 
'use strict';

const SET_COUNTRIES = 0;
const GET_PROBABILITIES = 1;
const GET_PROBABILITIES_PREVIEW = 2;
const IMPORT_PROBABILITIES = 3;
const EXPORT_PROBABILITIES = 4;
const CLEAR_CACHE = 5;

var calculatedProbabilities = {};
var countriesW;
var countriesR;
var fullSize;

// needed for export function
var seasonId;
var seasonLog = {};

onmessage = function(e) {
	if (e.data[0] == SET_COUNTRIES) {
		setCountries(e.data[1], e.data[2]);
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
		var probabilities = [];
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
	} else if (e.data[0] == IMPORT_PROBABILITIES) {
		if (e.data.length > 1) {
			importProbabilities(e.data[1]);
		}
		else {
			importProbabilities();
		}
	} else if (e.data[0] == EXPORT_PROBABILITIES) {
		if (e.data.length > 1) {
			exportProbabilities(e.data[1]);
		} else {
			exportProbabilities();
		}
	} else if (e.data[0] == CLEAR_CACHE) {
		calculatedProbabilities = {};
	}
}


// assigns the same number c to all teams which are from the same country
function setCountries(inititalCountriesW, initialCountriesR) {
	countriesW = [];
	countriesR = [];
	fullSize = inititalCountriesW.length;

	var c = 1;
	for (var i = 0; i < fullSize; i++) {
		var sameCountry = false;
		for (var j = 0; j < i; j++) {
			if (inititalCountriesW[j] == inititalCountriesW[i]) {
				countriesW[i] = countriesW[j];
				sameCountry = true;
				break;
			}
		}
		if (!sameCountry) {
			countriesW[i] = c;
			c++;
		}
	}
	for (var i = 0; i < fullSize; i++) {
		countriesR[i] = 0;
		for (var j = 0; j < fullSize; j++) {
			if (inititalCountriesW[j] == initialCountriesR[i]) {
				countriesR[i] = countriesW[j];
			}
		}
	}

	var drawnW = [];
	var drawnR = [];
	for (var i = 0; i < fullSize; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
	}
	seasonId = idToString(generateId(drawnW, drawnR)[0]);
	if (seasonLog[seasonId] == undefined) {
		seasonLog[seasonId] = new Set();
	}
}

function sortMatrix(matrix, rowOrder, columnOrder, inverse) {
	var result = [];
	for (var i = 0; i < rowOrder.length; i++) {
		result[i] = [];
	}
	for (var i = 0; i < rowOrder.length; i++) {
		for (var j = 0; j < rowOrder.length; j++) {
			if (!inverse) {
				result[i][j] = matrix[rowOrder[i]][columnOrder[j]];
			} else {
				result[rowOrder[i]][columnOrder[j]] = matrix[i][j];
			}
		}
	}
	return result;
}

function generateSubId(matrix, order, rowMode) {
	var id = [];
	for (var i = 0; i < matrix.length; i++) {
		var temp = 0;
		for (var j = 0; j < matrix.length; j++) {
			temp <<= 1;
			if (rowMode) {
				var entry = matrix[i][j];
			} else {
				var entry = matrix[j][i];
			}
			if (entry) {
				temp |= 1;
			}
		}
		id.push([temp, order[i]]);
	}
	return id;
}

// generates an identifier for the remaining teams
// Each entry of the subId array characterizes a row or column of the remaining matrix.
// The matrix is sorted until the ID doesn't change anymore.
// The result is then an ID characterizing the rows of the sorted matrix and two order arrays
// characterizing the permutation of the original matrix to undo or redo the sorting.
function generateId(drawnW, drawnR) {
	// create initial unsorted matrix
	var matrix = [];
	for (var i = 0; i < fullSize; i++) {
		if (!drawnW[i]) {
			var row = [];
			for (var j = 0; j < fullSize; j++) {
				if (!drawnR[j]) {
					if ((i > 11 || j > 11 || i != j) && countriesW[i] != countriesR[j]) {
						row.push(true);
					} else {
						row.push(false);
					}
				}
			}
			matrix.push(row);
		}
	}

	var rowOrder = [];
	var columnOrder = [];
	for (var i = 0; i < matrix.length; i++) {
		rowOrder.push(i);
		columnOrder.push(i);
	}

	var matrix2 = matrix;
	var row = true;
	// alternatingly sort rows and columns
	while (true) {
		if (row) {
			var order = rowOrder;
		} else {
			var order = columnOrder;
		}
		var subId = generateSubId(matrix2, order, row);
		var sorted = true;
		var maximum = -1;
		for (var i = 0; i < subId.length; i++) {
			if (subId[i][0] < maximum) {
				sorted = false;
				break;
			} else {
				maximum = subId[i][0];
			}
		}
		if (!sorted) {
			subId.sort(function(a,b) {
				return a[0] - b[0];
			});
			for (var i = 0; i < subId.length; i++) {
				order[i] = subId[i][1];
			}
		}
		if (row) {
			var id = subId;
		}
		if (sorted) {
			break;
		}
		matrix2 = sortMatrix(matrix, rowOrder, columnOrder);
		row = !row;
	}
	var key = [];
	for (var i = 0; i < id.length; i++) {
		key[i] = id[i][0];
	}

	return [key, rowOrder, columnOrder];
}


function idToString(id) {
	var s = '';
	for (var i = 0; i < id.length; i++) {
		if (id[i] < 16) {
			s += '000' + (id[i]).toString(16);
		} else if (id[i] < 256) {
			s += '00' + (id[i]).toString(16);
		} else if (id[i] < 4096) {
			s += '0' + (id[i]).toString(16);
		} else {
			s += (id[i]).toString(16);
		}
	}
	return s;
}

// returns cached probabilities, null if dead end or undefined if not cached yet
function loadProbabilities(id) {
	var s = idToString(id[0]);
	seasonLog[seasonId].add(s);
	var temp = calculatedProbabilities[s];
	if (temp == null) {
		return temp;
	}
	var probabilities = sortMatrix(temp, id[1], id[2], true);
	return probabilities;
}

// caches probabilities
function saveProbabilities(id, probabilities) {
	var s = idToString(id[0]);
	calculatedProbabilities[s] = probabilities;
	if (probabilities == null) {
		calculatedProbabilities[s] = null;
	} else {
		var temp = sortMatrix(probabilities, id[1], id[2]);
		calculatedProbabilities[s] = temp;
	}
}


function calculateProbabilities(drawnW, drawnR, unmatchedRunnerUp) {
	if (unmatchedRunnerUp == undefined) {
		// use cached probabilities if existing
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
		if (options == 0 && id[0].length > 0) {
			probabilities = null;
		}

	// if an opponent for team 'unmatchedRunnerUp' is to be drawn next
	} else {
		var indexR = unmatchedRunnerUp;
		for (var i = 0; i < unmatchedRunnerUp; i++) {
			if (drawnR[i]) {
				indexR--;
			}
		}
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


function exportProbabilities(limit) {
	if (limit == undefined) {
		limit = 0;
	}
	var croppedProbabilities = {};
	for (let id of seasonLog[seasonId]) {
		// only consider probabilities for cases where >= 'limit' teams are in the winners pot
		if (id.length >= limit * 4) {
			croppedProbabilities[id] = calculatedProbabilities[id];
		}
	}
	postMessage(croppedProbabilities);
}

function importProbabilities(onlyCheckAvailability) {
	// if available, load precalculated probabilities
	var drawnW = [];
	var drawnR = [];
	for (var i = 0; i < fullSize; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
	}
	var id = generateId(drawnW, drawnR);
	var s = idToString(id[0]);
	if (calculatedProbabilities[s] !== undefined) {
		postMessage(true);
		return;
	}
	var filename = 'probabilities/' + s + '.json';
	var xhr = new XMLHttpRequest();

	if (onlyCheckAvailability) {
		xhr.open('HEAD', filename, false);
		xhr.send();
		if (xhr.status != 200) {
			postMessage(false);
		} else {
			var contentLength = xhr.getResponseHeader('Content-Length');
			if (contentLength == null) {
				contentLength = -1;
			}
			postMessage(contentLength);
		}
	} else {
		xhr.onreadystatechange = function() {
			if (this.readyState == 4) {
				if (this.status == 200) {
					var newProbabilities = JSON.parse(this.responseText);
					var minLength = 999999;
					for (var id in newProbabilities) {
						if (id.length < minLength) {
							minLength = id.length;
						}
						calculatedProbabilities[id] = newProbabilities[id];
					}
					postMessage(minLength / 4);
				} else {
					postMessage(false);
				}
			}
		};
		xhr.open('GET', filename);
		xhr.send();
	}
}
