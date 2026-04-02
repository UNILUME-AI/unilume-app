"use client";

import { useRouter } from "next/navigation";

interface DatePickerProps {
  currentDate: string;
  availableDates: string[];
  platform?: string;
}

export default function DatePicker({
  currentDate,
  availableDates,
  platform,
}: DatePickerProps) {
  const router = useRouter();

  const currentIdx = availableDates.indexOf(currentDate);
  const hasPrev = currentIdx < availableDates.length - 1;
  const hasNext = currentIdx > 0;

  const navigate = (date: string) => {
    const params = new URLSearchParams();
    if (date !== availableDates[0]) params.set("date", date);
    if (platform && platform !== "noon") params.set("platform", platform);
    const url = params.toString()
      ? `/policy-updates?${params}`
      : "/policy-updates";
    router.push(url);
  };

  const minDate = availableDates[availableDates.length - 1] ?? "";
  // Allow selecting up to today
  const today = new Date().toISOString().slice(0, 10);
  const maxDate = today;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => hasPrev && navigate(availableDates[currentIdx + 1])}
        disabled={!hasPrev}
        className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        &larr;
      </button>
      <input
        type="date"
        value={currentDate}
        min={minDate}
        max={maxDate}
        onChange={(e) => {
          const val = e.target.value;
          if (val) navigate(val);
        }}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-brand-400"
      />
      <button
        onClick={() => hasNext && navigate(availableDates[currentIdx - 1])}
        disabled={!hasNext}
        className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        &rarr;
      </button>
    </div>
  );
}
