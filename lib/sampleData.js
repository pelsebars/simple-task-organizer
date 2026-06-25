export const STORAGE_KEY = "simple-task-organizer:next-v1";

export function makeNode(id, publicId, parentId, title, ownStatus, dueDate, conclusion, sortOrder, goalId, kind = "node") {
  return {
    id,
    publicId,
    parentId,
    title,
    ownStatus,
    dueDate,
    conclusion,
    sortOrder,
    goalId,
    kind,
  };
}

export function fallbackId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function sampleState() {
  return {
    currentGoalId: "goal-party",
    selectedNodeId: "room-booked",
    scale: 1,
    panX: 30,
    panY: 30,
    nextPublicId: 43,
    goals: [
      {
        id: "goal-party",
        rootNodeId: "goal-party",
        title: "Have a party",
        context: "Plan and coordinate a party, including food, guests, and venue.",
        stakeholders: "Host: Jacob\nGuests\nVenue contact\nCaterer",
      },
      { id: "goal-vacation", rootNodeId: "goal-vacation", title: "Vacation", context: "", stakeholders: "" },
    ],
    nodes: [
      makeNode("goal-party", 1, null, "Have a party", "ongoing", "", "", 1, "goal-party", "goal"),
      makeNode("food", 11, "goal-party", "Food ordered", "not_started", "2026-08-18", "", 1, "goal-party"),
      makeNode("guests", 12, "goal-party", "Guests invited", "ongoing", "2026-08-20", "", 2, "goal-party"),
      makeNode(
        "room-booked",
        13,
        "goal-party",
        "Room booked",
        "ongoing",
        "2026-08-20",
        "Need a room with space for dinner and music.",
        3,
        "goal-party",
      ),
      makeNode(
        "find-room",
        38,
        "room-booked",
        "Find suitable room",
        "done",
        "2026-08-17",
        "Place.dk looks best. Contact name Erik Poulsen, 22453256.",
        1,
        "goal-party",
      ),
      makeNode("order-room", 42, "room-booked", "Order room", "not_started", "2026-08-20", "", 2, "goal-party"),
      makeNode("goal-vacation", 2, null, "Vacation", "not_started", "", "", 1, "goal-vacation", "goal"),
    ],
    successors: [{ sourceId: "find-room", targetId: "order-room", goalId: "goal-party" }],
  };
}
