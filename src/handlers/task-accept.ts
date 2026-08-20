import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { acceptTask } from "../data.js";
import { adminChatId } from "../toolkit/index.js";
const composer = new Composer<Ctx>();
composer.callbackQuery(/^task:accept:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!ctx.from) { await ctx.reply("Open this task from your Telegram account to accept it."); return; } const result = await acceptTask(ctx, ctx.match[1], ctx.from.id);
  if (result.unavailable) { await ctx.editMessageText("Earn Daily isn't set up yet. Try again later."); return; }
  if (!result.accepted || !result.task) { await ctx.editMessageText("This task has already been taken or closed."); return; }
  await ctx.editMessageText("You accepted this task. The poster has been notified.");
  const notification = `Your task “${result.task.title}” has been accepted.`;
  try { await ctx.api.sendMessage(result.task.posterUserId, notification); } catch { /* Posters may have blocked the bot; acceptance remains valid. */ }
  const admin = adminChatId(ctx as never); if (admin) { try { await ctx.api.sendMessage(admin, `A task was accepted: ${result.task.title}.`); } catch { /* Admin notification is best effort. */ } }
});
composer.callbackQuery("task:accept", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Choose a task from the list first."); });
export default composer;
