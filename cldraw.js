/*  CL Draw Probabilities
 *  Copyright (C) 2017  eminga
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

/*
Team, Country (Code)
	Winners
Manchester United FC, England (0)
Paris St. Germain, France (1)
Chelsea FC, England (0)
FC Barcelona, Spain (2)
Liverpool FC, England (0)
Manchester City FC, England (0)
Beşiktaş JK, Turkey (3)
Tottenham Hotspur FC, England (0)

	Runners-up
FC Basel 1893, Switzerland (4)
FC Bayern München, Germany (5)
AS Roma, Italy (6)
Juventus, Italy (6)
Sevilla FC, Spain (2)
FC Shakhtar Donetsk, Ukraine (7)
FC Porto, Portugal (8)
Real Madrid CF, Spain (2)
*/

var teamsW = ['Manchester United','Paris St. Germain','Chelsea FC','FC Barcelona','Liverpool FC','Manchester City','Beşiktaş JK','Tottenham Hotspur'];
var countriesW = [0, 1, 0, 2, 0, 0, 3, 0];
var teamsR = ['FC Basel','FC Bayern','AS Roma','Juventus','Sevilla FC','Shakhtar','FC Porto','Real Madrid'];

var countriesR = [4, 5, 6, 6, 2, 7, 8, 2];


// drawn{W,R}[i] == true if team i has already been drawn
var drawnW = [];
var drawnR = [];

// matched[i] == j if teams i and j are matched
var matched = [];

var calculatedProbabilities = [];

createTable();

// if available, load precalculated probabilities
var filename = 'probabilities_';
for (var i = 0; i < 8; i++) {
	filename += countriesW[i];
}
for (var i = 0; i < 8; i++) {
	filename += countriesR[i];
}
filename += '.json';

var xhr = new XMLHttpRequest();
xhr.onreadystatechange = function() {
	if (this.readyState == 4) {
		if (this.status == 200) {
			calculatedProbabilities = JSON.parse(this.responseText);
		}
		reset();
	}
};
xhr.open('GET', filename);
xhr.send();


function reset() {
	for (var i = 0; i < 8; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
		matched[i] = -1;
	}
	updateTable(calculateProbabilities());
	createButtonsR();
}


// returns true if draw is a valid draw
function isValid(draw) {
	var j = 0;
	for (var i = 0; i < draw.length; i++) {
		while (drawnW[i + j]) {
			j++;
		}
		if (i + j == draw[i] || countriesW[i + j] == countriesR[draw[i]]) {
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


function calculateProbabilities(team, possibleMatch) {
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
		if (team == undefined) {
			var possibleMatches = calculatePossibleMatches();

			for (var i = 0; i < 8; i++) {
				if (!drawnR[i]) {
					options++;
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
		// if an opponent for team "team" is to be drawn next
		} else { 
			for (var i = 0; i < 8; i++) {
				if (possibleMatch[i]) {
					options++;
					matched[i] = team;
					drawnW[i] = true;
					var temp = calculateProbabilities();
					for (var j = 0; j < 8; j++) {
						for (var k = 0; k < 8; k++) {
							probabilities[j][k] += temp[j][k];
						}
					}
					probabilities[i][team] += 1;
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


function drawRunnerUp(team) {
	var possibleMatch = calculatePossibleMatches()[team];
	drawnR[team] = true;
	var probabilities = calculateProbabilities(team, possibleMatch);
	updateTable(probabilities, team);
	createButtonsW(team, possibleMatch);
}


function drawWinner(team, opponent) {
	matched[team] = opponent;
	drawnW[team] = true;
	updateTable(calculateProbabilities());
	createButtonsR();
}


function createTable() {
	var table = document.getElementById('cldraw-table');
	var thead = document.createElement('thead');
	var tr = document.createElement('tr');
	var td = document.createElement('td');
	tr.appendChild(td)
	for (var i = 0; i < 8; i++) {
		var td = document.createElement('td');
		td.appendChild(document.createTextNode(teamsR[i]));
		td.style.fontWeight = 'bold';
		tr.appendChild(td);
	}
	thead.appendChild(tr);

	var tbody = document.createElement('thead');
	for (var i = 0; i < 8; i++) {
		var tr = document.createElement('tr');
		var td = document.createElement('td');
		td.style.fontWeight = 'bold';
		td.appendChild(document.createTextNode(teamsW[i]));
		tr.appendChild(td);
		for (var j = 0; j < 8; j++) {
			var td = document.createElement('td');
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

// create buttons of runner-up teams which were not drawn yet
function createButtonsR() {
	var buttons = document.getElementById('cldraw-buttons');
	while (buttons.firstChild) {
		buttons.removeChild(buttons.firstChild);
	}
	for (var i = 0; i < 8 ; i++) {
		if (!drawnR[i]) {
			var button = document.createElement('button');
			button.classList.add('btn');
			button.classList.add('btn-primary');
			var text = document.createTextNode(teamsR[i]);
			button.appendChild(text);
			button.addEventListener('click', drawRunnerUp.bind(null, i), false);
			buttons.appendChild(button);
		}
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
			button.addEventListener('click', drawWinner.bind(null, i, opponent), false);
			buttons.appendChild(button);
		}
	}
}
