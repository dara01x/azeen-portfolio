"use client";

import { useEffect, useRef } from "react";
import type { Feature, FeatureCollection } from "geojson";
import type { AreaBoundaryPoint } from "@/modules/app-variables/types";

type MapLibreModule = typeof import("maplibre-gl");
type MapLibreMap = import("maplibre-gl").Map;
type MapLibreMarker = import("maplibre-gl").Marker;
type GeoJsonSource = import("maplibre-gl").GeoJSONSource;
type MapLibreStyle = import("maplibre-gl").StyleSpecification;

const DEFAULT_CENTER = { lat: 36.1911, lng: 44.0092 };
const DEFAULT_ZOOM = 11;
const SINGLE_POINT_ZOOM = 14;
const SOURCE_ID = "area-boundary-source";
const FILL_LAYER_ID = "area-boundary-fill";
const LINE_LAYER_ID = "area-boundary-line";

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

function toLngLat(point: AreaBoundaryPoint): [number, number] {
  return [point.lng, point.lat];
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
  } as FeatureCollection;
}

function boundaryFeatureCollection(points: AreaBoundaryPoint[]) {
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

function createVertexMarkerElement(index: number, total: number) {
  const element = document.createElement("div");
  const isStart = index === 0;
  const isEnd = total > 1 && index === total - 1;

  element.style.width = "24px";
  element.style.height = "24px";
  element.style.borderRadius = "9999px";
  element.style.background = isEnd ? "#ea580c" : "#0f766e";
  element.style.color = "white";
  element.style.fontSize = "11px";
  element.style.fontWeight = "700";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.border = "2px solid #ccfbf1";
  element.style.boxShadow = "0 2px 10px rgba(15, 118, 110, 0.35)";
  element.style.userSelect = "none";
  element.innerText = isStart ? "S" : isEnd ? "E" : String(index + 1);
  element.title = isStart ? "Start point" : isEnd ? "End point" : `Point ${index + 1}`;
  return element;
}

function ensureBoundaryLayers(map: MapLibreMap) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: emptyFeatureCollection(),
    });
  }

  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": "#0f766e",
        "fill-opacity": 0.2,
      },
    });
  }

  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#0f766e",
        "line-width": 3,
        "line-opacity": 0.95,
      },
    });
  }
}

export function AreaBoundaryPickerMap({
  points,
  onChange,
}: {
  points: AreaBoundaryPoint[];
  onChange: (points: AreaBoundaryPoint[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const pointsRef = useRef(points);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
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

      map.addControl(new maplibre.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

      map.on("load", () => {
        ensureBoundaryLayers(map);
      });

      map.on("click", (event: import("maplibre-gl").MapMouseEvent) => {
        const nextPoint: AreaBoundaryPoint = {
          lat: Number(event.lngLat.lat.toFixed(6)),
          lng: Number(event.lngLat.lng.toFixed(6)),
        };

        onChangeRef.current([...pointsRef.current, nextPoint]);
      });

      const handleResize = () => {
        map.resize();
      };

      window.addEventListener("resize", handleResize);
      map.on("remove", () => {
        window.removeEventListener("resize", handleResize);
      });

      mapRef.current = map;
    }

    void initMap();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;

    if (!map || !maplibre) {
      return;
    }

    const syncBoundary = () => {
      ensureBoundaryLayers(map);

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      points.forEach((point, index) => {
        const marker = new maplibre.Marker({ element: createVertexMarkerElement(index, points.length) })
          .setLngLat(toLngLat(point))
          .addTo(map);

        markersRef.current.push(marker);
      });

      const source = map.getSource(SOURCE_ID) as GeoJsonSource | undefined;
      source?.setData(boundaryFeatureCollection(points) as never);

      if (points.length === 0) {
        map.easeTo({
          center: toLngLat(DEFAULT_CENTER),
          zoom: DEFAULT_ZOOM,
          duration: 500,
        });
        return;
      }

      if (points.length === 1) {
        map.easeTo({
          center: toLngLat(points[0]),
          zoom: SINGLE_POINT_ZOOM,
          duration: 500,
        });
        return;
      }

      const bounds = new maplibre.LngLatBounds();
      points.forEach((point) => bounds.extend(toLngLat(point)));
      map.fitBounds(bounds, {
        padding: 48,
        maxZoom: SINGLE_POINT_ZOOM,
        duration: 650,
      });
    };

    if (!map.isStyleLoaded()) {
      map.once("load", syncBoundary);
      return;
    }

    syncBoundary();
  }, [points]);

  return (
    <div className="h-[22rem] w-full overflow-hidden rounded-xl border shadow-sm">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
