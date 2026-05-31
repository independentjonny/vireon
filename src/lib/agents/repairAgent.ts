export async function repairAgent(task: string) {
  return {
    agent: "repair-agent",
    status: "standby",
    task,
    capabilities: [
      "Build failure repair",
      "Route repair",
      "TypeScript repair",
      "Tailwind repair",
      "Semantic patch generation",
    ],
  };
}
