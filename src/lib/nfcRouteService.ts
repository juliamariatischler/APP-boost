import { supabase } from '@/integrations/supabase/client';

export interface NfcRoute {
  id: string;
  name: string;
  description: string | null;
  points_reward: number;
  active: boolean;
  week_start: string | null;
  image_url: string | null;
  ends_at: string | null;
}

export interface NfcStation {
  id: string;
  route_id: string;
  name: string;
  nfc_tag_id: string;
  station_order: number;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  image_url: string | null;
}

export type NfcRouteWithStations = NfcRoute & { stations: NfcStation[] };

export interface NfcRouteProgress {
  scanned_count: number;
  total_count: number;
  is_complete: boolean;
  scanned_station_ids: string[];
}

export type NfcScanStatus = 'scanned' | 'complete' | 'already_complete' | 'duplicate';

export interface NfcScanResponse {
  status?: NfcScanStatus;
  route_name?: string;
  station_name?: string;
  scanned_count?: number;
  total_count?: number;
  points_reward?: number;
  error?: string;
}

/** Loads the most-recently-started active NFC route including its stations. */
export async function getActiveRoute(): Promise<NfcRouteWithStations | null> {
  const { data, error } = await (supabase.from('nfc_routes') as any)
    .select('id, name, description, points_reward, active, week_start, image_url, ends_at, nfc_stations(id, route_id, name, nfc_tag_id, station_order, description, latitude, longitude, google_maps_url, image_url)')
    .eq('active', true)
    .order('week_start', { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0];
  const stations: NfcStation[] = ((row.nfc_stations ?? []) as NfcStation[])
    .slice()
    .sort((a, b) => a.station_order - b.station_order);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    points_reward: row.points_reward,
    active: row.active,
    week_start: row.week_start ?? null,
    image_url: row.image_url ?? null,
    ends_at: row.ends_at ?? null,
    stations,
  };
}

/**
 * Returns the scan progress for a given route and scanner.
 * Pass deviceId + sessionToken for code-auth students; omit for Supabase-auth users.
 */
export async function getRouteProgress(
  routeId: string,
  deviceId?: string,
  sessionToken?: string,
): Promise<NfcRouteProgress> {
  const { data } = await (supabase as any).rpc('get_nfc_route_progress', {
    p_route_id: routeId,
    p_device_id: deviceId ?? null,
    p_session_token: sessionToken ?? null,
  });

  return (data as NfcRouteProgress) ?? {
    scanned_count: 0,
    total_count: 0,
    is_complete: false,
    scanned_station_ids: [],
  };
}

/**
 * Records an NFC scan server-side and returns the scan status.
 * The server validates the tag, prevents duplicates, and marks the route
 * complete only when every required station has been scanned.
 */
export async function recordNfcScan(
  tagId: string,
  deviceId?: string,
  sessionToken?: string,
): Promise<NfcScanResponse> {
  const { data, error } = await (supabase as any).rpc('record_nfc_scan', {
    p_nfc_tag_id: tagId,
    p_device_id: deviceId ?? null,
    p_session_token: sessionToken ?? null,
  });

  if (error) return { error: error.message };
  return (data as NfcScanResponse) ?? { error: 'Unbekannter Fehler.' };
}
