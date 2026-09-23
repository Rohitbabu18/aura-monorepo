import { distanceFrom } from '../lib/serializers.ts';

type Located = { id: string; address: Parameters<typeof distanceFrom>[1] };

/**
 * Orders candidates by distance from origin (entities without a location go last) and returns
 * one page of ids plus each id's distance. Fine for thousands of rows; move to PostGIS beyond that.
 */
export const pageByDistance = (
  candidates: Located[],
  origin: { lat: number; lng: number },
  skip: number,
  take: number
) => {
  const ranked = candidates
    .map((c) => ({ id: c.id, distanceKm: distanceFrom(origin, c.address) }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  const page = ranked.slice(skip, skip + take);
  return { ids: page.map((p) => p.id), distances: new Map(page.map((p) => [p.id, p.distanceKm])) };
};

/** Reorders rows to match `ids`. */
export const inOrder = <T extends { id: string }>(rows: T[], ids: string[]) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => Boolean(r));
};
