import { createModel, nodeDueState } from "./model.js";

export const briefingTypes = [
  { id: "status_mail", label: "Status mail to stakeholders" },
  { id: "risks", label: "Risks and overdue items" },
  { id: "next_actions", label: "Next actions" },
  { id: "conclusions", label: "Summarize conclusions" },
];

export function buildGoalContext(state, goalId = state.currentGoalId) {
  const goal = state.goals.find((item) => item.id === goalId);
  const model = createModel({ ...state, currentGoalId: goalId });
  const nodes = model.currentNodes();
  const successors = state.successors.filter((edge) => edge.goalId === goalId);

  const enrichedNodes = nodes
    .map((node) => ({
      ...node,
      number: model.treeNumber(node.id),
      workStatus: model.workStatus(node.id),
      displayStatus: model.displayStatus(node.id),
      dueState: nodeDueState(node),
      successors: successors.filter((edge) => edge.sourceId === node.id).map((edge) => edge.targetId),
    }))
    .sort((a, b) => compareTreeNumbers(a.number, b.number));

  return {
    goal,
    nodes: enrichedNodes,
    successors,
    metrics: {
      total: enrichedNodes.length,
      done: enrichedNodes.filter((node) => node.displayStatus === "done").length,
      ongoing: enrichedNodes.filter((node) => node.displayStatus === "ongoing").length,
      notStarted: enrichedNodes.filter((node) => node.displayStatus === "not_started").length,
      overdue: enrichedNodes.filter((node) => node.dueState === "overdue").length,
      dueSoon: enrichedNodes.filter((node) => node.dueState === "soon").length,
    },
  };
}

export function generateBriefing(context, type) {
  if (!context.goal) return "No goal selected.";

  if (type === "status_mail") return statusMail(context);
  if (type === "risks") return risksBriefing(context);
  if (type === "next_actions") return nextActionsBriefing(context);
  if (type === "conclusions") return conclusionsBriefing(context);
  return statusMail(context);
}

function statusMail(context) {
  const { goal, metrics } = context;
  const risks = riskNodes(context).slice(0, 6);
  const next = nextActionNodes(context).slice(0, 6);
  const conclusions = conclusionNodes(context).slice(0, 6);

  return [
    `Subject: Status update - ${goal.title}`,
    "",
    "Hi all,",
    "",
    goal.context?.trim() ? `Context: ${goal.context.trim()}` : "",
    "",
    `Quick status update on ${goal.title}: ${metrics.done}/${metrics.total} tracked items are done, with ${metrics.ongoing} currently ongoing.`,
    "",
    section(changeSectionTitle(context.changesSince), (context.changes ?? []).map(changeLine)),
    section("Key conclusions", conclusions.map((node) => `${nodeLine(node)} - ${node.conclusion}`)),
    section("Risks / due items", risks.map(nodeLineWithDue)),
    section("Next actions", next.map(actionNodeLine)),
    "",
    "Best,",
  ]
    .filter(Boolean)
    .join("\n");
}

function changeSectionTitle(since) {
  if (!since) return "Changes since tracking began";
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(since));
  return `Changes since stakeholder update on ${date}`;
}

function changeLine(change) {
  if (change.eventType === "node_created") return `Added task: ${change.nodeTitle}`;
  if (change.eventType === "node_deleted") return `Removed task: ${change.nodeTitle}`;

  const subject = change.nodeTitle || change.goalTitle;
  const field = changeFieldLabel(change.field);
  if (!change.oldValue) return `${subject}: ${field} set to ${displayChangeValue(change.field, change.newValue)}`;
  if (!change.newValue) return `${subject}: ${field} cleared`;
  return `${subject}: ${field} changed from ${displayChangeValue(change.field, change.oldValue)} to ${displayChangeValue(change.field, change.newValue)}`;
}

function changeFieldLabel(field) {
  return {
    title: "name",
    status: "status",
    due_date: "due date",
    conclusion: "conclusion",
    context: "project context",
    stakeholders: "stakeholders",
  }[field] ?? field;
}

function displayChangeValue(field, value) {
  if (field === "status") return value.replaceAll("_", " ");
  return value;
}

function risksBriefing(context) {
  return [`Risks and overdue items: ${context.goal.title}`, "", section("Due risks", riskNodes(context).map(nodeLineWithDue) || [])].join("\n");
}

function nextActionsBriefing(context) {
  return [`Next actions: ${context.goal.title}`, "", section("Suggested next actions", nextActionNodes(context).map(actionNodeLine))].join("\n");
}

function conclusionsBriefing(context) {
  return [`Conclusions: ${context.goal.title}`, "", section("Recorded conclusions", conclusionNodes(context).map((node) => `${nodeLine(node)}\n  ${node.conclusion}`))].join("\n");
}

function visibleNodes(context) {
  return context.nodes.filter((node) => node.kind !== "goal");
}

function riskNodes(context) {
  return visibleNodes(context).filter((node) => node.dueState === "overdue" || node.dueState === "soon");
}

function nextActionNodes(context) {
  return visibleNodes(context).filter((node) => node.ownStatus !== "done").sort((a, b) => dueRank(a) - dueRank(b) || compareTreeNumbers(a.number, b.number));
}

function conclusionNodes(context) {
  return visibleNodes(context).filter((node) => node.conclusion.trim());
}

function dueRank(node) {
  if (node.dueState === "overdue") return 0;
  if (node.dueState === "soon") return 1;
  if (node.dueDate) return 2;
  return 3;
}

function section(title, lines) {
  if (!lines.length) return `${title}:\n- None`;
  return `${title}:\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

function nodeLine(node) {
  return `${node.number}: ${node.title} (${node.displayStatus})`;
}

function actionNodeLine(node) {
  return `${node.number}: ${node.title} (${node.ownStatus})`;
}

function nodeLineWithDue(node) {
  return `${nodeLine(node)}${node.dueDate ? ` - due ${node.dueDate}` : ""}`;
}

function compareTreeNumbers(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  const max = Math.max(left.length, right.length);

  for (let index = 0; index < max; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}
