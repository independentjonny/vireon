import { handlePasswordRecovery } from "@/lib/auth/passwordRecovery";
export async function POST(request: Request) { return handlePasswordRecovery(request, "update"); }
