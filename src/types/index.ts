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
  role: "owner" | "manager" | "company";
  status: "active" | "disabled";
  phone: string;
  company_name?: string;
  company_phone?: string;
  company_address?: string;
}

// Properties
export interface Property {
  id: string;
  title: string;
  type_id: string;
  listing_type: "sale" | "rent";
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
  status: "active" | "completed" | "archived";
  city_id: string;
  area: string;
  address: string;
  lat?: number;
  lng?: number;
  total_units: number;
  available_units: number;
  images: string[];
  main_image?: string;
  video_url?: string;
  assigned_company_id?: string;
  has_units: boolean;
  internal_notes?: string;
}

// Units
export interface Unit {
  id: string;
  project_id: string;
  title: string;
  type_id: string;
  status: "available" | "sold";
  price: number;
  currency: "USD" | "IQD";
  payment_type: "cash" | "installment";
  area_size: number;
  bedrooms: number;
  bathrooms: number;
  floor_number: number;
  images: string[];
  main_image?: string;
  internal_notes?: string;
}

// Settings
export interface AppSettings {
  allow_company_create_properties: boolean;
  allow_company_edit_properties: boolean;
}
