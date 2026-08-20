import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { showBrowse } from "../task-ui.js";
registerMainMenuItem({ label: "Browse tasks", data: "browse:page:0", order: 10 });
const composer = new Composer<Ctx>();
composer.command("browse", (ctx) => showBrowse(ctx));
composer.callbackQuery(/^browse:(?:page|next|prev):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showBrowse(ctx, Number(ctx.match[1]), true); });
export default composer;
