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

/**
 * Same as findRelatedProject, but honors an experience entry's explicit
 * `relatedProjectSlug` first (a real, direct relationship stated by the
 * user, e.g. ITB -> Netflow, that doesn't come from genuine shared tags,
 * so forcing it through tag-overlap would mean giving ITB a fake
 * technology tag just to make the match work, which would incorrectly
 * make that technology's tile on the Technology page link to ITB too).
 * Falls back to the normal tag-based match when no override is set.
 */
export function findRelatedProjectsForJob(job: {
  tags: string[];
  relatedProjectSlug?: string | string[] | null;
}): { slug: string; name: string }[] {
  // null means "explicitly none": a real tag (e.g. TMMIN's Python) exists but
  // the user says no portfolio project is actually related to that job.
  if (job.relatedProjectSlug === null) return [];
  if (job.relatedProjectSlug) {
    const slugs = Array.isArray(job.relatedProjectSlug) ? job.relatedProjectSlug : [job.relatedProjectSlug];
    return slugs.flatMap((slug) => {
      const project = projects.find((p) => p.slug === slug);
      return project ? [{ slug: project.slug, name: project.name }] : [];
    });
  }
  const byTag = findRelatedProject(job.tags);
  return byTag ? [byTag] : [];
}
