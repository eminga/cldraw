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

const INITIALIZE = 0;
const GET_PROBABILITIES = 1;
const GET_PROBABILITIES_PREVIEW = 2;
const IMPORT_PROBABILITIES = 3;
const EXPORT_PROBABILITIES = 4;
const CLEAR_CACHE = 5;

var previewMode = false;
var hideMode = false;
// swap == false: winners are rows, swap == true: winners are columns
var swap = false;

var config;
var selectedSeason = [];
var teamsW;
var teamsR;
var attrW;
var attrR;
var potSize;
// drawn{W,R}[i] == true if team i has already been drawn
var drawnW = [];
var drawnR = [];
// matched[i] == j if teams i and j are matched
var matched = [];
var drawHistory = [];
var precomputedSeasons = new Set();
var importedLimit = {};
var ignoreClicks = true;

// check if browser supports used js features
if (typeof(XPathResult) == 'undefined' || typeof(Worker) == 'undefined') {
	document.getElementById('cldraw-browser').style.display = '';
} else {
	var calculator = new Worker('cldraw.js');

	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			config = this.responseXML;
			initialize();
		}
	};
	xhr.open('GET', 'config.xml');
	xhr.send();
}


function initialize(competition, season) {
	ignoreClicks = true;
	teamsW = [];
	teamsR = [];
	attrW = [];
	attrR = [];

	// select first config entry unless competition/season is explicitly specified
	if (competition === undefined) {
		competition = config.evaluate('//teams[1]/@competition', config, null, XPathResult.STRING_TYPE, null).stringValue;
	}
	if (season === undefined) {
		season = config.evaluate('//teams[@competition = "' + competition + '"][1]/@season', config, null, XPathResult.STRING_TYPE, null).stringValue;
	}

	// load teams from config
	predicates = '[../@competition = "' + competition + '"][../@season = "' + season + '"]';
	selectedSeason = [competition, season];
	var iterator = config.evaluate('//winners' + predicates + '/team', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	var team = iterator.iterateNext();
	while (team) {
		teamsW.push(team.textContent);
		attrW.push([team.getAttribute('group'), team.getAttribute('country')]);
		team = iterator.iterateNext();
	}
	iterator = config.evaluate('//runners-up' + predicates + '/team', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	team = iterator.iterateNext();
	while (team) {
		teamsR.push(team.textContent);
		attrR.push([team.getAttribute('group'), team.getAttribute('country')]);
		team = iterator.iterateNext();
	}
	potSize = attrW.length;

	for (var i = 0; i < potSize; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
		matched[i] = -1;
	}
	drawHistory = [];
	createTable();
	createEditor();
	adjustSizes(competition, season);
	createCompetitions();
	createSeasons(competition);
	removeButtons();
	updateFixtures();

	// terminate web worker and spawn a new one if there is an ongoing expensive computation
	if (document.getElementById('cldraw-computation-running').style.display === '') {
		calculator.terminate();
		calculator = new Worker('cldraw.js');
		precomputedSeasons = new Set();
		importedLimit = {};
		document.getElementById('cldraw-computation-running').style.display = 'none';
	}
	document.getElementById('cldraw-computation-running2').style.display = 'none';

	calculator.postMessage([INITIALIZE, attrW, attrR]);

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
	document.getElementById('button-dl').style.display = 'none';

	if (potSize > 12) {
		calculator.postMessage([IMPORT_PROBABILITIES, true]);
		calculator.onmessage = function(e) {
			if (e.data === true) {
				ignoreClicks = false;
				reset();
			} else {
				document.getElementById('cldraw-computation').style.display = '';
				if (e.data) {
					if (e.data != -1) {
						document.getElementById('cldraw-dlsize').innerHTML = '(' + (e.data / 1000000).toFixed(1) + ' MB)';
					} else {
						document.getElementById('cldraw-dlsize').innerHTML = '(ca. 5 MB)';
					}
					document.getElementById('cldraw-computation-download').classList.remove('disabled');
					document.getElementById('cldraw-dlbadge').innerHTML = 'recommended';
				} else {
					document.getElementById('cldraw-computation-download').classList.add('disabled');
					document.getElementById('cldraw-dlbadge').innerHTML = 'not available';
					document.getElementById('cldraw-dlsize').innerHTML = '';
				}
			}
		}
	} else {
		ignoreClicks = false;
		reset();
	}
}


function createTable() {
	var table = document.getElementById('cldraw-table');
	var buttonShrink = document.getElementById('button-shrink');
	if (buttonShrink == null) {
		buttonShrink = document.createElement('button');
		buttonShrink.id = 'button-shrink';
		buttonShrink.classList.add('btn');
		buttonShrink.classList.add('btn-default');
		buttonShrink.appendChild(document.createTextNode('－'));
		buttonShrink.addEventListener('click', resizeTable.bind(null, false), false);
	}
	var buttonEnlarge = document.getElementById('button-enlarge');
	if (buttonEnlarge == null) {
		buttonEnlarge = document.createElement('button');
		buttonEnlarge.id = 'button-enlarge';
		buttonEnlarge.classList.add('btn');
		buttonEnlarge.classList.add('btn-default');
		// initialize table with smaller size on extra small to medium devices (bootstrap classification)
		if (window.innerWidth > 1199) {
			buttonEnlarge.classList.add('disabled');
		} else {
			table.classList.add('table-medium');
		}
		buttonEnlarge.appendChild(document.createTextNode('＋'));
		buttonEnlarge.addEventListener('click', resizeTable.bind(null, true), false);
	}

	while (table.firstChild) {
		table.removeChild(table.firstChild);
	}
	var thead = document.createElement('thead');
	var tr = document.createElement('tr');
	var th = document.createElement('th');
	tr.appendChild(th);
	var div = document.createElement('div');
	div.classList.add('btn-group');
	div.classList.add('btn-group-xs');
	div.role = 'group';
	div.appendChild(buttonShrink);
	div.appendChild(buttonEnlarge);
	th.appendChild(div);

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


function createEditor() {
	var editor = document.getElementById('cldraw-editor-groups');
	while (editor.firstChild) {
		editor.removeChild(editor.firstChild);
	}
	for (var i = 0; i < potSize; i++) {
		String.fromCharCode(65 + i)
		var row = document.createElement('div');
		row.classList.add('row');
		var div = document.createElement('div');
		div.classList.add('col-xs-2');
		var label = document.createElement('label');
		label.setAttribute('for', 'cldraw-winner-' + i);
		if (i < 12) {
			label.appendChild(document.createTextNode('Group ' + String.fromCharCode(65 + i) + ':'));
		} else {
			label.appendChild(document.createTextNode('CL ' + (i - 11) + ':'));
		}
		label.appendChild(document.createElement('p'));
		div.appendChild(label);
		row.appendChild(div);
		for (var j = 0; j < 2; j++) {
			if (j == 0) {
				var type = 'winner';
			} else {
				var type = 'runner-up';
			}
			var div = document.createElement('div');
			div.classList.add('col-xs-5');
			var input = document.createElement('input');
			input.setAttribute('id', 'cldraw-' + type + '-' + i);
			input.setAttribute('size', '15');
			if (type == 'winner') {
				input.value = teamsW[i];
			} else {
				input.value = teamsR[i];
			}
			div.appendChild(input);
			div.appendChild(document.createTextNode(' '));
			input = document.createElement('input');
			input.setAttribute('id', 'cldraw-' + type + '-' + i + '-country');
			input.setAttribute('size', '3');
			if (type == 'winner') {
				input.value = attrW[i][1];
			} else {
				input.value = attrR[i][1];
			}
			div.appendChild(input);
			row.appendChild(div);
		}
		editor.appendChild(row);
	}
	document.getElementById('cldraw-editor-season').value = selectedSeason[1];
}


function createCompetitions() {
	var buttonList = document.getElementById('cldraw-competitions');
	while (buttonList.firstChild) {
		buttonList.removeChild(buttonList.firstChild);
	}
	var iterator = config.evaluate('//competition', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	competition = iterator.iterateNext();
	while (competition) {
		var button = document.createElement('button');
		button.id = ('competition-' + competition.getAttribute('id'));
		button.classList.add('btn');
		button.classList.add('btn-default');
		var text = document.createTextNode(competition.getElementsByTagName('name')[0].textContent);
		button.appendChild(text);
		button.addEventListener('click', createSeasons.bind(null, competition.getAttribute('id')), false);
		buttonList.appendChild(button);
		competition = iterator.iterateNext();
	}
}


function createSeasons(competition) {
	var buttons= document.getElementById('cldraw-competitions').children;
	for (var i = 0; i < buttons.length; i++) {
		if (buttons[i].id == 'competition-' + competition) {
			buttons[i].classList.add('active');
		} else {
			buttons[i].classList.remove('active');
		}
	}
	var buttonList = document.getElementById('cldraw-seasons');
	while (buttonList.firstChild) {
		buttonList.removeChild(buttonList.firstChild);
	}
	var iterator = config.evaluate('//teams[@competition = "' + competition + '"]/@season', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	season = iterator.iterateNext();

	if (competition != selectedSeason[0]) {
		initialize(competition, season.textContent);
	}

	while (season) {
		var button = document.createElement('button');
		button.id = ('season-' + competition + '-' + season.textContent);
		button.classList.add('btn');
		button.classList.add('btn-default');
		if (competition == selectedSeason[0] && season.textContent == selectedSeason[1]) {
			button.classList.add('active');
		}
		var text = document.createTextNode(season.textContent);
		button.appendChild(text);
		button.addEventListener('click', initialize.bind(null, competition, season.textContent), false);
		buttonList.appendChild(button);
		season = iterator.iterateNext();
	}
}


function adjustSizes(competition, season) {
	var short = config.evaluate('//competition[@id = "' + competition + '"]/short', config, null, XPathResult.STRING_TYPE, null).stringValue;
	var roundOf = attrW.length * 2;
	document.title = short + ' R' + roundOf + ' Draw Probabilities';
	var heading = document.getElementsByTagName('h1')[0];
	heading.innerHTML = short + ' Draw Probabilities <small>(' + season + ' Round of ' + roundOf + ')</small>';
	if (potSize < 9) {
		document.getElementById('cldraw-table').classList.remove('table-condensed');
		document.getElementById('cldraw-table').parentNode.classList.remove('col-xs-12');
		document.getElementById('cldraw-table').parentNode.classList.add('col-md-9');
		document.getElementById('cldraw-table').parentNode.classList.add('col-md-pull-3');
		document.getElementById('cldraw-fixtures-panel').classList.add('col-md-3');
		document.getElementById('cldraw-fixtures-panel').classList.add('col-md-push-9');
		document.getElementById('cldraw-fixtures-panel').classList.remove('col-xs-12');
		var fixtures = document.getElementsByClassName('cldraw-fixtures');
		for (var i = 0; i < fixtures.length; i++) {
			fixtures[i].classList.remove('col-md-6');
		}
		var wrapper = document.getElementsByClassName('cldraw-fixtures-wrapper');
		for (var i = 0; i < wrapper.length; i++) {
			wrapper[i].classList.add('col-md-12');
		}
	} else {
		document.getElementById('cldraw-table').classList.add('table-condensed');
		document.getElementById('cldraw-table').parentNode.classList.add('col-xs-12');
		document.getElementById('cldraw-table').parentNode.classList.remove('col-md-9');
		document.getElementById('cldraw-table').parentNode.classList.remove('col-md-pull-3');
		document.getElementById('cldraw-fixtures-panel').classList.remove('col-md-3');
		document.getElementById('cldraw-fixtures-panel').classList.remove('col-md-push-9');
		document.getElementById('cldraw-fixtures-panel').classList.add('col-xs-12');
		var fixtures = document.getElementsByClassName('cldraw-fixtures');
		for (var i = 0; i < fixtures.length; i++) {
			fixtures[i].classList.add('col-md-6');
		}
		var wrapper = document.getElementsByClassName('cldraw-fixtures-wrapper');
		for (var i = 0; i < wrapper.length; i++) {
			wrapper[i].classList.remove('col-md-12');
		}
	}
}


function reset(expensive) {
	if (!ignoreClicks || expensive) {
		for (var i = 0; i < potSize; i++) {
			drawnW[i] = false;
			drawnR[i] = false;
			matched[i] = -1;
		}
		drawHistory = [];
		document.getElementById('button-randomteam').classList.add('disabled');
		document.getElementById('cldraw-computation').style.display = 'none';
		if (expensive) {
			document.getElementById('cldraw-computation-running').style.display = '';
		}

		calculator.postMessage([GET_PROBABILITIES]);
		calculator.onmessage = function(e) {
			var probabilities = e.data;
			updateTable(probabilities);
			createButtonsR(probabilities);
			document.getElementById('cldraw-computation-running').style.display = 'none';
			document.getElementById('button-randomteam').classList.remove('disabled');
			var button = document.getElementById('button-dl');
			if (potSize > 12 && !precomputedSeasons.has(selectedSeason.toString())) {
				button.style.display = '';
			} else {
				button.style.display = 'none';
			}
			ignoreClicks = false;
		}
		updateFixtures();
	}
}


function downloadProbabilities() {
	if (!document.getElementById('cldraw-computation-download').classList.contains('disabled')) {
		precomputedSeasons.add(selectedSeason.toString());
		calculator.postMessage([IMPORT_PROBABILITIES]);
		calculator.onmessage = function(e) {
			importedLimit[selectedSeason.toString()] = e.data;
			ignoreClicks = false;
			reset();
		}
	}
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
		var remainingTeams = 0;
		for (var i = 0; i < potSize; i++) {
			if (!drawnR[i]) {
				remainingTeams++;
			}
		}
		// show alert if probabilities were imported and remaining probabilities need to be computed now
		if (remainingTeams == importedLimit[selectedSeason.toString()]) {
			document.getElementById('cldraw-computation-running2').style.display = '';
		}
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
				text = '\u2714';
				color = '#4998ff';
			} else {
				text = (100 * fullProbabilities[i][j]).toFixed(2) + '%';
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
	document.getElementById('cldraw-computation-running2').style.display = 'none';
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
		if (!ignoreClicks) {
			reset();
		}
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
		button.classList.add('active');
		div.style.display = '';
	} else {
		button.classList.remove('active');
		div.style.display = 'none';
	}
}


function resizeTable(enlarge) {
	var table = document.getElementById('cldraw-table');
	if (table.classList.contains('table-smallest')) {
		if (enlarge) {
			document.getElementById('button-shrink').classList.remove('disabled');
			table.classList.remove('table-smallest');
			table.classList.add('table-smaller');
		}
	} else if (table.classList.contains('table-smaller')) {
		table.classList.remove('table-smaller');
		if (enlarge) {
			table.classList.add('table-small');
		} else {
			document.getElementById('button-shrink').classList.add('disabled');
			table.classList.add('table-smallest');
		}
	} else if (table.classList.contains('table-small')) {
		table.classList.remove('table-small');
		if (enlarge) {
			table.classList.add('table-medium');
		} else {
			table.classList.add('table-smaller');
		}
	} else if (table.classList.contains('table-medium')) {
		table.classList.remove('table-medium');
		if (enlarge) {
			document.getElementById('button-enlarge').classList.add('disabled');
		} else {
			table.classList.add('table-small');
		}
	} else {
		if (!enlarge) {
			document.getElementById('button-enlarge').classList.remove('disabled');
			table.classList.add('table-medium');
		}
	}
}


function saveTeams() {
	var season = document.getElementById('cldraw-editor-season').value;
	var button = document.getElementById('button-editor');
	button.classList.remove('active');
	var div = document.getElementById('cldraw-editor');
	div.style.display = 'none';
	var teams = document.createElementNS('', 'teams');
	teams.setAttribute('competition', selectedSeason[0]);
	teams.setAttribute('season', season);
	var winners = document.createElementNS('', 'winners');
	var runnersUp = document.createElementNS('', 'runners-up');
	for (var i = 0; i < potSize; i++) {
		var team = document.createElementNS('', 'team');
		team.textContent = document.getElementById('cldraw-winner-' + i).value;
		if (i < 12) {
			team.setAttribute('group', i);
		}
		team.setAttribute('country', document.getElementById('cldraw-winner-' + i + '-country').value);
		winners.appendChild(team);

		team = document.createElementNS('', 'team');
		team.textContent = document.getElementById('cldraw-runner-up-' + i).value;
		if (i < 12) {
			team.setAttribute('group', i);
		}
		team.setAttribute('country', document.getElementById('cldraw-runner-up-' + i + '-country').value);
		runnersUp.appendChild(team);
	}
	teams.appendChild(winners);
	teams.appendChild(runnersUp);

	var oldTeams = config.evaluate('//teams[@competition = "' + selectedSeason[0] + '"][@season = "' + season + '"]', config, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue;
	if (oldTeams == null) {
		config.firstChild.insertBefore(teams, config.firstChild.firstChild);
	} else {
		config.firstChild.replaceChild(teams, oldTeams);
	}

	removeButtons();
	initialize(selectedSeason[0], season);
}


function exportJSON(limit, auto) {
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
		var blob = new Blob([JSON.stringify(probabilities)], {type: 'octet/stream'});
		// increase limit if file is larger than 50MB (usually 5-10MB gzipped)
		if (auto && blob.size > 50000000) {
			calculator.postMessage([EXPORT_PROBABILITIES, limit + 1]);
		} else {
			url = window.URL.createObjectURL(blob);
			a.href = url;
			a.download = filename + '.json';
			a.click();
			window.URL.revokeObjectURL(url);
		}
	}
}
