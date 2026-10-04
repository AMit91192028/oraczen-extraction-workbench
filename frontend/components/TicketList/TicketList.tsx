"use client";

import { useState } from "react";

import { formatDate, titleCase } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import styles from "./TicketList.module.css";

interface TicketListProps {
  /** Tickets currently visible (after search / channel filters). */
  tickets: Ticket[];
  /** Total tickets before filtering, used for the "Showing x of y" text. */
  totalCount?: number;
  selectedTicketIds: string[];
  onSelectionChange: (ticketIds: string[]) => void;
}

const LONG_BODY_CHARS = 220;

function TicketCard({
  ticket,
  selected,
  onToggle,
}: {
  ticket: Ticket;
  selected: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong =
    ticket.body.length > LONG_BODY_CHARS || ticket.body.split("\n").length > 3;

  return (
    <article className={`${styles.ticket} ${selected ? styles.selected : ""}`}>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={selected} onChange={onToggle} />

        <span className={styles.heading}>
          <strong className={styles.subject}>
            {ticket.subject || "(No subject)"}
          </strong>
          <small className={styles.id}>{ticket.id}</small>
        </span>
      </label>

      <p className={`${styles.body} ${!expanded && isLong ? styles.clamped : ""}`}>
        {ticket.body}
      </p>

      {isLong && (
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <div className={styles.metadata}>
        <span className="pill" data-tone="accent">
          {titleCase(ticket.channel)}
        </span>
        <span className="pill">{ticket.from_email}</span>
        <span className="pill">{formatDate(ticket.received_at)}</span>
      </div>
    </article>
  );
}

export default function TicketList({
  tickets,
  totalCount,
  selectedTicketIds,
  onSelectionChange,
}: TicketListProps) {
  const total = totalCount ?? tickets.length;
  const isFiltered = tickets.length < total;

  function toggleTicket(ticketId: string) {
    if (selectedTicketIds.includes(ticketId)) {
      onSelectionChange(selectedTicketIds.filter((id) => id !== ticketId));
      return;
    }

    onSelectionChange([...selectedTicketIds, ticketId]);
  }

  // Adds every visible ticket to the selection (keeps earlier picks).
  function selectAll() {
    onSelectionChange(
      Array.from(new Set([...selectedTicketIds, ...tickets.map((t) => t.id)])),
    );
  }

  function clearSelection() {
    onSelectionChange([]);
  }

  return (
    <section className={styles.container} aria-labelledby="tickets-heading">
      <div className={styles.header}>
        <div>
          <h2 id="tickets-heading">Tickets</h2>
          <p>
            Showing {tickets.length} of {total}
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn btn-sm" onClick={selectAll}>
            {isFiltered ? "Select shown" : "Select all"}
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={clearSelection}
            disabled={selectedTicketIds.length === 0}
          >
            Clear selection
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            selected={selectedTicketIds.includes(ticket.id)}
            onToggle={() => toggleTicket(ticket.id)}
          />
        ))}
      </div>
    </section>
  );
}
