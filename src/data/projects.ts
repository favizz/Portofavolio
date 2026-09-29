export const projects = [
  {
    slug: 'netflow',
    name: 'Netflow',
    tag: 'IoT Prepaid Utility Metering System',
    period: 'Jun 2026',
    cardImage: '/images/projects/netflow-front.webp',
    stageImage: '/images/projects/netflow-inside.webp',
    description:
      'A NestJS + MySQL backend streaming live MQTT telemetry from <strong>2,444+ smart meters</strong> into prepaid token billing, plus the two React frontends (building-manager dashboard, resident web app) that consume it.',
    highlights: [
      '<strong>13-detector anomaly engine</strong> (backflow, tamper, sensor faults, MCB trips, and more), hardened by <strong>80+ Jest tests</strong>',
      'Multi-tenant access secured with Google OAuth 2.0, JWT, and RBAC across buildings',
      'Background job queue (BullMQ/Redis) fans out OTA firmware updates and notification delivery',
    ],
    tags: ['NestJS', 'TypeScript', 'React', 'MySQL', 'Redis', 'MQTT', 'JWT'],
    url: 'https://netflow-demo.vercel.app/',
  },
  {
    slug: 'genealogy-platform',
    name: 'Genyra',
    tag: 'Genealogy Platform',
    period: 'Mar 2026',
    cardImage: '/images/projects/genealogy-platform-front.webp',
    stageImage: '/images/projects/genealogy-platform-inside.webp',
    description:
      "Built on a shared-type monorepo (NestJS/Fastify backend, Next.js frontend, PostgreSQL via Prisma) for one real family, <strong>replacing manual spreadsheets and photos</strong> with an interactive, node-based family tree. Secured with Google OAuth 2.0, argon2id-hashed refresh tokens, and Zod-validated input on every request.",
    highlights: [
      'Multi-phase auto-layout engine positions nodes across generations, handling multi-marriage and overlapping-branch cases <strong>without manual placement</strong>',
      'Interactive React Flow canvas supports <strong>multi-parent and non-linear relationships</strong>, not a strict single-lineage tree',
      'BFS-based consanguinity checks <strong>flag close-relative conflicts up to 3 generations</strong> before a relationship can be saved',
      "<strong>Fixed a Fastify/Passport OAuth crash</strong>: Fastify's reply object lacks Express's res.setHeader, which Passport's redirect step calls internally",
    ],
    tags: ['NestJS', 'Next.js', 'PostgreSQL', 'React Flow'],
    url: 'https://genyra.vercel.app/',
  },
  {
    slug: 'fraud-detection-system',
    name: 'Fraud Detection System',
    tag: 'Custom ML Pipeline',
    period: 'Dec 2025',
    cardImage: '/images/projects/fraud-detection-system-front.webp',
    stageImage: '/images/projects/fraud-detection-system-inside.webp',
    description:
      'An end-to-end fraud detection pipeline on <strong>100k+ transactions</strong> with severe class imbalance (~14%).',
    highlights: [
      'Decision Tree, Logistic Regression, and KNN implemented from scratch, including gradient descent and L2 regularization',
      'Improved fraud recall <strong>from 0.02 to 0.52</strong> via class weighting and SMOTE, <strong>cutting false negatives 25x</strong>',
    ],
    tags: ['Python', 'Machine Learning', 'Scikit-learn'],
    url: 'https://detection-fraud-demo.vercel.app/',
  },
  {
    slug: 'transjakarta-analytics',
    name: 'CrowdEase',
    tag: 'Public-Transit Data Platform',
    period: 'Oct 2025',
    cardImage: '/images/projects/transjakarta-analytics-front.webp',
    stageImage: '/images/projects/transjakarta-analytics-inside.webp',
    description:
      "Started as <a href=\"https://crowdease-transjakarta.vercel.app/\" target=\"_blank\" rel=\"noopener\">a rider-facing mockup</a> of a TransJakarta app with bus-occupancy monitoring built in (a simulated mock, not a live feed), then extended into a real analytics backend on TransJakarta's own official GTFS feed (NestJS API, Next.js frontend, PostgreSQL, plus a Go microservice for spatial analysis) computing real service-frequency, coverage, and transfer-network metrics across all <strong>240 routes and 8,091 stops</strong>. The demo replays buses along their real route paths and recommends the best time to ride each route, peak hours included.",
    highlights: [
      'Go-based spatial-hash walkshed engine computes real 500m coverage for all 8,091 stops, avoiding a ~130M-calculation naive nearest-stop search',
      'Batched ingestion pipeline loads all ~252,000 real GTFS rows (agency through shapes) into Postgres in under 600 round trips instead of one row at a time',
      'Best-time-to-ride advisor combines each route\'s real published bus frequency with a typical commuter demand pattern to flag peak hours, labeled as an estimate rather than measured ridership',
      "Fleet View simulates bus positions along TransJakarta's own real shape polylines from the feed's real schedule, since the feed publishes no live vehicle-position API",
    ],
    tags: ['NestJS', 'Next.js', 'PostgreSQL', 'Go', 'Leaflet'],
    url: 'https://portofavolio-rmww.vercel.app/',
  },
  {
    slug: 'trich-website',
    name: 'Trich AI Barberspace',
    shortName: 'Trich AI',
    tag: 'AI-Driven Barbershop Website',
    period: 'Nov 2024',
    cardImage: '/images/projects/trich-website-front.webp',
    stageImage: '/images/projects/trich-website-inside.webp',
    description:
      'The public-facing website for an AI-driven barbershop concept, <strong>built end-to-end</strong> as the Front-End Developer during the Trich AI Barberspace internship.',
    highlights: [
      'Implemented a responsive, sleek UI/UX from concept to production, optimizing interactions to match requirements',
    ],
    tags: [],
    url: 'https://trich-demo.vercel.app/',
  },
];
