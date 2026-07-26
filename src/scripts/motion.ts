import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

declare global {
  interface Window {
    lenisInstance?: Lenis;
  }
}

gsap.registerPlugin(ScrollTrigger);

// Mobile browsers fire a resize event when the address bar collapses/expands
// mid-scroll. Without this, ScrollTrigger treats that as a real viewport
// change and re-measures pinned sections (the hscroll carousels) mid-pin,
// which shortens or drifts the scroll distance needed to reach the end of
// the row. This is GSAP's documented fix for that exact class of bug.
// fastScrollEnd fixes the companion bug: a very fast flick can blow past a
// trigger's start/end in a single frame, sometimes leaving a scrubbed
// tween (the Hero photo's opacity, a pinned carousel) stuck mid-transition
// instead of snapping to its resolved end state, this is GSAP's own
// documented fix for that class of glitch.
// fastScrollEnd is a real runtime option missing from this GSAP version's
// type declarations (see node_modules/gsap/ScrollTrigger.js), hence the cast.
ScrollTrigger.config({ ignoreMobileResize: true, fastScrollEnd: true } as ScrollTrigger.ConfigVars & { fastScrollEnd: boolean });

// While a programmatic scroll (anchor click, cross-link) is in flight, the
// scroll-lock must not fire its own competing snap.
let suppressLockUntil = 0;

function scrollProgrammatic(target: HTMLElement, opts: { offset?: number; duration?: number } = {}) {
  const lenis = window.lenisInstance;
  if (!lenis) return;
  const duration = opts.duration ?? 1.2;
  suppressLockUntil = Date.now() + duration * 1000 + 1500;
  lenis.scrollTo(target, { duration, offset: opts.offset ?? 0 });
}

function initSmoothScroll() {
  const lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
  });

  window.lenisInstance = lenis;

  lenis.on('scroll', ScrollTrigger.update);

  // Lenis measures its own scrollable `limit` once, synchronously, at
  // construction time, here in initSmoothScroll(), which runs before
  // initExpandableGrids() creates the hscroll pins further down in init().
  // Each pin inserts a GSAP pin-spacer into the document to reserve its
  // scroll distance, growing the real page height well past what Lenis
  // already measured, so Lenis's `limit` permanently undershoots the true
  // max scroll (by exactly the combined height of every pin-spacer) unless
  // something tells it to re-measure. ScrollTrigger's own `refresh` event
  // is the right hook, it already fires after pin creation and every later
  // deferredRefresh()/resettle() call (font load, expand/collapse, window
  // resize), so this keeps Lenis in sync for the lifetime of the page
  // instead of a one-off fix. Without this, scrollTo() on a target beyond
  // the stale limit silently clamps short, this was the literal cause of
  // clicking a nav link deep in the page leaving the previous section
  // still partly visible instead of the target section filling the screen.
  ScrollTrigger.addEventListener('refresh', () => lenis.resize());

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      scrollProgrammatic(target as HTMLElement, { duration: 1.2 });
    });
  });
}

function initReveals() {
  const groups = new Map<Element, Element[]>();

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const section = el.closest('section');
    if (!section) return;
    const list = groups.get(section) ?? [];
    list.push(el);
    groups.set(section, list);
  });

  groups.forEach((elements, section) => {
    gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 70%',
        toggleActions: 'play none none reverse',
      },
    }).to(elements, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.12,
    });
  });
}

function initParallax() {
  document.querySelectorAll<HTMLElement>('[data-parallax-bg]').forEach((el) => {
    gsap.to(el, {
      yPercent: 20,
      ease: 'none',
      scrollTrigger: {
        trigger: el.closest('section'),
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });

  document.querySelectorAll<HTMLElement>('[data-parallax-image]').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: 8, scale: 1.04 },
      {
        yPercent: -8,
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('section'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}

function initActiveSection() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('section[id]'));
  const dots = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));

  sections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => setActive(section.id),
      onEnterBack: () => setActive(section.id),
    });
  });

  function setActive(id: string) {
    dots.forEach((dot) => {
      dot.setAttribute('data-active', String(dot.dataset.section === id));
    });
  }
}

function deferredRefresh() {
  // Wait for the FLIP transition (0.6s) to fully settle before letting
  // ScrollTrigger re-measure, otherwise the refresh fights in-flight
  // Lenis tweens and mid-transform layout.
  setTimeout(() => ScrollTrigger.refresh(), 700);
}

function flipOne(el: HTMLElement, mutate: () => void) {
  const first = el.getBoundingClientRect();
  mutate();
  const last = el.getBoundingClientRect();
  if (!last.width || !last.height) return;

  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / last.width;
  const sy = first.height / last.height;

  gsap.fromTo(
    el,
    { x: dx, y: dy, scaleX: sx, scaleY: sy, opacity: 0.4 },
    {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      duration: 0.6,
      ease: 'power3.inOut',
      clearProps: 'transform,opacity',
    },
  );
}

