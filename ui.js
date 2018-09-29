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
const IMPORT_PROBABILITIES = 3;
const EXPORT_PROBABILITIES = 4;
const CLEAR_CACHE = 5;

// drawn{W,R}[i] == true if team i has already been drawn
var drawnW = [];
var drawnR = [];

// matched[i] == j if teams i and j are matched
var matched = [];

var drawHistory = [];
var ignoreClicks = false;

var calculator = new Worker('cldraw.js');
initialize();

function initialize() {
	potSize = countriesW.length;
	createTable();

	calculator.postMessage([SET_COUNTRIES, countriesW, countriesR]);

	if (previewMode) {
		document.getElementById('button-preview').classList.add('active');
	} else {
		document.getElementById('button-preview').classList.remove('active');
	}
	if (hideMode) {
		document.getElementById('button-hide').classList.add('active');
	} else {
		document.getElementById('button-hide').classList.remove('active');
	}

	if (potSize > 12) {
		calculator.postMessage([IMPORT_PROBABILITIES]);
		calculator.onmessage = function(e) {
			reset(e.data);
		}
	} else {
		reset();
	}
}


function reset(dlButton) {
	for (var i = 0; i < potSize; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
		matched[i] = -1;
	}
	drawHistory = [];
	document.getElementById('button-randomteam').classList.add('disabled');

	calculator.postMessage([GET_PROBABILITIES]);
	calculator.onmessage = function(e) {
		var probabilities = e.data;
		updateTable(probabilities);
		createButtonsR(probabilities);
		document.getElementById('button-randomteam').classList.remove('disabled');
		if (dlButton !== undefined) {
			var button = document.getElementById('button-dl');
			if (button != null) {
				if (dlButton) {
					button.style.display = 'none';
				}
				else {
					button.style.display = '';
				}
			}
		}
	}
	updateFixtures();
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
	for (var i = 0; i < potSize; i++) {
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


function drawRunnerUp(team) {
	if (!ignoreClicks) {
		ignoreClicks = true;
		disableButtons();
		drawnR[team] = true;
		// write to history before table is updated, needed to hide drawn teams
		drawHistory.push(team);
		calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR, team]);
		calculator.onmessage = function(e) {
			var probabilities = e.data;
			updateTable(probabilities, team);
			createButtonsW(team, probabilities);
			updateFixtures();
			ignoreClicks = false;
		}
	}
}


function drawWinner(team, opponent) {
	if (!ignoreClicks) {
		ignoreClicks = true;
		disableButtons();
		matched[team] = opponent;
		drawnW[team] = true;
		// write to history before table is updated, needed to hide drawn teams
		drawHistory.push(team + potSize);
		calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR]);
		calculator.onmessage = function(e) {
			var probabilities = e.data;
			updateTable(probabilities);
			createButtonsR(probabilities);
			updateFixtures();
			ignoreClicks = false;
		}
	}
}


function undo() {
	if (!ignoreClicks) {
		team = drawHistory.pop();
		if (team != undefined) {
			if (team < potSize) {
				ignoreClicks = true;
				drawnR[team] = false;
				calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR]);
				calculator.onmessage = function(e) {
					var probabilities = e.data;
					updateTable(probabilities);
					createButtonsR(probabilities);
					ignoreClicks = false;
				}
				updateFixtures();
			} else {
				team -= potSize;
				drawnW[team] = false;
				matched[team] = -1;
				opponent = drawHistory.pop();
				drawnR[opponent] = false;
				drawRunnerUp(opponent);
			}
			document.getElementById('button-randomteam').classList.remove('disabled');
		}
	}
}


