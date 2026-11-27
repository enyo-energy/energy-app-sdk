/**
 * Name matching shared by the compatibility validator and
 * `findCompatibleAppOptions()`. Internal: not exported from the package root.
 */

/**
 * Normalizes a vendor or model name so that names a customer cannot tell apart
 * compare equal ("ID.3" / " id.3 ").
 *
 * @param name - The declared or queried name.
 * @returns The trimmed, lower-cased name with inner whitespace collapsed.
 */
export function normalizeCompatibilityName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
