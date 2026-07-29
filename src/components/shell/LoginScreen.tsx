"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock, ArrowRight } from "lucide-react";

/**
 * The front door.
 *
 * Replaces the browser's native credential popup, which was grey, ugly,
 * un-brandable, and gave no way to say what the thing you're signing
 * into even is. Same shared credentials, presented properly.
 *
 * Deliberately self-contained: its own deep-blue field rather than the
 * app shell, so the moment of arrival reads as a front door and not a
 * page of the console with the furniture missing.
 */
export function LoginScreen() {
  const params = useSearchParams();
  // Only ever a path on this site. "//evil.example" also starts with a
  // slash and is a protocol-relative URL, so a bare startsWith("/")
  // check would turn the login page into an open redirect — send the
  // team a link, they sign in, they land on someone else's site.
  const requested = params.get("next") ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (res.ok) {
        // Full navigation, not a client push: the proxy has to see the
        // new cookie, and a soft transition can serve a cached miss.
        window.location.href = next;
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Sign-in failed");
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10"
      style={{
        background:
          "radial-gradient(120% 90% at 50% -10%, #1d4ed8 0%, #10265f 42%, #070d1c 100%)",
      }}
    >
      {/* Two soft lights, one warm, so the field has depth without
          becoming a gradient poster. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[46rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.45) 0%, rgba(59,130,246,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-52 -left-24 size-[34rem] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(217,169,65,0.35) 0%, rgba(217,169,65,0) 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <div
            className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border border-white/15 text-white/90"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",
              boxShadow: "0 8px 30px rgba(2,10,30,0.5)",
            }}
          >
            <span className="text-lg font-semibold tracking-tight">FDS</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Operations HQ
          </h1>
          <p className="mt-1 text-sm text-white/55">Farmer Direct Supply</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-white/12 p-6 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))",
            boxShadow:
              "0 24px 70px rgba(2,8,26,0.55), inset 0 1px 0 rgba(255,255,255,0.14)",
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-white/60 uppercase">
              Username
            </span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              placeholder="fds"
              className="w-full rounded-xl border border-white/12 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:bg-white/10 focus:outline-none"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-white/60 uppercase">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/12 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:bg-white/10 focus:outline-none"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !password}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-[filter,opacity] hover:brightness-110 disabled:opacity-45"
            style={{
              background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              boxShadow: "0 10px 26px rgba(37,99,235,0.45)",
            }}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="size-4" aria-hidden />
              </>
            )}
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/40">
            <Lock className="size-3" aria-hidden />
            Shared team login
          </p>
        </form>
      </div>
    </main>
  );
}
