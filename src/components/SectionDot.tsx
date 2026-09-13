import type { Section } from '../types.ts'

/** Section identity is carried by this mark, never by text color. */
export function SectionDot({ section }: { section: Section }) {
  return <span className="section-dot" data-section={section} aria-hidden />
}
