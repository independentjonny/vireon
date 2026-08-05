import { NextResponse } from "next/server";

export function developerOnly(request: Request) {
  const role = request.headers.get("x-vireon-role") ?? "developer";
  if (role !== "developer" && role !== "admin") {
    return NextResponse.json({ error: "Model evaluation is restricted to Developer Mode or approved administrators." }, { status: 403 });
  }
  return null;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
