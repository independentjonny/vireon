import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { buildFinancialHealthSnapshot } from "@/lib/financialHealthEngine";

export const MANUAL_PLATFORM_VERSION = "manual-financial-data-platform-v1";
export type IngestionSource = "MANUAL" | "CSV" | "OFX" | "QIF" | "QFX" | "PDF_BANK_STATEMENT" | "PDF_PAYSLIP" | "PDF_MORTGAGE" | "PDF_SUPER" | "PDF_TAX" | "OPEN_BANKING_RESERVED";
export type IngestionStatus = "RECEIVED" | "PROCESSING" | "NEEDS_REVIEW" | "CONFIRMED" | "PARTIALLY_ACCEPTED" | "REJECTED" | "FAILED" | "ARCHIVED";
export type ConfirmationStatus = "UNREVIEWED" | "CONFIRMED" | "REJECTED";
export type FinancialRecordKind = "account" | "asset" | "liability" | "income" | "expense" | "household" | "goal" | "transaction" | "document";

export type Provenance = { ingestionId: string; sourceField: string; confidence: number; userConfirmed: boolean; sourceType: IngestionSource };
export type IngestionRecord = {
  id: string; userId: string; sourceType: IngestionSource; originalFileName: string | null; mimeType: string | null; fileHash: string | null;
  receivedAt: string; parserVersion: string; status: IngestionStatus; detectedDocumentType: string | null; extractionConfidence: number | null;
  sourcePeriodStart: string | null; sourcePeriodEnd: string | null; errors: string[]; warnings: string[]; metadata: Record<string, unknown>;
  createdAt: string; updatedAt: string;
};
export type CandidateField = { id: string; ingestionId: string; field: string; value: unknown; confidence: number; sourceReference: string; status: ConfirmationStatus; editedValue?: unknown };
export type CanonicalFinancialRecord = {
  id: string; userId: string; kind: FinancialRecordKind; subtype: string; label: string; value: Record<string, unknown>; provenance: Provenance;
  createdAt: string; updatedAt: string; superseded: boolean; approximate: boolean; history: Array<{ at: string; action: string; before: unknown; after: unknown }>;
};
export type AuditEntry = { id: string; userId: string; at: string; action: string; entityType: string; entityId: string; detail: string };
export type ImportPreview = { ingestionId: string; headers: string[]; rows: Array<Record<string, string>>; delimiter: string; dateFormat: string | null; mapping: Record<string, string>; rejectedRows: Array<{ row: number; reason: string }>; duplicateCount: number; overlapWarning: string | null };

const now = () => new Date().toISOString();
const sha256 = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const safeName = (value: string) => basename(value).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document";
const ownershipKey = (userId: string, id: string) => `${userId}:${id}`;

export interface IngestionConnector {
  identify(input: { fileName: string; mimeType: string; bytes: Uint8Array }): IngestionSource;
  validate(input: { fileName: string; mimeType: string; bytes: Uint8Array }): string[];
  ingest(input: { userId: string; fileName: string; mimeType: string; bytes: Uint8Array }): unknown;
  normalise(value: unknown): unknown;
  returnProvenance(): { parserVersion: string; sourceType: IngestionSource };
  healthCheck(): { ok: boolean; detail: string };
}

export class ReservedOpenBankingConnector implements IngestionConnector {
  identify() { return "OPEN_BANKING_RESERVED" as const; }
  validate() { return ["Open Banking is inactive and optional for Manual Financial Data Platform v1."]; }
  ingest() { throw new Error("OPEN_BANKING_INACTIVE"); }
  normalise(value: unknown) { return value; }
  returnProvenance() { return { parserVersion: "reserved-v1", sourceType: "OPEN_BANKING_RESERVED" as const }; }
  healthCheck() { return { ok: false, detail: "Inactive reserved connector; no credentials or provider logic configured." }; }
}

