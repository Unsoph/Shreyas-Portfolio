# Shreyas Sharma, portfolio

Source for [shreyassharma.dev](https://shreyassharma.dev): robotics, embedded systems and edge computer vision.

Hosted on Vercel. Every push to `main` deploys; pull requests get a preview URL.

## What's on the page

| Section | Contents |
|---|---|
| Hero | Name, positioning, and an interactive two-link arm that solves inverse kinematics toward your pointer |
| Work | Dtown Robotics, Elcom Innovations, QID, SRMIST research |
| Projects | Five flagship systems, each with a status and a "built / next" split |
| Smaller builds | Filterable, expandable list of hardware, IoT and vision projects |
| Open source, Skills, Education | GSSoC 2026, skills (coursework kept separate), certifications |
| Contact | Email, copy-to-clipboard, GitHub, LinkedIn |

### Project statuses

| Status | Meaning |
|---|---|
| Shipped | Works end to end |
| Active | In development now |
| Simulation | Verified in simulation only |
| Prototype | Hardware built, partly working |
| Concept | Designed, not built |

Keep these honest when editing: a project moves to Shipped only when it actually works end to end.

## Stack

Plain HTML, CSS and JavaScript. No build step, no framework, no runtime dependencies.

- Type: [Archivo](https://fonts.google.com/specimen/Archivo), using its variable width axis for headings
- Colour: steel greys with one Kapton-amber accent, light and dark themes (follows the system, with a toggle)
- Arm: `<canvas>` with analytic 2-link IK and rate-limited joints; arrow keys move the target, Space toggles the gripper; idle motion is off under `prefers-reduced-motion`

## Files

```
index.html     all content
style.css      design tokens and layout
main.js        theme, nav, filters, copy email, the arm
favicon.svg    arm glyph, adapts to dark mode
og-image.png   1200x630 social preview
robots.txt, sitemap.xml
```

## Editing content

- **Add a flagship project:** copy an `<article class="project">` block in `#projects`.
- **Add a smaller build:** copy an `<li data-area="...">` in `.builds`. `data-area` is one of `robotics`, `embedded`, `iot`, `vision`, and drives the filter chips.
- **Status chip:** `<span class="status s-shipped|s-active|s-sim|s-proto|s-concept">`.

## Local preview

```bash
npx serve .
```

## License

[MIT](./LICENSE) © 2026 Shreyas Sharma
