import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves a shortened Google Maps URL to lat/lng coordinates.
 *
 * Strategy (multiple fallbacks):
 * 1. Follow redirects hop-by-hop, collecting all intermediate URLs
 * 2. Parse coordinates from URL patterns: @lat,lng, ?q=lat,lng, !3d...!4d...
 * 3. Follow remaining redirects and check final resolved URL
 * 4. Extract CID from ftid and try maps.google.com/maps?cid=X resolution
 * 5. Parse HTML for coordinate data with Turkey range filter
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

    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.1",
    };

    // Step 1: Follow redirects manually (up to 10 hops), collect all URLs
    const urls: string[] = [url];
    let currentUrl = url;

    for (let i = 0; i < 10; i++) {
      const res = await fetch(currentUrl, { redirect: "manual", headers });
      const location = res.headers.get("location");
      if (!location || res.status < 300 || res.status >= 400) break;

      const nextUrl = location.startsWith("http")
        ? location
        : new URL(location, currentUrl).toString();

      urls.push(nextUrl);
      currentUrl = nextUrl;
    }

    // Step 2: Try extracting coordinates from ALL collected URLs
    for (const u of urls) {
      const coords = extractCoordsFromUrl(u);
      if (coords) return NextResponse.json(coords);
    }

    // Step 3: Fetch final URL with redirect:follow to catch remaining redirects
    const lastUrl = urls[urls.length - 1];
    const pageRes = await fetch(lastUrl, { redirect: "follow", headers });
    const resolvedUrl = pageRes.url;

    if (resolvedUrl) {
      const coords = extractCoordsFromUrl(resolvedUrl);
      if (coords) return NextResponse.json(coords);
    }

    // Step 4: Try CID-based resolution
    // Extract ftid from any collected URL and convert to CID
    const cidCoords = await tryCidResolution(urls, headers);
    if (cidCoords) return NextResponse.json(cidCoords);

    // Step 5: Parse HTML as last resort
    const html = await pageRes.text();
    const htmlCoords = extractCoordsFromHtml(html);
    if (htmlCoords) return NextResponse.json(htmlCoords);

    return NextResponse.json({ error: "Koordinat bulunamadı" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "URL çözümlenemedi" }, { status: 500 });
  }
}

/**
 * Extract ftid from URLs, convert to CID, and resolve via maps.google.com/maps?cid=X
 */
async function tryCidResolution(
  urls: string[],
  headers: Record<string, string>
): Promise<{ lat: number; lng: number } | null> {
  for (const u of urls) {
    const ftidMatch = u.match(/ftid=([^&]+)/);
    if (!ftidMatch) continue;

    const ftid = ftidMatch[1];
    // ftid format: 0xHEX1:0xHEX2 — second part is the CID
    const cidHexMatch = ftid.match(/:0x([0-9a-fA-F]+)/);
    if (!cidHexMatch) continue;

    try {
      // Convert hex CID to decimal
      const cidDecimal = BigInt("0x" + cidHexMatch[1]).toString();

      // Fetch maps.google.com with CID — often redirects to URL with @lat,lng
      const cidUrl = `https://maps.google.com/maps?cid=${cidDecimal}&hl=tr`;
      const res = await fetch(cidUrl, { redirect: "follow", headers });
      const finalUrl = res.url;

      if (finalUrl) {
        const coords = extractCoordsFromUrl(finalUrl);
        if (coords) return coords;
      }

      // Also try parsing the HTML from CID page
      const html = await res.text();
      const htmlCoords = extractCoordsFromHtml(html);
      if (htmlCoords) return htmlCoords;
    } catch {
      // CID conversion failed, try next URL
    }
  }

  return null;
}

/**
 * Extract coordinates from a Google Maps URL using multiple patterns.
 */
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    // @lat,lng,zoom pattern (most common in final URLs)
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    // ?q=lat,lng pattern
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
    // !3dlat!4dlng pattern (protocol buffer encoding in Google Maps)
    // Require decimal point to avoid matching integer params like !3d1
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    // ll=lat,lng pattern
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    // center=lat,lng pattern
    /[?&]center=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];

  for (const pattern of patterns) {
    // Use global search to find ALL matches, pick Turkey-range one
    const regex = new RegExp(pattern.source, "g");
    let match;
    while ((match = regex.exec(url)) !== null) {
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
 * Extract coordinates from Google Maps HTML using multiple patterns.
 */
function extractCoordsFromHtml(html: string): { lat: number; lng: number } | null {
  const patterns = [
    // !3d...!4d... in embedded URLs/scripts (most reliable)
    /!3d(-?\d+\.\d{4,})!4d(-?\d+\.\d{4,})/,
    // APP_INITIALIZATION_STATE contains actual place coordinates
    /\[null,null,(-?\d+\.\d{4,}),(-?\d+\.\d{4,})\]/,
    // center=lat%2Clng from static map image URLs
    /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,
    // /@lat,lng in canonical/og URLs
    /@(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/,
    // Lat/lng in JSON-like structures
    /\[(-?\d+\.\d{5,}),(-?\d+\.\d{5,})\]/,
  ];

  for (const pattern of patterns) {
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
 * Check if coordinates are within Turkey's bounding box.
 * Filters out wrong coordinates from server location detection.
 */
function isValidTurkeyCoord(lat: number, lng: number): boolean {
  if (isNaN(lat) || isNaN(lng)) return false;
  // Turkey: lat ~36-42, lng ~26-45 (with generous margin)
  return lat >= 35 && lat <= 43 && lng >= 25 && lng <= 46;
}