function initExpandableGrids() {
  document.querySelectorAll<HTMLElement>('[data-expand-grid]').forEach((grid) => {
    const sectionId = grid.dataset.expandSection ?? '';
    const carousel = grid.querySelector<HTMLElement>('[data-expand-carousel]');
    const stage = grid.querySelector<HTMLElement>('[data-expand-stage]');
    const defaultSlot = grid.querySelector<HTMLElement>('[data-expand-default]');
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-expand-card]'));
    const labels = Array.from(grid.querySelectorAll<HTMLElement>('[data-carousel-item]'));
    if (!defaultSlot) return;

    // Sections with a horizontal card carousel (data-hscroll) pin in place
    // for exactly the scroll distance the row needs to fully translate, so
    // the page can't be scrolled past it mid-transition and leave cards
    // half-revealed. The pin is torn down while a card is expanded (the
    // row is hidden then anyway) and rebuilt on collapse.
    const isHscroll = grid.hasAttribute('data-hscroll');
    const pinSection = isHscroll ? grid.closest('section') : null;
    let hscrollTrigger: ScrollTrigger | null = null;

    function createHscrollPin() {
      // Desktop-only, matching initHeroFlip's own breakpoint. GSAP's
      // pin+scrub technique for translating the row via vertical scroll
      // fights real touch/momentum scrolling on phones (confirmed in
      // production: the row visually scrambled instead of translating
      // smoothly), the same class of problem nesh's own reference sidesteps
      // by giving mobile its own separate, simpler hero image entirely
      // rather than reusing the desktop effect. Below 768px the row instead
      // falls back to plain native horizontal scroll (`overflow-x: auto` in
      // global.css's mobile override), no GSAP involved at all.
      if (!isHscroll || !pinSection || hscrollTrigger || window.innerWidth < 768) return;
      const distance = Math.max(0, defaultSlot!.scrollWidth - defaultSlot!.clientWidth);
      if (distance <= 0) return;

      const tween = gsap.to(defaultSlot, { x: -distance, ease: 'none', paused: true });
      hscrollTrigger = ScrollTrigger.create({
        trigger: pinSection,
        start: 'top top',
        // The extra distance past the row's own width is a deliberate
        // dwell: reaching the last card holds the pin a bit longer instead
        // of instantly releasing back to the main page. Kept short (0.15
        // instead of an earlier 0.4) since a longer dwell reads as "the
        // carousel is stuck" on a fast scroll, the pin is technically
        // still correctly mid-range, but the user has already flicked
        // several viewport-heights further and expects to be well past it.
        end: () => `+=${distance + window.innerHeight * 0.15}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        animation: tween,
        invalidateOnRefresh: true,
      });
    }

    function destroyHscrollPin() {
      hscrollTrigger?.kill();
      hscrollTrigger = null;
      gsap.set(defaultSlot, { clearProps: 'transform' });
    }

    createHscrollPin();

    if (isHscroll) {
      // Web fonts swapping in after first paint (or images loading below
      // the fold) shift section heights, which silently stales the pin
      // distance measured at init.
      const resettle = () => {
        if (grid.hasAttribute('data-expanded')) return;
        destroyHscrollPin();
        createHscrollPin();
      };
      if ('fonts' in document) {
        document.fonts.ready.then(resettle);
      }
      window.addEventListener('load', resettle);

      // Also resettle on resize (debounced), specifically so crossing the
      // 768px breakpoint toggles the pin on/off: destroy always runs
      // (harmless if there was no pin), create re-checks the width itself.
      let hscrollResizeTimer: ReturnType<typeof setTimeout>;
      window.addEventListener('resize', () => {
        clearTimeout(hscrollResizeTimer);
        hscrollResizeTimer = setTimeout(resettle, 200);
      });
    }

    // Some hscroll grids (Certification) are pin-only: a scroll-driven row
    // of cards with no click-to-expand stage. Nothing below this point
    // applies without a carousel/stage to expand into.
    if (!carousel || !stage) return;

    function syncLabels(slug: string) {
      const activeIndex = labels.findIndex((label) => label.dataset.slug === slug);
      labels.forEach((label, index) => {
        label.setAttribute('data-active', String(label.dataset.slug === slug));
        if (activeIndex === -1) {
          label.removeAttribute('data-dist');
        } else {
          label.setAttribute('data-dist', String(Math.min(3, Math.abs(index - activeIndex))));
        }
      });
    }

    // Re-appending every card in source order restores the original grid
    // layout regardless of which card was pulled out into the stage.
    function restoreOrder() {
      cards.forEach((card) => defaultSlot!.appendChild(card));
    }

    function collapse() {
      restoreOrder();
      grid.removeAttribute('data-expanded');
      syncLabels('');
      gsap.fromTo(
        cards,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.05, clearProps: 'transform,opacity' },
      );
      deferredRefresh();
      // Wait for layout to settle back into the collapsed row before
      // re-measuring the pin distance.
      requestAnimationFrame(() => requestAnimationFrame(createHscrollPin));
    }

    function expand(slug: string) {
      if (grid.getAttribute('data-expanded') === slug) return;
      const card = cards.find((c) => c.dataset.slug === slug);
      if (!card) return;

      const wasExpanded = grid.hasAttribute('data-expanded');
      // Killing the hscroll pin below collapses its pin-spacer (real
      // document height reserved for the horizontal scroll distance) back
      // down to the section's normal single-viewport height. Since the
      // user is clicking a card WHILE the section is pinned, the viewport
      // is currently positioned somewhere inside that spacer's extra
      // height, above where the section will resettle. scrollY itself
      // doesn't change when the spacer collapses, so the page content
      // above/at the viewport just got shorter and the viewport ends up
      // looking at whatever shifted up into the same pixel offset, which
      // reads as being tossed into the NEXT section. Capture the pinned
      // section's on-screen position before the kill and re-apply it
      // immediately after, canceling the shift regardless of how far into
      // the pin the user was.
      const anchorBefore = pinSection?.getBoundingClientRect().top ?? null;
      destroyHscrollPin();
      if (anchorBefore !== null && pinSection) {
        const delta = pinSection.getBoundingClientRect().top - anchorBefore;
        if (delta !== 0) {
          window.lenisInstance?.scrollTo(window.scrollY + delta, { immediate: true });
        }
      }

      if (wasExpanded) {
        // Cycling between already-expanded cards (vertical-carousel wheel
        // browsing) should read as a continuous slide between cards, not a
        // repeated "pop" from the grid. FLIP can't do that here anyway:
        // the outgoing card is display:none while hidden (only the staged
        // card is shown), so its "first" rect would be zero-size and the
        // scale math would degenerate into an instant snap. A plain
        // cross-fade/slide reads as scroll-like instead.
        restoreOrder();
        stage!.appendChild(card);
        grid.setAttribute('data-expanded', slug);
        gsap.fromTo(
          card,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'transform,opacity' },
        );
      } else {
        flipOne(card, () => {
          restoreOrder();
          stage!.appendChild(card);
          grid.setAttribute('data-expanded', slug);
        });
      }

      gsap.fromTo(
        carousel,
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform,opacity' },
      );

      syncLabels(slug);
      deferredRefresh();
    }

    labels.forEach((label) => {
      label.addEventListener('click', (event) => {
        event.stopPropagation();
        expand(label.dataset.slug ?? '');
      });
    });

    // There is deliberately NO scroll-driven card cycling inside an
    // expanded grid. An earlier version stepped to the next/previous card
    // on `wheel` over the expanded region and suppressed page scroll while
    // doing so (via `data-lenis-prevent` plus `event.preventDefault()`).
    // It was removed outright on explicit instruction: it never behaved
    // reliably at the boundary, the last card kept bouncing back to the
    // previous one and forward again while ALSO releasing the page to
    // scroll onward, so the user lost control of both the carousel and the
    // page at the same time. Selection now changes only by clicking a
    // carousel label (or a card, or a cross-link), and page scroll is never
    // hijacked while a card is expanded. Do not reintroduce a wheel/scroll
    // handler here.
    cards.forEach((card) => {
      card.addEventListener('click', (event) => {
        if ((event.target as HTMLElement).closest('[data-expand-ignore]')) return;
        expand(card.dataset.slug ?? '');
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          expand(card.dataset.slug ?? '');
        }
      });
    });

    grid.querySelectorAll<HTMLElement>('[data-expand-back]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        collapse();
      });
    });

    document.addEventListener('portfolio:expand', (event) => {
      const detail = (event as CustomEvent<{ section: string; slug: string }>).detail;
      if (detail.section !== sectionId) return;
      expand(detail.slug);
    });
  });
}

function initCrossLinks() {
  document.querySelectorAll<HTMLElement>('[data-open-section]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const section = el.dataset.openSection;
      const slug = el.dataset.openSlug;
      if (!section || !slug) return;

      // Expand first, then aim the viewport at the expanded card itself
      // rather than the section heading. The small delay lets the expanded
      // layout settle so the scroll target position is measured correctly.
      document.dispatchEvent(new CustomEvent('portfolio:expand', { detail: { section, slug } }));

      setTimeout(() => {
        const grid = document.querySelector<HTMLElement>(
          `[data-expand-grid][data-expand-section="${section}"]`,
        );
        const dest = grid ?? document.getElementById(section);
        if (dest) {
          scrollProgrammatic(dest, { duration: 1.0, offset: -90 });
        }
      }, 120);
    });
  });
}

function initScrollLock() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('section[id]'));
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  let lockTimer: ReturnType<typeof setTimeout> | null = null;
  let isSnapping = false;
  // A short cooldown after a lock completes stops it from immediately
  // re-triggering on the next section over, adjacent sections whose
  // headings both briefly pass through the 40-60% band (like Achievement's
  // long list bleeding into Contact) were snapping back and forth into
  // each other instead of settling.
  let cooldownUntil = 0;

  function mostVisibleSection(): HTMLElement | null {
    const vh = window.innerHeight;
    let best: HTMLElement | null = null;
    let bestRatio = 0;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const visible = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      const ratio = visible / Math.min(rect.height, vh);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = section;
      }
    });

    return best;
  }

  // Whether this section is worth snapping to: it must be misaligned by a
  // real amount, but not so far that snapping would yank the user across a
  // large distance they clearly scrolled on purpose.
  //
  // This deliberately replaces an earlier "is the section's own h1/h2
  // between 40% and 60% of viewport height" test, which was the actual
  // cause of the lock feeling inconsistent and direction-dependent: that
  // band is a thin ~20%-of-viewport window that a heading only passes
  // through at all if you happen to stop scrolling at the right moment,
  // and (worse) a heading enters it at a DIFFERENT scroll position going
  // down than coming back up, since the heading sits near the section's
  // top rather than its middle, so scrolling up frequently skipped the
  // snap entirely. Aligning on the section's own top edge instead is
  // symmetric by construction: the same target scroll position in both
  // directions, and every section qualifies at some point on the way past
  // it, no timing luck required.
  //
  // Pinned hscroll sections (Project, Certification, Career) are naturally
  // exempt while pinned, GSAP holds them at rect.top === 0 for the whole
  // pin, which is already inside the aligned dead zone, so no snap fires
  // and the horizontal scroll is never interrupted.
  function snapOffset(section: HTMLElement): number | null {
    const top = section.getBoundingClientRect().top;
    const dist = Math.abs(top);
    if (dist <= 2) return null; // Already aligned, nothing to do.
    if (dist > window.innerHeight * 0.5) return null; // Too far, leave it alone.
    return top;
  }

  // Total idle-to-resolved budget is kept well under 1s end to end (60ms
  // scroll-idle debounce + 60ms confirm delay + a 450ms snap): the site
  // must never leave a visible section boundary on screen for longer than
  // a user can consciously notice while idling.
  function attemptLock() {
    if (isSnapping || Date.now() < suppressLockUntil || Date.now() < cooldownUntil) return;
    const section = mostVisibleSection();
    if (!section || snapOffset(section) === null) return;

    lockTimer = setTimeout(() => {
      const stillBest = mostVisibleSection();
      if (stillBest !== section || snapOffset(section) === null) return;

      const lenis = window.lenisInstance;
      if (!lenis) return;

      isSnapping = true;
      lenis.scrollTo(section, {
        duration: 0.45,
        onComplete: () => {
          isSnapping = false;
          cooldownUntil = Date.now() + 350;
        },
      });
    }, 60);
  }

  window.lenisInstance?.on('scroll', () => {
    if (isSnapping || Date.now() < suppressLockUntil || Date.now() < cooldownUntil) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    if (lockTimer) clearTimeout(lockTimer);
    scrollTimer = setTimeout(attemptLock, 60);
  });
}

// Hero is pinned (see initHeroFlip) for this many EXTRA viewport-heights of
// scroll beyond its own natural 100vh, so the FAVIAN/nav/desc/stats morph
// has more scroll distance to play out instead of finishing within a
// single viewport-height of scroll, which felt rushed. Shared between
// initHeroMorph and initHeroFlip so every Hero-scoped trigger stays paced
// to the SAME total, computed as an absolute pixel function (not a
// percentage string like '50% top') on purpose: percentage shorthand
// resolves against the trigger element's own natural rect height, which
// stays Hero's un-pinned 100vh regardless of a separate pin extending the
// real scroll distance, silently decoupling a trigger's timing from the
// pin's actual duration. Since Hero is always the first section on the
// page (document-relative top 0), `start: 0` is exact, not a guess.
const HERO_EXTRA_VH = 1.5;
function heroTotalScroll() {
  return window.innerHeight * (1 + HERO_EXTRA_VH);
}

// The sidebar-to-footer fade (initFooterMorph) spans this many
// viewport-heights of scroll too, matching heroTotalScroll()'s total
// (1 + HERO_EXTRA_VH) so the closing transition feels as graceful and
// unrushed as the opening one, instead of the sudden last-few-hundred-px
// fade an earlier version used.
const FOOTER_FADE_VH = 1 + HERO_EXTRA_VH;

// The Hero photo is fixed to the viewport (not the page), so scrolling
// never moves it, it only blurs and fades away in place as Hero scrolls
// out, rather than lifting/scaling toward some other position.
function initHeroMorph() {
  const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
  const heroSection = document.getElementById('home');
  if (!photo || !heroSection) return;

  gsap.from(photo, { opacity: 0, duration: 0.9, delay: 0.3, ease: 'power3.out' });

  gsap.fromTo(
    photo,
    { opacity: 1, filter: 'blur(0px)' },
    {
      opacity: 0,
      filter: 'blur(28px)',
      ease: 'none',
      scrollTrigger: {
        trigger: heroSection,
        start: 0,
        end: () => heroTotalScroll() * 0.5,
        scrub: true,
      },
    },
  );
}

// Hero's landing look (giant name, wide-spread nav, flanking desc/stats)
// isn't separate markup that fades in over the SideNav, it IS the SideNav's
// own elements: each one starts (scroll 0) transformed to sit at a
// computed Hero position/size, then scrubs back to `transform: none`, its
// natural resting spot in the sidebar, as Hero scrolls out. A literal move
// (FLIP: translate + scale from a computed "first" rect to the element's
// real "last" rect), not a cross-fade between two different elements.
//
// All of this is rebuilt (not just computed once) on a debounced resize,
// via gsap.context() so the previous run's tweens/triggers are cleanly
// killed first, none of the pixel math here is meant to be a one-shot
// calculation baked in at load, a desktop window resize or a tablet
// rotating needs the same FAVIAN/nav/desc/stats geometry recomputed for
// the new viewport. Below md the sidebar is hidden entirely (mobile uses
// Header.astro's hamburger instead), so the context is torn down and
// nothing is built.
function initHeroFlip() {
  const heroSection = document.getElementById('home');
  const nav = document.querySelector<HTMLElement>('[data-side-nav]');
  if (!heroSection || !nav) return;

  let ctx: gsap.Context | null = null;
  let heroPin: ScrollTrigger | null = null;

  function build() {
    ctx?.revert();
    ctx = null;
    heroPin?.kill();
    heroPin = null;
    if (window.innerWidth < 768) return;

    // Pins Hero in place for heroTotalScroll() total pixels of scroll
    // (its own 100vh plus HERO_EXTRA_VH more), instead of letting it
    // scroll away naturally after exactly one viewport-height. Without
    // this, extending the morph tweens' own end point past Hero's natural
    // height would do nothing visible: Hero's fixed-position content
    // (the photo, and everything FLIP-morphed here) already renders
    // regardless of Hero's own scroll position, so About would simply
    // scroll into view underneath/over it while the tweens kept updating
    // off-screen. Pinning is what actually holds About back for the
    // extra distance, giving the morph real, visible extra time.
    heroPin = ScrollTrigger.create({
      trigger: heroSection,
      start: 0,
      end: () => heroTotalScroll(),
      pin: true,
      pinSpacing: true,
    });

    ctx = gsap.context(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 32; // 2rem: same side gap the old wordmark used.
    const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
    // GSAP expects its own vars object per tween, reusing one scrollTrigger
    // object literal across many gsap.fromTo() calls causes only the first
    // to actually bind, this factory hands each tween a fresh copy. Uses
    // the SAME absolute-pixel heroTotalScroll() as the pin above (not
    // 'bottom top'), so the morph's progress is paced to the pin's real
    // duration, see the note on HERO_EXTRA_VH for why percentage shorthand
    // can't be trusted to pick this up automatically.
    const heroTrigger = () => ({ trigger: heroSection, start: 0, end: () => heroTotalScroll(), scrub: true });

      // Panels are transparent until the morph resolves, so content never
      // sits inside a visible white box while it's still meant to read as
      // Hero content with nothing behind it.
      document.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => {
        gsap.fromTo(
          panel,
          { backgroundColor: 'rgba(255,255,255,0)' },
          { backgroundColor: 'rgba(255,255,255,1)', ease: 'none', scrollTrigger: heroTrigger() },
        );
      });

      // Content with no Hero counterpart (company marquee, email, contact
      // button) has nothing to morph FROM, so it just appears over the final
      // stretch of the range instead of scrubbing the full one.
      document.querySelectorAll<HTMLElement>('[data-hero-fade]').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0 },
          {
            opacity: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: heroSection,
              start: () => heroTotalScroll() * 0.6,
              end: () => heroTotalScroll(),
              scrub: true,
            },
          },
        );
      });

      function scrubFlip(el: HTMLElement, first: { left: number; top: number; width: number; height: number }) {
        // CSS transform has no visual effect on display:inline boxes (a bare
        // <span> or <a>, this WAS the reason FAVIAN and the nav links FLIP
        // silently failed to render: the inline style showed a real
        // translate/scale, getComputedStyle even echoed it back, but nothing
        // actually painted, confirmed empirically by toggling display and
        // watching the rendered rect jump). Flex children still compute as
        // "inline" here even though the flex algorithm blockifies them for
        // layout, so this check still needs to run for them.
        if (getComputedStyle(el).display === 'inline') {
          el.style.display = 'inline-block';
        }
        const last = el.getBoundingClientRect();
        if (!last.width || !last.height) return;
        el.style.transformOrigin = 'top left';
        gsap.fromTo(
          el,
          {
            x: first.left - last.left,
            y: first.top - last.top,
            scaleX: first.width / last.width,
            scaleY: first.height / last.height,
          },
          { x: 0, y: 0, scaleX: 1, scaleY: 1, ease: 'none', scrollTrigger: heroTrigger() },
        );
      }

      // Like scrubFlip, but takes an explicit UNIFORM scale instead of
      // deriving scaleX/scaleY from a target width/height. Use this whenever
      // the element's resting box isn't its visual content box (a `w-full`
      // link inside a narrow column, say), where the width-ratio path would
      // compare text width against container width and scale the element
      // the wrong way.
      function scrubMove(el: HTMLElement, first: { left: number; top: number; scale: number }) {
        if (getComputedStyle(el).display === 'inline') {
          el.style.display = 'inline-block';
        }
        const last = el.getBoundingClientRect();
        if (!last.width || !last.height) return;
        el.style.transformOrigin = 'top left';
        gsap.fromTo(
          el,
          {
            x: first.left - last.left,
            y: first.top - last.top,
            scaleX: first.scale,
            scaleY: first.scale,
          },
          { x: 0, y: 0, scaleX: 1, scaleY: 1, ease: 'none', scrollTrigger: heroTrigger() },
        );
      }

      // Panel text is black at rest (white panel, per the sidebar's color
      // rule), which would be invisible against Hero's pure black background
      // mid-morph. Each morph target's own color scrubs from white to black
      // in lockstep with its panel's background scrubbing the other way, its
      // descendants have no color class of their own so they inherit this
      // live (not just at rest, DURING the scrub too, since CSS inheritance
      // re-resolves on every inline-style update, not just on mount).
      function scrubColor(el: HTMLElement) {
        gsap.fromTo(
          el,
          { color: 'rgba(255,255,255,1)' },
          { color: 'rgba(0,0,0,1)', ease: 'none', scrollTrigger: heroTrigger() },
        );
      }

      // The nav grid sits directly over FAVIAN's letters (that's the
      // point, the name runs behind literally everything), so a link's
      // white Hero-time text can land partly on a white letter stroke and
      // partly on the black page background in the same word, the two
      // blending unpredictably and reading as text that's missing letters
      // (confirmed visually: "Home" rendered as "...ome", the "H" and "o"
      // sitting on the letter-stroke). A small translucent dark backdrop,
      // faded out to transparent by rest once the panel's own white
      // background takes over, guarantees legible contrast against either
      // background without needing a visible grid container of its own.
      function scrubBackdrop(el: HTMLElement) {
        gsap.fromTo(
          el,
          { backgroundColor: 'rgba(0,0,0,0.55)' },
          { backgroundColor: 'rgba(0,0,0,0)', ease: 'none', scrollTrigger: heroTrigger() },
        );
      }

      // Nav links no longer compete with FAVIAN or the photo for vertical
      // space at all: they're grouped into a compact grid in the
      // horizontal gap beside the photo instead (see below), so measuring
      // them up front only matters for sizing that grid, not for budgeting
      // the name's height. Each link carries `w-full` (100% of the
      // sidebar's stacked column) for its resting layout, which makes
      // getBoundingClientRect report the CONTAINER's width rather than the
      // link's own text width, so measure with that override temporarily
      // lifted.
      const linkEls = Array.from(document.querySelectorAll<HTMLElement>('[data-morph-link]'));
      const linkNaturalRects = linkEls.map((el) => {
        const prevWidth = el.style.width;
        const prevDisplay = el.style.display;
        el.style.width = 'auto';
        el.style.display = 'inline-block';
        const rect = el.getBoundingClientRect();
        el.style.width = prevWidth;
        el.style.display = prevDisplay;
        return rect;
      });
      const gridGap = 16;
      // Nav links are SCALED UP at Hero time by a single uniform factor
      // derived from font size, not via scrubFlip's width-ratio path like
      // the name: because of the `w-full` above, a link's resting box is
      // the whole sidebar column, so `first.width / last.width` would
      // compare the link's TEXT width against its CONTAINER width and come
      // out below 1, scaling the links DOWN into unreadable specks (this
      // shipped once). Uniform scale + translate only, via scrubMove().
      const linkRestSize = linkEls.length ? parseFloat(getComputedStyle(linkEls[0]).fontSize) : 14;
      const heroNavSize = Math.max(16, Math.min(24, vw / 60));
      const navScale = heroNavSize / linkRestSize;
      const navRowHeight = linkNaturalRects.reduce((max, r) => Math.max(max, r.height), 0) * navScale;

      // Name -> FAVIAN: sized to fill the viewport width between the two
      // side gaps, full stop, no height budget. Its z-index (0) is beneath
      // EVERYTHING else on the page, including the photo (6) and the nav
      // grid (1), so it can never actually collide with anything, whatever
      // it overlaps just renders in front of it, that's the deliberate
      // "wordmark behind the picture" look. Anchored close to the very top
      // (a small fixed offset, not the full 2rem `gap` used for side
      // margins elsewhere), the name span itself needs `leading-none` in
      // SideNav.astro for this to actually look flush: without it, the
      // font's own line-height/ascent leading reserves space above the
      // visible glyphs (dozens of px at this scale), so the CSS box could
      // sit right at the offset while the visible letters still appeared
      // to start much further down.
      const nameTop = 8;
      const name = document.querySelector<HTMLElement>('[data-morph="name"]');
      if (name) {
        name.style.position = 'relative';
        name.style.zIndex = '0';
        const rest = name.getBoundingClientRect();
        const restSize = parseFloat(getComputedStyle(name).fontSize);
        name.style.fontSize = '100px';
        // getBoundingClientRect, not scrollWidth/offsetHeight: those are
        // unreliable (often 0) on display:inline elements like this span,
        // only block/inline-block boxes report them consistently.
        const naturalRect = name.getBoundingClientRect();
        const naturalWidth = naturalRect.width;
        name.style.fontSize = `${restSize}px`;
        if (naturalWidth) {
          const heroSize = Math.max(restSize, ((vw - gap * 2) / naturalWidth) * 100);
          const scale = heroSize / restSize;
          const heroWidth = rest.width * scale;
          const heroHeight = rest.height * scale;
          scrubFlip(name, {
            left: vw / 2 - heroWidth / 2,
            top: nameTop,
            width: heroWidth,
            height: heroHeight,
          });
          scrubColor(name);
        }
      }

      // Nav grid: since the photo is centered and only as wide as its own
      // (portrait) aspect ratio at 90vh tall, there's real horizontal room
      // left over on either side of it, wide enough at any normal desktop
      // width to hold every link in a compact block without needing any
      // vertical space above or below the photo at all. Placed in the gap
      // to its RIGHT specifically (photo.getBoundingClientRect(), safe to
      // read here since the photo is a static, non-scroll-tied `position:
      // fixed` element, its rect doesn't depend on current scroll
      // position), arranged into a grid (3 columns) rather than one long
      // row, bottom-aligned to sit level with the photo's own base while
      // the name sits at the top, the two anchored at opposite ends on
      // purpose. This is what actually resolves the nav-vs-photo AND
      // nav-vs-FAVIAN tension: nav no longer needs to carve out its own
      // dedicated vertical band at all, so neither the name nor the photo
      // has to shrink to make room for it.
      if (linkEls.length && photo) {
        const photoRect = photo.getBoundingClientRect();
        const cols = 3;
        const rows = Math.ceil(linkEls.length / cols);
        const areaLeft = photoRect.right + gap;
        const areaRight = vw - gap;
        const colWidth = Math.max(0, (areaRight - areaLeft - gridGap * (cols - 1)) / cols);
        const gridHeight = navRowHeight * rows + gridGap * (rows - 1);
        const gridTop = vh - gap - gridHeight;
        linkEls.forEach((el, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          el.style.position = 'relative';
          el.style.zIndex = '1';
          scrubMove(el, {
            left: areaLeft + col * (colWidth + gridGap),
            top: gridTop + row * (navRowHeight + gridGap),
            scale: navScale,
          });
          scrubColor(el);
          scrubBackdrop(el);
        });
      }

      // Desc -> left flank, Stats -> right flank, centered on the middle of
      // the bottom third of the viewport (0.835 = midpoint of the 67%-100%
      // band) rather than the full-viewport center, simply scaled up in
      // place, no width-fit precision needed like the name.
      const flankCenter = vh * 0.835;
      const desc = document.querySelector<HTMLElement>('[data-morph="desc"]');
      if (desc) {
        desc.style.position = 'relative';
        desc.style.zIndex = '1';
        const rest = desc.getBoundingClientRect();
        const scale = 1.8;
        const heroWidth = rest.width * scale;
        const heroHeight = rest.height * scale;
        scrubFlip(desc, { left: gap, top: flankCenter - heroHeight / 2, width: heroWidth, height: heroHeight });
        scrubColor(desc);
      }

      const stats = document.querySelector<HTMLElement>('[data-morph="stats"]');
      if (stats) {
        stats.style.position = 'relative';
        stats.style.zIndex = '1';
        const rest = stats.getBoundingClientRect();
        const scale = 1.6;
        const heroWidth = rest.width * scale;
        const heroHeight = rest.height * scale;
        scrubFlip(stats, {
          left: vw - gap - heroWidth,
          top: flankCenter - heroHeight / 2,
          width: heroWidth,
          height: heroHeight,
        });
        scrubColor(stats);
      }

    });
  }

  build();
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 200);
  });
}

