'use strict';

let fractionMode = true;
document.getElementById('button-fraction').classList.add('active');

function adjustSizes(competition, season) {
	let short = config.evaluate('//competition[@id = "' + competition + '"]/short', config, null, XPathResult.STRING_TYPE, null).stringValue;
	let roundOf = attrW.length * 2;
	document.title = short + ' R' + roundOf + ' Draw Probabilities';
	let heading = document.getElementsByTagName('h1')[0];
	heading.innerHTML = short + ' Draw Probabilities <small class="text-muted">(' + season + ' Round of ' + roundOf + ')</small>';
	document.getElementById('cldraw-table').classList.add('table-sm');
	document.getElementById('cldraw-table').parentNode.classList.remove('col-lg-9', 'order-lg-first');
	document.getElementById('cldraw-fixtures-card').classList.remove('col-lg-3');
	document.getElementById('cldraw-fixtures-row').classList.remove('row-cols-lg-1');
	document.getElementById('cldraw-fixtures-row').classList.add('row-cols-lg-4');
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
			let cell;
			if (!swap) {
				cell = table.rows[i + 1].cells[j + 1];
			} else {
				cell = table.rows[j + 1].cells[i + 1];
			}
			cell.classList.remove('table-primary', 'table-secondary', 'table-warning');
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
				if (heatMode) {
					let intensity = Math.round(256 * (1 - Number(10000n * n / d) / 10000)).toString(16);
					if (intensity.length == 1) {
						intensity = '0' + intensity;
					}
					cell.style.background = '#ff' + intensity + intensity;
				} else {
					if (n == 0) {
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
