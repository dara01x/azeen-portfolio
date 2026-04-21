import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ImageUpload";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { getProjects as fetchProjects } from "@/modules/projects/project.client";
import { getUsers as fetchUsers } from "@/modules/users/user.client";
import { createUnit, getUnitById, updateUnit, uploadUnitImageBlobUrls } from "@/modules/units/unit.client";
import type { Project, Unit, UnitOption, User } from "@/types";

const OPTIONAL_LINK_NONE = "__none__";
const DIRECTION_OPTIONS = ["North", "Northwest", "Northeast", "South", "Southwest", "Southeast", "West", "East"];
const ERROR_TOAST_STYLE = {
  background: "hsl(var(--destructive))",
  color: "hsl(var(--destructive-foreground))",
  borderColor: "hsl(var(--destructive))",
};

type LocalImageFileMap = Record<string, File>;

function splitImageUrls(images: string[], localFilesByUrl: LocalImageFileMap) {
  const uploadedImages: string[] = [];
  const localBlobImages: string[] = [];

  images.forEach((image) => {
    if (!image) {
      return;
    }

    if (localFilesByUrl[image] || image.startsWith("blob:") || image.startsWith("data:")) {
      localBlobImages.push(image);
    } else {
      uploadedImages.push(image);
    }
  });

  return { uploadedImages, localBlobImages };
}

function resolvePreferredMainImage(mainImage: string | undefined, images: string[]) {
  if (mainImage && images.includes(mainImage)) {
    return mainImage;
  }

  return images[0];
}

function resolveMainImageAfterUpload(
  preferredMainImage: string | undefined,
  uploadedImages: string[],
  localBlobImages: string[],
  newlyUploadedImages: string[],
) {
  if (preferredMainImage && uploadedImages.includes(preferredMainImage)) {
    return preferredMainImage;
  }

  if (preferredMainImage) {
    const localIndex = localBlobImages.indexOf(preferredMainImage);
    if (localIndex >= 0 && newlyUploadedImages[localIndex]) {
      return newlyUploadedImages[localIndex];
    }
  }

  return [...uploadedImages, ...newlyUploadedImages][0];
}

const defaultUnit: Omit<Unit, "id"> = {
  unit_code: "",
  project_id: "",
  unit_number: "",
  title: "",
  status: "available",
  price: 0,
  currency: "USD",
  payment_type: "cash",
  type_id: "",
  area_size: 0,
  bedrooms: 0,
  suit_rooms: 0,
  bathrooms: 0,
  balconies: 0,
  floor_number: undefined,
  features: {
    bedrooms: 0,
    bathrooms: 0,
    suit_rooms: 0,
    balconies: 0,
  },
  properties: [
    {
      price: 0,
      currency: "USD",
      interface: [],
      building_no: "",
      floor_no: "",
      active: true,
      sold: false,
    },
  ],
  images: [],
  main_image: undefined,
  assigned_company_id: undefined,
  internal_notes: "",
};

function normalizeNonNegativeNumber(value: unknown, label: string) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (parsed < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return parsed;
}

function deriveStatusFromOptions(options: UnitOption[]): Unit["status"] {
  if (options.length === 0) {
    return "available";
  }

  const soldCount = options.filter((item) => item.sold).length;

  if (soldCount === options.length) {
    return "sold";
  }

  if (options.some((item) => item.active && !item.sold)) {
    return "available";
  }

  return "archived";
}

const UnitForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";

  const [form, setForm] = useState<Omit<Unit, "id">>(defaultUnit);
  const [projects, setProjects] = useState<Project[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [companies, setCompanies] = useState<User[]>([]);
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});

  const [loading, setLoading] = useState(isEdit);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) {
      return;
    }

    toast.error(error, { style: ERROR_TOAST_STYLE });
  }, [error]);

  useEffect(() => {
    if (!lookupError) {
      return;
    }

    toast.error(lookupError, { style: ERROR_TOAST_STYLE });
  }, [lookupError]);

  const selectedTypeName = useMemo(
    () => propertyTypes.find((item) => item.id === form.type_id)?.name || "",
    [form.type_id, propertyTypes],
  );

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateFeature = (key: keyof Unit["features"], value: number) => {
    setForm((prev) => {
      const nextFeatures = {
        ...prev.features,
        [key]: value,
      };

      return {
        ...prev,
        features: nextFeatures,
        bedrooms: nextFeatures.bedrooms,
        bathrooms: nextFeatures.bathrooms,
        suit_rooms: nextFeatures.suit_rooms,
        balconies: nextFeatures.balconies,
      };
    });
  };

  const addUnitOption = () => {
    setForm((prev) => ({
      ...prev,
      properties: [
        ...(prev.properties || []),
        {
          price: 0,
          currency: "USD",
          interface: [],
          building_no: "",
          floor_no: "",
          active: false,
          sold: false,
        },
      ],
    }));
  };

  const removeUnitOption = (index: number) => {
    setForm((prev) => ({
      ...prev,
      properties: (prev.properties || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateUnitOption = <K extends keyof UnitOption>(index: number, key: K, value: UnitOption[K]) => {
    setForm((prev) => {
      const nextOptions = [...(prev.properties || [])];
      nextOptions[index] = {
        ...nextOptions[index],
        [key]: value,
      };
      return {
        ...prev,
        properties: nextOptions,
      };
    });
  };

  const toggleDirection = (index: number, direction: string) => {
    const current = form.properties[index];
    if (!current) {
      return;
    }

    const exists = current.interface.includes(direction);
    const nextDirections = exists
      ? current.interface.filter((item) => item !== direction)
      : [...current.interface, direction];

    updateUnitOption(index, "interface", nextDirections);
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setLookupsLoading(false);
      return;
    }

    let cancelled = false;

    setLookupsLoading(true);
    setLookupError(null);

    const companiesPromise =
      user.role === "admin" ? fetchUsers() : Promise.resolve([] as Awaited<ReturnType<typeof fetchUsers>>);

    Promise.all([fetchProjects(), getVariables("property_types"), companiesPromise])
      .then(([projectItems, propertyTypeItems, userItems]) => {
        if (cancelled) {
          return;
        }

        setProjects(projectItems as Project[]);
        setPropertyTypes(propertyTypeItems);
        setCompanies(
          (userItems as User[]).filter((item) => item.role === "company" && item.status === "active"),
        );
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load form data.";
          setLookupError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLookupsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      setLocalImageFiles({});
      return;
    }

    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getUnitById(id)
      .then((unit) => {
        if (cancelled) {
          return;
        }

        if (!unit) {
          setError("Unit not found.");
          return;
        }

        setLocalImageFiles({});
        const { id: _id, ...rest } = unit;

        setForm({
          ...defaultUnit,
          ...rest,
          balconies: rest.balconies || rest.features?.balconies || 0,
          features: rest.features || {
            bedrooms: rest.bedrooms || 0,
            bathrooms: rest.bathrooms || 0,
            suit_rooms: rest.suit_rooms || 0,
            balconies: rest.balconies || 0,
          },
          properties:
            rest.properties && rest.properties.length > 0
              ? rest.properties
              : [
                  {
                    price: rest.price || 0,
                    currency: rest.currency || "USD",
                    interface: [],
                    building_no: "",
                    floor_no: rest.floor_number != null ? String(rest.floor_number) : "",
                    active: rest.status === "available",
                    sold: rest.status === "sold",
                  },
                ],
          type_id: rest.type_id || "",
          unit_number: rest.unit_number || "",
          assigned_company_id: rest.assigned_company_id || undefined,
          internal_notes: rest.internal_notes || "",
        });
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load unit data.";
          setError(message);
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
  }, [authLoading, id, isEdit, user]);

  async function handleSubmit() {
    if (authLoading || !user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const normalizedFeatures = {
        bedrooms: normalizeNonNegativeNumber(form.features.bedrooms, "Bedrooms"),
        bathrooms: normalizeNonNegativeNumber(form.features.bathrooms, "Bathrooms"),
        suit_rooms: normalizeNonNegativeNumber(form.features.suit_rooms, "Suit rooms"),
        balconies: normalizeNonNegativeNumber(form.features.balconies, "Balconies"),
      };

      const normalizedOptions: UnitOption[] = (form.properties || []).map((option) => ({
        price: normalizeNonNegativeNumber(option.price, "Price"),
        currency: (option.currency === "IQD" ? "IQD" : "USD") as UnitOption["currency"],
        interface: Array.from(new Set((option.interface || []).map((item) => item.trim()).filter(Boolean))),
        building_no: (option.building_no || "").trim() || undefined,
        floor_no: (option.floor_no || "").trim() || undefined,
        active: !!option.active,
        sold: !!option.sold,
      }));

      if (normalizedOptions.length === 0) {
        throw new Error("At least one unit option is required.");
      }

      const primaryOption = normalizedOptions[0];
      const primaryFloor = primaryOption.floor_no ? Number(primaryOption.floor_no) : undefined;

      const payload: Omit<Unit, "id"> = {
        ...form,
        project_id: form.project_id.trim(),
        unit_number: (form.unit_number || "").trim() || undefined,
        title: form.title.trim() || selectedTypeName || (form.unit_number || "").trim() || "Unit",
        status: deriveStatusFromOptions(normalizedOptions),
        currency: primaryOption.currency,
        payment_type: form.payment_type,
        type_id: (form.type_id || "").trim() || undefined,
        assigned_company_id:
          user.role === "admin" ? (form.assigned_company_id || "").trim() || undefined : undefined,
        internal_notes: (form.internal_notes || "").trim() || undefined,
        price: primaryOption.price,
        area_size: normalizeNonNegativeNumber(form.area_size, "Area size"),
        bedrooms: normalizedFeatures.bedrooms,
        suit_rooms: normalizedFeatures.suit_rooms,
        bathrooms: normalizedFeatures.bathrooms,
        balconies: normalizedFeatures.balconies,
        features: normalizedFeatures,
        properties: normalizedOptions,
        floor_number:
          primaryFloor == null || !Number.isFinite(primaryFloor)
            ? undefined
            : normalizeNonNegativeNumber(primaryFloor, "Floor number"),
      };

      if (!payload.project_id) {
        throw new Error("Project is required.");
      }

      if (!payload.type_id) {
        throw new Error("Unit type is required.");
      }

      if (payload.area_size <= 0) {
        throw new Error("Area size is required.");
      }

      const activeLocalFiles = Object.fromEntries(
        Object.entries(localImageFiles).filter(([imageUrl]) => payload.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(payload.images, activeLocalFiles);
      const preferredMainImage = resolvePreferredMainImage(payload.main_image, payload.images);

      if (isEdit && id) {
        const newlyUploadedImages = await uploadUnitImageBlobUrls(id, localBlobImages, activeLocalFiles);
        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];
        const selectedMainImage = resolveMainImageAfterUpload(
          preferredMainImage,
          uploadedImages,
          localBlobImages,
          newlyUploadedImages,
        );

        await updateUnit(id, {
          ...payload,
          images: allImages,
          main_image: selectedMainImage || allImages[0],
        });
      } else {
        const initialMainImage =
          preferredMainImage && uploadedImages.includes(preferredMainImage)
            ? preferredMainImage
            : uploadedImages[0];

        const created = await createUnit({
          ...payload,
          images: uploadedImages,
          main_image: initialMainImage,
        });

        const newlyUploadedImages = await uploadUnitImageBlobUrls(
          created.id,
          localBlobImages,
          activeLocalFiles,
        );

        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        if (allImages.length > 0) {
          const selectedMainImage = resolveMainImageAfterUpload(
            preferredMainImage,
            uploadedImages,
            localBlobImages,
            newlyUploadedImages,
          );

          await updateUnit(created.id, {
            ...payload,
            images: allImages,
            main_image: selectedMainImage || allImages[0],
          });
        }
      }

      Object.keys(activeLocalFiles).forEach((imageUrl) => {
        URL.revokeObjectURL(imageUrl);
      });

      setLocalImageFiles({});

      router.push("/units");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save unit.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <p className="text-sm text-muted-foreground">Loading unit...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" asChild className="mb-2 -ml-2">
            <Link href="/units">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Units
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Unit" : "Add Unit"}</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {isEdit ? "Update unit details" : "Create a new unit under a project"}
          </p>
        </div>

        <Button onClick={() => void handleSubmit()} disabled={saving || lookupsLoading || authLoading || !user}>
          {saving ? "Saving..." : isEdit ? "Update Unit" : "Create Unit"}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {lookupError ? <p className="text-sm text-destructive">{lookupError}</p> : null}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Core Information</CardTitle>
          <CardDescription>Link this unit group to a project and define base details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={form.project_id || OPTIONAL_LINK_NONE} onValueChange={(value) => update("project_id", value === OPTIONAL_LINK_NONE ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>Select project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unit Title *</Label>
              <Input
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="e.g. Apartment Type A"
              />
            </div>

            <div className="space-y-2">
              <Label>Property Type *</Label>
              <Select value={form.type_id || OPTIONAL_LINK_NONE} onValueChange={(value) => update("type_id", value === OPTIONAL_LINK_NONE ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>No type</SelectItem>
                  {propertyTypes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select
                value={form.payment_type}
                onValueChange={(value) => update("payment_type", value as Unit["payment_type"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned Company</Label>
              <Select
                value={form.assigned_company_id || OPTIONAL_LINK_NONE}
                onValueChange={(value) => update("assigned_company_id", value === OPTIONAL_LINK_NONE ? undefined : value)}
                disabled={user?.role !== "admin"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assigned automatically from project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={OPTIONAL_LINK_NONE}>Auto from project</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.company_name || company.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Feature Set</CardTitle>
          <CardDescription>Shared feature values for this unit group.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Area Size (m2)</Label>
              <Input
                type="number"
                min={0}
                value={form.area_size}
                onChange={(event) => update("area_size", Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Bedrooms</Label>
              <Input
                type="number"
                min={0}
                value={form.features.bedrooms}
                onChange={(event) => updateFeature("bedrooms", Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Suit Rooms</Label>
              <Input
                type="number"
                min={0}
                value={form.features.suit_rooms}
                onChange={(event) => updateFeature("suit_rooms", Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Bathrooms</Label>
              <Input
                type="number"
                min={0}
                value={form.features.bathrooms}
                onChange={(event) => updateFeature("bathrooms", Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Balconies</Label>
              <Input
                type="number"
                min={0}
                value={form.features.balconies}
                onChange={(event) => updateFeature("balconies", Number(event.target.value) || 0)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Unit Options *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addUnitOption}>
                <Plus className="mr-2 h-4 w-4" />
                Add Option
              </Button>
            </div>

            {form.properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one option for price and direction details.</p>
            ) : (
              <div className="space-y-3">
                {form.properties.map((option, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Option #{index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeUnitOption(index)}
                        disabled={form.properties.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Price</Label>
                        <Input
                          type="number"
                          min={0}
                          value={option.price}
                          onChange={(event) => updateUnitOption(index, "price", Number(event.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select
                          value={option.currency}
                          onValueChange={(value) => updateUnitOption(index, "currency", value as UnitOption["currency"])}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Currency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="IQD">IQD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Floor No.</Label>
                        <Input
                          value={option.floor_no || ""}
                          onChange={(event) => updateUnitOption(index, "floor_no", event.target.value)}
                          placeholder="e.g. 4"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Building No.</Label>
                        <Input
                          value={option.building_no || ""}
                          onChange={(event) => updateUnitOption(index, "building_no", event.target.value)}
                          placeholder="e.g. A"
                        />
                      </div>

                      <div className="flex items-center gap-4 md:col-span-2 pt-7">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={option.active}
                            onCheckedChange={(checked) => updateUnitOption(index, "active", checked === true)}
                          />
                          Active
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={option.sold}
                            onCheckedChange={(checked) => updateUnitOption(index, "sold", checked === true)}
                          />
                          Sold
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Interface Directions</Label>
                      <div className="flex flex-wrap gap-2">
                        {DIRECTION_OPTIONS.map((direction) => {
                          const selected = option.interface.includes(direction);

                          return (
                            <button
                              key={direction}
                              type="button"
                              onClick={() => toggleDirection(index, direction)}
                              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {direction}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Internal Notes</Label>
            <Textarea
              rows={4}
              value={form.internal_notes || ""}
              onChange={(event) => update("internal_notes", event.target.value)}
              placeholder="Optional notes for internal team"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Media</CardTitle>
          <CardDescription>Unit gallery images (optional)</CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            images={form.images}
            mainImage={form.main_image}
            onMainImageChange={(imageUrl) => update("main_image", imageUrl)}
            onLocalFilesAdded={(entries) => {
              setLocalImageFiles((prev) => {
                const next = { ...prev };
                entries.forEach((entry) => {
                  next[entry.url] = entry.file;
                });
                return next;
              });
            }}
            onChange={(images) => {
              const removedLocalUrls = form.images.filter(
                (url) => url.startsWith("blob:") && !images.includes(url),
              );

              removedLocalUrls.forEach((imageUrl) => {
                URL.revokeObjectURL(imageUrl);
              });

              setLocalImageFiles((prev) => {
                const next: LocalImageFileMap = {};
                images.forEach((imageUrl) => {
                  if (prev[imageUrl]) {
                    next[imageUrl] = prev[imageUrl];
                  }
                });
                return next;
              });

              const nextMainImage =
                images.includes(form.main_image || "") ? form.main_image : images[0];

              update("images", images);
              update("main_image", nextMainImage);
            }}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => void handleSubmit()} disabled={saving || lookupsLoading || authLoading || !user}>
          {saving ? "Saving..." : isEdit ? "Update Unit" : "Create Unit"}
        </Button>
      </div>
    </div>
  );
};

export default UnitForm;
