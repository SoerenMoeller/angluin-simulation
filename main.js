"use strict"

import { initSVG, dfaToGraph } from "./scripts/dfa.js"; 
import { build, reset } from "./scripts/view.js"

const MESSAGES = {
    enterValues: "Enter the table entries before executing the next step"
};

const C = {
    epsilon: "ε"
};

const settings = {
    alphabet: ["a", "b"],
    clickedEntry: {},
    entrySelected: false,
    membershipAmount: 0,
    conjecturesAmount: 0
};

const dfa = {};

document.addEventListener("DOMContentLoaded", main);
const observationTable = {
    I: [C.epsilon],
    E: [C.epsilon],
    T: {},
    incidence: {}
};

function main() {
    // find the svg to draw in
    initSVG();
    build();

    document.addEventListener("keydown", handleKeyEvent);

    const resetButton = document.getElementById("reset-button");
    const stepButton = document.getElementById("step-button");
    const counterExampleButton = document.getElementById("counterexample-button");
    const counterExampleWrapper = document.getElementById("counterexample-wrapper");
    const statusText = document.getElementById("status-text");

    counterExampleWrapper.style.visibility = "hidden";
    statusText.innerHTML = MESSAGES.enterValues;
    stepButton.disabled = true;

    resetButton.addEventListener("click", e => resetAlgorithm());
    stepButton.addEventListener("click", e => applyStep());
    counterExampleButton.addEventListener("click", e => addCounterExample());

    document.getElementById("current-alphabet").innerHTML = settings.alphabet.toString();
    observationTableToHTML();
}

function handleKeyEvent(event) {
    if (!event.code || !settings.entrySelected) return;

    switch (event.code) {
        case "Numpad0":
        case "Digit0":
            answer(0);
            break;
        case "Numpad1":
        case "Digit1":
            answer(1);
            break;
    }

    const cell = document.getElementById(`${settings.clickedEntry.row}-${settings.clickedEntry.col}`);
    cell.style["background-color"] = "transparent";
}

function observationTableToHTML() {
    updateTable();

    const table = document.getElementById("table");
    table.innerHTML = "";

    // make table head
    let tr = table.insertRow(0);
    let td = document.createElement("th");
    tr.appendChild(td);
    for (let val of observationTable.E) {
        td = document.createElement("th");
        td.appendChild(document.createTextNode(val));
        tr.appendChild(td);
    }

    // fill (known) table body
    let count = 1;
    for (let row of getIConcatSigma()) {
        tr = table.insertRow();
        td = tr.insertCell();
        td.appendChild(document.createTextNode(row));

        if (count == observationTable.I.length) {
            tr.classList.add("border");
        }

        for (let col of observationTable.E) {
            td = tr.insertCell();
            td.id = `${row}-${col}`;
            td.style.cursor = "pointer";
            td.addEventListener("click", (e) => showQuery(row, col));
            td.style.cursor = "pointer";

            let text = "";
            if (observationTable.incidence[row][col] != -1) {
                text = observationTable.incidence[row][col];
            } 

            td.appendChild(document.createTextNode(text));
        }

        count += 1;
    }
}

function updateTable() {
    for (let row of getIConcatSigma()) {
        observationTable.incidence[row] = {};
        for (let col of observationTable.E) {
            const w = concat([row, col]);

            if (w in observationTable.T) {
                observationTable.incidence[row][col] = observationTable.T[w];
            } else {
                observationTable.incidence[row][col] = -1;
            }
        }
    }
}

function concat(words) {
    words = words.filter(w => w != C.epsilon);

    let result = "";
    for (let w of words) {
        result += w;
    }

    return result != "" ? result : C.epsilon;
}

function showQuery(row, col) {
    settings.clickedEntry = {
        row: row,
        col: col
    };
    settings.entrySelected = true;

    // reset other backgrounds
    let cell;
    for (let r of getIConcatSigma()) {
        for (let c of observationTable.E) {
            cell = document.getElementById(`${r}-${c}`);
            cell.style["background-color"] = "transparent";
        }
    }
    cell = document.getElementById(`${row}-${col}`);
    cell.style["background-color"] = "yellow";

    const queryElement = document.getElementById("query-text");
    const content = concat([row, col]);
    queryElement.innerHTML = `${content} ∈ L`;
}

const merge = (a, b, predicate = (a, b) => a === b) => {
    const c = [...a]; // copy to avoid side effects
    // add all items from B to copy C if they're not already present
    b.forEach((bItem) => (c.some((cItem) => predicate(bItem, cItem)) ? null : c.push(bItem)))
    return c;
}

function getIConcatSigma() {
    const IconcatSigma = observationTable.I.map(s => concatSigma(s, settings.alphabet)).flat();
    return merge(observationTable.I, IconcatSigma)
}

function concatSigma(s, S) {
    const result = [];
    for (let val of S) {
        if (s == C.epsilon) {
            result.push(val);
        } else {
            result.push(s + val);
        }
    }
    return result;
}

function addCounterExample() {
    const counterExample = document.getElementById("counterexample-input").value;
    document.getElementById("counterexample-wrapper").style.visibility = "hidden";
    let prefixes = [];
    for (let i = 1; i <= counterExample.length; i++) {
        prefixes.push(counterExample.slice(0, i));
    }

    observationTable.I = merge(observationTable.I, prefixes);
    observationTableToHTML();
    checkClosedAndConsistent();

    // update counter
    settings.conjecturesAmount += 1;
    document.getElementById("conjecture-amount").innerHTML = settings.conjecturesAmount;
}

