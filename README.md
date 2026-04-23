# Shreyas Sharma — Portfolio

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](./LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-blue.svg)](https://unsoph.github.io/Portfolio)

Personal portfolio website for **Shreyas Sharma** — showcasing robotics, embedded systems, ML/CV, and autonomous systems projects.

## 🔗 Live Demo

> Deploy via GitHub Pages — **Settings → Pages → Deploy from branch → `main`**

## ✨ Features

- **Boot Sequence** — Terminal-style startup animation with click-to-skip
- **Particle Canvas** — Animated background with interconnected node visualization
- **Blueprint Mode** — Toggle to a blue engineering CAD aesthetic with visible grid overlay
- **SFX Toggle** — Synthesized Web Audio API click sounds on interaction
- **Custom Cursor** — Crosshair cursor with trailing particle effect (desktop only)
- **Scroll Animations** — GSAP ScrollTrigger reveal effects with IntersectionObserver fallback
- **Responsive** — Fully functional on mobile with hamburger menu

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (semantic) |
| Styling | Vanilla CSS (custom properties, grid, flexbox) |
| Logic | Vanilla JavaScript (ES6+) |
| Animation | GSAP 3 + ScrollTrigger (CDN) |
| Audio | Web Audio API |
| Fonts | Google Fonts (Orbitron, JetBrains Mono, Inter) |

## 📁 File Structure

```
Portfolio/
├── index.html      # Single-page markup (all sections)
├── style.css       # Complete stylesheet (~990 lines)
├── main.js         # All interactions and animations (~380 lines)
├── README.md       # This file
├── LICENSE         # MIT License
└── .gitignore      # macOS / IDE / Node exclusions
```

## 🚀 Local Development

No build step required. Open `index.html` directly in any modern browser:

```bash
# Option 1: Direct open
open index.html

# Option 2: Local server (avoids CORS issues if you add assets later)
npx serve .
```

## 📦 Deployment (GitHub Pages)

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch → `main` → `/ (root)`**
4. Your site will be live at `https://<username>.github.io/<repo-name>/`

## 📋 Sections

| # | Section | Description |
|---|---------|-------------|
| 01 | About | Bio, education (SRMIST), focus areas |
| 02 | Experience | QID AI internship, 6-DOF research collaboration, B.Tech |
| 03 | Stack | Tag-grouped technical skills (no percentage bars) |
| 04 | Projects | 4 featured + 7 more + 3 experiments = 14 total builds |
| 05 | Contact | Email form (mailto) + GitHub + LinkedIn links |

## 📄 License

[MIT](./LICENSE) © 2026 Shreyas Sharma
