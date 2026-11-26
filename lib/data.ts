import locationsRaw from "./data/locations-enriched.json" with { type: "json" };
import servicesRaw from "./data/services.json" with { type: "json" };
import { DRIP_MODE, LAUNCH_DATE } from "./config";

export interface Service {
  id: number;
  service_name: string;
  service_slug: string;
  service_tier: number;
  base_keywords: string[];
}

export interface Location {
  id: number;
  state_code: string;
  state_name: string;
  county_name: string;
  place_name: string;
  place_slug: string;
  place_type: string;
  population: number;
  area_code: string;
  tier: number;
  water_hardness_ppm: number;
  water_hardness_desc: string;
  median_home_year: number;
  median_home_age: number;
  pct_pre_1975_homes: number;
  dominant_pipe_era: string;
  frost_line_depth_inches: number;
  climate_zone: string;
  municipal_psi_standard: string;
  water_district_name: string;
  water_district_verified?: boolean;
  permit_authority: string;
  data_sources?: {
    median_home_year: string;
    water_hardness: string;
    climate_frost: string;
    permit_authority: string;
    water_district: string;
  };
}

export interface StateRow {
  state_code: string;
  state_name: string;
  location_count: number;
  page_count: number;
}

const ALL_LOCATIONS = locationsRaw as unknown as Location[];
const ALL_SERVICES  = servicesRaw  as unknown as Service[];

// Sort all US locations by population descending (Tier 1 Metro Priority)
const POPULATION_SORTED_LOCATIONS = ALL_LOCATIONS.slice().sort(
  (a, b) => b.population - a.population || a.place_name.localeCompare(b.place_name)
);

const locationByKey = new Map<string, Location>();
const locationById  = new Map<number, Location>();
const locationBySlugOnly = new Map<string, Location>();
const serviceBySlug = new Map<string, Service>();

for (const loc of ALL_LOCATIONS) {
  locationByKey.set(`${loc.state_code}|${loc.place_slug}`, loc);
  locationById.set(loc.id, loc);
  if (!locationBySlugOnly.has(loc.place_slug)) {
    locationBySlugOnly.set(loc.place_slug, loc);
  }
}
for (const svc of ALL_SERVICES) {
  serviceBySlug.set(svc.service_slug, svc);
}

