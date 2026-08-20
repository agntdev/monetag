/** Durable application records stored in the platform D1 binding. */
export type TaskStatus = "open" | "accepted" | "closed";
export interface Task { id: string; title: string; description: string; rewardText: string; posterUserId: number; postedTimestamp: string; categoryTag?: string; status: TaskStatus; }
export interface Acceptance { id: string; acceptorUserId: number; timestamp: string; taskId: string; message: string; }
export interface UserProfile { telegramId: number; displayName: string; contactPreference: "telegram"; acceptedTasksCount: number; }
/** Legacy ads remain readable only so they can be archived during migration. */
export interface Ad { id: string; imageUrl?: string; text: string; linkUrl?: string; adminUserId: number; activeStart: string; activeEnd?: string; }
export type AdSource = "Monetag" | "AdsGram";
export interface ImportedAd { id: string; source: AdSource; sourceAdId: string; title: string; description: string; imageUrl?: string; destinationUrl: string; publishTime: string; expiry?: string; campaignId?: string; visible: boolean; priority: number; removed: boolean; importedAt: string; }
export interface AdAudit { id: string; adId: string; adminUserId: number; action: "visibility" | "priority" | "removed"; timestamp: string; detail: string; }

export interface D1Result<T = unknown> { results?: T[]; success?: boolean; meta?: { changes?: number }; }
export interface D1Statement { bind(...values: unknown[]): D1Statement; run(): Promise<D1Result>; all<T = unknown>(): Promise<D1Result<T>>; first<T = unknown>(): Promise<T | null>; }
export interface D1Database { prepare(query: string): D1Statement; batch?(statements: D1Statement[]): Promise<unknown>; }
type EnvCtx = object;

