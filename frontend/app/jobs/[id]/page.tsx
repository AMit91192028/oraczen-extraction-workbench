"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  getExportUrl,
  getJob,
  getJobResults,
  getTickets,
} from "@/lib/api";
import ReviewRecord from "@/components/ReviewRecord/ReviewRecord";
import { statusTone, titleCase } from "@/lib/format";
import type { Job, JobResult, Ticket } from "@/lib/types";
import styles from "./page.module.css";

type ResultFilter = "all" | "needs_review" | "human_edited";

const ALL_CHANNELS = "all";
const POLL_MS = 1500;

export default function JobPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [channelFilter, setChannelFilter] = useState<string>(ALL_CHANNELS);

  // Tickets don't change while a job runs, so fetch them only once.
  const haveTickets = useRef(false);

  const load = useCallback(async () => {
    try {
      const [jobData, resultData, ticketData] = await Promise.all([
        getJob(jobId),
        getJobResults(jobId),
        haveTickets.current
          ? Promise.resolve<Ticket[] | null>(null)
          : getTickets(),
      ]);

      setJob(jobData);
      setResults(resultData);

      if (ticketData) {
        setTickets(ticketData);
        haveTickets.current = true;
      }

      setError(null);
      return jobData.state;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
      return null;
    }
  }, [jobId]);

  // Poll while the job is still working; stop once it has finished.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      const state = await load();

      if (cancelled) return;

      if (state === null || state === "queued" || state === "running") {
        timer = setTimeout(tick, POLL_MS);
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  function handleResultUpdated(updatedResult: JobResult) {
    setResults((current) =>
      current.map((result) =>
        result.record_id === updatedResult.record_id ? updatedResult : result,
      ),
    );

    // Refresh the progress numbers after an edit.
    void load();
  }

  const backLink = (
    <Link href="/" className={`btn ${styles.back}`}>
      <span aria-hidden="true">←</span> Back to tickets
    </Link>
  );

  if (!job) {
    return (
      <main className={styles.page}>
        <div className={styles.topbar}>{backLink}</div>

        {error ? (
          <div className={styles.errorBox} role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn-sm" onClick={() => load()}>
              Try again
            </button>
          </div>
        ) : (
          <p className={styles.empty} role="status">
            Loading job…
          </p>
        )}
      </main>
    );
  }

  const total = job.items.length;
  const completed =
    job.progress.done + job.progress.needs_review + job.progress.failed;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isRunning = job.state === "queued" || job.state === "running";

  const ticketById = new Map(tickets.map((ticket) => [ticket.id, ticket]));

  // Only results whose ticket we know about can be shown.
  const showable = results.filter((result) => ticketById.has(result.ticket_id));

  const needsReviewCount = showable.filter(
    (r) => r.status === "needs_review",
  ).length;
  const editedCount = showable.filter(
    (r) => (r.result.human_edited_fields ?? []).length > 0,
  ).length;

  const channelCounts = new Map<string, number>();
  for (const result of showable) {
    const channel = ticketById.get(result.ticket_id)!.channel;
    channelCounts.set(channel, (channelCounts.get(channel) ?? 0) + 1);
  }
  const channels = Array.from(channelCounts.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  const filteredResults = showable.filter((result) => {
    if (
      channelFilter !== ALL_CHANNELS &&
      ticketById.get(result.ticket_id)!.channel !== channelFilter
    ) {
      return false;
    }

    if (resultFilter === "needs_review") {
      return result.status === "needs_review";
    }

    if (resultFilter === "human_edited") {
      return (result.result.human_edited_fields ?? []).length > 0;
    }

    return true;
  });

  // Needs-review items first, otherwise keep the server order.
  const sortedResults = [...filteredResults].sort((a, b) => {
    const aFirst = a.status === "needs_review" ? 0 : 1;
    const bFirst = b.status === "needs_review" ? 0 : 1;
    return aFirst - bFirst;
  });

  const isFiltered = resultFilter !== "all" || channelFilter !== ALL_CHANNELS;

  function resetFilters() {
    setResultFilter("all");
    setChannelFilter(ALL_CHANNELS);
  }

  const stats = [
    { key: "queued", label: "Queued", value: job.progress.queued },
    { key: "running", label: "Running", value: job.progress.running },
    { key: "done", label: "Done", value: job.progress.done },
    { key: "needs_review", label: "Needs review", value: job.progress.needs_review },
    { key: "failed", label: "Failed", value: job.progress.failed },
  ];

  const statusFilters: { value: ResultFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: showable.length },
    { value: "needs_review", label: "Needs review", count: needsReviewCount },
    { value: "human_edited", label: "Human edited", count: editedCount },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        {backLink}

        <a
          className="btn btn-primary"
          href={getExportUrl(job.job_id)}
          download
        >
          Export CSV
        </a>
      </div>

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Extraction results</h1>
          <span className="pill" data-tone={statusTone(job.state)}>
            {titleCase(job.state)}
          </span>
        </div>
        <p className={styles.jobId}>
          Job <code>{job.job_id}</code>
        </p>
      </header>

      {error && (
        <p className={styles.errorBox} role="alert">
          Could not refresh: {error}
        </p>
      )}

      {/* ---------- Progress ---------- */}
      <section className={styles.card} aria-labelledby="progress-heading">
        <div className={styles.cardHead}>
          <h2 id="progress-heading" className={styles.h2}>
            Progress
          </h2>
          <p className={styles.progressText}>
            {completed} of {total} processed · {percentage}%
          </p>
        </div>

        <div
          className={styles.bar}
          role="progressbar"
          aria-label="Extraction progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
        >
          <div
            className={`${styles.barFill} ${isRunning ? styles.barActive : ""}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <ul className={styles.stats}>
          {stats.map((stat) => (
            <li key={stat.key} className={styles.stat}>
              <span className={styles.statValue} data-tone={statusTone(stat.key)}>
                {stat.value}
              </span>
              <span className={styles.statLabel}>{stat.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Ticket status ---------- */}
      <details className={styles.card} open>
        <summary className={styles.summary}>
          <h2 className={styles.h2}>Ticket status</h2>
          <span className={styles.summaryCount}>{total} tickets</span>
        </summary>

        <ul className={styles.itemList}>
          {job.items.map((item) => {
            const ticket = ticketById.get(item.ticket_id);

            return (
              <li key={item.ticket_id} className={styles.item}>
                <span className={styles.itemSubject}>
                  {ticket?.subject || "(No subject)"}
                </span>
                <span className="pill" data-tone={statusTone(item.status)}>
                  {titleCase(item.status)}
                </span>
              </li>
            );
          })}
        </ul>
      </details>

      {/* ---------- Results ---------- */}
      <section className={styles.results} aria-labelledby="results-heading">
        <h2 id="results-heading" className={styles.h2}>
          Results
        </h2>

        <div className={styles.filters}>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel} id="status-filter-label">
              Show
            </span>
            <div
              className={styles.chips}
              role="group"
              aria-labelledby="status-filter-label"
            >
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className="chip"
                  aria-pressed={resultFilter === filter.value}
                  onClick={() => setResultFilter(filter.value)}
                >
                  {filter.label}{" "}
                  <span className="chip-count">{filter.count}</span>
                </button>
              ))}
            </div>
          </div>

          {channels.length > 0 && (
            <div className={styles.filterRow}>
              <span className={styles.filterLabel} id="channel-filter-label">
                Channel
              </span>
              <div
                className={styles.chips}
                role="group"
                aria-labelledby="channel-filter-label"
              >
                <button
                  type="button"
                  className="chip"
                  aria-pressed={channelFilter === ALL_CHANNELS}
                  onClick={() => setChannelFilter(ALL_CHANNELS)}
                >
                  All <span className="chip-count">{showable.length}</span>
                </button>

                {channels.map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    className="chip"
                    aria-pressed={channelFilter === name}
                    onClick={() => setChannelFilter(name)}
                  >
                    {titleCase(name)}{" "}
                    <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {sortedResults.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {isFiltered
                ? "No results match these filters."
                : isRunning
                  ? "Results will appear here as each ticket finishes."
                  : "No results to show."}
            </p>
            {isFiltered && (
              <button type="button" className="btn btn-sm" onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={styles.recordList}>
            {sortedResults.map((result) => (
              <ReviewRecord
                key={result.record_id}
                ticket={ticketById.get(result.ticket_id)!}
                result={result}
                onUpdated={handleResultUpdated}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
