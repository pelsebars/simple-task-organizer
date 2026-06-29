import assert from "node:assert/strict";
import { buildGoalContext, generateBriefing } from "../lib/briefings.js";
import { createModel } from "../lib/model.js";
import { buildDailyStandup } from "../lib/standup.js";

const state = {
  currentGoalId: "goal",
  selectedNodeId: "parent",
  scale: 1,
  panX: 30,
  panY: 30,
  nextPublicId: 5,
  goals: [{ id: "goal", rootNodeId: "parent", title: "Goal", context: "Test context", stakeholders: "" }],
  nodes: [
    node("parent", 1, null, "Parent", "not_started", 1, "goal"),
    node("a", 2, "parent", "A", "done", 1, "goal"),
    node("b", 3, "parent", "B", "done", 2, "goal"),
    node("c", 4, "parent", "C", "done", 3, "goal"),
  ],
  successors: [
    { sourceId: "a", targetId: "b", goalId: "goal" },
    { sourceId: "b", targetId: "c", goalId: "goal" },
  ],
};

const model = createModel(state);

assert.deepEqual(
  model.childrenOf("parent").map((item) => item.id),
  ["a", "b", "c"],
);
assert.equal(model.childStatus("parent"), "done");
assert.equal(model.workStatus("a"), "done");

state.nodes.find((item) => item.id === "b").ownStatus = "ongoing";
assert.equal(createModel(state).childStatus("parent"), "ongoing");
assert.equal(createModel(state).workStatus("a"), "ongoing");

const context = buildGoalContext(state, "goal");
assert.equal(context.metrics.total, 4);
assert.match(generateBriefing(context, "status_mail"), /Subject: Status update - Goal/);
assert.match(
  generateBriefing(
    {
      ...context,
      changes: [{ eventType: "node_updated", nodeTitle: "B", field: "status", oldValue: "not_started", newValue: "ongoing" }],
    },
    "status_mail",
  ),
  /B: status changed from not started to ongoing/,
);

state.nodes.find((item) => item.id === "a").dueDate = todayDate();
state.nodes.find((item) => item.id === "b").dueDate = "";
state.nodes.find((item) => item.id === "c").ownStatus = "not_started";
const standup = buildDailyStandup(state);
assert.equal(standup.urgentCount, 0, "Done tasks are omitted even when due today");
assert.deepEqual(standup.goals[0].ongoing.map((item) => item.id), ["b"]);
assert.deepEqual(standup.goals[0].notStarted.map((item) => item.id), ["c"]);

console.log("Model checks passed");

function node(id, publicId, parentId, title, ownStatus, sortOrder, goalId) {
  return {
    id,
    publicId,
    parentId,
    title,
    ownStatus,
    dueDate: "",
    conclusion: "",
    sortOrder,
    goalId,
    kind: parentId ? "node" : "goal",
  };
}

function todayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
