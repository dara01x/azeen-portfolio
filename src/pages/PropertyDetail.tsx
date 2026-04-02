import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { mockProperties, mockPropertyTypes, mockCities, mockAmenities, mockViews } from "@/data/mock";
import { EmptyState } from "@/components/EmptyState";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent className="grid gap-3 sm:grid-cols-2">{children}</CardContent>
  </Card>
);

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value || "—"}</p>
  </div>
);

const PropertyDetail = () => {
  const { id } = useParams();
  const property = mockProperties.find(p => p.id === id);
  if (!property) return <EmptyState title="Property not found" description="The property you're looking for doesn't exist." />;

  const typeName = mockPropertyTypes.find(t => t.id === property.type_id)?.name;
  const cityName = mockCities.find(c => c.id === property.city_id)?.name;
  const viewName = property.view_id ? mockViews.find(v => v.id === property.view_id)?.name : undefined;
  const amenityNames = property.amenities.map(a => mockAmenities.find(am => am.id === a)?.name).filter(Boolean);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild><Link to="/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{property.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={property.status} />
            <span className="text-sm text-muted-foreground capitalize">{property.listing_type}</span>
          </div>
        </div>
        <Button asChild><Link to={`/properties/${id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit</Link></Button>
      </div>
      <div className="grid gap-4">
        <Section title="Basic Information">
          <Field label="Type" value={typeName} />
          <Field label="Listing Type" value={property.listing_type} />
          <Field label="Condition" value={property.condition?.replace("_", " ")} />
          <Field label="Status" value={property.status} />
        </Section>
        <Section title="Pricing">
          <Field label="Price" value={`${property.currency} ${property.price.toLocaleString()}`} />
          <Field label="Payment Type" value={property.payment_type} />
        </Section>
        <Section title="Location">
          <Field label="City" value={cityName} />
          <Field label="Area" value={property.area} />
          <Field label="Address (EN)" value={property.address_en} />
          <Field label="Address (KU)" value={property.address_ku} />
          <Field label="Address (AR)" value={property.address_ar} />
          <Field label="Coordinates" value={property.lat ? `${property.lat}, ${property.lng}` : undefined} />
        </Section>
        <Section title="Details">
          <Field label="Area Size" value={`${property.area_size} m²`} />
          <Field label="Bedrooms" value={property.bedrooms} />
          <Field label="Bathrooms" value={property.bathrooms} />
          <Field label="Floors" value={property.floors} />
        </Section>
        <Section title="Features">
          <Field label="View" value={viewName} />
          <div>
            <p className="text-xs text-muted-foreground">Amenities</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {amenityNames.map((a) => (
                <span key={a} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{a}</span>
              ))}
            </div>
          </div>
        </Section>
        {(property.building_name || property.land_number) && (
          <Section title="Building Info">
            <Field label="Building Name" value={property.building_name} />
            <Field label="Land Number" value={property.land_number} />
            <Field label="Total Floors" value={property.total_floors} />
            <Field label="Unit Floor" value={property.unit_floor_number} />
          </Section>
        )}
        <Section title="Description">
          <div className="sm:col-span-2 space-y-2">
            <div><p className="text-xs text-muted-foreground">English</p><p className="text-sm">{property.description_en || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Kurdish</p><p className="text-sm" dir="rtl">{property.description_ku || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Arabic</p><p className="text-sm" dir="rtl">{property.description_ar || "—"}</p></div>
          </div>
        </Section>
        {property.internal_notes && (
          <Section title="Internal Notes">
            <div className="sm:col-span-2"><p className="text-sm">{property.internal_notes}</p></div>
          </Section>
        )}
      </div>
    </div>
  );
};

export default PropertyDetail;
