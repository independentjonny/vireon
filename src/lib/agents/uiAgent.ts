export async function uiAgent(task: string) {
  return {
    agent: "ui-agent",
    status: "complete",
    task,
    actions: [
      "Analysed dashboard layout",
      "Validated spacing system",
      "Validated Tailwind structure",
      "Validated responsive containers",
    ],
  };
}
