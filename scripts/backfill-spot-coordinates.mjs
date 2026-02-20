import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function geocodeAddress(address) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  const feature = json?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

async function run() {
  const { data: spots, error } = await supabase
    .from('spots')
    .select('id, title, address, lat, lng')
    .or('lat.is.null,lng.is.null');

  if (error) {
    console.error('Failed to fetch spots:', error.message);
    process.exit(1);
  }

  if (!spots || spots.length === 0) {
    console.log('No spots missing coordinates.');
    return;
  }

  console.log(`Found ${spots.length} spots missing coordinates.`);

  for (const spot of spots) {
    const address = spot.address || spot.title;
    if (!address) {
      console.warn(`Skipping ${spot.id}: missing address.`);
      continue;
    }

    const coords = await geocodeAddress(address);
    if (!coords) {
      console.warn(`No geocode result for ${spot.id}: ${address}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('spots')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', spot.id);

    if (updateError) {
      console.warn(`Update failed for ${spot.id}: ${updateError.message}`);
    } else {
      console.log(`Updated ${spot.id} -> ${coords.lat}, ${coords.lng}`);
    }

    await sleep(350); // be nice to the free geocoder
  }
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