function answer(entry) {
    const word = concat([settings.clickedEntry.row, settings.clickedEntry.col]);
    observationTable.T[word] = entry;
    observationTableToHTML();

    if (!unknownEntryExists()) {
        checkClosedAndConsistent();
        document.getElementById("step-button").disabled = false;
    }

    // update counter
    settings.membershipAmount += 1;
    document.getElementById("membership-amount").innerHTML = settings.membershipAmount;
}

function observationTableToDfa() {
    dfa.start = getRow(C.epsilon);
    dfa.end = unique(observationTable.I.filter(e => observationTable.incidence[e][C.epsilon] == 1).map(e => getRow(e)));
    dfa.states = unique(observationTable.I.map(e => getRow(e)));

    const transitions = [];
    for (let s of observationTable.I) {
        const from = getRow(s);
        if (transitions.filter(e => e.from == from).length > 0) continue;

        for (let a of settings.alphabet) {
            const to = getRow(concat([s, a]));

            const entry = transitions.filter(e => e.from == from && e.to == to);
            if (entry.length > 0) {
                entry[0].with = entry[0].with.concat([a]);
            } else {
                transitions.push({
                    from: from,
                    to: to,
                    with: [a]
                });
            }
        }
    }
    dfa.transitions = transitions;
}

function unique(array) {
    return [...new Set(array)];
}

function checkClosedAndConsistent() {
    const statusText = document.getElementById("status-text");
    const closedResult = checkClosed();
    const consistentResult = checkConsistent();

    if (unknownEntryExists()) {
        statusText.innerHTML = MESSAGES.enterValues;
        return;
    }

    if (!closedResult.answer) {
        statusText.innerHTML = `Table is not closed, because ∄s ∈ I: row(s) = row(${closedResult.example}). Add '${closedResult.example}' and prefixes to I to fix this.`;
        return;
    }

    if (!consistentResult.answer) {
        statusText.innerHTML = `Table is not consistent, because row(${consistentResult.reasons[0]}) = row(${consistentResult.reasons[1]}) but row(${consistentResult.reasons[0]}•${consistentResult.example[0]}•${consistentResult.example[1]}) ≠ row(${consistentResult.reasons[1]}•${consistentResult.example[0]}•${consistentResult.example[1]}. Add ${consistentResult.example[0]}•${consistentResult.example[1]} and suffixes to fix)`;
        return;
    }

    statusText.innerHTML = "Check the DFA!";
    observationTableToDfa();
    dfaToGraph(dfa);
    build();
    document.getElementById("counterexample-wrapper").style.visibility = "visible";
}

function checkConsistent() {
    for (let s1 of observationTable.I) {
        for (let s2 of observationTable.I) {
            if (getRow(s1) != getRow(s2)) continue;

            for (let a of settings.alphabet) {
                for (let e of observationTable.E) {
                    const concat1 = concat([s1, a]);
                    const concat2 = concat([s2, a]);
 
                    if (observationTable.incidence[concat1][e] != observationTable.incidence[concat2][e]) {
                        return {
                            answer: false,
                            example: [a, e],
                            reasons: [s1, s2]
                        };
                    }
                }
            }
        }
    }

    return {
        answer: true
    };
}

function checkClosed() {
    const states = observationTable.I.map(e => getRow(e));

    for (let s of getIConcatSigma()) {
        if (!states.includes(getRow(s))) {
            return {
                answer: false,
                example: s
            };
        }
    }

    return {
        answer: true
    };
}

function unknownEntryExists() {
    for (let row of getIConcatSigma()) {
        for (let col of observationTable.E) {
            if (observationTable.incidence[row][col] == -1) {
                return true;
            }
        }
    }
    return false;
}

function getRow(elem) {
    const row = observationTable.incidence[elem];
    let result = "";

    for (let key in row) {
        result += row[key].toString();
    }

    return result;
}

function applyStep() {
    if (unknownEntryExists()) return;

    const closedResult = checkClosed();
    const consistentResult = checkConsistent();
    if (!closedResult.answer) {
        let prefixes = [];
        for (let i = 1; i <= closedResult.example.length; i++) {
            prefixes.push(closedResult.example.slice(0, i));
        }

        observationTable.I = merge(observationTable.I, prefixes);
        observationTableToHTML();
    } else if (!consistentResult.answer) {
        let e = consistentResult.example[0] + consistentResult.example[1];
        if (consistentResult.example[1] == C.epsilon) {
            e = consistentResult.example[0];
        }
        let suffixes = [];
        for (let i = 0; i < e.length; i++) {
            suffixes.push(e.slice(i, e.length));
        }

        observationTable.E = merge(observationTable.E, suffixes);
        observationTableToHTML();
    }

    checkClosedAndConsistent();
    if (unknownEntryExists()) {
        document.getElementById("step-button").disabled = true;
    }
}

function resetAlgorithm() {
    observationTable.I = [C.epsilon];
    observationTable.E = [C.epsilon];
    observationTable.T = {};
    settings.entrySelected = false;
    settings.membershipAmount = 0;
    settings.conjecturesAmount = 0;
    reset();
    observationTableToHTML();
    checkClosedAndConsistent();
    document.getElementById("query-text").innerHTML = "";
}