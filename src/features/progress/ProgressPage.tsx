import { useState } from "react";
import { PageHeader, Segmented } from "@/components/ui/misc";
import { WeightTab } from "./WeightTab";
import { MeasurementsTab } from "./MeasurementsTab";
import { PhotosTab } from "./PhotosTab";

export default function ProgressPage() {
  const [tab, setTab] = useState<"weight" | "measurements" | "photos">("weight");
  return (
    <div>
      <PageHeader title="Progress" subtitle="Weight, measurements and photos" />
      <Segmented
        className="mb-4 max-w-md"
        value={tab}
        onChange={setTab}
        options={[
          { value: "weight", label: "Weight" },
          { value: "measurements", label: "Measurements" },
          { value: "photos", label: "Photos" },
        ]}
      />
      {tab === "weight" && <WeightTab />}
      {tab === "measurements" && <MeasurementsTab />}
      {tab === "photos" && <PhotosTab />}
    </div>
  );
}
