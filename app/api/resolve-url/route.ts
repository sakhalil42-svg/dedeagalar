import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves a shortened Google Maps URL by following redirects
 * and extracting coordinates from the final page HTML.
 *
 * Google Maps short links often resolve to place-name URLs without
 * coordinates in the URL itself. The coordinates are embedded in the
 * HTML response as "center=lat%2Clng" in static map image URLs.
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL gerekli" }, { status: 400 });
    }

    // Only allow Google Maps short links
    if (!url.includes("goo.gl/maps") && !url.includes("maps.app.goo.gl")) {
      return NextResponse.json({ error: "Sadece Google Maps kısa linkleri desteklenir" }, { status: 400 });
    }

    // Follow redirects and get HTML content
    const res = await fetch(url, { redirect: "follow" });
    const finalUrl = res.url;

    // Try extracting coords from the final URL first
    // Pattern: ?q=lat,lng or @lat,lng
    const urlCoordMatch = finalUrl.match(/[?&]q=([-\d.]+),([-\d.]+)/) ||
                          finalUrl.match(/@([-\d.]+),([-\d.]+)/);
    if (urlCoordMatch) {
      const lat = parseFloat(urlCoordMatch[1]);
      const lng = parseFloat(urlCoordMatch[2]);
      if (isValidCoord(lat, lng)) {
        return NextResponse.json({ lat, lng });
      }
    }

    // If URL doesn't have coordinates, parse HTML for "center=lat%2Clng"
    const html = await res.text();
    const centerMatch = html.match(/center=([-\d.]+)%2C([-\d.]+)/);
    if (centerMatch) {
      const lat = parseFloat(centerMatch[1]);
      const lng = parseFloat(centerMatch[2]);
      if (isValidCoord(lat, lng)) {
        return NextResponse.json({ lat, lng });
      }
    }

    // Fallback: look for "/@lat,lng" pattern in HTML
    const atMatch = html.match(/@([-\d.]{6,}),([-\d.]{6,})/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (isValidCoord(lat, lng)) {
        return NextResponse.json({ lat, lng });
      }
    }

    return NextResponse.json({ error: "Koordinat bulunamadı" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "URL çözümlenemedi" }, { status: 500 });
  }
}

function isValidCoord(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
