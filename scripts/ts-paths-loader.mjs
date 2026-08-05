import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const extensions = ["", ".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];

function resolveAlias(specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }

  const relativePath = specifier.slice(2);
  const basePath = path.resolve(root, "src", relativePath);
  const candidates = extensions.flatMap((extension) => [
    `${basePath}${extension}`,
    path.join(basePath, `index${extension}`),
  ]);

  const match = candidates.find((candidate) => existsSync(candidate));
  return match ? pathToFileURL(match).href : null;
}

export async function resolve(specifier, context, defaultResolve) {
  const aliasUrl = resolveAlias(specifier);
  if (aliasUrl) {
    return {
      shortCircuit: true,
      url: aliasUrl,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}
