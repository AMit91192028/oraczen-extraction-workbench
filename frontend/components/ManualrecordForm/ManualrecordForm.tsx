"use client";

import { useState } from "react";

import { fieldErrorsFromError, updateRecord } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { ExtractionRecord } from "@/lib/types";

import styles from "./Manualrecordform.module.css";

export type ManualFieldConfig = {
  key: keyof ExtractionRecord;
  label: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
};

interface ManualRecordFormProps {
  recordId: string;
  fields: ManualFieldConfig[];
  // What the model returned, if anything (may contain invalid values).
  rawRecord: Record<string, unknown> | null;
  onSaved: (
    record: ExtractionRecord,
    humanEditedFields: string[],
  ) => void;
}

// Start each field from the model's value when it is usable. A select whose
// value is not one of the allowed options (e.g. severity "urgent") starts
// empty so the reviewer has to choose, and we show what the model said.
function initialDraft(
  fields: ManualFieldConfig[],
  rawRecord: Record<string, unknown> | null,
): Record<string, string> {
  const draft: Record<string, string> = {};

  for (const field of fields) {
    const raw = rawRecord?.[field.key];
    let value =
      raw === null || raw === undefined ? "" : String(raw);

    if (field.type === "select" && !field.options?.includes(value)) {
      value = "";
    }

    if (field.type === "boolean" && value === "") {
      value = "false";
    }

    draft[field.key] = value;
  }

  return draft;
}

export default function ManualRecordForm({
  recordId,
  fields,
  rawRecord,
  onSaved,
}: ManualRecordFormProps) {
  const [draft, setDraft] = useState(() =>
    initialDraft(fields, rawRecord),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setValue(key: string, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    const payload: Record<string, unknown> = {};

    for (const field of fields) {
      const value = draft[field.key];

      if (field.type === "number") {
        payload[field.key] = value === "" ? null : Number(value);
      } else if (field.type === "boolean") {
        payload[field.key] = value === "true";
      } else if (field.type === "date") {
        payload[field.key] = value === "" ? null : value;
      } else {
        payload[field.key] = value;
      }
    }

    try {
      setSaving(true);
      setErrors({});

      const updated = await updateRecord(recordId, payload);

      onSaved(updated.record, updated.human_edited_fields);
    } catch (error) {
      setErrors(fieldErrorsFromError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      {fields.map((field) => {
        const rawValue = rawRecord?.[field.key];
        const modelSaid =
          field.type === "select" &&
          rawValue !== null &&
          rawValue !== undefined &&
          !field.options?.includes(String(rawValue))
            ? String(rawValue)
            : null;

        const fieldError = errors[field.key];

        return (
          <div
            key={field.key}
            className={`${styles.field} ${
              fieldError ? styles.fieldInvalid : ""
            }`}
          >
            <label className={styles.label} htmlFor={`manual-${field.key}`}>
              {field.label}
            </label>

            {field.type === "select" ? (
              <select
                id={`manual-${field.key}`}
                className={styles.select}
                value={draft[field.key]}
                onChange={(e) => setValue(field.key, e.target.value)}
              >
                <option value="">— choose —</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            ) : field.type === "boolean" ? (
              <select
                id={`manual-${field.key}`}
                className={styles.select}
                value={draft[field.key]}
                onChange={(e) => setValue(field.key, e.target.value)}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                id={`manual-${field.key}`}
                className={styles.input}
                type={field.type ?? "text"}
                value={draft[field.key]}
                onChange={(e) => setValue(field.key, e.target.value)}
              />
            )}

            {modelSaid && (
              <p className={styles.modelSaid}>
                Model returned “{modelSaid}”, which is not a valid value.
              </p>
            )}

            {fieldError && (
              <p className={styles.error} role="alert">
                {fieldError}
              </p>
            )}
          </div>
        );
      })}

      {errors._form && (
        <p className={styles.error} role="alert">
          {errors._form}
        </p>
      )}

      <button
        type="button"
        className={styles.save}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save record"}
      </button>
    </div>
  );
}