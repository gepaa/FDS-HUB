import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/shell/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Farmer Direct Supply — Operations HQ",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
