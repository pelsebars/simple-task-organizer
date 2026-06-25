import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    });
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json(
      {
        ok: false,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        errorName: error?.name ?? "Error",
        errorCode: error?.code ?? null,
        message: sanitizeMessage(error?.message ?? "Unknown database error"),
      },
      { status: 500 },
    );
  }
}

function sanitizeMessage(message) {
  return message.replace(/postgresql:\/\/[^\s]+/g, "[DATABASE_URL]");
}