function drawRandomTeam() {
	if (!ignoreClicks) {
		disableButtons();
		if (drawHistory.length % 2 == 0) {
			var numR = 0;
			for (var i = 0; i < potSize; i++) {
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
			calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR, opponent]);
			calculator.onmessage = function(e) {
				var probabilities = e.data;
				var possibleMatch = getPossibleMatches(probabilities, opponent);
				var numW = 0;
				for (var i = 0; i < potSize; i++) {
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
	for (var i = 0; i < potSize; i++) {
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
	for (var i = 0; i < potSize; i++) {
		var tr = document.createElement('tr');
		var th = document.createElement('th');
		th.scope = 'row';
		if (!swap) {
			th.appendChild(document.createTextNode(teamsW[i]));
		} else {
			th.appendChild(document.createTextNode(teamsR[i]));
		}
		tr.appendChild(th);
		for (var j = 0; j < potSize; j++) {
			var td = document.createElement('td');
			td.style.textAlign = 'center';
			td.appendChild(document.createTextNode('\u231B'));
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
	for (var i = 0; i < potSize; i++) {
		fullProbabilities[i] = [];
		if (drawnW[i]) {
			var opponent = matched[i];
			for (var j = 0; j < potSize; j++) {
				if (j == opponent) {
					fullProbabilities[i][j] = 1;
				} else {
					fullProbabilities[i][j] = 0;
				}
			}
		} else {
			var indexR = 0;
			for (var j = 0; j < potSize; j++) {
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
	for (var i = 0; i < potSize; i++){
		for (var j = 0; j < potSize; j++){
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
	var fixtures = document.getElementsByClassName('cldraw-fixtures');
	var l = Math.ceil(potSize / fixtures.length);
	for (var i = 0; i < fixtures.length; i++) {
		var text = '';
		for (var j = i * l; j < l * (i + 1); j++) {
			if (j * 2 < drawHistory.length) {
				team = drawHistory[j * 2];
				text += teamsR[team] + ' - ';
				if (j * 2 + 1 < drawHistory.length) {
					team = drawHistory[j * 2 + 1];
					text += teamsW[team - potSize];
				}
			}
			text += '<br>';
		}
		fixtures[i].innerHTML = text;

	}
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
		if (team < potSize) {
			matchedR[team] = true;
		} else {
			team -= potSize;
			matchedW[team] = true;
		}
	}

	var table = document.getElementById('cldraw-table');
	if (swap) {
		for (var i = 0; i < potSize; i++) {
			if (matchedR[i]) {
				table.rows[i + 1].style.display = 'none';
			} else {
				table.rows[i + 1].style.display = '';
			}
			for (j = 0; j < potSize + 1; j++) {
				if (matchedW[i]) {
					table.rows[j].cells[i + 1].style.display = 'none';
				} else {
					table.rows[j].cells[i + 1].style.display = '';
				}
			}
		}
	} else {
		for (var i = 0; i < potSize; i++) {
			if (matchedW[i]) {
				table.rows[i + 1].style.display = 'none';
			} else {
				table.rows[i + 1].style.display = '';
			}
			for (j = 0; j < potSize + 1; j++) {
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
function createButtonsR(probabilities) {
	removeButtons();
	var buttonList = document.getElementById('cldraw-buttons');
	var button = [];
	var numR = 0;
	for (var i = 0; i < potSize ; i++) {
		if (!drawnR[i]) {
			numR++;
			button[i] = document.createElement('button');
			button[i].classList.add('btn');
			button[i].classList.add('btn-primary');
			var text = document.createTextNode(teamsR[i]);
			button[i].appendChild(text);
			button[i].addEventListener('click', drawRunnerUp.bind(null, i, false), false);
		}
	}

	if (previewMode) {
		var teams = [];
		for (var i = 0; i < potSize; i++) {
			if (button[i] != undefined) {
				teams[i] = true;
			}
		}
		calculator.postMessage([GET_PROBABILITIES_PREVIEW, drawnW, drawnR, teams]);
		calculator.onmessage = function(e) {
			var probabilities2 = e.data;
			for (var i = 0; i < potSize; i++) {
				if (button[i] != undefined) {
					button[i].addEventListener('mouseover', updateTable.bind(null, probabilities2[i], i), false);
					button[i].addEventListener('mouseout', updateTable.bind(null, probabilities), false);
					buttonList.appendChild(button[i]);
				}
			}
		}
	} else {
		for (var i = 0; i < potSize; i++) {
			if (button[i] != undefined) {
				buttonList.appendChild(button[i]);
			}
		}
	}

	if (numR > 0) {
		document.getElementById('button-randomteam').classList.remove('disabled');
	}
}


// create buttons of group winners which can be matched with the last drawn runner-up
function createButtonsW(opponent, probabilities) {
	removeButtons();
	var buttonList = document.getElementById('cldraw-buttons');
	var button = [];
	var possibleMatch = getPossibleMatches(probabilities, opponent);
	for (var i = 0; i < potSize ; i++) {
		if (possibleMatch[i]) {
			button[i] = document.createElement('button');
			button[i].classList.add('btn');
			button[i].classList.add('btn-primary');
			var text = document.createTextNode(teamsW[i]);
			button[i].appendChild(text);
			button[i].addEventListener('click', drawWinner.bind(null, i, opponent, false), false);
		}
	}

	if (previewMode) {
		var teams = [];
		for (var i = 0; i < potSize; i++) {
			if (button[i] != undefined) {
				teams[i] = true;
			}
		}
		calculator.postMessage([GET_PROBABILITIES_PREVIEW, drawnW, drawnR, teams]);
		calculator.onmessage = function(e) {
			var probabilities2 = e.data;
			for (var i = 0; i < potSize; i++) {
				if (button[i] != undefined) {
					button[i].addEventListener('mouseover', previewHelper.bind(null, probabilities2[i], i, opponent), false);
					button[i].addEventListener('mouseout', updateTable.bind(null, probabilities, opponent), false);
					buttonList.appendChild(button[i]);
				}
			}
		}
	} else {
		for (var i = 0; i < potSize; i++) {
			if (button[i] != undefined) {
				buttonList.appendChild(button[i]);
			}
		}
	}
	document.getElementById('button-randomteam').classList.remove('disabled');
}


function removeButtons() {
	document.getElementById('button-randomteam').classList.add('disabled');
	var buttonList = document.getElementById('cldraw-buttons');
	while (buttonList.firstChild) {
		buttonList.removeChild(buttonList.firstChild);
	}
}

function disableButtons() {
	document.getElementById('button-randomteam').classList.add('disabled');
	var buttons = document.getElementById('cldraw-buttons').children;
	for (var i = 0; i < buttons.length; i++) {
		buttons[i].classList.add('disabled');
	}
}


function previewHelper(probabilities, winner, runnerUp) {
	drawnW[winner] = true;
	matched[winner] = runnerUp;
	updateTable(probabilities);
	drawnW[winner] = false;
	matched[winner] = -1;
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
		var team = drawHistory.pop();
		if (team < potSize) {
			drawRunnerUp(team);
		} else {
			drawWinner(team - potSize, drawHistory[drawHistory.length - 1]);
		}
	}
}


function toggleHideMode() {
	var button = document.getElementById('button-hide');
	if (hideMode) {
		hideMode = false;
		button.classList.remove('active');
		var table = document.getElementById('cldraw-table');
		for (var i = 0; i < potSize; i++) {
			table.rows[i + 1].style.display = '';
			for (var j = 0; j < potSize + 1; j++) {
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
	for (var i = 0; i < potSize; i++) {
		oldTable[i] = [];
		for (var j = 0; j < potSize; j++) {
			oldTable[i][j] = [];
			oldTable[i][j][0] = table.rows[i + 1].cells[j + 1].innerHTML;
			oldTable[i][j][1] = table.rows[i + 1].cells[j + 1].style.background;
		}
	}
	createTable();
	for (var i = 0; i < potSize; i++) {
		for (var j = 0; j < potSize; j++) {
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
		for (var i = 0; i < potSize; i++) {
			document.getElementById('cldraw-winner-' + i).value = teamsW[i];
			document.getElementById('cldraw-winner-' + i + '-country').value = countriesW[i];
			document.getElementById('cldraw-runner-up-' + i).value = teamsR[i];
			document.getElementById('cldraw-runner-up-' + i + '-country').value = countriesR[i];
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
	for (var i = 0; i < potSize; i++) {
		teamsW[i] = document.getElementById('cldraw-winner-' + i).value;
		countriesW[i] = document.getElementById('cldraw-winner-' + i + '-country').value;
		teamsR[i] = document.getElementById('cldraw-runner-up-' + i).value;
		countriesR[i] = document.getElementById('cldraw-runner-up-' + i + '-country').value;
	}
	if (potSize > 12) {
		calculator.postMessage([CLEAR_CACHE]);
		var button = document.getElementById('button-dl');
		if (button != null) {
			button.style.display = 'none';
		}
	}
	removeButtons();
	initialize();
}


function downloadJSON(limit) {
	if (limit == undefined) {
		limit = 0;
	}
	calculator.postMessage([EXPORT_PROBABILITIES, limit]);
	calculator.onmessage = function(e) {
		var probabilities = e.data;
		var filename = '';
		var maxLength = -1;
		for (var id in probabilities) {
			if (id.length > maxLength) {
				filename = id;
				maxLength = id.length;
			}
		}
		var a = document.createElement('a');
		document.body.appendChild(a);
		url = window.URL.createObjectURL(new Blob([JSON.stringify(probabilities)], {type: "octet/stream"}));
		a.href = url;
		a.download = filename + '.json';
		a.click();
		window.URL.revokeObjectURL(url);
	}
}
