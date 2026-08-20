import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { showAd } from "../task-ui.js";
const composer = new Composer<Ctx>();
composer.callbackQuery(/^ad:view:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showAd(ctx, ctx.match[1]); });
composer.callbackQuery("ad:view", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Choose an ad from the list first."); });
export default composer;
