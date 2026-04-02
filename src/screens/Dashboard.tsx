import { Building2, TrendingUp, Users, FolderKanban, ArrowUpRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { mockProperties, mockProjects, mockClients, mockUnits, mockPropertyTypes, mockCities } from "@/data/mock";
import { PageHeader } from "@/components/PageHeader";

const stats = [
  {
    label: "Total Properties",
    value: mockProperties.length,
    icon: Building2,
    change: "+2 this month",
    gradient: "from-primary/10 to-primary/5",
    iconBg: "bg-primary/10 text-primary",
    href: "/properties",
  },
  {
    label: "Active Projects",
    value: mockProjects.filter(p => p.status === "active").length,
    icon: FolderKanban,
    change: "All on track",
    gradient: "from-emerald-50 to-emerald-50/50",
    iconBg: "bg-emerald-100 text-emerald-600",
    href: "/projects",
  },
  {
    label: "Available Units",
    value: mockUnits.filter(u => u.status === "available").length,
    icon: TrendingUp,
    change: `of ${mockUnits.length} total`,
    gradient: "from-amber-50 to-amber-50/50",
    iconBg: "bg-amber-100 text-amber-600",
    href: "/units",
  },
  {
    label: "Active Clients",
    value: mockClients.filter(c => c.status === "active").length,
    icon: Users,
    change: `${mockClients.length} total`,
    gradient: "from-violet-50 to-violet-50/50",
    iconBg: "bg-violet-100 text-violet-600",
    href: "/clients",
  },
];

const Dashboard = () => {
  const getTypeName = (id: string) => mockPropertyTypes.find(t => t.id === id)?.name || "";
  const getCityName = (id: string) => mockCities.find(c => c.id === id)?.name || "";

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your real estate operations" />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((s) => (
          <Link href={s.href} key={s.label} className="group">
            <Card className="relative overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/20">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-50`} />
              <CardContent className="relative p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-3xl font-bold tracking-tight">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{s.label}</div>
                <div className="text-xs text-muted-foreground/70 mt-2">{s.change}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Properties */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Properties</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                <Link href="/properties">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {mockProperties.slice(0, 5).map((p) => (
                  <Link href={`/properties/${p.id}`} key={p.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{getTypeName(p.type_id)} · {getCityName(p.city_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-sm font-medium">{p.currency} {p.price.toLocaleString()}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Active Projects</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {mockProjects.filter(p => p.status === "active").map((p) => (
                  <Link href={`/projects/${p.id}/edit`} key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.available_units} / {p.total_units} available</p>
                    </div>
                    <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${((p.total_units - p.available_units) / p.total_units) * 100}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start h-9" asChild>
                <Link href="/properties/new"><Building2 className="mr-2 h-3.5 w-3.5" />New Property</Link>
              </Button>
              <Button variant="outline" className="justify-start h-9" asChild>
                <Link href="/clients/new"><Users className="mr-2 h-3.5 w-3.5" />New Client</Link>
              </Button>
              <Button variant="outline" className="justify-start h-9" asChild>
                <Link href="/projects/new"><FolderKanban className="mr-2 h-3.5 w-3.5" />New Project</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
