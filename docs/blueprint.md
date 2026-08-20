# Task & Ads Browser — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for gig workers and task posters to browse and accept paid tasks, and for admins to post ads. Tasks are recorded with acceptance tracking and notifications sent to posters and admins. Ads are posted by admins and appear in the task feed and /ads view.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- gig workers
- task posters
- admins

## Success criteria

- Users can browse and accept tasks with notifications sent to posters and admins
- Admins can post and manage ads
- Task acceptance records are stored and visible in user profiles

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/browse** (command, actor: user, command: /browse) — Browse available tasks with pagination
- **/post** (command, actor: user, command: /post) — Start creating a new task with guided prompts
- **/ads** (command, actor: user, command: /ads) — View all active admin-posted ads
- **/me** (command, actor: user, command: /me) — View your user profile and acceptance history
- **View Task** (button, actor: user, callback: task:view) — View full details of a task from the browse list
  - inputs: task_id
  - outputs: task details
- **Accept Task** (button, actor: user, callback: task:accept) — Accept a task and create an acceptance record
  - inputs: task_id
  - outputs: acceptance confirmation
- **View Ad** (button, actor: user, callback: ad:view) — View full details of an ad from the ads list
  - inputs: ad_id
  - outputs: ad details
- **/admin_post_ad** (command, actor: admin, command: /admin_post_ad) — Admin command to post a new ad with image and text
  - inputs: image, text, link
  - outputs: ad confirmation
- **/admin_tasks** (command, actor: admin, command: /admin_tasks) — Admin view of active tasks for management
  - inputs: none
  - outputs: task list
- **Force Close** (button, actor: admin, callback: task:force_close) — Admin action to force-close a task
  - inputs: task_id
  - outputs: task status update

## Flows

### Browse Tasks
_Trigger:_ /browse

1. Show paginated task list with View buttons
2. User selects View to see task details
3. User may Accept task if available

_Data touched:_ Task

### Post Task
_Trigger:_ /post

1. Prompt for title
2. Prompt for description
3. Prompt for reward text
4. Confirm and create task

_Data touched:_ Task

### Accept Task
_Trigger:_ task:accept

1. Create acceptance record
2. Notify task poster
3. Notify admin group
4. Update task status to accepted

_Data touched:_ Task, Acceptance

### Admin Post Ad
_Trigger:_ /admin_post_ad

1. Prompt for ad text
2. Prompt for optional image
3. Prompt for optional link
4. Confirm and create ad

_Data touched:_ Ad

### Admin Task Management
_Trigger:_ /admin_tasks

1. Show list of active tasks
2. Admin can force-close tasks
3. Admin can view task details

_Data touched:_ Task

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat ID where admin notifications and ad posting permissions are managed
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Task** _(retention: persistent)_ — A posted task with title, description, reward, and status
  - fields: title, description, reward_text, poster_user_id, posted_timestamp, category_tag, status
- **Acceptance** _(retention: persistent)_ — Record of a user accepting a task
  - fields: acceptor_user_id, timestamp, task_id, message
- **Ad** _(retention: persistent)_ — Admin-posted advertisement with text, image, and link
  - fields: image_url, text, link_url, admin_user_id, active_start, active_end
- **User** _(retention: persistent)_ — User profile with basic info and reputation
  - fields: telegram_id, display_name, contact_preference, accepted_tasks_count

## Integrations

- **Telegram** (required) — Bot API messaging
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- ADMIN_CHAT_ID for admin notifications and ad posting permissions
- Pagination size for task browsing

## Notifications

- Task poster receives private message when task is accepted
- Admin group receives notification when task is accepted
- Admin receives notification when new ad is posted

## Permissions & privacy

- Only admins can post ads
- User profiles store minimal data (name, accepted tasks count)
- Task poster and acceptor IDs are stored but not shared beyond notifications

## Edge cases

- Multiple users accept same task simultaneously
- Admin tries to post ad without proper permissions
- User tries to accept already-accepted task
- Ad display during inactive period

## Required tests

- User can browse tasks and accept one successfully with notifications
- Admin can post ad and it appears in /ads and browse feed
- Task status updates correctly after acceptance
- Pagination works across multiple pages

## Assumptions

- Single-acceptance rule: first-come-first-served
- Admins are defined by ADMIN_CHAT_ID membership
- Ads are interleaved every 5 tasks in browse feed
- Category tags are optional free-text with suggested UI options
