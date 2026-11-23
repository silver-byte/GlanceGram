# GlanceGram

GlanceGram brings short Telegram message and news summaries to Even G2 glasses. Read a message at a glance, then choose whether the bot should send a suggested reply. Built for DoraHacks’ Heads Up Even Realities Hackathon: **Track 01 — Messaging & News (Telegram)** and **Best Telegram Integration**.

## On the glasses

1. **Telegram inbox.** Scroll through recent summaries and tap a message to open it.
2. **Message summary.** Read the sender, UTC timestamp, and full summary. Tap a pending message to review a reply.
3. **Review draft.** Read the exact reply, scroll to **Approve & send** or **Dismiss without sending**, then tap. GlanceGram only marks a reply sent after Telegram confirms it.

Double-tap to go back, or to open the system exit prompt at the inbox.

## Run locally

Use Node.js 24 and npm, plus the Even Hub simulator’s platform prerequisites. Run `npm install`. Keep the Telegram bot token in a private file (mode `600` on Linux), and put the gateway key in the backend process environment. Use [`.env.example`](.env.example) as a variable reference only. Never commit either credential, and do not use `VITE_` variables for secrets. The backend is the only process that needs the credentials.

With `BOT_TOKEN_FILE` and `LITELLM_API_KEY` configured in the backend shell:

```sh
ENABLE_TEST_INJECT=1 npm run backend
```

In two other terminals:

```sh
npm run dev
npm run simulate -- --automation-port 9898
```

For a built preview, use `npm run build`, `npm run preview`, and `npx evenhub-simulator http://127.0.0.1:4173 --automation-port 9898`. Use `npm run pack` to produce `app.ehpk`. The app and API must share a loopback host for this demo; a phone’s loopback is not the development machine. Keep Vite on loopback. The project uses the starter’s Vite 5 toolchain, which npm flags in the development dependency audit.

### Synthetic message

```sh
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS -H 'Content-Type: application/json' \
  -d '{"chat_id":-999999999999,"from":"Maya","text":"Can you meet at 3 PM tomorrow to review the demo?"}' \
  http://127.0.0.1:8787/api/test-inject
```

The synthetic chat appears in the inbox. If approved, the backend calls Telegram, and the fictional chat ID returns `chat not found`. Dismiss does not send anything.

### Live Telegram

Start a private conversation with your bot and send a short message. Set `TELEGRAM_OWNER_CHAT_ID` to that private chat’s numeric ID (the `message.chat.id` field returned by Telegram `getUpdates`) and restart the backend without `ENABLE_TEST_INJECT`. Use only one poller for a bot. The backend ignores updates from other chats. It sends the message text to the configured summary gateway (`deepseek-v4-flash`, with fallback to `gemini-3.5-flash-lite`) and keeps inbox state in the gitignored `server/data/` directory. Use non-sensitive text for testing.

Prepared before 2026-11-23: the Even Hub simulator was verified working on this machine, and the Telegram Bot @GlanceGramG2Bot was created and verified.

## Simulator screenshots

| Inbox | Detail | Review draft |
| --- | --- | --- |
| ![Telegram inbox](docs/demo-shots/01-inbox.png) | ![Message summary](docs/demo-shots/02-detail.png) | ![Reply review](docs/demo-shots/03-approve.png) |
