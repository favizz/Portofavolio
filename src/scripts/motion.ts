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
      if (!isHscroll || !pinSection || hscrollTrigger) return;
      const distance = Math.max(0, defaultSlot!.scrollWidth - defaultSlot!.clientWidth);
      if (distance <= 0) return;

      const tween = gsap.to(defaultSlot, { x: -distance, ease: 'none', paused: true });
      hscrollTrigger = ScrollTrigger.create({
        trigger: pinSection,
        start: 'top top',
        // The extra distance past the row's own width is a deliberate
        // dwell: reaching the last card holds the pin a bit longer instead
        // of instantly releasing back to the main page.
        end: () => `+=${distance + window.innerHeight * 0.4}`,
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
      grid.removeAttribute('data-lenis-prevent');
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
      destroyHscrollPin();

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
        grid.setAttribute('data-lenis-prevent', '');
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
          grid.setAttribute('data-lenis-prevent', '');
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

    // The vertical carousel changes the selected item on scroll, the same
    // way the horizontal carousel changes position on scroll: any wheel
    // gesture over the expanded card region (stage or label list, not just
    // the narrow label list) steps to the next/previous card instead of
    // scrolling the main page. Lenis drives all scrolling on this page and
    // does NOT respect a nested handler's event.preventDefault(), it only
    // skips its own scroll handling for a wheel event whose composedPath
    // includes an element carrying `data-lenis-prevent` (checked live, not
    // cached at dispatch time). So blocking the page scroll means toggling
    // that attribute on `grid`, not calling preventDefault. It's set the
    // moment a card expands (baseline) and removed once a wheel gesture
    // has pushed against the first/last card a few times in a row, so
    // that exact gesture still reaches Lenis and the page resumes
    // scrolling. Requiring a few boundary hits (not just one) gives a
    // brief "dwell" at the last card, mirroring the horizontal carousel's
    // extra pin distance past the end of the row, instead of instantly
    // kicking the user back into the main page.
    let wheelLock = false;
    let boundaryHits = 0;
    grid.addEventListener(
      'wheel',
      (event) => {
        const expandedSlug = grid.getAttribute('data-expanded');
        if (!expandedSlug) return;

        const currentIndex = cards.findIndex((c) => c.dataset.slug === expandedSlug);
        const direction = event.deltaY > 0 ? 1 : -1;
        const nextIndex = Math.min(cards.length - 1, Math.max(0, currentIndex + direction));

        if (nextIndex === currentIndex) {
          boundaryHits += 1;
          if (boundaryHits < 3) {
            grid.setAttribute('data-lenis-prevent', '');
            return;
          }
          grid.removeAttribute('data-lenis-prevent');
          return;
        }

        boundaryHits = 0;
        grid.setAttribute('data-lenis-prevent', '');
        if (wheelLock) return;

        wheelLock = true;
        setTimeout(() => {
          wheelLock = false;
        }, 450);
        expand(cards[nextIndex].dataset.slug ?? '');
      },
      { passive: false },
    );

    // Touch devices never fire wheel events, so the carousel's selection
    // never changed on mobile even though the label list itself natively
    // scrolls (overflow-y: auto). Watching native scroll position and
    // snapping to whichever label sits nearest the container's center
    // covers touch drag the same way the wheel listener covers desktop;
    // the two never conflict since the wheel handler's preventDefault
    // keeps scrollTop from moving on desktop.
    let carouselScrollRAF: number | null = null;
    carousel.addEventListener(
      'scroll',
      () => {
        if (carouselScrollRAF !== null) return;
        carouselScrollRAF = requestAnimationFrame(() => {
          carouselScrollRAF = null;
          const expandedSlug = grid.getAttribute('data-expanded');
          if (!expandedSlug) return;

          const carouselRect = carousel!.getBoundingClientRect();
          const centerY = carouselRect.top + carouselRect.height / 2;
          let closest: HTMLElement | undefined;
          let closestDist = Infinity;
          labels.forEach((label) => {
            const rect = label.getBoundingClientRect();
            const dist = Math.abs(rect.top + rect.height / 2 - centerY);
            if (dist < closestDist) {
              closestDist = dist;
              closest = label;
            }
          });

          const slug = closest?.dataset.slug;
          if (slug && slug !== expandedSlug) {
            expand(slug);
          }
        });
      },
      { passive: true },
    );

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

  function titleInBand(section: HTMLElement): boolean {
    const heading = section.querySelector('h1, h2');
    if (!heading) return false;
    const rect = heading.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const pct = center / window.innerHeight;
    return pct >= 0.4 && pct <= 0.6;
  }

  function attemptLock() {
    if (isSnapping || Date.now() < suppressLockUntil || Date.now() < cooldownUntil) return;
    const section = mostVisibleSection();
    if (!section || !titleInBand(section)) return;

    lockTimer = setTimeout(() => {
      const stillBest = mostVisibleSection();
      if (stillBest !== section || !titleInBand(section)) return;

      const lenis = window.lenisInstance;
      if (!lenis) return;

      isSnapping = true;
      lenis.scrollTo(section, {
        duration: 0.8,
        onComplete: () => {
          isSnapping = false;
          cooldownUntil = Date.now() + 800;
        },
      });
    }, 500);
  }

  window.lenisInstance?.on('scroll', () => {
    if (isSnapping || Date.now() < suppressLockUntil || Date.now() < cooldownUntil) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    if (lockTimer) clearTimeout(lockTimer);
    scrollTimer = setTimeout(attemptLock, 150);
  });
}

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
        start: 'top top',
        end: 'bottom top',
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
function initHeroFlip() {
  const heroSection = document.getElementById('home');
  const nav = document.querySelector<HTMLElement>('[data-side-nav]');
  if (!heroSection || !nav) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 32; // 2rem: same side gap the old wordmark used.
    // GSAP expects its own vars object per tween, reusing one scrollTrigger
    // object literal across many gsap.fromTo() calls causes only the first
    // to actually bind, this factory hands each tween a fresh copy.
    const heroTrigger = () => ({ trigger: heroSection, start: 'top top', end: 'bottom top', scrub: true });

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
          scrollTrigger: { trigger: heroSection, start: '60% top', end: 'bottom top', scrub: true },
        },
      );
    });

    function scrubFlip(el: HTMLElement, first: { left: number; top: number; width: number; height: number }) {
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

    // Name -> FAVIAN: scale up to fill the same side-gap width the
    // wordmark used, centered on the viewport, behind the photo (the name
    // element's z-index is already below the photo's).
    const name = document.querySelector<HTMLElement>('[data-morph="name"]');
    if (name) {
      const rest = name.getBoundingClientRect();
      const restSize = parseFloat(getComputedStyle(name).fontSize);
      name.style.fontSize = '100px';
      // getBoundingClientRect, not scrollWidth: scrollWidth is unreliable
      // (often 0) on display:inline elements like this span, only
      // block/inline-block boxes report it consistently.
      const naturalWidth = name.getBoundingClientRect().width;
      name.style.fontSize = `${restSize}px`;
      if (naturalWidth) {
        const heroSize = ((vw - gap * 2) / naturalWidth) * 100;
        const scale = heroSize / restSize;
        const heroWidth = rest.width * scale;
        const heroHeight = rest.height * scale;
        scrubFlip(name, {
          left: vw / 2 - heroWidth / 2,
          top: vh / 2 - heroHeight / 2,
          width: heroWidth,
          height: heroHeight,
        });
        scrubColor(name);
      }
    }

    // Desc -> left flank, Stats -> right flank: simply scaled up in place,
    // no width-fit precision needed like the name.
    const desc = document.querySelector<HTMLElement>('[data-morph="desc"]');
    if (desc) {
      const rest = desc.getBoundingClientRect();
      const scale = 1.8;
      const heroWidth = rest.width * scale;
      const heroHeight = rest.height * scale;
      scrubFlip(desc, { left: gap, top: vh * 0.55 - heroHeight / 2, width: heroWidth, height: heroHeight });
      scrubColor(desc);
    }

    const stats = document.querySelector<HTMLElement>('[data-morph="stats"]');
    if (stats) {
      const rest = stats.getBoundingClientRect();
      const scale = 1.6;
      const heroWidth = rest.width * scale;
      const heroHeight = rest.height * scale;
      scrubFlip(stats, {
        left: vw - gap - heroWidth,
        top: vh * 0.55 - heroHeight / 2,
        width: heroWidth,
        height: heroHeight,
      });
      scrubColor(stats);
    }

    // Nav links spread out to span that same width, evenly, in a single
    // top row well clear of the photo (which starts at 10vh). Each link
    // carries `w-full` (100% of the sidebar's stacked column) for its
    // resting layout, which makes getBoundingClientRect report the
    // container's width instead of the link's own text width, so measure
    // with that override temporarily lifted.
    const linkEls = Array.from(document.querySelectorAll<HTMLElement>('[data-morph-link]'));
    if (linkEls.length) {
      const naturalRects = linkEls.map((el) => {
        const prevWidth = el.style.width;
        const prevDisplay = el.style.display;
        el.style.width = 'auto';
        el.style.display = 'inline-block';
        const rect = el.getBoundingClientRect();
        el.style.width = prevWidth;
        el.style.display = prevDisplay;
        return rect;
      });
      const totalRowWidth = vw - gap * 2;
      const totalLinkWidth = naturalRects.reduce((sum, r) => sum + r.width, 0);
      const gapBetween = linkEls.length > 1 ? (totalRowWidth - totalLinkWidth) / (linkEls.length - 1) : 0;
      let x = gap;
      linkEls.forEach((el, i) => {
        const w = naturalRects[i].width;
        scrubFlip(el, { left: x, top: gap, width: w, height: naturalRects[i].height });
        scrubColor(el);
        x += w + gapBetween;
      });
    }
  });
}

