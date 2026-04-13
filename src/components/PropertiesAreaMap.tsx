"use client";

import { useEffect, useRef, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { AreaBoundaryPoint } from "@/modules/app-variables/types";
import { DUHOK_DEFAULT_CENTER } from "@/lib/constants/map";

type MapLibreModule = typeof import("maplibre-gl");
type MapLibreMap = import("maplibre-gl").Map;
type MapLibreMarker = import("maplibre-gl").Marker;
type GeoJsonSource = import("maplibre-gl").GeoJSONSource;
type MapLibreStyle = import("maplibre-gl").StyleSpecification;

export type AreaMapPropertyPoint = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  propertyCode: string;
  priceLabel: string;
};

const DEFAULT_CENTER = DUHOK_DEFAULT_CENTER;
const DEFAULT_ZOOM = 11;
const SINGLE_POINT_ZOOM = 15;
const MARKER_COLOR = "#0f766e";
const AREA_SOURCE_ID = "selected-area-boundary-source";
const AREA_FILL_LAYER_ID = "selected-area-boundary-fill";
const AREA_LINE_LAYER_ID = "selected-area-boundary-line";

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

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection;
}

function areaBoundaryFeatureCollection(points: AreaBoundaryPoint[]) {
  const lineCoordinates = points.map((point) => toLngLat(point));
  const closedLineCoordinates =
    lineCoordinates.length >= 3 ? [...lineCoordinates, lineCoordinates[0]] : lineCoordinates;
  const features: Feature[] = [];

  if (lineCoordinates.length >= 2) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: closedLineCoordinates,
      },
    });
  }

  if (lineCoordinates.length >= 3) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[...lineCoordinates, lineCoordinates[0]]],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  } as FeatureCollection;
}

function ensureAreaBoundaryLayers(map: MapLibreMap) {
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
        "fill-opacity": 0.12,
      },
    });
  }

  if (!map.getLayer(AREA_LINE_LAYER_ID)) {
    map.addLayer({
      id: AREA_LINE_LAYER_ID,
      type: "line",
      source: AREA_SOURCE_ID,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#0f766e",
        "line-width": 3,
        "line-opacity": 0.9,
      },
    });
  }
}

function createPopupContent(point: AreaMapPropertyPoint): HTMLDivElement {
  const container = document.createElement("div");
  container.style.padding = "2px 0";
  container.style.minWidth = "170px";

  const link = document.createElement("a");
  link.href = `/properties/${point.id}`;
  link.style.display = "block";
  link.style.textDecoration = "none";
  link.style.color = "inherit";
  link.style.cursor = "pointer";

  const title = document.createElement("p");
  title.style.fontSize = "13px";
  title.style.fontWeight = "700";
  title.style.color = "#0f172a";
  title.style.margin = "0 0 4px 0";
  title.textContent = point.title;

  const code = document.createElement("p");
  code.style.fontSize = "11px";
  code.style.color = "#64748b";
  code.style.margin = "0";
  code.textContent = `Code: ${point.propertyCode}`;

  const price = document.createElement("p");
  price.style.fontSize = "11px";
  price.style.color = "#334155";
  price.style.margin = "2px 0 0 0";
  price.textContent = point.priceLabel;

  const coordinates = document.createElement("p");
  coordinates.style.fontSize = "11px";
  coordinates.style.color = "#64748b";
  coordinates.style.margin = "2px 0 0 0";
  coordinates.textContent = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

  link.appendChild(title);
  link.appendChild(code);
  link.appendChild(price);
  link.appendChild(coordinates);
  container.appendChild(link);

  return container;
}

export function PropertiesAreaMap({
  points,
  areaBoundary,
  focusCenter,
}: {
  points: AreaMapPropertyPoint[];
  areaBoundary?: AreaBoundaryPoint[];
  focusCenter?: AreaBoundaryPoint | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReadyTick, setMapReadyTick] = useState(0);

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

      map.once("load", () => {
        ensureAreaBoundaryLayers(map);
      });

      map.addControl(
        new maplibre.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: false }),
        "top-right",
      );

      const handleResize = () => {
        map.resize();
      };

      window.addEventListener("resize", handleResize);
      removeResizeListener = () => {
        window.removeEventListener("resize", handleResize);
      };

      mapRef.current = map;
      setMapReadyTick((value) => value + 1);
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

    const syncMapPoints = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const validPoints = points.filter(
        (point) => isFiniteNumber(point.lat) && isFiniteNumber(point.lng),
      );

      const validBoundary = (areaBoundary || []).filter(
        (point) => isFiniteNumber(point.lat) && isFiniteNumber(point.lng),
      );

      const validFocusCenter =
        focusCenter && isFiniteNumber(focusCenter.lat) && isFiniteNumber(focusCenter.lng)
          ? focusCenter
          : null;

      ensureAreaBoundaryLayers(map);
      const source = map.getSource(AREA_SOURCE_ID) as GeoJsonSource | undefined;
      source?.setData(areaBoundaryFeatureCollection(validBoundary) as never);

      if (validPoints.length === 0 && validBoundary.length === 0 && !validFocusCenter) {
        map.easeTo({
          center: toLngLat(DEFAULT_CENTER),
          zoom: DEFAULT_ZOOM,
          duration: 500,
        });
        return;
      }

      const bounds = new maplibre.LngLatBounds();
      const allAnchors: AreaBoundaryPoint[] = [];

      validBoundary.forEach((point) => {
        bounds.extend(toLngLat(point));
        allAnchors.push(point);
      });

      if (validFocusCenter) {
        bounds.extend(toLngLat(validFocusCenter));
        allAnchors.push(validFocusCenter);
      }

      validPoints.forEach((point) => {
        const marker = new maplibre.Marker({ color: MARKER_COLOR })
          .setLngLat(toLngLat(point))
          .setPopup(new maplibre.Popup({ offset: 18 }).setDOMContent(createPopupContent(point)))
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend(toLngLat(point));
        allAnchors.push({ lat: point.lat, lng: point.lng });
      });

      if (allAnchors.length === 1) {
        map.easeTo({
          center: toLngLat(allAnchors[0]),
          zoom: SINGLE_POINT_ZOOM,
          duration: 600,
        });
        return;
      }

      map.fitBounds(bounds, {
        padding: 64,
        maxZoom: SINGLE_POINT_ZOOM,
        duration: 700,
      });
    };

    if (!map.isStyleLoaded()) {
      map.once("load", syncMapPoints);
      return;
    }

    syncMapPoints();
  }, [points, areaBoundary, focusCenter, mapReadyTick]);

  return (
    <div className="h-[26rem] w-full overflow-hidden rounded-xl border shadow-sm">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
