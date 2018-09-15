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

var calculatedProbabilities;

initialize();


// creates a filename for the cached probabilities (e.g. 1000213213100013.json)
function createFilename() {
	var filename = '';
	for (var i = 0; i < 8; i++) {
		filename += countriesW[i];
		filename += countriesR[i];
	}
	filename += '.json';
	return filename;
}


function initialize() {
	createTable();
	calculatedProbabilities = [];

	// assign the same number c > 0 to all teams which are from the same
	// country and where both pots contain at least one team from this country
	for (var i = 0; i < 8; i++) {
		countriesW[i] = 0;
		countriesR[i] = 0;
	}
	var c = 1;
	for (var i = 0; i < 8; i++) {
		if (countriesW[i] == 0) {
			var sameCountry = false;
			for (var j = 0; j < 8; j++) {
				if (initialCountriesR[j] == initialCountriesW[i]) {
					countriesR[j] = c;
					sameCountry = true;
				}
			}
			if (sameCountry) {
				countriesW[i] = c;
				for (var j = i; j < 8; j++) {
					if (initialCountriesW[j] == initialCountriesW[i]) {
						countriesW[j] = c;
					}
				}
				c++;
			}
		}
	}

	// if available, load precalculated probabilities
	filename = 'probabilities/' + createFilename();
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4) {
			var button = document.getElementById('jsondl');
			if (this.status == 200) {
				button.style.display = 'none';
				calculatedProbabilities = JSON.parse(this.responseText);
			} else {
				button.style.display = '';
			}
			reset();
		}
	};
	xhr.open('GET', filename);
	xhr.send();
}


function reset() {
	for (var i = 0; i < 8; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
		matched[i] = -1;
	}
	updateTable(calculateProbabilities());
	createButtonsR();
	drawHistory = [];
	updateFixtures();
	document.getElementById('button-randomteam').classList.remove('disabled');
}


// returns true if draw is a valid draw
function isValid(draw) {
	var j = 0;
	for (var i = 0; i < draw.length; i++) {
		while (drawnW[i + j]) {
			j++;
		}
		if (i + j == draw[i] || (countriesW[i + j] != 0 && countriesW[i + j] == countriesR[draw[i]])) {
			return false;
		}
	}
	return true;
}


// returns matrix with teams i,j which can be matched s.t. there remains
// at least one valid draw after i and j have been matched
function calculatePossibleMatches() {
	var availableTeams = [];
	for (var i = 0; i < 8; i++) {
		if (!drawnR[i]) {
			availableTeams.push(i);
		}
	}

	var possibleMatches = [];
	for (var i = 0; i < 8; i++) {
		possibleMatches[i] = [];
		for (var j = 0; j < 8; j++) {
			possibleMatches[i][j] = false;
		}
	}

	if (availableTeams.length > 0) {
		draws = Combinatorics.permutation(availableTeams);

		while(draw = draws.next()) {
			if (isValid(draw)) {
				var j = 0;
				for (var k = 0; k < draw.length; k++) {
					while (drawnW[k + j]) {
						j++;
					}
					possibleMatches[draw[k]][k + j] = true;
				}
			}
		}
	}

	return possibleMatches;
}

// generates an identifier for the drawn teams
function generateId() {
	x = 0;
	for (var i = 0; i < 8; i++) {
		x <<= 1;
		if (drawnW[i]) {
			x |= 1;
		}
	}
	for (var i = 0; i < 8; i++) {
		x <<= 1;
		if (drawnR[i]) {
			x |= 1;
		}
	}
	return x;
}


function calculateProbabilities(unmatchedRunnerUp, possibleMatch) {
	var id = generateId();
	var probabilities = [];

	// use cached probabilities if existing
	if (calculatedProbabilities[id] != null) {
		probabilities = calculatedProbabilities[id];
	} else {
		var options = 0;
		for (var i = 0; i < 8; i++) {
			probabilities[i] = [];
			for (var j = 0; j < 8; j++) {
				probabilities[i][j] = 0;
			}
		}

		// if the same number of winners and runners-up has been drawn
		if (unmatchedRunnerUp == undefined) {
			var possibleMatches = calculatePossibleMatches();
			for (var i = 0; i < 8; i++) {
				if (!drawnR[i]) {
					options++;
					// temporarily draw runner-up i and calculate the resulting probabilities
					drawnR[i] = true;
					var temp = calculateProbabilities(i, possibleMatches[i]);
					for (var j = 0; j < 8; j++) {
						for (var k = 0; k < 8; k++) {
							probabilities[j][k] += temp[j][k];
						}
					}
					drawnR[i] = false;
				}
			}

			calculatedProbabilities[id] = probabilities;
		// if an opponent for team unmatchedRunnerUp is to be drawn next
		} else { 
			for (var i = 0; i < 8; i++) {
				if (possibleMatch[i]) {
					options++;
					// temporarily match unmatchedRunnerUp with winner i and calculate the resulting probabilities
					matched[i] = unmatchedRunnerUp;
					drawnW[i] = true;
					var temp = calculateProbabilities();
					for (var j = 0; j < 8; j++) {
						for (var k = 0; k < 8; k++) {
							probabilities[j][k] += temp[j][k];
						}
					}
					probabilities[i][unmatchedRunnerUp] += 1;
					matched[i] = -1;
					drawnW[i] = false;
				}
			}
		}

		if (options > 0) {
			for (var i = 0; i < 8; i++) {
				for (var j = 0; j < 8; j++) {
					probabilities[i][j] /= options;
				}
			}
		}
	}

	return probabilities;
}


