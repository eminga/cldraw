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

var computedProbabilities = {};
var fullCompatibilityMatrix;

// needed for export function
var seasonId;
var seasonLog = {};

// Web Worker
if (typeof(onmessage) !== 'undefined') {
	const INITIALIZE = 0;
	const GET_PROBABILITIES = 1;
	const GET_PROBABILITIES_PREVIEW = 2;
	const IMPORT_PROBABILITIES = 3;
	const EXPORT_PROBABILITIES = 4;
	const CLEAR_CACHE = 5;
	const GET_ID = 6;
	onmessage = function(e) {
		if (e.data[0] == INITIALIZE) {
			initialize(e.data[1], e.data[2]);
		} else if (e.data[0] == GET_PROBABILITIES) {
			postMessage(getProbabilities(e.data[1], e.data[2], e.data[3]));
		} else if (e.data[0] == GET_PROBABILITIES_PREVIEW) {
			postMessage(getProbabilitiesPreview(e.data[1], e.data[2], e.data[3]));
		} else if (e.data[0] == IMPORT_PROBABILITIES) {
			postMessage(importProbabilities(e.data[1]));
		} else if (e.data[0] == EXPORT_PROBABILITIES) {
			postMessage(exportProbabilities(e.data[1]));
		} else if (e.data[0] == CLEAR_CACHE) {
			clearCache();
		} else if (e.data[0] == GET_ID) {
			postMessage(getId());
		}
	}
}
// Node.js
if (typeof(exports) !== 'undefined') {
	exports.initialize = initialize;
	exports.getProbabilities = getProbabilities;
	exports.getProbabilitiesPreview = getProbabilitiesPreview;
	exports.importProbabilities = importProbabilities;
	exports.exportProbabilities = exportProbabilities;
	exports.clearCache = clearCache;
	exports.getId = getId;
}


