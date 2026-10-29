import type { Metadata } from "next";
import { RecipeBuilder } from "./recipe-builder";

export const metadata: Metadata = { title: "Nova receita" };

export default function NewRecipePage() {
  return <RecipeBuilder />;
}
