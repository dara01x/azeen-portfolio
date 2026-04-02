export const APP_VARIABLE_TYPES = ["property_types", "cities", "amenities", "views"] as const;

export type AppVariableType = (typeof APP_VARIABLE_TYPES)[number];

export interface AppVariableItem {
  id: string;
  name: string;
  created_at: string | null;
}
