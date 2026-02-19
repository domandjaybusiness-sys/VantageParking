export type Listing = {
  id: string;
  title: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  pricePerHour: number;
  spots?: number;
  status?: 'Active' | 'Paused';
};

export function mapSpotRow(row: any): Listing {
  const lat = row?.lat ?? row?.latitude ?? null;
  const lng = row?.lng ?? row?.longitude ?? null;

  return {
    id: String(row?.id ?? ''),
    title: row?.title ?? row?.name ?? row?.address ?? 'Parking Spot',
    address: row?.address ?? row?.location ?? 'Unknown address',
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lng === 'number' ? lng : null,
    pricePerHour: Number(row?.price_per_hour ?? row?.pricePerHour ?? row?.price ?? 0),
    spots: Number(row?.spots ?? 1),
    status: row?.status ?? 'Active',
  };
}
