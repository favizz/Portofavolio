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
  // resettle() call (font load, window resize), so this keeps Lenis in
  // sync for the lifetime of the page
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

  // 'section, footer': Footer.astro's root is a <footer>, not a <section>,
  // so without this it silently never groups (closest('section') returns
  // null for anything inside it) and never gets a reveal animation at
  // all. That gap is why the sidebar-to-footer morph read as "the sidebar
  // just vanishes": Footer's own content had no entrance to arrive WITH,
  // it was just sitting there, statically rendered, the whole time.
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const section = el.closest('section, footer');
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
    // Header.astro's mobile menu swaps its bottom row (socials <-> Download
    // CV button) based on this, rather than duplicating section-tracking
    // logic of its own.
    document.body.setAttribute('data-active-section', id);
  }
}


function initExpandableGrids() {
  // Shared modal backdrop, created once and reused by every expand-capable
  // grid on the page: only one card can ever be open at a time, so there's
  // no need for a separate backdrop per grid. See the big comment further
  // down (at the `expand`/`closeModal` functions) for why this replaced
  // the old FLIP-into-a-stage-inside-the-grid approach entirely.
  let modalBackdrop = document.querySelector<HTMLElement>('[data-modal-backdrop]');
  if (!modalBackdrop) {
    modalBackdrop = document.createElement('div');
    modalBackdrop.setAttribute('data-modal-backdrop', '');
    modalBackdrop.className = 'card-modal-backdrop';
    document.body.appendChild(modalBackdrop);
  }

  document.querySelectorAll<HTMLElement>('[data-expand-grid]').forEach((grid) => {
    const sectionId = grid.dataset.expandSection ?? '';
    const carousel = grid.querySelector<HTMLElement>('[data-expand-carousel]');
    const defaultSlot = grid.querySelector<HTMLElement>('[data-expand-default]');
    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-expand-card]'));
    const labels = Array.from(grid.querySelectorAll<HTMLElement>('[data-carousel-item]'));
    const prevBtn = grid.querySelector<HTMLButtonElement>('[data-carousel-prev]');
    const nextBtn = grid.querySelector<HTMLButtonElement>('[data-carousel-next]');
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
        // No `data-expanded` guard here: the modal (see below) no longer
        // touches this pin at all, so a resettle firing while a card
        // happens to be open is harmless, nothing about the collapsed
        // row's own layout changed underneath it.
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

    // Some hscroll grids (Certification, Achievement) are pin-only: a
    // scroll-driven row of cards with no click-to-expand modal. Nothing
    // below this point applies without a carousel to expand into.
    if (!carousel) return;

    // Ambient "this row is tappable" cue for mobile's collapsed list rows
    // (title + date only, no thumbnail image to otherwise hint at
    // interactivity), replacing a static icon that shipped once and was
    // removed for visually colliding with other row content. A slow,
    // continuous, staggered scale pulse instead, GSAP-driven rather than
    // a CSS @keyframes animation (the marquees learned this the hard way:
    // prefers-reduced-motion silently kills CSS animations and is on far
    // more often than it looks, GSAP tweens ignore it). yoyo:true with no
    // gap-inducing delay between cycles keeps the motion continuous, no
    // pause between "press down" and "release." Paused while a card is
    // actually expanded (an ambient hint elsewhere shouldn't compete with
    // real expanded content) and torn down/rebuilt on resize so crossing
    // the 768px boundary turns it on or off.
    let pulseTween: gsap.core.Tween | null = null;
    function setupPulse() {
      pulseTween?.kill();
      pulseTween = null;
      gsap.set(cards, { clearProps: 'scale' });
      if (window.innerWidth >= 768) return;
      pulseTween = gsap.to(cards, {
        scale: 0.97,
        duration: 1.4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.15, repeat: -1, yoyoEase: true },
      });
      if (grid.hasAttribute('data-expanded')) pulseTween.pause();
    }
    setupPulse();
    let pulseResizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(pulseResizeTimer);
      pulseResizeTimer = setTimeout(setupPulse, 200);
    });

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
      // Mobile's prev/next chevrons (desktop keeps the label list instead,
      // see global.css) go low-opacity and unclickable at either end of the
      // list, same disabled-at-the-boundary idea as the hscroll pin's own
      // dwell, just for manual stepping instead of a scroll gesture.
      prevBtn?.toggleAttribute('disabled', activeIndex <= 0);
      nextBtn?.toggleAttribute('disabled', activeIndex === -1 || activeIndex >= labels.length - 1);
    }

    // The expanded view is a fixed-position MODAL, not a card FLIPped into
    // a stage that lives inside the grid's own document flow. This
    // replaced the earlier stage/FLIP/pin-destroy-and-rebuild system
    // outright after three rounds of chasing the same underlying bug
    // (cropped content, "teleporting" past the card, a recurring glitch
    // on close): all of those symptoms traced back to some combination of
    // the hscroll pin being destroyed and rebuilt around expand/collapse,
    // and the expanded card's height being bound by the section's own
    // scroll-driven, pin-spacer-dependent geometry. A modal sidesteps the
    // entire problem class by construction: `position: fixed` takes the
    // card out of the pin/section's box model entirely, so nothing about
    // opening or closing it ever needs to touch the hscroll pin (it just
    // keeps running underneath, untouched, the whole time), and a fixed
    // `max-height` with its own internal scroll (`overflow-y: auto`)
    // means content can never be cropped, worst case it scrolls inside
    // the modal instead of the page. The tradeoff: no more FLIP-from-the-
    // clicked-card's-exact-position animation, just a simple scale/fade
    // (the modal's own fixed position has no meaningful relationship to
    // where the card was in the row, so FLIP's "first rect" wouldn't mean
    // anything here anyway).
    //
    // One real gotcha this ran into: `position: fixed` only positions
    // relative to the VIEWPORT if every ancestor is free of `transform`
    // (also `filter`/`perspective`/`will-change: transform`) — any
    // ancestor with one of those establishes its own containing block,
    // and a "fixed" descendant becomes fixed relative to THAT ancestor
    // instead, behaving like `position: absolute` in disguise. The
    // hscroll pin's own scrub tween continuously applies exactly that
    // (`transform: translateX(...)` on `defaultSlot`, deliberately never
    // paused for the modal, see above), and the card lives inside
    // `defaultSlot`. The fix is NOT to touch the pin (that reintroduces
    // the exact coupling this rewrite exists to avoid): instead, the
    // opening card is reparented OUT of `defaultSlot` (to `document.body`)
    // for the duration it's open, a plain DOM move with no scroll/pin
    // timing involved at all, and `restoreOrder()` puts every card back
    // in its correct sorted position on close.
    function restoreOrder() {
      cards.forEach((c) => defaultSlot!.appendChild(c));
    }

    let openCard: HTMLElement | null = null;

    function closeModal() {
      if (!openCard) return;
      const card = openCard;
      openCard = null;
      // State changes (the attributes that actually control what's
      // fixed-positioned, visible, and clickable) happen SYNCHRONOUSLY,
      // not gated behind a GSAP onComplete callback: the entire point of
      // this modal rewrite was to stop depending on animation timing for
      // correctness (that dependency is what caused three straight
      // rounds of the old stage/pin system's bugs). The fade-out below is
      // purely a cosmetic layer on top of an already-correct state, if
      // it's ever interrupted or fails to fire for any reason, nothing
      // gets stuck.
      card.removeAttribute('data-modal-open');
      modalBackdrop!.removeAttribute('data-open');
      restoreOrder();
      gsap.set(card, { clearProps: 'opacity,scale' });
      gsap.fromTo(modalBackdrop, { opacity: 1 }, { opacity: 0, duration: 0.2 });
      window.lenisInstance?.start();
      document.removeEventListener('keydown', onKeydown);
      grid.removeAttribute('data-expanded');
      syncLabels('');
      pulseTween?.play();
    }

    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }

    function expand(slug: string) {
      if (grid.getAttribute('data-expanded') === slug) return;
      const card = cards.find((c) => c.dataset.slug === slug);
      if (!card) return;

      const wasExpanded = grid.hasAttribute('data-expanded');
      pulseTween?.pause();

      if (openCard && openCard !== card) {
        openCard.removeAttribute('data-modal-open');
      }
      // Reset every card back into defaultSlot first (a no-op on the
      // very first open, since nothing's been moved out yet; on a
      // cycle between cards, this is what puts the PREVIOUSLY open one
      // back instead of leaving it orphaned in document.body), then
      // move OUT only the one being opened now. See the big comment
      // above openCard's declaration for why it needs to leave
      // defaultSlot at all (the hscroll pin's own transform on
      // defaultSlot would otherwise hijack position: fixed's containing
      // block). document.body is a safe destination, nothing there has
      // its own transform.
      restoreOrder();
      document.body.appendChild(card);
      card.setAttribute('data-modal-open', 'true');
      openCard = card;
      grid.setAttribute('data-expanded', slug);

      if (wasExpanded) {
        // Cycling between already-expanded cards (label/chevron browsing):
        // the new card just appears, no separate entrance needed since
        // the backdrop is already up and the modal box is already in
        // place, only WHICH card fills it changes.
        gsap.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
      } else {
        modalBackdrop!.setAttribute('data-open', 'true');
        gsap.fromTo(
          card,
          { opacity: 0, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' },
        );
        gsap.fromTo(modalBackdrop, { opacity: 0 }, { opacity: 1, duration: 0.25 });
        window.lenisInstance?.stop();
        document.addEventListener('keydown', onKeydown);
      }

      syncLabels(slug);
    }

    labels.forEach((label) => {
      label.addEventListener('click', (event) => {
        event.stopPropagation();
        expand(label.dataset.slug ?? '');
      });
    });

    // Mobile's chevron equivalent of clicking a label: step to the
    // adjacent slug by index, a no-op at either boundary (the disabled
    // attribute already blocks the click, this is just belt-and-suspenders
    // against a stray Enter/Space on a focused-but-disabled button).
    prevBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const activeIndex = labels.findIndex((label) => label.dataset.slug === grid.getAttribute('data-expanded'));
      if (activeIndex > 0) expand(labels[activeIndex - 1].dataset.slug ?? '');
    });
    nextBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      const activeIndex = labels.findIndex((label) => label.dataset.slug === grid.getAttribute('data-expanded'));
      if (activeIndex !== -1 && activeIndex < labels.length - 1) {
        expand(labels[activeIndex + 1].dataset.slug ?? '');
      }
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
    // carousel label, a mobile chevron, a card, or a cross-link, and page
    // scroll is never hijacked while a card is expanded. Do not
    // reintroduce a wheel/scroll handler here.
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
        // A clicked button keeps keyboard focus afterward, and with the
        // old stage/pin system that could trigger the browser's native
        // "scroll the focused element into view" behavior mid-transition,
        // reading as a stray horizontal scroll glitch. The modal no
        // longer touches scroll position or the hscroll pin at all, so
        // that specific failure mode is gone, but blurring here is still
        // cheap, harmless insurance against any future focus-scroll quirk.
        (event.currentTarget as HTMLElement).blur();
        closeModal();
      });
    });

    // Clicking the backdrop (outside the modal card itself) closes it too,
    // standard modal convention.
    modalBackdrop.addEventListener('click', () => {
      if (grid.getAttribute('data-expanded')) closeModal();
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

// The sidebar-to-footer fade (initFooterMorph) window, in viewport-heights
// of scroll. An earlier version matched this to heroTotalScroll()'s full
// ~2.5vh, reasoning it should feel as unrushed as the Hero opening
// transition, but at that length a normal scroll flick covers the whole
// window in one gesture, which reads as an instant cut rather than a
// visible fade, the opposite of the intent. Shorter and snappier instead.
// Reduced again (0.6 -> 0.3 -> 0.18) per explicit "has to be faster"
// feedback, most recently because the fade was slow enough that a visitor
// could click one nav link, then click a SECOND different one before the
// sidebar finished fading away and lost interactivity (see the
// pointer-events cutoff in apply() below, the other half of that fix:
// shortening the tween alone doesn't stop clicks mid-fade, opacity has no
// effect on hit-testing).
const FOOTER_FADE_VH = 0.18;

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
    // GSAP auto-wraps a pinned element in a `.pin-spacer` div (its new
    // immediate parent) to reserve the pin's scroll distance in the
    // document. That wrapper has no styling of its own, but it's a real,
    // positioned, pointer-events: auto box occupying Hero's full screen
    // area, and it sits ABOVE the sidebar in stacking order the same way
    // hero-section itself did before it got `pointer-events: none` (see
    // Hero.astro). Fixing hero-section alone wasn't enough: clicks that
    // fell through IT then landed on ITS OWN PARENT (this spacer) next,
    // confirmed directly with elementFromPoint() returning a `.pin-spacer`
    // div at a nav link's coordinates even after hero-section itself
    // correctly stopped intercepting. The spacer has no content of its
    // own worth clicking (Hero's real content is hero-section, already
    // handled), so it's safe to make it pass-through too.
    if (heroSection!.parentElement?.classList.contains('pin-spacer')) {
      heroSection!.parentElement.style.pointerEvents = 'none';
    }

    ctx = gsap.context(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Fluid, not a fixed 32px: scales down toward tablet-width desktops
    // (this whole build() only runs at 768px+, so 20px is the floor right
    // at that breakpoint) and caps at 32px once there's room to spare.
    const gap = Math.max(20, Math.min(32, vw * 0.02));
    const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
    // Nav (right column), stats (right column, stacked below nav), and desc
    // (left column) all live in this reserved band at the bottom of the
    // viewport. Sized as a fraction of vh, not a fixed pixel band, so it
    // actually grows to use real extra space on tall viewports instead of
    // leaving it empty, with a floor so a 3-row nav grid stays legible on
    // short ones. FAVIAN's own hero height is capped against bandTop (see
    // heightFitSize below), so the two can never overlap regardless of
    // viewport size, confirmed as a real, measured collision (not just a
    // z-index illusion) at 1707x748 before this fix: FAVIAN's box ran to
    // y=616 while nav links, desc, and stats all started above that, in the
    // 570-599 range.
    const bandHeight = Math.max(170, vh * 0.32);
    const bandBottom = vh - gap;
    const bandTop = bandBottom - bandHeight;
    // Nav and stats share this column beside the photo's right edge,
    // stacked (nav above stats) instead of both independently centering
    // around the same y and landing on top of each other, which is what
    // the previous fixed flankCenter/vh-anchored math actually did.
    const stackGap = 18;
    const navZoneHeight = (bandHeight - stackGap) * 0.62;
    const statsZoneHeight = bandHeight - stackGap - navZoneHeight;
    const navZoneTop = bandTop;
    const statsZoneTop = navZoneTop + navZoneHeight + stackGap;
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
        // `width: auto` is REQUIRED here, not optional, for any element
        // that carries `w-full` (100% of its resting container) at rest:
        // without it, `last` below measures the full container box (e.g.
        // the whole sidebar column width), and scaling THAT box by a
        // uniform factor scales every element to the SAME absolute pixel
        // width regardless of its own text length, completely decoupled
        // from the actual content. Confirmed directly: every nav link
        // rendered at an identical 244px width at Hero time regardless of
        // whether the label was "Home" or "Certification", overlapping
        // its neighbors since the grid's own column-width math (elsewhere
        // in this file) assumed rendered width scaled with the link's own
        // natural text width, not a shared container width. Auto-sizing
        // the box to its content here is what makes that assumption true.
        el.style.width = 'auto';
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
      const photoRectForGrid = photo ? photo.getBoundingClientRect() : null;
      const gridAreaLeft = photoRectForGrid ? photoRectForGrid.right + gap : gap;
      const gridAreaRight = vw - gap;
      // Nav links are SCALED UP at Hero time by a single uniform factor
      // derived from font size, not via scrubFlip's width-ratio path like
      // the name: because of the `w-full` above, a link's resting box is
      // the whole sidebar column, so `first.width / last.width` would
      // compare the link's TEXT width against its CONTAINER width and come
      // out below 1, scaling the links DOWN into unreadable specks (this
      // shipped once). Uniform scale + translate only, via scrubMove().
      const linkRestSize = linkEls.length ? parseFloat(getComputedStyle(linkEls[0]).fontSize) : 14;
      const maxNaturalLinkWidth = linkNaturalRects.reduce((max, r) => Math.max(max, r.width), 0);
      const maxNaturalLinkHeight = linkNaturalRects.reduce((max, r) => Math.max(max, r.height), 0);
      // Column COUNT has to adapt too, not just font size: a fixed 3
      // columns was the original approach, capping navScale against each
      // column's width once it was known. That stopped "Certification"/
      // "Achievement" from spilling into their own next column over at a
      // GIVEN column count, but on a viewport where the photo eats most of
      // the horizontal space beside it, 3 (even 2) columns can leave each
      // cell narrower than the longest label can ever fit at a readable
      // (16px+) size, no matter how far the font shrinks toward that
      // floor, confirmed directly: at 1280x800 the widest label needed an
      // 8.7px font to fit a 3-column cell, far under the 16px floor, so
      // the floor won and every long label overlapped its neighbor by
      // 15-40px regardless. Trying fewer, wider columns first is what
      // actually guarantees a fit rather than just hoping 3 columns has
      // enough room.
      let cols = 3;
      let colWidth = 0;
      let maxFitNavSize = 0;
      for (; cols >= 1; cols--) {
        colWidth = Math.max(0, (gridAreaRight - gridAreaLeft - gridGap * (cols - 1)) / cols);
        maxFitNavSize = maxNaturalLinkWidth > 0 ? (colWidth * 0.92) / (maxNaturalLinkWidth / linkRestSize) : Infinity;
        if (maxFitNavSize >= 16 || cols === 1) break;
      }
      // Raised across the board per explicit "too small" feedback: floor
      // 16->22, ceiling 24->34, and the vw divisor 60->42 so it climbs
      // faster with viewport width too. maxFitNavSize (above) still caps
      // this against each link's own column, so a real long label like
      // "Certification" still can't spill into its neighbor regardless of
      // how high this desired size goes.
      const desiredNavSize = Math.max(22, Math.min(34, vw / 42));
      const rows = Math.ceil(linkEls.length / cols);
      // Same idea, against real vertical room in nav's own zone (see
      // navZoneHeight above) instead of column width, so a tall grid on a
      // short viewport shrinks rather than spilling into stats below it or
      // FAVIAN above it. No fixed desiredNavSize ceiling here on purpose:
      // once both real geometric caps (column width, zone height) are in
      // place, a bigger screen with genuine room to spare is allowed to
      // render nav links bigger too, not just capped at an arbitrary value.
      const maxFitNavSizeForZone =
        maxNaturalLinkHeight > 0
          ? ((navZoneHeight - gridGap * (rows - 1)) / rows / maxNaturalLinkHeight) * linkRestSize
          : desiredNavSize;
      const heroNavSize = Math.max(16, Math.min(maxFitNavSize, maxFitNavSizeForZone));
      const navScale = heroNavSize / linkRestSize;
      const navRowHeight = maxNaturalLinkHeight * navScale;

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
          const widthFitSize = ((vw - gap * 2) / naturalWidth) * 100;
          // Largest font size whose scaled box still ends above the
          // reserved band (with a little breathing room below it), so
          // FAVIAN can never grow down into where nav/desc/stats live.
          const availableNameHeight = Math.max(40, bandTop - nameTop - gap * 0.5);
          const heightFitSize = (availableNameHeight / rest.height) * restSize;
          const heroSize = Math.max(restSize, Math.min(widthFitSize, heightFitSize));
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
        const gridHeight = navRowHeight * rows + gridGap * (rows - 1);
        // Bottom-aligned within nav's own zone (not the raw viewport), and
        // clamped so it can never rise above navZoneTop even if gridHeight
        // somehow exceeds navZoneHeight (heroNavSize's zone cap above
        // should already prevent that, this is just a hard floor).
        const gridTop = Math.max(navZoneTop, navZoneTop + navZoneHeight - gridHeight);
        linkEls.forEach((el, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          el.style.position = 'relative';
          el.style.zIndex = '1';
          scrubMove(el, {
            left: gridAreaLeft + col * (colWidth + gridGap),
            top: gridTop + row * (navRowHeight + gridGap),
            scale: navScale,
          });
          scrubColor(el);
          scrubBackdrop(el);
        });
      }

      // Desc -> left flank, Stats -> right flank, stacked below nav in the
      // same column. Desc has the whole reserved band to itself (nothing
      // else shares its side of the photo), so it centers on bandCenter;
      // stats shares the right column with nav (see navZoneHeight/
      // statsZoneHeight above) so it centers on its own sub-zone instead,
      // otherwise the two would land on the same y and overlap, which is
      // what the previous shared flankCenter (a single fixed 0.835 * vh)
      // actually did.
      //
      // Both scales are capped against the REAL free space beside the
      // photo (photo.left for desc, vw - photo.right for stats) AND against
      // their own zone's real height, not just applied at a fixed 1.8x/1.6x
      // regardless of where the photo's edge or the band actually falls. An
      // earlier version used the fixed scale unconditionally: it happened
      // to clear the photo at one specific viewport size that was eyeballed
      // during testing, but the photo's width is itself a function of vh
      // (it's a fixed-aspect image at 90vh tall, so a shorter, wider
      // desktop window makes the photo wider, not just shorter), so
      // "clears the photo" was never actually guaranteed by that formula.
      // Confirmed by computing the numbers directly: at a perfectly
      // ordinary window size (1024x768), the fixed 1.8x desc scale produced
      // a box that extended well past the photo's own left edge. Capping
      // scale (uniformly, both axes together, same shape as scrubMove's own
      // uniform-scale reasoning) rather than capping the resulting width
      // alone keeps the text undistorted while shrinking to whatever room
      // is actually free, instead of silently overlapping once the desired
      // size no longer fits.
      const bandCenter = (bandTop + bandBottom) / 2;
      const statsCenter = statsZoneTop + statsZoneHeight / 2;
      const photoRectForFlank = photo ? photo.getBoundingClientRect() : null;
      const desc = document.querySelector<HTMLElement>('[data-morph="desc"]');
      if (desc) {
        desc.style.position = 'relative';
        desc.style.zIndex = '1';
        const rest = desc.getBoundingClientRect();
        const availableWidth = photoRectForFlank ? Math.max(0, photoRectForFlank.left - gap * 2) : vw - gap * 2;
        const scale =
          rest.width > 0 && rest.height > 0
            ? Math.min(1.8, availableWidth / rest.width, bandHeight / rest.height)
            : 1.8;
        const heroWidth = rest.width * scale;
        const heroHeight = rest.height * scale;
        scrubFlip(desc, { left: gap, top: bandCenter - heroHeight / 2, width: heroWidth, height: heroHeight });
        scrubColor(desc);

        // "software engineering" reads bold-only at rest in the sidebar,
        // bigger AND full-caps at Hero time, on explicit instruction. The
        // .desc-emphasis span's own font-size can't just be a static CSS
        // ratio (see the comment on that class in global.css for why: the
        // whole desc block above is scroll-scrubbed via transform:scale,
        // so an em-relative size would apply the same ratio whether the
        // block itself is tiny (rest) or huge (Hero), unable to tell the
        // two states apart). Scrubbing the span's OWN font-size directly,
        // tied to the same scroll range as everything else in this morph,
        // is what actually makes it "smaller at rest, bigger at Hero"
        // rather than a fixed multiple of whatever the surrounding text
        // happens to be doing. text-transform can't be smoothly
        // interpolated (it's not a continuous value), so it's a discrete
        // class toggle at the halfway point of the same scroll range
        // instead of a third scrubbed property.
        const emphasis = desc.querySelector<HTMLElement>('.desc-emphasis');
        if (emphasis) {
          gsap.fromTo(
            emphasis,
            { fontSize: '1em' },
            {
              fontSize: '1.8em',
              ease: 'none',
              scrollTrigger: heroTrigger(),
              onUpdate() {
                const progress = this.progress();
                emphasis.classList.toggle('is-hero-caps', progress > 0.5);
                // The <br/> tags splitting this paragraph into 3 lines (see
                // SideNav.astro) are static markup, shared by both the Hero-
                // scaled and resting states since it's literally the same
                // DOM node (see the true-morph system). Per explicit "on
                // home page... combined... not new line" feedback, scoped
                // ONLY to the Hero display: progress 0 is Hero (scroll=0,
                // verified via the FAVIAN scrubFlip using the identical
                // fromTo-direction), progress 1 is the resting sidebar, so
                // hiding <br/> below the same 0.5 midpoint the caps toggle
                // above already uses keeps both discrete switches happening
                // at the same scroll point instead of visibly disagreeing
                // mid-transition.
                desc.classList.toggle('is-hero-inline', progress < 0.5);
              },
            },
          );
        }
      }

      const stats = document.querySelector<HTMLElement>('[data-morph="stats"]');
      if (stats) {
        stats.style.position = 'relative';
        stats.style.zIndex = '1';
        const rest = stats.getBoundingClientRect();
        const availableWidth = photoRectForFlank
          ? Math.max(0, vw - photoRectForFlank.right - gap * 2)
          : vw - gap * 2;
        const scale =
          rest.width > 0 && rest.height > 0
            ? Math.min(1.6, availableWidth / rest.width, statsZoneHeight / rest.height)
            : 1.6;
        const heroWidth = rest.width * scale;
        const heroHeight = rest.height * scale;
        scrubFlip(stats, {
          left: vw - gap - heroWidth,
          top: statsCenter - heroHeight / 2,
          width: heroWidth,
          height: heroHeight,
        });
        scrubColor(stats);
      }

    });
  }

  // Every measurement in build() (FAVIAN's rest/natural rects, every nav
  // link's natural width) reads real rendered text, which depends on
  // "Space Grotesk" actually being the font in use. Building immediately
  // AND again on fonts.ready (an earlier version of this fix) measured
  // the fallback font first, computed a visibly-too-narrow FAVIAN from
  // it, then snapped instantly to the correct width once the real font
  // swapped in, a jarring "loads short, then jump-cuts to full width"
  // reported directly. Waiting for fonts.ready before the FIRST (and
  // only) build call means FAVIAN never renders from wrong metrics in
  // the first place, so there's nothing to visibly correct later; the
  // brief pre-font window instead just shows nothing (the sidebar's own
  // resting elements haven't received their Hero transform yet), an
  // unremarkable, ordinary page-load moment rather than a bug. Building
  // a SECOND time here on top of this would reintroduce the same snap
  // (two scrub tweens on the same transform don't blend, whichever
  // renders last just replaces the other outright), so this stays a
  // single call, not an addition to it.
  if ('fonts' in document) {
    document.fonts.ready.then(build);
  } else {
    build();
  }
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
    // Opacity alone doesn't stop clicks: a visitor could click one nav
    // link, then a second, different one, before the fade visually
    // finished, since the sidebar stayed fully hit-testable the whole
    // time. Locked out well before the fade completes (not at progress
    // 1), so there's no real window left to double-click through.
    nav!.style.pointerEvents = progress > 0.2 ? 'none' : 'auto';
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