// As the footer arrives, the sidebar (everything but the contact button)
// fades away, while the contact button itself loses its boxed-button
// styling (solid background, white text) in favor of Footer's own
// accent-colored text treatment, reading as "the button became text",
// before fading out alongside the rest, Footer already has its own real
// Connect section right there to take over. A literal FLIP of the
// button's position onto Footer's "Connect" heading was attempted
// (matching initHeroFlip's technique) and reliably failed to render any
// transform on this specific element despite multiple distinct fixes
// (inline vs block display, direct-flex-child blockification, removing
// the .btn-interactive transition), root cause never fully isolated. The
// color/fade version below sidesteps the whole class of bug.
function initFooterMorph() {
  const footer = document.querySelector<HTMLElement>('footer');
  const nav = document.querySelector<HTMLElement>('[data-side-nav]');
  const contactBtn = document.querySelector<HTMLElement>('[data-morph="contact"]');
  if (!footer || !nav) return;

  // Driven by a plain scroll listener that reads Footer's LIVE
  // getBoundingClientRect() on every update, not by a ScrollTrigger scrub
  // with cached start/end positions. ScrollTrigger's own string-based
  // positions ('top 90%', 'bottom bottom') and even explicit numeric
  // start/end FUNCTIONS were both tried first and both failed the same
  // way: correct on the first refresh, then silently recalculated to a
  // range thousands of pixels too early on a LATER refresh (fonts.ready /
  // window load), with document height and every pin-spacer height
  // provably unchanged in between, confirmed by logging every 'refresh'
  // event's resulting values, root cause never isolated. Reading the
  // live rect directly on every scroll tick has no cache to go stale in
  // the first place, so it sidesteps the entire class of bug regardless
  // of what was actually causing it.
  //
  // The two GSAP tweens below are created PAUSED (no scrollTrigger at
  // all) purely to reuse GSAP's own color/opacity interpolation, their
  // progress is set manually from the computed fraction instead of being
  // scrubbed by ScrollTrigger.
  const navFadeTween = gsap.fromTo(nav, { opacity: 1 }, { opacity: 0, ease: 'none', paused: true });
  const btnColorTween = contactBtn
    ? gsap.fromTo(
        contactBtn,
        { backgroundColor: 'rgba(0,0,0,1)', color: 'rgba(255,255,255,1)' },
        { backgroundColor: 'rgba(0,0,0,0)', color: 'var(--color-accent)', ease: 'none', paused: true },
      )
    : null;

  function apply() {
    if (window.innerWidth < 768) {
      navFadeTween.progress(0);
      btnColorTween?.progress(0);
      return;
    }
    // Progress is computed from CURRENT SCROLL POSITION relative to the
    // document's true max scroll, not from Footer's own rect: an earlier
    // version anchored "start" to Footer's top edge crossing 90% of the
    // viewport, which is only reachable a few hundred px before the true
    // end (bounded by Footer's own, usually modest, content height), so
    // the fade felt sudden/rushed compared to the Hero-to-About morph,
    // which was deliberately stretched to ~2.5 viewport-heights
    // (HERO_EXTRA_VH). FOOTER_FADE_VH matches that same duration so the
    // two transitions feel consistent, and since "end" is always the true
    // max scroll, this stays reachable regardless of Footer's real height.
    const vh = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - vh;
    const startScroll = maxScroll - vh * FOOTER_FADE_VH;
    const progress = Math.min(1, Math.max(0, (window.scrollY - startScroll) / (maxScroll - startScroll || 1)));
    navFadeTween.progress(progress);
    btnColorTween?.progress(progress);
  }

  // Only the button's COLOR is driven here, never its opacity. The button
  // carries data-hero-fade, so initHeroFlip already owns its opacity
  // across Hero's range, and the nav fade above already takes the whole
  // sidebar (including this button) away by the time Footer arrives. A
  // second opacity driver on this element would fight Hero's for control
  // of the same property (confirmed to cause exactly that: the button was
  // fully visible at the very top of the page, before Hero's own fade-in
  // should have even begun).
  window.lenisInstance?.on('scroll', apply);
  window.addEventListener('resize', apply);
  apply();
}

