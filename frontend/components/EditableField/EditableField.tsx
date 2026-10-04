"use client";

import { useId, useState } from "react";

import { titleCase } from "@/lib/format";
import styles from "./EditableField.module.css";

interface EditableFieldProps {
  label: string;
  value: string | number | boolean | null;
  uncertain?: boolean;
  edited?: boolean;
  error?: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  /** Return false to keep the editor open (e.g. the save failed). */
  onSave: (
    value: string | number | boolean | null,
  ) => Promise<boolean | void>;
}

function displayValue(
  value: string | number | boolean | null,
  type: EditableFieldProps["type"],
): string {
  if (value === null || value === "") return "—";
  if (type === "boolean") return value === true || value === "true" ? "Yes" : "No";
  if (type === "select") return titleCase(String(value));
  return String(value);
}

export default function EditableField({
  label,
  value,
  uncertain = false,
  edited = false,
  error,
  type = "text",
  options = [],
  onSave,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputId = useId();

  // Reset the draft when the saved value changes (e.g. after a save or refresh).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value ?? ""));
  }

  function cancel() {
    setDraft(String(value ?? ""));
    setEditing(false);
  }

  async function handleSave() {
    try {
      setSaving(true);

      let parsedValue: string | number | boolean | null = draft;

      if (type === "number") {
        parsedValue = draft === "" ? null : Number(draft);

        if (parsedValue !== null && Number.isNaN(parsedValue)) {
          return;
        }
      }

      if (type === "boolean") {
        parsedValue = draft === "true";
      }

      if (draft === "" && type !== "number") {
        parsedValue = null;
      }

      const ok = await onSave(parsedValue);

      if (ok !== false) {
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }

    // Enter saves from text-like inputs (selects use Enter to open the list)
    if (
      event.key === "Enter" &&
      (event.target as HTMLElement).tagName === "INPUT"
    ) {
      event.preventDefault();
      handleSave();
    }
  }

  return (
    <div
      className={`${styles.field} ${uncertain ? styles.fieldUncertain : ""}`}
    >
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>

        <div className={styles.badges}>
          {uncertain && <span className="pill" data-tone="warn">Check this</span>}
          {edited && <span className="pill" data-tone="accent">Edited</span>}
        </div>
      </div>

      {editing ? (
        <div className={styles.editor} onKeyDown={handleKeyDown}>
          {type === "select" ? (
            <select
              id={inputId}
              aria-label={label}
              className="control"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          ) : type === "boolean" ? (
            <select
              id={inputId}
              aria-label={label}
              className="control"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : (
            <input
              id={inputId}
              aria-label={label}
              className="control"
              type={type}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            />
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={cancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.value}
          onClick={() => setEditing(true)}
          aria-label={`Edit ${label}: ${displayValue(value, type)}`}
        >
          <span>{displayValue(value, type)}</span>
          <span className={styles.editHint} aria-hidden="true">
            Edit
          </span>
        </button>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
