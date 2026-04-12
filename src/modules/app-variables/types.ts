export const APP_VARIABLE_TYPES = ["property_types", "cities", "areas", "amenities", "views"] as const;

export type AppVariableType = (typeof APP_VARIABLE_TYPES)[number];

export interface AreaBoundaryPoint {
  lat: number;
  lng: number;
}

export interface AppVariableItem {
  id: string;
  name: string;
  created_at: string | null;
  area_boundary?: AreaBoundaryPoint[];
  area_center?: AreaBoundaryPoint | null;
}
