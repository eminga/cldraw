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

// To update the teams, change the following 4 variables:
var teamsW = ['Manchester United', 'Paris St. Germain', 'AS Roma', 'FC Barcelona', 'Liverpool FC', 'Manchester City', 'Beşiktaş JK', 'Tottenham Hotspur'];
var initialCountriesW = ['EN', 'FR', 'IT', 'ES', 'EN', 'EN', 'TR', 'EN'];
var teamsR = ['FC Basel', 'FC Bayern', 'Chelsea FC', 'Juventus', 'Sevilla FC', 'Shakhtar', 'FC Porto', 'Real Madrid'];
var initialCountriesR = ['CH', 'DE', 'EN', 'IT', 'ES', 'UA', 'PT', 'ES'];



var countriesW = [];
var countriesR = [];

// drawn{W,R}[i] == true if team i has already been drawn
var drawnW = [];
var drawnR = [];

// matched[i] == j if teams i and j are matched
var matched = [];

var drawHistory = [];
var previewMode = false;
var hideMode = false;
var swap = false;

var calculatedProbabilities = {};

initialize();


function initialize() {
	createTable();

	// assign the same number c to all teams which are from the same country
	var c = 1;
	for (var i = 0; i < 8; i++) {
		var sameCountry = false;
		for (var j = 0; j < i; j++) {
			if (initialCountriesW[j] == initialCountriesW[i]) {
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
	for (var i = 0; i < 8; i++) {
		countriesR[i] = 0;
		for (var j = 0; j < 8; j++) {
			if (initialCountriesW[j] == initialCountriesR[i]) {
				countriesR[i] = countriesW[j];
			}
		}
	}

	reset();
}


function reset() {
	for (var i = 0; i < 8; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
		matched[i] = -1;
	}

	drawHistory = [];
	updateTable(calculateProbabilities());
	createButtonsR();
	updateFixtures();
	document.getElementById('button-randomteam').classList.remove('disabled');
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
					matched[i] = unmatchedRunnerUp;
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
					matched[i] = -1;
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


function getPossibleMatches(probabilities, team) {
	var possibleMatch = [];
	var indexR = team;
	for (var i = 0; i < team; i++) {
		if (drawnR[i]) {
			indexR--;
		}
	}
	var indexW = 0;
	for (var i = 0; i < 8; i++) {
		if (drawnW[i]) {
			possibleMatch[i] = false;
			indexW++;
		} else {
			if (probabilities[i - indexW][indexR] > 0) {
				possibleMatch[i] = true;
			} else {
				possibleMatch[i] = false;
			}
		}
	}
	return possibleMatch;
}


function drawRunnerUp(team, preview) {
	drawnR[team] = true;
	// write to history before table is updated, needed to hide drawn teams
	if (!preview) {
		drawHistory.push(team);
	}
	var probabilities = calculateProbabilities(team);
	updateTable(probabilities, team);
	if (!preview) {
		var possibleMatch = getPossibleMatches(probabilities, team);
		createButtonsW(team, possibleMatch);
		updateFixtures();
	} else {
		drawnR[team] = false;
	}
}


function drawWinner(team, opponent, preview) {
	matched[team] = opponent;
	drawnW[team] = true;
	// write to history before table is updated, needed to hide drawn teams
	if (!preview) {
		drawHistory.push(team + 8);
	}
	updateTable(calculateProbabilities());
	if (!preview) {
		createButtonsR();
		updateFixtures();
	} else {
		matched[team] = -1;
		drawnW[team] = false;
	}
}


function undo() {
	team = drawHistory.pop();
	if (team != undefined) {
		if (team < 8) {
			drawnR[team] = false;
			updateTable(calculateProbabilities());
			createButtonsR();
			updateFixtures();
		} else {
			team -= 8;
			drawnW[team] = false;
			matched[team] = -1;
			opponent = drawHistory.pop();
			drawnR[opponent] = false;
			drawRunnerUp(opponent);
		}
		document.getElementById('button-randomteam').classList.remove('disabled');
	}
}


function drawRandomTeam() {
	if (drawHistory.length % 2 == 0) {
		var numR = 0;
		for (var i = 0; i < 8; i++) {
			if (!drawnR[i]) {
				numR++;
			}
		}
		if (numR > 0) {
			var team = Math.floor(Math.random() * numR);
			for (var i = 0; i <= team; i++) {
				if (drawnR[i]) {
					team++;
				}
			}
			drawRunnerUp(team);
		}
	} else {
		var opponent = drawHistory[drawHistory.length - 1];
		var probabilities = calculateProbabilities(opponent);
		var possibleMatch = getPossibleMatches(probabilities, opponent);
		var numW = 0;
		for (var i = 0; i < 8; i++) {
			if (possibleMatch[i]) {
				numW++;
			}
		}
		var team = Math.floor(Math.random() * numW);
		for (var i = 0; i <= team && i < 20; i++) {
			if (!possibleMatch[i]) {
				team++;
			}
		}
		drawWinner(team, opponent);
	}
}


function createTable() {
	var table = document.getElementById('cldraw-table');
	while (table.firstChild) {
		table.removeChild(table.firstChild);
	}
	var thead = document.createElement('thead');
	var tr = document.createElement('tr');
	var th = document.createElement('th');
	tr.appendChild(th)
	for (var i = 0; i < 8; i++) {
		th = document.createElement('th');
		if (!swap) {
			th.appendChild(document.createTextNode(teamsR[i]));
		} else {
			th.appendChild(document.createTextNode(teamsW[i]));
		}
		th.scope = 'col';
		tr.appendChild(th);
	}
	thead.appendChild(tr);

	var tbody = document.createElement('tbody');
	for (var i = 0; i < 8; i++) {
		var tr = document.createElement('tr');
		var th = document.createElement('th');
		th.scope = 'row';
		if (!swap) {
			th.appendChild(document.createTextNode(teamsW[i]));
		} else {
			th.appendChild(document.createTextNode(teamsR[i]));
		}
		tr.appendChild(th);
		for (var j = 0; j < 8; j++) {
			var td = document.createElement('td');
			td.style.textAlign = 'center';
			tr.appendChild(td);
		}
		tbody.appendChild(tr);
	}

	table.appendChild(thead);
	table.appendChild(tbody);
}


function updateTable(probabilities, highlight) {
	var fullProbabilities = [];
	var indexW = 0;
	for (var i = 0; i < 8; i++) {
		fullProbabilities[i] = [];
		if (drawnW[i]) {
			var opponent = matched[i];
			for (var j = 0; j < 8; j++) {
				if (j == opponent) {
					fullProbabilities[i][j] = 1;
				} else {
					fullProbabilities[i][j] = 0;
				}
			}
		} else {
			var indexR = 0;
			for (var j = 0; j < 8; j++) {
				if (drawnR[j] && j != highlight) {
					fullProbabilities[i][j] = 0;
				} else {
					fullProbabilities[i][j] = probabilities[indexW][indexR];
					indexR++;
				}
			}
			indexW++;
		}
	}

	var table = document.getElementById('cldraw-table');
	for (var i = 0; i < 8; i++){
		for (var j = 0; j < 8; j++){
			var color = '';
			var text;
			if (matched[i] == j) {
				text = 'drawn';
				color = '#4998ff';
			} else {
				text = (100 * fullProbabilities[i][j]).toFixed(2) + "%";
				if (fullProbabilities[i][j] == 0) {
					color = '#999999';
				} else if (j == highlight) {
					color = '#f5ff75';
				}
			}
			if (!swap) {
				table.rows[i + 1].cells[j + 1].innerHTML = text;
				table.rows[i + 1].cells[j + 1].style.background = color;
			} else {
				table.rows[j + 1].cells[i + 1].innerHTML = text;
				table.rows[j + 1].cells[i + 1].style.background = color;
			}
		}
	}
	if (hideMode) {
		hideDrawnTeams();
	}
}


function updateFixtures() {
	var text = '';
	for (var i = 0; i < drawHistory.length; i++) {
		team = drawHistory[i];
		if (team < 8) {
			text += teamsR[team] + ' - ';
		} else {
			text += teamsW[team - 8] + '<br>';
		}
	}
	var openPairings = 8 - Math.floor(drawHistory.length / 2);
	for (var i = 0; i < openPairings; i++) {
		text += '<br>';
	}
	document.getElementById('cldraw-fixtures').innerHTML = text;
	if (drawHistory.length > 0) {
		document.getElementById('button-undo').classList.remove('disabled');
		document.getElementById('button-restart').classList.remove('disabled');
	} else {
		document.getElementById('button-undo').classList.add('disabled');
		document.getElementById('button-restart').classList.add('disabled');
	}
}


function hideDrawnTeams() {
	var matchedR = [];
	var matchedW = [];
	var n = drawHistory.length;
	if (n % 2 == 1) {
		n -= 1;
	}
	for (var i = 0; i < n; i++) {
		var team = drawHistory[i];
		if (team < 8) {
			matchedR[team] = true;
		} else {
			team -= 8;
			matchedW[team] = true;
		}
	}

	var table = document.getElementById('cldraw-table');
	if (swap) {
		for (var i = 0; i < 8; i++) {
			if (matchedR[i]) {
				table.rows[i + 1].style.display = 'none';
			} else {
				table.rows[i + 1].style.display = '';
			}
			for (j = 0; j < 9; j++) {
				if (matchedW[i]) {
					table.rows[j].cells[i + 1].style.display = 'none';
				} else {
					table.rows[j].cells[i + 1].style.display = '';
				}
			}
		}
	} else {
		for (var i = 0; i < 8; i++) {
			if (matchedW[i]) {
				table.rows[i + 1].style.display = 'none';
			} else {
				table.rows[i + 1].style.display = '';
			}
			for (j = 0; j < 9; j++) {
				if (matchedR[i]) {
					table.rows[j].cells[i + 1].style.display = 'none';
				} else {
					table.rows[j].cells[i + 1].style.display = '';
				}
			}
		}
	}
}


// create buttons of runner-up teams which were not drawn yet
function createButtonsR() {
	var buttons = document.getElementById('cldraw-buttons');
	while (buttons.firstChild) {
		buttons.removeChild(buttons.firstChild);
	}

	if (previewMode) {
		var probabilities = calculateProbabilities();
	}
	var numR = 0;
	for (var i = 0; i < 8 ; i++) {
		if (!drawnR[i]) {
			numR++;
			var button = document.createElement('button');
			button.classList.add('btn');
			button.classList.add('btn-primary');
			var text = document.createTextNode(teamsR[i]);
			button.appendChild(text);
			button.addEventListener('click', drawRunnerUp.bind(null, i, false), false);
			if (previewMode) {
				button.addEventListener('mouseover', drawRunnerUp.bind(null, i, true), false);
				button.addEventListener('mouseout', updateTable.bind(null, probabilities), false);
			}
			buttons.appendChild(button);
		}
	}
	if (numR == 0) {
		var button = document.getElementById('button-randomteam');
		button.classList.add('disabled');
	}
}

// create buttons of group winners which can be matched with the last drawn runner-up
function createButtonsW(opponent, possibleMatch) {
	var buttons = document.getElementById('cldraw-buttons');
	while (buttons.firstChild) {
		buttons.removeChild(buttons.firstChild);
	}
	if (previewMode) {
		var probabilities = calculateProbabilities(opponent);
	}
	for (var i = 0; i < 8 ; i++) {
		if (possibleMatch[i]) {
			var button = document.createElement('button');
			button.classList.add('btn');
			button.classList.add('btn-primary');
			var text = document.createTextNode(teamsW[i]);
			button.appendChild(text);
			button.addEventListener('click', drawWinner.bind(null, i, opponent, false), false);
			if (previewMode) {
				button.addEventListener('mouseover', drawWinner.bind(null, i, opponent, true), false);
				button.addEventListener('mouseout', updateTable.bind(null, probabilities, opponent), false);
			}
			buttons.appendChild(button);
		}
	}
}


function togglePreviewMode() {
	var button = document.getElementById('button-preview');
	if (previewMode) {
		previewMode = false;
		button.classList.remove('active');
	} else {
		previewMode = true;
		button.classList.add('active');
	}
	if (drawHistory.length == 0) {
		reset();
	} else {
		var team = drawHistory[drawHistory.length - 1];
		undo();
		if (team < 8) {
			drawRunnerUp(team);
		} else {
			drawWinner(team - 8, drawHistory[drawHistory.length - 1]);
		}
	}
}


function toggleHideMode() {
	var button = document.getElementById('button-hide');
	if (hideMode) {
		hideMode = false;
		button.classList.remove('active');
		var table = document.getElementById('cldraw-table');
		for (var i = 0; i < 8; i++) {
			table.rows[i + 1].style.display = '';
			for (var j = 0; j < 9; j++) {
				table.rows[j].cells[i + 1].style.display = '';
			}
		}
	} else {
		hideMode = true;
		button.classList.add('active');
		hideDrawnTeams();
	}
}


function transposeTable() {
	swap = !swap;
	var table = document.getElementById('cldraw-table');
	var oldTable = [];
	for (var i = 0; i < 8; i++) {
		oldTable[i] = [];
		for (var j = 0; j < 8; j++) {
			oldTable[i][j] = [];
			oldTable[i][j][0] = table.rows[i + 1].cells[j + 1].innerHTML;
			oldTable[i][j][1] = table.rows[i + 1].cells[j + 1].style.background;
		}
	}
	createTable();
	for (var i = 0; i < 8; i++) {
		for (var j = 0; j < 8; j++) {
			table.rows[i + 1].cells[j + 1].innerHTML = oldTable[j][i][0];
			table.rows[i + 1].cells[j + 1].style.background = oldTable[j][i][1];
		}
	}
	if (hideMode) {
		hideDrawnTeams();
	}
}


function showEditor() {
	var button = document.getElementById('button-editor');
	var div = document.getElementById('cldraw-editor');
	if (!button.classList.contains('active')) {
		for (var i = 0; i < 8; i++) {
			document.getElementById('cldraw-winner-' + i).value = teamsW[i];
			document.getElementById('cldraw-winner-' + i + '-country').value = initialCountriesW[i];
			document.getElementById('cldraw-runner-up-' + i).value = teamsR[i];
			document.getElementById('cldraw-runner-up-' + i + '-country').value = initialCountriesR[i];
		}
		button.classList.add('active');
		div.style.display = '';
	} else {
		button.classList.remove('active');
		div.style.display = 'none';
	}
}


function saveTeams() {
	var button = document.getElementById('button-editor');
	button.classList.remove('active');
	var div = document.getElementById('cldraw-editor');
	div.style.display = 'none';
	for (var i = 0; i < 8; i++) {
		teamsW[i] = document.getElementById('cldraw-winner-' + i).value;
		initialCountriesW[i] = document.getElementById('cldraw-winner-' + i + '-country').value;
		teamsR[i] = document.getElementById('cldraw-runner-up-' + i).value;
		initialCountriesR[i] = document.getElementById('cldraw-runner-up-' + i + '-country').value;
	}
	initialize();
}
