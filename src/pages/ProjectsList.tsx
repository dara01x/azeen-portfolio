import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { mockProjects, mockCities } from "@/data/mock";

const ProjectsList = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = mockProjects.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const getCityName = (id: string) => mockCities.find(c => c.id === id)?.name || "";

  return (
    <div>
      <PageHeader title="Projects" description="Manage your development projects" actions={<Button asChild><Link to="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link></Button>} />
      <Card className="p-1.5">
        <div className="flex flex-wrap gap-2 p-3 pb-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/50 border-0" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 bg-muted/50 border-0"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <div className="p-6"><EmptyState title="No projects found" description="Try adjusting filters or add a new project." action={<Button asChild><Link to="/projects/new"><Plus className="mr-2 h-4 w-4" />Add Project</Link></Button>} /></div>
        ) : (
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground">{getCityName(p.city_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.total_units}</TableCell>
                  <TableCell className="text-muted-foreground">{p.available_units}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell><Button variant="ghost" size="sm" className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity" asChild><Link to={`/projects/${p.id}/edit`}>Edit</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default ProjectsList;
