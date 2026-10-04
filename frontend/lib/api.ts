import type {
  Job,
  JobResult,
  Ticket,
  UpdatedRecordResponse,
} from "./types";

const API_BASE_URL = "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// FastAPI/Pydantic 422 responses look like:
//   { detail: [{ loc: ["severity"], msg: "Input should be ...", type: "..." }] }
// Turn that into { severity: "Input should be ..." } so the UI can show each
// message next to the field it belongs to. Anything else becomes a general
// message under the "_form" key.
export function fieldErrorsFromError(
  error: unknown,
): Record<string, string> {
  if (error instanceof ApiError && Array.isArray(error.detail)) {
    const errors: Record<string, string> = {};

    for (const item of error.detail) {
      const loc = Array.isArray(item?.loc) ? item.loc : [];
      const field = String(loc[loc.length - 1] ?? "_form");

      errors[field] = String(item?.msg ?? "Invalid value");
    }

    return errors;
  }

  return {
    _form:
      error instanceof Error ? error.message : "Failed to save",
  };
}

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
    let detail: unknown = undefined;

    try {
      const errorBody = await response.json();

      if (errorBody.detail) {
        detail = errorBody.detail;
        message =
          typeof errorBody.detail === "string"
            ? errorBody.detail
            : JSON.stringify(errorBody.detail);
      }
    } catch {
      // Keep the default error message when the response is not JSON.
    }

    throw new ApiError(message, response.status, detail);
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