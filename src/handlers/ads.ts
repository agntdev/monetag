import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { showAds } from "../task-ui.js";
registerMainMenuItem({ label: "View ads", data: "ads:page:0", order: 30 });
const composer = new Composer<Ctx>();
composer.command("ads", (ctx) => showAds(ctx));
composer.callbackQuery(/^ads:(?:page|next|prev):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showAds(ctx, Number(ctx.match[1]), true); });
export default composer;
