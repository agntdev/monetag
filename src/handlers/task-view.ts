import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { showTask } from "../task-ui.js";
const composer = new Composer<Ctx>();
composer.callbackQuery(/^task:view:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showTask(ctx, ctx.match[1]); });
// A stale button should still get a helpful reply rather than a spinner.
composer.callbackQuery("task:view", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Choose a task from the list first."); });
export default composer;
