import { collectTooling, REQUIRED_TOOLS } from "./postgres-pilot-checks.mjs";

const tooling = collectTooling();
const missing = REQUIRED_TOOLS.filter((tool) => !tooling[tool]?.available);

console.log(JSON.stringify({
  ok: missing.length === 0,
  tooling,
  missing,
  guidance: missing.length === 0
    ? "PostgreSQL client tooling is available. Server compatibility is checked by postgres:pilot:diagnose when database URLs are configured."
    : [
        "Install PostgreSQL client tools for Windows, or use a managed-provider shell that exposes psql, pg_dump and pg_restore.",
        "Windows option: install PostgreSQL from the official installer and include Command Line Tools, then add the bin directory to PATH.",
        "Docker option: install Docker Desktop and use a disposable PostgreSQL container, but Docker itself is not required when managed PostgreSQL is used.",
      ],
}, null, 2));

process.exit(missing.length === 0 ? 0 : 1);
