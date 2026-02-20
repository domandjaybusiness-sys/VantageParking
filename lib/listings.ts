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
  const latRaw = row?.lat ?? row?.latitude ?? null;
  const lngRaw = row?.lng ?? row?.longitude ?? null;
  const lat = typeof latRaw === 'number' ? latRaw : (typeof latRaw === 'string' ? parseFloat(latRaw) : null);
  const lng = typeof lngRaw === 'number' ? lngRaw : (typeof lngRaw === 'string' ? parseFloat(lngRaw) : null);

  return {
    id: String(row?.id ?? ''),
    title: row?.title ?? row?.name ?? row?.address ?? 'Parking Spot',
    address: row?.address ?? row?.location ?? 'Unknown address',
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    hostId: row?.host_id ?? row?.hostId ?? null,
    pricePerHour: Number(row?.price_per_hour ?? row?.pricePerHour ?? row?.price ?? 0),
    spots: Number(row?.spots ?? 1),
    status: row?.status ?? 'Active',
  };
}
