import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request) {
  const { email, password } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const isValid = user ? await bcrypt.compare(String(password ?? ""), user.passwordHash) : false;

  if (!user || !isValid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
