"use client";

import { useEffect, useState } from "react";
import styles from "./EditableField.module.css";

interface EditableFieldProps {
  label: string;
  value: string | number | boolean | null;
  uncertain?: boolean;
  edited?: boolean;
  error?: string;
  type?: "text" | "number" | "date" | "select" | "boolean";
  options?: string[];
  onSave: (
    value: string | number | boolean | null,
  ) => Promise<void>;
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

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  async function handleSave() {
    try {
      setSaving(true);

      let parsedValue: string | number | boolean | null =
        draft;

      if (type === "number") {
        parsedValue =
          draft === "" ? null : Number(draft);

        if (
          parsedValue !== null &&
          Number.isNaN(parsedValue)
        ) {
          return;
        }
      }

      if (type === "boolean") {
        parsedValue = draft === "true";
      }

      if (draft === "" && type !== "number") {
        parsedValue = null;
      }

      await onSave(parsedValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.field}>
      <div className={styles.header}>
        <strong>{label}</strong>

        <div className={styles.badges}>
          {uncertain && (
            <span className={styles.uncertain}>
              Needs review
            </span>
          )}

          {edited && (
            <span className={styles.edited}>
              Human edited
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className={styles.editor}>
          {type === "select" ? (
            <select
              value={draft}
              onChange={(event) =>
                setDraft(event.target.value)
              }
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : type === "boolean" ? (
            <select
              value={draft}
              onChange={(event) =>
                setDraft(event.target.value)
              }
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              type={type}
              value={draft}
              onChange={(event) =>
                setDraft(event.target.value)
              }
            />
          )}

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={() => {
                setDraft(String(value ?? ""));
                setEditing(false);
              }}
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
        >
          {value === null || value === ""
            ? "—"
            : String(value)}
        </button>
      )}

      {error && (
        <p className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}