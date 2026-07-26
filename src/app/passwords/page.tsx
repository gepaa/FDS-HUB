import type { Metadata } from "next";
import { vaultConfigured } from "@/lib/secret-box";
import { hasVaultSession } from "@/lib/vault-session";
import { env } from "@/lib/env";
import { PasswordControl } from "@/components/passwords/PasswordControl";

export const metadata: Metadata = { title: "Password Control" };
export const dynamic = "force-dynamic";

export default async function PasswordsPage() {
  // Both halves must be present: a key to seal with, and a passphrase
  // to gate on. Either missing and the vault stays shut.
  const configured = vaultConfigured() && Boolean(env.PASSWORD_CONTROL_PASSPHRASE);
  const unlocked = configured && (await hasVaultSession());

  return <PasswordControl configured={configured} initialUnlocked={unlocked} />;
}
