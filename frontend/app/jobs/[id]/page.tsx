"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getExportUrl, getJob, getJobResults } from "@/lib/api";
import ReviewRecord from "@/components/ReviewRecord/ReviewRecord";
import type { Job, JobResult, Ticket } from "@/lib/types";
import { getTickets } from "@/lib/api";

export default function JobPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [jobData, resultData, ticketData] =
          await Promise.all([
            getJob(jobId),
            getJobResults(jobId),
            getTickets(),
          ]);

        if (cancelled) {
          return;
        }

        setJob(jobData);
        setResults(resultData);
        setTickets(ticketData);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load job",
        );
      }
    }

    loadData();

    const interval = setInterval(loadData, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId]);

  function handleResultUpdated(updatedResult: JobResult) {
    setResults((currentResults) =>
      currentResults.map((result) =>
        result.record_id === updatedResult.record_id
          ? updatedResult
          : result,
      ),
    );
  }

  if (error) {
    return (
      <main>
        <h1>Extraction Job</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!job) {
    return (
      <main>
        <h1>Extraction Job</h1>
        <p>Loading job...</p>
      </main>
    );
  }

  const total = job.items.length;

  const completed =
    job.progress.done +
    job.progress.needs_review +
    job.progress.failed;

  const percentage =
    total === 0
      ? 0
      : Math.round((completed / total) * 100);

  const sortedResults = [...results].sort(
    (a, b) => {
      if (
        a.status === "needs_review" &&
        b.status !== "needs_review"
      ) {
        return -1;
      }

      if (
        a.status !== "needs_review" &&
        b.status === "needs_review"
      ) {
        return 1;
      }

      return 0;
    },
  );

  function formatStatus(status: string) {
  switch (status) {
    case "needs_review":
      return "Needs review";
    case "running":
      return "Running";
    case "queued":
      return "Queued";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

  return (
    <main>
      <h1>Extraction Job</h1>

      <p>
        Job ID: <code>{job.job_id}</code>
      </p>

        <div>
        <a href={getExportUrl(job.job_id)} download>
            Export CSV
        </a>
        </div>
        
      <section>
        <h2>Progress</h2>

        <p>
          State: <strong>{job.state}</strong>
        </p>

        <p>
          {completed} / {total} completed ({percentage}%)
        </p>

        <ul>
          <li>Queued: {job.progress.queued}</li>
          <li>Running: {job.progress.running}</li>
          <li>Done: {job.progress.done}</li>
          <li>
            Needs review: {job.progress.needs_review}
          </li>
          <li>Failed: {job.progress.failed}</li>
        </ul>
      </section>

      <section>
  <h2>Ticket status</h2>

  <div>
    {job.items.map((item) => {
      const ticket = tickets.find((ticket) => ticket.id === item.ticket_id);

      return (
        <div key={item.ticket_id}>
          <strong>{ticket?.subject || "(No subject)"}</strong>
         <span> — {formatStatus(item.status)}</span>
        </div>
      );
    })}
  </div>
</section>

<section>
  <h2>Results</h2>

  {sortedResults.length === 0 ? (
    <p>No results yet...</p>
  ) : (
    <div>
      {sortedResults.map((result) => {
        const ticket = tickets.find((item) => item.id === result.ticket_id);

        if (!ticket) return null;

        return (
          <ReviewRecord
            key={result.record_id}
            ticket={ticket}
            result={result}
            onUpdated={handleResultUpdated}
          />
        );
      })}
    </div>
  )}
</section>
    </main>
  );
}