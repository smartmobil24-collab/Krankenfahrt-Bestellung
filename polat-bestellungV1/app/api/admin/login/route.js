import { NextResponse } from "next/server";
import { checkPin, makeToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req) {
  const { pin } = await req.json().catch(() => ({}));
  if (!checkPin(pin || "")) {
    await new Promise((r) => setTimeout(r, 800)); // Bremse gegen Durchprobieren
    return NextResponse.json({ error: "Falsche PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