export class PrivateFileStore {
  private readonly root: string;
  private readonly owners = new Map<string, { userId: string; hash: string; name: string }>();
  readonly audit: AuditEntry[] = [];
  constructor(root = join(process.cwd(), ".vireon", "private-financial-files")) { this.root = root; mkdirSync(root, { recursive: true }); }
  save(input: { userId: string; fileName: string; mimeType: string; bytes: Uint8Array; allowedMimeTypes: string[]; maxBytes?: number }) {
    if (!input.userId) throw new Error("AUTH_REQUIRED");
    if (!input.allowedMimeTypes.includes(input.mimeType)) throw new Error("INVALID_MIME");
    if (input.bytes.length === 0 || input.bytes.length > (input.maxBytes ?? 10 * 1024 * 1024)) throw new Error("INVALID_FILE_SIZE");
    const hash = sha256(input.bytes);
    const duplicate = [...this.owners.entries()].find(([, value]) => value.userId === input.userId && value.hash === hash);
    if (duplicate) return { id: duplicate[0], hash, duplicate: true, privateRef: duplicate[0] };
    const id = `file-${randomUUID()}`; const name = safeName(input.fileName); const path = join(this.root, `${id}-${name}`);
    writeFileSync(path, input.bytes); this.owners.set(id, { userId: input.userId, hash, name });
    this.audit.push({ id: randomUUID(), userId: input.userId, at: now(), action: "file.saved", entityType: "file", entityId: id, detail: `Stored ${name} in private storage.` });
    return { id, hash, duplicate: false, privateRef: id };
  }
  read(userId: string, id: string) { const owner = this.owners.get(id); if (!owner || owner.userId !== userId) throw new Error("FILE_NOT_AVAILABLE"); return readFileSync(join(this.root, `${id}-${owner.name}`)); }
  delete(userId: string, id: string) { const owner = this.owners.get(id); if (!owner || owner.userId !== userId) throw new Error("FILE_NOT_AVAILABLE"); const path = join(this.root, `${id}-${owner.name}`); if (existsSync(path)) unlinkSync(path); this.owners.delete(id); this.audit.push({ id: randomUUID(), userId, at: now(), action: "file.deleted", entityType: "file", entityId: id, detail: "Private financial file deleted." }); }
}

function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quote = false;
  for (let i = 0; i < input.length; i++) { const char = input[i]; if (char === '"') { if (quote && input[i + 1] === '"') { cell += '"'; i++; } else quote = !quote; } else if (char === delimiter && !quote) { row.push(cell.trim()); cell = ""; } else if (/\r|\n/.test(char) && !quote) { if (char === "\r" && input[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; } else cell += char; }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); return rows;
}
const detectDelimiter = (text: string) => [",", ";", "\t"].sort((a, b) => (text.split("\n")[0].split(b).length - text.split("\n")[0].split(a).length))[0];
const detectDateFormat = (values: string[]) => values.some(v => /^\d{2}\/\d{2}\/\d{4}$/.test(v)) ? "DD/MM/YYYY" : values.some(v => /^\d{4}-\d{2}-\d{2}$/.test(v)) ? "YYYY-MM-DD" : null;
const parseAmount = (value: string) => { const number = Number(value.replace(/[,$\s]/g, "").replace(/^\((.*)\)$/, "-$1")); return Number.isFinite(number) ? number : null; };
const isoDate = (value: string, format: string | null) => { if (format === "DD/MM/YYYY") { const [d,m,y] = value.split("/"); return `${y}-${m}-${d}`; } return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; };

