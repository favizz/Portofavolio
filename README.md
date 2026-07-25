# Favian Izza — Portfolio

A single-page, cinematic portfolio site built with [Astro](https://astro.build), [Tailwind CSS](https://tailwindcss.com), and [GSAP](https://gsap.com) (ScrollTrigger) for scroll-driven reveals and parallax. Fully static output — no server or backend required.

## Structure

```text
src/
├── components/       # Header, SocialSidebar, NavDots, and one component per section
├── layouts/
│   └── Layout.astro  # Shared <head>/document shell
├── pages/
│   └── index.astro   # Assembles all sections onto one scrollable page
├── scripts/
│   └── motion.ts      # GSAP ScrollTrigger: fade/slide reveals, parallax, active-section tracking
└── styles/
    └── global.css      # Tailwind import + theme tokens (colors, fonts)
```

## Before you launch

- Replace the placeholder profile image URL in `Hero.astro` / `About.astro` with your own photo.
- Replace the placeholder social links in `SocialSidebar.astro` with your real GitHub/LinkedIn/Twitter/Instagram.
- Replace the placeholder project cards in `Projects.astro` with your real projects.
- Replace the placeholder email in `Contact.astro` and the CV link (`href="#"`) in `Hero.astro`.

## Commands

| Command           | Action                                      |
| :----------------- | :------------------------------------------- |
| `npm install`       | Install dependencies                         |
| `npm run dev`       | Start local dev server at `localhost:4321`   |
| `npm run build`     | Build the static production site to `./dist/` |
| `npm run preview`   | Preview the production build locally         |

## Deploying

This builds to static HTML/CSS/JS in `dist/` — deploy it to Vercel (recommended: import the repo, framework preset "Astro", zero config needed), Netlify, or GitHub Pages.
