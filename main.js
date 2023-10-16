"use strict"

const MESSAGES = {
    enterValues: "Enter the table entries, before executing the next step"
};

const C = {
    epsilon: "ε"
};

const settings = {
    alphabet: ["a", "b"],
    clickedEntry: {}
};

const dfa = {};

document.addEventListener("DOMContentLoaded", main);
const observationTable = {
    I: [C.epsilon],
    E: [C.epsilon],
    incidence: {}
};

function observationTableToHTML() {
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

            let text = "";
            if (observationTable.incidence[row] && col in observationTable.incidence[row]) {
                text = observationTable.incidence[row][col];
            } else {
                td.addEventListener("click", (e) => showOverlay(row, col));
                td.style.cursor = "pointer";
            }

            td.appendChild(document.createTextNode(text));
        }

        count += 1;
    }
}

function showOverlay(row, col) {
    settings.clickedEntry = {
        row: row,
        col: col
    };

    document.getElementById("overlay").style.display = "flex";
    const queryElement = document.getElementById("query-text");

    let content;
    if (row == C.epsilon) {
        content = col;
    } else if (col == C.epsilon) {
        content = row;
    } else {
        content = `${row}${col}`;
    }

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

function main() {
    // find the svg to draw in
    initSVG();
    build();

    const changeButton = document.getElementById("alphabet-change-button");
    const resetButton = document.getElementById("reset-button");
    const stepButton = document.getElementById("step-button");
    const answerButton = document.getElementById("answer-button");
    const counterExampleButton = document.getElementById("counterexample-button");
    const overlay = document.getElementById("overlay");
    const counterExampleWrapper = document.getElementById("counterexample-wrapper");
    const statusText = document.getElementById("status-text");

    counterExampleWrapper.style.visibility = "hidden";
    statusText.innerHTML = MESSAGES.enterValues;
    stepButton.disabled = true;

    changeButton.addEventListener("click", e => changeAlphabet());
    resetButton.addEventListener("click", e => resetAlgorithm());
    stepButton.addEventListener("click", e => applyStep());
    answerButton.addEventListener("click", e => answer());
    overlay.addEventListener("click", overlayClose);
    counterExampleButton.addEventListener("click", e => addCounterExample());

    document.getElementById("current-alphabet").innerHTML = settings.alphabet.toString();
    observationTableToHTML();
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
}

function overlayClose(event) {
    if (!event.target.id || event.target.id !== "overlay") return;

    document.getElementById("overlay").style.display = "none";
}

function answer() {
    const answer = document.getElementById("answer-box");
    if (observationTable.incidence[settings.clickedEntry.row]) {
        observationTable.incidence[settings.clickedEntry.row][settings.clickedEntry.col] = answer.checked ? 1 : 0
    } else {
        observationTable.incidence[settings.clickedEntry.row] = {[settings.clickedEntry.col]: answer.checked ? 1 : 0};
    }

    document.getElementById("overlay").style.display = "none";
    observationTableToHTML();


    if (!unknownEntryExists()) {
        checkClosedAndConsistent();
        document.getElementById("step-button").disabled = false;
    }
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
            let to;
            if (s == C.epsilon) {
                to = getRow(a);
            } else {
                to = getRow(s + a);
            }

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
    dfaToGraph();
    build();
    document.getElementById("counterexample-wrapper").style.visibility = "visible";
}

function checkConsistent() {
    for (let s1 of observationTable.I) {
        for (let s2 of observationTable.I) {
            if (getRow(s1) != getRow(s2)) continue;

            for (let a of settings.alphabet) {
                for (let e of observationTable.E) {
                    let concat1 = `${s1}${a}`;
                    let concat2 = `${s2}${a}`;
                    if (s1 == C.epsilon) {
                        concat1 = a;
                    }
                    if (s2 == C.epsilon) {
                        concat2 = a;
                    }
                    if (observationTable.incidence[concat1] && observationTable.incidence[concat2] &&
                        observationTable.incidence[concat1][e] != observationTable.incidence[concat2][e]) {
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
            if (!(observationTable.incidence[row] && col in observationTable.incidence[row])) {
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

    return Number(result);
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
    observationTableToHTML();
}

function changeAlphabet() {
    // TODO: sanity checks
    const alphabetInput = document.getElementById("alphabet-input");
    const currentAlphabet = document.getElementById("current-alphabet");

    currentAlphabet.innerHTML = alphabetInput.value;
    settings.alphabet = alphabetInput.value.split(",").map((x) => x.trim());
}

function dfaToGraph() {
    graph = {}
    let x = 20
    let y = 20
    for (let state of dfa.states) {
        // add identifier and coordinates
        graph[state] = {
            desc: [state.toString()],
            coords: {x: x, y: y}
        }

        // determine attributes
        let attributes = [];
        if (state == dfa.start) {
            attributes.push("start");
            graph[state].startAngle = 270;
        }
        if (dfa.end.includes(state)) {
            attributes.push("end");
        }
        graph[state].attributes = attributes;

        // add edges
        let edges = [];
        for (let val of dfa.transitions) {
            if (val.from != state) {
                continue;
            }
            let entry = {
                desc: [val.with.toString()],
                node: val.to,
                offset: 0,
                textOffset: -5
            };

            // add angle for loop
            if (val.to == state) {
                entry.angle = 0;
            }

            edges.push(entry);
        }
        graph[state].to = edges;


        // update position for next node
        x += 40;
        if (x > 180) {
            x = 20;
            y += 40;
        }
    }
}

// The following is to be able to move the DFA around

let graph = {};
let svg;

// constants
const CONSTANTS = {
    path: "path",
    circle: "circle",
    text: "text",
    node: "node",
    polygon: "polygon",
    defs: "defs",
    style: "style",
    start: "start",
    end: "end",
    marker: "marker",
    defaultMarker: "defaultMarker",
    defaultPath: "defaultPath",
    arrow: "arrow",
    selfarrow: "selfarrow",
    arrowSelected: "arrowSelected",
    selfarrowSelected: "selfarrowSelected",
    draggable: "draggable",
    g: "g",
    tspan: "tspan",
    sub: "sub",
    super: "super",
    none: "none",
    white: "white",
    transparent: "transparent",
    markerEnd: "marker-end",
    id: "id",
    class: "class",
    stroke: "stroke",
    middle: "middle",
    central: "central",
    select: "select",
    option: "option"
}

const THRESHOLDS = {
    straightEdge: 2,
    angle: 15,
    text: 1
};

const COLOR = {
    black: "black",
    grid: "rgba(224, 128, 31, 0.3)",
    transparent: "transparent",
    green: "green",
    red: "red",
    white: "#EEEEEE"
};

const DISTANCE = {
    selfEdgeText: 13,
    selfEdgeHeight: 10,
    selfEdgeWidth: 6,
    startEdge: 15,
    markerOffset: 60,
    markerSelfOffsetHeight: -1,
    markerSelfOffset: 20
};

const SIZE = {
    text: 8,
    subText: 1.5,
    nodeRadius: 14,
    grid: 4,
    path: 0.3,
    pathHidden: 5,
    circle: 0.3
};

const KEYS = {
    control: false,
    shift: false
};

const ACTION = {
    selectedDragElement: null,
    selectedElement: null,
    showGrid: false,
};

function initSVG() {
    svg = document.getElementsByTagName("svg")[0];
    svg.addEventListener("load", makeDraggable);
}

// =============== build operations =============== //
function selectNodeById(nodeId) {
    const nodeElem = getNodeElemById(nodeId);

    selectNode(nodeElem);
}

function build() {
    reset();

    // render the lines first
    for (let node in graph) {
        buildEdges(parseInt(node));
    }

    // now render the nodes
    for (let node in graph) {
        buildNode(parseInt(node));
    }

    reselect();
}

function getNodeElemById(nodeId) {
    const selector = `${CONSTANTS.node}_${nodeId}`;
    const nodeElem = document.getElementById(selector);

    console.assert(nodeElem, "Couldn't find node");

    return nodeElem;
}

function buildNode(id) {
    const container = createContainer(svg, `${CONSTANTS.node}_${id}`);
    const node = getNode(id);

    // create starting arrow
    if (isNodeStart(id)) {
        const startAngle = getVectorFromAngle(node.startAngle);
        const length = SIZE.nodeRadius + DISTANCE.startEdge;
        const dValue = `M${node.coords.x + startAngle.x * length} ${node.coords.y + startAngle.y * length} L${node.coords.x} ${node.coords.y}`;

        // make a thick invis line, to be able to click it nicely
        const startContainer = createContainer(container, `${CONSTANTS.start}_${id}`);
        createPath(startContainer, "", dValue, SIZE.pathHidden, "", COLOR.transparent, true);
        createPath(startContainer, "", dValue, SIZE.path, CONSTANTS.arrow, COLOR.white, true);
    }

    // create the circle
    createCircle(container, node.coords, SIZE.nodeRadius);

    if (isNodeEnd(id)) {
        createCircle(container, node.coords, SIZE.nodeRadius - 1);
    }

    // create the text
    createTextNode(container, node.coords, node.desc, true);
}

function isNodeEnd(nodeId) {
    return getNode(nodeId).attributes.includes(CONSTANTS.end);
}

function isNodeStart(nodeId) {
    return getNode(nodeId).attributes.includes(CONSTANTS.start);
}

function buildEdges(id) {
    let node = getNode(id);
    let coords = node.coords;

    for (let otherNode in node.to) {
        let nodeId = node.to[otherNode].node;
        let otherCoords = getNode(nodeId).coords;

        const pathContainer = createContainer(svg, `${CONSTANTS.path}_${id}-${nodeId}`);
        const markerEnd = id !== nodeId ? CONSTANTS.arrow : CONSTANTS.selfarrow;

        const edge = getEdge(id, nodeId);

        // self-edge
        if (id === nodeId) {
            const dValue = `M${coords.x} ${coords.y - SIZE.nodeRadius + 1} A${DISTANCE.selfEdgeWidth} ${DISTANCE.selfEdgeHeight} 0 1 1 ${coords.x + 0.01} ${coords.y - SIZE.nodeRadius + 1}`;
            const outerPath = createPath(pathContainer, "", dValue, SIZE.pathHidden, "", COLOR.transparent, true);
            const innerPath = createPath(pathContainer, "", dValue, SIZE.path, markerEnd, COLOR.white, true);
            outerPath.setAttributeNS(null, "transform", `rotate(${edge.angle}, ${node.coords.x}, ${node.coords.y})`);
            innerPath.setAttributeNS(null, "transform", `rotate(${edge.angle}, ${node.coords.x}, ${node.coords.y})`);

            const angleVector = getVectorFromAngle(edge.angle);
            const textCoords = {
                x: node.coords.x + angleVector.x * (DISTANCE.selfEdgeText - edge.textOffset),
                y: node.coords.y + angleVector.y * (DISTANCE.selfEdgeText - edge.textOffset)
            }
            createTextNode(pathContainer, textCoords, edge.desc, true);
        } else {
            const middle = getMiddleOfVector(coords, otherCoords);
            const normalVector = getNormalVector(coords, otherCoords);
            const dist = node.to[otherNode].offset;
            const dValue = `M${coords.x} ${coords.y} Q${middle.x + normalVector.x * 2 * dist} ${middle.y + normalVector.y * 2 * dist} ${otherCoords.x} ${otherCoords.y}`;
            createPath(pathContainer, "", dValue, SIZE.pathHidden, "", COLOR.transparent, true);
            createPath(pathContainer, "", dValue, SIZE.path, markerEnd, COLOR.white, true);

            const offset = edge.textOffset;
            const textCoords = {
                x: middle.x + normalVector.x * (dist + offset),
                y: middle.y + normalVector.y * (dist + offset)
            }
            createTextNode(pathContainer, textCoords, node.to[otherNode].desc, true);
        }
    }
}

function getPathElemByIds(fromId, toId) {
    const selector = `${CONSTANTS.path}_${fromId}-${toId}`;
    const nodeElem = document.getElementById(selector);

    console.assert(nodeElem, "Couldn't find path");

    return nodeElem;
}

function getEdgeDescription(fromId, toId) {
    const edge = getEdge(fromId, toId);

    return edge.desc;
}

function reselect() {
    // this is needed because currently, everything gets redrawn
    if (!ACTION.selectedElement) return;

    switch (getIdPrefix(ACTION.selectedElement)) {
        case CONSTANTS.node:
            const nodeId = getIdOfNode(ACTION.selectedElement);
            ACTION.selectedElement = getNodeElemById(nodeId);
            setNodeColor(nodeId, COLOR.marked);
            break;
        case CONSTANTS.path:
            const ids = getIdsOfPath(ACTION.selectedElement);
            ACTION.selectedElement = getPathElemByIds(ids.from, ids.to);
            setPathColor(ids.from, ids.to, COLOR.marked);
            break;
        default:
            console.error("Trying to reconstruct unknown element");
    }
}

function reset() {
    svg.innerHTML = "";

    // make the arrowheads
    const defs = createDefs(svg);
    const selfPolygon = "0 13, 11 0, 10 16";
    const polygon = "0 0, 16 5, 0 10";
    createMarker(defs, CONSTANTS.arrow, 16, 10, DISTANCE.markerOffset, 5, COLOR.white, polygon);
    createMarker(defs, CONSTANTS.arrowSelected, 16, 10, DISTANCE.markerOffset, 5, COLOR.marked, polygon);
    createMarker(defs, CONSTANTS.selfarrow, 16, 16, DISTANCE.markerSelfOffset, DISTANCE.markerSelfOffsetHeight, COLOR.white, selfPolygon);
    createMarker(defs, CONSTANTS.selfarrowSelected, 16, 16, DISTANCE.markerSelfOffset, DISTANCE.markerSelfOffsetHeight, COLOR.marked, selfPolygon);
    createMarker(defs, CONSTANTS.defaultMarker, 16, 10, 16, 5, COLOR.marked, polygon);

    // style
    const style = `text, text > tspan {font: italic ${SIZE.text}px sans-serif; user-select: none; color: white;} text > tspan > tspan {font: italic ${SIZE.subText}px sans-serif; user-select: none;color: white;}`;
    createStyle(svg, style);

    // add default path for later usage
    createPath(svg, CONSTANTS.defaultPath, "", SIZE.path, CONSTANTS.defaultMarker, COLOR.marked);

    // make a grid for visible layout
    initGrid()
}

function initGrid() {
    const container = createContainer(svg, "grid-container");
    const color = ACTION.showGrid ? COLOR.grid : COLOR.transparent;

    for (let i = 0; i <= 100; i += SIZE.grid) {
        const dValueRow = `M0 ${i} L100 ${i}`;
        createPath(container, "", dValueRow, 0.1, "", color);

        const dValueCol = `M${i} 0 L${i} 100`;
        createPath(container, "", dValueCol, 0.1, "", color);
    }
}


// =============== html build helpers =============== //
function createTextNode(parent, position, text, draggable) {
    const parsedText = text;

    let configuration = {
        x: position.x,
        y: position.y,
        text_anchor: "middle",
        alignment_baseline: "central",
        dominant_baseline: "middle",
        fill: COLOR.white
    };
    if (draggable) {
        configuration.class = CONSTANTS.draggable;
    }

    // check starting position of the text
    const lines = parsedText.length;
    const distance = SIZE.text + SIZE.subText - 1;
    let offset = position.y - Math.floor(lines / 2) * distance;
    if (lines % 2 === 0) {
        offset += distance / 2;
    }

    const textNode = createSVGElement(CONSTANTS.text, configuration);
    for (let parsedLine of parsedText) {

        const textLine = createSVGElement(CONSTANTS.tspan, {});
        offset += distance;
        textLine.textContent = parsedLine;

        textNode.appendChild(textLine);
    }

    parent.appendChild(textNode);
    return textNode;
}

function createContainer(parent, id) {
    const container = createSVGElement(CONSTANTS.g, {
        id: id
    });

    parent.appendChild(container);
    return container;
}

function createCircle(parent, coords, radius) {
    const circle = createSVGElement(CONSTANTS.circle, {
        class: CONSTANTS.draggable,
        cx: coords.x,
        cy: coords.y,
        r: radius,
        stroke: COLOR.white,
        stroke_width: SIZE.circle,
        fill: "#212121"
    });

    parent.appendChild(circle);
    return circle;
}

function createDefs(parent) {
    const defs = createSVGElement(CONSTANTS.defs);

    parent.appendChild(defs);

    return defs;
}

function createMarker(parent, id, width, height, refX, refY, color, polygonPoints) {
    const marker = createSVGElement(CONSTANTS.marker, {
        id: id,
        markerWidth: width,
        markerHeight: height,
        refX: refX,
        refY: refY,
        fill: color,
        orient: "auto"
    });

    const polygon = createSVGElement(CONSTANTS.polygon, {
        points: polygonPoints
    });

    marker.appendChild(polygon);
    parent.appendChild(marker);
}

function createPath(parent, id, dValue, stroke_width, marker, color, draggable = false) {
    const path = createSVGElement(CONSTANTS.path, {
        d: dValue,
        stroke: color,
        stroke_width: stroke_width,
        fill: CONSTANTS.none
    });

    if (marker !== "") {
        path.setAttributeNS(null, CONSTANTS.markerEnd, `url(#${marker})`);
    }

    if (id !== "") {
        path.setAttributeNS(null, CONSTANTS.id, id);
    }

    if (draggable) {
        path.setAttributeNS(null, CONSTANTS.class, CONSTANTS.draggable);
    }

    parent.appendChild(path);
    return path;
}

function createStyle(parent, styling) {
    const style = createSVGElement(CONSTANTS.style)

    style.textContent = styling;
    parent.appendChild(style);

    return style;
}

function createSVGElement(n, v = {}) {
    n = document.createElementNS("http://www.w3.org/2000/svg", n);
    for (var p in v) {
        n.setAttributeNS(null, p.replace("_", "-"), v[p]);
    }
    return n
}

function setPathAngle(elem, angle, coords) {
    elem.setAttributeNS(null, "transform", `rotate(${angle}, ${coords.x}, ${coords.y})`);
}


// =============== vector operations =============== //
function getLength(vector) {
    return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
}

function getDistance(vectorA, vectorB) {
    return Math.sqrt(Math.pow(vectorB.x - vectorA.x, 2) + Math.pow(vectorB.y - vectorA.y, 2));
}

function getDotProduct(vectorA, vectorB) {
    return vectorA.x * vectorB.y - vectorB.x * vectorA.y;
}

function getNormalVector(vectorA, vectorB) {
    const normal = {
        x: -(vectorB.y - vectorA.y),
        y: vectorB.x - vectorA.x
    };
    return getUnitVector(normal);
}

function getUnitVector(vector) {
    const length = getLength(vector);
    return {
        x: vector.x / length,
        y: vector.y / length,
    }
}

function getMiddleOfVector(vectorA, vectorB) {
    return {
        x: (vectorA.x + vectorB.x) / 2,
        y: (vectorA.y + vectorB.y) / 2
    }
}

function getVectorAngle(vectorA, vectorB) {
    const dot = getDotProduct(vectorA, vectorB);
    const lengthA = getLength(vectorA);
    const lengthB = getLength(vectorB);

    return Math.acos(dot / (lengthA * lengthB));
}

function getAngle360Degree(baseVector, position) {
    const vector = { x: position.x - baseVector.x, y: position.y - baseVector.y };
    const angle = getVectorAngle(vector, { x: 1, y: 0 });
    let angleDegree = angle * (180 / Math.PI);
    const dot = getDotProduct(vector, { x: 0, y: 1 });

    // correct the left side of the circle
    if (dot < 0) {
        angleDegree = (360 - angleDegree);
    }

    return angleDegree;
}

function getVectorFromAngle(angle) {
    const angleBase = { x: 0, y: -1 };

    const radiantAngle = (360 - angle) * (Math.PI / 180);
    const vector = {
        x: angleBase.x * Math.cos(radiantAngle) + angleBase.y * Math.sin(radiantAngle),
        y: angleBase.y * Math.cos(radiantAngle) - angleBase.x * Math.sin(radiantAngle)
    }

    return getUnitVector(vector);
}

function getDirectionVector(vectorA, vectorB) {
    return {
        x: vectorB.x - vectorA.x,
        y: vectorB.y - vectorA.y
    };
}

function getDistanceToLine(point, direction, pointOnLine) {
    const dot = getDotProduct({ x: point.x - pointOnLine.x, y: point.y - pointOnLine.y }, direction);
    const length = getLength(direction);

    return -dot / length;
}

function snap(val, step) {
    if (!ACTION.showGrid) return val;

    return Math.round(val / step) * step;
}

// =============== dragging logic operations =============== //
function makeDraggable(evt) {
    var svg = evt.target;
    svg.addEventListener('mousedown', mouseDown);
    svg.addEventListener('mousedown', startDrag);
    svg.addEventListener('mousemove', drag);
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);
}

function drag(evt) {
    if (!ACTION.selectedDragElement) return;

    evt.preventDefault();
    const mouse = getMousePosition(evt);
    let prefix = getIdPrefix(ACTION.selectedDragElement);

    // if a text is selected, we want to change the offset
    if (ACTION.selectedDragElement.tagName === CONSTANTS.text) {
        prefix = CONSTANTS.text;
    }

    switch (prefix) {
        case CONSTANTS.node:
            dragNode(mouse);
            break;
        case CONSTANTS.start:
            dragStartEdge(mouse);
            break;
        case CONSTANTS.path:
            const ids = getIdsOfPath(ACTION.selectedDragElement);
            if (ids.from === ids.to) {
                dragSelfEdge(mouse);
            } else {
                dragEdge(mouse);
            }
            break;
        case CONSTANTS.text:
            dragText(mouse);
            break;
        default:
            console.error("unknown dragging type");
    }
}

function startDrag(evt) {
    let elem = evt.target;

    while (elem.tagName === CONSTANTS.tspan) {
        elem = elem.parentNode;
    }

    if (elem.classList.contains(CONSTANTS.draggable)) {
        let parent = elem.parentNode;

        if (elem.tagName === CONSTANTS.text && getIdPrefix(parent) === CONSTANTS.path) {
            ACTION.selectedDragElement = elem;
        } else if (parent && parent.tagName === CONSTANTS.g) {
            ACTION.selectedDragElement = parent;
        } else {
            console.error("Wrong element clickable");
        }
    }
}

function dragText(mouse) {
    // get the id of the node
    const ids = getIdsOfPath(ACTION.selectedDragElement.parentNode);
    const edge = getEdge(ids.from, ids.to);
    const startNode = getNode(ids.from);
    const endNode = getNode(ids.to);

    let update;

    // handle self edge text
    if (ids.from === ids.to) {
        const angleVector = getVectorFromAngle(edge.angle);
        const basePosition = { x: startNode.coords.x + angleVector.x * DISTANCE.selfEdgeText, y: startNode.coords.y + angleVector.y * DISTANCE.selfEdgeText };
        const normalAngle = getNormalVector(startNode.coords, basePosition);

        let dist = getDistanceToLine(mouse, normalAngle, basePosition);
        dist = snap(dist, THRESHOLDS.text);
        edge.textOffset = dist;

        update = {
            x: startNode.coords.x + angleVector.x * (DISTANCE.selfEdgeText - dist),
            y: startNode.coords.y + angleVector.y * (DISTANCE.selfEdgeText - dist)
        };
    } else {
        // handle normal edge
        const middle = getMiddleOfVector(startNode.coords, endNode.coords);
        const normalVector = getNormalVector(startNode.coords, endNode.coords);
        const directionVector = getDirectionVector(startNode.coords, endNode.coords);
        let dist = getDistanceToLine(mouse, directionVector, startNode.coords) - edge.offset;
        dist = snap(dist, THRESHOLDS.text);
        edge.textOffset = dist;

        update = {
            x: middle.x + normalVector.x * (dist + edge.offset),
            y: middle.y + normalVector.y * (dist + edge.offset)
        };
    }

    updateAttributes(ACTION.selectedDragElement, update);
    correctSubTexts(edge.desc, update, ACTION.selectedDragElement);
}

function dragSelfEdge(coord) {
    const ids = getIdsOfPath(ACTION.selectedDragElement);
    const nodeId = ids.from;
    const node = getNode(nodeId);

    let angle = getAngle360Degree(node.coords, coord);
    if (ACTION.showGrid) {
        angle = snap(angle, THRESHOLDS.angle);
    }
    setEdgeAngle(nodeId, angle);

    for (let child of ACTION.selectedDragElement.childNodes) {
        switch (child.tagName) {
            case CONSTANTS.path:
                setPathAngle(child, angle, node.coords);
                break;
            case CONSTANTS.text:
                correctSelfEdgeText(child, nodeId);
                break;
            default:
                console.error("Unhandled tag found");
        }
    }
}

function dragEdge(mouse) {
    // get the id of the node
    const ids = getIdsOfPath(ACTION.selectedDragElement);

    // get the coords of the nodes
    const startNode = getNode(ids.from);
    const endNode = getNode(ids.to);
    const middle = getMiddleOfVector(startNode.coords, endNode.coords);
    const normalVector = getNormalVector(startNode.coords, endNode.coords);

    // determine distance to mouse
    const directionVector = getDirectionVector(startNode.coords, endNode.coords);
    let dist = getDistanceToLine(mouse, directionVector, startNode.coords);

    if (2 * dist < THRESHOLDS.straightEdge && 2 * dist > -THRESHOLDS.straightEdge) {
        dist = 0;
    }
    dist = snap(dist, SIZE.grid);

    // update the offset in the data
    const edge = getEdge(ids.from, ids.to);
    edge.offset = dist;
    const textOffset = edge.textOffset;

    const dValue = `M${startNode.coords.x} ${startNode.coords.y} Q${middle.x + normalVector.x * 2 * dist} ${middle.y + normalVector.y * 2 * dist} ${endNode.coords.x} ${endNode.coords.y}`;
    const update = {
        x: middle.x + normalVector.x * (dist + textOffset),
        y: middle.y + normalVector.y * (dist + textOffset)
    };
    for (let child of ACTION.selectedDragElement.childNodes) {
        switch (child.tagName) {
            case CONSTANTS.path:
                updateAttributes(child, { d: dValue });
                break;
            case CONSTANTS.text:
                updateAttributes(child, update);
                updateAttributes(child.firstChild, update);
                break;
            default:
                console.error("Unknown element found");
        }
    }
}

function dragStartEdge(mouse) {
    const id = getIdOfNode(ACTION.selectedDragElement);
    const coords = getCoords(id);

    let angle = getAngle360Degree(coords, mouse);
    angle = snap(angle, THRESHOLDS.angle);

    setStartAngle(angle);

    // adapt the line
    const startAngle = getVectorFromAngle(angle);
    const length = SIZE.nodeRadius + DISTANCE.startEdge;
    const dValue = `M${coords.x + startAngle.x * length} ${coords.y + startAngle.y * length} L${coords.x} ${coords.y}`;

    updateAttributes(ACTION.selectedDragElement.childNodes[0], { d: dValue });
    updateAttributes(ACTION.selectedDragElement.childNodes[1], { d: dValue });
}

function getNodeDescription(nodeId) {
    const node = getNode(nodeId);

    return node.desc;
}

function dragNode(mouse) {
    const id = getIdOfNode(ACTION.selectedDragElement);
    const coords = getCoords(id);

    mouse.x = snap(mouse.x, SIZE.grid);
    mouse.y = snap(mouse.y, SIZE.grid);

    // prevent overlapping nodes and going over the edge
    let distance = Number.MAX_VALUE;
    for (let nodeId in graph) {
        if (nodeId == id) continue;

        const tmpDistance = getDistance(mouse, getCoords(nodeId));
        distance = Math.min(distance, tmpDistance);
    }

    if (mouse.x > 200 - SIZE.nodeRadius || mouse.x < SIZE.nodeRadius || distance < 2 * SIZE.nodeRadius) {
        mouse.x = coords.x;
    }
    if (mouse.y > 120 - SIZE.nodeRadius || mouse.y < SIZE.nodeRadius || distance < 2 * SIZE.nodeRadius) {
        mouse.y = coords.y;
    }

    // move the text and the circle
    for (let child of ACTION.selectedDragElement.childNodes) {
        switch (child.tagName) {
            case CONSTANTS.circle:
                updateAttributes(child, { cx: mouse.x, cy: mouse.y });
                break;
            case CONSTANTS.text:
                updateAttributes(child, { x: mouse.x, y: mouse.y });
                correctSubTexts(getNodeDescription(id), mouse, child);
                break;
            case CONSTANTS.g:
                // handled later
                break;
            default:
                console.error("Unknown element found: ", child);
        }
    }

    // change the path of start
    if (isNodeStart(id)) {
        const pathContainer = getStartEdge(id);

        const startAngle = getVectorFromAngle(getStartAngle(id));
        const length = SIZE.nodeRadius + DISTANCE.startEdge;
        const dValue = `M${coords.x + startAngle.x * length} ${coords.y + startAngle.y * length} L${coords.x} ${coords.y}`;

        updateAttributes(pathContainer.childNodes[0], { d: dValue });
        updateAttributes(pathContainer.childNodes[1], { d: dValue });
    }

    // update the model
    setCoords(id, mouse);

    // remove the self edge
    const edges = getEdgesInvolvingNode(id);
    if (hasSelfEdge(id)) {
        // remove from list
        const index = edges.to.indexOf(id);
        edges.to.splice(index, 1);

        const dValue = `M${coords.x} ${coords.y - SIZE.nodeRadius + 1} A${DISTANCE.selfEdgeWidth} ${DISTANCE.selfEdgeHeight} 0 1 1 ${coords.x + 0.01} ${coords.y - SIZE.nodeRadius + 1}`;
        const selfPath = getEdge(id, id);

        // get the svg path
        const path = getPathElemByIds(id, id);

        // correct the self edge
        const update = {
            d: dValue,
            transform: `rotate(${selfPath.angle}, ${coords.x}, ${coords.y})`
        };
        for (let child of path.childNodes) {
            switch (child.tagName) {
                case CONSTANTS.path:
                    updateAttributes(child, update);
                    break;
                case CONSTANTS.text:
                    correctSelfEdgeText(child, id);
                    break;
                default:
                    console.error("Unhandeled tag found");
            }
        }
    }

    // correct the paths
    correctEdges(edges.to, id, true);
    correctEdges(edges.from, id, false);
}

function endDrag(evt) {
    ACTION.selectedDragElement = null;
}

function mouseDown(evt) {
    let elem = evt.target;

    while (elem.tagName === CONSTANTS.tspan) {
        elem = elem.parentNode;
    }

    const prefix = getIdPrefix(elem.parentNode);

    // cancel selection if the background is clicked
    if (elem === svg) {
        unselectAll();
        return;
    }

    if (elem.classList.contains(CONSTANTS.draggable)) {
        switch (prefix) {
            case CONSTANTS.node:
                selectNode(elem.parentNode);
                break;
            case CONSTANTS.path:
                selectEdge(elem.parentNode);
                break;
            case CONSTANTS.start:
                // select the node the starting arrow is attached to
                selectNode(elem.parentNode.parentNode);
                break;
            default:
                console.error("Unknown type selected");
        }
    }
}

function setCoords(nodeId, coords) {
    getNode(nodeId).coords = coords;
}

function getEdgesInvolvingNode(id) {
    const edgesTo = Object.keys(graph).filter(nodeId => getEdge(nodeId, id)).map(e => parseInt(e));
    const edgesFrom = getNode(id).to.map(e => e.node).filter(e => e !== id);

    return {
        to: edgesTo,
        from: edgesFrom
    };
}

function hasSelfEdge(nodeId) {
    return getEdgesInvolvingNode(nodeId).to.includes(nodeId);
}

function correctEdges(pathList, id, to) {
    for (let nodeId of pathList) {
        const fromId = to ? nodeId : id;
        const toId = to ? id : nodeId;

        // get the svg path
        const path = getPathElemByIds(fromId, toId);

        // redraw the path
        const startCoords = getCoords(fromId);
        const endCoords = getCoords(toId);

        const middle = getMiddleOfVector(startCoords, endCoords);
        const normalVector = getNormalVector(startCoords, endCoords);
        const otherNode = getEdge(fromId, toId);
        const dist = otherNode.offset;

        const dValue = `M${startCoords.x} ${startCoords.y} Q${middle.x + normalVector.x * 2 * dist} ${middle.y + normalVector.y * 2 * dist} ${endCoords.x} ${endCoords.y}`;
        const textOffset = otherNode.textOffset;

        const update = {
            x: middle.x + normalVector.x * (dist + textOffset),
            y: middle.y + normalVector.y * (dist + textOffset)
        };

        for (const child of path.childNodes) {
            switch (child.tagName) {
                case CONSTANTS.path:
                    updateAttributes(child, { d: dValue });
                    break;
                case CONSTANTS.text:
                    updateAttributes(child, update);
                    correctSubTexts(getEdgeDescription(fromId, toId), update, child);
                    break;
                default:
                    console.error("Unknown element found");
            }
        }
    }
}

function correctSelfEdgeText(elem, id) {
    const edge = getEdge(id, id);
    const coords = getCoords(id);
    const angleVector = getVectorFromAngle(edge.angle);
    const dist = edge.textOffset;

    const update = {
        x: coords.x + angleVector.x * (DISTANCE.selfEdgeText - dist),
        y: coords.y + angleVector.y * (DISTANCE.selfEdgeText - dist)
    };
    updateAttributes(elem, update);
    correctSubTexts(getEdgeDescription(id, id), update, elem);
}

function selectNode(elem) {
    unselectAll();

    // select the node
    ACTION.selectedElement = elem;

    // mark selected node
    const nodeId = getIdOfNode(elem);
    setNodeColor(nodeId, COLOR.marked);
}

function selectEdge(elem) {
    unselectAll();

    // select the node
    ACTION.selectedElement = elem;

    // mark selected node
    const ids = getIdsOfPath(elem);
    setPathColor(ids.from, ids.to, COLOR.marked);
}

// =============== view helpers =============== //
function updateAttributes(element, attributes) {
    for (let attr in attributes) {
        element.setAttributeNS(null, attr, attributes[attr]);
    }
}

function correctSubTexts(desc, coords, textNode) {
    const parsedText = desc;

    const lines = parsedText.length;
    const distance = SIZE.text + 0.5;
    let offset = coords.y - Math.floor(lines / 2) * distance;
    if (lines % 2 === 0) {
        offset += distance / 2;
    }

    for (let child of textNode.childNodes) {
        updateAttributes(child, { x: coords.x, y: offset });
        offset += distance;
    }
}

function getIdPrefix(elem) {
    return elem.id.split("_")[0];
}

function getIdsOfPath(path) {
    const ids = path.id.split("_")[1].split("-");
    return { from: parseInt(ids[0]), to: parseInt(ids[1]) };
}

function unselectAll() {
    ACTION.selectedElement = null;
    unmarkAll(graph);
}

function unmarkAll(graph) {
    for (let nodeId in graph) {
        setNodeColor(nodeId);
    }

    for (let fromId in graph) {
        for (let toId in graph) {
            setPathColor(fromId, toId);
        }
    }
}

function setNodeColor(nodeId, color = COLOR.white) {
    const selector = `${CONSTANTS.node}_${nodeId}`;
    const node = document.getElementById(selector);

    for (let child of node.childNodes) {
        if (child.tagName == CONSTANTS.circle) {
            child.setAttributeNS(null, "stroke", color);
        }
    }
}

function setPathColor(fromId, toId, color=COLOR.white) {
    const selector = `${CONSTANTS.path}_${fromId}-${toId}`;
    const node = document.getElementById(selector);

    if (!node) return;

    let marker = (color == COLOR.white) ? CONSTANTS.arrow : CONSTANTS.arrowSelected;
    if (fromId === toId) {
        marker = (color == COLOR.white) ? CONSTANTS.selfarrow : CONSTANTS.selfarrowSelected;
    }

    // the first child is transparent
    node.childNodes[1].setAttributeNS(null, CONSTANTS.stroke, color);
    node.childNodes[1].setAttributeNS(null, CONSTANTS.markerEnd, `url(#${marker}`);
}

function getIdOfNode(node) {
    return parseInt(node.id.split("_")[1]);
}

function getMousePosition(evt) {
    var CTM = svg.getScreenCTM();
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function getStartAngle(nodeId) {
    return getNode(nodeId).startAngle;
}

function getStartEdge(nodeId) {
    const selector = `${CONSTANTS.start}_${nodeId}`;

    return document.getElementById(selector);
}

// =============== graph operations =============== //
function getNode(id) {
    return graph[id];
}

function getEdge(fromId, toId) {
    const path = getNode(fromId).to.find(e => e.node === toId);

    return path;
}

function setEdgeAngle(nodeId, angle) {
    getEdge(nodeId, nodeId).angle = angle;
}

function getCoords(id) {
    return getNode(id).coords;
}

function setStartAngle(nodeId, angle) {
    getNode(nodeId).startAngle = angle;
}
