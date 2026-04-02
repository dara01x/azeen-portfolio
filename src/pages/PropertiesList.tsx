import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { mockProperties, mockPropertyTypes, mockCities } from "@/data/mock";

const PropertiesList = () => {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = mockProperties.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (cityFilter !== "all" && p.city_id !== cityFilter) return false;
    if (typeFilter !== "all" && p.type_id !== typeFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const getTypeName = (id: string) => mockPropertyTypes.find(t => t.id === id)?.name || "";
  const getCityName = (id: string) => mockCities.find(c => c.id === id)?.name || "";

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage your property listings"
        actions={<Button asChild><Link to="/properties/new"><Plus className="mr-2 h-4 w-4" />Add Property</Link></Button>}
      />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="City" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {mockCities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {mockPropertyTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No properties found" description="Try adjusting your filters or add a new property." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Listing</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{getTypeName(p.type_id)}</TableCell>
                  <TableCell>{getCityName(p.city_id)}</TableCell>
                  <TableCell className="capitalize">{p.listing_type}</TableCell>
                  <TableCell>{p.currency} {p.price.toLocaleString()}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" asChild><Link to={`/properties/${p.id}`}>View</Link></Button>
                      <Button variant="ghost" size="sm" asChild><Link to={`/properties/${p.id}/edit`}>Edit</Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default PropertiesList;
