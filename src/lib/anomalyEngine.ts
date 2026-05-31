export function detectAnomalies() {
  return [
    {
      id: "subscription-spike",
      title: "Subscription spend increasing",
      severity: "medium",
      explanation: "Recurring payments are trending higher than baseline.",
    },
    {
      id: "property-concentration",
      title: "Property concentration risk",
      severity: "medium",
      explanation: "Net worth remains heavily weighted toward property assets.",
    },
  ];
}
