"use client";
// Isolated checker entry point, never part of the production app router.
import { useEffect, useState } from "react";
import AppShell from "@/app/components/AppShell";
import BaselineDashboard from "@/app/components/BaselineDashboard";
import BaselineFinancialPosition from "@/app/components/BaselineFinancialPosition";
import ControlCentre from "@/app/components/ControlCentre";
import GoalsPlanningClient from "@/app/components/GoalsPlanningClient";
import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";
import type { FundingWorkspace } from "@/server/services/goalFundingPostgresService";


export default function ControlCentreFixture() {
  const [position, setPosition] = useState<FinancialPositionReadModel | null>(null);
  const [workspace, setWorkspace] = useState<FundingWorkspace | null>(null);
  useEffect(() => { fetch("/api/goals/funding").then(r => r.json()).then(data => { setWorkspace(data.workspace); setPosition(data.position); }); }, []);
  return <AppShell active="dashboard">{workspace && position ? <BaselineDashboard title="Control Centre" controlCentre={<ControlCentre initialWorkspace={workspace} />} financialPosition={<BaselineFinancialPosition position={position} embedded />} trajectory={null} netWorth={140000} assets={240000} liabilities={100000} monthlyChange={null} monthlySurplus={2000} monthlyIncome={5000} monthlyExpenses={3000} runwayMonths={null} goals={[]} assetGroups={[]} attention={[]} updatedAt="2026-11-03T01:00:00Z" dataNote="Synthetic checker records only." cashFlowBasis="Synthetic monthly recurring inputs." staleRecordIds={[]} records={position.confirmedFacts} /> : <p>Loading synthetic checker fixture…</p>}</AppShell>;
}

export function GoalsFixture() {
  return <AppShell active="workspace"><GoalsPlanningClient initialGoals={[]} initialScenarios={[]} initialTrajectory={null} initialRetirement={null} netWorth={null} openRetirement initialSnapshot={{ id: "checker", version: "goals-scenario-planning-v1", userId: "checker", generatedAt: "2026-11-03", forecastHash: "checker", activeGoals: [], archivedGoalIds: [], timelineEvents: [], decisions: [], aiCfoContext: { activeGoals: [], conflicts: [], scenarioComparisons: [], milestones: [], dataQualityWarnings: [], instruction: "Synthetic fixture" }, hash: "checker" }} /></AppShell>;
}
