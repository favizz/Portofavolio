import { projects } from './projects';
import { experience } from './experience';

export type Relation = { type: 'project' | 'career'; slug: string; label: string };

/**
 * Finds where a given technology name is actually evidenced (a project or an
 * experience whose tags include it), so Technology tiles only link somewhere
 * real instead of a hardcoded guess. Projects win over experience on tie.
 */
export function findTechRelation(techName: string): Relation | null {
  const project = projects.find((p) => p.tags.some((t) => t.toLowerCase() === techName.toLowerCase()));
  if (project) return { type: 'project', slug: project.slug, label: project.name };

  const job = experience.find((e) => e.tags.some((t) => t.toLowerCase() === techName.toLowerCase()));
  if (job) return { type: 'career', slug: job.slug, label: job.company };

  return null;
}

/**
 * Finds the project that best matches an experience entry's tags, used to
 * point a Career card's primary button at a related Project instead of an
 * external link.
 */
export function findRelatedProject(tags: string[]): { slug: string; name: string } | null {
  if (tags.length === 0) return null;
  const project = projects.find((p) => p.tags.some((t) => tags.some((tag) => tag.toLowerCase() === t.toLowerCase())));
  return project ? { slug: project.slug, name: project.name } : null;
}
