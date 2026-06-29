import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const statusToDb = {
  not_started: "NOT_STARTED",
  ongoing: "ONGOING",
  done: "DONE",
};

const statusFromDb = {
  NOT_STARTED: "not_started",
  ONGOING: "ongoing",
  DONE: "done",
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { ownerId: user.id },
    orderBy: { sortOrder: "asc" },
    include: {
      nodes: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }] },
      successorEdges: true,
    },
  });

  const nodes = goals.flatMap((goal) =>
    goal.nodes.map((node) => ({
      id: node.id,
      publicId: node.publicId,
      parentId: node.parentId,
      title: node.title,
      ownStatus: statusFromDb[node.ownStatus],
      dueDate: node.dueDate ? node.dueDate.toISOString().slice(0, 10) : "",
      conclusion: node.conclusion,
      sortOrder: node.sortOrder,
      goalId: node.goalId,
      kind: node.kind,
    })),
  );

  const successors = goals.flatMap((goal) =>
    goal.successorEdges.map((edge) => ({
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      goalId: edge.goalId,
    })),
  );

  return NextResponse.json({
    state: {
      currentGoalId: goals[0]?.id ?? null,
      selectedNodeId: goals[0]?.nodes.find((node) => node.kind === "goal")?.id ?? null,
      scale: 1,
      panX: 30,
      panY: 30,
      nextPublicId: Math.max(1, ...nodes.map((node) => node.publicId + 1)),
      goals: goals.map((goal) => ({
        id: goal.id,
        rootNodeId: goal.nodes.find((node) => node.kind === "goal")?.id ?? goal.id,
        title: goal.title,
        context: goal.context,
        stakeholders: goal.stakeholders,
      })),
      nodes,
      successors,
    },
  });
}

export async function PUT(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { state } = await request.json();
  if (!state?.goals || !state?.nodes || !state?.successors) {
    return NextResponse.json({ error: "Invalid state payload." }, { status: 400 });
  }

  const validationError = validateState(state);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.goal.deleteMany({ where: { ownerId: user.id } });
        await tx.goal.createMany({
          data: state.goals.map((goal) => {
            const root = state.nodes.find((node) => node.id === goal.rootNodeId);
            return {
              id: goal.id,
              ownerId: user.id,
              title: goal.title,
              context: goal.context ?? "",
              stakeholders: goal.stakeholders ?? "",
              sortOrder: root?.sortOrder ?? 1,
            };
          }),
        });

        const remaining = [...state.nodes];
        const createdIds = new Set();

        while (remaining.length) {
          const batch = remaining.filter((node) => !node.parentId || createdIds.has(node.parentId));
          if (!batch.length) throw new Error("Node hierarchy contains an invalid parent reference.");

          await tx.node.createMany({ data: batch.map(nodeToDb) });
          batch.forEach((node) => createdIds.add(node.id));
          const batchIds = new Set(batch.map((node) => node.id));
          for (let index = remaining.length - 1; index >= 0; index -= 1) {
            if (batchIds.has(remaining[index].id)) remaining.splice(index, 1);
          }
        }

        if (state.successors.length) {
          await tx.successorEdge.createMany({
            data: state.successors.map((edge) => ({
              goalId: edge.goalId,
              sourceId: edge.sourceId,
              targetId: edge.targetId,
            })),
          });
        }
      },
      { maxWait: 5000, timeout: 15000 },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cloud state save failed", error);
    return NextResponse.json({ error: "Cloud save failed. Please try again." }, { status: 500 });
  }
}

function nodeToDb(node) {
  return {
    id: node.id,
    publicId: node.publicId,
    goalId: node.goalId,
    parentId: node.parentId || null,
    title: node.title,
    ownStatus: statusToDb[node.ownStatus] ?? "NOT_STARTED",
    dueDate: node.dueDate ? new Date(`${node.dueDate}T00:00:00.000Z`) : null,
    conclusion: node.conclusion ?? "",
    sortOrder: node.sortOrder,
    kind: node.kind ?? "node",
  };
}

function validateState(state) {
  const goalIds = new Set(state.goals.map((goal) => goal.id));
  const nodeIds = new Set(state.nodes.map((node) => node.id));

  if (goalIds.size !== state.goals.length || nodeIds.size !== state.nodes.length) return "Duplicate IDs in state payload.";
  if (state.nodes.some((node) => !goalIds.has(node.goalId))) return "A node references an unknown goal.";
  if (state.nodes.some((node) => node.parentId && !nodeIds.has(node.parentId))) return "A node references an unknown parent.";
  if (state.successors.some((edge) => !goalIds.has(edge.goalId) || !nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId))) {
    return "A successor references an unknown node.";
  }

  return "";
}
