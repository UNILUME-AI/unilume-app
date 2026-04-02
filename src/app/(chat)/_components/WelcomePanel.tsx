"use client";

import { Sender } from "@ant-design/x";
import { QUICK_ACTIONS, SUGGESTION_PILLS } from "@/config/quick-actions";
import BentoCard from "@/components/ui/BentoCard";
import Pill from "@/components/ui/Pill";

interface WelcomePanelProps {
  onSend: (text: string) => void;
  input: string;
  onInputChange: (val: string) => void;
  isLoading: boolean;
  onCancel: () => void;
  userName?: string | null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export default function WelcomePanel({
  onSend,
  input,
  onInputChange,
  isLoading,
  onCancel,
  userName,
}: WelcomePanelProps) {
  const greetText = userName
    ? `${getGreeting()}，${userName}`
    : getGreeting();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[760px] px-6">
        {/* Hero */}
        <section className="pt-16 pb-6 text-center">
          <p className="text-[13px] text-[var(--ink3)] mb-2 animate-[fadeUp_0.6s_ease_0.1s_both]">
            {greetText}
          </p>
          <h1 className="text-[34px] font-extrabold tracking-[-0.8px] leading-[1.25] text-[var(--ink)] animate-[fadeUp_0.6s_ease_0.2s_both]">
            关于 Noon 的一切，
            <span className="relative whitespace-nowrap">
              问我就好
              <span className="absolute left-0 right-0 bottom-[2px] h-2.5 rounded bg-gradient-to-r from-amber-400/40 via-[var(--brand)]/25 to-amber-400/40 bg-[length:200%_100%] -z-10 animate-[shimmerHL_4s_ease-in-out_infinite]" />
            </span>
          </h1>
          <p className="mt-3 text-sm text-[var(--ink2)] leading-relaxed animate-[fadeUp_0.6s_ease_0.3s_both]">
            基于 <strong className="font-semibold text-[var(--brand)]">223+</strong> 篇 Noon 官方帮助文档，实时解答卖家政策、费用与运营问题
          </p>
        </section>

        {/* Inline search box */}
        <div className="mb-4 animate-[fadeUp_0.6s_ease_0.4s_both]">
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] transition-shadow focus-within:border-[color-mix(in_srgb,var(--brand)_35%,transparent)] focus-within:shadow-[0_0_0_3px_var(--brand-glow),0_2px_12px_rgba(0,0,0,.04)]">
            <Sender
              value={input}
              onChange={onInputChange}
              onSubmit={(msg: string) => onSend(msg)}
              loading={isLoading}
              onCancel={onCancel}
              placeholder="输入你的 Noon 卖家问题..."
              submitType="enter"
              autoSize={{ minRows: 1, maxRows: 4 }}
            />
          </div>
        </div>

        {/* Suggestion pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-10 animate-[fadeUp_0.6s_ease_0.45s_both]">
          <span className="text-[11.5px] text-[var(--ink3)] mr-0.5">试试问</span>
          {SUGGESTION_PILLS.map((pill) => (
            <Pill key={pill} label={pill} onClick={() => onSend(pill)} />
          ))}
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 mb-3.5 animate-[fadeUp_0.5s_ease_0.55s_both]">
          <span className="text-[11px] font-semibold tracking-[0.8px] uppercase text-[var(--ink3)]">
            热门问题
          </span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-2.5 pb-6">
          {QUICK_ACTIONS.map((action, i) => (
            <BentoCard
              key={i}
              category={action.category}
              categoryLabel={action.categoryLabel}
              title={action.text}
              description={action.description}
              span={action.span}
              onClick={() => onSend(action.text)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
