import { writable, derived, get } from 'svelte/store';
import { fetchVotes, addVote, removeVote, subscribeToVotes } from '../votesApi';
import { getOrCreateVoterId } from '../utils/idGenerator';

// Create the main votes store
export const votes = writable([]);
export const error = writable(null);

// Setup Supabase real-time subscription
let unsubscribeFunc = null;

/**
 * Set up a subscription to vote changes and return a cleanup function
 * @returns {Function} Cleanup function to unsubscribe
 */
export function setupVoteSubscription() {
  if (unsubscribeFunc) unsubscribeFunc();
  
  unsubscribeFunc = subscribeToVotes(() => {
    loadVotes();
  });
  
  return () => {
    if (unsubscribeFunc) unsubscribeFunc();
  };
}

/**
 * Load votes from the server
 */
export async function loadVotes() {
  try {
    const newVotes = await fetchVotes();
    votes.set([...newVotes]); // Force Svelte reactivity with a new array
  } catch (e) {
    error.set((e instanceof Error) ? e.message : 'Failed to load votes.');
  }
}

/**
 * Get the number of votes for a specific ticket
 * @param {Object} ticket - The ticket to count votes for
 * @returns {number} The number of votes for the ticket
 */
export function getVoteCount(ticket) {
  const votesValue = get(votes);
  return votesValue.filter(v => v.ticket_id === ticket.id).length;
}

/**
 * Check if the current user has voted for a specific ticket
 * @param {Object} ticket - The ticket to check
 * @returns {boolean} Whether the current user has voted for the ticket
 */
export function hasVoted(ticket) {
  const voterId = getOrCreateVoterId();
  const votesValue = get(votes);
  return votesValue.some(v => v.ticket_id === ticket.id && v.voter_id === voterId);
}

/**
 * Toggle the vote status for a ticket
 * @param {Object} ticket - The ticket to toggle the vote for
 */
export async function toggleVote(ticket) {
  const voterId = getOrCreateVoterId();
  
  try {
    if (hasVoted(ticket)) {
      await removeVote(ticket.id, voterId);
    } else {
      await addVote(ticket.id, voterId);
    }
    await loadVotes();
  } catch (e) {
    error.set((e instanceof Error) ? e.message : 'Failed to update vote.');
  }
}
