import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { createTask } from "../data.js";
import { confirmKeyboard, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { flow } from "../task-ui.js";
registerMainMenuItem({ label: "Post a task", data: "task:post", order: 20 });
const composer = new Composer<Ctx>();
const prompt = (ctx: Ctx, text: string, placeholder: string) => ctx.reply(text, { reply_markup: { force_reply: true, input_field_placeholder: placeholder } });
async function begin(ctx: Ctx) { flow(ctx).draft = { kind: "task" }; flow(ctx).step = "task:title"; await prompt(ctx, "What is the task title?", "Type a short title"); }
composer.command("post", begin); composer.callbackQuery("task:post", async (ctx) => { await ctx.answerCallbackQuery(); await begin(ctx); });
composer.on("message:text", async (ctx, next) => {
  const state = flow(ctx); if (!state.step?.startsWith("task:")) return next(); const value = ctx.message.text.trim();
  if (!value || value.length > 1000) { await ctx.reply("Use between 1 and 1,000 characters."); return; }
  const draft = state.draft; if (!draft || draft.kind !== "task") { state.step = undefined; return next(); }
  if (state.step === "task:title") { draft.title = value; state.step = "task:description"; await prompt(ctx, "Describe the work and any requirements.", "Type the task details"); return; }
  if (state.step === "task:description") { draft.description = value; state.step = "task:reward"; await prompt(ctx, "What is the reward?", "For example: $80"); return; }
  if (state.step === "task:reward") { draft.reward = value; state.step = "task:category"; await ctx.reply("Choose a category, or type your own.", { reply_markup: inlineKeyboard([[inlineButton("Delivery", "task:category:Delivery"), inlineButton("Cleaning", "task:category:Cleaning")], [inlineButton("Design", "task:category:Design"), inlineButton("Skip", "task:category:skip")]]) }); return; }
  if (state.step === "task:category") { draft.category = value; state.step = "task:confirm"; await ctx.reply(`Ready to post “${draft.title}” for ${draft.reward}.`, { reply_markup: confirmKeyboard("task:create", { yes: "Post task", no: "Cancel" }) }); }
});
composer.callbackQuery(/^task:category:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const draft = flow(ctx).draft; if (!draft || draft.kind !== "task") { await ctx.reply("That draft has expired. Start a new task."); return; } draft.category = ctx.match[1] === "skip" ? undefined : ctx.match[1]; flow(ctx).step = "task:confirm"; await ctx.editMessageText(`Ready to post “${draft.title}” for ${draft.reward}.`, { reply_markup: confirmKeyboard("task:create", { yes: "Post task", no: "Cancel" }) }); });
composer.callbackQuery(/^task:create:(yes|no)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = flow(ctx); const draft = state.draft; if (ctx.match[1] === "no") { state.draft = undefined; state.step = undefined; await ctx.editMessageText("Task draft cancelled."); return; } if (!draft || draft.kind !== "task" || !draft.title || !draft.description || !draft.reward || !ctx.from) { await ctx.editMessageText("That draft has expired. Start a new task."); return; } const task = await createTask(ctx, { title: draft.title, description: draft.description, rewardText: draft.reward, categoryTag: draft.category, posterUserId: ctx.from.id }); state.draft = undefined; state.step = undefined; await ctx.editMessageText(task ? "Your task is live on Earn Daily." : "Earn Daily isn't set up yet. Try again later."); });
export default composer;
