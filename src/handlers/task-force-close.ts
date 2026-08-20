import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { forceCloseTask } from "../data.js";
import { requireOwner } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
composer.callbackQuery(/^task:force_close:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx as never))) return; const task = await forceCloseTask(ctx, ctx.match[1]); await ctx.editMessageText(task ? "The task is now closed." : "That task is no longer available."); });
composer.callbackQuery("task:force_close", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx as never))) return; await ctx.reply("Choose a task from the management list first."); });
export default composer;