function shuffleKey(serviceId: number, locationId: number): number {
  let h = Math.imul(serviceId, 2654435761) ^ Math.imul(locationId, 2246822519);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

export async function getAllLocations(): Promise<Location[]> {
  return ALL_LOCATIONS;
}

export async function getAllServices(): Promise<Service[]> {
  return ALL_SERVICES;
}

export async function getStates(): Promise<StateRow[]> {
  const map = new Map<string, StateRow>();
  for (const loc of ALL_LOCATIONS) {
    const pages = ALL_SERVICES.length;
    const entry = map.get(loc.state_code);
    if (entry) {
      entry.location_count++;
      entry.page_count += pages;
    } else {
      map.set(loc.state_code, {
        state_code: loc.state_code,
        state_name: loc.state_name,
        location_count: 1,
        page_count: pages,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.location_count - a.location_count || a.state_name.localeCompare(b.state_name)
  );
}

export async function getFeaturedLocations(salt = 0, count = 16): Promise<Location[]> {
  const topMetros = POPULATION_SORTED_LOCATIONS.filter((l) => l.population >= 100000);
  if (topMetros.length === 0) return ALL_LOCATIONS.slice(0, count);

  const maxOffset = Math.max(1, topMetros.length - count);
  const offset = Math.abs(salt * 7) % maxOffset;
  return topMetros.slice(offset, offset + count);
}

export async function getStateByCode(stateCode: string): Promise<StateRow | null> {
  const states = await getStates();
  return states.find((s) => s.state_code === stateCode) ?? null;
}

export async function getLocationsByState(stateCode: string): Promise<Location[]> {
  return ALL_LOCATIONS.filter((l) => l.state_code === stateCode).sort(
    (a, b) => b.population - a.population || a.place_name.localeCompare(b.place_name)
  );
}

export async function getLocation(stateCode: string, placeSlug: string): Promise<Location | null> {
  return locationByKey.get(`${stateCode}|${placeSlug}`) ?? null;
}

export function getLocationBySlugOnly(placeSlug: string): Location | null {
  return locationBySlugOnly.get(placeSlug.toLowerCase()) ?? null;
}

export async function getLocationById(id: number): Promise<Location | null> {
  return locationById.get(id) ?? null;
}

export async function getService(serviceSlug: string): Promise<Service | null> {
  return serviceBySlug.get(serviceSlug) ?? null;
}

export async function getServicesByLocationTier(tier: number): Promise<Service[]> {
  if (DRIP_MODE === "all") {
    return ALL_SERVICES;
  }
  // Tier 1 (major metros): up to 150 services
  // Tier 2 (mid-sized cities): up to 75 services
  // Tier 3 (rural / small towns): up to 25 services
  const maxByTier = tier === 1 ? 150 : tier === 2 ? 75 : 25;
  const dripCount = getDripServicesCount();
  const allowedCount = Math.min(maxByTier, dripCount);
  return ALL_SERVICES.slice(0, allowedCount);
}

export async function getServicesByLocation(locationId: number): Promise<Service[]> {
  const loc = locationById.get(locationId);
  if (!loc) return [];
  return getServicesByLocationTier(loc.tier);
}

export async function isServiceAllowedForTier(serviceId: number, locationTier: number): Promise<boolean> {
  if (DRIP_MODE === "all") return true;
  const maxByTier = locationTier === 1 ? 150 : locationTier === 2 ? 75 : 25;
  return serviceId <= maxByTier;
}

export async function getSiblingServices(locationId: number, serviceId: number, limit = 5): Promise<Service[]> {
  const loc = locationById.get(locationId);
  if (!loc) return [];
  const pool = ALL_SERVICES.filter((s) => s.id !== serviceId);
  return pool
    .slice()
    .sort((a, b) => shuffleKey(a.id, locationId) - shuffleKey(b.id, locationId))
    .slice(0, limit);
}

export async function getNearbyLocations(locationId: number, stateCode: string, limit = 3): Promise<Location[]> {
  return ALL_LOCATIONS.filter(
    (l) => l.state_code === stateCode && l.id !== locationId
  )
    .sort((a, b) => b.population - a.population)
    .slice(0, limit);
}

/* ================================================================
 * 24-WEEK (6-MONTH) PROGRESSIVE CRAWL-BUDGET DRIP ENGINE
 * Script A (NEXT_PUBLIC_DRIP_MODE="all"): Exposes all ~337k pages Day 1.
 * Script B (NEXT_PUBLIC_DRIP_MODE="progressive", default): 168-day ramp.
 * ================================================================ */

export function getDaysElapsed(): number {
  const launchStr = LAUNCH_DATE || process.env.NEXT_PUBLIC_LAUNCH_DATE || new Date().toISOString().split("T")[0];
  const launch = new Date(launchStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - launch) / (1000 * 60 * 60 * 24)));
}

/**
 * 24-Week (6-Month) Progressive Metro Growth:
 * - Weeks 1-3   (Days 0-20)   : Top 60-100 Metros
 * - Weeks 4-6   (Days 21-41)  : Top 100-250 Cities
 * - Weeks 7-9   (Days 42-62)  : Top 250-500 Cities
 * - Weeks 10-12 (Days 63-83)  : Top 500-800 Cities
 * - Weeks 13-15 (Days 84-104) : Top 800-1,200 Cities
 * - Weeks 16-18 (Days 105-125): Top 1,200-1,600 Cities
 * - Weeks 19-21 (Days 126-146): Top 1,600-2,000 Cities
 * - Weeks 22-24 (Days 147-167): Top 2,000-2,249 Cities
 * - Day 168+    (Month 6+)    : All 2,249 Cities
 */
export function getDripLocationsCount(days = getDaysElapsed()): number {
  if (DRIP_MODE === "all") {
    return POPULATION_SORTED_LOCATIONS.length;
  }

  const envCount = process.env.NEXT_PUBLIC_DRIP_COUNT;
  if (envCount && !isNaN(Number(envCount))) {
    return Math.min(Number(envCount), POPULATION_SORTED_LOCATIONS.length);
  }

  if (days < 21) {
    return Math.min(60 + Math.floor(days * 2), 100);
  }
  if (days < 42) {
    return Math.min(100 + Math.floor((days - 21) * 7), 250);
  }
  if (days < 63) {
    return Math.min(250 + Math.floor((days - 42) * 12), 500);
  }
  if (days < 84) {
    return Math.min(500 + Math.floor((days - 63) * 14), 800);
  }
  if (days < 105) {
    return Math.min(800 + Math.floor((days - 84) * 19), 1200);
  }
  if (days < 126) {
    return Math.min(1200 + Math.floor((days - 105) * 19), 1600);
  }
  if (days < 147) {
    return Math.min(1600 + Math.floor((days - 126) * 19), 2000);
  }
  if (days < 168) {
    return Math.min(2000 + Math.floor((days - 147) * 12), POPULATION_SORTED_LOCATIONS.length);
  }

  return POPULATION_SORTED_LOCATIONS.length;
}

/**
 * 24-Week (6-Month) Progressive Service Expansion:
 * - Weeks 1-3   (Days 0-20)   : Core 10 High-Intent Emergency Services
 * - Weeks 4-6   (Days 21-41)  : Top 15 Services
 * - Weeks 7-9   (Days 42-62)  : Top 25 Services
 * - Weeks 10-12 (Days 63-83)  : Top 35 Services
 * - Weeks 13-15 (Days 84-104) : Top 50 Services
 * - Weeks 16-18 (Days 105-125): Top 75 Services
 * - Weeks 19-21 (Days 126-146): Top 100 Services
 * - Weeks 22-24 (Days 147-167): Top 125 Services
 * - Day 168+    (Month 6+)    : All 150 Services
 */
export function getDripServicesCount(days = getDaysElapsed()): number {
  if (DRIP_MODE === "all") {
    return ALL_SERVICES.length;
  }

  if (days < 21) return 10;
  if (days < 42) return 15;
  if (days < 63) return 25;
  if (days < 84) return 35;
  if (days < 105) return 50;
  if (days < 126) return 75;
  if (days < 147) return 100;
  if (days < 168) return 125;
  return ALL_SERVICES.length;
}

export async function getDripLocations(): Promise<Location[]> {
  const count = getDripLocationsCount();
  return POPULATION_SORTED_LOCATIONS.slice(0, count);
}

export async function getDripServices(): Promise<Service[]> {
  const count = getDripServicesCount();
  return ALL_SERVICES.slice(0, count);
}

export async function isLocationAllowed(stateCode: string, placeSlug: string): Promise<boolean> {
  const loc = await getLocation(stateCode, placeSlug);
  if (!loc) return false;
  const dripLocs = await getDripLocations();
  return dripLocs.some((l) => l.id === loc.id);
}

export async function getDripLocationsByState(stateCode: string): Promise<Location[]> {
  const dripLocs = await getDripLocations();
  return dripLocs.filter((l) => l.state_code === stateCode);
}

export async function isLocationAndServiceAllowed(stateCode: string, placeSlug: string, serviceSlug: string): Promise<boolean> {
  const [loc, svc] = await Promise.all([getLocation(stateCode, placeSlug), getService(serviceSlug)]);
  if (!loc || !svc) return false;

  const dripLocs = await getDripLocations();
  const isLocDripped = dripLocs.some((l) => l.id === loc.id);
  if (!isLocDripped) return false;

  const allowedServices = await getServicesByLocationTier(loc.tier);
  return allowedServices.some((s) => s.id === svc.id);
}

export async function getDripStates(): Promise<StateRow[]> {
  const dripLocs = await getDripLocations();
  const dripSvcs = await getDripServices();
  const stateMap = new Map<string, { state_code: string; state_name: string; location_count: number; page_count: number }>();

  for (const loc of dripLocs) {
    const existing = stateMap.get(loc.state_code);
    if (existing) {
      existing.location_count++;
      existing.page_count += dripSvcs.length;
    } else {
      stateMap.set(loc.state_code, {
        state_code: loc.state_code,
        state_name: loc.state_name,
        location_count: 1,
        page_count: dripSvcs.length,
      });
    }
  }

  return Array.from(stateMap.values()).sort((a, b) =>
    b.location_count - a.location_count || a.state_name.localeCompare(b.state_name)
  );
}
