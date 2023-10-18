import { CONSTANTS, THRESHOLDS, COLOR, DISTANCE, SIZE } from './constants.js';
import * as model from './model.js';
import * as view from './view.js'
import * as vector from './vectors.js';

"use strict";

export const ACTION = {
    selectedDragElement: null,
    selectedElement: null,
    showGrid: false,
};

export let svg;

export function dfaToGraph(dfa) {
    const graph = {}
    let x = 20
    let y = 20
    for (let state of dfa.states) {
        // add identifier and coordinates
        const id = Number(state);

        graph[id] = {
            desc: [state],
            coords: {x: x, y: y}
        }

        // determine attributes
        let attributes = [];
        if (state == dfa.start) {
            attributes.push("start");
            graph[id].startAngle = 270;
        }
        if (dfa.end.includes(state)) {
            attributes.push("end");
        }
        graph[id].attributes = attributes;

        // add edges
        let edges = [];
        for (let val of dfa.transitions) {
            if (val.from != state) {
                continue;
            }
            let entry = {
                desc: [val.with.toString()],
                node: Number(val.to),
                offset: 0,
                textOffset: -5
            };

            // add angle for loop
            if (val.to == state) {
                entry.angle = 0;
            }

            edges.push(entry);
        }
        graph[id].to = edges;


        // update position for next node
        x += 40;
        if (x > 180) {
            x = 20;
            y += 40;
        }
    }

    model.setGraph(graph);
}

export function initSVG() {
    svg = document.getElementsByTagName("svg")[0];
    svg.addEventListener("load", makeDraggable);
}

function makeDraggable(evt) {
    var svg = evt.target;
    svg.addEventListener('mousedown', mouseDown);
    svg.addEventListener('mousedown', startDrag);
    svg.addEventListener('mousemove', drag);
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);
}

function unselectAll() {
    ACTION.selectedElement = null;

    view.unmarkAll(model.getGraph());
}

function selectEdge(elem) {
    unselectAll();

    // select the node
    ACTION.selectedElement = elem;

    // mark selected node
    const ids = view.getIdsOfPath(elem);
    view.setPathColor(ids.from, ids.to, COLOR.marked);
}

function selectNode(elem) {
    unselectAll();

    // select the node
    ACTION.selectedElement = elem;

    // mark selected node
    const nodeId = view.getIdOfNode(elem);
    view.setNodeColor(nodeId, COLOR.marked);
}

function endDrawing(event) {
    // mount the path if on another node (or else throw it away)
    const mouse = getMousePosition(event);

    for (let nodeId in model.getGraph()) {
        // check if distance is low enough
        if (vector.getDistance(mouse, model.getCoords(nodeId)) > SIZE.nodeRadius) continue;

        // try adding edge (fails if already exists)
        const succ = model.addEdge(ACTION.drawStartNodeId, parseInt(nodeId));
        if (succ === -1) continue;

        view.build();

        // highlight the edge
        const path = view.getPathElemByIds(ACTION.drawStartNodeId, nodeId);
        selectEdge(path);
        break;
    }

    // reset drawing path
    view.resetDrawingPath();

    ACTION.draw = false;
    ACTION.drawStartNodeId = -1;
}

