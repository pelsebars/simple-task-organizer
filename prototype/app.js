const STORAGE_KEY = "simple-task-organizer:v2";
const NODE_WIDTH = 190;
const NODE_HEIGHT = 68;
const LEFT = 80;
const TOP = 70;
const X_GAP = 250;
const STREAM_GAP = 38;

const statusLabels = {
  not_started: "Not started",
  ongoing: "Ongoing",
  done: "Done",
};

const sampleState = {
  currentGoalId: "goal-party",
  selectedNodeId: "room-booked",
  scale: 1,
  panX: 30,
  panY: 30,
  nextPublicId: 43,
  goals: [
    { id: "goal-party", rootNodeId: "goal-party", title: "Have a party" },
    { id: "goal-vacation", rootNodeId: "goal-vacation", title: "Vacation" },
  ],
  nodes: [
    makeNode("goal-party", 1, null, "Have a party", "ongoing", "", "", 1, "goal-party", "goal"),
    makeNode("food", 11, "goal-party", "Food ordered", "not_started", "2026-08-18", "", 1, "goal-party"),
    makeNode("guests", 12, "goal-party", "Guests invited", "ongoing", "2026-08-20", "", 2, "goal-party"),
    makeNode("room-booked", 13, "goal-party", "Room booked", "ongoing", "2026-08-20", "Need a room with space for dinner and music.", 3, "goal-party"),
    makeNode("find-room", 38, "room-booked", "Find suitable room", "done", "2026-08-17", "Place.dk looks best. Contact name Erik Poulsen, 22453256.", 1, "goal-party"),
    makeNode("order-room", 42, "room-booked", "Order room", "not_started", "2026-08-20", "", 2, "goal-party"),
    makeNode("goal-vacation", 2, null, "Vacation", "not_started", "", "", 1, "goal-vacation", "goal"),
  ],
  successors: [{ sourceId: "find-room", targetId: "order-room", goalId: "goal-party" }],
};

let state = loadState();
let layout = new Map();

const canvas = document.querySelector("#canvas");
const graphLayer = document.querySelector("#graphLayer");
const nodeLayer = document.querySelector("#nodeLayer");
const edgeLayer = document.querySelector("#edgeLayer");
const zoomLabel = document.querySelector("#zoomLabel");
const goalList = document.querySelector("#goalList");
const nodeForm = document.querySelector("#nodeForm");
const emptyState = document.querySelector("#emptyState");
const nodeNumber = document.querySelector("#nodeNumber");
const nodeTitle = document.querySelector("#nodeTitle");
const nodePublicId = document.querySelector("#nodePublicId");
const nodeChildCount = document.querySelector("#nodeChildCount");
const ownStatus = document.querySelector("#ownStatus");
const dueDate = document.querySelector("#dueDate");
const conclusion = document.querySelector("#conclusion");
const addSuccessorButton = document.querySelector("#addSuccessorButton");

