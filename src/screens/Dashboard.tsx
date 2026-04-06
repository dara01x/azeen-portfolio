import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Building2, Users, FolderKanban, ArrowUpRight, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth/useAuth";
import { getProperties } from "@/modules/properties/property.client";
import { getProjects } from "@/modules/projects/project.client";
import { getClients } from "@/modules/clients/client.client";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import { createStory, getStories, uploadStoryVideo } from "@/modules/stories/story.client";
import { PageHeader } from "@/components/PageHeader";
import type { AppVariableItem } from "@/modules/app-variables/types";
import type { Client, Project, Property, Story } from "@/types";

const MAX_STORY_VIDEO_SIZE_BYTES = 30 * 1024 * 1024;

function parseIsoTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatStoryAge(value: string | null | undefined): string {
  const createdAt = parseIsoTime(value);

  if (!createdAt) {
    return "Just now";
  }

  const diffMs = Math.max(0, Date.now() - createdAt);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const storyInputRef = useRef<HTMLInputElement | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setProjects([]);
      setProperties([]);
      setClients([]);
      setStories([]);
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
      getStories(),
      getVariables("property_types"),
      getVariables("cities"),
    ])
      .then(([
        projectsResult,
        propertiesResult,
        clientsResult,
        storiesResult,
        propertyTypesResult,
        citiesResult,
      ]) => {
        if (cancelled) {
          return;
        }

        setProjects(projectsResult.status === "fulfilled" ? (projectsResult.value as Project[]) : []);
        setProperties(propertiesResult.status === "fulfilled" ? (propertiesResult.value as Property[]) : []);
        setClients(clientsResult.status === "fulfilled" ? (clientsResult.value as Client[]) : []);
        setStories(storiesResult.status === "fulfilled" ? (storiesResult.value as Story[]) : []);
        setPropertyTypes(propertyTypesResult.status === "fulfilled" ? propertyTypesResult.value : []);
        setCities(citiesResult.status === "fulfilled" ? citiesResult.value : []);

        const hasAnyFailure =
          projectsResult.status === "rejected" ||
          propertiesResult.status === "rejected" ||
          clientsResult.status === "rejected" ||
          storiesResult.status === "rejected" ||
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

  const activeStories = useMemo(
    () =>
      stories
        .filter((story) => parseIsoTime(story.expires_at) > Date.now())
        .sort((a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at)),
    [stories],
  );

  const canPublishStory = !!user && (user.role === "admin" || user.role === "company");

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

  function openStoryFilePicker() {
    if (!canPublishStory || uploadingStory) {
      return;
    }

    setStoryError(null);
    storyInputRef.current?.click();
  }

  async function handleStoryFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile || !canPublishStory || uploadingStory) {
      return;
    }

    if (!selectedFile.type.startsWith("video/")) {
      setStoryError("Please select a video file for stories.");
      return;
    }

    if (selectedFile.size > MAX_STORY_VIDEO_SIZE_BYTES) {
      setStoryError("Story video must be 30MB or less.");
      return;
    }

    setUploadingStory(true);
    setStoryError(null);

    try {
      const videoUrl = await uploadStoryVideo(selectedFile);
      const createdStory = await createStory({ video_url: videoUrl });

      setStories((current) =>
        [createdStory, ...current].sort(
          (a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at),
        ),
      );
    } catch (storyUploadError) {
      const message =
        storyUploadError instanceof Error
          ? storyUploadError.message
          : "Failed to upload story video.";
      setStoryError(message);
    } finally {
      setUploadingStory(false);
    }
  }

  function openStoryViewer(story: Story) {
    setActiveStory(story);
    setStoryDialogOpen(true);
  }

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your real estate operations" />

      {loading ? <p className="mb-4 text-sm text-muted-foreground">Loading dashboard...</p> : null}
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {storyError ? <p className="mb-4 text-sm text-destructive">{storyError}</p> : null}

      <Card className="mb-8">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Stories</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Short videos visible for 24 hours.</p>
          </div>
          {canPublishStory ? (
            <Button size="sm" onClick={openStoryFilePicker} disabled={uploadingStory}>
              <Plus className="mr-1.5 h-4 w-4" />
              {uploadingStory ? "Uploading..." : "Add Story"}
            </Button>
          ) : null}
          <input
            ref={storyInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => {
              void handleStoryFileSelected(event);
            }}
          />
        </CardHeader>
        <CardContent>
          {activeStories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active stories yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {activeStories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  className="shrink-0 text-left"
                  onClick={() => openStoryViewer(story)}
                >
                  <span className="relative block h-20 w-20 rounded-full bg-gradient-to-br from-primary/80 via-rose-400 to-amber-400 p-[2px]">
                    <span className="block h-full w-full overflow-hidden rounded-full bg-black">
                      <video
                        src={story.video_url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </span>
                  </span>
                  <span className="mt-2 block max-w-[84px] truncate text-xs font-medium">
                    {story.created_by_name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatStoryAge(story.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
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
                        <p className="text-xs text-muted-foreground">{getCityName(p.city_id)}</p>
                      </div>
                      <StatusBadge status={p.status} />
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

      <Dialog
        open={storyDialogOpen}
        onOpenChange={(open) => {
          setStoryDialogOpen(open);

          if (!open) {
            setActiveStory(null);
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden p-0">
          {activeStory ? (
            <>
              <DialogTitle className="sr-only">Story video</DialogTitle>
              <DialogDescription className="sr-only">
                Story from {activeStory.created_by_name}
              </DialogDescription>
              <div className="bg-black">
                <video
                  key={activeStory.id}
                  src={activeStory.video_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] w-full bg-black"
                />
              </div>
              <div className="px-4 pb-4">
                <p className="text-sm font-semibold">{activeStory.created_by_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {activeStory.created_by_role} · {formatStoryAge(activeStory.created_at)}
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
