import type { SupplierDTO, InteractionType } from "@/lib/domain";

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
  createSupplier: (data: object) =>
    fetch("/api/suppliers", { method: "POST", ...json(data) }).then((r) =>
      handle<SupplierDTO>(r),
    ),

  updateSupplier: (id: string, data: object) =>
    fetch(`/api/suppliers/${id}`, { method: "PATCH", ...json(data) }).then(
      (r) => handle<SupplierDTO>(r),
    ),

  deleteSupplier: (id: string) =>
    fetch(`/api/suppliers/${id}`, { method: "DELETE" }).then((r) =>
      handle<{ ok: boolean }>(r),
    ),

  logInteraction: (
    supplierId: string,
    data: { type: InteractionType; body: string; date?: string },
  ) =>
    fetch(`/api/suppliers/${supplierId}/interactions`, {
      method: "POST",
      ...json(data),
    }).then((r) => handle<SupplierDTO>(r)),

  deleteInteraction: (id: string) =>
    fetch(`/api/interactions/${id}`, { method: "DELETE" }).then((r) =>
      handle<{ ok: boolean }>(r),
    ),

  importSuppliers: (suppliers: unknown[]) =>
    fetch("/api/suppliers/import", {
      method: "POST",
      ...json({ suppliers }),
    }).then((r) => handle<{ ok: boolean; created: number; updated: number }>(r)),
};
