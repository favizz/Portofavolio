// Single source of truth for every fact about Favian used anywhere on this
// site: name variants, job title, education, contact details, the
// recurring bio sentence, and the CV/site-title strings. Components import
// from here instead of retyping the literal, so a real change (new job
// title, new email, reworded bio) is one edit instead of a search-and-
// replace across a dozen files.
//
// This site has no admin UI or CMS, values here change by editing this
// file directly, so the notes below are for whoever edits it next: they
// describe what the surrounding markup/CSS was built to comfortably fit,
// not a rule this file enforces in code. Nothing here does length
// validation on purpose, the layout is meant to adapt to whatever's here,
// not the other way around.

export const facts = {
  /** Full name. 10-40 chars recommended: used in <title>, the meta
   *  description, and JSON-LD, all of which read best as one line in
   *  search results. */
  fullName: 'Favian Izza Diasputra',

  /** Two-word display name (footer copyright/credit lines, photo alt
   *  text). 4-20 chars recommended. */
  displayName: 'Favian Izza',

  /** First name only, for the tightest UI spots (SideNav's own heading,
   *  Contact.astro's mailto greeting). 2-15 chars recommended. */
  firstName: 'Favian',

  /** All-caps single word for Hero's big edge-to-edge wordmark. Kept to
   *  one short word (4-8 chars recommended), not a full name:
   *  .mobile-hero-heading's clamp() and the desktop FLIP-morph
   *  letter-spacing math in motion.ts both measure this string's actual
   *  rendered width at runtime rather than assuming a fixed character
   *  count, but the effect (and its font-size clamp range) was tuned by
   *  eye around a word this length, a much longer value would still
   *  render, just not necessarily at the intended visual scale. */
  heroWord: 'FAVIAN',

  /** Lowercase brand wordmark shown in Header/Footer. 4-30 chars
   *  recommended. */
  wordmark: 'favian izza.',

  /** 2-50 chars recommended: shown in <title>, JSON-LD jobTitle, and the
   *  meta description. */
  jobTitle: 'Software Engineer',

  /** Plain address, the single source for every usage on the site.
   *  Components that intentionally obfuscate it in HTML output (SideNav,
   *  Footer: split into data-user/data-domain attributes and reassembled
   *  client-side so it never sits in the markup as a scrapable literal)
   *  do their own splitting from this one value at build time rather than
   *  storing a second copy, so the obfuscation still holds even though
   *  the source is centralized. Layout.astro's JSON-LD and Contact.astro's
   *  mailto link use it as-is, plain, since both need a real machine-
   *  readable address to function. */
  email: 'izza.diasputra10@gmail.com',

  education: {
    /** 5-80 chars recommended. Also referenced by experience.ts (the
     *  academic entry's `company` field) and certifications.ts (the
     *  graduation certificate's `issuer` field), rather than each keeping
     *  its own copy of the same institution name. */
    institution: 'Bandung Institute of Technology (ITB)',
  },

  /** The recurring bio sentence, split at the one phrase every surface
   *  (Hero, SideNav, Footer) bolds. Reads as
   *  `${bio.prefix} ${bio.emphasis} ${bio.suffix}`; Layout.astro's meta
   *  description additionally prefixes `${fullName}, an `. Each component
   *  adds its own whitespace/line-break around `emphasis` to fit its own
   *  layout (an inline paragraph vs. a stacked sidebar panel), so that
   *  presentation detail isn't duplicated here. 80-220 chars combined
   *  recommended, keeps it to 2-3 lines at sidebar width. */
  bio: {
    prefix: 'Information Systems & Technology graduate from ITB, with',
    emphasis: 'software engineering',
    suffix: 'internship experience at two leading manufacturing companies.',
  },

  /** Public path under /public, used by every "Download CV" link/button. */
  cvUrl: '/cv/Favian-Izza-CV.pdf',

  /** 40-70 chars recommended: the <title> tag's site-wide default
   *  (Layout.astro's `title` prop can still override it per page). */
  siteTitle: 'Favian Izza | Software Engineer Portfolio - Full-Stack & IoT',
};
