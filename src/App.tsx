import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { StoreProvider, useStore } from "@/data/store";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/layout/Logo";
import { setTokenProvider } from "@/lib/api";
import { ReminderScheduler } from "@/features/settings/ReminderScheduler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AuthPage from "@/features/auth/AuthPage";
import UpdatePassword from "@/features/auth/UpdatePassword";
import Onboarding from "@/features/onboarding/Onboarding";
import Dashboard from "@/features/dashboard/Dashboard";

const FoodPage = lazy(() => import("@/features/food/FoodPage"));
const WorkoutsPage = lazy(() => import("@/features/workouts/WorkoutsPage"));
const ProgressPage = lazy(() => import("@/features/progress/ProgressPage"));
const SupplementsPage = lazy(() => import("@/features/supplements/SupplementsPage"));
const CoachPage = lazy(() => import("@/features/coach/CoachPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const WaterPage = lazy(() => import("@/features/water/WaterPage"));
const CalendarPage = lazy(() => import("@/features/calendar/CalendarPage"));
const CheckInPage = lazy(() => import("@/features/checkin/CheckInPage"));

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}

function Splash({ children }: { children?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-14 w-14 animate-pulse" />
        {children}
      </div>
    </div>
  );
}

function Gate() {
  const { auth, recovering, accessToken } = useAuth();
  useEffect(() => setTokenProvider(accessToken), [accessToken]);

  if (auth.status === "loading") return <Splash />;
  if (recovering) return <UpdatePassword />;
  if (auth.status === "signed_out") return <AuthPage />;
  return (
    <StoreProvider>
      <Main />
    </StoreProvider>
  );
}

function Main() {
  const { status, error, profile, reload } = useStore();
  if (status === "loading") return <Splash />;
  if (status === "error")
    return (
      <Splash>
        <p className="max-w-xs text-center text-sm text-mist-300">Couldn't load your data: {error}</p>
        <Button onClick={reload}>Try again</Button>
      </Splash>
    );
  if (!profile) return <Onboarding />;
  return (
    <AppShell>
      <ReminderScheduler />
      <ErrorBoundary>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/food" element={<FoodPage />} />
            <Route path="/workouts" element={<WorkoutsPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/supplements" element={<SupplementsPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/water" element={<WaterPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/check-in" element={<CheckInPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
