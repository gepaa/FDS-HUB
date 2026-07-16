/**
 * The water layer: a deep slate gradient with three slow-drifting
 * light orbs (agricultural green, harvest amber, cool blue) under a
 * faint film grain. Everything above it is frosted glass, so the
 * drift reads as light moving through water. Pure CSS — GPU cheap,
 * frozen by prefers-reduced-motion.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{
        background: "linear-gradient(160deg, var(--bg0) 0%, var(--bg1) 100%)",
      }}
    >
      <div
        className="absolute -top-[20%] -left-[15%] h-[70vh] w-[55vw] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, var(--orb-green), transparent 65%)",
          animation: "orb-a 52s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[18%] -bottom-[25%] h-[75vh] w-[60vw] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, var(--orb-amber), transparent 65%)",
          animation: "orb-b 64s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-[30%] right-[15%] h-[50vh] w-[38vw] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, var(--orb-blue), transparent 65%)",
          animation: "orb-c 47s ease-in-out infinite",
        }}
      />
      {/* film grain — sells the frosted-glass texture */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='7'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
