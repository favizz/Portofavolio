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
      'A NestJS + MySQL backend streaming live MQTT telemetry from 2,444+ smart meters into prepaid token billing.',
    highlights: [
      '12-detector anomaly engine (tamper, reverse-flow, sensor-fault), hardened by 80+ Jest tests',
      'Multi-tenant access secured with Google OAuth 2.0, JWT, and RBAC across buildings',
    ],
    tags: ['NestJS', 'MySQL', 'MQTT', 'JWT'],
    url: 'https://netflow-demo.vercel.app/',
  },
  {
    slug: 'genealogy-platform',
    name: 'Genealogy Platform',
    tag: 'Full-Stack System Design',
    period: 'Mar 2026 - Present',
    image: '/images/placeholders/expand.webp',
    cardImage: '/images/projects/genealogy-platform-front.webp',
    stageImage: '/images/projects/genealogy-platform-inside.webp',
    description:
      'A full-stack application built on a shared-type monorepo, mapping complex, non-linear family structures.',
    highlights: [
      'Custom graph layout engine for complex family structures using BFS-based positioning',
      'Interactive visualization with React Flow, supporting multi-parent and non-linear relationships',
      'BFS-based consanguinity checks flag close-relative conflicts up to 3 generations',
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
      'An end-to-end fraud detection pipeline on 100k+ transactions with severe class imbalance (~14%).',
    highlights: [
      'Decision Tree, Logistic Regression, and KNN implemented from scratch, including gradient descent and L2 regularization',
      'Improved fraud recall from 0.02 to 0.52 via class weighting and SMOTE, cutting false negatives 25x',
    ],
    tags: ['Python', 'Machine Learning', 'Scikit-learn'],
    url: 'https://detection-fraud-demo.vercel.app/',
  },
  {
    slug: 'trich-website',
    name: 'Trich AI Barberspace',
    tag: 'AI-Driven Barbershop Website',
    period: 'Nov 2024',
    image: '/images/placeholders/expand.webp',
    cardImage: '/images/projects/trich-website-front.webp',
    stageImage: '/images/projects/trich-website-inside.webp',
    description:
      'The public-facing website for an AI-driven barbershop concept, built end-to-end as the Front-End Developer during the Trich AI Barberspace internship.',
    highlights: [
      'Implemented a responsive, sleek UI/UX from concept to production, optimizing interactions to match requirements',
    ],
    tags: [],
    url: 'https://trich-demo.vercel.app/',
  },
];
