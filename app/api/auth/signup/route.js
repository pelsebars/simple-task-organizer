import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSession } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!normalizedEmail || String(password ?? "").length < 8) {
      return NextResponse.json({ error: "Email and password of at least 8 characters are required." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });

    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error("Signup failed", error);
    return NextResponse.json({ error: "Signup failed on the server." }, { status: 500 });
  }
}
