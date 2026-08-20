# Earn Daily

Earn Daily is a Telegram bot for browsing paid tasks, posting work, and tracking accepted tasks. Sponsored offers are imported from Monetag and AdsGram; they are view-only and never enter the task-acceptance workflow.

## Configuration

Set these deployment secrets/bindings in the platform environment manager:

- `ADMIN_CHAT_ID` — platform-injected owner chat ID for task notifications and ad management.
- `MONETAG_ADS_ENDPOINT`, `MONETAG_API_KEY` — Monetag HTTPS API or RSS feed endpoint and key.
- `ADSGRAM_ADS_ENDPOINT`, `ADSGRAM_API_KEY` — AdsGram HTTPS API or RSS feed endpoint and key.
- `ADS_SYNC_INTERVAL_MINUTES` — minimum sync interval; defaults to `60`.

The Worker cron calls the importer regularly, and opening Ads also requests a refresh. Imports deduplicate by network and source ad ID. Legacy manual ads are migrated to the `internal_archived_ads` table and stay hidden unless an admin explicitly restores them through future tooling.

## Admin guide

The owner opens **Manage ads** from the main menu. The screen supports refreshing imported ads, hiding/showing them, prioritizing them in the feed, and removing them. Every change is saved as an audit record. Manual ad creation is disabled.

## QA checklist

- Run `npm test` to verify Monetag and AdsGram import parsing plus source-and-ID deduplication.
- With configured test feeds, open **Ads** and confirm each sponsored offer shows its source, title, short description, image when supplied, and an external **Open offer** button.
- Open **Browse tasks** and confirm sponsored entries are interleaved after every five tasks and have no accept button.
- As the configured owner, hide an imported ad, refresh the public feed, then show, prioritize, and remove it; confirm every change persists after reopening **Manage ads**.

## Release notes

- Renamed the bot and all user-facing product copy to **Earn Daily**.
- Replaced manual ads with Monetag and AdsGram feed imports.
- Added sponsored source badges, external offer buttons, visibility controls, prioritization, removal, and audit history.
