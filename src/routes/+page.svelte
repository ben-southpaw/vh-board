<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchTickets, type Ticket } from '../lib/ticketsApi';
	import { supabase } from '../lib/supabaseClient';

	// Define available columns
	const columns = [{ title: 'Good' }, { title: 'Bad' }, { title: 'Actions' }, { title: 'Ideas' }];

	let ticketsByColumn: Record<string, Ticket[]> = {};
	let loading = true;
	let error: string | null = null;

	// Inline editing state
	let editingTicketId: string | null = null;
	let editingTitle = '';
	let editingContent = '';

	async function refreshTickets() {
		loading = true;
		try {
			ticketsByColumn = await fetchTickets();
		} catch (e) {
			error = e.message || 'Failed to load tickets.';
		} finally {
			loading = false;
		}
	}

	// Instantly add a ticket with placeholder, then enter edit mode
	async function handleInstantAddTicket(columnTitle: string) {
		const order = (ticketsByColumn[columnTitle]?.length || 0) + 1;
		const { data, error: insertError } = await supabase
			.from('tickets')
			.insert([
				{
					title: 'New Ticket',
					content: 'Double-click to edit title and details',
					column: columnTitle,
					order
				}
			])
			.select();
		if (!insertError && data && data[0]) {
			// Optimistically add new ticket to UI
			if (!ticketsByColumn[columnTitle]) ticketsByColumn[columnTitle] = [];
			ticketsByColumn[columnTitle] = [...ticketsByColumn[columnTitle], data[0]];
			// Enter edit mode for new ticket
			editingTicketId = data[0].id;
			editingTitle = data[0].title;
			editingContent = data[0].content;
		} else {
			error = insertError?.message || 'Failed to add ticket.';
		}
	}

	function startEdit(ticket: Ticket) {
    if (editingTicketId === ticket.id) return; // Prevent resetting if already editing this ticket
    editingTicketId = ticket.id;
    editingTitle = ticket.title;
    editingContent = ticket.content || '';
  }

	// Only save when leaving the whole ticket card
	function handleTicketEditBlur(e: FocusEvent, ticket: Ticket) {
		const related = e.relatedTarget as HTMLElement | null;
		// If focus is moving to another element inside ticket-edit-wrap, do not save
		if (related && e.currentTarget && (e.currentTarget as HTMLElement).contains(related)) {
			return;
		}
		saveEdit(ticket);
	}

	// Optimistic UI update: update UI immediately, then sync with Supabase
	async function saveEdit(ticket: Ticket) {
		if (!editingTicketId) return;
		// Only save if changed
		if (editingTitle !== ticket.title || editingContent !== (ticket.content || '')) {
			// Optimistically update UI
			const updatedTicket = { ...ticket, title: editingTitle, content: editingContent };
			ticketsByColumn[ticket.column] = ticketsByColumn[ticket.column].map((t) =>
				t.id === ticket.id ? updatedTicket : t
			);
			editingTicketId = null;
			// Sync with Supabase in background
			const { error: updateError } = await supabase
				.from('tickets')
				.update({ title: editingTitle, content: editingContent })
				.eq('id', ticket.id);
			if (updateError) {
				error = updateError.message;
				// Optionally: revert optimistic update or show error
				await refreshTickets();
			}
		} else {
			editingTicketId = null;
		}
	}

	function handleEditKeydown(e: KeyboardEvent, ticket: Ticket) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit(ticket);
		} else if (e.key === 'Escape') {
			editingTicketId = null;
		}
	}

	async function removeTicket(ticket: Ticket) {
  // Optimistically remove from UI
  ticketsByColumn[ticket.column] = ticketsByColumn[ticket.column].filter(t => t.id !== ticket.id);
  // Remove from Supabase
  const { error: deleteError } = await supabase.from('tickets').delete().eq('id', ticket.id);
  if (deleteError) {
    error = deleteError.message;
    await refreshTickets();
  }
}

onMount(refreshTickets);
</script>

{#if loading}
	<div style="text-align:center; padding:2rem;">Loading tickets...</div>
{:else if error}
	<div style="color:red; text-align:center; padding:2rem;">{error}</div>
{:else}
	<div class="board-grid">
		{#each columns as column}
			<div class="column">
				<div class="column-title">{column.title}</div>
				<div class="tickets-list">
					{#if ticketsByColumn[column.title]?.length}
						{#each ticketsByColumn[column.title] as ticket}
							<div
								class="ticket-card {editingTicketId === ticket.id ? 'editing' : ''}"
								role="group"
								on:dblclick={() => startEdit(ticket)}
							>
								{#if editingTicketId === ticket.id}
									<div
										tabindex="-1"
										class="ticket-edit-wrap"
										on:focusout={(e) => handleTicketEditBlur(e, ticket)}
									>
										<input
											class="ticket-title editing"
											bind:value={editingTitle}
											on:keydown={(e) => handleEditKeydown(e, ticket)}
											maxlength={64}
											placeholder="Title"
										/>
										<br />
										<br />
										<textarea
											class="ticket-content editing"
											bind:value={editingContent}
											on:keydown={(e) => handleEditKeydown(e, ticket)}
											rows={3}
											maxlength={512}
											placeholder="Details"
										></textarea>
									</div>
								{:else}
									<button class="remove-ticket-btn" aria-label="Remove ticket" on:click={() => removeTicket(ticket)}>&times;</button>
<div class="ticket-title">{ticket.title}</div>
									{#if ticket.content}
										<div class="ticket-content">{ticket.content}</div>
									{/if}
								{/if}
							</div>
						{/each}
					{/if}

					<button
						class="add-ticket-btn"
						aria-label="Add ticket"
						on:click={() => handleInstantAddTicket(column.title)}
					>
						<span>+</span>
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
