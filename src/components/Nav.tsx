"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Activity" },
  { href: "/account", label: "Account & domains" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 rounded-lg border border-grid bg-card p-1 text-sm">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-md px-3 py-1.5 ${
            path === l.href ? "bg-raised text-primary" : "text-muted hover:text-primary"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
