import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { BID, GeoJSONGeometry, MapLayer, OZTract, Place, PlaceGraphProps, Role } from './PlaceGraph.types';
import { useBIDs, useOZTracts, usePlaces, usePlaceGraphControls, usePlaceGraphEnv } from './PlaceGraph.hooks';

const LAYER_LABELS: Record<MapLayer, string> = {
  bids: 'BID Boundaries',
  oz_tracts: 'OZ Tracts',
  places: 'Sites',
};

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'bid_director', label: 'BID Director' },
  { value: 'oz_manager', label: 'OZ Manager' },
  { value: 'construction_bd', label: 'Construction BD' },
  { value: 'attraction_bd', label: 'Attraction BD' },
  { value: 'developer', label: 'Developer' },
];

// Layer colors
const COLORS = {
  bids: '#1e3a5f',      // navy
  oz_tracts: '#10b981', // green
  places: '#f97316',    // orange
};

// Convert domain objects to GeoJSON FeatureCollection
function toFeatureCollection<T extends { id: string }>(
  items: T[],
  getGeometry: (item: T) => GeoJSONGeometry | null
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: items
      .map((item) => {
        const geometry = getGeometry(item);
        if (!geometry) return null;
        return {
          type: 'Feature' as const,
          id: item.id,
          properties: { ...item, boundary: undefined, geometry: undefined },
          geometry,
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null),
  };
}

export function PlaceGraph(props: PlaceGraphProps) {
  const { mapboxToken } = usePlaceGraphEnv();
  const { role, setRole, layers, toggleLayer, center, zoom } = usePlaceGraphControls(props);

  // Fetch live data from Supabase
  const { data: bids, loading: bidsLoading, error: bidsError } = useBIDs();
  const { data: ozTracts, loading: ozLoading, error: ozError } = useOZTracts();
  const { data: places, loading: placesLoading, error: placesError } = usePlaces();

  const isLoading = bidsLoading || ozLoading || placesLoading;
  const hasError = bidsError || ozError || placesError;

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken) return;
    if (mapRef.current) return; // already initialized

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: center,
      zoom: zoom,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [mapboxToken]); // only re-init if token changes

  // Add/update data sources and layers once map is ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // BID boundaries source + layer
    const bidGeoJSON = toFeatureCollection(bids, (b) => b.boundary);
    if (map.getSource('bids-source')) {
      (map.getSource('bids-source') as mapboxgl.GeoJSONSource).setData(bidGeoJSON);
    } else {
      map.addSource('bids-source', { type: 'geojson', data: bidGeoJSON });
      map.addLayer({
        id: 'bids-layer',
        type: 'line',
        source: 'bids-source',
        paint: {
          'line-color': COLORS.bids,
          'line-width': 2,
        },
      });
    }

    // OZ tracts source + layer
    const ozGeoJSON = toFeatureCollection(ozTracts, (o) => o.boundary);
    if (map.getSource('oz-source')) {
      (map.getSource('oz-source') as mapboxgl.GeoJSONSource).setData(ozGeoJSON);
    } else {
      map.addSource('oz-source', { type: 'geojson', data: ozGeoJSON });
      map.addLayer({
        id: 'oz-layer',
        type: 'fill',
        source: 'oz-source',
        paint: {
          'fill-color': COLORS.oz_tracts,
          'fill-opacity': 0.2,
        },
      });
      // Add outline for OZ tracts
      map.addLayer({
        id: 'oz-layer-outline',
        type: 'line',
        source: 'oz-source',
        paint: {
          'line-color': COLORS.oz_tracts,
          'line-width': 1,
        },
      });
    }

    // Places source + layer
    const placesGeoJSON = toFeatureCollection(places, (p) => p.geometry);
    if (map.getSource('places-source')) {
      (map.getSource('places-source') as mapboxgl.GeoJSONSource).setData(placesGeoJSON);
    } else {
      map.addSource('places-source', { type: 'geojson', data: placesGeoJSON });
      map.addLayer({
        id: 'places-layer',
        type: 'circle',
        source: 'places-source',
        paint: {
          'circle-color': COLORS.places,
          'circle-radius': 8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }
  }, [mapReady, bids, ozTracts, places]);

  // Toggle layer visibility based on UI controls
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const setVisibility = (layerId: string, visible: boolean) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVisibility('bids-layer', layers.bids);
    setVisibility('oz-layer', layers.oz_tracts);
    setVisibility('oz-layer-outline', layers.oz_tracts);
    setVisibility('places-layer', layers.places);
  }, [mapReady, layers]);

  return (
    <div className={`container mx-auto px-4 py-6 max-w-7xl ${props.className ?? ''}`}>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">PlaceGraph</h1>
            <p className="text-sm text-gray-600 mt-1">
              Interactive map of BID boundaries, Opportunity Zone tracts, and development sites.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              {(Object.keys(LAYER_LABELS) as MapLayer[]).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => toggleLayer(layer)}
                  className={
                    `px-3 py-2 text-sm font-medium transition-colors ` +
                    (layers[layer]
                      ? 'bg-primary-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50')
                  }
                >
                  {LAYER_LABELS[layer]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-800">Map</div>
                {isLoading && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-xs text-gray-500">Loading data...</span>
                  </div>
                )}
                {hasError && (
                  <span className="text-xs text-red-600">Error loading data</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {bids.length} BIDs • {ozTracts.length} OZ • {places.length} places
              </div>
            </div>

            {!mapboxToken ? (
              <div className="h-[560px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="max-w-md text-center px-6">
                  <div className="text-sm font-semibold text-gray-800">Mapbox token required</div>
                  <div className="mt-2 text-sm text-gray-600">
                    Set <span className="font-mono">VITE_MAPBOX_TOKEN</span> in your .env file.
                  </div>
                </div>
              </div>
            ) : (
              <div ref={mapContainerRef} className="h-[560px]" />
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="text-sm font-medium text-gray-800 mb-3">Legend</div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5" style={{ backgroundColor: COLORS.bids }} />
                <span className="text-gray-700">BID Boundaries</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.oz_tracts, opacity: 0.2, border: `1px solid ${COLORS.oz_tracts}` }} />
                <span className="text-gray-700">OZ Tracts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.places, border: '2px solid white', boxShadow: '0 0 0 1px #ccc' }} />
                <span className="text-gray-700">Places</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800">Details</div>
              <div className="text-xs text-gray-500">(placeholder)</div>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-700">
                Select a polygon/site on the map to show details here.
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="text-xs font-semibold text-gray-700">Future content</div>
                <div className="mt-1 text-xs text-gray-600">
                  BID contact, tract metadata, place status, stakeholders, and recommended actions.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default PlaceGraph;
