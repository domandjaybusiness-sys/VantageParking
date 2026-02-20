export type Listing = {
  id: string;
  title: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  hostId?: string | null;
  pricePerHour: number;
  spots?: number;
  status?: 'Active' | 'Paused';
};

export function mapSpotRow(row: any): Listing {
  const latRaw = row?.lat ?? row?.latitude ?? row?.location_lat ?? row?.locationLat ?? row?.latitute ?? null;
  const lngRaw = row?.lng ?? row?.longitude ?? row?.lon ?? row?.long ?? row?.location_lng ?? row?.locationLng ?? null;
  const coordLat = row?.location?.lat ?? row?.location?.latitude ?? null;
  const coordLng = row?.location?.lng ?? row?.location?.longitude ?? null;
  const lat = typeof latRaw === 'number' ? latRaw : (typeof latRaw === 'string' ? parseFloat(latRaw) : null);
  const lng = typeof lngRaw === 'number' ? lngRaw : (typeof lngRaw === 'string' ? parseFloat(lngRaw) : null);
  const fallbackLat = typeof coordLat === 'number' ? coordLat : (typeof coordLat === 'string' ? parseFloat(coordLat) : null);
  const fallbackLng = typeof coordLng === 'number' ? coordLng : (typeof coordLng === 'string' ? parseFloat(coordLng) : null);

  return {
    id: String(row?.id ?? ''),
    title: row?.title ?? row?.name ?? row?.address ?? 'Parking Spot',
    address: row?.address ?? row?.location ?? 'Unknown address',
    latitude: Number.isFinite(lat) ? lat : (Number.isFinite(fallbackLat) ? fallbackLat : null),
    longitude: Number.isFinite(lng) ? lng : (Number.isFinite(fallbackLng) ? fallbackLng : null),
    hostId: row?.host_id ?? row?.hostId ?? null,
    pricePerHour: Number(row?.price_per_hour ?? row?.pricePerHour ?? row?.price ?? 0),
    spots: Number(row?.spots ?? 1),
    status: row?.status ?? 'Active',
  };
}
