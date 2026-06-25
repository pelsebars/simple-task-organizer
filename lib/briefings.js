import { createModel, nodeDueState } from "./model.js";

export const briefingTypes = [
  { id: "daily_standup", label: "Daily standup" },
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
  return dailyStandup(context);
}

function dailyStandup(context) {
  const { goal, metrics } = context;
  const done = visibleNodes(context).filter((node) => node.displayStatus === "done").slice(0, 8);
  const ongoing = visibleNodes(context).filter((node) => node.displayStatus === "ongoing").slice(0, 8);
  const risks = riskNodes(context).slice(0, 8);
  const next = nextActionNodes(context).slice(0, 8);

  return [
    `Daily standup: ${goal.title}`,
    "",
    `Overall: ${metrics.done}/${metrics.total} nodes done. ${metrics.ongoing} ongoing, ${metrics.notStarted} not started.`,
    projectContextSection(goal),
    "",
    section("Done", done.map(nodeLine)),
    section("In progress", ongoing.map(nodeLine)),
    section("Due risks", risks.map(nodeLineWithDue)),
    section("Suggested next actions", next.map(nodeLine)),
    stakeholdersSection(goal),
  ]
    .filter(Boolean)
    .join("\n");
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
    section("Key conclusions", conclusions.map((node) => `${nodeLine(node)} - ${node.conclusion}`)),
    section("Risks / due items", risks.map(nodeLineWithDue)),
    section("Next actions", next.map(nodeLine)),
    "",
    "Best,",
  ]
    .filter(Boolean)
    .join("\n");
}

function risksBriefing(context) {
  return [`Risks and overdue items: ${context.goal.title}`, "", section("Due risks", riskNodes(context).map(nodeLineWithDue) || [])].join("\n");
}

function nextActionsBriefing(context) {
  return [`Next actions: ${context.goal.title}`, "", section("Suggested next actions", nextActionNodes(context).map(nodeLine))].join("\n");
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
  return visibleNodes(context).filter((node) => node.displayStatus !== "done").sort((a, b) => dueRank(a) - dueRank(b) || compareTreeNumbers(a.number, b.number));
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

function stakeholdersSection(goal) {
  const stakeholders = goal.stakeholders?.trim();
  if (!stakeholders) return "";
  return `\nStakeholders:\n${stakeholders
    .split("\n")
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n")}`;
}

function projectContextSection(goal) {
  const context = goal.context?.trim();
  if (!context) return "";
  return `Project context:\n${context}`;
}

function nodeLine(node) {
  return `${node.number}: ${node.title} (${node.displayStatus})`;
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
