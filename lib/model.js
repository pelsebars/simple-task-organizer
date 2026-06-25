import { fallbackId, makeNode } from "./sampleData.js";

const NODE_WIDTH = 190;
const NODE_HEIGHT = 68;
const LEFT = 80;
const TOP = 70;
const X_GAP = 250;
const STREAM_GAP = 38;

export const statusLabels = {
  not_started: "Not started",
  ongoing: "Ongoing",
  done: "Done",
};

export function createModel(state) {
  const currentGoal = () => state.goals.find((goal) => goal.id === state.currentGoalId) ?? state.goals[0];
  const currentNodes = () => state.nodes.filter((node) => node.goalId === currentGoal()?.id);
  const currentSuccessors = () => state.successors.filter((edge) => edge.goalId === currentGoal()?.id);
  const nodeById = (nodeId) => state.nodes.find((node) => node.id === nodeId);
  const childrenOf = (nodeId) =>
    currentNodes()
      .filter((node) => node.parentId === nodeId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.publicId - b.publicId);

  const treeNumber = (nodeId) => {
    const node = nodeById(nodeId);
    if (!node) return "";
    if (!node.parentId) return `${node.sortOrder}`;
    return `${treeNumber(node.parentId)}.${node.sortOrder}`;
  };

  const displayStatus = (nodeId) => {
    const aggregate = workStatus(nodeId);
    const node = nodeById(nodeId);
    return aggregate ?? node?.ownStatus ?? "not_started";
  };

  const workItemsOf = (nodeId) => {
    const directChildren = childrenOf(nodeId);
    const directSuccessors = currentSuccessors()
      .filter((edge) => edge.sourceId === nodeId)
      .map((edge) => nodeById(edge.targetId))
      .filter(Boolean);

    return uniqueNodes([...directChildren, ...directSuccessors]);
  };

  const workStatus = (nodeId, visited = new Set()) => {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const workItems = workItemsOf(nodeId);
    if (workItems.length === 0) return null;

    return aggregateStatuses(workItems.map((item) => workContributionStatus(item, new Set(visited))));
  };

  const workContributionStatus = (node, visited) => {
    const downstreamStatus = workStatus(node.id, visited);
    if (!downstreamStatus) return node.ownStatus;
    return aggregateStatuses([node.ownStatus, downstreamStatus]);
  };

  const childStatus = (nodeId) => {
    return workStatus(nodeId);
  };

  const siblingSuccessors = (parentId) =>
    currentSuccessors().filter((edge) => {
      const source = nodeById(edge.sourceId);
      const target = nodeById(edge.targetId);
      return source && target && source.parentId === parentId && target.parentId === parentId;
    });

  const successorStreams = (parentId) => {
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

    siblings.filter((node) => !visited.has(node.id)).forEach((node) => streams.push([node]));
    return streams;
  };

  const layout = new Map();

  const layoutNode = (node, depth, top) => {
    const streams = successorStreams(node.id);
    layout.set(node.id, { x: LEFT + depth * X_GAP, y: top });

    if (streams.length === 0) return NODE_HEIGHT;

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
  };

  const root = currentGoal() ? nodeById(currentGoal().rootNodeId) : null;
  const graphHeight = root ? Math.max(1100, TOP + layoutNode(root, 0, TOP) + 220) : 1100;
  let maxX = 0;
  layout.forEach((position) => {
    maxX = Math.max(maxX, position.x);
  });
  const graphWidth = Math.max(1600, maxX + 360);

  const positionOf = (nodeId) => layout.get(nodeId) ?? { x: LEFT, y: TOP };
  const centerOf = (node) => {
    const position = positionOf(node.id);
    return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT / 2 };
  };

  const edgePath = (source, target) => {
    const from = centerOf(source);
    const to = centerOf(target);
    const midX = from.x + Math.max(35, (to.x - from.x) / 2);
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  };

  const successorTargetIds = new Set(currentSuccessors().map((edge) => edge.targetId));
  const siblingTargetIds = new Set();
  currentNodes()
    .filter((node) => node.parentId)
    .forEach((node) => {
      siblingSuccessors(node.parentId).forEach((edge) => siblingTargetIds.add(edge.targetId));
    });

  const childEdges = currentNodes()
    .filter((node) => node.parentId)
    .filter((node) => !siblingTargetIds.has(node.id))
    .map((node) => ({ source: nodeById(node.parentId), target: node, type: "child" }));

  const successorEdges = currentSuccessors().map((edge) => ({
    source: nodeById(edge.sourceId),
    target: nodeById(edge.targetId),
    type: "successor",
  }));

  const edges = [...childEdges, ...successorEdges]
    .filter((edge) => edge.source && edge.target)
    .map((edge) => ({ ...edge, path: edgePath(edge.source, edge.target) }));

  const dueState = (node) => nodeDueState(node);

  const roleClass = (node) => {
    if (node.kind === "goal") return "node-goal";
    return successorTargetIds.has(node.id) ? "node-successor" : "node-child";
  };

  const outgoingSuccessors = (nodeId) =>
    currentSuccessors()
      .filter((edge) => edge.sourceId === nodeId)
      .map((edge) => nodeById(edge.targetId))
      .filter(Boolean);

  const successorOptions = (nodeId) => {
    const node = nodeById(nodeId);
    if (!node || node.kind === "goal") return [];

    const existingTargets = new Set(outgoingSuccessors(nodeId).map((target) => target.id));
    return childrenOf(node.parentId).filter((sibling) => sibling.id !== node.id && !existingTargets.has(sibling.id));
  };

  return {
    childStatus,
    childrenOf,
    currentNodes,
    displayStatus,
    dueState,
    edges,
    graphHeight,
    graphWidth,
    outgoingSuccessors,
    positionOf,
    roleClass,
    selectedNode: () => currentNodes().find((node) => node.id === state.selectedNodeId),
    successorOptions,
    treeNumber,
    workItemsOf,
    workStatus,
  };
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function aggregateStatuses(statuses) {
  if (statuses.every((status) => status === "done")) return "done";
  if (statuses.every((status) => status === "not_started")) return "not_started";
  return "ongoing";
}

