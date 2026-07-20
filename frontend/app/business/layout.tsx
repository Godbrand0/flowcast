"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BusinessProvider } from "@/lib/business-context";
import { WorkspaceGate } from "@/components/business/WorkspaceGate";

const tabs = [
  { href: "/business", label: "Dashboard" },
  { href: "/business/team", label: "Team" },
];

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <BusinessProvider>
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`border-b-2 px-3 py-3 text-sm font-medium ${
                pathname === t.href
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <WorkspaceGate>{children}</WorkspaceGate>
    </BusinessProvider>
  );
}
