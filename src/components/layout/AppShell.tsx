import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { House, UtensilsCrossed, Dumbbell, ChevronLeft } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { Logo } from "./Logo";
import { useStore } from "@/data/store";

// Three tabs. Progress opens from Home; profile and settings from the avatar
// at the top of every screen; everything else from the profile page.
const NAV = [
  { to: "/", label: "Home", icon: House },
  { to: "/food", label: "Food", icon: UtensilsCrossed },
  { to: "/workouts", label: "Train", icon: Dumbbell },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, repo } = useStore();
  const loc = useLocation();
  const navigate = useNavigate();
  const isTab = NAV.some((n) => n.to === loc.pathname);
  const goBack = () => (window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate("/"));

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
        </nav>
        {profile && (
          <Link to="/settings" className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850 p-3 transition hover:border-ink-600">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-volt-500/15 font-display font-bold text-volt-300">{profile.name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist-100">{profile.name}</p>
              <p className="text-xs text-mist-500">{repo.kind === "cloud" ? "Profile and settings" : "Saved on this device"}</p>
            </div>
          </Link>
        )}
      </aside>

      <main className="min-w-0 flex-1">
        <div
          className="mx-auto w-full max-w-5xl pb-28 pt-4 lg:pb-12 lg:pt-8"
          style={{ paddingLeft: "max(16px, env(safe-area-inset-left, 0px))", paddingRight: "max(16px, env(safe-area-inset-right, 0px))" }}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            {isTab ? (
              <Logo small />
            ) : (
              <button onClick={goBack} className="-ml-2 inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-[15px] font-semibold text-volt-400">
                <ChevronLeft className="h-5 w-5" /> Back
              </button>
            )}
            {profile && (
              <Link to="/settings" aria-label="Profile and settings" className="grid h-9 w-9 place-items-center rounded-full bg-ink-800 text-sm font-semibold text-mist-100">
                {profile.name.slice(0, 1).toUpperCase()}
              </Link>
            )}
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
        <div className="mx-auto grid max-w-md grid-cols-3">
          {NAV.map((n) => (
            <BottomLink key={n.to} to={n.to} label={n.label} icon={n.icon} />
          ))}
        </div>
      </nav>
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
          isActive ? "bg-volt-500/12 text-volt-300 " : "text-mist-400 hover:bg-ink-800 hover:text-mist-100",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function BottomLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof House }) {
  return (
    <NavLink to={to} end={to === "/"} className={({ isActive }) => cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition", isActive ? "text-volt-400" : "text-mist-500")}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-volt-500" />}
          <Icon className="h-[22px] w-[22px]" />
          {label}
        </>
      )}
    </NavLink>
  );
}
