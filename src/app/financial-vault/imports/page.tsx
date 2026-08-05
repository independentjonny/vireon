import AppShell from "../../components/AppShell";
import ManualImportWorkspaceClient from "../../components/ManualImportWorkspaceClient";
export const dynamic="force-dynamic";
export default function ImportsPage(){return <AppShell active="financial-vault"><main className="mx-auto max-w-7xl space-y-5"><ManualImportWorkspaceClient/></main></AppShell>;}
