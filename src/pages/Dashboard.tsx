import { Building2, TrendingUp, Users, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockProperties, mockProjects, mockClients, mockUnits } from "@/data/mock";
import { PageHeader } from "@/components/PageHeader";

const stats = [
  { label: "Total Properties", value: mockProperties.length, icon: Building2, color: "text-primary" },
  { label: "Active Projects", value: mockProjects.filter(p => p.status === "active").length, icon: FolderKanban, color: "text-success" },
  { label: "Available Units", value: mockUnits.filter(u => u.status === "available").length, icon: TrendingUp, color: "text-warning" },
  { label: "Active Clients", value: mockClients.filter(c => c.status === "active").length, icon: Users, color: "text-primary" },
];

const Dashboard = () => {
  return (
    <div>
      <PageHeader title="Dashboard" description="Welcome to Azeen Real Estate Portal" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
