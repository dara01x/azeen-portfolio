import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit, MapPin, Bed, Bath, Layers, Maximize, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/StatusBadge";
import { mockProperties, mockPropertyTypes, mockCities, mockAmenities, mockViews, mockProjects, mockClients } from "@/data/mock";
import { EmptyState } from "@/components/EmptyState";

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="space-y-1">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
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
  const projectName = property.project_id ? mockProjects.find(p => p.id === property.project_id)?.title : undefined;
  const clientName = property.owner_client_id ? mockClients.find(c => c.id === property.owner_client_id)?.full_name : undefined;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link to="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight truncate">{property.title}</h1>
            <StatusBadge status={property.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {typeName} · {property.listing_type === "sale" ? "For Sale" : "For Rent"} · {cityName}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to={`/properties/${id}/edit`}><Edit className="mr-2 h-4 w-4" />Edit Property</Link>
        </Button>
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-3 gap-0.5">
          <div className="col-span-2 row-span-2 bg-muted aspect-[16/10] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Main Image</p>
            </div>
          </div>
          <div className="bg-muted aspect-[16/10] flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground opacity-30" />
          </div>
          <div className="bg-muted aspect-[16/10] flex items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground opacity-30" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Maximize, label: "Area", value: `${property.area_size} m²` },
          { icon: Bed, label: "Bedrooms", value: property.bedrooms },
          { icon: Bath, label: "Bathrooms", value: property.bathrooms },
          { icon: Layers, label: "Floors", value: property.floors },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold">{property.currency} {property.price.toLocaleString()}</span>
                {property.listing_type === "rent" && <span className="text-muted-foreground text-sm">/ month</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Payment Type" value={property.payment_type} />
                <Field label="Condition" value={property.condition?.replace("_", " ")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Description</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {property.description_en && (
                <div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">English</p><p className="text-sm leading-relaxed">{property.description_en}</p></div>
              )}
              {property.description_ku && (
                <><Separator /><div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Kurdish</p><p className="text-sm leading-relaxed" dir="rtl">{property.description_ku}</p></div></>
              )}
              {property.description_ar && (
                <><Separator /><div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Arabic</p><p className="text-sm leading-relaxed" dir="rtl">{property.description_ar}</p></div></>
              )}
            </CardContent>
          </Card>

          {(property.building_name || property.land_number) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Building Info</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Field label="Building Name" value={property.building_name} />
                <Field label="Land Number" value={property.land_number} />
                <Field label="Total Floors" value={property.total_floors} />
                <Field label="Unit Floor" value={property.unit_floor_number} />
              </CardContent>
            </Card>
          )}

          {property.internal_notes && (
            <Card className="border-dashed">
              <CardHeader className="pb-3"><CardTitle className="text-base">Internal Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground italic">{property.internal_notes}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Location</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-[4/3] rounded-lg bg-muted flex items-center justify-center border">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-6 w-6 mx-auto mb-1 opacity-40" />
                  <p className="text-xs">Map Preview</p>
                </div>
              </div>
              <div className="space-y-3">
                <Field label="City" value={cityName} />
                <Field label="Area" value={property.area} />
                <Field label="Address" value={property.address_en} />
                {property.lat && <Field label="Coordinates" value={`${property.lat}, ${property.lng}`} />}
              </div>
            </CardContent>
          </Card>

          {amenityNames.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Amenities</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {amenityNames.map((a) => (
                    <span key={a} className="inline-flex items-center rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {a}
                    </span>
                  ))}
                </div>
                {viewName && <div className="mt-3"><Field label="View" value={viewName} /></div>}
              </CardContent>
            </Card>
          )}

          {(projectName || clientName || property.assigned_company_id) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Relations</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {projectName && <Field label="Project" value={projectName} />}
                {clientName && <Field label="Owner Client" value={clientName} />}
                {property.assigned_company_id && <Field label="Assigned Company" value={property.assigned_company_id} />}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;
