import React, { useEffect } from 'react';
import type { MapLayer, PlaceGraphProps, Role } from './PlaceGraph.types';
import { usePlaceGraphControls, usePlaceGraphData, usePlaceGraphEnv } from './PlaceGraph.hooks';

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

export function PlaceGraph(props: PlaceGraphProps) {
  const { mapboxToken } = usePlaceGraphEnv();
  const { role, setRole, layers, toggleLayer, center, zoom } = usePlaceGraphControls(props);
  const { bids, ozTracts, places } = usePlaceGraphData(props);

  useEffect(() => {
    console.log('[PlaceGraph] init', { center, zoom, role, layers });
  }, [center, zoom, role, layers]);

  useEffect(() => {
    console.log('[PlaceGraph] data snapshot', {
      bids: bids.length,
      ozTracts: ozTracts.length,
      places: places.length,
    });
  }, [bids.length, ozTracts.length, places.length]);

  // TODO(after install): import 'mapbox-gl/dist/mapbox-gl.css'
  // TODO(after install): render actual map using mapbox-gl or react-map-gl

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
              <div className="text-sm font-medium text-gray-800">Map</div>
              <div className="text-xs text-gray-500">
                Center: {center[1].toFixed(2)}, {center[0].toFixed(2)} • Zoom {zoom}
              </div>
            </div>

            <div className="h-[560px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
              <div className="max-w-md text-center px-6">
                <div className="text-sm font-semibold text-gray-800">Map placeholder</div>
                <div className="mt-2 text-sm text-gray-600">
                  Install <span className="font-mono">mapbox-gl</span> (and optionally{' '}
                  <span className="font-mono">react-map-gl</span>) to render the interactive map.
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Token present: {mapboxToken ? 'yes' : 'no'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="text-sm font-medium text-gray-800">Layer render hooks (tomorrow)</div>
            <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Render BID boundaries from <span className="font-mono">bids</span> table</li>
              <li>Render OZ tracts from <span className="font-mono">oz_tracts</span> table</li>
              <li>Render sites/projects from <span className="font-mono">places</span> table</li>
            </ul>
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
