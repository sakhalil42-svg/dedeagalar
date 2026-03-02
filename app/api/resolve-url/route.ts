import { NextRequest, NextResponse } from "next/server";

/**
 * Resolves a shortened Google Maps URL by following redirects
 * and returning the final (full) URL that contains coordinates.
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

    // Follow redirects manually to get final URL
    const res = await fetch(url, { redirect: "follow" });
    const finalUrl = res.url;

    return NextResponse.json({ resolvedUrl: finalUrl });
  } catch {
    return NextResponse.json({ error: "URL çözümlenemedi" }, { status: 500 });
  }
}
