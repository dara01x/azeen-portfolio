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
import { mockUnits, mockProjects, mockPropertyTypes } from "@/data/mock";

const UnitsList = () => {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = mockUnits.filter((u) => {
    if (search && !u.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== "all" && u.project_id !== projectFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    return true;
  });

  const getProjectName = (id: string) => mockProjects.find(p => p.id === id)?.title || "";
  const getTypeName = (id: string) => mockPropertyTypes.find(t => t.id === id)?.name || "";

  return (
    <div>
      <PageHeader title="Units" description="Manage project units" actions={<Button asChild><Link to="/units/new"><Plus className="mr-2 h-4 w-4" />Add Unit</Link></Button>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search units..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Project" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {mockProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 ? <EmptyState title="No units found" description="Try adjusting filters or add a new unit." /> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Title</TableHead><TableHead>Project</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead><TableHead>Size</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.title}</TableCell>
                  <TableCell>{getProjectName(u.project_id)}</TableCell>
                  <TableCell>{getTypeName(u.type_id)}</TableCell>
                  <TableCell>{u.currency} {u.price.toLocaleString()}</TableCell>
                  <TableCell>{u.area_size} m²</TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" asChild><Link to={`/units/${u.id}/edit`}>Edit</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default UnitsList;
