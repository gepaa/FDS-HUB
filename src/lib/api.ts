import type { RecordDTO, InteractionType } from "@/lib/domain";

/** Client-side fetch helpers for the CRM API. Throw on failure. */

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  listRecords: (type?: "supplier" | "lead") =>
    fetch(`/api/records${type ? `?type=${type}` : ""}`).then((r) =>
      handle<RecordDTO[]>(r),
    ),

  createRecord: (data: object) =>
    fetch("/api/records", { method: "POST", ...json(data) }).then((r) =>
      handle<RecordDTO>(r),
    ),

  updateRecord: (id: string, data: object) =>
    fetch(`/api/records/${id}`, { method: "PATCH", ...json(data) }).then((r) =>
      handle<RecordDTO>(r),
    ),

  deleteRecord: (id: string) =>
    fetch(`/api/records/${id}`, { method: "DELETE" }).then((r) =>
      handle<{ ok: boolean }>(r),
    ),

  logInteraction: (
    recordId: string,
    data: { type: InteractionType; body: string; date?: string },
  ) =>
    fetch(`/api/records/${recordId}/interactions`, {
      method: "POST",
      ...json(data),
    }).then((r) => handle<RecordDTO>(r)),

  deleteInteraction: (id: string) =>
    fetch(`/api/interactions/${id}`, { method: "DELETE" }).then((r) =>
      handle<{ ok: boolean }>(r),
    ),

  importRecords: (records: unknown[]) =>
    fetch("/api/records/import", {
      method: "POST",
      ...json({ records }),
    }).then((r) => handle<{ ok: boolean; created: number; updated: number }>(r)),
};
