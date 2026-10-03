export type Product =
  | "Zen Orchestrator"
  | "Zen Studio"
  | "Zen Connect"
  | "Zen Insights"
  | "Zen Vault";

export type Category =
  | "outage"
  | "billing"
  | "bug"
  | "feature_request"
  | "how_to"
  | "churn_risk";

export type Severity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type RequestedAction =
  | "refund"
  | "credit"
  | "fix"
  | "callback"
  | "information"
  | "none";

export interface Ticket {
  id: string;
  subject: string;
  body: string;
  channel: string;
  received_at: string;
  from_email: string;
  attachments: string[];
}

export interface ExtractionRecord {
  company: string;
  product: Product;
  category: Category;
  severity: Severity;
  requested_action: RequestedAction;
  refund_amount: number | null;
  deadline: string | null;
  escalated: boolean;
}

export interface ExtractionResult {
  status: "done" | "needs_review" | "failed";
  reason: string | null;
  record: ExtractionRecord | null;
  raw_output: Record<string, unknown> | null;
  uncertain_fields: string[];
  review_reasons: string[];
  validation_error?: string;
  human_edited_fields?: string[];
}

export interface JobItem {
  ticket_id: string;
  status: "queued" | "running" | "done" | "failed" | "needs_review";
}

export interface Job {
  job_id: string;
  state: "queued" | "running" | "done" | "failed";
  progress: {
    queued: number;
    running: number;
    done: number;
    failed: number;
    needs_review: number;
  };
  items: JobItem[];
}

export interface JobResult {
  record_id: string;
  ticket_id: string;
  status: "done" | "needs_review" | "failed";
  result: ExtractionResult;
}

export interface UpdatedRecordResponse {
  record_id: string;
  ticket_id: string;
  status: "done" | "needs_review" | "failed";
  record: ExtractionRecord;
  human_edited_fields: string[];
}