// The sidebar's two marquees (stats, company logos) are driven by GSAP, not
// by a CSS @keyframes animation. This is deliberate and is the fix for a
// bug that survived several rounds of "it looks correct in the CSS":
// `@media (prefers-reduced-motion: reduce) { animation: none }` silently
// disables a CSS animation, and that pref is on far more often than it
// looks, Windows 11 turns it on whenever "Show animations in Windows" is
// off (a common, often-default-off system setting) and it is forced on in
// this project's browser-automation environment, so BOTH the user's real
// browser and every automated check agreed the markup was right while
// nothing moved. GSAP tweens ignore that pref unless explicitly told to
// honor it, so driving the track from JS makes the motion actually happen.
//
// Each track renders three copies of its list (see SideNav.astro), so
// translating by exactly one third of the track's scrollWidth lands copy 2
// where copy 1 started, which is why the loop is seamless. Measure at run
// time rather than hardcoding a percentage: `x` here is in pixels, so it
// composes correctly with the FLIP transform initHeroFlip applies to the
// stats marquee's WRAPPER (a different element, `[data-morph="stats"]`),
// never apply both to the same node.
function initMarquees() {
  document.querySelectorAll<HTMLElement>('.marquee-track').forEach((track) => {
    let tween: gsap.core.Tween | null = null;

    const build = () => {
      tween?.kill();
      gsap.set(track, { x: 0 });
      const loopDistance = track.scrollWidth / 3;
      if (loopDistance <= 0) return;
      tween = gsap.fromTo(
        track,
        { x: -loopDistance },
        {
          x: 0,
          duration: loopDistance / 40, // ~40px per second, independent of list length.
          ease: 'none',
          repeat: -1,
        },
      );
    };

    build();
    // Web fonts and the company logo images both change the track's real
    // width after first paint, which would leave the loop distance measured
    // against a stale width and make the seam visible.
    if ('fonts' in document) document.fonts.ready.then(build);
    window.addEventListener('load', build);
  });
}

