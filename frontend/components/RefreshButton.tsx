"use client";

import { useState } from "react";

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    onRefresh();
    setSpinning(true);
    setTimeout(() => setSpinning(false), 500);
  }

  return (
    <button
      onClick={handleClick}
      title="Refresh from chain"
      className="rounded-md border border-border p-1.5 text-muted hover:border-primary hover:text-primary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
