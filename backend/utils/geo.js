// utils/geo.js — distance + travel-time estimation for location-aware reminders
const EARTH_RADIUS_KM = 6371;
const AVG_CITY_SPEED_KMH = 22; // conservative average accounting for Indian city traffic

function toRad(deg) { return (deg * Math.PI) / 180; }

/** Straight-line distance between two lat/lng points, in km */
function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === undefined || v === null)) return null;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Rough travel time in minutes for a given straight-line distance */
function estimateTravelMinutes(distanceKm) {
  if (distanceKm === null) return null;
  // straight-line distance underestimates real road distance — pad by 30%
  const roadKm = distanceKm * 1.3;
  return Math.max(5, Math.ceil((roadKm / AVG_CITY_SPEED_KMH) * 60));
}

module.exports = { haversineKm, estimateTravelMinutes };