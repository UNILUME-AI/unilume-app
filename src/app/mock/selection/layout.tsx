import type { ReactNode } from "react";

/**
 * /mock/selection layout — independent of `(chat)` to keep the preview
 * self-contained (no ChatContext, no Clerk gate, no global sidebar).
 *
 * Background orbs are duplicated from `(chat)/layout.tsx` rather than
 * extracted to a shared component, because the orbs also carry keyframes
 * defined in globals.css — they're already a globally-declared concern.
 */
export default function MockSelectionLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Decorative orbs — same as ChatShell */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-amber-200 to-orange-300 opacity-20 blur-[100px] animate-[orbFloat1_30s_ease-in-out_infinite]" />
        <div className="absolute -bottom-30 -left-15 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-blue-200 to-indigo-200 opacity-15 blur-[100px] animate-[orbFloat2_35s_ease-in-out_infinite]" />
        <div className="absolute left-[60%] top-[40%] h-[300px] w-[300px] rounded-full bg-gradient-to-br from-purple-200 to-fuchsia-200 opacity-10 blur-[100px] animate-[orbFloat3_40s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
