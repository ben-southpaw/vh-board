import { supabase } from './supabaseClient';

// Subscribe to votes table changes (insert/delete)
export function subscribeToVotes(onChange: () => void) {
  const channel = supabase.channel('votes-changes');
  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'votes' },
      payload => {
        onChange();
      }
    )
    .subscribe();
  return () => {
    channel.unsubscribe();
  };
}

export type Vote = {
  id: string;
  ticket_id: string;
  voter_id: string;
};

export async function fetchVotes(): Promise<Vote[]> {
  const { data, error } = await supabase.from('votes').select('*');
  if (error) throw error;
  return data as Vote[];
}

export async function addVote(ticket_id: string, voter_id: string): Promise<void> {
  const { error } = await supabase.from('votes').insert([{ ticket_id, voter_id }]);
  if (error) throw error;
}

export async function removeVote(ticket_id: string, voter_id: string): Promise<void> {
  const { error } = await supabase.from('votes').delete().eq('ticket_id', ticket_id).eq('voter_id', voter_id);
  if (error) throw error;
}
