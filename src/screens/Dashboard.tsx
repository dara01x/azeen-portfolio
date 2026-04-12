import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Building2, Users, FolderKanban, ArrowUpRight, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/useAuth";
import { getProperties } from "@/modules/properties/property.client";
import { getProjects } from "@/modules/projects/project.client";
import { getClients } from "@/modules/clients/client.client";
import { createStory, getStories, uploadStoryVideo } from "@/modules/stories/story.client";
import { PageHeader } from "@/components/PageHeader";
import type { Client, Project, Property, Story } from "@/types";

const MAX_STORY_VIDEO_SIZE_BYTES = 30 * 1024 * 1024;

type StoryGroup = {
  created_by_uid: string;
  created_by_name: string;
  created_by_role: Story["created_by_role"];
  latest_story: Story;
  stories: Story[];
};

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
  const [loading, setLoading] = useState(true);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
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
    ])
      .then(([
        projectsResult,
        propertiesResult,
        clientsResult,
        storiesResult,
      ]) => {
        if (cancelled) {
          return;
        }

        setProjects(projectsResult.status === "fulfilled" ? (projectsResult.value as Project[]) : []);
        setProperties(propertiesResult.status === "fulfilled" ? (propertiesResult.value as Property[]) : []);
        setClients(clientsResult.status === "fulfilled" ? (clientsResult.value as Client[]) : []);
        setStories(storiesResult.status === "fulfilled" ? (storiesResult.value as Story[]) : []);

        const hasAnyFailure =
          projectsResult.status === "rejected" ||
          propertiesResult.status === "rejected" ||
          clientsResult.status === "rejected" ||
          storiesResult.status === "rejected";

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

  const availableProperties = properties.filter((property) => property.status === "available").length;
  const activeClients = clients.filter((client) => client.status === "active").length;

  const activeStories = useMemo(
    () =>
      stories
        .filter((story) => parseIsoTime(story.expires_at) > Date.now())
        .sort((a, b) => parseIsoTime(b.created_at) - parseIsoTime(a.created_at)),
    [stories],
  );

  const storyGroups = useMemo(() => {
    const grouped = new Map<string, StoryGroup>();

    activeStories.forEach((story) => {
      const key = story.created_by_uid || story.id;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          created_by_uid: story.created_by_uid,
          created_by_name: story.created_by_name,
          created_by_role: story.created_by_role,
          latest_story: story,
          stories: [story],
        });
        return;
      }

      existing.stories.push(story);

      if (parseIsoTime(story.created_at) > parseIsoTime(existing.latest_story.created_at)) {
        existing.latest_story = story;
      }
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        stories: [...group.stories].sort(
          (a, b) => parseIsoTime(a.created_at) - parseIsoTime(b.created_at),
        ),
      }))
      .sort(
        (a, b) => parseIsoTime(b.latest_story.created_at) - parseIsoTime(a.latest_story.created_at),
      );
  }, [activeStories]);

  const canPublishStory = !!user && (user.role === "admin" || user.role === "company");
  const currentDialogStory = activeStoryGroup?.stories[activeStoryIndex] || null;
  const canGoPreviousStory = activeStoryIndex > 0;
  const canGoNextStory =
    !!activeStoryGroup && activeStoryIndex < activeStoryGroup.stories.length - 1;

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
      label: "Total Projects",
      value: projects.length,
      icon: FolderKanban,
      change: "Across all statuses",
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

  function openStoryViewer(group: StoryGroup) {
    setActiveStoryGroup(group);
    setActiveStoryIndex(0);
    setStoryDialogOpen(true);
  }

  function goToPreviousStory() {
    setActiveStoryIndex((current) => (current > 0 ? current - 1 : current));
  }

  function goToNextStory() {
    setActiveStoryIndex((current) => {
      if (!activeStoryGroup) {
        return current;
      }

      return current < activeStoryGroup.stories.length - 1 ? current + 1 : current;
    });
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
          {storyGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active stories yet.</p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {storyGroups.map((group) => (
                <button
                  key={group.created_by_uid || group.latest_story.id}
                  type="button"
                  className="shrink-0 text-left"
                  onClick={() => openStoryViewer(group)}
                >
                  <span className="relative block h-20 w-20 rounded-full bg-gradient-to-br from-primary/80 via-rose-400 to-amber-400 p-[2px]">
                    <span className="block h-full w-full overflow-hidden rounded-full bg-black">
                      <video
                        src={group.latest_story.video_url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </span>
                    {group.stories.length > 1 ? (
                      <span className="absolute bottom-0 right-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[10px] font-semibold text-foreground ring-1 ring-border">
                        {group.stories.length}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 block max-w-[84px] truncate text-xs font-medium">
                    {group.created_by_name}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatStoryAge(group.latest_story.created_at)}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          <p className="text-sm text-muted-foreground">Use shortcuts below for faster access.</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="justify-start h-12 text-base" asChild>
            <Link href="/properties/new"><Building2 className="mr-2 h-4 w-4" />New Property</Link>
          </Button>
          <Button variant="outline" className="justify-start h-12 text-base" asChild>
            <Link href="/clients/new"><Users className="mr-2 h-4 w-4" />New Client</Link>
          </Button>
          <Button variant="outline" className="justify-start h-12 text-base" asChild>
            <Link href="/projects/new"><FolderKanban className="mr-2 h-4 w-4" />New Project</Link>
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={storyDialogOpen}
        onOpenChange={(open) => {
          setStoryDialogOpen(open);

          if (!open) {
            setActiveStoryGroup(null);
            setActiveStoryIndex(0);
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden p-0">
          {currentDialogStory ? (
            <>
              <DialogTitle className="sr-only">Story video</DialogTitle>
              <DialogDescription className="sr-only">
                Story from {currentDialogStory.created_by_name}
              </DialogDescription>
              <div className="bg-black">
                <video
                  key={currentDialogStory.id}
                  src={currentDialogStory.video_url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] w-full bg-black"
                  onEnded={() => {
                    if (canGoNextStory) {
                      goToNextStory();
                    }
                  }}
                />
              </div>
              <div className="px-4 pb-4">
                <p className="text-sm font-semibold">{activeStoryGroup?.created_by_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {activeStoryGroup?.created_by_name} · {formatStoryAge(currentDialogStory.created_at)}
                </p>
                {activeStoryGroup && activeStoryGroup.stories.length > 1 ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousStory}
                      disabled={!canGoPreviousStory}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {activeStoryIndex + 1} / {activeStoryGroup.stories.length}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={goToNextStory}
                      disabled={!canGoNextStory}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
