import { createClient } from '@supabase/supabase-js';
import type {
  BID,
  OZTract,
  Place,
  GeoJSONGeometry,
} from '../features/ecosystem/PlaceGraph.types';

// Database schema types for Supabase
export interface Database {
  public: {
    Tables: {
      bids: {
        Row: BID;
        Insert: Omit<BID, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<BID, 'id' | 'created_at'>>;
      };
      oz_tracts: {
        Row: OZTract;
        Insert: Omit<OZTract, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<OZTract, 'id' | 'created_at'>>;
      };
      places: {
        Row: Place;
        Insert: Omit<Place, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Place, 'id' | 'created_at'>>;
      };
    };
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Frontend Supabase queries will be unavailable. ' +
    'SOLO features use the backend API and are unaffected.'
  );
}

// Use a placeholder URL when vars are missing to prevent createClient from throwing.
// SOLO sandbox features all go through the backend API (server/lib/supabase.js),
// so the frontend client is only used by legacy BID features.
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Re-export domain types for convenience
export type { BID, OZTract, Place, GeoJSONGeometry };
