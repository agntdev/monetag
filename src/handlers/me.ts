import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { acceptanceHistory, getTask, profile } from "../data.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { back, unavailable } from "../task-ui.js";
registerMainMenuItem({ label: "My profile", data: "profile:me", order: 40 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, edit = false) { if (!ctx.from) { await ctx.reply("Open the bot from your Telegram account to view your profile."); return; } const user = await profile(ctx, ctx.from.id, ctx.from.first_name); const history = await acceptanceHistory(ctx, ctx.from.id); if (!user || !history) { await (edit ? ctx.editMessageText(unavailable, { reply_markup: back() }) : ctx.reply(unavailable, { reply_markup: back() })); return; } const titles = await Promise.all(history.slice(0, 5).map(async (item) => (await getTask(ctx, item.taskId))?.title ?? "A removed task")); const details = titles.length ? `\n\nAccepted tasks:\n${titles.map((title) => `• ${title}`).join("\n")}` : "\n\nNo accepted tasks yet — browse tasks to find work."; const text = `${user.displayName}\nAccepted tasks: ${user.acceptedTasksCount}${details}`; await (edit ? ctx.editMessageText(text, { reply_markup: back() }) : ctx.reply(text, { reply_markup: back() })); }
composer.command("me", (ctx) => show(ctx)); composer.callbackQuery("profile:me", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, true); });
export default composer;
