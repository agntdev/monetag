import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { showAds } from "../task-ui.js";
import { syncImportedAds } from "../ad-sync.js";
registerMainMenuItem({ label: "View ads", data: "ads:page:0", order: 30 });
const composer = new Composer<Ctx>();
async function open(ctx: Ctx, page = 0, edit = false) { await syncImportedAds(ctx, true); await showAds(ctx, page, edit); }
composer.command("ads", (ctx) => open(ctx));
composer.callbackQuery(/^ads:(?:page|next|prev):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await open(ctx, Number(ctx.match[1]), true); });
export default composer;
