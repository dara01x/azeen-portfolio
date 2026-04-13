export type MapCoordinates = {
  lat: number;
  lng: number;
};

// Duhok city center fallback for maps when no explicit location is available.
export const DUHOK_DEFAULT_CENTER: MapCoordinates = {
  lat: 36.8656,
  lng: 42.9885,
};
