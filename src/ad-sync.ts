import { archiveLegacyAds, lastAdSync, markAdSync, now, upsertImportedAd, type AdSource, type ImportedAd } from "./data.js";

type SyncCtx = object;
type Network = { source: AdSource; endpointKey: "MONETAG_ADS_ENDPOINT" | "ADSGRAM_ADS_ENDPOINT"; apiKeyKey: "MONETAG_API_KEY" | "ADSGRAM_API_KEY" };
const networks: Network[] = [
  { source: "Monetag", endpointKey: "MONETAG_ADS_ENDPOINT", apiKeyKey: "MONETAG_API_KEY" },
  { source: "AdsGram", endpointKey: "ADSGRAM_ADS_ENDPOINT", apiKeyKey: "ADSGRAM_API_KEY" },
];
function setting(ctx: SyncCtx, key: string): string | undefined { const env = (ctx as { env?: Record<string, unknown> }).env; const value = env?.[key] ?? (typeof process === "undefined" ? undefined : process.env[key]); return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function asString(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function pick(row: Record<string, unknown>, ...keys: string[]): string | undefined { for (const key of keys) { const value = asString(row[key]); if (value) return value; } return undefined; }
function asIso(value: string | undefined, fallback: string): string { if (!value) return fallback; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? fallback : parsed.toISOString(); }
function jsonRows(payload: unknown): Record<string, unknown>[] { if (Array.isArray(payload)) return payload.filter((row): row is Record<string, unknown> => !!row && typeof row === "object"); if (!payload || typeof payload !== "object") return []; const root = payload as Record<string, unknown>; for (const key of ["ads", "data", "items", "campaigns", "results"]) if (Array.isArray(root[key])) return root[key].filter((row): row is Record<string, unknown> => !!row && typeof row === "object"); return []; }
function rssRows(xml: string): Record<string, unknown>[] { return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match, index) => { const item = match[0]; const tag = (name: string) => item.match(new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${name}>`, "i"))?.[1]?.trim(); return { id: tag("guid") ?? tag("id") ?? String(index), title: tag("title"), description: tag("description"), url: tag("link"), image_url: tag("image") ?? item.match(/<enclosure[^>]+url=["']([^"']+)/i)?.[1], publish_time: tag("pubDate") }; }); }
function normalize(source: AdSource, row: Record<string, unknown>): Omit<ImportedAd, "id" | "visible" | "priority" | "removed" | "importedAt"> | undefined { const sourceAdId = pick(row, "source_ad_id", "ad_id", "id", "uuid"); const title = pick(row, "title", "name", "headline"); const destinationUrl = pick(row, "destination_url", "destinationUrl", "click_url", "clickUrl", "url", "link"); if (!sourceAdId || !title || !destinationUrl || !/^https:\/\//i.test(destinationUrl)) return undefined; const publish = now().toISOString(); return { source, sourceAdId, title, description: pick(row, "description", "text", "body", "short_description") ?? "", imageUrl: pick(row, "image_url", "imageUrl", "image", "thumbnail_url"), destinationUrl, publishTime: asIso(pick(row, "publish_time", "published_at", "start_time", "created_at"), publish), expiry: (() => { const value = pick(row, "expiry", "expires_at", "end_time"); return value ? asIso(value, publish) : undefined; })(), campaignId: pick(row, "campaign_id", "campaignId", "campaign") }; }
export type SyncResult = { imported: number; skipped: boolean; errors: number };
/** Fetches configured HTTPS API or RSS feeds. Missing configuration is a harmless no-op. */
export async function syncImportedAds(ctx: SyncCtx, force = false): Promise<SyncResult> {
  await archiveLegacyAds(ctx);
  const interval = Math.max(1, Number(setting(ctx, "ADS_SYNC_INTERVAL_MINUTES") ?? "60") || 60) * 60_000;
  let imported = 0; let errors = 0; let attempted = false;
  for (const network of networks) {
    const endpoint = setting(ctx, network.endpointKey); if (!endpoint || !/^https:\/\//i.test(endpoint)) continue;
    // A user refresh can bypass the normal hourly cadence, but never hammers a partner feed.
    const minimumGap = force ? 60_000 : interval;
    const previous = await lastAdSync(ctx, network.source); if (previous && now().valueOf() - new Date(previous).valueOf() < minimumGap) continue;
    attempted = true;
    try {
      const apiKey = setting(ctx, network.apiKeyKey);
      const response = await fetch(endpoint, { headers: apiKey ? { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey, Accept: "application/json, application/rss+xml, application/xml" } : { Accept: "application/json, application/rss+xml, application/xml" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.text();
      const rows = /^\s*</.test(body) ? rssRows(body) : jsonRows(JSON.parse(body));
      for (const row of rows) if (normalize(network.source, row) && await upsertImportedAd(ctx, normalize(network.source, row)!)) imported += 1;
      await markAdSync(ctx, network.source);
    } catch (error) { errors += 1; console.error(`Earn Daily ${network.source} ad import failed`, error instanceof Error ? error.message : "unknown error"); }
  }
  return { imported, errors, skipped: !attempted };
}
