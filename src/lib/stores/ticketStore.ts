import { writable, get } from 'svelte/store';
import { fetchTickets } from '../ticketsApi';
import { supabase } from '../supabaseClient';

// Create stores for tickets data
export const tickets = writable([]);
export const ticketsByColumn = writable({});
export const loading = writable(true);
export const error = writable(null);

// Editing state
export const editingTicketId = writable(null);
export const editingTitle = writable('');
export const editingContent = writable('');

/**
 * Refresh all tickets from the server
 */
export async function refreshTickets() {
  try {
    loading.set(true);
    const data = await fetchTickets();
    
    // Group tickets by column
    const byColumn = {};
    data.forEach(ticket => {
      const columnName = ticket.column;
      byColumn[columnName] = byColumn[columnName] || [];
      byColumn[columnName].push(ticket);
    });
    
    ticketsByColumn.set(byColumn);
    tickets.set(data);
  } catch (e) {
    error.set((e instanceof Error) ? e.message : 'Failed to load tickets.');
  } finally {
    loading.set(false);
  }
}

/**
 * Add a new ticket to a column
 * @param {string} columnTitle - The column to add the ticket to
 * @param {string} title - The ticket title
 * @param {string} content - The ticket content
 */
export async function addTicket(columnTitle, title = 'New ticket', content = '') {
  try {
    // Create new ticket object
    const newTicket = {
      title,
      content,
      column: columnTitle,
      created_at: new Date().toISOString()
    };
    
    // Optimistically update UI
    const currentByColumn = get(ticketsByColumn);
    const columnTickets = [...(currentByColumn[columnTitle] || [])];
    columnTickets.push({...newTicket, id: 'temp-' + Date.now()});
    
    ticketsByColumn.update(c => ({
      ...c,
      [columnTitle]: columnTickets
    }));
    
    // Add to Supabase
    const { data, error: insertError } = await supabase.from('tickets').insert([newTicket]).select();
    
    if (insertError) {
      error.set(insertError.message);
      // Revert optimistic update
      await refreshTickets();
    } else {
      // Update with real data from server
      await refreshTickets();
    }
  } catch (e) {
    error.set((e instanceof Error) ? e.message : 'Failed to add ticket.');
    await refreshTickets();
  }
}

/**
 * Update an existing ticket
 * @param {string} id - The ticket ID
 * @param {Object} updates - The fields to update
 */
export async function updateTicket(id, updates) {
  try {
    // Optimistically update UI
    const currentTickets = get(tickets);
    const updatedTickets = currentTickets.map(t => 
      t.id === id ? {...t, ...updates} : t
    );
    
    // Update the ticketsByColumn store based on the updated tickets
    const updatedByColumn = {};
    updatedTickets.forEach(ticket => {
      const columnName = ticket.column;
      updatedByColumn[columnName] = updatedByColumn[columnName] || [];
      updatedByColumn[columnName].push(ticket);
    });
    
    tickets.set(updatedTickets);
    ticketsByColumn.set(updatedByColumn);
    
    // Update in Supabase
    const { error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', id);
      
    if (updateError) {
      error.set(updateError.message);
      await refreshTickets();
    }
  } catch (e) {
    error.set((e instanceof Error) ? e.message : 'Failed to update ticket.');
    await refreshTickets();
  }
}

/**
 * Remove a ticket
 * @param {Object} ticket - The ticket to remove
 */
export async function removeTicket(ticket) {
  try {
    // Optimistically remove from UI
    const currentByColumn = get(ticketsByColumn);
    const columnTickets = currentByColumn[ticket.column].filter(t => t.id !== ticket.id);
    
    ticketsByColumn.update(c => ({
      ...c,
      [ticket.column]: columnTickets
    }));
    
    // Remove from Supabase
    const { error: deleteError } = await supabase.from('tickets').delete().eq('id', ticket.id);
    
    if (deleteError) {
      error.set(deleteError.message);
      await refreshTickets();
    }
  } catch (e) {
    error.set((e instanceof Error) ? e.message : 'Failed to remove ticket.');
    await refreshTickets();
  }
}

/**
 * Start editing a ticket
 * @param {Object} ticket - The ticket to edit
 */
export function startEdit(ticket) {
  const currentEditingId = get(editingTicketId);
  if (currentEditingId === ticket.id) return; // Prevent resetting if already editing
  
  editingTicketId.set(ticket.id);
  editingTitle.set(ticket.title);
  editingContent.set(ticket.content || '');
}

/**
 * Save ticket edits
 * @param {Object} ticket - The ticket being edited
 */
export function saveEdit(ticket) {
  const id = get(editingTicketId);
  const title = get(editingTitle);
  const content = get(editingContent);
  
  if (id === ticket.id) {
    updateTicket(ticket.id, {
      title,
      content
    });
    editingTicketId.set(null);
  }
}

/**
 * Cancel editing
 */
export function cancelEdit() {
  editingTicketId.set(null);
}
