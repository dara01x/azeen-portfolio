import type { PropertyType, City, Amenity, ViewType, Client, User, Property, Project, Unit, AppSettings } from "@/types";

export const mockPropertyTypes: PropertyType[] = [
  { id: "1", name: "Apartment" },
  { id: "2", name: "Villa" },
  { id: "3", name: "Land" },
  { id: "4", name: "Commercial" },
  { id: "5", name: "Office" },
];

export const mockCities: City[] = [
  { id: "1", name: "Erbil" },
  { id: "2", name: "Sulaymaniyah" },
  { id: "3", name: "Duhok" },
  { id: "4", name: "Baghdad" },
];

export const mockAmenities: Amenity[] = [
  { id: "1", name: "Swimming Pool" },
  { id: "2", name: "Gym" },
  { id: "3", name: "Parking" },
  { id: "4", name: "Garden" },
  { id: "5", name: "Security" },
  { id: "6", name: "Elevator" },
];

export const mockViews: ViewType[] = [
  { id: "1", name: "City View" },
  { id: "2", name: "Mountain View" },
  { id: "3", name: "Garden View" },
  { id: "4", name: "Street View" },
];

export const mockClients: Client[] = [
  { id: "1", full_name: "Ahmed Hassan", primary_phone: "+964 750 123 4567", email: "ahmed@email.com", status: "active", notes: "VIP client" },
  { id: "2", full_name: "Sara Ali", primary_phone: "+964 751 234 5678", status: "active" },
  { id: "3", full_name: "Omar Kareem", primary_phone: "+964 770 345 6789", email: "omar@email.com", status: "inactive" },
];

export const mockUsers: User[] = [
  { id: "1", full_name: "Admin User", email: "admin@azeen.com", role: "owner", status: "active", phone: "+964 750 000 0001" },
  { id: "2", full_name: "Manager One", email: "manager@azeen.com", role: "manager", status: "active", phone: "+964 750 000 0002" },
  { id: "3", full_name: "Golden Homes Co.", email: "info@goldenhomes.com", role: "company", status: "active", phone: "+964 750 000 0003", company_name: "Golden Homes", company_phone: "+964 66 123 4567", company_address: "Erbil, 60m Street" },
];

export const mockProperties: Property[] = [
  {
    id: "1", title: "Luxury Apartment in Empire", type_id: "1", listing_type: "sale", status: "available",
    price: 185000, currency: "USD", payment_type: "cash",
    city_id: "1", area: "Empire World", address_en: "Empire Tower, Floor 12", address_ku: "تاوەری ئێمپایەر، نهۆمی ١٢", address_ar: "برج إمباير، الطابق ١٢",
    area_size: 180, bedrooms: 3, bathrooms: 2, floors: 1, condition: "new",
    amenities: ["1", "2", "3", "5", "6"], view_id: "1",
    building_name: "Empire Tower", total_floors: 30, unit_floor_number: 12,
    description_en: "A stunning luxury apartment with panoramic city views.", description_ku: "شوقەیەکی لوکس بە دیمەنی شار.", description_ar: "شقة فاخرة بإطلالة بانورامية على المدينة.",
    images: [], main_image: "", assigned_company_id: "3", internal_notes: "Hot deal",
  },
  {
    id: "2", title: "Modern Villa in Ankawa", type_id: "2", listing_type: "sale", status: "sold",
    price: 450000, currency: "USD", payment_type: "installment",
    city_id: "1", area: "Ankawa", address_en: "Ankawa Main Road", address_ku: "شەقامی سەرەکی عەنکاوا", address_ar: "شارع عنكاوا الرئيسي",
    area_size: 350, bedrooms: 5, bathrooms: 4, floors: 2, condition: "new",
    amenities: ["1", "3", "4", "5"], description_en: "Modern villa with garden.", description_ku: "ڤیلای مۆدێرن بە باخچە.", description_ar: "فيلا حديثة مع حديقة.",
    images: [], main_image: "", internal_notes: "",
  },
  {
    id: "3", title: "Commercial Space Downtown", type_id: "4", listing_type: "rent", status: "available",
    price: 2500, currency: "USD", payment_type: "cash",
    city_id: "1", area: "Downtown", address_en: "100m Street, Downtown", address_ku: "شەقامی ١٠٠م، ناوشار", address_ar: "شارع ١٠٠م، وسط المدينة",
    area_size: 120, bedrooms: 0, bathrooms: 1, floors: 1, condition: "used",
    amenities: ["3", "5", "6"], description_en: "Prime commercial space for rent.", description_ku: "شوێنی بازرگانی بۆ کرێ.", description_ar: "مساحة تجارية للإيجار.",
    images: [], main_image: "", internal_notes: "",
  },
];

export const mockProjects: Project[] = [
  {
    id: "1", title: "Azeen Heights", description: "Premium residential tower in central Erbil.",
    status: "active", city_id: "1", area: "Gulan", address: "Gulan Street",
    total_units: 120, available_units: 45, images: [], has_units: true, internal_notes: "",
  },
  {
    id: "2", title: "Green Valley Villas", description: "Exclusive villa compound.",
    status: "active", city_id: "1", area: "Pirmam", address: "Pirmam Road",
    total_units: 30, available_units: 12, images: [], has_units: true, internal_notes: "",
  },
];

export const mockUnits: Unit[] = [
  { id: "1", project_id: "1", title: "Unit A-101", type_id: "1", status: "available", price: 95000, currency: "USD", payment_type: "installment", area_size: 85, bedrooms: 1, bathrooms: 1, floor_number: 1, images: [] },
  { id: "2", project_id: "1", title: "Unit A-202", type_id: "1", status: "sold", price: 130000, currency: "USD", payment_type: "cash", area_size: 120, bedrooms: 2, bathrooms: 2, floor_number: 2, images: [] },
  { id: "3", project_id: "1", title: "Unit A-305", type_id: "1", status: "available", price: 155000, currency: "USD", payment_type: "installment", area_size: 150, bedrooms: 3, bathrooms: 2, floor_number: 3, images: [] },
];

export const mockSettings: AppSettings = {
  allow_company_create_properties: true,
  allow_company_edit_properties: false,
};
