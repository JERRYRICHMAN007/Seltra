import type { DashboardFootprint } from "@/lib/api/dashboard.types";
import type { GlobePoint } from "@/components/GlobeMap";

/** City/country centroids used to plot footprint API locations on the globe. */
const cityCoords: Record<string, { lat: number; lng: number }> = {
  // Ghana
  Accra: { lat: 5.6037, lng: -0.187 },
  Kumasi: { lat: 6.6885, lng: -1.6244 },
  "Cape Coast": { lat: 5.1053, lng: -1.2466 },
  Tema: { lat: 5.6698, lng: -0.0166 },
  Tamale: { lat: 9.4035, lng: -0.8423 },
  Ho: { lat: 6.6119, lng: 0.4703 },
  Takoradi: { lat: 4.8845, lng: -1.7554 },
  Sunyani: { lat: 7.3399, lng: -2.3268 },
  Koforidua: { lat: 6.0941, lng: -0.2591 },
  Ghana: { lat: 7.9465, lng: -1.0232 },
  // Nigeria
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Abuja: { lat: 9.0765, lng: 7.3986 },
  "Port Harcourt": { lat: 4.8156, lng: 7.0498 },
  Ibadan: { lat: 7.3775, lng: 3.947 },
  Kano: { lat: 12.0022, lng: 8.592 },
  Nigeria: { lat: 9.082, lng: 8.6753 },
  // Kenya
  Nairobi: { lat: -1.2921, lng: 36.8219 },
  Mombasa: { lat: -4.0435, lng: 39.6682 },
  Kenya: { lat: -0.0236, lng: 37.9062 },
  // South Africa
  Johannesburg: { lat: -26.2041, lng: 28.0473 },
  "Cape Town": { lat: -33.9249, lng: 18.4241 },
  Durban: { lat: -29.8587, lng: 31.0218 },
  Pretoria: { lat: -25.7479, lng: 28.2293 },
  "South Africa": { lat: -30.5595, lng: 22.9375 },
  // Broader Africa / common markets
  "Côte d'Ivoire": { lat: 7.54, lng: -5.5471 },
  "Ivory Coast": { lat: 7.54, lng: -5.5471 },
  Abidjan: { lat: 5.36, lng: -4.0083 },
  Senegal: { lat: 14.4974, lng: -14.4524 },
  Dakar: { lat: 14.7167, lng: -17.4677 },
  Rwanda: { lat: -1.9403, lng: 29.8739 },
  Kigali: { lat: -1.9441, lng: 30.0619 },
  Uganda: { lat: 1.3733, lng: 32.2903 },
  Kampala: { lat: 0.3476, lng: 32.5825 },
  Tanzania: { lat: -6.369, lng: 34.8888 },
  "Dar es Salaam": { lat: -6.7924, lng: 39.2083 },
  Egypt: { lat: 26.8206, lng: 30.8025 },
  Cairo: { lat: 30.0444, lng: 31.2357 },
  Morocco: { lat: 31.7917, lng: -7.0926 },
  Casablanca: { lat: 33.5731, lng: -7.5898 },
  Ethiopia: { lat: 9.145, lng: 40.4897 },
  "Addis Ababa": { lat: 9.032, lng: 38.7469 },
};

function normalizePlace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function resolveCoords(city: string, country: string) {
  const cityKey = normalizePlace(city);
  const countryKey = normalizePlace(country);

  return (
    cityCoords[`${cityKey}, ${countryKey}`] ??
    cityCoords[cityKey] ??
    cityCoords[countryKey] ??
    null
  );
}

/** Normalize API / wrapped responses into DashboardFootprint. */
export function normalizeFootprintPayload(payload: unknown): DashboardFootprint | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const source = (root.data && typeof root.data === "object" ? root.data : root) as Record<
    string,
    unknown
  >;

  if (!Array.isArray(source.countries)) return null;

  return {
    totalMerchants: Number(source.totalMerchants ?? 0),
    activeMerchants: Number(source.activeMerchants ?? 0),
    topMarket: String(source.topMarket ?? "—"),
    countries: (source.countries as Array<Record<string, unknown>>).map((country) => ({
      country: String(country.country ?? "Unknown"),
      count: Number(country.count ?? 0),
      cities: Array.isArray(country.cities)
        ? (country.cities as Array<Record<string, unknown>>).map((city) => ({
            city: String(city.city ?? "Unknown"),
            count: Number(city.count ?? 0),
          }))
        : [],
    })),
  };
}

export function footprintToGlobePoints(footprint: DashboardFootprint): GlobePoint[] {
  const points: GlobePoint[] = [];

  for (const countryEntry of footprint.countries) {
    if (countryEntry.cities.length) {
      for (const cityEntry of countryEntry.cities) {
        const coords = resolveCoords(cityEntry.city, countryEntry.country);
        if (!coords) {
          // Fall back to country centroid so the merchant still appears on the map
          const countryCoords = resolveCoords(countryEntry.country, countryEntry.country);
          if (!countryCoords) continue;
          points.push({
            lat: countryCoords.lat,
            lng: countryCoords.lng,
            label: `${cityEntry.city}, ${countryEntry.country}`,
            count: cityEntry.count,
            country: countryEntry.country,
          });
          continue;
        }
        points.push({
          lat: coords.lat,
          lng: coords.lng,
          label: `${cityEntry.city}, ${countryEntry.country}`,
          count: cityEntry.count,
          country: countryEntry.country,
        });
      }
      continue;
    }

    const coords = resolveCoords(countryEntry.country, countryEntry.country);
    if (!coords) continue;
    points.push({
      lat: coords.lat,
      lng: coords.lng,
      label: countryEntry.country,
      count: countryEntry.count,
      country: countryEntry.country,
    });
  }

  return points;
}

export function footprintCountriesMap(footprint: DashboardFootprint) {
  return Object.fromEntries(footprint.countries.map((c) => [c.country, c.count]));
}

type MerchantLocation = { based_in?: string | null; status?: string };

/** Fallback when /dashboard/footprint API is unavailable. */
export function footprintFromMerchants(merchants: MerchantLocation[]): DashboardFootprint {
  const countryBuckets = new Map<string, { total: number; cities: Map<string, number> }>();

  for (const merchant of merchants) {
    const basedIn = merchant.based_in?.trim() || "";
    if (!basedIn) continue;

    const parts = basedIn.split(",").map((part) => part.trim());
    const country = parts.length > 1 ? parts[parts.length - 1] : basedIn;
    const city = parts.length > 1 ? parts[0] : "";

    if (!countryBuckets.has(country)) {
      countryBuckets.set(country, { total: 0, cities: new Map() });
    }

    const bucket = countryBuckets.get(country)!;
    bucket.total += 1;
    if (city) {
      bucket.cities.set(city, (bucket.cities.get(city) ?? 0) + 1);
    }
  }

  const countries = Array.from(countryBuckets.entries())
    .map(([country, { total, cities }]) => ({
      country,
      count: total,
      cities: Array.from(cities.entries()).map(([city, count]) => ({ city, count })),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalMerchants: merchants.length,
    activeMerchants: merchants.filter((m) => m.status === "active").length,
    countries,
    topMarket: countries[0]?.country ?? "—",
  };
}