// Clicking the email copies it to the clipboard instead of opening a mail
// client, with the button's own text standing in for feedback (no separate
// toast element needed).
function initEmailCopy() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy-email]').forEach((btn) => {
    const email = btn.dataset.email ?? '';
    const original = btn.textContent ?? email;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(email);
      } catch {
        // Clipboard API can be blocked (insecure context, permissions);
        // the email is still visible/selectable as a fallback.
      }
      btn.textContent = 'Copied to clipboard';
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        btn.textContent = original;
      }, 2000);
    });
  });
}

function init() {
  initSmoothScroll();
  initReveals();
  initParallax();
  initActiveSection();
  initHeroMorph();
  initHeroFlip();
  initMarquees();
  initEmailCopy();
  // initExpandableGrids() must run before initFooterMorph(): it's what
  // creates the hscroll pin-spacers (Project, Certification, Career), and
  // those spacers grow the real page height significantly. initFooterMorph
  // measures Contact's position with string-based ScrollTrigger positions
  // ('bottom 55%' etc), calculated once at creation time against whatever
  // the document height is AT THAT MOMENT, if it ran first, Contact's
  // trigger would be positioned against a document thousands of pixels
  // shorter than the real one, firing the whole footer morph as early as
  // partway through Project, the same class of bug as the Lenis
  // pin-spacer-staleness one above, just for a different consumer of page
  // geometry, confirmed by sampling opacity across the full scroll range
  // and finding the fade actually completed before Contact even arrived.
  initExpandableGrids();
  initFooterMorph();
  initCrossLinks();
  initScrollLock();

  // Belt-and-suspenders alongside the ScrollTrigger 'refresh' listener in
  // initSmoothScroll(): the hscroll pins created just above by
  // initExpandableGrids() grow the real page height via GSAP's
  // pin-spacers, resize() once more here (next frame, so the spacers are
  // definitely in the DOM) guarantees Lenis's limit is correct for the
  // very first scroll, not just after some later refresh happens to fire.
  requestAnimationFrame(() => window.lenisInstance?.resize());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
