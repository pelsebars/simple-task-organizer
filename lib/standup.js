import { buildGoalContext } from "./briefings.js";

export function buildDailyStandup(state) {
  const goals = state.goals.map((goal) => {
    const context = buildGoalContext(state, goal.id);
    const tasks = context.nodes.filter((node) => node.kind !== "goal" && node.ownStatus !== "done");
    const urgent = sortTasks(tasks.filter((node) => node.dueState === "overdue" || node.dueState === "soon"));
    const urgentIds = new Set(urgent.map((node) => node.id));
    const ongoing = sortTasks(tasks.filter((node) => node.ownStatus === "ongoing" && !urgentIds.has(node.id)));
    const notStarted = sortTasks(tasks.filter((node) => node.ownStatus === "not_started" && !urgentIds.has(node.id)));

    return {
      goal,
      urgent,
      ongoing,
      notStarted,
      openCount: tasks.length,
    };
  });

  return {
    goals: goals.filter((item) => item.openCount > 0),
    openCount: goals.reduce((total, item) => total + item.openCount, 0),
    urgentCount: goals.reduce((total, item) => total + item.urgent.length, 0),
    ongoingCount: goals.reduce((total, item) => total + item.ongoing.length, 0),
    notStartedCount: goals.reduce((total, item) => total + item.notStarted.length, 0),
  };
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => dueTimestamp(a) - dueTimestamp(b) || compareTreeNumbers(a.number, b.number));
}

function dueTimestamp(node) {
  if (!node.dueDate) return Number.POSITIVE_INFINITY;
  return new Date(`${node.dueDate}T00:00:00`).getTime();
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
