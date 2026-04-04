"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

type MapLibreModule = typeof import("maplibre-gl");
type MapLibreMap = import("maplibre-gl").Map;
type MapLibreMarker = import("maplibre-gl").Marker;
type MapLibreStyle = import("maplibre-gl").StyleSpecification;
type MapLibreControl = import("maplibre-gl").IControl;

export type PropertyCoordinates = {
  lat: number;
  lng: number;
};

const DEFAULT_CENTER: PropertyCoordinates = { lat: 36.1911, lng: 44.0092 };
const MARKER_COLOR = "#ef4444";
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 15;
const CURRENT_LOCATION_ZOOM = 16;
const DEFAULT_STYLE_ID = "street";
const GEOLOCATION_TIMEOUT_MS = 7000;
const GEOLOCATION_MAX_AGE_MS = 300000;
const GEOLOCATION_RETRY_DELAY_MS = 500;
const GEOLOCATION_WATCHDOG_MS = 900;

type BaseStyleOption = {
  id: string;
  name: string;
  style: MapLibreStyle;
};

function createRasterStyle({
  tiles,
  attribution,
  maxZoom = 19,
}: {
  tiles: string[];
  attribution: string;
  maxZoom?: number;
}): MapLibreStyle {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution,
        maxzoom: maxZoom,
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
}

