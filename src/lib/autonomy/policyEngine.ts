export function commandPolicy() {
  return {
    autoApproved: [
      "npm run build",
      "npm run dev",
      "npm test",
      "git status",
      "git diff",
    ],
    blocked: [
      "git reset --hard",
      "git clean",
      "del",
      "rmdir",
      "format",
      ".env access",
    ],
  };
}
