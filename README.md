# Contract Review App

A simple web app for reviewing a contract with a chat assistant. Upload a PDF on the left, ask questions on the right, and get answers with supporting citations.

Built with plain HTML, CSS and JavaScript — no frameworks, no npm, no build step.

## Features

- **PDF upload and preview** — drag and drop a PDF (or browse for one) and read it in the left panel.
- **Chat panel** — ask questions about the contract in the right panel. Both panels are visible side by side and scroll independently.
- **Cited answers** — each reply shows the answer, the exact contract clauses that support it, and a short explanation of the reasoning.
- **Webhook-powered** — the uploaded file and your question are sent to an n8n webhook, which returns the answer as JSON.
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

The webhook address is set at the top of `app.js`:

```js
var WEBHOOK_URL = "https://…/webhook-test/…";
```

- A `webhook-test` URL only works while the n8n workflow is open in the editor and listening for a test event. Switch to the production `/webhook/` URL (and activate the workflow) for regular use.
- The file is sent as form field `file` and the question as `message`.
- The webhook must reply with JSON in this shape:

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
