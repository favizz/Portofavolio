# Portfolio project notes

Astro (static output, no server) + Tailwind CSS v4 (`@tailwindcss/vite`) + GSAP/ScrollTrigger + Lenis smooth scroll. Deploys as plain static HTML/CSS/JS, no backend.

## Content policy

- Never use em dashes anywhere in generated copy or code comments. User preference, see the assistant's own memory system, apply a period/comma/colon instead.
- All personal/CV content must trace back to a real source (`CV_Favian Izza.pdf`, `Transcript_Favian Izza.pdf`, LinkedIn/GitHub, or explicit user instruction). Don't invent tech stacks, numbers, or company facts that aren't stated or aren't verifiable via web search. `dev/FACT.md` is the running source of truth, keep it updated when new real content is added.
- `dev/UPDATE.md` is the user's own scratch file for the next batch of instructions. Never edit it, only read and execute it.
- `dev/TASK.md` lists deliverables only the user can provide (real assets, missing personal facts). Keep it current: remove items once fulfilled, add new ones as they come up.

## Data model (`src/data/`)

Every section reads from a typed data file rather than hardcoding content in the component:
- `projects.ts`, `experience.ts`, `technology.ts`, `certifications.ts`, `education.ts`, `socials.ts`
- Each `projects`/`experience` entry has a `slug`, used as the DOM hook for the expand/carousel interaction and for cross-linking (see below).
- `experience[].tags` are only added when the CV literally names the technology (e.g. Siemens says "Laravel-based", so it gets `['Laravel', 'PHP']`, PHP because Laravel is a PHP framework by definition). Don't add tags based on guessing what stack a role "probably" used.
- `relations.ts` derives cross-links automatically from tag overlap: `findTechRelation(name)` finds the first project (priority) or experience with a matching tag, for making Technology tiles clickable. `findRelatedProject(tags)` finds the best-matching project for an experience entry's tags, used for Career's "see related project" button. If nothing matches, the UI simply doesn't render a link, that's intentional, don't force a fake relation.
- About's stat tiles are computed from `array.length`, not hardcoded numbers. Keep it that way, that's the whole point of it being "dynamic."

## The expand-to-carousel pattern (Projects, Career, Academic)