// As the footer arrives, the sidebar's "profile insight" (everything but
// the contact button) fades away, and the contact button itself loses its
// boxed-button styling (solid background, white text) in favor of Footer's
// own accent-colored text treatment, reading as "the button became text",
// before fading out in place alongside the rest, Footer already has its
// own real Connect section right there to take over.
function initFooterMorph() {
  const footer = document.querySelector<HTMLElement>('footer');
  const nav = document.querySelector<HTMLElement>('[data-side-nav]');
  const contactBtn = document.querySelector<HTMLElement>('[data-morph="contact"]');
  if (!footer || !nav) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const footerTrigger = () => ({ trigger: footer, start: 'top bottom', end: 'top 40%', scrub: true });

    const others = Array.from(nav.children).filter((el) => el !== contactBtn);
    gsap.to(others, { opacity: 0, ease: 'none', scrollTrigger: footerTrigger() });

    if (contactBtn) {
      gsap.fromTo(
        contactBtn,
        { backgroundColor: 'rgba(0,0,0,1)', color: 'rgba(255,255,255,1)' },
        { backgroundColor: 'rgba(0,0,0,0)', color: 'var(--color-accent)', ease: 'none', scrollTrigger: footerTrigger() },
      );
      gsap.to(contactBtn, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: footer, start: 'top 55%', end: 'top 30%', scrub: true },
      });
    }
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
  initFooterMorph();
  initEmailCopy();
  initExpandableGrids();
  initCrossLinks();
  initScrollLock();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