function mouseDown(evt) {
    let elem = evt.target;

    while (elem.tagName === CONSTANTS.tspan) {
        elem = elem.parentNode;
    }
    
    const prefix = view.getIdPrefix(elem.parentNode);

    // cancel selection if the background is clicked
    if (elem === view.getSVG()) {
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

function startDrag(evt) {
    let elem = evt.target;

    while (elem.tagName === CONSTANTS.tspan) {
        elem = elem.parentNode;
    }

    if (elem.classList.contains(CONSTANTS.draggable)) {
        let parent = elem.parentNode;

        if (elem.tagName === CONSTANTS.text && view.getIdPrefix(parent) === CONSTANTS.path) {
            ACTION.selectedDragElement = elem;
        } else if (parent && parent.tagName === CONSTANTS.g) {
            ACTION.selectedDragElement = parent;
        } else {
            console.error("Wrong element clickable");
        }
    }
}

function draw(evt) {
    if (!ACTION.draw) return;

    evt.preventDefault();
    const mouse = getMousePosition(evt);

    const startCoords = model.getCoords(ACTION.drawStartNodeId);
    const dValue = `M${startCoords.x} ${startCoords.y} L${mouse.x} ${mouse.y}`;
    const path = document.getElementById(CONSTANTS.defaultPath);

    view.updateAttributes(path, { d: dValue });
}

function drag(evt) {
    if (!ACTION.selectedDragElement || ACTION.draw) return;

    evt.preventDefault();
    const mouse = getMousePosition(evt);
    let prefix = view.getIdPrefix(ACTION.selectedDragElement);

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
            const ids = view.getIdsOfPath(ACTION.selectedDragElement);
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

function dragText(mouse) {
    // get the id of the node
    const ids = view.getIdsOfPath(ACTION.selectedDragElement.parentNode);
    const edge = model.getEdge(ids.from, ids.to);
    const startNode = model.getNode(ids.from);
    const endNode = model.getNode(ids.to);

    let update;

    // handle self edge text
    if (ids.from === ids.to) {
        const angleVector = vector.getVectorFromAngle(edge.angle);
        const basePosition = { x: startNode.coords.x + angleVector.x * DISTANCE.selfEdgeText, y: startNode.coords.y + angleVector.y * DISTANCE.selfEdgeText };
        const normalAngle = vector.getNormalVector(startNode.coords, basePosition);

        let dist = vector.getDistanceToLine(mouse, normalAngle, basePosition);
        dist = snap(dist, THRESHOLDS.text);
        edge.textOffset = dist;

        update = {
            x: startNode.coords.x + angleVector.x * (DISTANCE.selfEdgeText - dist),
            y: startNode.coords.y + angleVector.y * (DISTANCE.selfEdgeText - dist)
        };
    } else {
        // handle normal edge
        const middle = vector.getMiddleOfVector(startNode.coords, endNode.coords);
        const normalVector = vector.getNormalVector(startNode.coords, endNode.coords);
        const directionVector = vector.getDirectionVector(startNode.coords, endNode.coords);
        let dist = vector.getDistanceToLine(mouse, directionVector, startNode.coords) - edge.offset;
        dist = snap(dist, THRESHOLDS.text);
        edge.textOffset = dist;

        update = {
            x: middle.x + normalVector.x * (dist + edge.offset),
            y: middle.y + normalVector.y * (dist + edge.offset)
        };
    }

    view.updateAttributes(ACTION.selectedDragElement, update);
    view.correctSubTexts(edge.desc, update, ACTION.selectedDragElement);
}

function dragSelfEdge(coord) {
    const ids = view.getIdsOfPath(ACTION.selectedDragElement);
    const nodeId = ids.from;
    const node = model.getNode(nodeId);

    let angle = vector.getAngle360Degree(node.coords, coord);
    model.setEdgeAngle(nodeId, angle);

    for (let child of ACTION.selectedDragElement.childNodes) {
        switch (child.tagName) {
            case CONSTANTS.path:
                view.setPathAngle(child, angle, node.coords);
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
    const ids = view.getIdsOfPath(ACTION.selectedDragElement);

    // get the coords of the nodes
    const startNode = model.getNode(ids.from);
    const endNode = model.getNode(ids.to);
    const middle = vector.getMiddleOfVector(startNode.coords, endNode.coords);
    const normalVector = vector.getNormalVector(startNode.coords, endNode.coords);

    // determine distance to mouse 
    const directionVector = vector.getDirectionVector(startNode.coords, endNode.coords);
    let dist = vector.getDistanceToLine(mouse, directionVector, startNode.coords);

    if (2 * dist < THRESHOLDS.straightEdge && 2 * dist > -THRESHOLDS.straightEdge) {
        dist = 0;
    }
    dist = snap(dist, SIZE.grid);

    // update the offset in the data
    const edge = model.getEdge(ids.from, ids.to);
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
                view.updateAttributes(child, { d: dValue });
                break;
            case CONSTANTS.text:
                view.updateAttributes(child, update);
                view.updateAttributes(child.firstChild, update);
                break;
            default:
                console.error("Unknown element found");
        }
    }
}

function dragStartEdge(mouse) {
    const id = view.getIdOfNode(ACTION.selectedDragElement);
    const coords = model.getCoords(id);

    let angle = vector.getAngle360Degree(coords, mouse);
    angle = snap(angle, THRESHOLDS.angle);

    model.setStartAngle(id, angle);

    // adapt the line
    const startAngle = vector.getVectorFromAngle(angle);
    const length = SIZE.nodeRadius + DISTANCE.startEdge;
    const dValue = `M${coords.x + startAngle.x * length} ${coords.y + startAngle.y * length} L${coords.x} ${coords.y}`;

    view.updateAttributes(ACTION.selectedDragElement.childNodes[0], { d: dValue });
    view.updateAttributes(ACTION.selectedDragElement.childNodes[1], { d: dValue });
}

function dragNode(mouse) {
    const id = view.getIdOfNode(ACTION.selectedDragElement);
    const coords = model.getCoords(id);

    mouse.x = snap(mouse.x, SIZE.grid);
    mouse.y = snap(mouse.y, SIZE.grid);

    // prevent overlapping nodes and going over the edge
    let distance = Number.MAX_VALUE;
    for (let nodeId in model.getGraph()) {
        if (nodeId == id) continue;

        const tmpDistance = vector.getDistance(mouse, model.getCoords(nodeId));
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
                view.updateAttributes(child, { cx: mouse.x, cy: mouse.y });
                break;
            case CONSTANTS.text:
                view.updateAttributes(child, { x: mouse.x, y: mouse.y });
                view.correctSubTexts(model.getNodeDescription(id), mouse, child);
                break;
            case CONSTANTS.g:
                // handled later
                break;
            default:
                console.error("Unknown element found: ", child);
        }
    }

    // change the path of start
    if (model.isNodeStart(id)) {
        const pathContainer = view.getStartEdge(id);

        const startAngle = vector.getVectorFromAngle(model.getStartAngle(id));
        const length = SIZE.nodeRadius + DISTANCE.startEdge;
        const dValue = `M${coords.x + startAngle.x * length} ${coords.y + startAngle.y * length} L${coords.x} ${coords.y}`;

        view.updateAttributes(pathContainer.childNodes[0], { d: dValue });
        view.updateAttributes(pathContainer.childNodes[1], { d: dValue });
    }

    // update the model
    model.setCoords(id, mouse);

    // remove the self edge
    const edges = model.getEdgesInvolvingNode(id);
    if (model.hasSelfEdge(id)) {
        // remove from list
        const index = edges.to.indexOf(id);
        edges.to.splice(index, 1);

        const dValue = `M${coords.x} ${coords.y - SIZE.nodeRadius + 1} A${DISTANCE.selfEdgeWidth} ${DISTANCE.selfEdgeHeight} 0 1 1 ${coords.x + 0.01} ${coords.y - SIZE.nodeRadius + 1}`;
        const selfPath = model.getEdge(id, id);

        // get the svg path
        const path = view.getPathElemByIds(id, id);

        // correct the self edge 
        const update = {
            d: dValue,
            transform: `rotate(${selfPath.angle}, ${coords.x}, ${coords.y})`
        };
        for (let child of path.childNodes) {
            switch (child.tagName) {
                case CONSTANTS.path:
                    view.updateAttributes(child, update);
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
    if (ACTION.draw) {
        endDrawing(evt)
    }

    ACTION.selectedDragElement = null;
}

function getMousePosition(evt) {
    var CTM = view.getSVG().getScreenCTM();
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function correctEdges(pathList, id, to) {
    for (let nodeId of pathList) {
        const fromId = to ? nodeId : id;
        const toId = to ? id : nodeId;

        // get the svg path
        const path = view.getPathElemByIds(fromId, toId);

        // redraw the path
        const startCoords = model.getCoords(fromId);
        const endCoords = model.getCoords(toId);

        const middle = vector.getMiddleOfVector(startCoords, endCoords);
        const normalVector = vector.getNormalVector(startCoords, endCoords);
        const otherNode = model.getEdge(fromId, toId);
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
                    view.updateAttributes(child, { d: dValue });
                    break;
                case CONSTANTS.text:
                    view.updateAttributes(child, update);
                    view.correctSubTexts(model.getEdgeDescription(fromId, toId), update, child);
                    break;
                default:
                    console.error("Unknown element found");
            }
        }
    }
}

function correctSelfEdgeText(elem, id) {
    const edge = model.getEdge(id, id);
    const coords = model.getCoords(id);
    const angleVector = vector.getVectorFromAngle(edge.angle);
    const dist = edge.textOffset;

    const update = {
        x: coords.x + angleVector.x * (DISTANCE.selfEdgeText - dist),
        y: coords.y + angleVector.y * (DISTANCE.selfEdgeText - dist)
    };
    view.updateAttributes(elem, update);
    view.correctSubTexts(model.getEdgeDescription(id, id), update, elem);
}

function toggleGridView() {
    ACTION.showGrid = !ACTION.showGrid;

    view.toggleGridView(ACTION.showGrid);
}

function downloadSVG(downloadLink) {
    unselectAll();
    if (ACTION.showGrid) {
        toggleGridView();
    }

    var svgData = view.getSVG().outerHTML;
    var svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var svgUrl = URL.createObjectURL(svgBlob);

    downloadLink.href = svgUrl;
    downloadLink.download = "automaton.svg";
}

function snap(val, step) {
    if (!ACTION.showGrid) return val;

    return Math.round(val / step) * step;
}