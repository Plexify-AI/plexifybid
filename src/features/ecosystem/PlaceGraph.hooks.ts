import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BID, GeoJSONGeometry, LayerVisibility, MapLayer, OZTract, Place, PlaceGraphProps, Role } from './PlaceGraph.types';
import { supabase } from '../../lib/supabase';

const DEFAULT_CENTER: [number, number] = [-73.64, 40.74]; // Long Island
const DEFAULT_ZOOM = 12;
const DEFAULT_ROLE: Role = 'bid_director';
const DEFAULT_LAYERS: LayerVisibility = {
  bids: true,
  oz_tracts: true,
  places: true,
};

/**
 * Reads Mapbox token from environment, warns if missing
 */
export function usePlaceGraphEnv() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  useEffect(() => {
    if (!mapboxToken) {
      console.warn('[PlaceGraph] VITE_MAPBOX_TOKEN not set. Map will not render.');
    }
  }, [mapboxToken]);

  return { mapboxToken: mapboxToken ?? null };
}

/**
 * Manages role state, layer visibility toggles, and map center/zoom
 */
export function usePlaceGraphControls(props: PlaceGraphProps) {
  const [role, setRole] = useState<Role>(props.initial_role ?? DEFAULT_ROLE);
  const [layers, setLayers] = useState<LayerVisibility>({
    ...DEFAULT_LAYERS,
    ...props.initial_layers,
  });
  const [center, setCenter] = useState<[number, number]>(
    props.initial_center ?? DEFAULT_CENTER
  );
  const [zoom, setZoom] = useState<number>(props.initial_zoom ?? DEFAULT_ZOOM);

  const toggleLayer = useCallback((layer: MapLayer) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const setLayerVisibility = useCallback((layer: MapLayer, visible: boolean) => {
    setLayers((prev) => ({ ...prev, [layer]: visible }));
  }, []);

  const resetView = useCallback(() => {
    setCenter(props.initial_center ?? DEFAULT_CENTER);
    setZoom(props.initial_zoom ?? DEFAULT_ZOOM);
  }, [props.initial_center, props.initial_zoom]);

  return {
    role,
    setRole,
    layers,
    toggleLayer,
    setLayerVisibility,
    center,
    setCenter,
    zoom,
    setZoom,
    resetView,
  };
}

/**
 * Placeholder hook returning data arrays from props or empty arrays
 * TODO: Replace with Supabase queries once backend is wired
 */
export function usePlaceGraphData(props: PlaceGraphProps) {
  const bids: BID[] = useMemo(() => props.bids ?? [], [props.bids]);
  const ozTracts: OZTract[] = useMemo(() => props.ozTracts ?? [], [props.ozTracts]);
  const places: Place[] = useMemo(() => props.places ?? [], [props.places]);

  return { bids, ozTracts, places };
}

// ------------------------------------------------------------
// Supabase Data Fetching Hooks
// ------------------------------------------------------------

/**
 * Parse geometry from Supabase (may be string or object)
 */
function parseGeometry(geo: unknown): GeoJSONGeometry | null {
  if (!geo) return null;
  if (typeof geo === 'string') {
    try {
      return JSON.parse(geo) as GeoJSONGeometry;
    } catch {
      console.warn('[PlaceGraph] Failed to parse geometry JSON:', geo);
      return null;
    }
  }
  return geo as GeoJSONGeometry;
}

interface FetchState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/**
 * Fetch all BIDs from Supabase
 */
export function useBIDs(): FetchState<BID> {
  const [state, setState] = useState<FetchState<BID>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchBIDs() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase
        .from('bids')
        .select('*');

      if (cancelled) return;

      if (error) {
        setState({ data: [], loading: false, error: new Error(error.message) });
        return;
      }

      const bids: BID[] = (data ?? []).map((row) => ({
        ...row,
        boundary: parseGeometry(row.boundary) as GeoJSONGeometry,
      }));

      setState({ data: bids, loading: false, error: null });
    }

    fetchBIDs();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Fetch all OZ Tracts from Supabase
 */
export function useOZTracts(): FetchState<OZTract> {
  const [state, setState] = useState<FetchState<OZTract>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchOZTracts() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase
        .from('oz_tracts')
        .select('*');

      if (cancelled) return;

      if (error) {
        setState({ data: [], loading: false, error: new Error(error.message) });
        return;
      }

      const tracts: OZTract[] = (data ?? []).map((row) => ({
        ...row,
        boundary: parseGeometry(row.boundary) as GeoJSONGeometry,
      }));

      setState({ data: tracts, loading: false, error: null });
    }

    fetchOZTracts();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/**
 * Fetch all Places from Supabase
 */
export function usePlaces(): FetchState<Place> {
  const [state, setState] = useState<FetchState<Place>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchPlaces() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase
        .from('places')
        .select('*');

      if (cancelled) return;

      if (error) {
        setState({ data: [], loading: false, error: new Error(error.message) });
        return;
      }

      const places: Place[] = (data ?? []).map((row) => ({
        ...row,
        geometry: parseGeometry(row.geometry) as GeoJSONGeometry,
      }));

      setState({ data: places, loading: false, error: null });
    }

    fetchPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
