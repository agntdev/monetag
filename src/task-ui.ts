import type { Ctx } from "./bot.js";
import { inlineButton, inlineKeyboard, paginate, urlButton, type InlineButton } from "./toolkit/index.js";
import { getImportedAd, getTask, listImportedAds, listTasks, type ImportedAd, type Task } from "./data.js";

export const PAGE_SIZE = 5;
export type Draft = { kind: "task"; title?: string; description?: string; reward?: string; category?: string };
export type FlowSession = { draft?: Draft; step?: string };
export const flow = (ctx: Ctx): FlowSession => ctx.session as FlowSession;
export const unavailable = "Earn Daily isn't set up yet. Try again later.";
export const back = () => inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);
function taskLine(task: Task): string { return `${task.title} — ${task.rewardText}`; }
function adLine(ad: ImportedAd): string { return `Sponsored • ${ad.source} — ${ad.title}`.slice(0, 62); }

export async function showBrowse(ctx: Ctx, page = 0, edit = false): Promise<void> {
  const tasks = await listTasks(ctx); const ads = await listImportedAds(ctx);
  if (!tasks || !ads) { await (edit ? ctx.editMessageText(unavailable, { reply_markup: back() }) : ctx.reply(unavailable, { reply_markup: back() })); return; }
  const feed: Array<{ kind: "task"; value: Task } | { kind: "ad"; value: ImportedAd }> = [];
  tasks.forEach((task, index) => { feed.push({ kind: "task", value: task }); if ((index + 1) % 5 === 0) ads.forEach((ad) => feed.push({ kind: "ad", value: ad })); });
  if (!tasks.length) ads.forEach((ad) => feed.push({ kind: "ad", value: ad }));
  if (!feed.length) { await (edit ? ctx.editMessageText("No tasks or sponsored offers are available yet — tap Post a task to add one.", { reply_markup: back() }) : ctx.reply("No tasks or sponsored offers are available yet — tap Post a task to add one.", { reply_markup: back() })); return; }
  const view = paginate(feed, { page, perPage: PAGE_SIZE, callbackPrefix: "browse", prevLabel: "Previous", nextLabel: "Next" });
  const rows: InlineButton[][] = view.pageItems.map((item) => item.kind === "task" ? [inlineButton(taskLine(item.value), `task:view:${item.value.id}`)] : [inlineButton(adLine(item.value), `ad:view:${item.value.id}`)]);
  rows.push(...view.controls.inline_keyboard, [inlineButton("Back to menu", "menu:main")]);
  const text = `Earn Daily feed — page ${view.page + 1} of ${view.totalPages}.`;
  await (edit ? ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(text, { reply_markup: inlineKeyboard(rows) }));
}
export async function showTask(ctx: Ctx, taskId: string, edit = true, admin = false): Promise<void> { const task = await getTask(ctx, taskId); if (!task) { await (edit ? ctx.editMessageText("That task is no longer available.", { reply_markup: back() }) : ctx.reply("That task is no longer available.", { reply_markup: back() })); return; } const text = `${task.title}\n\n${task.description}\n\nReward: ${task.rewardText}${task.categoryTag ? `\nCategory: ${task.categoryTag}` : ""}\nStatus: ${task.status}.`; const rows: InlineButton[][] = task.status === "open" ? [[inlineButton("Accept task", `task:accept:${task.id}`)]] : []; if (admin) rows.push([inlineButton("Force close", `task:force_close:${task.id}`)]); rows.push([inlineButton("Back to tasks", admin ? "admin:tasks" : "browse:page:0")]); await (edit ? ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(text, { reply_markup: inlineKeyboard(rows) })); }
export async function showAd(ctx: Ctx, adId: string, edit = true): Promise<void> { const ad = await getImportedAd(ctx, adId); if (!ad || ad.removed || !ad.visible) { await (edit ? ctx.editMessageText("That sponsored offer is no longer available.", { reply_markup: back() }) : ctx.reply("That sponsored offer is no longer available.", { reply_markup: back() })); return; } const rows = [[urlButton("Open offer", ad.destinationUrl)], [inlineButton("Back to ads", "ads:page:0")]]; const text = `Sponsored • ${ad.source}\n\n${ad.title}\n\n${ad.description}`; if (ad.imageUrl) { await ctx.replyWithPhoto(ad.imageUrl, { caption: text, reply_markup: inlineKeyboard(rows) }); return; } await (edit ? ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(text, { reply_markup: inlineKeyboard(rows) })); }
export async function showAds(ctx: Ctx, page = 0, edit = false): Promise<void> { const ads = await listImportedAds(ctx); if (!ads) { await (edit ? ctx.editMessageText(unavailable, { reply_markup: back() }) : ctx.reply(unavailable, { reply_markup: back() })); return; } if (!ads.length) { await (edit ? ctx.editMessageText("No sponsored offers are active right now.", { reply_markup: back() }) : ctx.reply("No sponsored offers are active right now.", { reply_markup: back() })); return; } const view = paginate(ads, { page, perPage: PAGE_SIZE, callbackPrefix: "ads", prevLabel: "Previous", nextLabel: "Next" }); const rows: InlineButton[][] = view.pageItems.map((ad) => [inlineButton(adLine(ad), `ad:view:${ad.id}`)]); rows.push(...view.controls.inline_keyboard, [inlineButton("Back to menu", "menu:main")]); await (edit ? ctx.editMessageText(`Sponsored offers — page ${view.page + 1} of ${view.totalPages}.`, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(`Sponsored offers — page ${view.page + 1} of ${view.totalPages}.`, { reply_markup: inlineKeyboard(rows) })); }
