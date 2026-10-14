import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "polat_admin";

function secret() {
  return (process.env.ADMIN_SECRET || "") + "|" + (process.env.ADMIN_PIN || "");
}

export function makeToken() {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 Tage
  const sig = crypto.createHmac("sha256", secret()).update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

export function checkPin(pin) {
  const real = process.env.ADMIN_PIN;
  if (!real) return false;
  const a = Buffer.from(String(pin));
  const b = Buffer.from(real);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin() {
  const store = await cookies();
  const t = store.get(COOKIE)?.value;
  if (!t || !process.env.ADMIN_PIN) return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = crypto.createHmac("sha256", secret()).update(exp).digest("hex");
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export const COOKIE_NAME = COOKIE;