const schema = [
  "CREATE TABLE IF NOT EXISTS task_ads_records (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (kind, id))",
  "CREATE TABLE IF NOT EXISTS task_ads_indexes (name TEXT NOT NULL, position INTEGER NOT NULL, record_id TEXT NOT NULL, PRIMARY KEY (name, position))",
  "CREATE TABLE IF NOT EXISTS internal_archived_ads (id TEXT PRIMARY KEY, body TEXT NOT NULL, archived_at TEXT NOT NULL)",
];
let initialized = false;
let clock: () => Date = () => new Date();
/** A single injectable clock seam for every persisted timestamp and ad-window decision. */
export function now(): Date { return clock(); }
export function setNowForTests(value?: () => Date): void { clock = value ?? (() => new Date()); }
function iso(): string { return now().toISOString(); }
function db(ctx: EnvCtx): D1Database | undefined { return (ctx as { env?: { DB?: unknown } }).env?.DB as D1Database | undefined; }
async function ready(ctx: EnvCtx): Promise<D1Database | undefined> {
  const database = db(ctx); if (!database) return undefined;
  if (!initialized) { for (const sql of schema) await database.prepare(sql).run(); initialized = true; }
  return database;
}
function id(prefix: string): string { return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`; }
async function read<T>(database: D1Database, kind: string, recordId: string): Promise<T | undefined> { const row = await database.prepare("SELECT body FROM task_ads_records WHERE kind = ? AND id = ?").bind(kind, recordId).first<{ body: string }>(); return row ? JSON.parse(row.body) as T : undefined; }
async function put(database: D1Database, kind: string, recordId: string, value: unknown): Promise<void> { await database.prepare("INSERT OR REPLACE INTO task_ads_records (kind, id, body) VALUES (?, ?, ?)").bind(kind, recordId, JSON.stringify(value)).run(); }
async function append(database: D1Database, name: string, recordId: string): Promise<void> { const row = await database.prepare("SELECT COALESCE(MAX(position), -1) AS max_position FROM task_ads_indexes WHERE name = ?").bind(name).first<{ max_position: number }>(); await database.prepare("INSERT INTO task_ads_indexes (name, position, record_id) VALUES (?, ?, ?)").bind(name, (row?.max_position ?? -1) + 1, recordId).run(); }
async function list<T>(database: D1Database, name: string): Promise<T[]> { const rows = (await database.prepare("SELECT r.body FROM task_ads_indexes i JOIN task_ads_records r ON r.id = i.record_id WHERE i.name = ? ORDER BY i.position DESC").bind(name).all<{ body: string }>()).results ?? []; return rows.map((row) => JSON.parse(row.body) as T); }
function importedKey(source: AdSource, sourceAdId: string): string { return `${source}:${encodeURIComponent(sourceAdId)}`; }

export async function createTask(ctx: EnvCtx, input: Omit<Task, "id" | "postedTimestamp" | "status">): Promise<Task | undefined> { const database = await ready(ctx); if (!database) return undefined; const task: Task = { ...input, id: id("task"), postedTimestamp: iso(), status: "open" }; await put(database, "task", task.id, task); await append(database, "tasks", task.id); return task; }
export async function getTask(ctx: EnvCtx, taskId: string): Promise<Task | undefined> { const database = await ready(ctx); return database ? read<Task>(database, "task", taskId) : undefined; }
export async function listTasks(ctx: EnvCtx): Promise<Task[] | undefined> { const database = await ready(ctx); return database ? list<Task>(database, "tasks") : undefined; }
export async function acceptTask(ctx: EnvCtx, taskId: string, acceptorUserId: number): Promise<{ task?: Task; accepted: boolean; unavailable: boolean }> { const database = await ready(ctx); if (!database) return { accepted: false, unavailable: true }; const current = await read<Task>(database, "task", taskId); if (!current || current.status !== "open") return { task: current, accepted: false, unavailable: false }; const updated: Task = { ...current, status: "accepted" }; const result = await database.prepare("UPDATE task_ads_records SET body = ? WHERE kind = 'task' AND id = ? AND body = ?").bind(JSON.stringify(updated), taskId, JSON.stringify(current)).run(); if (!result.success) return { task: await read<Task>(database, "task", taskId), accepted: false, unavailable: false }; const acceptance: Acceptance = { id: id("accept"), acceptorUserId, timestamp: iso(), taskId, message: "Accepted through Earn Daily." }; await put(database, "acceptance", acceptance.id, acceptance); await append(database, `acceptances:${acceptorUserId}`, acceptance.id); return { task: updated, accepted: true, unavailable: false }; }
export async function forceCloseTask(ctx: EnvCtx, taskId: string): Promise<Task | undefined> { const database = await ready(ctx); if (!database) return undefined; const task = await read<Task>(database, "task", taskId); if (!task) return undefined; const closed = { ...task, status: "closed" as const }; await put(database, "task", taskId, closed); return closed; }
export async function profile(ctx: EnvCtx, userId: number, displayName: string): Promise<UserProfile | undefined> { const database = await ready(ctx); if (!database) return undefined; const history = await list<Acceptance>(database, `acceptances:${userId}`); const existing = await read<UserProfile>(database, "user", String(userId)); const value: UserProfile = { telegramId: userId, displayName: existing?.displayName ?? displayName, contactPreference: "telegram", acceptedTasksCount: history.length }; await put(database, "user", String(userId), value); return value; }
export async function acceptanceHistory(ctx: EnvCtx, userId: number): Promise<Acceptance[] | undefined> { const database = await ready(ctx); return database ? list<Acceptance>(database, `acceptances:${userId}`) : undefined; }

/** One-time, idempotent migration: legacy manual ads are kept out of the new feed. */
export async function archiveLegacyAds(ctx: EnvCtx): Promise<void> { const database = await ready(ctx); if (!database) return; const marker = await read<boolean>(database, "migration", "legacy_ads_v1"); if (marker) return; for (const ad of await list<Ad>(database, "ads")) await database.prepare("INSERT OR IGNORE INTO internal_archived_ads (id, body, archived_at) VALUES (?, ?, ?)").bind(ad.id, JSON.stringify(ad), iso()).run(); await put(database, "migration", "legacy_ads_v1", true); }
export async function upsertImportedAd(ctx: EnvCtx, input: Omit<ImportedAd, "id" | "visible" | "priority" | "removed" | "importedAt">): Promise<ImportedAd | undefined> { const database = await ready(ctx); if (!database) return undefined; const recordId = importedKey(input.source, input.sourceAdId); const existing = await read<ImportedAd>(database, "imported_ad", recordId); const ad: ImportedAd = { ...input, id: recordId, visible: existing?.visible ?? true, priority: existing?.priority ?? 0, removed: existing?.removed ?? false, importedAt: iso() }; await put(database, "imported_ad", recordId, ad); if (!existing) await append(database, "imported_ads", recordId); return ad; }
export async function listImportedAds(ctx: EnvCtx, includeHidden = false): Promise<ImportedAd[] | undefined> { const database = await ready(ctx); if (!database) return undefined; const at = iso(); return (await list<ImportedAd>(database, "imported_ads")).filter((ad) => includeHidden || (ad.visible && !ad.removed && ad.publishTime <= at && (!ad.expiry || ad.expiry > at))).sort((a, b) => b.priority - a.priority || b.publishTime.localeCompare(a.publishTime)); }
export async function getImportedAd(ctx: EnvCtx, adId: string): Promise<ImportedAd | undefined> { const database = await ready(ctx); return database ? read<ImportedAd>(database, "imported_ad", adId) : undefined; }
export async function updateImportedAd(ctx: EnvCtx, adId: string, adminUserId: number, action: AdAudit["action"], detail: string): Promise<ImportedAd | undefined> { const database = await ready(ctx); if (!database) return undefined; const ad = await read<ImportedAd>(database, "imported_ad", adId); if (!ad) return undefined; const updated: ImportedAd = action === "visibility" ? { ...ad, visible: !ad.visible } : action === "priority" ? { ...ad, priority: ad.priority + 1 } : { ...ad, removed: true, visible: false }; await put(database, "imported_ad", adId, updated); const audit: AdAudit = { id: id("audit"), adId, adminUserId, action, detail, timestamp: iso() }; await put(database, "ad_audit", audit.id, audit); await append(database, `ad_audits:${adId}`, audit.id); return updated; }
export async function lastAdSync(ctx: EnvCtx, source: AdSource): Promise<string | undefined> { const database = await ready(ctx); return database ? read<string>(database, "ad_sync", source) : undefined; }
export async function markAdSync(ctx: EnvCtx, source: AdSource): Promise<void> { const database = await ready(ctx); if (database) await put(database, "ad_sync", source, iso()); }
