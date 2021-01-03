'use strict';

const INITIALIZE = 0;
const GET_PROBABILITIES = 1;
const IMPORT_PROBABILITIES = 2;
const EXPORT_PROBABILITIES = 3;
const CLEAR_CACHE = 4;
const GET_ID = 5;

let hideMode = false;
let heatMode = false;
// swap == false: winners are rows, swap == true: winners are columns
let swap = false;

let calculator;
let config;
let selectedSeason = [];
let teamsW;
let teamsR;
let attrW;
let attrR;
let potSize;
// drawn{W,R}[i] == true if team i has already been drawn
let drawnW = [];
let drawnR = [];
// matched[i] == j if teams i and j are matched
let matched = [];
let drawHistory = [];
let activeDownload;
let precomputedSeasons = new Set();
let importedLimit = {};
let ignoreClicks = true;

// check if browser supports used js features
if (typeof(XPathResult) == 'undefined' || typeof(Worker) == 'undefined') {
	document.getElementById('cldraw-browser').style.display = '';
} else {
	calculator = new Worker('cldraw.js');

	let xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			config = this.responseXML;
			initialize();
		}
	};
	xhr.open('GET', 'config.xml');
	xhr.send();
}

window.addEventListener('resize', autoResizeTable, false);
autoResizeTable();

