import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useProfile, useStore } from "@/data/store";
import { getStatus } from "@/lib/api";
import { Button } from "./ui/Button";

/** One-tap opt-in for AI features, shown wherever AI is used. */
export function AiConsent({ feature }: { feature: "coach" | "scanner" }) {
  const { saveProfile } = useStore();
  const profile = useProfile();
  const [provider, setProvider] = useState<"gemini" | "claude" | null | undefined>();
  useEffect(() => {
    getStatus().then((s) => setProvider(s.provider));
  }, []);
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 p-5">
      <div className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-5 w-5 text-volt-400" />
        {feature === "coach" ? "Turn on your AI coach" : "Turn on the photo scanner"}
      </div>
      <p className="mt-2 text-sm text-mist-400">
        {feature === "coach"
          ? "Your coach uses AI to answer anything, using your goal and what you've logged. "
          : "The scanner uses AI to estimate the calories and protein in your meal photo. "}
        {provider === "gemini"
          ? "When you use it, your question, the relevant details from your logs and any photo you scan are sent to Google's Gemini AI. On Google's free tier, Google may use this to improve its products, so avoid including anything you'd want kept private. "
          : "When you use it, the relevant details are sent securely to our AI provider to create the answer. They aren't used to train AI. "}
        You can turn this off in Me &gt; Privacy.
      </p>
      <Button className="mt-4" block onClick={() => saveProfile({ ...profile, privacy: { ...profile.privacy, aiDataSharing: true } })}>
        Turn on
      </Button>
    </div>
  );
}
