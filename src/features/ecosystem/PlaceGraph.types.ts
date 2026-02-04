// Minimal GeoJSON types (install 'geojson' package for full types)
export type GeoJSONGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

// Domain types aligned to Supabase schema
export type MapLayer = 'bids' | 'oz_tracts' | 'places';

export type Role =
  | 'bid_director'
  | 'oz_manager'
  | 'construction_bd'
  | 'attraction_bd'
  | 'developer';

export type PlaceStatus = 'prospect' | 'active' | 'closed' | 'available';

export type PlaceType = 'site' | 'project' | 'parcel' | 'attraction';

export interface BID {
  id: string;
  name: string;
  city: string;
  state: string;
  boundary: GeoJSONGeometry;
  contact_name: string | null;
  contact_email: string | null;
  annual_budget: number | null;
  priority_sectors: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OZTract {
  id: string;
  tract_id: string;
  state_fips: string;
  county_fips: string;
  boundary: GeoJSONGeometry;
  designation_date: string | null;
  expiration_date: string | null;
  invested_capital: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  status: PlaceStatus;
  geometry: GeoJSONGeometry;
  address: string | null;
  developer: string | null;
  estimated_value: number | null;
  oz_eligible: boolean;
  metadata: Record<string, unknown> | null;
  bid_id: string | null;
  oz_tract_id: string | null;
  created_at: string;
  updated_at: string;
}

export type LayerVisibility = Record<MapLayer, boolean>;

export interface PlaceGraphProps {
  className?: string;
  initial_center?: [number, number]; // [lng, lat], default [-73.64, 40.74]
  initial_zoom?: number; // default 12
  initial_role?: Role;
  initial_layers?: Partial<LayerVisibility>;
  bids?: BID[];
  ozTracts?: OZTract[];
  places?: Place[];
}
