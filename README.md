# Inkdraft

> Scan your handwriting. Own your words. Let AI assist — never replace.

Inkdraft is a PWA writing tool for writers who prefer pen and paper. Photograph your handwritten work, extract the text exactly as written, then optionally use AI to improve it — while keeping your original voice completely intact.

---

## Philosophy

**Your text is sacred.** AI lives on the other side of the glass.

Most writing tools treat AI as the primary author. Inkdraft treats you as the author. The AI is a quiet collaborator that only speaks when you ask it to, and only does what you tell it to.

---

## Features

- **Scan & Extract** — Upload or photograph handwritten pages. OCR extracts your text exactly, marking uncertain characters for your review.
- **Dual Pad** — Your original text and the AI version live side by side. Neither replaces the other.
- **Prompt-Driven AI** — The AI only generates when you press Generate. It reads your prompt and your text, and produces a suggestion — not a replacement.
- **Typewriter Animation** — Watch the AI write in real time so you can follow its thinking.
- **Collapsible Panels** — Show and hide Source, Original, Prompt, and AI panels freely. Focus any panel full-screen.
- **Save Session** — Choose exactly what to save: original text, AI version, prompt used, or source image.
- **Light / Dark Mode** — Warm paper tones in both.
- **PWA** — Installable on any device. Works offline for core features.

---

## Tech Stack

- Vanilla HTML / CSS / JS — no framework
- [Tesseract.js](https://tesseract.projectnaptha.com/) — in-browser OCR
- [Claude API](https://docs.anthropic.com) (claude-sonnet) — AI text generation
- Vercel — deployment

---

## Project Structure

```
inkdraft/
├── index.html       # Full application (single file)
├── manifest.json    # PWA manifest
├── sw.js            # Service worker
├── icons/           # PWA icons (192, 512)
└── README.md
```

---

## Deployment

Push to GitHub and connect to Vercel. Zero configuration needed — this is a static site.

```bash
git init
git add .
git commit -m "feat: initial Inkdraft release"
git remote add origin https://github.com/YOUR_USERNAME/inkdraft.git
git push -u origin main
```

---

## Roadmap

- [ ] History / saved sessions (IndexedDB)
- [ ] Diff view between original and AI version
- [ ] Word count targets
- [ ] Export to PDF / DOCX
- [ ] Multi-language OCR support

---

*Built for writers who think with a pen.*
