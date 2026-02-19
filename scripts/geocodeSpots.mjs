import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

if (!globalThis.fetch) {
  const { fetch } = await import("undici");
  globalThis.fetch = fetch;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const rows = [
  { title: "Ferry Building Spot", address: "1 Ferry Building", city: "San Francisco", state: "CA", zip: "94111" },
  { title: "425 Market Spot", address: "425 Market St", city: "San Francisco", state: "CA", zip: "94105" },
  { title: "101 California Spot", address: "101 California St", city: "San Francisco", state: "CA", zip: "94111" },
  { title: "201 Spear Spot", address: "201 Spear St", city: "San Francisco", state: "CA", zip: "94105" },
  { title: "535 Mission Spot", address: "535 Mission St", city: "San Francisco", state: "CA", zip: "94105" },
  { title: "135 4th Spot", address: "135 4th St", city: "San Francisco", state: "CA", zip: "94103" },
  { title: "865 Market Spot", address: "865 Market St", city: "San Francisco", state: "CA", zip: "94103" },
  { title: "1 Powell Spot", address: "1 Powell St", city: "San Francisco", state: "CA", zip: "94102" },
  { title: "100 Van Ness Spot", address: "100 Van Ness Ave", city: "San Francisco", state: "CA", zip: "94102" },
  { title: "Mission Bay North Spot", address: "601 Mission Bay Blvd N", city: "San Francisco", state: "CA", zip: "94158" },
  { title: "Terry Francois Spot", address: "500 Terry A Francois Blvd", city: "San Francisco", state: "CA", zip: "94158" },
  { title: "170 King Spot", address: "170 King St", city: "San Francisco", state: "CA", zip: "94107" },
  { title: "2 Townsend Spot", address: "2 Townsend St", city: "San Francisco", state: "CA", zip: "94107" },
  { title: "550 16th Spot", address: "550 16th St", city: "San Francisco", state: "CA", zip: "94158" },
  { title: "1000 3rd Spot", address: "1000 3rd St", city: "San Francisco", state: "CA", zip: "94158" },
  { title: "155 9th Spot", address: "155 9th St", city: "San Francisco", state: "CA", zip: "94103" },
  { title: "345 Stockton Spot", address: "345 Stockton St", city: "San Francisco", state: "CA", zip: "94108" },
  { title: "799 Market Spot", address: "799 Market St", city: "San Francisco", state: "CA", zip: "94103" },
  { title: "Owens Spot", address: "1800 Owens St", city: "San Francisco", state: "CA", zip: "94158" },
  { title: "700 4th Spot", address: "700 4th St", city: "San Francisco", state: "CA", zip: "94107" },
];

async function geocode(fullAddress) {
  const url =
    "https://photon.komoot.io/api/?q=" +
    encodeURIComponent(fullAddress) +
    "&limit=1&lang=en";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      const feature = data?.features?.[0];
      const coords = feature?.geometry?.coordinates;
      const lng = Array.isArray(coords) ? coords[0] : null;
      const lat = Array.isArray(coords) ? coords[1] : null;

      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng };
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
  }

  throw new Error(`Geocoding failed for ${fullAddress}`);
}

async function run() {
  for (const r of rows) {
    const full = `${r.address}, ${r.city}, ${r.state} ${r.zip}`;
    console.log("Geocoding:", full);

    const { lat, lng } = await geocode(full);

    // Update the row you already inserted (match by title + address fragment)
    const { data: matches, error: matchError } = await supabase
      .from("spots")
      .select("id, title, address")
      .eq("title", r.title)
      .ilike("address", `%${r.address}%`);

    if (matchError) {
      console.error("Lookup failed:", r.title, matchError.message);
      continue;
    }

    let rowsToUpdate = matches || [];

    if (rowsToUpdate.length === 0) {
      const { data: titleMatches, error: titleError } = await supabase
        .from("spots")
        .select("id, title, address")
        .eq("title", r.title);

      if (titleError) {
        console.error("Title lookup failed:", r.title, titleError.message);
        continue;
      }

      if (titleMatches && titleMatches.length === 1) {
        rowsToUpdate = titleMatches;
      } else {
        console.warn("No unique match for:", r.title, r.address);
        continue;
      }
    }

    for (const row of rowsToUpdate) {
      const { error } = await supabase
        .from("spots")
        .update({ lat, lng })
        .eq("id", row.id);

      if (error) {
        console.error("Update failed:", r.title, error.message);
      } else {
        console.log("Updated:", r.title, row.id, lat, lng);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  console.log("Done.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
