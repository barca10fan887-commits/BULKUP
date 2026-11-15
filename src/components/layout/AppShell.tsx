import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, UtensilsCrossed, Dumbbell, LineChart, Pill, Bot, Settings, CalendarDays, ClipboardCheck, Droplets, MoreHorizontal } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Sheet } from "@/components/ui/Sheet";
import { Logo } from "./Logo";
import { useStore } from "@/data/store";

const NAV = [
  { to: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, mobile: true },
  { to: "/food", label: "Food", short: "Food", icon: UtensilsCrossed, mobile: true },
  { to: "/workouts", label: "Workouts", short: "Train", icon: Dumbbell, mobile: true },
  { to: "/progress", label: "Progress", short: "Progress", icon: LineChart, mobile: true },
  { to: "/supplements", label: "Supplements", short: "Supps", icon: Pill, mobile: false },
  { to: "/coach", label: "AI Coach", short: "Coach", icon: Bot, mobile: false },
  { to: "/settings", label: "Profile & Settings", short: "Profile", icon: Settings, mobile: false },
] as const;

const SECONDARY = [
  { to: "/water", label: "Water", icon: Droplets },
  { to: "/calendar", label: "Calendar & history", icon: CalendarDays },
  { to: "/check-in", label: "Weekly check-in", icon: ClipboardCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const { profile, repo } = useStore();
  const moreActive = [...NAV.filter((n) => !n.mobile), ...SECONDARY].some((n) => loc.pathname.startsWith(n.to));

  return (
    <div className="min-h-dvh bg-ink-950 lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900/60 px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <SideLink key={n.to} to={n.to} icon={<n.icon className="h-[18px] w-[18px]" />} label={n.label} />
          ))}
          <p className="mb-1 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[.1em] text-mist-500">Tracking</p>
          {SECONDARY.map((n) => (
            <SideLink key={n.to} to={n.to} icon={<n.icon className="h-[18px] w-[18px]" />} label={n.label} />
          ))}
        </nav>
        {profile && (
          <div className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-volt-500/15 font-display font-bold text-volt-300">{profile.name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist-100">{profile.name}</p>
              <p className="text-xs text-mist-500">{repo.kind === "cloud" ? "Synced account" : "Saved on this device"}</p>
            </div>
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1">
        <div
          className="mx-auto w-full max-w-5xl pb-28 pt-4 lg:pb-12 lg:pt-8"
          style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
        >
          <div className="mb-4 lg:hidden">
            <Logo small />
          </div>
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-950/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.filter((n) => n.mobile).map((n) => (
            <BottomLink key={n.to} to={n.to} label={n.short} icon={n.icon} />
          ))}
          <BottomLink to="/coach" label="Coach" icon={Bot} />
          <button onClick={() => setMore(true)} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", moreActive ? "text-volt-400" : "text-mist-500")} aria-label="More sections">
            <MoreHorizontal className="h-[22px] w-[22px]" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="More">
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {[...NAV.filter((n) => !n.mobile && n.to !== "/coach"), ...SECONDARY].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={() => setMore(false)}
              className={({ isActive }) =>
                cn("flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold transition", isActive ? "border-volt-500/50 bg-volt-500/10 text-volt-300" : "border-ink-700 bg-ink-900 text-mist-100 hover:border-ink-600")
              }
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function SideLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
          isActive ? "bg-volt-500/12 text-volt-300 shadow-[inset_2px_0_0_0_#1f75ff]" : "text-mist-400 hover:bg-ink-800 hover:text-mist-100",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function BottomLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof LayoutDashboard }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition", isActive ? "text-volt-400" : "text-mist-500")}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-volt-500 shadow-[0_0_12px_#1f75ff]" />}
          <Icon className="h-[22px] w-[22px]" />
          {label}
        </>
      )}
    </NavLink>
  );
}
