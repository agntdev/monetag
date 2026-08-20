import { afterEach, describe, expect, it, vi } from "vitest";
import { listImportedAds } from "../src/data.js";
import { syncImportedAds } from "../src/ad-sync.js";

class FakeStatement {
  values: unknown[] = [];
  constructor(private readonly db: FakeD1, private readonly sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async run() {
    if (this.sql.startsWith("INSERT OR REPLACE INTO task_ads_records")) this.db.records.set(`${this.values[0]}:${this.values[1]}`, String(this.values[2]));
    else if (this.sql.startsWith("INSERT INTO task_ads_indexes")) this.db.indexes.push({ name: String(this.values[0]), position: Number(this.values[1]), id: String(this.values[2]) });
    return { success: true };
  }
  async first<T>() {
    if (this.sql.startsWith("SELECT body FROM task_ads_records")) { const body = this.db.records.get(`${this.values[0]}:${this.values[1]}`); return (body ? { body } : null) as T | null; }
    if (this.sql.startsWith("SELECT COALESCE(MAX(position)")) { const max = this.db.indexes.filter((row) => row.name === this.values[0]).reduce((value, row) => Math.max(value, row.position), -1); return { max_position: max } as T; }
    return null;
  }
  async all<T>() {
    if (this.sql.includes("JOIN task_ads_records")) { const rows = this.db.indexes.filter((row) => row.name === this.values[0]).sort((a, b) => b.position - a.position).map((row) => ({ body: this.db.records.get(`imported_ad:${row.id}`) ?? this.db.records.get(`ad:${row.id}`) ?? this.db.records.get(`acceptance:${row.id}`) ?? "" })).filter((row) => row.body); return { results: rows as T[] }; }
    return { results: [] as T[] };
  }
}
class FakeD1 { records = new Map<string, string>(); indexes: Array<{ name: string; position: number; id: string }> = []; prepare(sql: string) { return new FakeStatement(this, sql); } }

describe("network ad imports", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

  it("imports Monetag and AdsGram feeds and deduplicates source ad IDs", async () => {
    const db = new FakeD1();
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => new Response(String(url).includes("monetag") ? JSON.stringify({ ads: [{ id: "same-id", title: "Monetag offer", description: "Short offer", image_url: "https://img.example/m.png", destination_url: "https://offer.example/m" }] }) : "<rss><channel><item><guid>same-id</guid><title>AdsGram offer</title><description>Short offer</description><link>https://offer.example/a</link></item></channel></rss>", { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const ctx = { env: { DB: db, MONETAG_ADS_ENDPOINT: "https://monetag.example/feed", ADSGRAM_ADS_ENDPOINT: "https://adsgram.example/feed", ADS_SYNC_INTERVAL_MINUTES: "60" } };

    await syncImportedAds(ctx, true);
    await syncImportedAds(ctx, true);
    const ads = await listImportedAds(ctx);

    expect(ads).toHaveLength(2);
    expect(ads?.map((ad) => ad.source).sort()).toEqual(["AdsGram", "Monetag"]);
    expect(ads?.every((ad) => ad.destinationUrl.startsWith("https://offer.example/"))).toBe(true);
    expect(db.indexes.filter((row) => row.name === "imported_ads")).toHaveLength(2);
  });
});
