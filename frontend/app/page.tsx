"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TicketList from "@/components/TicketList/TicketList";
import { createJob, getTickets } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { Ticket } from "@/lib/types";
import styles from "./page.module.css";

const ALL_CHANNELS = "all";

export default function HomePage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>(ALL_CHANNELS);
  const [loading, setLoading] = useState(true);
  const [startingJob, setStartingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumping this re-runs the fetch below (used by "Try again").
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      try {
        const data = await getTickets();
        if (cancelled) return;
        setTickets(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load tickets");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTickets();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retry() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  async function handleStartJob() {
    if (selectedTicketIds.length === 0) {
      setError("Select at least one ticket.");
      return;
    }

    try {
      setStartingJob(true);
      setError(null);

      const job = await createJob(selectedTicketIds);
      router.push(`/jobs/${job.job_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start extraction job",
      );
      setStartingJob(false);
    }
  }

  // Channels present in the data, with how many tickets each has.
  const channels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      counts.set(ticket.channel, (counts.get(ticket.channel) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (channel !== ALL_CHANNELS && ticket.channel !== channel) {
        return false;
      }

      if (!query) return true;

      return (
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.body.toLowerCase().includes(query) ||
        ticket.from_email.toLowerCase().includes(query)
      );
    });
  }, [tickets, search, channel]);

  const isFiltered = search.trim() !== "" || channel !== ALL_CHANNELS;

  function clearFilters() {
    setSearch("");
    setChannel(ALL_CHANNELS);
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.status} role="status">
          Loading tickets…
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.brand}>Extraction Workbench</p>
        <h1 className={styles.title}>Choose tickets to extract</h1>
        <p className={styles.subtitle}>
          Pick the support tickets you want turned into structured records, then
          start the extraction. You can review and fix the results afterwards.
        </p>
      </header>

      {error && (
        <div className={styles.errorBox} role="alert">
          <span>{error}</span>
          {tickets.length === 0 && (
            <button type="button" className="btn btn-sm" onClick={retry}>
              Try again
            </button>
          )}
        </div>
      )}

      <div className={styles.toolbar}>
        <p className={styles.selectedCount} aria-live="polite">
          <strong>{selectedTicketIds.length}</strong> of {tickets.length}{" "}
          selected
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleStartJob}
          disabled={startingJob || selectedTicketIds.length === 0}
        >
          {startingJob ? "Starting…" : "Start extraction"}
        </button>
      </div>

      <section className={styles.filters} aria-label="Filter tickets">
        <div className={styles.searchRow}>
          <label htmlFor="ticket-search" className={styles.filterLabel}>
            Search
          </label>
          <input
            id="ticket-search"
            type="search"
            className={`control ${styles.searchInput}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ID, subject, message or sender"
          />
        </div>

        <div className={styles.channelRow}>
          <span className={styles.filterLabel} id="channel-label">
            Channel
          </span>
          <div
            className={styles.chips}
            role="group"
            aria-labelledby="channel-label"
          >
            <button
              type="button"
              className="chip"
              aria-pressed={channel === ALL_CHANNELS}
              onClick={() => setChannel(ALL_CHANNELS)}
            >
              All <span className="chip-count">{tickets.length}</span>
            </button>

            {channels.map(([name, count]) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={channel === name}
                onClick={() => setChannel(name)}
              >
                {titleCase(name)} <span className="chip-count">{count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {filteredTickets.length === 0 ? (
        <div className={styles.status}>
          <p>
            {tickets.length === 0
              ? "There are no tickets to show yet."
              : "No tickets match your filters."}
          </p>
          {isFiltered && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <TicketList
          tickets={filteredTickets}
          totalCount={tickets.length}
          selectedTicketIds={selectedTicketIds}
          onSelectionChange={setSelectedTicketIds}
        />
      )}
    </main>
  );
}
