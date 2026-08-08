export const projects = [
  {
    slug: 'netflow',
    name: 'Netflow',
    tag: 'IoT Prepaid Utility Metering System',
    period: 'Jun 2026',
    image: '/images/placeholders/expand.webp',
    cardImage: '/images/projects/netflow-front.webp',
    stageImage: '/images/projects/netflow-inside.webp',
    description:
      'A NestJS + MySQL backend streaming live MQTT telemetry from <strong>2,444+ smart meters</strong> into prepaid token billing.',
    highlights: [
      '<strong>12-detector anomaly engine</strong> (tamper, reverse-flow, sensor-fault), hardened by <strong>80+ Jest tests</strong>',
      'Multi-tenant access secured with Google OAuth 2.0, JWT, and RBAC across buildings',
    ],
    tags: ['NestJS', 'MySQL', 'MQTT', 'JWT'],
    url: 'https://netflow-demo.vercel.app/',
  },
  {
    slug: 'genealogy-platform',
    name: 'Genyra',
    tag: 'Genealogy Platform',
    period: 'Mar 2026',
    image: '/images/placeholders/expand.webp',
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
    image: '/images/placeholders/expand.webp',
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
    slug: 'trich-website',
    name: 'Trich AI Barberspace',
    shortName: 'Trich AI',
    tag: 'AI-Driven Barbershop Website',
    period: 'Nov 2024',
    image: '/images/placeholders/expand.webp',
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
