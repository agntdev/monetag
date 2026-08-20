import type { Ctx } from "./bot.js";
import { inlineButton, inlineKeyboard, paginate, urlButton, type InlineButton } from "./toolkit/index.js";
import { getAd, getTask, listActiveAds, listTasks, type Ad, type Task } from "./data.js";

export const PAGE_SIZE = 5;
export type Draft = { kind: "task"; title?: string; description?: string; reward?: string; category?: string } | { kind: "ad"; text?: string; imageUrl?: string; linkUrl?: string };
export type FlowSession = { draft?: Draft; step?: string };
export const flow = (ctx: Ctx): FlowSession => ctx.session as FlowSession;
export const unavailable = "The task board isn't set up yet. Try again later.";
export const back = () => inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]);
function taskLine(task: Task): string { return `${task.title} — ${task.rewardText}`; }

export async function showBrowse(ctx: Ctx, page = 0, edit = false): Promise<void> {
  const tasks = await listTasks(ctx); const ads = await listActiveAds(ctx);
  if (!tasks || !ads) { await (edit ? ctx.editMessageText(unavailable, { reply_markup: back() }) : ctx.reply(unavailable, { reply_markup: back() })); return; }
  const feed: Array<{ kind: "task"; value: Task } | { kind: "ad"; value: Ad }> = [];
  let insertedAds = false;
  tasks.forEach((task, index) => { feed.push({ kind: "task", value: task }); if ((index + 1) % 5 === 0) { ads.forEach((ad) => feed.push({ kind: "ad", value: ad })); insertedAds = true; } });
  // Keep a newly posted ad discoverable even before the feed reaches five tasks.
  if (!insertedAds) ads.forEach((ad) => feed.push({ kind: "ad", value: ad }));
  if (feed.length === 0) { await (edit ? ctx.editMessageText("No tasks are available yet — tap Post a task to add one.", { reply_markup: back() }) : ctx.reply("No tasks are available yet — tap Post a task to add one.", { reply_markup: back() })); return; }
  const view = paginate(feed, { page, perPage: PAGE_SIZE, callbackPrefix: "browse", prevLabel: "Previous", nextLabel: "Next" });
  const rows: InlineButton[][] = view.pageItems.map((item) => item.kind === "task" ? [inlineButton(taskLine(item.value), `task:view:${item.value.id}`)] : [inlineButton(`Ad: ${item.value.text.slice(0, 36)}`, `ad:view:${item.value.id}`)]);
  rows.push(...view.controls.inline_keyboard, [inlineButton("Back to menu", "menu:main")]);
  const text = `Available work — page ${view.page + 1} of ${view.totalPages}.`;
  await (edit ? ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(text, { reply_markup: inlineKeyboard(rows) }));
}
export async function showTask(ctx: Ctx, taskId: string, edit = true, admin = false): Promise<void> {
  const task = await getTask(ctx, taskId); if (!task) { await (edit ? ctx.editMessageText("That task is no longer available.", { reply_markup: back() }) : ctx.reply("That task is no longer available.", { reply_markup: back() })); return; }
  const text = `${task.title}\n\n${task.description}\n\nReward: ${task.rewardText}${task.categoryTag ? `\nCategory: ${task.categoryTag}` : ""}\nStatus: ${task.status}.`;
  const rows = task.status === "open" ? [[inlineButton("Accept task", `task:accept:${task.id}`)]] : [];
  if (admin) rows.push([inlineButton("Force close", `task:force_close:${task.id}`)]);
  rows.push([inlineButton("Back to tasks", admin ? "admin:tasks" : "browse:page:0")]);
  await (edit ? ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(text, { reply_markup: inlineKeyboard(rows) }));
}
export async function showAd(ctx: Ctx, adId: string, edit = true): Promise<void> {
  const ad = await getAd(ctx, adId); if (!ad) { await (edit ? ctx.editMessageText("That ad is no longer active.", { reply_markup: back() }) : ctx.reply("That ad is no longer active.", { reply_markup: back() })); return; }
  const rows = ad.linkUrl ? [[urlButton("Open link", ad.linkUrl)], [inlineButton("Back to ads", "ads:page:0")]] : [[inlineButton("Back to ads", "ads:page:0")]];
  const text = `Advertisement\n\n${ad.text}`;
  if (ad.imageUrl) { await ctx.replyWithPhoto(ad.imageUrl, { caption: text, reply_markup: inlineKeyboard(rows) }); return; }
  await (edit ? ctx.editMessageText(text, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(text, { reply_markup: inlineKeyboard(rows) }));
}
export async function showAds(ctx: Ctx, page = 0, edit = false): Promise<void> {
  const ads = await listActiveAds(ctx); if (!ads) { await (edit ? ctx.editMessageText(unavailable, { reply_markup: back() }) : ctx.reply(unavailable, { reply_markup: back() })); return; }
  if (!ads.length) { await (edit ? ctx.editMessageText("No active ads right now.", { reply_markup: back() }) : ctx.reply("No active ads right now.", { reply_markup: back() })); return; }
  const view = paginate(ads, { page, perPage: PAGE_SIZE, callbackPrefix: "ads", prevLabel: "Previous", nextLabel: "Next" });
  const rows: InlineButton[][] = view.pageItems.map((ad) => [inlineButton(ad.text.slice(0, 48), `ad:view:${ad.id}`)]); rows.push(...view.controls.inline_keyboard, [inlineButton("Back to menu", "menu:main")]);
  await (edit ? ctx.editMessageText(`Active ads — page ${view.page + 1} of ${view.totalPages}.`, { reply_markup: inlineKeyboard(rows) }) : ctx.reply(`Active ads — page ${view.page + 1} of ${view.totalPages}.`, { reply_markup: inlineKeyboard(rows) }));
}