export function parseOfxQfx(text: string) {
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi)];
  return blocks.map((block, index) => { const value = (tag: string) => block[1].match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? ""; return { externalId: value("FITID") || `ofx-${index + 1}`, date: value("DTPOSTED").slice(0,8).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"), description: value("MEMO") || value("NAME"), amount: Number(value("TRNAMT")), direction: Number(value("TRNAMT")) < 0 ? "debit" : "credit" }; });
}
export function parseQif(text: string) { return text.replace(/^!Type:[^\r\n]+\r?\n/im, "").split(/\^\r?\n?/).map(block => block.trim()).filter(Boolean).map((block, index) => { const get = (prefix: string) => block.split(/\r?\n/).find(line => line.startsWith(prefix))?.slice(1) ?? ""; const rawDate = get("D"); const parts = rawDate.split(/[/'-]/); const date = parts.length === 3 ? `${parts[2].length === 2 ? `20${parts[2]}` : parts[2]}-${parts[1].padStart(2,"0")}-${parts[0].padStart(2,"0")}` : ""; const amount = Number(get("T").replace(/,/g,"")); return { externalId: get("N") || `qif-${index + 1}`, date, description: get("P") || get("M"), amount, direction: amount < 0 ? "debit" : "credit" }; }); }

export class ManualFinancialDataPlatform {
  readonly ingestions = new Map<string, IngestionRecord>(); readonly candidates = new Map<string, CandidateField[]>(); readonly canonical = new Map<string, CanonicalFinancialRecord>(); readonly previews = new Map<string, ImportPreview>(); readonly audit: AuditEntry[] = []; readonly syncHashes = new Set<string>();
  snapshot() { return { version: MANUAL_PLATFORM_VERSION, ingestions: [...this.ingestions.entries()], candidates: [...this.candidates.entries()], canonical: [...this.canonical.entries()], previews: [...this.previews.entries()], audit: [...this.audit], syncHashes: [...this.syncHashes] }; }
  restore(value: ReturnType<ManualFinancialDataPlatform["snapshot"]>) { this.ingestions.clear(); this.candidates.clear(); this.canonical.clear(); this.previews.clear(); this.audit.splice(0); this.syncHashes.clear(); value.ingestions.forEach(([k,v])=>this.ingestions.set(k,v)); value.candidates.forEach(([k,v])=>this.candidates.set(k,v)); value.canonical.forEach(([k,v])=>this.canonical.set(k,v)); value.previews.forEach(([k,v])=>this.previews.set(k,v)); this.audit.push(...value.audit); value.syncHashes.forEach(v=>this.syncHashes.add(v)); return this; }
  createIngestion(input: { userId: string; sourceType: IngestionSource; fileName?: string; mimeType?: string; fileHash?: string; periodStart?: string; periodEnd?: string; metadata?: Record<string, unknown> }) {
    if (!input.userId) throw new Error("AUTH_REQUIRED"); const at = now(); const id = `ingestion-${randomUUID()}`;
    const record: IngestionRecord = { id, userId: input.userId, sourceType: input.sourceType, originalFileName: input.fileName ? safeName(input.fileName) : null, mimeType: input.mimeType ?? null, fileHash: input.fileHash ?? null, receivedAt: at, parserVersion: MANUAL_PLATFORM_VERSION, status: "RECEIVED", detectedDocumentType: null, extractionConfidence: null, sourcePeriodStart: input.periodStart ?? null, sourcePeriodEnd: input.periodEnd ?? null, errors: [], warnings: [], metadata: input.metadata ?? {}, createdAt: at, updatedAt: at };
    const duplicate = [...this.ingestions.values()].find(item => item.userId === input.userId && input.fileHash && item.fileHash === input.fileHash); if (duplicate) record.warnings.push(`Duplicate of ${duplicate.id}`);
    this.ingestions.set(id, record); this.log(input.userId, "ingestion.created", "ingestion", id, input.sourceType); return record;
  }
  previewCsv(userId: string, ingestionId: string, text: string, mapping: Record<string,string> = {}) {
    const ingestion = this.ownedIngestion(userId, ingestionId); const delimiter = detectDelimiter(text); const matrix = parseDelimited(text.replace(/^\uFEFF/, ""), delimiter); if (matrix.length < 2) throw new Error("MALFORMED_CSV");
    const headers = matrix[0]; const rows = matrix.slice(1).map(row => Object.fromEntries(headers.map((header,index) => [header,row[index] ?? ""]))); const dateColumn = Object.keys(mapping).find(key => mapping[key] === "date") ?? headers.find(h => /date/i.test(h)); const dateFormat = dateColumn ? detectDateFormat(rows.map(row => row[dateColumn])) : null;
    const seen = new Set<string>(); const rejectedRows: ImportPreview["rejectedRows"] = []; let duplicateCount = 0;
    rows.forEach((row,index) => { const key = sha256(JSON.stringify(row)); if (seen.has(key)) duplicateCount++; seen.add(key); if (Object.values(row).every(value => !value)) rejectedRows.push({ row:index+2, reason:"Empty row" }); });
    const overlap = [...this.ingestions.values()].find(item => item.userId === userId && item.id !== ingestionId && item.sourcePeriodStart && ingestion.sourcePeriodStart && item.sourcePeriodStart <= (ingestion.sourcePeriodEnd ?? "9999") && (item.sourcePeriodEnd ?? "9999") >= ingestion.sourcePeriodStart);
    const preview = { ingestionId, headers, rows: rows.slice(0,100), delimiter, dateFormat, mapping, rejectedRows, duplicateCount, overlapWarning: overlap ? `Period overlaps ${overlap.id}` : null }; this.previews.set(ingestionId, preview); this.ingestions.set(ingestionId,{...ingestion,status:"NEEDS_REVIEW",updatedAt:now(),warnings:[...ingestion.warnings,...(preview.overlapWarning?[preview.overlapWarning]:[])]}); return preview;
  }
  stageTransactions(userId: string, ingestionId: string, mapping: Record<string,string>) {
    const ingestion = this.ownedIngestion(userId, ingestionId); const preview = this.previews.get(ingestionId); if (!preview) throw new Error("PREVIEW_REQUIRED"); const source = (field:string) => Object.keys(mapping).find(key => mapping[key]===field); const dateKey=source("date"), descKey=source("description"), amountKey=source("amount"), debitKey=source("debit"), creditKey=source("credit"); if(!dateKey||!descKey||(!amountKey&&!debitKey&&!creditKey)) throw new Error("INVALID_MAPPING");
    const candidates: CandidateField[] = []; preview.rows.forEach((row,index) => { const debit=debitKey?parseAmount(row[debitKey]):null, credit=creditKey?parseAmount(row[creditKey]):null, signed=amountKey?parseAmount(row[amountKey]):null; const amount=signed ?? ((credit??0)-Math.abs(debit??0)); const date=isoDate(row[dateKey],preview.dateFormat); if(amount==null||!date) { preview.rejectedRows.push({row:index+2,reason:"Invalid date or amount"}); return; } candidates.push({id:`candidate-${randomUUID()}`,ingestionId,field:"transaction",value:{date,description:row[descKey],amount,direction:amount<0?"debit":"credit"},confidence:0.95,sourceReference:`row:${index+2}`,status:"UNREVIEWED"}); }); this.candidates.set(ingestionId,candidates); this.ingestions.set(ingestionId,{...ingestion,status:"NEEDS_REVIEW",updatedAt:now()}); return candidates;
  }
  stageParsedTransactions(userId:string, ingestionId:string, transactions:Array<Record<string,unknown>>) { this.ownedIngestion(userId,ingestionId); const values=transactions.map((value,index)=>({id:`candidate-${randomUUID()}`,ingestionId,field:"transaction",value,confidence:0.94,sourceReference:`transaction:${index+1}`,status:"UNREVIEWED" as const})); this.candidates.set(ingestionId,values); return values; }
  review(userId:string, ingestionId:string, actions:Array<{candidateId:string; action:"accept"|"edit"|"reject"; value?:unknown}>) { const ingestion=this.ownedIngestion(userId,ingestionId); const fields=this.candidates.get(ingestionId)??[]; const actionMap=new Map(actions.map(item=>[item.candidateId,item])); const reviewed=fields.map(field=>{const action=actionMap.get(field.id); if(!action)return field; return {...field,status:action.action==="reject"?"REJECTED" as const:"CONFIRMED" as const,...(action.action==="edit"?{editedValue:action.value}:{})};}); this.candidates.set(ingestionId,reviewed); const accepted=reviewed.filter(item=>item.status==="CONFIRMED"); const rejected=reviewed.filter(item=>item.status==="REJECTED"); const status:IngestionStatus=accepted.length===reviewed.length?"CONFIRMED":accepted.length?"PARTIALLY_ACCEPTED":rejected.length===reviewed.length?"REJECTED":"NEEDS_REVIEW"; this.ingestions.set(ingestionId,{...ingestion,status,updatedAt:now()}); return {status,accepted:accepted.length,rejected:rejected.length}; }
  confirm(userId:string, ingestionId:string) { const ingestion=this.ownedIngestion(userId,ingestionId); const confirmed=(this.candidates.get(ingestionId)??[]).filter(item=>item.status==="CONFIRMED"); if(!confirmed.length) throw new Error("NO_CONFIRMED_FIELDS"); const existingKeys=new Set([...this.canonical.values()].filter(r=>r.userId===userId&&!r.superseded).map(r=>sha256(JSON.stringify([r.kind,r.value])))); const created:CanonicalFinancialRecord[]=[]; for(const field of confirmed){const value=(field.editedValue??field.value) as Record<string,unknown>; const kind=(field.field==="transaction"?"transaction":field.field) as FinancialRecordKind; const key=sha256(JSON.stringify([kind,value])); if(existingKeys.has(key))continue; const at=now(); const record={id:`record-${randomUUID()}`,userId,kind,subtype:String(value.subtype??field.field),label:String(value.label??value.description??field.field),value,provenance:{ingestionId,sourceField:field.sourceReference,confidence:field.confidence,userConfirmed:true,sourceType:ingestion.sourceType},createdAt:at,updatedAt:at,superseded:false,approximate:Boolean(value.approximate),history:[{at,action:"confirmed",before:null,after:value}]} satisfies CanonicalFinancialRecord; this.canonical.set(record.id,record);created.push(record);existingKeys.add(key);} this.log(userId,"ingestion.confirmed","ingestion",ingestionId,`${created.length} canonical records created`); return created; }
  rollback(userId:string,ingestionId:string){const ingestion=this.ownedIngestion(userId,ingestionId);if([...this.canonical.values()].some(r=>r.userId===userId&&r.provenance.ingestionId===ingestionId))throw new Error("CANNOT_ROLLBACK_CONFIRMED_IMPORT");this.candidates.delete(ingestionId);this.previews.delete(ingestionId);this.ingestions.set(ingestionId,{...ingestion,status:"ARCHIVED",updatedAt:now()});}
  manualRecord(userId:string,input:{kind:Exclude<FinancialRecordKind,"transaction"|"document">;subtype:string;label:string;value:Record<string,unknown>;approximate?:boolean}){const ingestion=this.createIngestion({userId,sourceType:"MANUAL",metadata:{kind:input.kind}});const candidate={id:`candidate-${randomUUID()}`,ingestionId:ingestion.id,field:input.kind,value:{...input.value,subtype:input.subtype,label:input.label,approximate:input.approximate},confidence:input.approximate?0.7:1,sourceReference:"manual-entry",status:"CONFIRMED" as const};this.candidates.set(ingestion.id,[candidate]);this.ingestions.set(ingestion.id,{...ingestion,status:"CONFIRMED"});return this.confirm(userId,ingestion.id)[0];}
  editRecord(userId:string,id:string,patch:Record<string,unknown>){const record=this.ownedRecord(userId,id);const at=now();const updated={...record,value:{...record.value,...patch},updatedAt:at,history:[...record.history,{at,action:"edited",before:record.value,after:{...record.value,...patch}}]};this.canonical.set(id,updated);return updated;}
  refreshStatus(userId:string,asOf=new Date()){return [...this.canonical.values()].filter(r=>r.userId===userId&&!r.superseded).map(record=>{const days=Math.floor((asOf.getTime()-new Date(record.updatedAt).getTime())/86400000);return {recordId:record.id,label:record.label,lastUpdatedAt:record.updatedAt,labelText:days===0?"updated today":days===1?"updated yesterday":`updated ${days} days ago`,stale:days>(record.kind==="transaction"?45:record.kind==="document"?365:180),action:record.kind==="transaction"?"append transaction period":"update manually or replace supporting statement"};});}
  syncDigitalTwin(userId:string){const records=[...this.canonical.values()].filter(r=>r.userId===userId&&!r.superseded&&r.provenance.userConfirmed);const source=records.map(r=>({id:r.id,updatedAt:r.updatedAt,value:r.value}));const hash=sha256(JSON.stringify(source));const idempotent=this.syncHashes.has(ownershipKey(userId,hash));this.syncHashes.add(ownershipKey(userId,hash));return {syncVersion:"manual-twin-sync-v1",effectiveDate:now(),sourceRecordIds:records.map(r=>r.id),warnings:records.length?[]:["No confirmed records"],unresolvedConflicts:[],calculationsAffected:["net-worth","cash-flow","debt","goals"],snapshotHash:hash,idempotent};}
  financialHealth(userId:string){return buildFinancialHealthSnapshot({userId,records:[...this.canonical.values()]});}
  decisions(userId:string){const records=[...this.canonical.values()].filter(r=>r.userId===userId&&!r.superseded&&r.provenance.userConfirmed);const byKind=(kind:FinancialRecordKind)=>records.filter(r=>r.kind===kind);const decisions=[] as Array<Record<string,unknown>>;const cash=byKind("account").reduce((sum,r)=>sum+Number(r.value.balance??0),0);const expenses=byKind("expense").reduce((sum,r)=>sum+Number(r.value.monthlyAmount??0),0);if(cash<expenses*3)decisions.push(this.decision("emergency-fund","Emergency fund below three-month target",{cash,expenses},records,"Build a three-month cash buffer."));const expensive=byKind("liability").find(r=>Number(r.value.interestRate??0)>10);if(expensive)decisions.push(this.decision("high-interest-debt","High-interest debt identified",{rate:expensive.value.interestRate},[expensive],"Review accelerated repayment options."));const stale=this.refreshStatus(userId).filter(r=>r.stale);if(stale.length)decisions.push(this.decision("stale-profile","Financial records need refreshing",{staleCount:stale.length},records,"Complete the profile refresh checklist."));if(!records.length)decisions.push(this.decision("missing-vault","Financial Vault missing critical information",{},[],"Add income, accounts and debts."));for(const action of this.financialHealth(userId).actions){decisions.push({id:`health-${action.id}`,title:action.title,triggeringData:{category:action.category,priority:action.priority},deterministicCalculation:{reason:action.reason,expectedImpact:action.expectedImpact},sourceProvenance:action.evidenceRecordIds,confidence:action.evidenceRecordIds.length?"High":"Low",recommendedNextAction:action.recommendedAction,reviewRequired:action.reviewRequired});}return decisions;}
  aiCfoContext(userId:string){const confirmed=[...this.canonical.values()].filter(r=>r.userId===userId&&!r.superseded&&r.provenance.userConfirmed);return {confirmedFacts:confirmed.map(r=>({id:r.id,kind:r.kind,label:r.label,value:r.value,source:r.provenance.sourceType,sourceReference:r.provenance.sourceField,confidence:r.provenance.confidence,updatedAt:r.updatedAt,stale:this.refreshStatus(userId).find(s=>s.recordId===r.id)?.stale??false})),unresolvedConflicts:[],excludedCandidates:[...this.candidates.values()].flat().filter(c=>c.status!=="CONFIRMED").map(c=>c.id),instruction:"Use only confirmedFacts. Cite record IDs. State staleness and estimates. Never invent missing balances or terms."};}
  listIngestions(userId:string){return [...this.ingestions.values()].filter(i=>i.userId===userId);}
  private ownedIngestion(userId:string,id:string){const value=this.ingestions.get(id);if(!value||value.userId!==userId)throw new Error("INGESTION_NOT_AVAILABLE");return value;}
  private ownedRecord(userId:string,id:string){const value=this.canonical.get(id);if(!value||value.userId!==userId)throw new Error("RECORD_NOT_AVAILABLE");return value;}
  private log(userId:string,action:string,entityType:string,entityId:string,detail:string){this.audit.push({id:randomUUID(),userId,at:now(),action,entityType,entityId,detail});}
  private decision(id:string,title:string,calculation:Record<string,unknown>,sources:CanonicalFinancialRecord[],action:string){return{id,title,triggeringData:calculation,deterministicCalculation:calculation,sourceProvenance:sources.map(r=>r.id),confidence:sources.length?"High":"Low",recommendedNextAction:action,reviewRequired:false};}
}
