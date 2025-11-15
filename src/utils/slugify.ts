/**
 * Generate URL-friendly slug from text
 * - Converts to lowercase
 * - Replaces spaces and special chars with hyphens
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove all non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Replace consecutive hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length
    .substring(0, 100)
}

/**
 * Generate unique slug by appending number if needed
 * @param baseSlug - The initial slug
 * @param existingSlugs - Array of already-used slugs to check against
 * @returns A unique slug
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = slugify(baseSlug)

  // If empty after slugify, use fallback
  if (!slug) {
    slug = 'view'
  }

  // Check if slug already exists
  if (!existingSlugs.includes(slug)) {
    return slug
  }

  // Find unique suffix
  let counter = 1
  let uniqueSlug = `${slug}-${counter}`

  while (existingSlugs.includes(uniqueSlug)) {
    counter++
    uniqueSlug = `${slug}-${counter}`
  }

  return uniqueSlug
}
