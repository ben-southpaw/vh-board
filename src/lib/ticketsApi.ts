import { supabase } from './supabaseClient';

export type Ticket = {
	id: string;
	title: string;
	column: string;
	order: number;
	rowSpan?: number;
	colSpan?: number;
	content?: string;
};

// Fetch all tickets, grouped by column
export async function fetchTickets(): Promise<Record<string, Ticket[]>> {
	const { data, error } = await supabase
		.from('tickets')
		.select('*')
		.order('order', { ascending: true });
	if (error) throw error;

	// Group tickets by column
	const grouped: Record<string, Ticket[]> = {};
	for (const ticket of data as Ticket[]) {
		if (!grouped[ticket.column]) grouped[ticket.column] = [];
		grouped[ticket.column].push(ticket);
	}
	return grouped;
}
