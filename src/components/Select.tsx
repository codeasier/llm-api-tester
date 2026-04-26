import { ChevronDown } from "lucide-react";
import { type SelectHTMLAttributes } from "react";

type Option = {
  value: string;
  label: string;
};

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: Option[];
}

export default function Select({ options, className = "", ...props }: Props) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none rounded-xl border border-[var(--border-strong)] bg-[var(--bg-muted)] px-3 py-2.5 pr-10 text-sm text-[var(--text-primary)] shadow-sm outline-none transition hover:border-[var(--border-default)] focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:ring-2 focus:ring-[var(--accent-ring)] ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]"
      />
    </div>
  );
}