function drawRunnerUp(team, preview = false) {
	var possibleMatch = calculatePossibleMatches()[team];
	drawnR[team] = true;
	var probabilities = calculateProbabilities(team, possibleMatch);
	updateTable(probabilities, team);
	if (!preview) {
		drawHistory.push(team);
		createButtonsW(team, possibleMatch);
		updateFixtures();
	} else {
		drawnR[team] = false;
	}
}


function drawWinner(team, opponent, preview = false) {
	matched[team] = opponent;
	drawnW[team] = true;
	updateTable(calculateProbabilities());
	if (!preview) {
		drawHistory.push(team + 8);
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
	var opponent = -1;
	// check if there is a drawn but unmatched runner-up
	for (var i = 0; i < 8; i++) {
		if (drawnR[i] && !matched.includes(i)) {
			opponent = i;
		}
	}

	if (opponent == -1) {
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
		drawnR[opponent] = false;
		var possibleMatch = calculatePossibleMatches()[opponent];
		drawnR[opponent] = true;
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
		th.appendChild(document.createTextNode(teamsR[i]));
		th.scope = 'col';
		tr.appendChild(th);
	}
	thead.appendChild(tr);

	var tbody = document.createElement('tbody');
	for (var i = 0; i < 8; i++) {
		var tr = document.createElement('tr');
		var th = document.createElement('th');
		th.scope = 'row';
		th.appendChild(document.createTextNode(teamsW[i]));
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
	var table = document.getElementById('cldraw-table');
	for (var i = 0; i < 8; i++){
		for (var j = 0; j < 8; j++){
			var color = '';
			var text;
			if (matched[i] == j) {
				text = 'drawn';
				color = '#4998ff';
			} else {
				text = (100 * probabilities[i][j]).toFixed(2) + "%";
				if (probabilities[i][j] == 0) {
					color = '#999999';
				} else if (j == highlight) {
					color = '#f5ff75';
				}
			}
			table.rows[i + 1].cells[j + 1].innerHTML = text;
			table.rows[i + 1].cells[j + 1].style.background = color;
		}
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
	document.getElementById('cldraw-fixtures').innerHTML = text;
	if (drawHistory.length > 0) {
		document.getElementById('button-undo').classList.remove('disabled');
	} else {
		document.getElementById('button-undo').classList.add('disabled');
	}
}


// create buttons of runner-up teams which were not drawn yet
function createButtonsR() {
	var buttons = document.getElementById('cldraw-buttons');
	while (buttons.firstChild) {
		buttons.removeChild(buttons.firstChild);
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
				var probabilities = calculateProbabilities();
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
	for (var i = 0; i < 8 ; i++) {
		if (!drawnW[i] && possibleMatch[i]) {
			var button = document.createElement('button');
			button.classList.add('btn');
			button.classList.add('btn-primary');
			var text = document.createTextNode(teamsW[i]);
			button.appendChild(text);
			button.addEventListener('click', drawWinner.bind(null, i, opponent, false), false);
			if (previewMode) {
				button.addEventListener('mouseover', drawWinner.bind(null, i, opponent, true), false);
				var probabilities = calculateProbabilities(opponent, possibleMatch);
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


function downloadJSON() {
	var croppedProbabilities = [];
	for (var i = 0; i < calculatedProbabilities.length; i++) {
		if (calculatedProbabilities[i] != null) {
			var depth = 0;
			var id = i;
			while (id > 0) {
				depth += id % 2;
				id >>>= 1;
			}
			// only store probabilities for cases where less then 5 teams have been drawn
			if (depth < 5) {
				croppedProbabilities[i] = [];
				for (var j = 0; j < 8; j++) {
					croppedProbabilities[i][j] = [];
					for (var k = 0; k < 8; k++) {
						croppedProbabilities[i][j][k] = calculatedProbabilities[i][j][k];
					}
				}
			}
		}
	}

	var a = document.createElement("a");
	document.body.appendChild(a);
	url = window.URL.createObjectURL(new Blob([JSON.stringify(croppedProbabilities)], {type: "octet/stream"}));
	a.href = url;
	a.download = createFilename();
	a.click();
	window.URL.revokeObjectURL(url);
}
