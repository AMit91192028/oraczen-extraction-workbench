"use client";

import { useState } from "react";

import type {
  ExtractionRecord,
  JobResult,
  Ticket,
} from "@/lib/types";

import { fieldErrorsFromError, updateRecord } from "@/lib/api";
import { formatDate, statusTone, titleCase } from "@/lib/format";
import EditableField from "../EditableField/EditableField";
import ManualRecordForm from "../ManualrecordForm/ManualrecordForm";

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
  const editedFields: string[] = result.result.human_edited_fields ?? [];

  const header = (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h3 className={styles.subject}>{ticket.subject || "(No subject)"}</h3>

        <div className={styles.metadata}>
          <span className="pill" data-tone="accent">
            {titleCase(ticket.channel)}
          </span>
          <span className="pill">{ticket.from_email}</span>
          <span className="pill">{formatDate(ticket.received_at)}</span>
          <span className={`pill ${styles.id}`}>{ticket.id}</span>
        </div>
      </div>

      <div className={styles.statusPills}>
        {editedFields.length > 0 && (
          <span className="pill" data-tone="accent">
            Human edited
          </span>
        )}
        <span className="pill" data-tone={statusTone(result.status)}>
          {titleCase(result.status)}
        </span>
      </div>
    </header>
  );

  const original = (
    <section className={styles.ticket}>
      <h4 className={styles.label}>Original message</h4>
      <p className={styles.body}>{ticket.body}</p>
    </section>
  );

  if (!record) {
    const rawRecord =
      (result.result.raw_output?.record as
        | Record<string, unknown>
        | undefined) ?? null;

    return (
      <article className={styles.card}>
        {header}

        <div className={styles.columns}>
          {original}

          <section className={styles.result}>
            <h4 className={styles.label}>Extracted record</h4>

            <p className={styles.reason}>
              {result.result.reason ||
                "No valid extracted record was produced. Fill in the fields below."}
            </p>

            {result.result.validation_error && (
              <pre>{result.result.validation_error}</pre>
            )}

            <ManualRecordForm
              recordId={result.record_id}
              fields={FIELDS}
              rawRecord={rawRecord}
              onSaved={(savedRecord, humanEditedFields) =>
                onUpdated({
                  ...result,
                  status: "done",
                  result: {
                    ...result.result,
                    record: savedRecord,
                    human_edited_fields: humanEditedFields,
                  },
                })
              }
            />
          </section>
        </div>
      </article>
    );
  }

  async function saveField(
    field: keyof ExtractionRecord,
    value: string | number | boolean | null,
  ): Promise<boolean> {
    try {
      setErrors((current) => ({ ...current, [field]: "" }));

      const updated = await updateRecord(result.record_id, {
        [field]: value,
      });

      onUpdated({
        ...result,
        status: updated.status,
        result: {
          ...result.result,
          record: updated.record,
          human_edited_fields: updated.human_edited_fields,
        },
      });

      return true;
    } catch (error) {
      const fieldErrors = fieldErrorsFromError(error);

      setErrors((current) => ({
        ...current,
        [field]:
          fieldErrors[field] ?? fieldErrors._form ?? "Failed to save field",
      }));

      return false;
    }
  }

  const uncertainFields: string[] = result.result.uncertain_fields ?? [];
  const reviewReasons: string[] = result.result.review_reasons ?? [];

  return (
    <article className={styles.card}>
      {header}

      <div className={styles.columns}>
        {original}

        <section className={styles.result}>
          <h4 className={styles.label}>Extracted record</h4>

          {reviewReasons.length > 0 && (
            <div className={styles.reviewReasons}>
              <strong>Why this needs a look</strong>

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
      </div>
    </article>
  );
}