function initialize(competition, season) {
	ignoreClicks = true;
	teamsW = [];
	teamsR = [];
	attrW = [];
	attrR = [];

	// read url parameters if supported by browser
	if ('URLSearchParams' in window) {
		const url = new URL(window.location);
		if (competition == undefined) {
			competition = url.searchParams.get('competition');
		}
		if (season == undefined) {
			season = url.searchParams.get('season');
		}
	}

	// select first config entry unless competition/season is explicitly specified
	if (competition == undefined) {
		competition = config.evaluate('//teams[1]/@competition', config, null, XPathResult.STRING_TYPE, null).stringValue;
	}
	if (season == undefined) {
		season = config.evaluate('//teams[@competition = "' + competition + '"][1]/@season', config, null, XPathResult.STRING_TYPE, null).stringValue;
	}

	// load teams from config
	const predicates = '[../@competition = "' + competition + '"][../@season = "' + season + '"]';
	selectedSeason = [competition, season];
	let iterator = config.evaluate('//winners' + predicates + '/team', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	let team = iterator.iterateNext();
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

	for (let i = 0; i < potSize; i++) {
		drawnW[i] = false;
		drawnR[i] = false;
		matched[i] = -1;
	}
	drawHistory = [];
	createTable();
	showEditorButtons();
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

	if (activeDownload != null) {
		activeDownload.abort();
		return;
	}
	document.getElementById('cldraw-dlprogress').style.display = 'none';

	calculator.postMessage([INITIALIZE, attrW, attrR]);

	if (hideMode) {
		document.getElementById('button-hide').classList.add('active');
	} else {
		document.getElementById('button-hide').classList.remove('active');
	}
	document.getElementById('button-dl').style.display = 'none';

	if (potSize > 12) {
		// check if precomputed probabilities are available
		calculator.postMessage([GET_ID]);
		calculator.onmessage = function(e) {
			if (e.data[1] === true) {
				ignoreClicks = false;
				reset();
			} else {
				document.getElementById('cldraw-computation').style.display = '';
				document.getElementById('cldraw-computation-download').classList.add('disabled');
				document.getElementById('cldraw-dlbadge').innerHTML = 'checking availability...';
				document.getElementById('cldraw-dlsize').innerHTML = '';
				const filename = 'probabilities/' + e.data[0] + '.json';
				let xhr = new XMLHttpRequest();
				xhr.open('HEAD', filename);
				xhr.onreadystatechange = function() {
					if (xhr.status != 200) {
						document.getElementById('cldraw-computation-download').classList.add('disabled');
						document.getElementById('cldraw-dlbadge').innerHTML = 'not available';
						document.getElementById('cldraw-dlsize').innerHTML = '';
					} else {
						const contentLength = xhr.getResponseHeader('Content-Length');
						if (contentLength != null) {
							document.getElementById('cldraw-dlsize').innerHTML = '(' + (contentLength / 1000000).toFixed(1) + ' MB)';
						} else {
							document.getElementById('cldraw-dlsize').innerHTML = '(ca. 5 MB)';
						}
						document.getElementById('cldraw-computation-download').classList.remove('disabled');
						document.getElementById('cldraw-dlbadge').innerHTML = 'recommended';
					}
				};
				xhr.send();
			}
		}
	} else {
		ignoreClicks = false;
		reset();
	}
}


function createTable() {
	document.getElementById('cldraw-impossible').style.display = 'none';
	let table = document.getElementById('cldraw-table');
	let tr = table.getElementsByTagName('tr')[0];
	while (tr.children.length > 1) {
		tr.removeChild(tr.lastChild);
	}

	for (let i = 0; i < potSize; i++) {
		let th = document.createElement('th');
		if (!swap) {
			th.appendChild(document.createTextNode(teamsR[i]));
		} else {
			th.appendChild(document.createTextNode(teamsW[i]));
		}
		th.scope = 'col';
		tr.appendChild(th);
	}

	let tbody = table.getElementsByTagName('tbody')[0];
	while (tbody.firstChild) {
		tbody.removeChild(tbody.firstChild);
	}
	for (let i = 0; i < potSize; i++) {
		let tr = document.createElement('tr');
		let th = document.createElement('th');
		th.scope = 'row';
		if (!swap) {
			th.appendChild(document.createTextNode(teamsW[i]));
		} else {
			th.appendChild(document.createTextNode(teamsR[i]));
		}
		tr.appendChild(th);
		for (let j = 0; j < potSize; j++) {
			let td = document.createElement('td');
			td.style.textAlign = 'center';
			td.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-hourglass-split" viewBox="0 0 16 16"><path d="M2.5 15a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1h-11zm2-13v1c0 .537.12 1.045.337 1.5h6.326c.216-.455.337-.963.337-1.5V2h-7zm3 6.35c0 .701-.478 1.236-1.011 1.492A3.5 3.5 0 0 0 4.5 13s.866-1.299 3-1.48V8.35zm1 0v3.17c2.134.181 3 1.48 3 1.48a3.5 3.5 0 0 0-1.989-3.158C8.978 9.586 8.5 9.052 8.5 8.351z"/></svg>';
			tr.appendChild(td);
		}
		tbody.appendChild(tr);
	}
}

// only show team editor buttons if the loaded configuration is a sorted cl/el config with group names A...H/L
function showEditorButtons() {
	document.getElementById('button-editor').style.display = 'none';
	document.getElementById('cldraw-seasons-separator').style.display = 'none';
	document.getElementById('cldraw-add-season').style.display = 'none';
	for (let i = 0; i < potSize; i++) {
		if (i < 12) {
			if (attrW[i][0] !== String.fromCharCode(65 + i) || attrR[i][0] !== String.fromCharCode(65 + i)) {
				return;
			}
		} else {
			if ((attrW[i][0] !== '' && attrW[i][0] != null) || (attrR[i][0] !== '' && attrR[i][0] != null)) {
				return;
			}
		}
	}
	document.getElementById('button-editor').style.display = '';
	document.getElementById('cldraw-seasons-separator').style.display = '';
	document.getElementById('cldraw-add-season').style.display = '';
}


function createEditor(empty) {
	let editor = document.getElementById('cldraw-editor-groups');
	while (editor.children.length > potSize) {
		editor.removeChild(editor.lastChild);
	}
	while (editor.children.length < potSize) {
		editor.appendChild(editor.firstElementChild.cloneNode(true));
	}
	for (let i = 0; i < potSize; i++) {
		let p = document.getElementsByClassName('cldraw-winner-label')[i];
		let p2 = document.getElementsByClassName('cldraw-runner-up-label')[i];
		if (i < 12) {
			p.innerHTML = p2.innerHTML = '<span class="d-none d-lg-block">Group&nbsp;</span>' + String.fromCharCode(65 + i);
		} else {
			p.innerHTML = p2.innerHTML = 'CL ' + (i - 11);
		}
		let winner = document.getElementsByClassName('cldraw-winner')[i];
		let winnerCountry = document.getElementsByClassName('cldraw-winner-country')[i];
		let runnerUp = document.getElementsByClassName('cldraw-runner-up')[i];
		let runnerUpCountry = document.getElementsByClassName('cldraw-runner-up-country')[i];
		if (!empty) {
			winner.value = teamsW[i];
			winnerCountry.value = attrW[i][1];
			runnerUp.value = teamsR[i];
			runnerUpCountry.value = attrR[i][1];
		} else {
			winner.value = '';
			winnerCountry.value = '';
			runnerUp.value = '';
			runnerUpCountry.value = '';
		}
	}
	if (!empty) {
		document.getElementById('cldraw-editor-season').value = selectedSeason[1];
	} else {
		document.getElementById('cldraw-editor-season').value = "";
	}
}


function createCompetitions() {
	let buttonList = document.getElementById('cldraw-competitions');
	while (buttonList.firstChild) {
		buttonList.removeChild(buttonList.firstChild);
	}
	let iterator = config.evaluate('//competition', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	let competition = iterator.iterateNext();
	while (competition) {
		let button = document.createElement('li');
		button.id = ('competition-' + competition.getAttribute('id'));
		button.classList.add('nav-item');
		let a = document.createElement('a');
		a.classList.add('nav-link');
		a.setAttribute("role", "button");
		let text = document.createTextNode(competition.getElementsByTagName('name')[0].textContent);
		a.appendChild(text);
		button.appendChild(a);
		button.addEventListener('click', createSeasons.bind(null, competition.getAttribute('id')), false);
		buttonList.appendChild(button);
		competition = iterator.iterateNext();
	}
}


function createSeasons(competition) {
	let competitionButtons = document.getElementById('cldraw-competitions').children;
	for (let i = 0; i < competitionButtons.length; i++) {
		if (competitionButtons[i].id == 'competition-' + competition) {
			competitionButtons[i].firstChild.classList.add('active');
		} else {
			competitionButtons[i].firstChild.classList.remove('active');
		}
	}
	let seasonButtons = document.getElementById('cldraw-seasons');
	while (seasonButtons.firstChild.id !== 'cldraw-seasons-separator') {
		seasonButtons.removeChild(seasonButtons.firstChild);
	}
	let seasonSeparator = document.getElementById('cldraw-seasons-separator');
	let iterator = config.evaluate('//teams[@competition = "' + competition + '"]/@season', config, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
	let season = iterator.iterateNext();

	if (competition != selectedSeason[0]) {
		initialize(competition, season.textContent);
		return;
	}

	while (season) {
		let button = document.createElement('li');
		button.id = ('season-' + competition + '-' + season.textContent);
		if (competition == selectedSeason[0] && season.textContent == selectedSeason[1]) {
			button.classList.add('active');
		}
		let a = document.createElement('a');
		a.setAttribute("role", "button");
		a.classList.add('dropdown-item');
		let text = document.createTextNode(season.textContent);
		a.appendChild(text);
		button.appendChild(a);
		button.addEventListener('click', initialize.bind(null, competition, season.textContent), false);
		seasonButtons.insertBefore(button, seasonSeparator);
		season = iterator.iterateNext();
	}
}


function adjustSizes(competition, season) {
	let short = config.evaluate('//competition[@id = "' + competition + '"]/short', config, null, XPathResult.STRING_TYPE, null).stringValue;
	let roundOf = attrW.length * 2;
	document.title = short + ' R' + roundOf + ' Draw Probabilities';
	let heading = document.getElementsByTagName('h1')[0];
	heading.innerHTML = short + ' Draw Probabilities <small class="text-muted">(' + season + ' Round of ' + roundOf + ')</small>';
	document.getElementById('cldraw-seasons-button').innerText = season;
	if (potSize < 9) {
		document.getElementById('cldraw-table').classList.remove('table-sm');
		document.getElementById('cldraw-table').parentNode.classList.add('col-lg-9');
		document.getElementById('cldraw-table').parentNode.classList.add('order-lg-first');
		document.getElementById('cldraw-fixtures-card').classList.add('col-lg-3');
		document.getElementById('cldraw-fixtures-row').classList.add('row-cols-lg-1');
		document.getElementById('cldraw-fixtures-row').classList.remove('row-cols-lg-4');
	} else {
		document.getElementById('cldraw-table').classList.add('table-sm');
		document.getElementById('cldraw-table').parentNode.classList.remove('col-lg-9');
		document.getElementById('cldraw-table').parentNode.classList.remove('order-lg-first');
		document.getElementById('cldraw-fixtures-card').classList.remove('col-lg-3');
		document.getElementById('cldraw-fixtures-row').classList.remove('row-cols-lg-1');
		document.getElementById('cldraw-fixtures-row').classList.add('row-cols-lg-4');
	}
}


function reset(expensive) {
	if (!ignoreClicks || expensive) {
		for (let i = 0; i < potSize; i++) {
			drawnW[i] = false;
			drawnR[i] = false;
			matched[i] = -1;
		}
		drawHistory = [];
		document.getElementById('cldraw-buttons-heading').classList.add('d-none');
		document.getElementById('button-randomteam').classList.add('disabled');
		document.getElementById('cldraw-computation').style.display = 'none';
		if (expensive) {
			document.getElementById('cldraw-computation-running').style.display = '';
		}

		calculator.postMessage([GET_PROBABILITIES]);
		calculator.onmessage = function(e) {
			let probabilities = e.data;
			updateTable(probabilities);
			createButtonsR(probabilities);
			document.getElementById('cldraw-computation-running').style.display = 'none';
			document.getElementById('cldraw-buttons-heading').classList.remove('d-none');
			document.getElementById('button-randomteam').classList.remove('disabled');
			let button = document.getElementById('button-dl');
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
		document.getElementById('cldraw-computation').style.display = 'none';
		document.getElementById('cldraw-dlprogress').style.display = '';
		precomputedSeasons.add(selectedSeason.toString());
		calculator.postMessage([GET_ID]);
		calculator.onmessage = function(e) {
			let filename = 'probabilities/' + e.data[0] + '.json';
			activeDownload = new XMLHttpRequest();
			activeDownload.addEventListener('load', processDownload);
			activeDownload.addEventListener('progress', updateProgress);
			activeDownload.addEventListener('error', abortDownload);
			activeDownload.addEventListener('abort', abortDownload);
			activeDownload.open('GET', filename);
			activeDownload.send();
		}
	}
}


function processDownload() {
	let probabilities = JSON.parse(this.responseText);
	let minLength = 999999;
	for (let id in probabilities) {
		if (id.length < minLength) {
			minLength = id.length;
		}
	}
	importedLimit[selectedSeason.toString()] = minLength / 4;

	document.getElementById('cldraw-dlprogress').style.display = 'none';
	ignoreClicks = false;
	activeDownload = null;
	calculator.postMessage([IMPORT_PROBABILITIES, probabilities]);
	calculator.onmessage = function(e) {
		reset();
	}
}


function abortDownload() {
	activeDownload = null;
	initialize(selectedSeason[0], selectedSeason[1]);
}


function updateProgress(progress) {
	if (progress.lengthComputable) {
		document.getElementById('cldraw-dlprogress-text').style.display = '';
		document.getElementById('cldraw-dlprogress-text').innerHTML = (progress.loaded / 1000000).toFixed(1) + ' MB of ' + (progress.total / 1000000).toFixed(1) + ' MB downloaded.';
		let percentComplete = progress.loaded / progress.total * 100;
		document.getElementById('cldraw-dlprogressbar').style.width = percentComplete + '%';
		document.getElementById('cldraw-dlprogressbar').setAttribute('aria-valuenow', percentComplete.toFixed());
	} else {
		document.getElementById('cldraw-dlprogressbar').style.width = '100%';
		document.getElementById('cldraw-dlprogressbar').setAttribute('aria-valuenow', 100);
		document.getElementById('cldraw-dlprogress-text').style.display = 'none';
	}
}


function getPossibleMatches(probabilities, team) {
	let possibleMatch = [];
	let indexR = team;
	for (let i = 0; i < team; i++) {
		if (drawnR[i]) {
			indexR--;
		}
	}
	let indexW = 0;
	for (let i = 0; i < potSize; i++) {
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
		let remainingTeams = 0;
		for (let i = 0; i < potSize; i++) {
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
			let probabilities = e.data;
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
			let probabilities = e.data;
			updateTable(probabilities);
			createButtonsR(probabilities);
			updateFixtures();
			ignoreClicks = false;
		}
	}
}


function undo() {
	if (!ignoreClicks) {
		let team = drawHistory.pop();
		if (team != undefined) {
			if (team < potSize) {
				ignoreClicks = true;
				drawnR[team] = false;
				calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR]);
				calculator.onmessage = function(e) {
					let probabilities = e.data;
					updateTable(probabilities);
					createButtonsR(probabilities);
					ignoreClicks = false;
				}
				updateFixtures();
			} else {
				team -= potSize;
				drawnW[team] = false;
				matched[team] = -1;
				let opponent = drawHistory.pop();
				drawnR[opponent] = false;
				drawRunnerUp(opponent);
			}
			document.getElementById('cldraw-buttons-heading').classList.remove('d-none');
			document.getElementById('button-randomteam').classList.remove('disabled');
		}
	}
}


function drawRandomTeam() {
	if (!ignoreClicks) {
		disableButtons();
		if (drawHistory.length % 2 == 0) {
			let numR = 0;
			for (let i = 0; i < potSize; i++) {
				if (!drawnR[i]) {
					numR++;
				}
			}
			if (numR > 0) {
				let team = Math.floor(Math.random() * numR);
				for (let i = 0; i <= team; i++) {
					if (drawnR[i]) {
						team++;
					}
				}
				drawRunnerUp(team);
			}
		} else {
			let opponent = drawHistory[drawHistory.length - 1];
			calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR, opponent]);
			calculator.onmessage = function(e) {
				let probabilities = e.data;
				let possibleMatch = getPossibleMatches(probabilities, opponent);
				let numW = 0;
				for (let i = 0; i < potSize; i++) {
					if (possibleMatch[i]) {
						numW++;
					}
				}
				let team = Math.floor(Math.random() * numW);
				for (let i = 0; i <= team && i < 20; i++) {
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
	if (probabilities == null) {
		document.getElementById('cldraw-impossible').style.display = '';
		return;
	}
	let fullProbabilities = [];
	let indexW = 0;
	for (let i = 0; i < potSize; i++) {
		fullProbabilities[i] = [];
		if (drawnW[i]) {
			let opponent = matched[i];
			for (let j = 0; j < potSize; j++) {
				if (j == opponent) {
					fullProbabilities[i][j] = 1;
				} else {
					fullProbabilities[i][j] = 0;
				}
			}
		} else {
			let indexR = 0;
			for (let j = 0; j < potSize; j++) {
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

	let table = document.getElementById('cldraw-table');
	for (let i = 0; i < potSize; i++){
		for (let j = 0; j < potSize; j++){
			let cell;
			if (!swap) {
				cell = table.rows[i + 1].cells[j + 1];
			} else {
				cell = table.rows[j + 1].cells[i + 1];
			}
			cell.classList.remove('table-active', 'table-primary', 'table-secondary', 'table-warning');
			cell.style.background = '';
			let text;
			if (matched[i] == j) {
				text = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check2 " viewBox="0 0 16 16"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
				if (heatMode) {
					cell.style.background = '#ff0000';
				} else {
					cell.classList.add('table-primary');
				}
			} else {
				text = (100 * fullProbabilities[i][j]).toFixed(2) + '%';
				if (heatMode) {
					let intensity = Math.round(256 * (1 - fullProbabilities[i][j])).toString(16);
					if (intensity.length == 1) {
						intensity = '0' + intensity;
					}
					cell.style.background = '#ff' + intensity + intensity;
				} else {
					if (fullProbabilities[i][j] == 0) {
						cell.classList.add('table-secondary', 'table-active');
					} else if (j == highlight) {
						cell.classList.add('table-warning');
					}
				}
			}
			cell.innerHTML = text;
		}
	}
	document.getElementById('cldraw-impossible').style.display = 'none';
	document.getElementById('cldraw-computation-running2').style.display = 'none';
	if (hideMode) {
		hideDrawnTeams();
	}
}


function updateFixtures() {
	let fixtures = document.getElementsByClassName('cldraw-fixtures');
	let l = Math.ceil(potSize / fixtures.length);
	for (let i = 0; i < fixtures.length; i++) {
		while (fixtures[i].firstChild) {
			fixtures[i].removeChild(fixtures[i].firstChild);
		}
		for (let j = i * l; j < l * (i + 1); j++) {
			let row = document.createElement('div');
			row.classList.add('row');
			let left = document.createElement('div');
			left.classList.add('col-6');
			left.classList.add('text-end');
			left.classList.add('p-0');
			let right = document.createElement('div');
			right.classList.add('col-6');
			right.classList.add('text-start');
			right.classList.add('p-0');
			let small = document.createElement('small');
			small.appendChild(document.createTextNode('s\u00A0\u00A0'));
			right.appendChild(small);
			if (j * 2 < drawHistory.length) {
				left.appendChild(document.createTextNode(teamsR[drawHistory[j * 2]]));
			} else {
				left.appendChild(document.createTextNode('.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.'));
			}
			if (j * 2 + 1 < drawHistory.length) {
				right.appendChild(document.createTextNode(teamsW[drawHistory[j * 2 + 1] - potSize]));
			} else {
				right.appendChild(document.createTextNode('.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.\u00A0.'));
			}
			small = document.createElement('small');
			small.appendChild(document.createTextNode('\u00A0\u00A0v'));
			left.appendChild(small);
			row.appendChild(left);
			row.appendChild(right);
			fixtures[i].appendChild(row);
		}
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
	let matchedR = [];
	let matchedW = [];
	let n = drawHistory.length;
	if (n % 2 == 1) {
		n -= 1;
	}
	for (let i = 0; i < n; i++) {
		let team = drawHistory[i];
		if (team < potSize) {
			matchedR[team] = true;
		} else {
			team -= potSize;
			matchedW[team] = true;
		}
	}

	let table = document.getElementById('cldraw-table');
	for (let i = 0; i < potSize; i++) {
		if (swap ? matchedR[i] : matchedW[i]) {
			table.rows[i + 1].style.display = 'none';
		} else {
			table.rows[i + 1].style.display = '';
		}
		for (let j = 0; j < potSize + 1; j++) {
			if (swap ? matchedW[i] : matchedR[i]) {
				table.rows[j].cells[i + 1].style.display = 'none';
			} else {
				table.rows[j].cells[i + 1].style.display = '';
			}
		}
	}
}


// create buttons of runner-up teams which were not drawn yet
function createButtonsR(probabilities) {
	removeButtons();
	let buttonList = document.getElementById('cldraw-buttons');
	let button = [];
	let numR = 0;
	for (let i = 0; i < potSize ; i++) {
		if (!drawnR[i]) {
			numR++;
			button[i] = document.createElement('button');
			button[i].classList.add('btn');
			button[i].classList.add('btn-primary');
			button[i].classList.add('me-1');
			button[i].type = 'button';
			let text = document.createTextNode(teamsR[i]);
			button[i].appendChild(text);
			button[i].addEventListener('click', drawRunnerUp.bind(null, i, false), false);
		}
	}

	for (let i = 0; i < potSize; i++) {
		if (button[i] != undefined) {
			buttonList.appendChild(button[i]);
		}
	}

	if (numR > 0) {
		document.getElementById('cldraw-buttons-heading').classList.remove('d-none');
		document.getElementById('button-randomteam').classList.remove('disabled');
	}
}


// create buttons of group winners which can be matched with the last drawn runner-up
function createButtonsW(opponent, probabilities) {
	removeButtons();
	let buttonList = document.getElementById('cldraw-buttons');
	let button = [];
	let possibleMatch = getPossibleMatches(probabilities, opponent);
	for (let i = 0; i < potSize ; i++) {
		if (possibleMatch[i]) {
			button[i] = document.createElement('button');
			button[i].classList.add('btn');
			button[i].classList.add('btn-primary');
			button[i].classList.add('me-2')
			button[i].type = 'button';
			let text = document.createTextNode(teamsW[i]);
			button[i].appendChild(text);
			button[i].addEventListener('click', drawWinner.bind(null, i, opponent, false), false);
		}
	}

	for (let i = 0; i < potSize; i++) {
		if (button[i] != undefined) {
			buttonList.appendChild(button[i]);
		}
	}
	document.getElementById('cldraw-buttons-heading').classList.remove('d-none');
	document.getElementById('button-randomteam').classList.remove('disabled');
}


function removeButtons() {
	document.getElementById('cldraw-buttons-heading').classList.add('d-none');
	document.getElementById('button-randomteam').classList.add('disabled');
	let buttonList = document.getElementById('cldraw-buttons');
	while (buttonList.firstChild) {
		buttonList.removeChild(buttonList.firstChild);
	}
}


function disableButtons() {
	document.getElementById('button-randomteam').classList.add('disabled');
	let buttons = document.getElementById('cldraw-buttons').children;
	for (let i = 0; i < buttons.length; i++) {
		buttons[i].classList.add('disabled');
	}
}


function toggleHideMode() {
	let button = document.getElementById('button-hide');
	button.classList.toggle('active');
	hideMode = !hideMode;
	if (!hideMode) {
		button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-slash-fill" viewBox="0 0 16 16"><path d="M10.79 12.912l-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.027 7.027 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.088z"/><path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708l-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6l-12-12 .708-.708 12 12-.708.707z"/></svg> Hide drawn teams';
		let table = document.getElementById('cldraw-table');
		for (let i = 0; i < potSize; i++) {
			table.rows[i + 1].style.display = '';
			for (let j = 0; j < potSize + 1; j++) {
				table.rows[j].cells[i + 1].style.display = '';
			}
		}
	} else {
		button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye-fill" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg> Show drawn teams';
		hideDrawnTeams();
	}
}


function toggleHeatMode() {
	heatMode = !heatMode;
	let button = document.getElementById('button-heat');
	button.classList.toggle('active');

	if (drawHistory.length % 2 == 0) {
		calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR]);
		calculator.onmessage = function(e) {
			let probabilities = e.data;
			updateTable(probabilities);
		}
	} else {
		let opponent = drawHistory[drawHistory.length - 1];
		calculator.postMessage([GET_PROBABILITIES, drawnW, drawnR, opponent]);
		calculator.onmessage = function(e) {
			let probabilities = e.data;
			updateTable(probabilities, opponent);
		}
	}
}


function transposeTable() {
	swap = !swap;
	let table = document.getElementById('cldraw-table');
	let oldTable = [];
	for (let i = 0; i < potSize; i++) {
		oldTable[i] = [];
		for (let j = 0; j < potSize; j++) {
			oldTable[i][j] = [];
			oldTable[i][j][0] = table.rows[i + 1].cells[j + 1].innerHTML;
			oldTable[i][j][1] = table.rows[i + 1].cells[j + 1].classList;
			oldTable[i][j][2] = table.rows[i + 1].cells[j + 1].style.background;
		}
	}
	createTable();
	for (let i = 0; i < potSize; i++) {
		for (let j = 0; j < potSize; j++) {
			table.rows[i + 1].cells[j + 1].innerHTML = oldTable[j][i][0];
			let classes = oldTable[j][i][1].value.split(' ');
			for (let c of classes) {
				if (c) {
					table.rows[i + 1].cells[j + 1].classList.add(c);
				}
			}
			table.rows[i + 1].cells[j + 1].style.background = oldTable[j][i][2];
		}
	}
	if (hideMode) {
		hideDrawnTeams();
	}
}


function resizeTable(enlarge) {
	window.removeEventListener('resize', autoResizeTable, false);
	let table = document.getElementById('cldraw-table');
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

// shrink table on extra small to medium devices (bootstrap classification)
function autoResizeTable() {
	if (window.innerWidth > 1199) {
		document.getElementById('button-enlarge').classList.add('disabled');
		document.getElementById('cldraw-table').classList.remove('table-medium');
	} else {
		document.getElementById('button-enlarge').classList.remove('disabled');
		document.getElementById('cldraw-table').classList.add('table-medium');
	}
}


function saveTeams() {
	let season = document.getElementById('cldraw-editor-season').value;
	let button = document.getElementById('button-editor');
	button.classList.remove('active');
	let teams = document.createElementNS('', 'teams');
	teams.setAttribute('competition', selectedSeason[0]);
	teams.setAttribute('season', season);
	let winners = document.createElementNS('', 'winners');
	let runnersUp = document.createElementNS('', 'runners-up');
	for (let i = 0; i < potSize; i++) {
		let team = document.createElementNS('', 'team');
		team.textContent = document.getElementsByClassName('cldraw-winner')[i].value;
		if (i < 12) {
			team.setAttribute('group', String.fromCharCode(65 + i));
		}
		team.setAttribute('country', document.getElementsByClassName('cldraw-winner-country')[i].value);
		winners.appendChild(team);

		team = document.createElementNS('', 'team');
		team.textContent = document.getElementsByClassName('cldraw-runner-up')[i].value;
		if (i < 12) {
			team.setAttribute('group', String.fromCharCode(65 + i));
		}
		team.setAttribute('country', document.getElementsByClassName('cldraw-runner-up-country')[i].value);
		runnersUp.appendChild(team);
	}
	teams.appendChild(winners);
	teams.appendChild(runnersUp);

	let oldTeams = config.evaluate('//teams[@competition = "' + selectedSeason[0] + '"][@season = "' + season + '"]', config, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null).singleNodeValue;
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
		let probabilities = e.data;
		let filename = '';
		let maxLength = -1;
		for (let id in probabilities) {
			if (id.length > maxLength) {
				filename = id;
				maxLength = id.length;
			}
		}
		let a = document.createElement('a');
		document.body.appendChild(a);
		let blob = new Blob([JSON.stringify(probabilities)], {type: 'octet/stream'});
		// increase limit if file is larger than 50MB (usually 5-10MB gzipped)
		if (auto && blob.size > 50000000) {
			calculator.postMessage([EXPORT_PROBABILITIES, limit + 1]);
		} else {
			let url = window.URL.createObjectURL(blob);
			a.href = url;
			a.download = filename + '.json';
			a.click();
			window.URL.revokeObjectURL(url);
		}
	}
}
