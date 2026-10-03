
"use client";
 
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
 
import TicketList from "@/components/TicketList/TicketList";
import { createJob, getTickets } from "@/lib/api";
import type { Ticket } from "@/lib/types";
import styles from "./page.module.css";
 
export default function HomePage() {
  const router = useRouter();
 
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingJob, setStartingJob] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true);
        setError(null);
 
        const data = await getTickets();
        setTickets(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load tickets",
        );
      } finally {
        setLoading(false);
      }
    }
 
    loadTickets();
  }, []);
 
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
        err instanceof Error
          ? err.message
          : "Failed to start extraction job",
      );
    } finally {
      setStartingJob(false);
    }
  }
 
  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.status}>Loading tickets...</p>
      </main>
    );
  }
 
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Extraction Workbench</p>
        <h1 className={styles.title}>Process your tickets</h1>
        <p className={styles.subtitle}>
          Select the tickets you want to process.
        </p>
      </header>
 
      {error && (
        <p className={styles.errorBox} role="alert">
          {error}
        </p>
      )}
 
      <div className={styles.toolbar}>
        <p className={styles.selectedCount}>
          <strong>{selectedTicketIds.length}</strong> of{" "}
          {tickets.length} selected
        </p>
 
        <button
          type="button"
          className={styles.primary}
          onClick={handleStartJob}
          disabled={startingJob || selectedTicketIds.length === 0}
        >
          {startingJob ? "Starting..." : "Start extraction"}
        </button>
      </div>
 
      <TicketList
        tickets={tickets}
        selectedTicketIds={selectedTicketIds}
        onSelectionChange={setSelectedTicketIds}
      />
    </main>
  );
}
 
