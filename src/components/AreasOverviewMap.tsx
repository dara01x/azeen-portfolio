"use client";

import { useEffect, useRef } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { AppVariableItem, AreaBoundaryPoint } from "@/modules/app-variables/types";
import { DUHOK_DEFAULT_CENTER } from "@/lib/constants/map";

type MapLibreModule = typeof import("maplibre-gl");
type MapLibreMap = import("maplibre-gl").Map;
type MapLibreMarker = import("maplibre-gl").Marker;
type GeoJsonSource = import("maplibre-gl").GeoJSONSource;
type MapLibreStyle = import("maplibre-gl").StyleSpecification;

type ResolvedArea = {
  id: string;
  name: string;
  boundary: AreaBoundaryPoint[];
  center: AreaBoundaryPoint;
};

const DEFAULT_CENTER = DUHOK_DEFAULT_CENTER;
const DEFAULT_ZOOM = 11;
const MAX_FIT_ZOOM = 14;
const CURRENT_LOCATION_ZOOM = 16;
const GEOLOCATION_TIMEOUT_MS = 7000;
const GEOLOCATION_MAX_AGE_MS = 300000;
const AREA_SOURCE_ID = "areas-overview-source";
const AREA_FILL_LAYER_ID = "areas-overview-fill";
const AREA_LINE_LAYER_ID = "areas-overview-line";

const MAP_STYLE: MapLibreStyle = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "basemap-layer",
      type: "raster",
      source: "basemap",
    },
  ],
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toLngLat(point: { lat: number; lng: number }): [number, number] {
  return [point.lng, point.lat];
}

function normalizeAreaBoundaryPoints(points?: AreaBoundaryPoint[]) {
  if (!Array.isArray(points)) {
    return [] as AreaBoundaryPoint[];
  }

  return points
    .filter(
      (point) =>
        isFiniteNumber(point?.lat) &&
        isFiniteNumber(point?.lng),
    )
    .map((point) => ({
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    }));
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection;
}

function ensureAreaLayers(map: MapLibreMap) {
  if (!map.getSource(AREA_SOURCE_ID)) {
    map.addSource(AREA_SOURCE_ID, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(AREA_FILL_LAYER_ID)) {
    map.addLayer({
      id: AREA_FILL_LAYER_ID,
      type: "fill",
      source: AREA_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#0f766e",
        "fill-opacity": 0.14,
      },
    });
  }

  if (!map.getLayer(AREA_LINE_LAYER_ID)) {
    map.addLayer({
      id: AREA_LINE_LAYER_ID,
      type: "line",
      source: AREA_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "line-color": "#0f766e",
        "line-width": 2.6,
        "line-opacity": 0.9,
      },
    });
  }
}

function computeBoundaryCenter(points: AreaBoundaryPoint[]): AreaBoundaryPoint {
  const total = points.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + point.lat,
      lng: accumulator.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: Number((total.lat / points.length).toFixed(6)),
    lng: Number((total.lng / points.length).toFixed(6)),
  };
}

function resolveAreaCenter(area: AppVariableItem, boundary: AreaBoundaryPoint[]) {
  if (isFiniteNumber(area.area_center?.lat) && isFiniteNumber(area.area_center?.lng)) {
    return {
      lat: Number(area.area_center.lat.toFixed(6)),
      lng: Number(area.area_center.lng.toFixed(6)),
    };
  }

  return computeBoundaryCenter(boundary);
}

function resolveAreas(areas: AppVariableItem[]) {
  return areas
    .map((area) => {
      const boundary = normalizeAreaBoundaryPoints(area.area_boundary);
      if (boundary.length < 3) {
        return null;
      }

      return {
        id: area.id,
        name: area.name,
        boundary,
        center: resolveAreaCenter(area, boundary),
      } as ResolvedArea;
    })
    .filter((area): area is ResolvedArea => area !== null);
}

function areaFeatureCollection(areas: ResolvedArea[], selectedAreaName: string) {
  const features: Feature[] = areas.map((area) => {
    const polygonCoordinates = area.boundary.map((point) => toLngLat(point));
    const isSelected = selectedAreaName !== "all" && area.name === selectedAreaName;

    return {
      type: "Feature",
      properties: {
        id: area.id,
        name: area.name,
        is_selected: isSelected,
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...polygonCoordinates, polygonCoordinates[0]]],
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  } as FeatureCollection;
}

function createAreaLabelElement(
  areaName: string,
  isSelected: boolean,
  onSelect?: (areaName: string) => void,
) {
  const element = document.createElement("div");
  element.style.background = isSelected ? "rgba(15, 118, 110, 0.95)" : "rgba(255, 255, 255, 0.92)";
  element.style.color = isSelected ? "#ffffff" : "#115e59";
  element.style.border = isSelected
    ? "1px solid rgba(13, 148, 136, 0.95)"
    : "1px solid rgba(15, 118, 110, 0.35)";
  element.style.borderRadius = "9999px";
  element.style.padding = "4px 10px";
  element.style.fontSize = "11px";
  element.style.fontWeight = "700";
  element.style.lineHeight = "1.1";
  element.style.boxShadow = isSelected
    ? "0 3px 14px rgba(15, 118, 110, 0.4)"
    : "0 2px 10px rgba(15, 118, 110, 0.22)";
  element.style.whiteSpace = "nowrap";
  element.style.pointerEvents = onSelect ? "auto" : "none";
  element.style.cursor = onSelect ? "pointer" : "default";
  element.innerText = areaName;

  if (onSelect) {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(areaName);
    });
  }

  return element;
}

