import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getImportedAd, listImportedAds, updateImportedAd } from "../data.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { syncImportedAds } from "../ad-sync.js";

registerMainMenuItem({ label: "Manage ads", data: "admin:ads", order: 50 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, edit = false) {
  if (!(await requireOwner(ctx as never))) return;
  await syncImportedAds(ctx, true);
  const ads = await listImportedAds(ctx, true);
  if (!ads) { await (edit ? ctx.editMessageText("Earn Daily isn't set up yet. Try again later.") : ctx.reply("Earn Daily isn't set up yet. Try again later.")); return; }
  if (!ads.length) { await (edit ? ctx.editMessageText("No imported ads are available to manage.") : ctx.reply("No imported ads are available to manage.")); return; }
  const rows = ads.slice(0, 8).map((ad) => [inlineButton(`${ad.visible && !ad.removed ? "Visible" : "Hidden"} • ${ad.source} • ${ad.title}`.slice(0, 62), `admin:ad:${ad.id}`)]);
  rows.push([inlineButton("Refresh ads", "admin:ads"), inlineButton("Back to menu", "menu:main")]);
  await (edit ? ctx.editMessageText("Imported ads", { reply_markup: inlineKeyboard(rows) }) : ctx.reply("Imported ads", { reply_markup: inlineKeyboard(rows) }));
}
// Kept as a compatibility shortcut, but manual creation is deliberately disabled.
composer.command("admin_post_ad", async (ctx) => { if (!(await requireOwner(ctx as never))) return; await ctx.reply("Manual ad posting is disabled. Imported ads are managed here.", { reply_markup: inlineKeyboard([[inlineButton("Manage ads", "admin:ads")]]) }); });
composer.callbackQuery("admin:ads", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, true); });
composer.callbackQuery(/^admin:ad:(visibility|priority|removed):(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx as never)) || !ctx.from) return; const action = ctx.match[1] as "visibility" | "priority" | "removed"; const ad = await updateImportedAd(ctx, ctx.match[2], ctx.from.id, action, action === "priority" ? "Priority increased" : action === "visibility" ? "Visibility toggled" : "Removed from feed"); await ctx.editMessageText(ad ? action === "removed" ? "The imported ad has been removed from the feed." : action === "visibility" ? `The imported ad is now ${ad.visible ? "visible" : "hidden"}.` : "The imported ad will appear first in the feed." : "That imported ad is no longer available."); });
composer.callbackQuery(/^admin:ad:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx as never))) return; const ad = await getImportedAd(ctx, ctx.match[1]); if (!ad) { await ctx.editMessageText("That imported ad is no longer available."); return; } const state = ad.removed ? "Removed" : ad.visible ? "Visible" : "Hidden"; await ctx.editMessageText(`${state} • ${ad.source}\n\n${ad.title}\n\n${ad.description}`, { reply_markup: inlineKeyboard([[inlineButton(ad.visible ? "Hide ad" : "Show ad", `admin:ad:visibility:${ad.id}`), inlineButton("Prioritize", `admin:ad:priority:${ad.id}`)], [inlineButton("Remove ad", `admin:ad:removed:${ad.id}`)], [inlineButton("Back to ads", "admin:ads")]]) }); });
export default composer;
