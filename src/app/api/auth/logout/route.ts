export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append(
    "set-cookie",
    `vireon_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
  );
  return response;
}
