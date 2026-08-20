import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { listTasks } from "../data.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { unavailable, showTask } from "../task-ui.js";
registerMainMenuItem({ label: "Manage tasks", data: "admin:tasks", order: 60 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, edit = false) { if (!(await requireOwner(ctx as never))) return; const tasks = await listTasks(ctx); if (!tasks) { await (edit ? ctx.editMessageText(unavailable) : ctx.reply(unavailable)); return; } const active = tasks.filter((task) => task.status === "open"); if (!active.length) { await (edit ? ctx.editMessageText("No active tasks need attention.") : ctx.reply("No active tasks need attention.")); return; } const rows = active.slice(0, 7).map((task) => [inlineButton(`${task.title} — ${task.rewardText}`, `admin:task:${task.id}`)]); rows.push([inlineButton("Back to menu", "menu:main")]); await (edit ? ctx.editMessageText("Active tasks", { reply_markup: inlineKeyboard(rows) }) : ctx.reply("Active tasks", { reply_markup: inlineKeyboard(rows) })); }
composer.command("admin_tasks", (ctx) => show(ctx)); composer.callbackQuery("admin:tasks", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, true); });
composer.callbackQuery(/^admin:task:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx as never))) return; await showTask(ctx, ctx.match[1], true, true); });
export default composer;
