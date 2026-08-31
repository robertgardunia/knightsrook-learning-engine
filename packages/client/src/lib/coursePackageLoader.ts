import type { CoursePackage } from "@learning-engine/shared-types"

/**
 * The entire assembly claim rests on this being trivial: a course package is
 * just JSON served from public/courses/<id>/. No build step, no source edit.
 */
export async function loadCoursePackage(courseId: string): Promise<CoursePackage> {
  const res = await fetch(`/courses/${courseId}/course.json`)
  if (!res.ok) throw new Error(`Failed to load course package "${courseId}": ${res.status}`)
  return res.json()
}
