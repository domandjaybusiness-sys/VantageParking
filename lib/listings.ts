export type Listing = {
  id: string;
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  pricePerHour: number;
  spots: number;
  status?: 'Active' | 'Paused';
};

let listings: Listing[] = [
  {
    id: '1',
    title: 'Downtown Lot A',
    address: 'Market St, San Francisco',
    latitude: 37.7749,
    longitude: -122.4194,
    pricePerHour: 8.5,
    spots: 10,
    status: 'Active',
  },
  {
    id: '2',
    title: 'Marina Garage',
    address: 'Marina District, San Francisco',
    latitude: 37.805,
    longitude: -122.41,
    pricePerHour: 12.0,
    spots: 6,
    status: 'Active',
  },
];

type Listener = (items: Listing[]) => void;
const listeners: Listener[] = [];

export function getListings() {
  return listings.slice();
}

export function subscribe(fn: Listener) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function addListing(item: Listing) {
  listings = [...listings, item];
  listeners.forEach((l) => l(getListings()));
}

export function updateListing(id: string, patch: Partial<Listing>) {
  listings = listings.map((it) => (it.id === id ? { ...it, ...patch } : it));
  listeners.forEach((l) => l(getListings()));
}

export function deleteListing(id: string) {
  listings = listings.filter((it) => it.id !== id);
  listeners.forEach((l) => l(getListings()));
}
