import { describe, expect, it, vi, beforeEach } from "vitest";

const customers = vi.hoisted(() => ({ list: [] as unknown[] }));

vi.mock("@/lib/shopify", () => ({
  shopifyConfigured: () => true,
  getShopifyCustomers: async () => customers.list,
}));

import { syncShopifyLeads } from "@/lib/lead-sync";
import { prisma } from "@/lib/prisma";

describe("syncShopifyLeads", () => {
  beforeEach(async () => {
    await prisma.interaction.deleteMany({});
    await prisma.crmRecord.deleteMany({ where: { type: "lead" } });
    customers.list = [];
  });

  it("creates a lead for a new Shopify customer", async () => {
    customers.list = [
      { id: "gid://shopify/Customer/1", name: "Jane Buyer", email: "jane@example.com", phone: "+15551112222", location: "Austin, TX", ordersCount: 0, amountSpent: "0.00 USD", createdAt: new Date().toISOString() },
    ];
    const r = await syncShopifyLeads();
    expect(r.created).toBe(1);
    const lead = await prisma.crmRecord.findFirst({ where: { linkedShopifyId: "gid://shopify/Customer/1" } });
    expect(lead?.name).toBe("Jane Buyer");
    expect(lead?.type).toBe("lead");
    expect(lead?.status).toBe("NEW");
    expect(lead?.source).toBe("Shopify");
  });

  it("marks a customer who already ordered as WON", async () => {
    customers.list = [
      { id: "gid://shopify/Customer/2", name: "Repeat Bob", email: "bob@example.com", phone: null, location: null, ordersCount: 3, amountSpent: "900.00 USD", createdAt: new Date().toISOString() },
    ];
    await syncShopifyLeads();
    const lead = await prisma.crmRecord.findFirst({ where: { linkedShopifyId: "gid://shopify/Customer/2" } });
    expect(lead?.status).toBe("WON");
  });

  it("is idempotent — re-running creates no duplicates", async () => {
    customers.list = [
      { id: "gid://shopify/Customer/3", name: "Dup Test", email: "dup@example.com", phone: null, location: null, ordersCount: 0, amountSpent: "0.00 USD", createdAt: new Date().toISOString() },
    ];
    await syncShopifyLeads();
    const second = await syncShopifyLeads();
    expect(second.created).toBe(0);
    const count = await prisma.crmRecord.count({ where: { type: "lead" } });
    expect(count).toBe(1);
  });

  it("never overwrites a stage or next action set by a human", async () => {
    customers.list = [
      { id: "gid://shopify/Customer/4", name: "Worked Lead", email: "worked@example.com", phone: null, location: null, ordersCount: 0, amountSpent: "0.00 USD", createdAt: new Date().toISOString() },
    ];
    await syncShopifyLeads();
    const created = await prisma.crmRecord.findFirstOrThrow({ where: { linkedShopifyId: "gid://shopify/Customer/4" } });
    await prisma.crmRecord.update({
      where: { id: created.id },
      data: { status: "QUOTE_SENT", nextAction: "Call back Friday" },
    });
    // Shopify now reports a phone number too.
    customers.list = [
      { id: "gid://shopify/Customer/4", name: "Worked Lead", email: "worked@example.com", phone: "+15559998888", location: null, ordersCount: 0, amountSpent: "0.00 USD", createdAt: new Date().toISOString() },
    ];
    await syncShopifyLeads();
    const after = await prisma.crmRecord.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.status).toBe("QUOTE_SENT");
    expect(after.nextAction).toBe("Call back Friday");
    expect(after.phone).toBe("+15559998888"); // blank filled in
  });

  it("matches an existing lead by email and links the Shopify id", async () => {
    await prisma.crmRecord.create({
      data: { type: "lead", name: "Phoned In", email: "match@example.com", cluster: "Other", status: "ENGAGED" },
    });
    customers.list = [
      { id: "gid://shopify/Customer/5", name: "Phoned In", email: "match@example.com", phone: null, location: null, ordersCount: 1, amountSpent: "50.00 USD", createdAt: new Date().toISOString() },
    ];
    const r = await syncShopifyLeads();
    expect(r.created).toBe(0);
    expect(r.updated).toBe(1);
    const all = await prisma.crmRecord.findMany({ where: { type: "lead" } });
    expect(all).toHaveLength(1);
    expect(all[0].linkedShopifyId).toBe("gid://shopify/Customer/5");
    expect(all[0].status).toBe("ENGAGED"); // untouched
  });
});
