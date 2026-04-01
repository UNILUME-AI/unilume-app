"use client";

import { useRouter } from "next/navigation";

interface DatePickerProps {
  currentDate: string;
  availableDates: string[];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd} (${weekdays[d.getDay()]})`;
}

export default function DatePicker({
  currentDate,
  availableDates,
}: DatePickerProps) {
  const router = useRouter();

  const currentIdx = availableDates.indexOf(currentDate);
  const hasPrev = currentIdx < availableDates.length - 1;
  const hasNext = currentIdx > 0;

  const navigate = (date: string) => {
    // If it's the latest date, go to bare URL
    if (date === availableDates[0]) {
      router.push("/policy-updates");
    } else {
      router.push(`/policy-updates?date=${date}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => hasPrev && navigate(availableDates[currentIdx + 1])}
        disabled={!hasPrev}
        className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        &larr;
      </button>
      <select
        value={currentDate}
        onChange={(e) => navigate(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-blue-500"
      >
        {availableDates.map((d) => (
          <option key={d} value={d}>
            {formatDateLabel(d)}
          </option>
        ))}
      </select>
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
