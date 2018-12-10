'use strict';

let fractionMode = true;
document.getElementById('button-fraction').classList.add('active');

function adjustSizes(competition, season) {
	let short = config.evaluate('//competition[@id = "' + competition + '"]/short', config, null, XPathResult.STRING_TYPE, null).stringValue;
	let roundOf = attrW.length * 2;
	document.title = short + ' R' + roundOf + ' Draw Probabilities';
	let heading = document.getElementsByTagName('h1')[0];
	heading.innerHTML = short + ' Draw Probabilities <small>(' + season + ' Round of ' + roundOf + ')</small>';
	document.getElementById('cldraw-table').classList.add('table-condensed');
	document.getElementById('cldraw-table').parentNode.classList.add('col-xs-12');
	document.getElementById('cldraw-table').parentNode.classList.remove('col-md-9');
	document.getElementById('cldraw-table').parentNode.classList.remove('col-md-pull-3');
	document.getElementById('cldraw-fixtures-panel').classList.remove('col-md-3');
	document.getElementById('cldraw-fixtures-panel').classList.remove('col-md-push-9');
	document.getElementById('cldraw-fixtures-panel').classList.add('col-xs-12');
	let fixtures = document.getElementsByClassName('cldraw-fixtures');
	for (let i = 0; i < fixtures.length; i++) {
		fixtures[i].classList.add('col-md-6');
	}
	let wrapper = document.getElementsByClassName('cldraw-fixtures-wrapper');
	for (let i = 0; i < wrapper.length; i++) {
		wrapper[i].classList.remove('col-md-12');
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
					fullProbabilities[i][j] = 1n;
				} else {
					fullProbabilities[i][j] = 0n;
				}
			}
		} else {
			let indexR = 0;
			for (let j = 0; j < potSize; j++) {
				if (drawnR[j] && j != highlight) {
					fullProbabilities[i][j] = 0n;
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
			let color = '';
			let text;
			if (matched[i] == j) {
				text = '\u2714';
				color = '#4998ff';
			} else {
				let n;
				let d;
				if (fullProbabilities[i][j].n !== undefined) {
					n = fullProbabilities[i][j].n;
					d = fullProbabilities[i][j].d;
				} else {
					n = fullProbabilities[i][j];
					d = 1n;
				}
				if (!fractionMode) {
					text = (Math.round(Number((100000n * n) / d) / 10) / 100).toFixed(2) + '%';
				} else {
					if (d == 1) {
						//text = n;
						text = '<math><mn>' + n + '</mn></math>';
					} else {
						text = '<math><mfrac><mi>' + n + '</mi><mn>' + d + '</mn></mfrac></math>';
					}
				}
				if (n == 0) {
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
	document.getElementById('cldraw-impossible').style.display = 'none';
	document.getElementById('cldraw-computation-running2').style.display = 'none';
	if (hideMode) {
		hideDrawnTeams();
	}
	MathJax.Hub.Queue(['Typeset', MathJax.Hub, 'cldraw-table']);
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
			if (probabilities[i - indexW][indexR].n > 0) {
				possibleMatch[i] = true;
			} else {
				possibleMatch[i] = false;
			}
		}
	}
	return possibleMatch;
}

function toggleFractionMode() {
	let button = document.getElementById('button-fraction');
	if (fractionMode) {
		fractionMode = false;
		button.classList.remove('active');
	} else {
		fractionMode = true;
		button.classList.add('active');
	}
	if (drawHistory.length == 0) {
		if (!ignoreClicks) {
			reset();
		}
	} else {
		let team = drawHistory.pop();
		if (team < potSize) {
			drawRunnerUp(team);
		} else {
			drawWinner(team - potSize, drawHistory[drawHistory.length - 1]);
		}
	}
}
