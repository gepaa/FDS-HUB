import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { matchLead, backfillNormalisedNumbers } from "@/lib/quo/matching";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("matchLead", () => {
  it("matches an existing record on the normalised number", async () => {
    const lead = await prisma.crmRecord.create({
      data: {
        recordId: "FDS-LEAD-0001",
        type: "lead",
        name: "Marta Oyelaran",
        phone: "(415) 555-0123",
        phoneE164: "+14155550123",
        status: "ENGAGED",
      },
    });

    const result = await matchLead({
      externalNumber: "+14155550123",
      direction: "incoming",
    });

    expect(result.method).toBe("e164");
    expect(result.created).toBe(false);
    expect(result.record?.id).toBe(lead.id);
  });

  it("matches a supplier too, not just leads", async () => {
    // Suppliers ring us as well; the call belongs on their record.
    const supplier = await prisma.crmRecord.create({
      data: {
        recordId: "FDS-SUP-0001",
        type: "supplier",
        name: "Ridgeline Implements",
        phoneE164: "+14155550123",
        status: "IN_CONVERSATION",
      },
    });

    const result = await matchLead({
      externalNumber: "+14155550123",
      direction: "incoming",
    });
    expect(result.record?.id).toBe(supplier.id);
    expect(result.created).toBe(false);
  });

  it("matches a supplier contact's direct line", async () => {
    const supplier = await prisma.crmRecord.create({
      data: {
        recordId: "FDS-SUP-0002",
        type: "supplier",
        name: "Blue Valley Equipment",
        phoneE164: "+14155550100",
        supplierContacts: JSON.stringify([
          {
            id: "contact-mark",
            name: "Mark",
            role: "Sales representative",
            phone: "(415) 555-0199",
            email: "mark@example.com",
            notes: "",
            isPrimary: true,
          },
        ]),
        status: "IN_CONVERSATION",
      },
    });

    const result = await matchLead({
      externalNumber: "+14155550199",
      direction: "outgoing",
    });

    expect(result.method).toBe("supplier_contact");
    expect(result.record?.id).toBe(supplier.id);
    expect(result.created).toBe(false);
  });

  it("ignores malformed supplier contact data while matching", async () => {
    await prisma.crmRecord.create({
      data: {
        recordId: "FDS-SUP-0003",
        type: "supplier",
        name: "Legacy Supplier",
        supplierContacts: "{not-json",
        status: "SOURCED",
      },
    });

    const result = await matchLead({
      externalNumber: "+14155550199",
      direction: "outgoing",
    });

    expect(result.method).toBe("unmatched");
  });

  it("falls back to an existing Quo contact mapping", async () => {
    const lead = await prisma.crmRecord.create({
      data: {
        recordId: "FDS-LEAD-0002",
        type: "lead",
        name: "Tobias Reinke",
        status: "NEW",
        // Deliberately no phoneE164 — the mapping is the only route in.
      },
    });
    await prisma.quoContactLink.create({
      data: {
        recordId: lead.id,
        quoContactId: "CTknown",
        externalId: lead.id,
      },
    });

    const result = await matchLead({
      externalNumber: "+14155550199",
      direction: "incoming",
      quoContactIds: ["CTknown"],
    });

    expect(result.method).toBe("contact_link");
    expect(result.record?.id).toBe(lead.id);

    // And the number is remembered, so the fast path works next time.
    const refreshed = await prisma.crmRecord.findUnique({
      where: { id: lead.id },
    });
    expect(refreshed?.phoneE164).toBe("+14155550199");
  });

  it("creates exactly one minimal lead for an unknown inbound caller", async () => {
    const result = await matchLead({
      externalNumber: "+14155550123",
      direction: "incoming",
    });

    expect(result.method).toBe("created");
    expect(result.created).toBe(true);
    expect(result.record?.type).toBe("lead");
    expect(result.record?.status).toBe("NEW");
    expect(result.record?.source).toBe("Inbound Quo Call");
    expect(result.record?.needsEnrichment).toBe(true);
    expect(result.record?.owner).toBe("unassigned");
    expect(result.record?.recordId).toMatch(/^FDS-LEAD-\d{4}$/);
  });

  it("reuses that lead when the same number rings again", async () => {
    const first = await matchLead({
      externalNumber: "+14155550123",
      direction: "incoming",
    });
    const second = await matchLead({
      externalNumber: "+14155550123",
      direction: "incoming",
    });

    expect(second.created).toBe(false);
    expect(second.record?.id).toBe(first.record?.id);
    expect(await prisma.crmRecord.count()).toBe(1);
  });

  it("creates only one lead when two calls land at the same moment", async () => {
    // The duplicate-protection path: concurrent inbound calls from one
    // number must not produce two records.
    const [a, b] = await Promise.all([
      matchLead({ externalNumber: "+14155550123", direction: "incoming" }),
      matchLead({ externalNumber: "+14155550123", direction: "incoming" }),
    ]);

    expect(await prisma.crmRecord.count()).toBe(1);
    expect(a.record?.id).toBe(b.record?.id);
  });

  it("does NOT create a lead for an unknown outbound call", async () => {
    // We rang a number that isn't in the CRM — that deserves a human's
    // attention, not an auto-created record.
    const result = await matchLead({
      externalNumber: "+14155550123",
      direction: "outgoing",
    });

    expect(result.method).toBe("unmatched");
    expect(result.record).toBeNull();
    expect(await prisma.crmRecord.count()).toBe(0);
  });

  it("does not create anything when the number is unusable", async () => {
    const result = await matchLead({
      externalNumber: "anonymous",
      direction: "incoming",
    });
    expect(result.method).toBe("unmatched");
    expect(await prisma.crmRecord.count()).toBe(0);
  });

  it("prefers the oldest record when duplicates already exist", async () => {
    const older = await prisma.crmRecord.create({
      data: {
        recordId: "FDS-LEAD-0010",
        type: "lead",
        name: "Original",
        phoneE164: "+14155550123",
        status: "ENGAGED",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.crmRecord.create({
      data: {
        recordId: "FDS-LEAD-0011",
        type: "lead",
        name: "Accidental duplicate",
        phoneE164: "+14155550123",
        status: "NEW",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      },
    });

    const result = await matchLead({
      externalNumber: "+14155550123",
      direction: "incoming",
    });
    expect(result.record?.id).toBe(older.id);
  });
});

describe("backfillNormalisedNumbers", () => {
  it("fills in E.164 for records that predate the integration", async () => {
    await prisma.crmRecord.create({
      data: {
        recordId: "FDS-SUP-0100",
        type: "supplier",
        name: "Legacy supplier",
        phone: "(415) 555-0123",
        status: "SOURCED",
      },
    });
    await prisma.crmRecord.create({
      data: {
        recordId: "FDS-SUP-0101",
        type: "supplier",
        name: "No usable number",
        phone: "call the shop",
        status: "SOURCED",
      },
    });

    const result = await backfillNormalisedNumbers();
    expect(result.scanned).toBe(2);
    expect(result.updated).toBe(1);

    const fixed = await prisma.crmRecord.findFirst({
      where: { recordId: "FDS-SUP-0100" },
    });
    expect(fixed?.phoneE164).toBe("+14155550123");

    // The unparseable one is left alone rather than guessed at.
    const untouched = await prisma.crmRecord.findFirst({
      where: { recordId: "FDS-SUP-0101" },
    });
    expect(untouched?.phoneE164).toBeNull();
  });
});
