/**
 * ID Generation utility functions
 */

/**
 * Generate a unique ID using the crypto API
 * @returns A UUID string
 */
export function generateUniqueId(): string {
  return crypto.randomUUID();
}

/**
 * Get the current voter ID from localStorage or create a new one if it doesn't exist
 * @returns The voter ID
 */
export function getOrCreateVoterId(): string {
  let id = localStorage.getItem('voter_id');
  if (!id) {
    id = generateUniqueId();
    localStorage.setItem('voter_id', id);
  }
  return id;
}