function initialize(attr1, attr2) {
	if (attr2 == null && !Array.isArray(attr1[0][0])) {
		fullCompatibilityMatrix = attr1;
	} else {
		if (attr2 != null) {
			var attributes = [attr1, attr2];
		} else {
			var attributes = attr1;
		}
		fullCompatibilityMatrix = [];
		for (var i = 0; i < attributes[0].length; i++) {
			var row = [];
			for (var j = 0; j < attributes[0].length; j++) {
				var matchable = true;
				for (var k = 0; k < attributes[0][i].length; k++) {
					if (attributes[0][i][k] == attributes[1][j][k] && attributes[0][i][k] != null
							&& attributes[1][j][k] != null && attributes[0][i][k] !== '' && attributes[1][j][k] !== '') {
						matchable = false;
					}
				}
				if (matchable) {
					row.push(true);
				} else {
					row.push(false);
				}
			}
			fullCompatibilityMatrix.push(row);
		}
	}

	seasonId = idToString(generateSortedId(fullCompatibilityMatrix)[0]);
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

function generateUnsortedId(matrix, order, rowMode) {
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
function generateSortedId(compatibilityMatrix) {
	var rowOrder = [];
	var columnOrder = [];
	for (var i = 0; i < compatibilityMatrix.length; i++) {
		rowOrder.push(i);
		columnOrder.push(i);
	}

	var matrix2 = compatibilityMatrix;
	var row = true;
	var sorted = [false, false];
	// alternatingly sort rows and columns
	while (true) {
		if (row) {
			var order = rowOrder;
		} else {
			var order = columnOrder;
		}
		var subId = generateUnsortedId(matrix2, order, row);
		sorted[row ? 0 : 1] = true;
		var maximum = -1;
		for (var i = 0; i < subId.length; i++) {
			if (subId[i][0] < maximum) {
				sorted[row ? 0 : 1] = false;
				break;
			} else {
				maximum = subId[i][0];
			}
		}
		if (!sorted[row ? 0 : 1]) {
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
		if (sorted[0] && sorted[1]) {
			break;
		}
		matrix2 = sortMatrix(compatibilityMatrix, rowOrder, columnOrder);
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
	var temp = computedProbabilities[s];
	if (temp == null) {
		return temp;
	}
	var probabilities = sortMatrix(temp, id[1], id[2], true);
	return probabilities;
}

// caches probabilities
function saveProbabilities(id, probabilities) {
	var s = idToString(id[0]);
	computedProbabilities[s] = probabilities;
	if (probabilities == null) {
		computedProbabilities[s] = null;
	} else {
		var temp = sortMatrix(probabilities, id[1], id[2]);
		computedProbabilities[s] = temp;
	}
}


function computeProbabilities(compatibilityMatrix, unmatchedRunnerUp) {
	if (unmatchedRunnerUp == undefined) {
		// use cached probabilities if existing
		var id = generateSortedId(compatibilityMatrix);
		var cachedProbabilities = loadProbabilities(id);
		if (cachedProbabilities !== undefined) {
			return cachedProbabilities;
		}
	}

	var probabilities = [];
	var options = 0;
	var size = compatibilityMatrix.length;

	for (var i = 0; i < size; i++) {
		probabilities[i] = [];
		for (var j = 0; j < size; j++) {
			probabilities[i][j] = 0;
		}
	}

	// if the same number of winners and runners-up has been drawn
	if (unmatchedRunnerUp == undefined) {
		for (var i = 0; i < size; i++) {
			options++;
			// temporarily draw runner-up i and compute the resulting probabilities
			var partialProbabilities = computeProbabilities(compatibilityMatrix, i);
			if (partialProbabilities === null) {
				options--;
			} else {
				for (var j = 0; j < size; j++) {
					for (var k = 0; k < size; k++) {
						probabilities[j][k] += partialProbabilities[j][k];
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
		for (var i = 0; i < size; i++) {
			if (compatibilityMatrix[i][unmatchedRunnerUp]) {
				options++;
				// temporarily match unmatchedRunnerUp with winner i and compute the resulting probabilities
				var subMatrix = [];
				for (var j = 0; j < size; j++) {
					if (j != i) {
						var row = [];
						for (var k = 0; k < size; k++) {
							if (k != unmatchedRunnerUp) {
								row.push(compatibilityMatrix[j][k]);
							}
						}
						subMatrix.push(row);
					}
				}
				var partialProbabilities = computeProbabilities(subMatrix);
				if (partialProbabilities === null) {
					options--;
				} else {
					for (var j = 0; j < size; j++) {
						for (var k = 0; k < size; k++) {
							if (j < i) {
								if (k < unmatchedRunnerUp) {
									probabilities[j][k] += partialProbabilities[j][k];
								}
								if (k > unmatchedRunnerUp) {
									probabilities[j][k] += partialProbabilities[j][k - 1];
								}
							} else if (j > i) {
								if (k < unmatchedRunnerUp) {
									probabilities[j][k] += partialProbabilities[j - 1][k];
								}
								if (k > unmatchedRunnerUp) {
									probabilities[j][k] += partialProbabilities[j - 1][k - 1];
								}
							}
						}
					}
					probabilities[i][unmatchedRunnerUp] += 1;
				}
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


function getProbabilities(drawnW, drawnR, unmatchedRunnerUp) {
	if (drawnW == null) {
		return computeProbabilities(fullCompatibilityMatrix);
	}
	var compatibilityMatrix = [];
	for (var i = 0; i < fullCompatibilityMatrix.length; i++) {
		if (!drawnW[i]) {
			var row = [];
			for (var j = 0; j < fullCompatibilityMatrix.length; j++) {
				if (!drawnR[j] || j == unmatchedRunnerUp) {
					if (fullCompatibilityMatrix[i][j]) {
						row.push(true);
					} else {
						row.push(false);
					}
				}
			}
			compatibilityMatrix.push(row);
		}
	}
	for (var i = unmatchedRunnerUp - 1; i >= 0; i--) {
		if (drawnR[i]) {
			unmatchedRunnerUp--;
		}
	}
	return computeProbabilities(compatibilityMatrix, unmatchedRunnerUp);
}


function getProbabilitiesPreview(drawnW, drawnR, possibleOpponent) {
	var probabilities = [];
	var num = 0;
	for (var i = 0; i < drawnR.length; i++) {
		if (drawnR[i]) {
			num++;
		}
		if (drawnW[i]) {
			num--;
		}
	}
	if (num == 0) {
		for (var i = 0; i < drawnR.length; i++) {
			if (possibleOpponent[i]) {
				drawnR[i] = true;
				probabilities[i] = getProbabilities(drawnW, drawnR, i);
				drawnR[i] = false;
			}
		}
	} else {
		for (var i = 0; i < drawnR.length; i++) {
			if (possibleOpponent[i]) {
				drawnW[i] = true;
				probabilities[i] = getProbabilities(drawnW, drawnR);
				drawnW[i] = false;
			}
		}
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
			croppedProbabilities[id] = computedProbabilities[id];
		}
	}
	return croppedProbabilities;
}


function importProbabilities(probabilities) {
	for (var id in probabilities) {
		computedProbabilities[id] = probabilities[id];
	}
}


function clearCache() {
	computedProbabilities = {};
}


function getId() {
	return [seasonId, computedProbabilities[seasonId] !== undefined];
}
