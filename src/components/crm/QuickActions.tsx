"use client";

import { useState } from "react";
import {
  ExternalLink,
  Mail,
  MoreHorizontal,
  NotebookPen,
  PhoneCall,
  SendHorizontal,
  Target,
} from "lucide-react";
import type { InteractionType, RecordDTO } from "@/lib/domain";
import { Menu, MenuItem } from "@/components/kit/Menu";
import { Modal } from "@/components/kit/Modal";
import { Button } from "@/components/kit/Button";
import { Field, Input, Textarea } from "@/components/kit/Field";

/**
 * Quick actions — the moves an operator makes twenty times a day, one
 * click from wherever the record is (board card, table row, drawer)
 * instead of open-drawer → scroll → edit → save.
 */
export type QuickAction =
  | "call"
  | "email"
  | "note"
  | "next-action"
  | "applied"
  | "open";

/** Stage a supplier lands on once their dealer application is in. */
export const APPLIED_STAGE = "IN_CONVERSATION";

/** Stages where "Mark applied" is still a forward move. */
const PRE_APPLIED = new Set(["SOURCED", "QUALIFIED", "CONTACTED", "REPLIED"]);

export function canMarkApplied(record: RecordDTO): boolean {
  return record.type === "supplier" && PRE_APPLIED.has(record.status);
}

export const QUICK_ACTION_LABEL: Record<QuickAction, string> = {
  call: "Log a call",
  email: "Log an email",
  note: "Add a note",
  "next-action": "Set next action",
  applied: "Mark applied",
  open: "Open record",
};

interface MenuProps {
  record: RecordDTO;
  onSelect: (record: RecordDTO, action: QuickAction) => void;
  /** Include "Open record" (omitted when already inside the drawer). */
  includeOpen?: boolean;
  triggerClassName?: string;
}

export function QuickActionsMenu({
  record,
  onSelect,
  includeOpen = true,
  triggerClassName,
}: MenuProps) {
  const pick = (close: () => void, action: QuickAction) => () => {
    close();
    onSelect(record, action);
  };

  return (
    <Menu
      label={`Quick actions for ${record.name}`}
      trigger={<MoreHorizontal size={15} aria-hidden />}
      triggerClassName={triggerClassName}
    >
      {(close) => (
        <>
          <MenuItem icon={PhoneCall} onSelect={pick(close, "call")}>
            {QUICK_ACTION_LABEL.call}
          </MenuItem>
          <MenuItem icon={Mail} onSelect={pick(close, "email")}>
            {QUICK_ACTION_LABEL.email}
          </MenuItem>
          <MenuItem icon={NotebookPen} onSelect={pick(close, "note")}>
            {QUICK_ACTION_LABEL.note}
          </MenuItem>
          <MenuItem icon={Target} onSelect={pick(close, "next-action")}>
            {QUICK_ACTION_LABEL["next-action"]}
          </MenuItem>
          {canMarkApplied(record) ? (
            <MenuItem icon={SendHorizontal} onSelect={pick(close, "applied")}>
              {QUICK_ACTION_LABEL.applied}
            </MenuItem>
          ) : null}
          {includeOpen ? (
            <MenuItem icon={ExternalLink} onSelect={pick(close, "open")}>
              {QUICK_ACTION_LABEL.open}
            </MenuItem>
          ) : null}
        </>
      )}
    </Menu>
  );
}

/** Inline quick-action buttons, for the roomier drawer header. */
export function QuickActionBar({
  record,
  onSelect,
}: {
  record: RecordDTO;
  onSelect: (record: RecordDTO, action: QuickAction) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="ghost" size="sm" onClick={() => onSelect(record, "call")}>
        <PhoneCall size={13} aria-hidden />
        Log call
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onSelect(record, "note")}>
        <NotebookPen size={13} aria-hidden />
        Add note
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSelect(record, "next-action")}
      >
        <Target size={13} aria-hidden />
        Set next action
      </Button>
      {canMarkApplied(record) ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelect(record, "applied")}
        >
          <SendHorizontal size={13} aria-hidden />
          Mark applied
        </Button>
      ) : null}
    </div>
  );
}

interface DialogProps {
  record: RecordDTO | null;
  action: QuickAction | null;
  onClose: () => void;
  onLog: (record: RecordDTO, type: InteractionType, body: string) => Promise<void>;
  onSetNextAction: (
    record: RecordDTO,
    nextAction: string,
    nextActionDate: string | null,
  ) => Promise<void>;
}

const LOG_ACTIONS: Record<string, { type: InteractionType; placeholder: string }> =
  {
    call: {
      type: "call",
      placeholder: "What was said, and what happens next…",
    },
    email: {
      type: "email",
      placeholder: "Subject / gist of the email you sent or received…",
    },
    note: { type: "note", placeholder: "Anything worth remembering…" },
  };

/**
 * The one dialog behind every quick action that needs typing. Lives at
 * the workspace level so board and table share it — and so the record it
 * writes to is the same object both views render.
 */
export function QuickActionDialog({
  record,
  action,
  onClose,
  onLog,
  onSetNextAction,
}: DialogProps) {
  // Remounted per action by the `key` the workspace passes, so the
  // initial state below is the reset — no syncing effect needed.
  const [body, setBody] = useState("");
  const [nextAction, setNextAction] = useState(record?.nextAction ?? "");
  const [due, setDue] = useState(
    record?.nextActionDate ? record.nextActionDate.slice(0, 10) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = record !== null && action !== null && action !== "open";
  const isLog = action ? action in LOG_ACTIONS : false;

  if (!record || !action || action === "open") return null;

  const submit = async () => {
    setError(null);
    if (isLog) {
      const text = body.trim();
      if (!text) {
        setError("Write what happened before logging it.");
        return;
      }
      setBusy(true);
      try {
        await onLog(record, LOG_ACTIONS[action].type, text);
        onClose();
      } catch (e) {
        // Keep the dialog (and the typing) open on failure.
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const text = nextAction.trim();
    if (!text) {
      setError("Describe the next move — this is what the board shows.");
      return;
    }
    if (due && Number.isNaN(new Date(due).getTime())) {
      setError("That due date isn't a real date.");
      return;
    }
    setBusy(true);
    try {
      await onSetNextAction(record, text, due || null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${QUICK_ACTION_LABEL[action]} — ${record.name}`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : isLog ? "Log it" : "Save next action"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {isLog ? (
          <Field label="What happened" error={error ?? undefined}>
            {(id) => (
              <Textarea
                id={id}
                autoFocus
                value={body}
                aria-invalid={error ? true : undefined}
                onChange={(e) => {
                  setBody(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={LOG_ACTIONS[action].placeholder}
              />
            )}
          </Field>
        ) : (
          <>
            <Field
              label="Next action"
              hint="The single next thing to do for this record."
              error={error ?? undefined}
            >
              {(id) => (
                <Input
                  id={id}
                  autoFocus
                  value={nextAction}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setNextAction(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Follow up on the dealer application"
                />
              )}
            </Field>
            <Field label="Due">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              )}
            </Field>
          </>
        )}
        {isLog && (action === "call" || action === "email") ? (
          <p className="text-[11px] text-muted">
            Logging a {action} also updates this record&rsquo;s last-contact
            date.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
