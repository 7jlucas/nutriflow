import { z } from "zod";

/** Esquemas compartilhados entre cliente (feedback imediato) e servidor (autoridade). */

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: "Informe um e-mail válido." }));
export const passwordSchema = z
  .string()
  .min(8, { error: "A senha precisa ter pelo menos 8 caracteres." })
  .max(72, { error: "A senha pode ter no máximo 72 caracteres." })
  .refine((s) => /[A-Za-z]/.test(s) && /\d/.test(s), { error: "Use letras e números na senha." });

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, { error: "Como podemos te chamar?" }).max(60),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    consent: z.literal("on", { error: "É preciso aceitar o tratamento dos dados para criar a conta." }),
  })
  .refine((d) => d.password === d.confirm, { error: "As senhas não coincidem.", path: ["confirm"] });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Informe sua senha." }),
});

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { error: "As senhas não coincidem.", path: ["confirm"] });

const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", "."))),
    z.number({ error: `${label} inválido.` }).min(min, { error: `${label}: mínimo ${min}.` }).max(max, { error: `${label}: máximo ${max}.` }).nullable(),
  );
const requiredNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", "."))),
    z.number({ error: `Informe ${label}.` }).min(min, { error: `${label}: mínimo ${min}.` }).max(max, { error: `${label}: máximo ${max}.` }),
  );

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, { error: "Informe seu nome." }).max(60),
  age: requiredNumber(13, 110, "a idade"),
  sex: z.enum(["female", "male", "unspecified"]),
  height_cm: requiredNumber(100, 250, "a altura (cm)"),
  weight_kg: requiredNumber(30, 350, "o peso atual (kg)"),
  goal: z.enum(["lose", "maintain", "gain"]),
  target_weight_kg: optionalNumber(30, 350, "Meta de peso"),
  target_date: z.preprocess((v) => (v ? v : null), z.iso.date().nullable()),
  activity: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  meals_per_day: requiredNumber(1, 8, "o número de refeições"),
  diet_preferences: z.array(z.string().max(40)).max(10).default([]),
  allergies: z.array(z.string().max(40)).max(15).default([]),
  restrictions: z.array(z.string().max(40)).max(15).default([]),
  budget: z.preprocess((v) => (v ? v : null), z.enum(["low", "medium", "high"]).nullable()),
  needs_professional_guidance: z.boolean().default(false),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const diaryEntrySchema = z.object({
  entry_date: z.iso.date(),
  meal_slot: z.string().min(1).max(60),
  logged_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  food_id: z.uuid().nullable().optional(),
  recipe_id: z.uuid().nullable().optional(),
  portion_id: z.uuid().nullable().optional(),
  quantity: z.number().positive().max(100000),
  unit: z.enum(["g", "kg", "ml", "l", "portion", "serving"]),
});

export const customFoodSchema = z.object({
  name: z.string().trim().min(2, { error: "Nome muito curto." }).max(160),
  brand: z.string().trim().max(80).optional().nullable(),
  ref_amount: requiredNumber(1, 2000, "a porção de referência"),
  ref_unit: z.enum(["g", "ml"]),
  kcal: requiredNumber(0, 2000, "as calorias"),
  protein_g: optionalNumber(0, 1000, "Proteínas"),
  carbs_g: optionalNumber(0, 1000, "Carboidratos"),
  fat_g: optionalNumber(0, 1000, "Gorduras"),
  fiber_g: optionalNumber(0, 1000, "Fibras"),
  sodium_mg: optionalNumber(0, 100000, "Sódio"),
  source: z.enum(["LABEL", "USER"]).default("USER"),
  serving_label: z.string().trim().max(60).optional().nullable(),
  serving_amount: optionalNumber(0.1, 5000, "Medida caseira"),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