Shared markup contract per section:
```html
<div data-expand-grid data-expand-section="project|career">
  <div data-expand-carousel></div>
  <div data-expand-stage></div>
  <div class="contents" data-expand-default>
    <article data-expand-card data-slug="...">
      <div class="card-face">...</div>       <!-- shown in grid + stage -->
      <div class="card-detail">...</div>     <!-- shown only in stage -->
      <div class="carousel-face">...</div>   <!-- shown only in carousel -->
      <button data-expand-back data-expand-ignore>...</button>
    </article>
    ...
  </div>
</div>
```
`initExpandableGrids()` in `motion.ts` moves ONLY the selected card into `data-expand-stage` (real `appendChild`); the rest stay hidden in the default slot via CSS. The carousel container holds a STATIC list of `.carousel-item` label buttons (one per slug, rendered in the component, covering every item including the selected one); the active label is highlighted via `data-active`. A FLIP animation (`flipOne()` helper) smooths the card's move into the stage. Visibility of `.card-face` / `.card-detail` / `.carousel-face` is pure CSS keyed off the ancestor (`.expand-stage .card-detail { display: flex }` etc, see `global.css`), not per-card JS classes. Don't duplicate content between `.card-face` and `.card-detail`, if something needs to show only when expanded (like Career's company prestige note), put a low-visibility span inside `.card-face` itself and reveal it via `.expand-stage .role-note { display: inline-block }` rather than repeating the whole block in `.card-detail`.

`data-expand-ignore` on an element (like the back button or the external "Visit site" link) stops its click from also triggering the card's own expand handler.

Cross-section links reuse the same system: any element with `data-open-section="project|career"` + `data-open-slug="..."` fires `initCrossLinks()`, which Lenis-scrolls to that section then dispatches a `portfolio:expand` custom event, which the matching grid picks up and expands. This is how About's highlighted keywords and Technology's clickable tiles jump to and open a specific card.

## Hero wordmark + photo blur-out

`Hero.astro` renders a giant low-opacity `FAVIAN` wordmark absolutely centered behind the content grid (z-index 0, content grid at z-index 10), and swaps the circular-cropped photo for a full-silhouette background-removed cutout (`public/images/profile-cutout.webp`, generated from `profile.jpeg` via a one-off `sharp` raw-pixel white-threshold alpha mask, verified by sampling actual pixel alpha, not just visual inspection). `initHeroMorph()` in `motion.ts` owns this photo's `opacity`/`transform`/`filter` completely: a one-time `gsap.from` entrance on load, then an explicit `gsap.fromTo` (not implicit `gsap.to`) scrubbed to Hero's scroll range that lifts, blurs, and fades the photo out as Hero scrolls away (mirroring how heynesh.com's hero photo exits, rather than traveling to a fixed nav position, there is no nav element left in the layout for it to travel toward, see Side navigation below). Because this element owns opacity for the whole Hero lifetime, it must never also carry `class="reveal" data-reveal`, if it did, `initReveals()`'s separate fade-in system would race `initHeroMorph()` for the same property and the implicit-`gsap.to` "from" value would get captured mid-race (this exact bug happened once, verify with `getComputedStyle(photo).opacity` sampled at 0/25/50/99% scroll if this area regresses). General rule: no two systems animate the same property on the same element without one of them explicitly owning it.

## Side navigation

The nav is a single persistent element, not the earlier top-header-plus-floating-dots setup: `SideNav.astro` renders a fixed `left-6 lg:left-10 top-1/2 -translate-y-1/2` column (text links + social icons, `hidden md:flex`) that never hides and never disappears, active section highlighted via the same `[data-section]`/`initActiveSection()` wiring the old header dots used. It stays mounted through the whole page, not just Hero, styled to match heynesh.com's persistent side rail. `Header.astro` is now mobile-only (`md:hidden` on the whole `<header>`): just the logo plus hamburger toggle, opening the existing fullscreen mobile menu. Because `SideNav` occupies a fixed column at md+, `.section` in `global.css` adds `padding-left: 12rem` (`14rem` at `lg`) starting at the `768px` breakpoint so content never sits underneath it, do not remove that padding without also solving the overlap another way. There is deliberately no idle-hide system anymore (the old `initIdleUI()`/`[data-idle-ui]`/`header[data-idle]` machinery was removed outright): a nav that vanishes after a few seconds of stillness was the exact complaint that drove this redesign, so nothing here should ever be wired back into an auto-hide timer.

## Section separators

`.section + .section` in `global.css` draws a solid 1px top border (`var(--color-primary-strong)`, not a low-opacity wash) between adjacent sections, a deliberate visual break so each section reads as its own "page" even though the scroll motion itself stays smooth (Lenis) and section backgrounds still cross-fade via the gradient system below. Don't remove this thinking it conflicts with "seamless scroll", the two are orthogonal: motion is seamless, boundaries are visually clear.

## Color policy

The palette is intentionally restricted to black, dark blue, and white, no purple/violet/cyan/magenta. All of it flows from the `@theme` tokens in `global.css` (`--color-bg`, `--color-primary*`, `--color-accent`, `--color-text-muted`), `motion.ts`'s `sectionPalettes` (the per-section gradient-blob colors), and `GradientField.astro`'s default `--blob-*` values, all three must stay in the same dark-blue/near-black family if you touch any of them. Section headings all use the single `text-accent` token now, not per-section rainbow hex values (`text-[#a78bfa]` etc used to vary Achievements/Academic/Technology/Projects/Certifications/Career independently, that was the "gradient" look the user explicitly asked to remove). The one exception is `technology.ts`'s `glow` field: those are the real brand colors of each language/tool (Python blue, JS yellow, PHP purple, etc), left untouched on purpose, recoloring a technology's own logo to fit the site palette would misrepresent its brand identity, that's different from decorative site chrome.

## Scroll-lock

`initScrollLock()` finds whichever section currently covers the most viewport area, and if that section's `h1`/`h2` sits between 40% and 60% of viewport height, waits 1s of continued stillness then Lenis-snaps to it. Guards against fighting its own triggered scroll via an `isSnapping` flag. If this ever feels too aggressive, the fix is tuning the 40-60% band or the 1000ms delay, not ripping the feature out.

## Other conventions

- Directional/navigation actions use `.text-cta` (highlighted text + arrow, e.g. "Visit site →", "← Return"), not boxed buttons. Boxed buttons are reserved for primary CTAs (CV, form submit).
- Contact is a form (Name/Email/Subject/Message) whose submit opens a prefilled Gmail compose window (`https://mail.google.com/mail/?view=cm...`) addressed to the user. No backend, nothing stored; keep it that way unless the user picks a form service.
- Projects/Certification/Career grids carry `data-hscroll`: collapsed state is a row of fixed-width nesh-style cards translated horizontally by vertical scroll. This lives inside `initExpandableGrids()` in `motion.ts` (not a separate function), via `createHscrollPin()`/`destroyHscrollPin()`: the section is GSAP-`pin: true`'d for the duration of the row's translateX, so the page cannot scroll past a still-animating carousel, it visually "finishes" the row before releasing the pin. The pin lifecycle is coordinated with expand/collapse: `expand(slug)` calls `destroyHscrollPin()` before the FLIP transition (the row layout changes entirely once a card is staged), `collapse()` rebuilds it via `createHscrollPin()` on the next two animation frames. Academic stays a numbered row list (`data-list`, no pin).
- Dummy carousel-filler entries in `projects.ts`/`certifications.ts` have `dummy: true` and are excluded from About's stats. Never let dummies leak into stats or FACT.md.
- The horizontal carousel's scrub is a pure function of absolute scroll position (GSAP `scrub: true`), so landing directly on a mid-scrolled section (hash link, refresh) already shows the correct offset with no "first visit" replay needed. Because web-font swap and late image loads can shift section heights and stale the trigger measurements taken at init, the hscroll setup re-runs via a `resettle()` (`destroyHscrollPin()` + `createHscrollPin()`) on `document.fonts.ready` and `window load` as a safety net, don't remove that.
- The vertical carousel (expanded-state label list) changes selection on `wheel` over the carousel itself, not just click, mirroring the horizontal carousel's scroll-driven feel. See the `wheel` listener in `initExpandableGrids()`. Touch devices never fire `wheel`, so there's a second, parallel `scroll` listener on the same carousel that watches native `scrollTop` (the list already has `overflow-y: auto`) and snaps to whichever label sits nearest the container's center, this is what makes the carousel usable on mobile. The two never conflict: the wheel handler's `preventDefault` keeps `scrollTop` from moving at all on desktop. The expanded layout itself (`[data-expand-grid][data-expanded]`) stacks carousel-above-stage in a column below the `768px` breakpoint and only switches to the row layout at `md+`, a fixed-width side-by-side row on a narrow phone screen was the other half of "vertical carousel doesn't work on mobile."
- Pinned hscroll sections rely on `ScrollTrigger.config({ ignoreMobileResize: true })` (set once, near `gsap.registerPlugin`). Mobile browsers fire a `resize` event when the address bar collapses/expands mid-scroll, without this flag ScrollTrigger treats that as a real viewport change and re-measures the pin mid-transition, which is why the horizontal carousel used to fall short of the end of the row on phones. Don't remove this to "fix" an unrelated resize bug without checking mobile hscroll first.
- Back buttons in expanded cards are icon-only (`.back-arrow-icon`, a CSS `mask-image` using `public/images/icons/back-arrow.webp` recolored via `background-color: currentColor`), no "Return" text.
- Programmatic scrolls must go through `scrollProgrammatic()` in motion.ts, which suppresses the scroll-lock while the tween is in flight. Cross-links scroll to the target `[data-expand-grid]` (the content), not the section heading.
- Browser-testing note: Lenis animates on requestAnimationFrame, which Chrome pauses in backgrounded tabs, so automated scroll verification in a background tab will appear frozen. Verify scroll targets by instrumenting `lenis.scrollTo` calls instead.

## Assets

Company logos under `public/images/companies/` are real. `public/images/placeholders/expand.webp` and `logo.webp` are still stand-ins for missing project/certification imagery (not the abstract hand-authored SVGs earlier notes described, they're compressed WebP), `dev/TASK.md` tracks swapping them for the real thing. Any new image dropped in must go through the same treatment the existing ones did: resized to its actual display footprint and converted to WebP via `sharp` before committing, the placeholder PNGs this replaced were 900KB-1.2MB unoptimized files being loaded on every page view, that's the kind of regression to watch for. Non-hero `<img>` tags should carry `loading="lazy" decoding="async"`, only Hero's photo (the LCP element) stays eager.
