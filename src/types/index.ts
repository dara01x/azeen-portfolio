// App Variables
export interface PropertyType {
  id: string;
  name: string;
}

export interface City {
  id: string;
  name: string;
}

export interface Amenity {
  id: string;
  name: string;
}

export interface ViewType {
  id: string;
  name: string;
}

// Clients
export interface Client {
  id: string;
  full_name: string;
  primary_phone: string;
  secondary_phone?: string;
  email?: string;
  notes?: string;
  status: "active" | "inactive";
}

// Users
export interface User {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "company";
  status: "active" | "disabled";
  phone: string;
  company_name?: string;
  company_phone?: string;
  company_address?: string;
}

// Stories
export interface Story {
  id: string;
  video_url: string;
  created_by_uid: string;
  created_by_name: string;
  created_by_role: "admin" | "company";
  created_at: string;
  expires_at: string;
}

// Properties
export interface Property {
  id: string;
  property_code?: string;
  title: string;
  type_id: string;
  listing_type: "sale" | "rent";
  listing_date?: string;
  status: "available" | "sold" | "archived";
  price: number;
  currency: "USD" | "IQD";
  payment_type: "cash" | "installment";
  city_id: string;
  area: string;
  address_en: string;
  address_ku: string;
  address_ar: string;
  lat?: number;
  lng?: number;
  area_size: number;
  bedrooms: number;
  suit_rooms: number;
  bathrooms: number;
  balconies: number;
  floors: number;
  condition: "new" | "used" | "under_construction";
  ownership_type?: string;
  amenities: string[];
  view_id?: string;
  land_number?: string;
  total_floors?: number;
  unit_floor_number?: number;
  building_name?: string;
  tower_number?: string;
  description_en: string;
  description_ku: string;
  description_ar: string;
  images: string[];
  main_image?: string;
  video_url?: string;
  project_id?: string;
  owner_client_id?: string;
  assigned_company_id?: string;
  contact_name: string;
  primary_mobile_number: string;
  secondary_mobile_number?: string;
  internal_notes?: string;
}

// Projects
export interface Project {
  id: string;
  title: string;
  description: string;
  description_en: string;
  description_ku: string;
  description_ar: string;
  status: "active" | "completed" | "archived";
  city_id: string;
  area: string;
  address: string;
  address_en: string;
  address_ku: string;
  address_ar: string;
  lat?: number;
  lng?: number;
  property_type_ids: string[];
  area_size: number;
  starting_price: number;
  currency: "USD" | "IQD";
  payment_type: "cash" | "installment";
  amenities: string[];
  contact_name: string;
  primary_mobile_number: string;
  secondary_mobile_number?: string;
  images: string[];
  main_image?: string;
  video_url?: string;
  assigned_company_id?: string;
  internal_notes?: string;
}

// Units
export interface UnitFeatures {
  bedrooms: number;
  bathrooms: number;
  suit_rooms: number;
  balconies: number;
}

export interface UnitOption {
  price: number;
  currency: "USD" | "IQD";
  interface: string[];
  building_no?: string;
  floor_no?: string;
  active: boolean;
  sold: boolean;
}

export interface Unit {
  id: string;
  unit_code?: string;
  project_id: string;
  unit_number?: string;
  title: string;
  status: "available" | "sold" | "archived";
  price: number;
  currency: "USD" | "IQD";
  payment_type: "cash" | "installment";
  type_id?: string;
  area_size: number;
  bedrooms: number;
  suit_rooms: number;
  bathrooms: number;
  balconies: number;
  floor_number?: number;
  features: UnitFeatures;
  properties: UnitOption[];
  images: string[];
  main_image?: string;
  assigned_company_id?: string;
  internal_notes?: string;
}
