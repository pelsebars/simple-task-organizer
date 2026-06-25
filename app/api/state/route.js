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

  await prisma.$transaction(async (tx) => {
    await tx.goal.deleteMany({ where: { ownerId: user.id } });

    for (const goal of state.goals) {
      const root = state.nodes.find((node) => node.id === goal.rootNodeId);
      await tx.goal.create({
        data: {
          id: goal.id,
          ownerId: user.id,
          title: goal.title,
          context: goal.context ?? "",
          stakeholders: goal.stakeholders ?? "",
          sortOrder: root?.sortOrder ?? 1,
        },
      });
    }

    const nodes = [...state.nodes].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
    for (const node of nodes) {
      await tx.node.create({
        data: {
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
        },
      });
    }

    for (const edge of state.successors) {
      await tx.successorEdge.create({
        data: {
          goalId: edge.goalId,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
