# VH-Board: Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Data Flow](#data-flow)
4. [Key Components](#key-components)
5. [UI Components](#ui-components)
6. [Reactivity System](#reactivity-system)
7. [Animation System](#animation-system)
8. [Deployment Guide](#deployment-guide)

## Architecture Overview

VH-Board is a real-time collaborative board application built with SvelteKit and Supabase. It enables users to create, edit, and vote on tickets organized in columns. The application uses Supabase's real-time subscriptions for immediate updates across all connected clients.

### Technology Stack

- **Frontend**: SvelteKit with TypeScript
- **Backend**: Supabase (PostgreSQL database with real-time capabilities)
- **Styling**: SCSS with responsive design
- **Animation**: Svelte's built-in flip animations
- **Deployment**: Vercel

## File Structure

```
vh-board/
├── src/
│   ├── lib/
│   │   ├── supabaseClient.ts     # Supabase connection and initialization
│   │   ├── ticketsApi.ts         # Ticket data operations
│   │   └── votesApi.ts           # Vote data operations
│   ├── routes/
│   │   ├── +page.svelte          # Main board component and UI
│   │   ├── +page.js              # Page configuration (disables SSR)
│   │   └── +layout.svelte        # App layout and style imports
│   └── styles/
│       └── global.scss           # Global styles and UI scaling
├── static/                       # Static assets
└── .env                          # Environment variables
```

## Data Flow

The application follows a unidirectional data flow pattern:

1. **Data Initialization**:
   - `onMount` triggers data fetching from Supabase
   - `fetchTickets()` loads tickets and groups them by column
   - `fetchVotes()` loads current vote data
   - `subscribeToVotes()` establishes real-time subscription

2. **User Interactions**:
   - Actions (add/edit/delete tickets, voting) trigger optimistic UI updates
   - API calls update Supabase database
   - Supabase sends real-time updates to all clients via subscription channels
   - Subscribers receive updates and refresh local state

3. **State Management**:
   - Local state for tickets, votes, and UI is managed in `+page.svelte`
   - API modules separate data operations from UI logic
   - Reactivity is maintained through Svelte's reactive declarations

## Key Components

### supabaseClient.ts

This module initializes the Supabase client and handles connection management:

```typescript
// Initialization with error handling and environment variable processing
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Strip quotes from environment variables (important for deployment)
supabaseUrl = supabaseUrl?.replace(/^"|"$|\/"/g, '');
supabaseAnonKey = supabaseAnonKey?.replace(/^"|"$|\/"/g, '');

// Create client with fallback for SSR
let supabase;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Mock client for SSR context
  supabase = { /* mock implementation */ } as any;
}
```

**Purpose**: Provides a centralized Supabase client instance that handles:
- Environment variable processing
- Quote stripping for deployment compatibility
- Fallback mock for server-side rendering

### ticketsApi.ts

Manages ticket data operations with Supabase:

```typescript
// Type definition for ticket data
export type Ticket = {
  id: string;
  title: string;
  column: string;
  order: number;
  content?: string;
};

// Fetch and group tickets by column
export async function fetchTickets(): Promise<Record<string, Ticket[]>> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('order', { ascending: true });
  
  // Group by column
  const grouped = {};
  for (const ticket of data) {
    if (!grouped[ticket.column]) grouped[ticket.column] = [];
    grouped[ticket.column].push(ticket);
  }
  return grouped;
}
```

**Purpose**: Abstracts database operations for tickets, providing:
- Type definitions for ticket data
- Functions for fetching tickets
- Data transformation (grouping by column)

### votesApi.ts

Handles vote operations and real-time subscriptions:

```typescript
// Real-time subscription setup
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

// Vote operations
export async function addVote(ticket_id: string, voter_id: string): Promise<void> {
  const { error } = await supabase.from('votes').insert([{ ticket_id, voter_id }]);
  if (error) throw error;
}
```

**Purpose**: Manages vote data and real-time updates:
- Vote CRUD operations
- Real-time subscription setup
- Unsubscription cleanup for proper lifecycle management

## UI Components

### +page.svelte

The main application component that includes:

1. **Data Management**:
   ```typescript
   let ticketsByColumn: Record<string, Ticket[]> = {};
   let votes: Vote[] = [];
   let loading = true;
   let error: string | null = null;
   ```

2. **User Identification**:
   ```typescript
   function getCurrentVoterId() {
     if (typeof window !== 'undefined') {  // SSR compatibility
       let id = localStorage.getItem('voter_id');
       if (!id) {
         id = crypto.randomUUID();
         localStorage.setItem('voter_id', id);
       }
       return id;
     }
     return 'ssr-placeholder';
   }
   ```

3. **Vote Management**:
   ```typescript
   async function toggleVote(ticket: Ticket) {
     const voterId = getCurrentVoterId();
     if (hasVoted(ticket)) {
       await removeVote(ticket.id, voterId);
     } else {
       await addVote(ticket.id, voterId);
     }
     await loadVotes();
   }
   ```

4. **Ticket Editing**:
   ```typescript
   function startEdit(ticket: Ticket) {
     if (editingTicketId === ticket.id) return; // Prevent reset if already editing
     editingTicketId = ticket.id;
     editingTitle = ticket.title;
     editingContent = ticket.content || '';
   }
   ```

5. **Optimistic UI Updates**:
   ```typescript
   async function saveEdit(ticket: Ticket) {
     // Optimistically update UI first
     const updatedTicket = { ...ticket, title: editingTitle, content: editingContent };
     ticketsByColumn[ticket.column] = ticketsByColumn[ticket.column].map((t) =>
       t.id === ticket.id ? updatedTicket : t
     );
     editingTicketId = null;
     
     // Then sync with backend
     const { error: updateError } = await supabase
       .from('tickets')
       .update({ title: editingTitle, content: editingContent })
       .eq('id', ticket.id);
   }
   ```

6. **Lifecycle Management**:
   ```typescript
   onMount(async () => {
     await refreshTickets();
     await loadVotes();
     votesUnsubscribe = subscribeToVotes(() => {
       loadVotes();
     });
   });

   onDestroy(() => {
     if (votesUnsubscribe) {
       votesUnsubscribe();
     }
   });
   ```

## Reactivity System

The application leverages Svelte's built-in reactivity:

1. **Force Reactivity with Spread Operator**:
   ```typescript
   async function loadVotes() {
     const newVotes = await fetchVotes();
     votes = [...newVotes]; // force reactivity with new array reference
   }
   ```

2. **Key Block for Vote Updates**:
   ```svelte
   {#key votes.length}
     <span class="vote-count">{getVoteCount(ticket)}</span>
   {/key}
   ```

3. **Optimistic UI Updates**:
   ```typescript
   // Immediately update UI, then sync with backend
   ticketsByColumn[ticket.column] = ticketsByColumn[ticket.column]
     .filter((t) => t.id !== ticket.id);
   
   // Then remove from Supabase
   await supabase.from('tickets').delete().eq('id', ticket.id);
   ```

## Animation System

The board uses Svelte's flip animation for smooth ticket reordering:

1. **Import Animation Dependencies**:
   ```typescript
   import { flip } from 'svelte/animate';
   import { elasticOut } from 'svelte/easing';
   ```

2. **Apply Animation to Tickets**:
   ```svelte
   {#each ticketsByColumn[column.title].sort((a, b) => getVoteCount(b) - getVoteCount(a)) as ticket (ticket.id)}
     <div
       class="ticket-card {editingTicketId === ticket.id ? 'editing' : ''}"
       animate:flip="{{duration: 800, easing: elasticOut}}"
     >
       <!-- Ticket content -->
     </div>
   {/each}
   ```

3. **Sort Tickets by Vote Count**:
   ```javascript
   ticketsByColumn[column.title].sort((a, b) => getVoteCount(b) - getVoteCount(a))
   ```

This creates a smooth animation when tickets change order based on votes.

## Deployment Guide

### Environment Setup

1. **Required Environment Variables**:
   - `VITE_SUPABASE_URL`: Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key

2. **Vercel Deployment**:
   - Environment variables must be set without quotes:
     ```
     VITE_SUPABASE_URL = https://yourproject.supabase.co
     VITE_SUPABASE_ANON_KEY = your-key-without-quotes
     ```

3. **SSR Considerations**:
   - Browser-only APIs are protected with checks:
     ```javascript
     if (typeof window !== 'undefined') {
       // Browser-only code
     }
     ```
   - SSR is disabled via `+page.js`:
     ```javascript
     export const ssr = false;
     ```

### Troubleshooting Common Issues

1. **Invalid URL Error**:
   - Check for quotes in environment variables
   - Use the quote-stripping mechanism in supabaseClient.ts

2. **Browser API Errors**:
   - Ensure all browser-only APIs (localStorage, window) are wrapped in environment checks
   - Consider disabling SSR for pages with heavy browser API usage

3. **Real-time Updates Not Working**:
   - Check subscription setup and cleanup in lifecycle hooks
   - Verify Supabase database permissions
