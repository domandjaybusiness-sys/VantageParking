import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

if (!globalThis.fetch) {
  const { fetch } = await import('undici');
  globalThis.fetch = fetch;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 20 sample spots with small random-ish offsets around Shelton center
const rows = [
  { title: 'Shelton — Bridge St Driveway', address: '45 Bridge St, Shelton, CT', latitude: 41.3172, longitude: -73.0941, price_per_hour: 3.5 },
  { title: 'Shelton — Main St Garage', address: '12 Main St, Shelton, CT', latitude: 41.3159, longitude: -73.0923, price_per_hour: 4.0 },
  { title: 'Shelton — River Rd Lot', address: '200 River Rd, Shelton, CT', latitude: 41.3190, longitude: -73.0950, price_per_hour: 2.5 },
  { title: 'Shelton — Chapel St Spot', address: '8 Chapel St, Shelton, CT', latitude: 41.3145, longitude: -73.0908, price_per_hour: 3.0 },
  { title: 'Shelton — Barn Hill Parking', address: '60 Barn Hill Rd, Shelton, CT', latitude: 41.3201, longitude: -73.0938, price_per_hour: 4.5 },
  { title: 'Shelton — Riverwalk Driveway', address: '10 Riverwalk, Shelton, CT', latitude: 41.3168, longitude: -73.0899, price_per_hour: 3.0 },
  { title: 'Shelton — Elm St Spot', address: '22 Elm St, Shelton, CT', latitude: 41.3139, longitude: -73.0949, price_per_hour: 2.75 },
  { title: 'Shelton — Canal St Garage', address: '5 Canal St, Shelton, CT', latitude: 41.3182, longitude: -73.0915, price_per_hour: 4.25 },
  { title: 'Shelton — Washington Ave Lot', address: '100 Washington Ave, Shelton, CT', latitude: 41.3198, longitude: -73.0890, price_per_hour: 3.75 },
  { title: 'Shelton — Prospect St Driveway', address: '28 Prospect St, Shelton, CT', latitude: 41.3148, longitude: -73.0962, price_per_hour: 2.5 },
  { title: 'Shelton — Meadow Ln Spot', address: '3 Meadow Ln, Shelton, CT', latitude: 41.3175, longitude: -73.0971, price_per_hour: 3.0 },
  { title: 'Shelton — Maple Ave Garage', address: '77 Maple Ave, Shelton, CT', latitude: 41.3152, longitude: -73.0886, price_per_hour: 4.0 },
  { title: 'Shelton — Walnut St Lot', address: '9 Walnut St, Shelton, CT', latitude: 41.3161, longitude: -73.0958, price_per_hour: 2.25 },
  { title: 'Shelton — Pine St Driveway', address: '41 Pine St, Shelton, CT', latitude: 41.3187, longitude: -73.0928, price_per_hour: 3.5 },
  { title: 'Shelton — Chapel View Spot', address: '14 Chapel View, Shelton, CT', latitude: 41.3135, longitude: -73.0912, price_per_hour: 2.75 },
  { title: 'Shelton — Center St Garage', address: '88 Center St, Shelton, CT', latitude: 41.3210, longitude: -73.0945, price_per_hour: 4.5 },
  { title: 'Shelton — Oakwood Lot', address: '2 Oakwood Ave, Shelton, CT', latitude: 41.3129, longitude: -73.0935, price_per_hour: 3.0 },
  { title: 'Shelton — Harbor Rd Spot', address: '150 Harbor Rd, Shelton, CT', latitude: 41.3192, longitude: -73.0977, price_per_hour: 3.75 },
  { title: 'Shelton — Hillside Driveway', address: '60 Hillside Ave, Shelton, CT', latitude: 41.3141, longitude: -73.0900, price_per_hour: 2.5 },
  { title: 'Shelton — South St Lot', address: '5 South St, Shelton, CT', latitude: 41.3165, longitude: -73.0985, price_per_hour: 3.25 },
];

async function run() {
  console.log('Inserting', rows.length, 'spots into Supabase');
  const { data, error } = await supabase.from('spots').insert(rows).select('id,title,address,latitude,longitude');
  if (error) {
    console.error('Insert failed:', error.message || error);
    process.exit(1);
  }
  console.log('Inserted rows:');
  console.table(data);
  process.exit(0);
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
