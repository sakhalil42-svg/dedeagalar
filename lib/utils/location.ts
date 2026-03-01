/**
 * Google Maps link / koordinat parse utility
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Parse a Google Maps link or coordinate string into lat/lng.
 *
 * Supported formats:
 * - https://maps.google.com/?q=37.1234,38.5678
 * - https://www.google.com/maps?q=37.1234,38.5678
 * - https://www.google.com/maps/place/.../@37.1234,38.5678,...
 * - https://www.google.com/maps/@37.1234,38.5678,...
 * - @37.1234,38.5678
 * - 37.1234, 38.5678 (plain coordinates)
 */
export function parseLocationInput(input: string): LatLng | null {
  if (!input || !input.trim()) return null;

  const trimmed = input.trim();

  // Short links that can't be parsed
  if (
    trimmed.includes("goo.gl/maps") ||
    trimmed.includes("maps.app.goo.gl")
  ) {
    return null;
  }

  // Pattern 1: ?q=lat,lng
  const qMatch = trimmed.match(/[?&]q=([-\d.]+),([-\d.]+)/);
  if (qMatch) {
    return validateCoords(parseFloat(qMatch[1]), parseFloat(qMatch[2]));
  }

  // Pattern 2: /@lat,lng in Maps URL
  const atUrlMatch = trimmed.match(/@([-\d.]+),([-\d.]+)/);
  if (atUrlMatch) {
    return validateCoords(parseFloat(atUrlMatch[1]), parseFloat(atUrlMatch[2]));
  }

  // Pattern 3: Plain coordinates "37.1234, 38.5678" or "37.1234,38.5678"
  const plainMatch = trimmed.match(/^([-\d.]+)\s*,\s*([-\d.]+)$/);
  if (plainMatch) {
    return validateCoords(parseFloat(plainMatch[1]), parseFloat(plainMatch[2]));
  }

  return null;
}

function validateCoords(lat: number, lng: number): LatLng | null {
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Generate a Google Maps link from lat/lng.
 */
export function getGoogleMapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
