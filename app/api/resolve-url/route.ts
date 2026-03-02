import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves a shortened Google Maps URL to lat/lng coordinates.
 *
 * Strategy (multiple fallbacks):
 * 1. Follow redirects manually hop-by-hop, collecting all intermediate URLs
 * 2. Parse coordinates from URL patterns: @lat,lng, ?q=lat,lng, !3d...!4d...
 * 3. If no coords in URLs, fetch final page and parse HTML for coordinate data
 *    using patterns that work regardless of server location
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL gerekli" }, { status: 400 });
    }

    // Only allow Google Maps short links
    if (!url.includes("goo.gl/maps") && !url.includes("maps.app.goo.gl")) {
      return NextResponse.json(
        { error: "Sadece Google Maps kısa linkleri desteklenir" },
        { status: 400 }
      );
    }

    // Step 1: Follow redirects manually (up to 10 hops), collect all URLs
    const urls: string[] = [url];
    let currentUrl = url;

    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "tr-TR,tr;q=0.9",
        },
      });

      const location = res.headers.get("location");
      if (!location || res.status < 300 || res.status >= 400) break;

      // Resolve relative URLs
      const nextUrl = location.startsWith("http")
        ? location
        : new URL(location, currentUrl).toString();

      urls.push(nextUrl);
      currentUrl = nextUrl;
    }

    // Step 2: Try extracting coordinates from ALL collected URLs
    for (const u of urls) {
      const coords = extractCoordsFromUrl(u);
      if (coords) {
        return NextResponse.json(coords);
      }
    }

    // Step 3: Fetch the final URL page and parse HTML
    const finalUrl = urls[urls.length - 1];
    const pageRes = await fetch(finalUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "tr-TR,tr;q=0.9",
      },
    });

    // Check final URL after follow (may have more redirects)
    const resolvedUrl = pageRes.url;
    if (resolvedUrl) {
      const coords = extractCoordsFromUrl(resolvedUrl);
      if (coords) {
        return NextResponse.json(coords);
      }
    }

    const html = await pageRes.text();
    const htmlCoords = extractCoordsFromHtml(html);
    if (htmlCoords) {
      return NextResponse.json(htmlCoords);
    }

    return NextResponse.json({ error: "Koordinat bulunamadı" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "URL çözümlenemedi" }, { status: 500 });
  }
}

/**
 * Extract coordinates from a Google Maps URL using multiple patterns.
 */
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    // @lat,lng,zoom pattern (most common in final URLs)
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    // ?q=lat,lng pattern
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    // !3dlat!4dlng pattern (protocol buffer encoding in Google Maps)
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    // ll=lat,lng pattern
    /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    // center=lat,lng pattern
    /[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      // Türkiye koordinat aralığı kontrolü - sunucu lokasyonundan kaynaklanan
      // yanlış koordinatları filtrelemek için (ör. Paris, ABD)
      if (isValidTurkeyCoord(lat, lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

/**
 * Extract coordinates from Google Maps HTML using multiple patterns.
 * Tries patterns that are reliable regardless of server location.
 */
function extractCoordsFromHtml(html: string): { lat: number; lng: number } | null {
  const patterns = [
    // APP_INITIALIZATION_STATE contains actual place coordinates
    /\[null,null,(-?\d+\.?\d+),(-?\d+\.?\d+)\]/,
    // Protocol buffer data in page scripts: !3d...!4d...
    /!3d(-?\d+\.?\d+)!4d(-?\d+\.?\d+)/,
    // center=lat%2Clng from static map image URLs
    /center=(-?\d+\.?\d+)%2C(-?\d+\.?\d+)/,
    // /@lat,lng in canonical/og URLs
    /@(-?\d+\.?\d{4,}),(-?\d+\.?\d{4,})/,
    // Lat/lng in JSON-like structures with enough decimal precision
    /\[(-?\d+\.\d{5,}),(-?\d+\.\d{5,})\]/,
  ];

  for (const pattern of patterns) {
    // Find ALL matches and pick the one in Turkey range
    const regex = new RegExp(pattern.source, "g");
    let match;
    while ((match = regex.exec(html)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isValidTurkeyCoord(lat, lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

/**
 * Check if coordinates are within Turkey's approximate bounding box.
 * This filters out wrong coordinates from server location detection
 * (e.g., Paris 48.8, 2.3 or US coords).
 */
function isValidTurkeyCoord(lat: number, lng: number): boolean {
  if (isNaN(lat) || isNaN(lng)) return false;
  // Turkey: lat 35.5-42.5, lng 25.5-45.0 (with some margin)
  return lat >= 35 && lat <= 43 && lng >= 25 && lng <= 46;
}
