import type {
  Job,
  JobResult,
  Ticket,
  UpdatedRecordResponse,
} from "./types";

const API_BASE_URL = "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorBody = await response.json();

      if (errorBody.detail) {
        message =
          typeof errorBody.detail === "string"
            ? errorBody.detail
            : JSON.stringify(errorBody.detail);
      }
    } catch {
      // Keep the default error message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function getTickets(): Promise<Ticket[]> {
  return request<Ticket[]>("/api/tickets");
}

export async function createJob(
  ticketIds: string[],
): Promise<{ job_id: string; state: string }> {
  return request("/api/jobs", {
    method: "POST",
    body: JSON.stringify({
      ticket_ids: ticketIds,
    }),
  });
}

export async function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/api/jobs/${jobId}`);
}

export async function getJobResults(
  jobId: string,
): Promise<JobResult[]> {
  return request<JobResult[]>(`/api/jobs/${jobId}/results`);
}

export async function updateRecord(
  recordId: string,
  updates: Record<string, unknown>,
): Promise<UpdatedRecordResponse> {
  return request<UpdatedRecordResponse>(`/api/records/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
};


export function getExportUrl(jobId: string): string {
  return `${API_BASE_URL}/api/jobs/${jobId}/export.csv`;
}