const BASE_STYLES: BaseStyleOption[] = [
  {
    id: "street",
    name: "Street",
    style: createRasterStyle({
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }),
  },
  {
    id: "topographic",
    name: "Topographic",
    style: createRasterStyle({
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    }),
  },
  {
    id: "satellite",
    name: "Satellite",
    style: createRasterStyle({
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Tiles &copy; Esri",
    }),
  },
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toLngLat(coordinates: PropertyCoordinates): [number, number] {
  return [coordinates.lng, coordinates.lat];
}

function getBaseStyle(styleId: string) {
  return BASE_STYLES.find((style) => style.id === styleId) ?? BASE_STYLES[0];
}

function createBaseStyleControl(
  styleIdRef: MutableRefObject<string>,
  onSelectStyle: (styleId: string) => void,
): MapLibreControl {
  let container: HTMLDivElement | null = null;
  let select: HTMLSelectElement | null = null;

  const stopPropagation = (event: Event) => event.stopPropagation();

  return {
    onAdd() {
      container = document.createElement("div");
      container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      container.style.padding = "4px";
      container.style.borderRadius = "10px";
      container.style.background = "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)";
      container.style.boxShadow = "0 8px 18px rgba(15, 23, 42, 0.16)";

      select = document.createElement("select");
      select.setAttribute("aria-label", "Map style");
      select.style.height = "32px";
      select.style.minWidth = "118px";
      select.style.padding = "0 10px";
      select.style.border = "1px solid rgba(148, 163, 184, 0.55)";
      select.style.borderRadius = "8px";
      select.style.backgroundColor = "#ffffff";
      select.style.color = "#0f172a";
      select.style.fontSize = "12px";
      select.style.fontWeight = "600";
      select.style.outline = "none";
      select.style.cursor = "pointer";

      BASE_STYLES.forEach((style) => {
        const option = document.createElement("option");
        option.value = style.id;
        option.innerText = style.name;
        select?.appendChild(option);
      });

      select.value = styleIdRef.current;
      select.addEventListener("change", () => {
        if (!select) {
          return;
        }

        styleIdRef.current = select.value;
        onSelectStyle(select.value);
      });

      container.appendChild(select);
      container.addEventListener("click", stopPropagation);
      container.addEventListener("mousedown", stopPropagation);
      container.addEventListener("dblclick", stopPropagation);
      container.addEventListener("touchstart", stopPropagation, { passive: true });

      return container;
    },
    onRemove() {
      if (container?.parentNode) {
        container.parentNode.removeChild(container);
      }

      container = null;
      select = null;
    },
    getDefaultPosition() {
      return "top-right";
    },
  };
}

function MapLibreCanvas({
  coordinates,
  interactive,
  heightClass,
  onChange,
}: {
  coordinates: PropertyCoordinates | null;
  interactive: boolean;
  heightClass: string;
  onChange?: (coordinates: PropertyCoordinates) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const markerCoordinatesRef = useRef<PropertyCoordinates | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const styleIdRef = useRef(DEFAULT_STYLE_ID);
  const onChangeRef = useRef(onChange);

  const setMarkerPosition = (
    map: MapLibreMap,
    maplibre: MapLibreModule,
    nextCoordinates: PropertyCoordinates,
  ) => {
    const nextLngLat = toLngLat(nextCoordinates);
    markerCoordinatesRef.current = nextCoordinates;

    if (!markerRef.current) {
      markerRef.current = new maplibre.Marker({ color: MARKER_COLOR }).setLngLat(nextLngLat).addTo(map);
      return;
    }

    markerRef.current.setLngLat(nextLngLat);
  };

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let cleanupMap: (() => void) | undefined;

    async function init() {
      const container = containerRef.current;
      if (!container || mapRef.current) {
        return;
      }

      const maplibre: MapLibreModule = await import("maplibre-gl");
      if (cancelled) {
        return;
      }

      maplibreRef.current = maplibre;

      const center = coordinates ?? DEFAULT_CENTER;
      const map = new maplibre.Map({
        container,
        style: getBaseStyle(styleIdRef.current).style,
        center: toLngLat(center),
        zoom: coordinates ? SELECTED_ZOOM : DEFAULT_ZOOM,
        dragPan: interactive,
        scrollZoom: interactive,
        boxZoom: interactive,
        dragRotate: interactive,
        keyboard: interactive,
        doubleClickZoom: interactive,
        touchZoomRotate: interactive,
      });

      mapRef.current = map;

      const scaleControl = new maplibre.ScaleControl({
        unit: "metric",
        maxWidth: 110,
      });
      map.addControl(scaleControl, "bottom-left");

      map.once("load", () => {
        if (cancelled || !coordinates) {
          return;
        }

        setMarkerPosition(map, maplibre, coordinates);
      });

      if (interactive) {
        const navigationControl = new maplibre.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        });
        map.addControl(navigationControl, "top-right");

        const fullscreenControl = new maplibre.FullscreenControl();
        map.addControl(fullscreenControl, "top-left");

        const geolocateControl = new maplibre.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: false,
            timeout: GEOLOCATION_TIMEOUT_MS,
            maximumAge: GEOLOCATION_MAX_AGE_MS,
          },
          trackUserLocation: false,
          showUserLocation: false,
          showAccuracyCircle: false,
          fitBoundsOptions: {
            maxZoom: CURRENT_LOCATION_ZOOM,
            duration: 700,
          },
        });

        let geolocateRetryTimer: ReturnType<typeof setTimeout> | null = null;
        let geolocateWatchdogTimer: ReturnType<typeof setTimeout> | null = null;

        const clearGeolocateRetryTimer = () => {
          if (geolocateRetryTimer) {
            clearTimeout(geolocateRetryTimer);
            geolocateRetryTimer = null;
          }
        };

        const clearGeolocateWatchdogTimer = () => {
          if (geolocateWatchdogTimer) {
            clearTimeout(geolocateWatchdogTimer);
            geolocateWatchdogTimer = null;
          }
        };

        const applyDetectedLocation = (position: GeolocationPosition, centerMap = false) => {
          const nextCoordinates: PropertyCoordinates = {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          };

          setMarkerPosition(map, maplibre, nextCoordinates);

          if (centerMap) {
            map.easeTo({
              center: toLngLat(nextCoordinates),
              zoom: CURRENT_LOCATION_ZOOM,
              duration: 700,
            });
          }

          onChangeRef.current?.(nextCoordinates);
        };

        const runFallbackLocate = (attempt = 0) => {
          if (typeof navigator === "undefined" || !navigator.geolocation) {
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearGeolocateRetryTimer();
              clearGeolocateWatchdogTimer();
              applyDetectedLocation(position, true);
            },
            (error) => {
              const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
              const isCoreLocationUnknown =
                message.includes("kclerrorlocationunknown") || message.includes("locationunknown");
              const isPositionUnavailable = error.code === 2;

              if ((isCoreLocationUnknown || isPositionUnavailable) && attempt < 2) {
                clearGeolocateRetryTimer();
                geolocateRetryTimer = setTimeout(() => {
                  runFallbackLocate(attempt + 1);
                }, GEOLOCATION_RETRY_DELAY_MS);
              }
            },
            {
              enableHighAccuracy: false,
              timeout: GEOLOCATION_TIMEOUT_MS,
              maximumAge: GEOLOCATION_MAX_AGE_MS,
            },
          );
        };

        const handleGeolocate = (event: GeolocationPosition) => {
          clearGeolocateRetryTimer();
          clearGeolocateWatchdogTimer();
          applyDetectedLocation(event);
        };

        const handleGeolocateError = (error: { code?: number; message?: string }) => {
          clearGeolocateWatchdogTimer();
          const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
          const isCoreLocationUnknown =
            message.includes("kclerrorlocationunknown") || message.includes("locationunknown");
          const isPositionUnavailable = error.code === 2;

          if (isCoreLocationUnknown || isPositionUnavailable) {
            clearGeolocateRetryTimer();

            // CoreLocation unknown is often transient; retry shortly with relaxed settings.
            geolocateRetryTimer = setTimeout(() => {
              runFallbackLocate();
            }, GEOLOCATION_RETRY_DELAY_MS);

            return;
          }

          runFallbackLocate();
        };

        geolocateControl.on("geolocate", handleGeolocate);
        geolocateControl.on("error", handleGeolocateError);

        const geolocateButton = map
          .getContainer()
          .querySelector<HTMLButtonElement>(".maplibregl-ctrl-geolocate");

        const handleGeolocateButtonClick = () => {
          clearGeolocateWatchdogTimer();
          runFallbackLocate();
          geolocateWatchdogTimer = setTimeout(() => {
            runFallbackLocate();
          }, GEOLOCATION_WATCHDOG_MS);
        };

        geolocateButton?.addEventListener("click", handleGeolocateButtonClick);

        map.on("remove", () => {
          clearGeolocateRetryTimer();
          clearGeolocateWatchdogTimer();
          geolocateButton?.removeEventListener("click", handleGeolocateButtonClick);
          geolocateControl.off("geolocate", handleGeolocate);
          geolocateControl.off("error", handleGeolocateError);
        });

        map.addControl(geolocateControl, "top-left");

        const styleControl = createBaseStyleControl(styleIdRef, (nextStyleId) => {
          const nextStyle = getBaseStyle(nextStyleId);

          map.once("styledata", () => {
            const lastMarkerCoordinates = markerCoordinatesRef.current;

            if (markerRef.current) {
              markerRef.current.remove();
              markerRef.current = null;
            }

            if (!lastMarkerCoordinates) {
              return;
            }

            setMarkerPosition(map, maplibre, lastMarkerCoordinates);
          });

          map.setStyle(nextStyle.style, { diff: false });
        });
        map.addControl(styleControl, "top-right");

        map.on("click", (event: import("maplibre-gl").MapMouseEvent) => {
          if (!onChangeRef.current) {
            return;
          }

          const nextCoordinates: PropertyCoordinates = {
            lat: Number(event.lngLat.lat.toFixed(6)),
            lng: Number(event.lngLat.lng.toFixed(6)),
          };

          setMarkerPosition(map, maplibre, nextCoordinates);
          map.easeTo({
            center: toLngLat(nextCoordinates),
            zoom: SELECTED_ZOOM,
            duration: 600,
          });

          onChangeRef.current(nextCoordinates);
        });
      }

      let fullscreenResizeTimer: ReturnType<typeof setTimeout> | null = null;

      const handleWindowResize = () => {
        map.resize();
      };

      const handleFullscreenResize = () => {
        if (fullscreenResizeTimer) {
          clearTimeout(fullscreenResizeTimer);
        }

        fullscreenResizeTimer = setTimeout(() => {
          map.resize();
        }, 200);
      };

      window.addEventListener("resize", handleWindowResize);
      document.addEventListener("fullscreenchange", handleFullscreenResize);

      cleanupMap = () => {
        if (fullscreenResizeTimer) {
          clearTimeout(fullscreenResizeTimer);
          fullscreenResizeTimer = null;
        }

        window.removeEventListener("resize", handleWindowResize);
        document.removeEventListener("fullscreenchange", handleFullscreenResize);
        map.remove();
        mapRef.current = null;
        markerRef.current = null;
        markerCoordinatesRef.current = null;
        maplibreRef.current = null;
      };
    }

    void init();

    return () => {
      cancelled = true;
      cleanupMap?.();
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre) {
      return;
    }

    const syncCoordinates = () => {
      if (coordinates && isFiniteNumber(coordinates.lat) && isFiniteNumber(coordinates.lng)) {
        setMarkerPosition(map, maplibre, coordinates);
        map.easeTo({
          center: toLngLat(coordinates),
          zoom: SELECTED_ZOOM,
          duration: 600,
        });
        return;
      }

      markerCoordinatesRef.current = null;
      map.easeTo({
        center: toLngLat(DEFAULT_CENTER),
        zoom: DEFAULT_ZOOM,
        duration: 600,
      });

      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };

    if (!map.isStyleLoaded()) {
      map.once("load", syncCoordinates);
      return;
    }

    syncCoordinates();
  }, [coordinates?.lat, coordinates?.lng]);

  return (
    <div ref={shellRef} className={`${heightClass} w-full`}>
      <div ref={containerRef} className={`${heightClass} w-full`} />
    </div>
  );
}

export function PropertyLocationPickerMap({
  coordinates,
  onChange,
}: {
  coordinates: PropertyCoordinates | null;
  onChange: (coordinates: PropertyCoordinates) => void;
}) {
  return (
    <div className="h-[24rem] md:h-[30rem] w-full overflow-hidden rounded-xl border shadow-sm">
      <MapLibreCanvas
        coordinates={coordinates}
        interactive
        onChange={onChange}
        heightClass="h-[24rem] md:h-[30rem]"
      />
    </div>
  );
}

export function PropertyLocationPreviewMap({
  coordinates,
}: {
  coordinates: PropertyCoordinates | null;
}) {
  if (!coordinates) {
    return (
      <div className="h-72 md:h-80 w-full rounded-xl border bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
        No coordinates available.
      </div>
    );
  }

  return (
    <div className="h-72 md:h-80 w-full overflow-hidden rounded-xl border shadow-sm">
      <MapLibreCanvas coordinates={coordinates} interactive={false} heightClass="h-72 md:h-80" />
    </div>
  );
}
