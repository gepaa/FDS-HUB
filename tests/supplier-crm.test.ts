import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as createRecord } from "@/app/api/records/route";
import { PATCH as patchRecord } from "@/app/api/records/[id]/route";
import { checkSupplierFollowUps } from "@/lib/supplier-follow-ups";
import { resetDb } from "./helpers";

const json = (body: unknown, method = "POST") =>
  new Request("http://test/api/records", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  await resetDb();
});

describe("supplier profiles and outreach details", () => {
  it("uses the three named profiles and defaults new suppliers to Ben", async () => {
    const seats = await prisma.teamMember.findMany({
      orderBy: { sortOrder: "asc" },
    });
    expect(seats.map((seat) => seat.name)).toEqual([
      "Ben",
      "Bennett",
      "Pablo",
    ]);

    const response = await createRecord(
      json({
        type: "supplier",
        name: "North Field Equipment",
        cluster: "Other",
        priority: "warm",
        initialEmailSent: true,
        dealerApplicationSigned: true,
        supplierContacts: [
          {
            id: "contact-mark",
            name: "Mark",
            role: "Sales representative",
            phone: "+1 817 555 0112",
            email: "mark@northfield.example",
            notes: "Asked for the dealer packet by email.",
            isPrimary: true,
          },
        ],
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      supplierOwnerId: string | null;
      supplierOwner: { name: string } | null;
      initialEmailSent: boolean;
      dealerApplicationSigned: boolean;
      supplierContacts: Array<{ name: string; role: string }>;
    };
    expect(body.supplierOwnerId).toBe("seat_1");
    expect(body.supplierOwner?.name).toBe("Ben");
    expect(body.initialEmailSent).toBe(true);
    expect(body.dealerApplicationSigned).toBe(true);
    expect(body.supplierContacts).toEqual([
      expect.objectContaining({
        name: "Mark",
        role: "Sales representative",
      }),
    ]);

    const reassigned = await patchRecord(
      json({ supplierOwnerId: "seat_2" }, "PATCH"),
      params(body.id),
    );
    expect(reassigned.status).toBe(200);
    expect(((await reassigned.json()) as { supplierOwner: { name: string } }).supplierOwner.name)
      .toBe("Bennett");
  });

  it("rejects a supplier owner outside the three active profiles", async () => {
    const response = await createRecord(
      json({
        type: "supplier",
        name: "Unknown Bench",
        cluster: "Other",
        supplierOwnerId: "seat_99",
      }),
    );
    expect(response.status).toBe(400);
    expect(await prisma.crmRecord.count()).toBe(0);
  });
});

describe("supplier follow-up reminders", () => {
  it("records an undelivered reminder without marking the due date sent", async () => {
    const due = new Date("2026-07-30T00:00:00.000Z");
    const record = await prisma.crmRecord.create({
      data: {
        id: "supplier-reminder-test",
        type: "supplier",
        name: "Reminder Supplier",
        cluster: "Other",
        status: "CONTACTED",
        supplierOwnerId: "seat_3",
        nextAction: "Call back if they do not call",
        nextActionDate: due,
      },
    });

    const result = await checkSupplierFollowUps(
      new Date("2026-07-30T14:00:00.000Z"),
    );
    expect(result.checked).toBe(1);
    expect(result.outcomes[0]).toEqual(
      expect.objectContaining({
        supplier: "Reminder Supplier",
        owner: "Pablo",
        delivered: false,
      }),
    );
    expect(
      (
        await prisma.crmRecord.findUniqueOrThrow({
          where: { id: record.id },
        })
      ).followUpReminderSentFor,
    ).toBeNull();
    expect(await prisma.alertLog.count()).toBe(1);
  });
});
