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
ScrollTrigger.config({ ignoreMobileResize: true });

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

const sectionPalettes: Record<string, string> = {
  home: '#0f1e35',
  about: '#0a1830',
  academic: '#0c2038',
  certification: '#0e2440',
  project: '#122a4a',
  technology: '#0a1c33',
  career: '#16345c',
  achievement: '#0d2140',
  contact: '#060c17',
};

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

function initGradientField() {
  const field = document.getElementById('gradient-field');
  if (!field) return;

  const blobs = Array.from(field.querySelectorAll<HTMLElement>('.blob'));
  const shapes = [
    '42% 58% 65% 35% / 45% 45% 55% 55%',
    '58% 42% 33% 67% / 62% 38% 62% 38%',
    '35% 65% 60% 40% / 40% 60% 40% 60%',
    '65% 35% 45% 55% / 55% 45% 65% 35%',
  ];

  blobs.forEach((blob, i) => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { duration: 10 + i * 3, ease: 'sine.inOut' } });
    shapes.forEach((shape) => tl.to(blob, { borderRadius: shape }));
    gsap.to(blob, {
      x: `random(-80, 80)`,
      y: `random(-60, 60)`,
      duration: 14 + i * 4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  });

  Object.entries(sectionPalettes).forEach(([id, color]) => {
    const section = document.getElementById(id);
    if (!section) return;

    gsap.to(field, {
      '--blob-1': color,
      '--blob-2': color,
      '--blob-3': color,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'top 30%',
        scrub: true,
      },
    });
  });
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
        end: () => `+=${distance + window.innerHeight * 0.25}`,
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

      destroyHscrollPin();

      flipOne(card, () => {
        restoreOrder();
        stage!.appendChild(card);
        grid.setAttribute('data-expanded', slug);
      });

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
    // way the horizontal carousel changes position on scroll: each wheel
    // gesture over the label list steps to the next/previous card.
    let wheelLock = false;
    carousel.addEventListener(
      'wheel',
      (event) => {
        const expandedSlug = grid.getAttribute('data-expanded');
        if (!expandedSlug) return;
        event.preventDefault();
        if (wheelLock) return;

        const currentIndex = cards.findIndex((c) => c.dataset.slug === expandedSlug);
        const direction = event.deltaY > 0 ? 1 : -1;
        const nextIndex = Math.min(cards.length - 1, Math.max(0, currentIndex + direction));
        if (nextIndex === currentIndex) return;

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
    if (isSnapping || Date.now() < suppressLockUntil) return;
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
        },
      });
    }, 1000);
  }

  window.lenisInstance?.on('scroll', () => {
    if (isSnapping || Date.now() < suppressLockUntil) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    if (lockTimer) clearTimeout(lockTimer);
    scrollTimer = setTimeout(attemptLock, 150);
  });
}

function initOrbit() {
  document.querySelectorAll<HTMLElement>('[data-orbit]').forEach((el) => {
    gsap.to(el, { rotate: 360, duration: 30, repeat: -1, ease: 'none' });
  });
}

// As the Hero scrolls out, the cutout photo blurs, lifts, and fades away
// rather than traveling to a fixed nav position (the nav itself is now a
// permanent side element, not something the photo needs to "become").
function initHeroMorph() {
  const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
  const heroSection = document.getElementById('home');
  if (!photo || !heroSection) return;

  // A one-time entrance (not scroll-linked) on load, separate from the
  // scroll-driven exit below. Both are owned by this function so nothing
  // else (like initReveals) ever fights over this element's opacity.
  gsap.from(photo, { opacity: 0, y: 32, duration: 0.9, delay: 0.3, ease: 'power3.out' });

  // Explicit from/to values (rather than letting GSAP infer "from" as
  // whatever the current computed value happens to be) so this tween's
  // scroll-progress-0 state is deterministic regardless of the entrance
  // tween's timing.
  gsap.fromTo(
    photo,
    { y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' },
    {
      y: -60,
      scale: 0.92,
      opacity: 0,
      filter: 'blur(24px)',
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

// The side nav starts centered over Hero (matching the "landing has no left
// nav yet" requirement, since opacity 0 makes it invisible at scroll top)
// and morphs into its resting fixed-left position as the user scrolls
// through Hero, finishing by the time About appears (same trigger range as
// initHeroMorph's photo exit, so both complete together).
function initNavMorph() {
  const nav = document.querySelector<HTMLElement>('[data-side-nav]');
  const heroSection = document.getElementById('home');
  if (!nav || !heroSection) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const rect = nav.getBoundingClientRect();
    const startX = window.innerWidth / 2 - rect.left - rect.width / 2;

    gsap.fromTo(
      nav,
      { x: startX, opacity: 0, scale: 1.15 },
      {
        x: 0,
        opacity: 1,
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: heroSection,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}

function init() {
  initSmoothScroll();
  initReveals();
  initParallax();
  initActiveSection();
  initGradientField();
  initOrbit();
  initHeroMorph();
  initNavMorph();
  initExpandableGrids();
  initCrossLinks();
  initScrollLock();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
