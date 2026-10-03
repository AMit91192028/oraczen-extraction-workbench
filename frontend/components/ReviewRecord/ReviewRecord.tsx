"use client";

import { useState } from "react";

import type {
  ExtractionRecord,
  JobResult,
  Ticket,
} from "@/lib/types";

import { updateRecord } from "@/lib/api";
import EditableField from "../EditableField/EditableField";

import styles from "./ReviewRecord.module.css";

interface ReviewRecordProps {
  ticket: Ticket;
  result: JobResult;
  onUpdated: (result: JobResult) => void;
}

type FieldConfig = {
  key: keyof ExtractionRecord;
  label: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
};

const FIELDS: FieldConfig[] = [
  { key: "company", label: "Company" },
  {
    key: "product",
    label: "Product",
    type: "select",
    options: [
      "Zen Orchestrator",
      "Zen Studio",
      "Zen Connect",
      "Zen Insights",
      "Zen Vault",
    ],
  },
  {
    key: "category",
    label: "Category",
    type: "select",
    options: [
      "outage",
      "billing",
      "bug",
      "feature_request",
      "how_to",
      "churn_risk",
    ],
  },
  {
    key: "severity",
    label: "Severity",
    type: "select",
    options: ["low", "medium", "high", "critical"],
  },
  {
    key: "requested_action",
    label: "Requested action",
    type: "select",
    options: [
      "refund",
      "credit",
      "fix",
      "callback",
      "information",
      "none",
    ],
  },
  { key: "refund_amount", label: "Refund amount", type: "number" },
  { key: "deadline", label: "Deadline", type: "date" },
  { key: "escalated", label: "Escalated", type: "boolean" },
];

export default function ReviewRecord({
  ticket,
  result,
  onUpdated,
}: ReviewRecordProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const record = result.result.record;

  if (!record) {
    return (
      <article className={styles.container}>
        <section className={styles.ticket}>
          <h3 className={styles.label}>Original ticket</h3>
          <h4 className={styles.subject}>
            {ticket.subject || "(No subject)"}
          </h4>
          <p className={styles.body}>{ticket.body}</p>
        </section>

        <section className={styles.result}>
          <div className={styles.resultHeader}>
            <h3 className={styles.label}>Extracted record</h3>
            <span className={styles.badge}>Needs review</span>
          </div>

          <p className={styles.reason}>
            {result.result.reason ||
              "No valid extracted record was produced."}
          </p>

          {result.result.validation_error && (
            <pre>{result.result.validation_error}</pre>
          )}
        </section>
      </article>
    );
  }

  async function saveField(
    field: keyof ExtractionRecord,
    value: string | number | boolean | null,
  ) {
    try {
      setErrors((current) => ({ ...current, [field]: "" }));

      const updated = await updateRecord(result.record_id, {
        [field]: value,
      });

      onUpdated({
        ...result,
        result: {
          ...result.result,
          record: updated.record,
          human_edited_fields: updated.human_edited_fields,
        },
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [field]:
          error instanceof Error
            ? error.message
            : "Failed to save field",
      }));
    }
  }

  const uncertainFields: string[] =
    result.result.uncertain_fields ?? [];
  const editedFields: string[] =
    result.result.human_edited_fields ?? [];
  const reviewReasons: string[] =
    result.result.review_reasons ?? [];

  return (
    <article className={styles.container}>
      <section className={styles.ticket}>
        <h3 className={styles.label}>Original ticket</h3>

        <h4 className={styles.subject}>
          {ticket.subject || "(No subject)"}
        </h4>

        <p className={styles.body}>{ticket.body}</p>

        <div className={styles.metadata}>
          <span>{ticket.from_email}</span>
          <span>{ticket.channel}</span>
          <span>{ticket.received_at}</span>
        </div>
      </section>

      <section className={styles.result}>
        <div className={styles.resultHeader}>
          <h3 className={styles.label}>Extracted record</h3>

          {result.status === "needs_review" && (
            <span className={styles.badge}>Needs review</span>
          )}
        </div>

        {reviewReasons.length > 0 && (
          <div className={styles.reviewReasons}>
            <strong>Review reasons</strong>

            <ul>
              {reviewReasons.map((reason, index) => (
                <li key={`${reason}-${index}`}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.fields}>
          {FIELDS.map((field) => (
            <EditableField
              key={field.key}
              label={field.label}
              value={record[field.key] as string | number | boolean | null}
              type={field.type}
              options={field.options}
              uncertain={uncertainFields.includes(field.key)}
              edited={editedFields.includes(field.key)}
              error={errors[field.key]}
              onSave={(value) => saveField(field.key, value)}
            />
          ))}
        </div>
      </section>
    </article>
  );
}