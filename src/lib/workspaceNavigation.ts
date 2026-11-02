export const workspaceNavigation = [
  { id: "dashboard", label: "Control Centre", items: [
    { label: "Control Centre", href: "/control-centre" },
  ] },
  { id: "money", label: "Money", items: [
    { label: "Bank accounts", href: "/accounts" },
    { label: "Transactions", href: "/transactions" },
    { label: "Cash flow", href: "/cash-flow" },
    { label: "Subscriptions", href: "/subscriptions" },
    { label: "Investments", href: "/investments" },
    { label: "Reports", href: "/reports" },
  ] },
  { id: "planning", label: "Planning", items: [
    { label: "Goals", href: "/goals" },
    { label: "Budgets", href: "/budgets" },
    { label: "Housing", href: "/housing-scenarios" },
    { label: "Financial scenarios", href: "/digital-twin" },
    { label: "Ownership structures", href: "/structure-optimiser" },
    { label: "Timeline", href: "/timeline" },
  ] },
  { id: "adviser", label: "AI adviser", items: [
    { label: "Ask your AI adviser", href: "/ai-cfo" },
    { label: "Insights", href: "/insights" },
    { label: "Action workflows", href: "/action-workflows" },
  ] },
  { id: "documents", label: "Documents", items: [
    { label: "Add financial data", href: "/financial-profile/add-data" },
    { label: "Document vault", href: "/financial-vault" },
  ] },
] as const;

export function selectedWorkspaceHref(pathname: string) {
  const path = pathname === "/" || pathname === "/balance-sheet" || (pathname.startsWith("/financial-profile") && !pathname.startsWith("/financial-profile/add-data")) ? "/control-centre" : pathname;
  return workspaceNavigation.flatMap(group => group.items.map(item => item.href))
    .filter(href => path === href || path.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
