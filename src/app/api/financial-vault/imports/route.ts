import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import type { FinancialRecordKind, IngestionSource } from "@/lib/manualFinancialDataPlatform";
import { createFinancialVaultServiceFromEnv, toFinancialVaultSafeError } from "@/server/services/financialVaultPostgresService";
import { randomUUID } from "crypto";

function correlationId(request: Request) {
  return request.headers.get("x-correlation-id") ?? randomUUID();
}

function idempotencyKey(request: Request, body: Record<string, unknown>) {
  return request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined);
}

function ownershipForged(body: Record<string, unknown>, userId: string, workspaceId: string): boolean {
  return (typeof body.userId === "string" && body.userId !== userId) || (typeof body.workspaceId === "string" && body.workspaceId !== workspaceId);
}

export async function GET(request:Request){
  const auth=await requireSession(request);
  if(!auth.ok)return authErrorResponse(auth);
  const current=auth.session;
  try {
    const service=createFinancialVaultServiceFromEnv();
    return Response.json({ok:true,...await service.getImports(current, correlationId(request))});
  } catch(error) {
    const safe=toFinancialVaultSafeError(error);
    return Response.json({ok:false,error:safe.message,code:safe.code,retryable:safe.retryable},{status:safe.status});
  }
}

export async function POST(request:Request){
  const auth=await requireSession(request);
  if(!auth.ok)return authErrorResponse(auth);
  const current=auth.session;
  try{
    const service=createFinancialVaultServiceFromEnv();
    const body=await request.json() as Record<string,unknown>;
    if (ownershipForged(body, current.userId, current.workspaceId)) {
      return Response.json({ok:false,error:"Client-supplied ownership does not match the authenticated session."},{status:403});
    }
    const action=String(body.action??"");
    const requestId=correlationId(request);
    let result: unknown;
    if(action==="create-import")result=await service.createImport(current,{sourceType:String(body.sourceType) as IngestionSource,fileName:String(body.fileName??"import.csv"),mimeType:String(body.mimeType??"text/csv"),text:String(body.text??""),periodStart:body.periodStart?String(body.periodStart):undefined,periodEnd:body.periodEnd?String(body.periodEnd):undefined,idempotencyKey:idempotencyKey(request,body)},requestId);
    else if(action==="preview-csv")result=await service.previewCsv(current,String(body.ingestionId),String(body.text??""),(body.mapping??{}) as Record<string,string>,requestId);
    else if(action==="stage-csv")result=await service.stageCsv(current,String(body.ingestionId),(body.mapping??{}) as Record<string,string>,requestId);
    else if(action==="review")result=await service.reviewImport(current,String(body.ingestionId),(body.actions??[]) as Array<{candidateId:string;action:"accept"|"edit"|"reject";value?:unknown}>,requestId);
    else if(action==="confirm")result=await service.confirmImport(current,String(body.ingestionId),requestId);
    else if(action==="rollback")result=await service.rollbackImport(current,String(body.ingestionId),requestId);
    else if(action==="manual")result=await service.manualRecord(current,{kind:String(body.kind) as Exclude<FinancialRecordKind,"transaction"|"document">,subtype:String(body.subtype),label:String(body.label),value:(body.value??{}) as Record<string,unknown>,approximate:Boolean(body.approximate),idempotencyKey:idempotencyKey(request,body)},requestId);
    else throw new Error("UNKNOWN_ACTION");
    return Response.json({ok:true,result});
  }catch(error){
    const safe=toFinancialVaultSafeError(error);
    return Response.json({ok:false,error:safe.message,code:safe.code,retryable:safe.retryable},{status:safe.status});
  }
}
