# HTML → JSX Converter (Next.js)

A browser tool that converts HTML into JSX, with optional per-section splitting.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Features

- **Drop, choose, or paste** an `.html` file — converts instantly (toggle **Live** off to convert only on demand).
- **HTML → JSX**: `class`→`className`, `for`→`htmlFor`, `on*` handlers camelCased, inline `style` → object, comments → `{/* */}`, void elements self-closed, `<script>`/`<style>` kept safe, stray characters escaped.
- **Wrap as component** / **Name** / **Body only** options.
- **Split into sections**: one bare arrow component (`const X = () => { ... }`, no export) per top-level body element. `<script>`/`<style>` are excluded.
  - Each section is a card with its own **Copy** button.
  - **Copy all** / **Download .jsx**: single page file (sections + default-exported page).
  - **Download .zip**: one file per section (with export) + a page that imports them.

## Project layout

```
app/
  layout.js        root layout
  page.js          renders the converter
  globals.css      styles
components/
  Converter.js     the client-side converter UI
lib/
  htmlToJsx.js     conversion logic
  zip.js           dependency-free ZIP writer
  clipboard.js     copy + download helpers
```

> The original single-file version (`index.html` + `server.js`) is kept for reference and is no longer needed.
