import { useEffect, useState } from "react";
import { Building2, TrendingUp, Users, FolderKanban, ArrowUpRight, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { getProperties } from "@/modules/properties/property.client";
import { getProjects } from "@/modules/projects/project.client";
import { getClients } from "@/modules/clients/client.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { PageHeader } from "@/components/PageHeader";
import type { AppVariableItem } from "@/modules/app-variables/types";
import type { Client, Project, Property } from "@/types";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setProjects([]);
      setProperties([]);
      setClients([]);
      setPropertyTypes([]);
      setCities([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    Promise.allSettled([
      getProjects(),
      getProperties(),
      getClients(),
      getVariables("property_types"),
      getVariables("cities"),
    ])
      .then(([projectsResult, propertiesResult, clientsResult, propertyTypesResult, citiesResult]) => {
        if (cancelled) {
          return;
        }

        setProjects(projectsResult.status === "fulfilled" ? (projectsResult.value as Project[]) : []);
        setProperties(propertiesResult.status === "fulfilled" ? (propertiesResult.value as Property[]) : []);
        setClients(clientsResult.status === "fulfilled" ? (clientsResult.value as Client[]) : []);
        setPropertyTypes(propertyTypesResult.status === "fulfilled" ? propertyTypesResult.value : []);
        setCities(citiesResult.status === "fulfilled" ? citiesResult.value : []);

        const hasAnyFailure =
          projectsResult.status === "rejected" ||
          propertiesResult.status === "rejected" ||
          clientsResult.status === "rejected" ||
          propertyTypesResult.status === "rejected" ||
          citiesResult.status === "rejected";

        if (hasAnyFailure) {
          setError("Some dashboard data could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const activeProjects = projects.filter((project) => project.status === "active");
  const availableProperties = properties.filter((property) => property.status === "available").length;
  const activeClients = clients.filter((client) => client.status === "active").length;
  const totalUnits = projects.reduce((sum, project) => sum + Math.max(0, Number(project.total_units) || 0), 0);
  const availableUnits = projects.reduce(
    (sum, project) => sum + Math.max(0, Number(project.available_units) || 0),
    0,
  );

  const stats = [
    {
      label: "Total Properties",
      value: properties.length,
      icon: Building2,
      change: `${availableProperties} available`,
      gradient: "from-primary/10 to-primary/5",
      iconBg: "bg-primary/10 text-primary",
      href: "/properties",
    },
    {
      label: "Active Projects",
      value: activeProjects.length,
      icon: FolderKanban,
      change: "All on track",
      gradient: "from-emerald-50 to-emerald-50/50",
      iconBg: "bg-emerald-100 text-emerald-600",
      href: "/projects",
    },
    {
      label: "Available Units",
      value: availableUnits,
      icon: TrendingUp,
      change: `of ${totalUnits} total`,
      gradient: "from-amber-50 to-amber-50/50",
      iconBg: "bg-amber-100 text-amber-600",
      href: "/units",
    },
    {
      label: "Active Clients",
      value: activeClients,
      icon: Users,
      change: `${clients.length} total`,
      gradient: "from-violet-50 to-violet-50/50",
      iconBg: "bg-violet-100 text-violet-600",
      href: "/clients",
    },
  ];

  const getTypeName = (id: string) => propertyTypes.find((type) => type.id === id)?.name || id;
  const getCityName = (id: string) => cities.find((city) => city.id === id)?.name || id;

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your real estate operations" />

      {loading ? <p className="mb-4 text-sm text-muted-foreground">Loading dashboard...</p> : null}
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

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
              {properties.length === 0 ? (
                <div className="px-6 py-8 text-sm text-muted-foreground">No properties yet.</div>
              ) : (
                <div className="divide-y">
                  {properties.slice(0, 5).map((p) => (
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
              )}
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
              {activeProjects.length === 0 ? (
                <div className="px-6 py-8 text-sm text-muted-foreground">No active projects.</div>
              ) : (
                <div className="divide-y">
                  {activeProjects.map((p) => (
                    <Link href={`/projects/${p.id}/edit`} key={p.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{p.available_units} / {p.total_units} available</p>
                      </div>
                      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${
                              p.total_units > 0
                                ? ((p.total_units - p.available_units) / p.total_units) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
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