export function AreasOverviewMap({
  areas,
  selectedAreaName = "all",
  onAreaSelect,
}: {
  areas: AppVariableItem[];
  selectedAreaName?: string;
  onAreaSelect?: (areaName: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const onAreaSelectRef = useRef(onAreaSelect);

  useEffect(() => {
    onAreaSelectRef.current = onAreaSelect;
  }, [onAreaSelect]);

  useEffect(() => {
    let cancelled = false;
    let removeResizeListener: (() => void) | null = null;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      const maplibre: MapLibreModule = await import("maplibre-gl");
      if (cancelled) {
        return;
      }

      maplibreRef.current = maplibre;

      const map = new maplibre.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: toLngLat(DEFAULT_CENTER),
        zoom: DEFAULT_ZOOM,
      });

      map.addControl(
        new maplibre.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }),
        "top-right",
      );
      map.addControl(
        new maplibre.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: false,
            timeout: GEOLOCATION_TIMEOUT_MS,
            maximumAge: GEOLOCATION_MAX_AGE_MS,
          },
          trackUserLocation: false,
          showUserLocation: true,
          showAccuracyCircle: false,
          fitBoundsOptions: {
            maxZoom: CURRENT_LOCATION_ZOOM,
            duration: 700,
          },
        }),
        "top-left",
      );

      const handleAreaClick = (event: import("maplibre-gl").MapLayerMouseEvent) => {
        const clickedName = event.features?.[0]?.properties?.name;
        if (typeof clickedName !== "string" || clickedName.trim().length === 0) {
          return;
        }

        onAreaSelectRef.current?.(clickedName);
      };

      const handleAreaMouseEnter = () => {
        map.getCanvas().style.cursor = "pointer";
      };

      const handleAreaMouseLeave = () => {
        map.getCanvas().style.cursor = "";
      };

      map.once("load", () => {
        ensureAreaLayers(map);
        map.on("click", AREA_FILL_LAYER_ID, handleAreaClick);
        map.on("mouseenter", AREA_FILL_LAYER_ID, handleAreaMouseEnter);
        map.on("mouseleave", AREA_FILL_LAYER_ID, handleAreaMouseLeave);
      });

      map.on("remove", () => {
        map.off("click", AREA_FILL_LAYER_ID, handleAreaClick);
        map.off("mouseenter", AREA_FILL_LAYER_ID, handleAreaMouseEnter);
        map.off("mouseleave", AREA_FILL_LAYER_ID, handleAreaMouseLeave);
      });

      const handleResize = () => {
        map.resize();
      };

      window.addEventListener("resize", handleResize);
      removeResizeListener = () => {
        window.removeEventListener("resize", handleResize);
      };

      mapRef.current = map;
    }

    void initializeMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      removeResizeListener?.();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;

    if (!map || !maplibre) {
      return;
    }

    const syncAreas = () => {
      const resolvedAreas = resolveAreas(areas);
      const selectedArea =
        selectedAreaName !== "all"
          ? resolvedAreas.find((area) => area.name === selectedAreaName) || null
          : null;

      ensureAreaLayers(map);
      const source = map.getSource(AREA_SOURCE_ID) as GeoJsonSource | undefined;
      source?.setData(areaFeatureCollection(resolvedAreas, selectedAreaName) as never);

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      if (map.getLayer(AREA_FILL_LAYER_ID)) {
        map.setPaintProperty(AREA_FILL_LAYER_ID, "fill-color", [
          "case",
          ["==", ["get", "is_selected"], true],
          "#0f766e",
          "#14b8a6",
        ]);
        map.setPaintProperty(AREA_FILL_LAYER_ID, "fill-opacity", [
          "case",
          ["==", ["get", "is_selected"], true],
          0.22,
          0.12,
        ]);
      }

      if (map.getLayer(AREA_LINE_LAYER_ID)) {
        map.setPaintProperty(AREA_LINE_LAYER_ID, "line-color", [
          "case",
          ["==", ["get", "is_selected"], true],
          "#0f766e",
          "#0d9488",
        ]);
        map.setPaintProperty(AREA_LINE_LAYER_ID, "line-width", [
          "case",
          ["==", ["get", "is_selected"], true],
          3.2,
          2.3,
        ]);
      }

      if (resolvedAreas.length === 0) {
        map.easeTo({
          center: toLngLat(DEFAULT_CENTER),
          zoom: DEFAULT_ZOOM,
          duration: 500,
        });
        return;
      }

      const bounds = new maplibre.LngLatBounds();
      const boundsAreas = selectedArea ? [selectedArea] : resolvedAreas;

      boundsAreas.forEach((area) => {
        area.boundary.forEach((point) => {
          bounds.extend(toLngLat(point));
        });
      });

      resolvedAreas.forEach((area) => {
        const isSelected = !!selectedArea && area.name === selectedArea.name;

        const marker = new maplibre.Marker({
          element: createAreaLabelElement(area.name, isSelected, onAreaSelectRef.current),
          anchor: "center",
        })
          .setLngLat(toLngLat(area.center))
          .addTo(map);

        markersRef.current.push(marker);
      });

      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: MAX_FIT_ZOOM,
        duration: 700,
      });
    };

    if (!map.isStyleLoaded()) {
      map.once("load", syncAreas);
      return;
    }

    syncAreas();
  }, [areas, selectedAreaName]);

  return (
    <div className="h-[24rem] w-full overflow-hidden rounded-xl border shadow-sm">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
