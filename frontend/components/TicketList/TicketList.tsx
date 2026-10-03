"use client";

import type { Ticket } from "@/lib/types";
import styles from "./TicketList.module.css";

interface TicketListProps {
  tickets: Ticket[];
  selectedTicketIds: string[];
  onSelectionChange: (ticketIds: string[]) => void;
}

export default function TicketList({
  tickets,
  selectedTicketIds,
  onSelectionChange,
}: TicketListProps) {
  function toggleTicket(ticketId: string) {
    if (selectedTicketIds.includes(ticketId)) {
      onSelectionChange(
        selectedTicketIds.filter((id) => id !== ticketId),
      );
      return;
    }

    onSelectionChange([...selectedTicketIds, ticketId]);
  }

  function selectAll() {
    onSelectionChange(tickets.map((ticket) => ticket.id));
  }

  function clearSelection() {
    onSelectionChange([]);
  }

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Tickets</h2>
          <p>
            {tickets.length} tickets · {selectedTicketIds.length} selected
          </p>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={selectAll}>
            Select all
          </button>

          <button type="button" onClick={clearSelection}>
            Clear
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {tickets.map((ticket) => {
          const selected = selectedTicketIds.includes(ticket.id);

          return (
            <article
              key={ticket.id}
              className={`${styles.ticket} ${
                selected ? styles.selected : ""
              }`}
            >
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleTicket(ticket.id)}
                />

                <span>
                  <strong>
                    {ticket.subject || "(No subject)"}
                  </strong>

                  <small>{ticket.id}</small>
                </span>
              </label>

              <p className={styles.body}>
                {ticket.body}
              </p>

              <div className={styles.metadata}>
                <span>{ticket.from_email}</span>
                <span>{ticket.channel}</span>
                <span>{ticket.received_at}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}