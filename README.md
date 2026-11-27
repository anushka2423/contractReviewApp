# Contract Review App

A simple web app for reviewing a contract with a chat assistant. Upload a PDF on the left, ask questions on the right, and get answers with supporting citations.

Built with plain HTML, CSS and JavaScript — no frameworks, no npm, no build step.

## Features

- **PDF upload and preview** — drag and drop a PDF (or browse for one) and read it in the left panel.
- **Chat panel** — ask questions about the contract in the right panel. Both panels are visible side by side and scroll independently.
- **Cited answers** — each reply shows the answer, the exact contract clauses that support it, and a short explanation of the reasoning.
- **Webhook-powered** — the contract is indexed once on upload via an n8n ingestion webhook, and each question goes to a chat webhook that returns the answer as JSON.
- **Clear states** — typing indicator while waiting, friendly error messages, and a prompt to upload a contract first.

## Run it locally

1. Download or clone this repository.
2. Open `index.html` in your browser (double-click it).

That's it. If your browser blocks the webhook request when opening the file directly, serve the folder instead:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Configuration

The app uses two n8n webhooks, set at the top of `app.js`:

```js
var INGEST_URL = "https://…/webhook/…";
var CHAT_URL = "https://…/webhook/…";
```

- **Ingestion** — the PDF is sent once, right after upload, as form-data field `data`. Chat stays disabled until indexing succeeds.
- **Chat** — each question is sent on its own as form field `message`. The backend keeps a single shared contract in memory, so only one contract is loaded at a time and uploading a new one replaces it.
- A `webhook-test` URL only works while the n8n workflow is open in the editor and listening for a test event. Use the production `/webhook/` URL (with the workflow activated) for regular use.
- The chat webhook must reply with JSON in this shape:

```json
{
  "response": "answer based only on the contract",
  "citation": ["clause text with section or page"],
  "reasoning": "how the citations support the answer"
}
```

## Project files

| File         | Purpose                                      |
| ------------ | -------------------------------------------- |
| `index.html` | Page structure                               |
| `styles.css` | Navy and orange styling and layout           |
| `app.js`     | Upload, PDF preview, chat and webhook logic  |

## Feedback and chat history (Supabase)

- **Feedback** saves to the `feedback` table (insert-only for the public).
- Every answered question is saved silently to `chat_messages` with the contract's name (file name without `.pdf`, or "Untitled contract"). A failed save never affects the chat.
- **Chat history** (top bar) lists saved contracts by name with question counts and last activity; open one to see its full Q&A. Uploading a contract with the same name reloads its earlier conversation.
- Config: copy `config.example.js` to `config.js` and fill in your values (URLs and the publishable key only, never a service-role key). `config.js` and `.env` are git-ignored. Files: `supabase.js`, `feedback.js`, `history.js`.
