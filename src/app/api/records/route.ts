import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { recordInput } from "@/lib/validation";
import { resolveActor } from "@/lib/agent-auth";
import { nextRecordId } from "@/lib/record-id";
import { normalisedPhoneFor } from "@/lib/quo/matching";

export const dynamic = "force-dynamic";

/** GET /api/records?type=supplier|lead — list records with activity log. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const records = await prisma.crmRecord.findMany({
    where: type === "supplier" || type === "lead" ? { type } : undefined,
    include: { interactions: true, supplierOwner: true },
    orderBy: { name: "asc" },
  });
  return Response.json(records.map(toRecordDTO));
}

/** POST /api/records — create a record. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = recordInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const {
    tags,
    productCategories,
    supplierContacts,
    supplierOwnerId,
    ...rest
  } = parsed.data;
  const resolvedSupplierOwnerId =
    parsed.data.type === "supplier"
      ? (supplierOwnerId ?? "seat_1")
      : null;
  if (resolvedSupplierOwnerId) {
    const member = await prisma.teamMember.findUnique({
      where: { id: resolvedSupplierOwnerId },
    });
    if (!member?.active) {
      return Response.json(
        { error: "Choose an active supplier profile" },
        { status: 400 },
      );
    }
  }
  const recordId = await nextRecordId(parsed.data.type);
  const created = await prisma.crmRecord.create({
    data: {
      ...rest,
      recordId,
      // Keep the normalised number in step with the typed one, so an
      // inbound call from this lead matches without anyone having to
      // remember international format.
      phoneE164: normalisedPhoneFor(rest.phone),
      supplierOwnerId: resolvedSupplierOwnerId,
      tags: JSON.stringify(tags),
      productCategories: JSON.stringify(productCategories),
      supplierContacts: JSON.stringify(supplierContacts),
      interactions: {
        create: {
          type: "system",
          actor,
          body: `Record created (${parsed.data.status}) by ${actor}`,
        },
      },
    },
    include: { interactions: true, supplierOwner: true },
  });
  return Response.json(toRecordDTO(created), { status: 201 });
}
