"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const TABS = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/progress", label: "Progress", icon: "chart" },
  { href: "/coach", label: "Coach", icon: "coach" },
  { href: "/settings", label: "Settings", icon: "gear" },
];

export function TabBar() {
  const path = usePathname();
  if (path.startsWith("/practice")) return null; // distraction-free practice
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur">
      <ul className="mx-auto flex max-w-lg justify-around px-2 pt-2">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} className={`flex w-20 flex-col items-center gap-1 py-1 text-[11px] font-medium ${active ? "text-accent" : "text-ink-3"}`} aria-current={active ? "page" : undefined}>
                <Icon name={t.icon} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
