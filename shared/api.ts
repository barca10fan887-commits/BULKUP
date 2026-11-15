// Request/response contracts shared by the frontend and the API server.
import { z } from "zod";

export const FoodScanItemSchema = z.object({
  name: z.string(),
  portion: z.string(),
  estimated_grams: z.number(),
  calories: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
});

export const FoodScanResultSchema = z.object({
  is_food: z.boolean(),
  items: z.array(FoodScanItemSchema),
  notes: z.string(),
});

export type FoodScanItem = z.infer<typeof FoodScanItemSchema>;
export type FoodScanResult = z.infer<typeof FoodScanResultSchema>;

/** JSON Schema mirror of FoodScanResultSchema for the model's structured output. */
export const FoodScanJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["is_food", "items", "notes"],
  properties: {
    is_food: { type: "boolean", description: "False if the photo does not show food or drink." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "estimated_grams", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
        properties: {
          name: { type: "string" },
          portion: { type: "string", description: "Plain description such as '1 cup' or '2 slices'." },
          estimated_grams: { type: "number" },
          calories: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    notes: { type: "string", description: "Short caveats, e.g. hidden oils or sauces that change the estimate." },
  },
} as const;

export const FoodScanRequestSchema = z.object({
  imageBase64: z.string().min(100).max(7_000_000),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  hint: z.string().max(300).optional(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const CoachRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(40),
  /** Snapshot of the user's own logged data, built on the device. */
  context: z.record(z.unknown()),
  mode: z.enum(["chat", "checkin"]).default("chat"),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export interface StatusResponse {
  ai: boolean;
  model: string | null;
  auth: "supabase" | "access_code" | "dev_open" | "locked";
  accountDeletion: boolean;
}
