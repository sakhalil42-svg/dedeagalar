import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves a shortened Google Maps URL to lat/lng coordinates.
 *
 * Strategy:
 * 1. Follow the first redirect (manual) to get the full Google Maps URL
 * 2. Extract the `ftid` (feature/place ID) from that URL
 * 3. Fetch Google Maps page using ftid directly — this reliably returns
 *    coordinates in the HTML regardless of server location
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

    // Step 1: Follow first redirect to get the full URL with ftid
    const redirectRes = await fetch(url, { redirect: "manual" });
    const redirectUrl = redirectRes.headers.get("location");

    if (!redirectUrl) {
      return NextResponse.json({ error: "Redirect bulunamadı" }, { status: 404 });
    }

    // Try extracting coords from the redirect URL itself (?q=lat,lng or @lat,lng)
    const urlCoordMatch = redirectUrl.match(/[?&]q=([-\d.]+),([-\d.]+)/) ||
                          redirectUrl.match(/@([-\d.]+),([-\d.]+)/);
    if (urlCoordMatch) {
      const lat = parseFloat(urlCoordMatch[1]);
      const lng = parseFloat(urlCoordMatch[2]);
      if (isValidCoord(lat, lng)) {
        return NextResponse.json({ lat, lng });
      }
    }

    // Step 2: Extract ftid from redirect URL
    const ftidMatch = redirectUrl.match(/ftid=([^&]+)/);
    if (!ftidMatch) {
      return NextResponse.json({ error: "Place ID bulunamadı" }, { status: 404 });
    }

    // Step 3: Fetch Google Maps page using ftid — reliable regardless of server location
    const mapsUrl = `https://www.google.com/maps?ftid=${ftidMatch[1]}&hl=tr`;
    const mapsRes = await fetch(mapsUrl, { redirect: "follow" });
    const html = await mapsRes.text();

    // Parse "center=lat%2Clng" from static map image URLs in HTML
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
