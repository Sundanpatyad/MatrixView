import { NextResponse } from "next/server";
import { INQUIRY_TO_EMAIL } from "@/lib/site";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const organization = String(body.organization ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Please write a slightly longer message." }, { status: 400 });
  }

  const payload = {
    name,
    email,
    organization: organization || "(not provided)",
    message,
    _subject: `DockX inquiry from ${name}`,
    _template: "table",
    _captcha: "false",
    _replyto: email,
  };

  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(INQUIRY_TO_EMAIL)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("inquiry delivery failed", res.status, text);
    return NextResponse.json(
      { error: "Could not deliver the inquiry. Try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
