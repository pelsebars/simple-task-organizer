import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goalId = request.nextUrl.searchParams.get("goalId");
  if (!goalId) return NextResponse.json({ error: "Goal ID is required." }, { status: 400 });

  const checkpoint = await prisma.updateCheckpoint.findUnique({
    where: { userId_goalId: { userId: user.id, goalId } },
  });
  const changes = await prisma.changeEvent.findMany({
    where: {
      userId: user.id,
      goalId,
      ...(checkpoint ? { createdAt: { gt: checkpoint.sharedAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ changes, since: checkpoint?.sharedAt ?? null });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await request.json();
  if (!goalId) return NextResponse.json({ error: "Goal ID is required." }, { status: 400 });

  const ownsGoal = await prisma.goal.count({ where: { id: goalId, ownerId: user.id } });
  if (!ownsGoal) return NextResponse.json({ error: "Goal not found." }, { status: 404 });

  const sharedAt = new Date();
  await prisma.updateCheckpoint.upsert({
    where: { userId_goalId: { userId: user.id, goalId } },
    update: { sharedAt },
    create: { userId: user.id, goalId, sharedAt },
  });

  return NextResponse.json({ ok: true, sharedAt });
}