function makeNode(id, publicId, parentId, title, ownStatus, dueDateValue, conclusionValue, sortOrder, goalId, kind = "node") {
  return {
    id,
    publicId,
    parentId,
    title,
    ownStatus,
    dueDate: dueDateValue,
    conclusion: conclusionValue,
    sortOrder,
    goalId,
    kind,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.nodes?.length && saved?.goals?.length) return saved;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return clone(sampleState);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function currentGoal() {
  return state.goals.find((goal) => goal.id === state.currentGoalId) ?? state.goals[0];
}

function currentNodes() {
  const goal = currentGoal();
  return state.nodes.filter((node) => node.goalId === goal.id);
}

function currentSuccessors() {
  const goal = currentGoal();
  return state.successors.filter((edge) => edge.goalId === goal.id);
}

function nodeById(nodeId) {
  return state.nodes.find((node) => node.id === nodeId);
}

function childrenOf(nodeId) {
  return currentNodes()
    .filter((node) => node.parentId === nodeId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.publicId - b.publicId);
}

function selectedNode() {
  return currentNodes().find((node) => node.id === state.selectedNodeId);
}

function childStatus(nodeId) {
  const children = childrenOf(nodeId);
  if (children.length === 0) return null;

  const statuses = children.map((child) => displayStatus(child.id));
  if (statuses.every((status) => status === "done")) return "done";
  if (statuses.every((status) => status === "not_started")) return "not_started";
  return "ongoing";
}

function displayStatus(nodeId) {
  const aggregate = childStatus(nodeId);
  const node = nodeById(nodeId);
  return aggregate ?? node?.ownStatus ?? "not_started";
}

function treeNumber(nodeId) {
  const node = nodeById(nodeId);
  if (!node) return "";
  if (!node.parentId) return `${node.sortOrder}`;

  return `${treeNumber(node.parentId)}.${node.sortOrder}`;
}

function dueState(node) {
  if (!node.dueDate || node.ownStatus === "done") return "none";

  const daysLeft = daysUntil(node.dueDate);

  if (daysLeft <= 0) return "overdue";
  if (daysLeft <= 2) return "soon";
  return "ok";
}

function daysUntil(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(year, month - 1, day);
  return Math.round((dueUtc - todayUtc) / 86400000);
}

function statusDot(status) {
  return `<span class="dot status-${status.replace("_", "-")}" title="${statusLabels[status]}"></span>`;
}

function siblingSuccessors(parentId) {
  return currentSuccessors().filter((edge) => {
    const source = nodeById(edge.sourceId);
    const target = nodeById(edge.targetId);
    return source && target && source.parentId === parentId && target.parentId === parentId;
  });
}

function successorStreams(parentId) {
  const siblings = childrenOf(parentId);
  const siblingIds = new Set(siblings.map((node) => node.id));
  const outgoing = new Map();
  const targetIds = new Set();

  siblingSuccessors(parentId).forEach((edge) => {
    if (!siblingIds.has(edge.sourceId) || !siblingIds.has(edge.targetId)) return;
    if (!outgoing.has(edge.sourceId)) outgoing.set(edge.sourceId, []);
    outgoing.get(edge.sourceId).push(edge.targetId);
    targetIds.add(edge.targetId);
  });

  const visited = new Set();
  const streams = [];
  const starts = siblings.filter((node) => !targetIds.has(node.id));

  starts.forEach((start) => {
    const stream = [];
    let current = start;

    while (current && !visited.has(current.id)) {
      stream.push(current);
      visited.add(current.id);
      const nextId = (outgoing.get(current.id) ?? []).find((id) => !visited.has(id));
      current = nextId ? nodeById(nextId) : null;
    }

    streams.push(stream);
  });

  siblings
    .filter((node) => !visited.has(node.id))
    .forEach((node) => streams.push([node]));

  return streams;
}

function layoutNode(node, depth, top) {
  const streams = successorStreams(node.id);
  layout.set(node.id, { x: LEFT + depth * X_GAP, y: top });

  if (streams.length === 0) {
    return NODE_HEIGHT;
  }

  let cursor = top + NODE_HEIGHT + STREAM_GAP;
  streams.forEach((stream) => {
    let streamHeight = NODE_HEIGHT;

    stream.forEach((child, index) => {
      const childHeight = layoutNode(child, depth + index + 1, cursor);
      streamHeight = Math.max(streamHeight, childHeight);
    });

    cursor += streamHeight + STREAM_GAP;
  });

  return Math.max(NODE_HEIGHT, cursor - top - STREAM_GAP);
}

function buildLayout() {
  layout = new Map();
  const root = nodeById(currentGoal().rootNodeId);
  if (!root) return;

  const height = layoutNode(root, 0, TOP);
  graphLayer.style.width = `${Math.max(1600, maxLayoutX() + 360)}px`;
  graphLayer.style.height = `${Math.max(1100, TOP + height + 220)}px`;
}

function maxLayoutX() {
  let max = 0;
  layout.forEach((position) => {
    max = Math.max(max, position.x);
  });
  return max;
}

function renderGoals() {
  goalList.innerHTML = state.goals
    .map((goal) => {
      const root = nodeById(goal.rootNodeId);
      const active = goal.id === state.currentGoalId ? "active" : "";
      const due = goalDueState(goal.id);
      const dueClass = due === "soon" || due === "overdue" ? `goal-due-${due}` : "";
      return `
        <button class="goal-item ${active} ${dueClass}" type="button" data-goal-id="${goal.id}">
          <span>${treeNumber(root?.id)}</span>
          <strong>${escapeHtml(goal.title)}</strong>
        </button>
      `;
    })
    .join("");
}

function goalDueState(goalId) {
  const dueStates = state.nodes
    .filter((node) => node.goalId === goalId)
    .map((node) => dueState(node));

  if (dueStates.includes("overdue")) return "overdue";
  if (dueStates.includes("soon")) return "soon";
  return "none";
}

function renderNodes() {
  const successorTargetIds = new Set(currentSuccessors().map((edge) => edge.targetId));

  nodeLayer.innerHTML = currentNodes()
    .map((node) => {
      const position = layout.get(node.id) ?? { x: LEFT, y: TOP };
      const child = childStatus(node.id);
      const due = dueState(node);
      const selected = node.id === state.selectedNodeId ? "selected" : "";
      const dueClass = due === "soon" || due === "overdue" ? `due-${due}` : "";
      const dueBadge = due === "soon" || due === "overdue" ? `<span class="due-badge">${formatDueDate(node.dueDate)}</span>` : "";
      const roleClass =
        node.kind === "goal" ? "node-goal" : successorTargetIds.has(node.id) ? "node-successor" : "node-child";
      const number = treeNumber(node.id);

      return `
        <button class="node ${roleClass} ${selected} ${dueClass}" style="left:${position.x}px; top:${position.y}px;" data-node-id="${node.id}" type="button">
          <span class="node-title">${number}: ${escapeHtml(node.title)}</span>
          <span class="status-stack">
            <span class="status-line">Self ${statusDot(node.ownStatus)}</span>
            ${child ? `<span class="status-line">Child ${statusDot(child)}</span>` : ""}
          </span>
          ${dueBadge}
        </button>
      `;
    })
    .join("");
}

function centerOf(node) {
  const position = layout.get(node.id) ?? { x: LEFT, y: TOP };
  return {
    x: position.x + NODE_WIDTH / 2,
    y: position.y + NODE_HEIGHT / 2,
  };
}

function elbowPath(source, target) {
  const from = centerOf(source);
  const to = centerOf(target);
  const midX = from.x + Math.max(35, (to.x - from.x) / 2);

  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
}

function formatDueDate(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${day}.${month}.${year}`;
}

function renderEdges() {
  const successorTargets = new Set(siblingSuccessors(null).map((edge) => edge.targetId));

  currentNodes()
    .filter((node) => node.parentId)
    .forEach((node) => {
      siblingSuccessors(node.parentId).forEach((edge) => successorTargets.add(edge.targetId));
    });

  const childEdges = currentNodes()
    .filter((node) => node.parentId)
    .filter((node) => !successorTargets.has(node.id))
    .map((node) => ({
      source: nodeById(node.parentId),
      target: node,
      type: "child",
    }));

  const successorEdges = currentSuccessors().map((edge) => ({
    source: nodeById(edge.sourceId),
    target: nodeById(edge.targetId),
    type: "successor",
  }));

  const edges = [...childEdges, ...successorEdges].filter((edge) => edge.source && edge.target);

  edgeLayer.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="#17378d"></path>
      </marker>
    </defs>
    ${edges
      .map((edge) => `<path class="edge edge-${edge.type}" d="${elbowPath(edge.source, edge.target)}" marker-end="url(#arrow)"></path>`)
      .join("")}
  `;
}

function renderForm() {
  const node = selectedNode();
  emptyState.classList.toggle("hidden", Boolean(node));
  nodeForm.classList.toggle("hidden", !node);

  if (!node) return;

  nodeNumber.textContent = `Node ${treeNumber(node.id)}`;
  nodeTitle.value = node.title;
  nodePublicId.textContent = node.publicId;
  nodeChildCount.textContent = childrenOf(node.id).length;
  ownStatus.value = node.ownStatus;
  dueDate.value = node.dueDate;
  conclusion.value = node.conclusion;
  addSuccessorButton.disabled = node.kind === "goal";
  addSuccessorButton.title = node.kind === "goal" ? "Goals can only have children" : "";
}

function updateTransform() {
  graphLayer.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
}

function render() {
  ensureSelection();
  buildLayout();
  renderGoals();
  renderEdges();
  renderNodes();
  renderForm();
  updateTransform();
}

function ensureSelection() {
  if (selectedNode()) return;
  state.selectedNodeId = currentGoal().rootNodeId;
}

function updateSelectedNode(patch) {
  const node = selectedNode();
  if (!node) return;
  Object.assign(node, patch);

  if (node.kind === "goal") {
    const goal = currentGoal();
    goal.title = node.title;
  }

  saveState();
  render();
}

function nextSortOrder(parentId) {
  return childrenOf(parentId).reduce((max, node) => Math.max(max, node.sortOrder), 0) + 1;
}

function newNode(parentId, title) {
  const parent = nodeById(parentId);
  return makeNode(
    crypto.randomUUID(),
    state.nextPublicId++,
    parentId,
    title,
    "not_started",
    "",
    "",
    nextSortOrder(parentId),
    parent.goalId,
  );
}

function addChild() {
  const parent = selectedNode();
  if (!parent) return;

  const node = newNode(parent.id, "New task");
  state.nodes.push(node);
  state.selectedNodeId = node.id;
  saveState();
  render();
}

function addSuccessor() {
  const source = selectedNode();
  if (!source || source.kind === "goal") return;

  const node = newNode(source.parentId, "Next step");
  state.nodes.push(node);
  state.successors.push({ sourceId: source.id, targetId: node.id, goalId: source.goalId });
  state.selectedNodeId = node.id;
  saveState();
  render();
}

function createGoal() {
  const title = window.prompt("Goal name?", "New goal");
  if (!title) return;

  const publicId = state.goals.length + 1;
  const id = crypto.randomUUID();
  const goal = { id, rootNodeId: id, title };
  const node = makeNode(id, publicId, null, title, "not_started", "", "", publicId, id, "goal");

  state.goals.push(goal);
  state.nodes.push(node);
  state.currentGoalId = id;
  state.selectedNodeId = id;
  state.panX = 30;
  state.panY = 30;
  state.scale = 1;
  saveState();
  render();
}

function resetDemo() {
  if (!window.confirm("Reset local prototype data?")) return;
  state = clone(sampleState);
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

goalList.addEventListener("click", (event) => {
  const button = event.target.closest(".goal-item");
  if (!button) return;
  state.currentGoalId = button.dataset.goalId;
  state.selectedNodeId = currentGoal().rootNodeId;
  saveState();
  render();
});

nodeLayer.addEventListener("click", (event) => {
  const button = event.target.closest(".node");
  if (!button) return;
  state.selectedNodeId = button.dataset.nodeId;
  saveState();
  render();
});

nodeTitle.addEventListener("input", () => updateSelectedNode({ title: nodeTitle.value }));
ownStatus.addEventListener("change", () => updateSelectedNode({ ownStatus: ownStatus.value }));
dueDate.addEventListener("input", () => updateSelectedNode({ dueDate: dueDate.value }));
conclusion.addEventListener("input", () => updateSelectedNode({ conclusion: conclusion.value }));

document.querySelector("#addChildButton").addEventListener("click", addChild);
addSuccessorButton.addEventListener("click", addSuccessor);

document.querySelector("#zoomInButton").addEventListener("click", () => {
  state.scale = Math.min(2, state.scale + 0.1);
  saveState();
  render();
});

document.querySelector("#zoomOutButton").addEventListener("click", () => {
  state.scale = Math.max(0.35, state.scale - 0.1);
  saveState();
  render();
});

document.querySelector("#resetViewButton").addEventListener("click", () => {
  state.scale = 1;
  state.panX = 30;
  state.panY = 30;
  saveState();
  render();
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    state.scale = Math.min(2, Math.max(0.35, state.scale - event.deltaY * 0.001));
    saveState();
    updateTransform();
  },
  { passive: false },
);

let panning = false;
let lastPointer = null;

canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 2) return;
  panning = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!panning || !lastPointer) return;
  state.panX += event.clientX - lastPointer.x;
  state.panY += event.clientY - lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };
  saveState();
  updateTransform();
});

canvas.addEventListener("pointerup", () => {
  panning = false;
  lastPointer = null;
});

document.querySelector("#createGoalButton").addEventListener("click", createGoal);
document.querySelector("#resetDataButton").addEventListener("click", resetDemo);

render();