export function newNode(draft, parentId, title) {
  const parent = draft.nodes.find((node) => node.id === parentId);
  return makeNode(fallbackId(), draft.nextPublicId++, parentId, title, "not_started", "", "", nextSortOrder(draft, parentId), parent.goalId);
}

export function nextSortOrder(draft, parentId) {
  return draft.nodes.filter((node) => node.parentId === parentId).reduce((max, node) => Math.max(max, node.sortOrder), 0) + 1;
}

export function descendantsOf(draft, nodeId) {
  const result = new Set();
  const stack = draft.nodes.filter((node) => node.parentId === nodeId).map((node) => node.id);

  while (stack.length > 0) {
    const id = stack.pop();
    result.add(id);
    draft.nodes.filter((node) => node.parentId === id).forEach((node) => stack.push(node.id));
  }

  return result;
}

export function resequenceChildren(draft, parentId) {
  draft.nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.publicId - b.publicId)
    .forEach((node, index) => {
      node.sortOrder = index + 1;
    });
}

export function resequenceRootGoals(draft) {
  draft.goals.forEach((goal, index) => {
    const root = draft.nodes.find((node) => node.id === goal.rootNodeId);
    if (root) root.sortOrder = index + 1;
  });
}

export function ensureSelection(draft) {
  const goal = draft.goals.find((item) => item.id === draft.currentGoalId) ?? draft.goals[0];
  if (!goal) return;
  if (draft.nodes.some((node) => node.id === draft.selectedNodeId && node.goalId === goal.id)) return;
  draft.currentGoalId = goal.id;
  draft.selectedNodeId = goal.rootNodeId;
}

export function goalDueState(state, goalId) {
  const dueStates = state.nodes.filter((node) => node.goalId === goalId).map((node) => nodeDueState(node));

  if (dueStates.includes("overdue")) return "overdue";
  if (dueStates.includes("soon")) return "soon";
  return "none";
}

export function nodeDueState(node) {
  if (!node.dueDate || node.ownStatus === "done") return "none";
  const daysLeft = daysUntil(node.dueDate);
  if (daysLeft <= 0) return "overdue";
  if (daysLeft <= 2) return "soon";
  return "ok";
}

export function wouldCreateSuccessorCycle(draft, sourceId, targetId) {
  const visited = new Set();
  const stack = [targetId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (currentId === sourceId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    draft.successors.filter((edge) => edge.sourceId === currentId).forEach((edge) => stack.push(edge.targetId));
  }

  return false;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function daysUntil(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(year, month - 1, day);
  return Math.round((dueUtc - todayUtc) / 86400000);
}

export function formatDueDate(dateValue) {
  const [year, month, day] = dateValue.split("-");
  return `${day}.${month}.${year}`;
}
