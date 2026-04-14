import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ImageUpload";
import { useAuth } from "@/lib/auth/useAuth";
import { getVariables } from "@/modules/app-variables/appVariables.client";
import type { AppVariableItem } from "@/modules/app-variables/types";
import { getUsers as fetchUsers } from "@/modules/users/user.client";
import {
  createProject,
  getProjectById,
  updateProject,
  uploadProjectImageBlobUrls,
  uploadProjectVideoFile,
} from "@/modules/projects/project.client";
import {
  createUnit,
  deleteUnit as deleteUnitById,
  getUnits,
  updateUnit,
  uploadUnitImageBlobUrls,
} from "@/modules/units/unit.client";
import type { Project, Unit, UnitOption, User } from "@/types";

type LocalImageFileMap = Record<string, File>;

const OPTIONAL_LINK_NONE = "__none__";
const DIRECTION_OPTIONS = ["north", "east", "south", "west"];
const MAX_PROJECT_VIDEO_FILE_SIZE_BYTES = 30 * 1024 * 1024;

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

function hasOptionById(items: Array<{ id: string }>, id?: string) {
  if (!id) {
    return false;
  }

  return items.some((item) => item.id === id);
}

function getPreferredText(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function createDefaultUnitOption(): UnitOption {
  return {
    price: 0,
    currency: "USD",
    interface: [],
    building_no: "",
    floor_no: "",
    active: true,
    sold: false,
  };
}

function createDefaultUnitDraft(projectId: string): Omit<Unit, "id"> {
  return {
    unit_code: "",
    project_id: projectId,
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
    properties: [createDefaultUnitOption()],
    images: [],
    main_image: undefined,
    assigned_company_id: undefined,
    internal_notes: "",
  };
}

function normalizeUnitOptions(options: UnitOption[]): UnitOption[] {
  return options.map((option) => {
    const normalizedInterface = Array.from(
      new Set(
        (option.interface || [])
          .map((item) => item.trim().toLowerCase())
          .filter((item) => DIRECTION_OPTIONS.includes(item)),
      ),
    );

    const isSold = option.sold === true;

    return {
      price: Number(option.price) >= 0 ? Number(option.price) : 0,
      currency: option.currency === "IQD" ? "IQD" : "USD",
      interface: normalizedInterface,
      building_no: (option.building_no || "").trim() || undefined,
      floor_no: (option.floor_no || "").trim() || undefined,
      active: isSold ? false : option.active !== false,
      sold: isSold,
    };
  });
}

function deriveUnitStatusFromOptions(options: UnitOption[]): Unit["status"] {
  const hasAvailable = options.some((option) => option.active && !option.sold);
  const hasSold = options.some((option) => option.sold);

  if (hasAvailable) {
    return "available";
  }

  if (hasSold && options.every((option) => option.sold)) {
    return "sold";
  }

  if (hasSold) {
    return "available";
  }

  return "archived";
}

function inferFloorNumberFromOptions(options: UnitOption[]): number | undefined {
  for (const option of options) {
    const value = Number(option.floor_no);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function getUnitTypeName(typeId: string | undefined, types: AppVariableItem[]) {
  if (!typeId) {
    return "No type";
  }

  return types.find((item) => item.id === typeId)?.name || typeId;
}

function getUnitPriceRangeLabel(unit: Unit) {
  const options = normalizeUnitOptions(unit.properties || []);

  if (options.length === 0) {
    return `${unit.price || 0} ${unit.currency || "USD"}`;
  }

  const prices = options.map((option) => option.price).filter((price) => Number.isFinite(price));
  if (prices.length === 0) {
    return `0 ${options[0]?.currency || "USD"}`;
  }

  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const currency = options[0]?.currency || "USD";

  return minimum === maximum ? `${minimum} ${currency}` : `${minimum} - ${maximum} ${currency}`;
}

const defaultProject: Omit<Project, "id"> = {
  title: "",
  description: "",
  description_en: "",
  description_ku: "",
  description_ar: "",
  status: "active",
  city_id: "",
  area: "",
  address: "",
  address_en: "",
  address_ku: "",
  address_ar: "",
  property_type_ids: [],
  area_size: 0,
  starting_price: 0,
  currency: "USD",
  payment_type: "cash",
  amenities: [],
  contact_name: "",
  primary_mobile_number: "",
  images: [],
  internal_notes: "",
};

const FormSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-4">
      <CardTitle className="text-base">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const ProjectForm = () => {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const paramId = params?.id;
  const id = Array.isArray(paramId) ? paramId[0] : paramId;
  const isEdit = !!id && id !== "new";

  const [form, setForm] = useState<Omit<Project, "id">>(defaultProject);
  const [loading, setLoading] = useState(isEdit);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [cities, setCities] = useState<AppVariableItem[]>([]);
  const [areas, setAreas] = useState<AppVariableItem[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<AppVariableItem[]>([]);
  const [companies, setCompanies] = useState<User[]>([]);
  const [viewers, setViewers] = useState<User[]>([]);
  const [localImageFiles, setLocalImageFiles] = useState<LocalImageFileMap>({});
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [localVideoPreviewUrl, setLocalVideoPreviewUrl] = useState("");
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [unitLocalImageFiles, setUnitLocalImageFiles] = useState<LocalImageFileMap>({});
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState<Omit<Unit, "id">>(createDefaultUnitDraft(id || ""));
  const [unitEditorOpen, setUnitEditorOpen] = useState(false);
  const [unitEditingId, setUnitEditingId] = useState<string | null>(null);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitDeletingId, setUnitDeletingId] = useState<string | null>(null);
  const [unitError, setUnitError] = useState<string | null>(null);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const activeVideoUrl = localVideoPreviewUrl || form.video_url || "";

  const clearLocalVideoSelection = () => {
    setLocalVideoFile(null);
    setLocalVideoPreviewUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return "";
    });

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const handleVideoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_PROJECT_VIDEO_FILE_SIZE_BYTES) {
      setError("Video is too large. Please use a file up to 30MB.");
      event.target.value = "";
      return;
    }

    setError(null);
    setLocalVideoFile(selectedFile);
    update("video_url", "");

    setLocalVideoPreviewUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(selectedFile);
    });
  };

  const clearUnitLocalImageFiles = () => {
    setUnitLocalImageFiles((current) => {
      Object.keys(current).forEach((imageUrl) => {
        if (imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(imageUrl);
        }
      });

      return {};
    });
  };

  const areaNames = useMemo(
    () => Array.from(new Set(areas.map((item) => item.name.trim()).filter(Boolean))),
    [areas],
  );

  useEffect(() => {
    return () => {
      if (localVideoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localVideoPreviewUrl);
      }
    };
  }, [localVideoPreviewUrl]);

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

    Promise.all([
      getVariables("cities"),
      getVariables("areas"),
      getVariables("property_types"),
    ])
      .then(([cityItems, areaItems, propertyTypeItems]) => {
        if (cancelled) {
          return;
        }

        setCities(cityItems);
        setAreas(areaItems);
        setPropertyTypes(propertyTypeItems);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message =
            fetchError instanceof Error ? fetchError.message : "Failed to load app variables.";
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
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    fetchUsers()
      .then((items) => {
        if (!cancelled) {
          const activeUsers = (items as User[]).filter((item) => item.status === "active");

          setCompanies(
            activeUsers.filter((item) => item.role === "company"),
          );
          setViewers(
            activeUsers.filter((item) => item.role === "viewer"),
          );
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          const message = fetchError instanceof Error ? fetchError.message : "Failed to load users.";
          setLookupError((prev) => prev || message);
          setCompanies([]);
          setViewers([]);
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
      clearLocalVideoSelection();
      return;
    }

    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    getProjectById(id)
      .then((project) => {
        if (cancelled) {
          return;
        }

        if (!project) {
          setError("Project not found.");
          return;
        }

        setLocalImageFiles({});
        clearLocalVideoSelection();
        const { id: _id, ...rest } = project;

        setForm({
          ...defaultProject,
          ...rest,
        });
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load project data.";
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

  useEffect(() => {
    if (!isEdit || !id) {
      setUnits([]);
      setUnitsLoading(false);
      setUnitsError(null);
      setUnitEditorOpen(false);
      setUnitEditingId(null);
      setUnitDraft(createDefaultUnitDraft(""));
      return;
    }

    setUnitDraft((prev) => ({
      ...prev,
      project_id: id,
    }));
  }, [id, isEdit]);

  useEffect(() => {
    if (!isEdit) {
      return;
    }

    if (authLoading || !user || !id) {
      return;
    }

    let cancelled = false;
    setUnitsLoading(true);
    setUnitsError(null);

    getUnits()
      .then((items) => {
        if (cancelled) {
          return;
        }

        const scopedUnits = (items as Unit[]).filter((item) => item.project_id === id);
        setUnits(scopedUnits);
      })
      .catch((loadError) => {
        if (!cancelled) {
          const message = loadError instanceof Error ? loadError.message : "Failed to load units.";
          setUnitsError(message);
          setUnits([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setUnitsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, id, isEdit, user]);

  const openCreateUnitEditor = () => {
    if (!id) {
      return;
    }

    clearUnitLocalImageFiles();
    setUnitEditingId(null);
    setUnitError(null);
    setUnitDraft(createDefaultUnitDraft(id));
    setUnitEditorOpen(true);
  };

  const openEditUnitEditor = (unit: Unit) => {
    const normalizedOptions = normalizeUnitOptions(
      unit.properties && unit.properties.length > 0
        ? unit.properties
        : [
            {
              price: Number(unit.price) || 0,
              currency: unit.currency === "IQD" ? "IQD" : "USD",
              interface: [],
              building_no: "",
              floor_no: unit.floor_number !== undefined ? String(unit.floor_number) : "",
              active: unit.status !== "sold",
              sold: unit.status === "sold",
            },
          ],
    );

    const features = {
      bedrooms: Number(unit.features?.bedrooms ?? unit.bedrooms ?? 0),
      bathrooms: Number(unit.features?.bathrooms ?? unit.bathrooms ?? 0),
      suit_rooms: Number(unit.features?.suit_rooms ?? unit.suit_rooms ?? 0),
      balconies: Number(unit.features?.balconies ?? unit.balconies ?? 0),
    };

    clearUnitLocalImageFiles();

    const { id: _unitId, ...rest } = unit;
    setUnitDraft({
      ...createDefaultUnitDraft(unit.project_id),
      ...rest,
      project_id: unit.project_id,
      unit_number: unit.unit_number || "",
      features,
      bedrooms: features.bedrooms,
      bathrooms: features.bathrooms,
      suit_rooms: features.suit_rooms,
      balconies: features.balconies,
      properties: normalizedOptions,
      internal_notes: unit.internal_notes || "",
      images: unit.images || [],
      main_image: unit.main_image,
    });
    setUnitEditingId(unit.id);
    setUnitError(null);
    setUnitEditorOpen(true);
  };

  const closeUnitEditor = () => {
    clearUnitLocalImageFiles();
    setUnitEditorOpen(false);
    setUnitEditingId(null);
    setUnitError(null);
    setUnitDraft(createDefaultUnitDraft(id || ""));
  };

  const updateUnitDraft = <K extends keyof Omit<Unit, "id">>(key: K, value: Omit<Unit, "id">[K]) => {
    setUnitDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const patchUnitOption = (index: number, patch: Partial<UnitOption>) => {
    setUnitDraft((prev) => {
      const nextOptions = [...(prev.properties || [])];
      const current = nextOptions[index] || createDefaultUnitOption();
      nextOptions[index] = {
        ...current,
        ...patch,
      };

      return {
        ...prev,
        properties: nextOptions,
      };
    });
  };

  const addUnitOption = () => {
    setUnitDraft((prev) => ({
      ...prev,
      properties: [...(prev.properties || []), createDefaultUnitOption()],
    }));
  };

  const removeUnitOption = (index: number) => {
    setUnitDraft((prev) => {
      if ((prev.properties || []).length <= 1) {
        return prev;
      }

      return {
        ...prev,
        properties: prev.properties.filter((_, optionIndex) => optionIndex !== index),
      };
    });
  };

  const toggleUnitOptionDirection = (index: number, direction: string) => {
    setUnitDraft((prev) => {
      const nextOptions = [...(prev.properties || [])];
      const current = nextOptions[index] || createDefaultUnitOption();
      const hasDirection = current.interface.includes(direction);

      nextOptions[index] = {
        ...current,
        interface: hasDirection
          ? current.interface.filter((item) => item !== direction)
          : [...current.interface, direction],
      };

      return {
        ...prev,
        properties: nextOptions,
      };
    });
  };

  async function handleSaveUnit() {
    if (authLoading || !user || !isEdit || !id) {
      return;
    }

    setUnitSaving(true);
    setUnitError(null);

    try {
      const normalizedOptions = normalizeUnitOptions(unitDraft.properties || []);
      if (normalizedOptions.length === 0) {
        throw new Error("At least one unit option is required.");
      }

      const typeId = (unitDraft.type_id || "").trim();
      if (!typeId) {
        throw new Error("Unit type is required.");
      }

      const areaSize = Number(unitDraft.area_size) || 0;
      if (areaSize <= 0) {
        throw new Error("Unit area must be greater than zero.");
      }

      const features = {
        bedrooms: Math.max(0, Number(unitDraft.features?.bedrooms ?? unitDraft.bedrooms ?? 0) || 0),
        bathrooms: Math.max(0, Number(unitDraft.features?.bathrooms ?? unitDraft.bathrooms ?? 0) || 0),
        suit_rooms: Math.max(0, Number(unitDraft.features?.suit_rooms ?? unitDraft.suit_rooms ?? 0) || 0),
        balconies: Math.max(0, Number(unitDraft.features?.balconies ?? unitDraft.balconies ?? 0) || 0),
      };

      const primaryOption = normalizedOptions[0];
      const title = (unitDraft.title || "").trim() || getUnitTypeName(typeId, propertyTypes);

      const payload: Omit<Unit, "id"> = {
        ...unitDraft,
        project_id: id,
        title,
        unit_number: (unitDraft.unit_number || "").trim() || undefined,
        status: deriveUnitStatusFromOptions(normalizedOptions),
        type_id: typeId,
        area_size: areaSize,
        payment_type: unitDraft.payment_type === "installment" ? "installment" : "cash",
        price: primaryOption.price,
        currency: primaryOption.currency,
        floor_number: inferFloorNumberFromOptions(normalizedOptions),
        features,
        bedrooms: features.bedrooms,
        bathrooms: features.bathrooms,
        suit_rooms: features.suit_rooms,
        balconies: features.balconies,
        properties: normalizedOptions,
        images: unitDraft.images || [],
        main_image: unitDraft.main_image || unitDraft.images?.[0] || undefined,
        internal_notes: (unitDraft.internal_notes || "").trim() || undefined,
      };

      const activeUnitLocalFiles = Object.fromEntries(
        Object.entries(unitLocalImageFiles).filter(([imageUrl]) => payload.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(payload.images, activeUnitLocalFiles);
      const preferredMainImage = resolvePreferredMainImage(payload.main_image, payload.images);

      if (unitEditingId) {
        const newlyUploadedImages = await uploadUnitImageBlobUrls(
          unitEditingId,
          localBlobImages,
          activeUnitLocalFiles,
        );

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

        const updated = await updateUnit(unitEditingId, {
          ...payload,
          images: allImages,
          main_image: selectedMainImage || allImages[0],
        });

        setUnits((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
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
          activeUnitLocalFiles,
        );

        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];
        let createdOrUpdated: Unit = created;

        if (allImages.length > 0) {
          const selectedMainImage = resolveMainImageAfterUpload(
            preferredMainImage,
            uploadedImages,
            localBlobImages,
            newlyUploadedImages,
          );

          createdOrUpdated = await updateUnit(created.id, {
            ...payload,
            images: allImages,
            main_image: selectedMainImage || allImages[0],
          });
        }

        setUnits((prev) => [createdOrUpdated, ...prev]);
      }

      Object.keys(activeUnitLocalFiles).forEach((imageUrl) => {
        if (imageUrl.startsWith("blob:")) {
          URL.revokeObjectURL(imageUrl);
        }
      });

      setUnitLocalImageFiles({});

      closeUnitEditor();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save unit.";
      setUnitError(message);
    } finally {
      setUnitSaving(false);
    }
  }

  async function handleDeleteUnit(unitId: string) {
    if (authLoading || !user) {
      return;
    }

    if (!window.confirm("Delete this unit? This action cannot be undone.")) {
      return;
    }

    setUnitDeletingId(unitId);
    setUnitError(null);

    try {
      await deleteUnitById(unitId);
      setUnits((prev) => prev.filter((item) => item.id !== unitId));

      if (unitEditingId === unitId) {
        closeUnitEditor();
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete unit.";
      setUnitError(message);
    } finally {
      setUnitDeletingId(null);
    }
  }

  async function handleSubmit() {
    if (authLoading || !user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const singleDescriptionValue = getPreferredText(
        form.description_en,
        form.description_ku,
        form.description_ar,
        form.description,
      ).trim();

      const payload: Omit<Project, "id"> = {
        ...form,
        title: form.title.trim(),
        description: singleDescriptionValue,
        description_en: singleDescriptionValue,
        description_ku: singleDescriptionValue,
        description_ar: singleDescriptionValue,
        area: form.area.trim(),
        property_type_ids: Array.from(new Set(form.property_type_ids.map((item) => item.trim()).filter(Boolean))),
        amenities: Array.from(new Set((form.amenities || []).map((item) => item.trim()).filter(Boolean))),
        area_size: Number(form.area_size) || 0,
        starting_price: Number(form.starting_price) || 0,
        video_url: form.video_url?.trim() || undefined,
        assigned_company_id: form.assigned_company_id || undefined,
        assigned_viewer_id: (form.assigned_viewer_id || "").trim() || undefined,
        internal_notes: (form.internal_notes || "").trim(),
      };

      if (!payload.title) {
        throw new Error("Project name is required.");
      }

      if (isEdit && !payload.area) {
        throw new Error("Area is required.");
      }

      const activeLocalFiles = Object.fromEntries(
        Object.entries(localImageFiles).filter(([imageUrl]) => payload.images.includes(imageUrl)),
      ) as LocalImageFileMap;

      const { uploadedImages, localBlobImages } = splitImageUrls(payload.images, activeLocalFiles);
      const preferredMainImage = resolvePreferredMainImage(payload.main_image, payload.images);
      let resolvedVideoUrl = (payload.video_url || "").trim();

      if (isEdit && id) {
        if (localVideoFile) {
          resolvedVideoUrl = await uploadProjectVideoFile(id, localVideoFile);
        }

        const newlyUploadedImages = await uploadProjectImageBlobUrls(id, localBlobImages, activeLocalFiles);
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

        await updateProject(id, {
          ...payload,
          images: allImages,
          main_image: selectedMainImage || allImages[0],
          video_url: resolvedVideoUrl,
        });
      } else {
        const initialMainImage =
          preferredMainImage && uploadedImages.includes(preferredMainImage)
            ? preferredMainImage
            : uploadedImages[0];

        const created = await createProject({
          ...payload,
          images: uploadedImages,
          main_image: initialMainImage,
          video_url: resolvedVideoUrl || undefined,
        });

        if (localVideoFile) {
          resolvedVideoUrl = await uploadProjectVideoFile(created.id, localVideoFile);
        }

        const newlyUploadedImages = await uploadProjectImageBlobUrls(
          created.id,
          localBlobImages,
          activeLocalFiles,
        );

        if (localBlobImages.length > 0 && newlyUploadedImages.length === 0) {
          throw new Error("Image upload did not complete. Please reselect images and try again.");
        }

        const allImages = [...uploadedImages, ...newlyUploadedImages];

        if (allImages.length > 0 || localVideoFile) {
          const selectedMainImage = resolveMainImageAfterUpload(
            preferredMainImage,
            uploadedImages,
            localBlobImages,
            newlyUploadedImages,
          );

          await updateProject(created.id, {
            ...payload,
            images: allImages,
            main_image: selectedMainImage || allImages[0],
            video_url: resolvedVideoUrl,
          });
        }
      }

      Object.keys(activeLocalFiles).forEach((imageUrl) => {
        URL.revokeObjectURL(imageUrl);
      });

      setLocalImageFiles({});
      clearLocalVideoSelection();
      router.push("/projects");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save project.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!authLoading && user?.role === "viewer") {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">View Only Access</h1>
        <p className="text-sm text-muted-foreground">
          Viewer accounts can only view assigned projects.
        </p>
        <Button asChild>
          <Link href="/projects">Go to Projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/projects"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Project" : "Create Project"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fill in the details to {isEdit ? "update" : "create"} a project
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
          <Button onClick={handleSubmit} disabled={saving || loading}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
          </Button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {lookupError ? <p className="mb-4 text-sm text-destructive">{lookupError}</p> : null}
      {lookupsLoading ? <p className="mb-4 text-sm text-muted-foreground">Loading app variables...</p> : null}

      {loading && isEdit ? (
        <p className="text-sm text-muted-foreground">Loading project data...</p>
      ) : (
        <div className="grid gap-6 max-w-4xl">
          <FormSection title="Basic Information" description="Core project details">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label>Project Name *</Label>
                <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
              </div>

              <div className="sm:col-span-2">
                <Label className="mb-2 block">Property Types (Optional)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {propertyTypes.map((typeItem) => (
                    <label key={typeItem.id} className="flex items-center gap-2.5 text-sm rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                      <Checkbox
                        checked={form.property_type_ids.includes(typeItem.id)}
                        onCheckedChange={(checked) => {
                          update(
                            "property_type_ids",
                            checked
                              ? [...form.property_type_ids, typeItem.id]
                              : form.property_type_ids.filter((idValue) => idValue !== typeItem.id),
                          );
                        }}
                      />
                      {typeItem.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Location">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City (Optional)</Label>
                <Select
                  value={form.city_id || OPTIONAL_LINK_NONE}
                  onValueChange={(value) => update("city_id", value === OPTIONAL_LINK_NONE ? "" : value)}
                >
                  <SelectTrigger><SelectValue placeholder="Select city (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPTIONAL_LINK_NONE}>None</SelectItem>
                    {!hasOptionById(cities, form.city_id) && form.city_id ? (
                      <SelectItem value={form.city_id}>Current: {form.city_id}</SelectItem>
                    ) : null}
                    {cities.map((cityItem) => (
                      <SelectItem key={cityItem.id} value={cityItem.id}>{cityItem.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{isEdit ? "Area *" : "Area (Optional)"}</Label>
                <Select value={form.area} onValueChange={(value) => update("area", value)}>
                  <SelectTrigger><SelectValue placeholder={isEdit ? "Select area" : "Select area (optional)"} /></SelectTrigger>
                  <SelectContent>
                    {form.area.trim() && !areaNames.includes(form.area.trim()) ? (
                      <SelectItem className="my-1 rounded-md border border-border/60" value={form.area}>Current: {form.area}</SelectItem>
                    ) : null}
                    {areaNames.map((areaName, index) => (
                      <SelectItem className="my-1 rounded-md border border-border/60" key={areaName} value={areaName}>{index + 1}. {areaName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {areaNames.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No areas configured. Add values in App Variables.</p>
                ) : null}
              </div>

            </div>
          </FormSection>

          <FormSection title="Description" description="Project description in any language">
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={getPreferredText(
                  form.description_en,
                  form.description_ku,
                  form.description_ar,
                  form.description,
                )}
                onChange={(e) => {
                  const value = e.target.value;
                  update("description", value);
                  update("description_en", value);
                  update("description_ku", value);
                  update("description_ar", value);
                }}
                rows={4}
                placeholder="Enter description in any language"
              />
            </div>
          </FormSection>

          <FormSection title="Media" description="Upload project images and video">
            <div className="space-y-5">
              <div>
                <Label className="mb-3 block">Images (Optional)</Label>
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
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="block">Video (Optional)</Label>
                <Input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/*"
                  onChange={handleVideoFileChange}
                />
                <p className="text-xs text-muted-foreground">Supported: MP4, MOV, WEBM, MKV. Max 30MB.</p>

                {activeVideoUrl ? (
                  <div className="space-y-2">
                    <video
                      className="w-full max-h-64 rounded-md border bg-black object-contain"
                      src={activeVideoUrl}
                      controls
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clearLocalVideoSelection();
                          update("video_url", "");
                        }}
                      >
                        Remove Video
                      </Button>
                      {localVideoFile ? (
                        <p className="text-xs text-muted-foreground truncate">{localVideoFile.name}</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No video uploaded.</p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title="Assignment">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Assigned Company (Optional)</Label>
                <Select
                  value={form.assigned_company_id || OPTIONAL_LINK_NONE}
                  onValueChange={(value) =>
                    update("assigned_company_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select company (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPTIONAL_LINK_NONE}>Unassigned</SelectItem>
                    {!hasOptionById(companies, form.assigned_company_id) && form.assigned_company_id ? (
                      <SelectItem value={form.assigned_company_id}>Current assigned company</SelectItem>
                    ) : null}
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.company_name || company.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assigned Viewer (Optional)</Label>
                <Select
                  value={form.assigned_viewer_id || OPTIONAL_LINK_NONE}
                  onValueChange={(value) =>
                    update("assigned_viewer_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select viewer (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OPTIONAL_LINK_NONE}>Unassigned</SelectItem>
                    {!hasOptionById(viewers, form.assigned_viewer_id) && form.assigned_viewer_id ? (
                      <SelectItem value={form.assigned_viewer_id}>Current assigned viewer</SelectItem>
                    ) : null}
                    {viewers.map((viewer) => (
                      <SelectItem key={viewer.id} value={viewer.id}>
                        {viewer.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Project Units"
            description="Create and manage units for this project from the same page"
          >
            {!isEdit ? (
              <p className="text-sm text-muted-foreground">Save the project first, then you can add units.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Units in this project: {units.length}</p>
                  <Button type="button" size="sm" className="gap-2" onClick={openCreateUnitEditor}>
                    <Plus className="h-4 w-4" />
                    Add Unit
                  </Button>
                </div>

                {unitsError ? <p className="text-sm text-destructive">{unitsError}</p> : null}

                {unitsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading units...</p>
                ) : units.length === 0 ? (
                  <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                    No units have been added for this project yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {units.map((unit) => {
                      const optionCount = unit.properties?.length || 0;

                      return (
                        <div
                          key={unit.id}
                          className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{unit.title || getUnitTypeName(unit.type_id, propertyTypes)}</p>
                            <p className="text-xs text-muted-foreground">
                              {getUnitTypeName(unit.type_id, propertyTypes)} • {optionCount} option
                              {optionCount === 1 ? "" : "s"} • {getUnitPriceRangeLabel(unit)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize">
                              {unit.status}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openEditUnitEditor(unit)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteUnit(unit.id)}
                              disabled={unitDeletingId === unit.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {unitDeletingId === unit.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {unitEditorOpen ? (
                  <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold">{unitEditingId ? "Edit Unit" : "Add Unit"}</h3>
                      <Button type="button" variant="ghost" size="sm" onClick={closeUnitEditor}>
                        Close
                      </Button>
                    </div>

                    {unitError ? <p className="text-sm text-destructive">{unitError}</p> : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Unit Title (Optional)</Label>
                        <Input
                          value={unitDraft.title}
                          onChange={(e) => updateUnitDraft("title", e.target.value)}
                          placeholder="Apartment A"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unit Type *</Label>
                        <Select
                          value={unitDraft.type_id || OPTIONAL_LINK_NONE}
                          onValueChange={(value) =>
                            updateUnitDraft("type_id", value === OPTIONAL_LINK_NONE ? undefined : value)
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Select unit type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={OPTIONAL_LINK_NONE}>Select type</SelectItem>
                            {!hasOptionById(propertyTypes, unitDraft.type_id) && unitDraft.type_id ? (
                              <SelectItem value={unitDraft.type_id}>Current: {unitDraft.type_id}</SelectItem>
                            ) : null}
                            {propertyTypes.map((typeItem) => (
                              <SelectItem key={typeItem.id} value={typeItem.id}>{typeItem.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Area Size *</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={unitDraft.area_size || ""}
                          onChange={(e) => updateUnitDraft("area_size", Number(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Payment Type</Label>
                        <Select
                          value={unitDraft.payment_type}
                          onValueChange={(value) =>
                            updateUnitDraft(
                              "payment_type",
                              value === "installment" ? "installment" : "cash",
                            )
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="installment">Installment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Unit Number (Optional)</Label>
                        <Input
                          value={unitDraft.unit_number || ""}
                          onChange={(e) => updateUnitDraft("unit_number", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label className="mb-2 block">Features</Label>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Bedrooms</Label>
                            <Input
                              type="number"
                              min={0}
                              value={unitDraft.features.bedrooms || ""}
                              onChange={(e) =>
                                updateUnitDraft("features", {
                                  ...unitDraft.features,
                                  bedrooms: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Suit Rooms</Label>
                            <Input
                              type="number"
                              min={0}
                              value={unitDraft.features.suit_rooms || ""}
                              onChange={(e) =>
                                updateUnitDraft("features", {
                                  ...unitDraft.features,
                                  suit_rooms: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Bathrooms</Label>
                            <Input
                              type="number"
                              min={0}
                              value={unitDraft.features.bathrooms || ""}
                              onChange={(e) =>
                                updateUnitDraft("features", {
                                  ...unitDraft.features,
                                  bathrooms: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Balconies</Label>
                            <Input
                              type="number"
                              min={0}
                              value={unitDraft.features.balconies || ""}
                              onChange={(e) =>
                                updateUnitDraft("features", {
                                  ...unitDraft.features,
                                  balconies: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label>Unit Options *</Label>
                          <Button type="button" variant="outline" size="sm" onClick={addUnitOption}>Add Option</Button>
                        </div>

                        {unitDraft.properties.map((option, index) => (
                          <div key={`option-${index}`} className="space-y-3 rounded-lg border p-3">
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Price</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={option.price || ""}
                                  onChange={(e) =>
                                    patchUnitOption(index, {
                                      price: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Currency</Label>
                                <Select
                                  value={option.currency}
                                  onValueChange={(value) =>
                                    patchUnitOption(index, {
                                      currency: value === "IQD" ? "IQD" : "USD",
                                    })
                                  }
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="IQD">IQD</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Building No.</Label>
                                <Input
                                  value={option.building_no || ""}
                                  onChange={(e) => patchUnitOption(index, { building_no: e.target.value })}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Floor No.</Label>
                                <Input
                                  value={option.floor_no || ""}
                                  onChange={(e) => patchUnitOption(index, { floor_no: e.target.value })}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={option.active}
                                  onCheckedChange={(checked) =>
                                    patchUnitOption(index, {
                                      active: checked === true,
                                      sold: checked === true ? false : option.sold,
                                    })
                                  }
                                />
                                Active
                              </label>
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={option.sold}
                                  onCheckedChange={(checked) =>
                                    patchUnitOption(index, {
                                      sold: checked === true,
                                      active: checked === true ? false : option.active,
                                    })
                                  }
                                />
                                Sold
                              </label>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Interface (Directions)</Label>
                              <div className="flex flex-wrap gap-2">
                                {DIRECTION_OPTIONS.map((direction) => (
                                  <Button
                                    key={`${index}-${direction}`}
                                    type="button"
                                    variant={option.interface.includes(direction) ? "default" : "outline"}
                                    size="sm"
                                    className="capitalize"
                                    onClick={() => toggleUnitOptionDirection(index, direction)}
                                  >
                                    {direction}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => removeUnitOption(index)}
                                disabled={unitDraft.properties.length <= 1}
                              >
                                Remove Option
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label>Unit Images (Optional)</Label>
                        <ImageUpload
                          images={unitDraft.images || []}
                          mainImage={unitDraft.main_image}
                          onMainImageChange={(imageUrl) => updateUnitDraft("main_image", imageUrl)}
                          onLocalFilesAdded={(entries) => {
                            setUnitLocalImageFiles((prev) => {
                              const next = { ...prev };
                              entries.forEach((entry) => {
                                next[entry.url] = entry.file;
                              });
                              return next;
                            });
                          }}
                          onChange={(images) => {
                            const removedLocalUrls = (unitDraft.images || []).filter(
                              (url) => url.startsWith("blob:") && !images.includes(url),
                            );

                            removedLocalUrls.forEach((imageUrl) => {
                              URL.revokeObjectURL(imageUrl);
                            });

                            setUnitLocalImageFiles((prev) => {
                              const next: LocalImageFileMap = {};
                              images.forEach((imageUrl) => {
                                if (prev[imageUrl]) {
                                  next[imageUrl] = prev[imageUrl];
                                }
                              });
                              return next;
                            });

                            const nextMainImage =
                              images.includes(unitDraft.main_image || "")
                                ? unitDraft.main_image
                                : images[0];

                            setUnitDraft((prev) => ({
                              ...prev,
                              images,
                              main_image: nextMainImage,
                            }));
                          }}
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label>Unit Notes (Optional)</Label>
                        <Textarea
                          value={unitDraft.internal_notes || ""}
                          onChange={(e) => updateUnitDraft("internal_notes", e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={closeUnitEditor}>Cancel</Button>
                      <Button type="button" onClick={() => void handleSaveUnit()} disabled={unitSaving}>
                        {unitSaving ? "Saving..." : unitEditingId ? "Update Unit" : "Create Unit"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {unitError && !unitEditorOpen ? <p className="text-sm text-destructive">{unitError}</p> : null}
              </div>
            )}
          </FormSection>

          <FormSection title="Internal Notes">
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={form.internal_notes || ""}
                onChange={(e) => update("internal_notes", e.target.value)}
                rows={4}
                placeholder="Add any internal notes..."
              />
            </div>
          </FormSection>

          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" asChild><Link href="/projects">Cancel</Link></Button>
            <Button onClick={handleSubmit} size="lg" disabled={saving || loading}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectForm;
