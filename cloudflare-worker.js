
/**
 * Cloudflare Worker for Grocesphere
 * 
 * Functions:
 * 1. Blinds the Google Gemini API Key (Backend-for-Frontend).
 * 2. Proxies Overpass (OpenStreetMap) requests to prevent rate-limiting and handle caching.
 * 3. Proxies Nominatim (Geocoding) to add required User-Agent headers and caching.
 * 
 * Deployment:
 * 1. Create a worker on Cloudflare.
 * 2. Paste this code.
 * 3. Add variable `GEMINI_API_KEY` in Worker Settings > Variables.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 1. Handle CORS (Allow all for demo, restrict domains in production)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. ROUTE: Gemini AI Proxy
    // Usage: POST /gemini { prompt: "..." }
    if (url.pathname === "/gemini") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
      
      try {
        const { prompt } = await request.json();
        const apiKey = env.GEMINI_API_KEY;

        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Server Config Error: Missing API Key" }), { status: 500, headers: corsHeaders });
        }

        // Construct the Google API request
        const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
        const googleResponse = await fetch(googleUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate a short appetizing description (max 20 words), a simple list of ingredients (if applicable for a raw item just say 'Fresh ${prompt}'), and basic nutritional info (e.g. '120 kcal, 5g Protein') for the grocery item: '${prompt}'. Return JSON.` }] }],
            generationConfig: { 
                response_mime_type: "application/json",
                response_schema: {
                    type: "OBJECT",
                    properties: {
                        description: { type: "STRING" },
                        ingredients: { type: "STRING" },
                        nutrition: { type: "STRING" }
                    },
                    required: ["description", "ingredients", "nutrition"]
                }
            }
          })
        });

        const data = await googleResponse.json();
        return new Response(JSON.stringify(data), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    // 3. ROUTE: Store Finder Proxy (Overpass API)
    // Usage: GET /stores?lat=...&lng=...&radius=...
    if (url.pathname === "/stores") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      const radius = url.searchParams.get("radius") || 2000;

      if (!lat || !lng) return new Response("Missing lat/lng", { status: 400, headers: corsHeaders });

      // Cache Key based on coordinates (rounded to ~100m to increase cache hit rate)
      const cacheKey = new Request(url.toString(), request);
      const cache = caches.default;
      let response = await cache.match(cacheKey);

      if (!response) {
        const query = `
          [out:json][timeout:10];
          (
            node["shop"~"convenience|general|supermarket|provisions"](around:${radius}, ${lat}, ${lng});
            node["shop"~"greengrocer|farm|vegetable"](around:${radius}, ${lat}, ${lng});
            node["shop"~"dairy|milk"](around:${radius}, ${lat}, ${lng});
          );
          out body;
          >;
          out skel qt;
        `;

        const overpassUrl = "https://overpass-api.de/api/interpreter";
        const overpassResponse = await fetch(overpassUrl, {
          method: "POST",
          body: query
        });

        // Reconstruct response to add CORS
        response = new Response(overpassResponse.body, overpassResponse);
        response.headers.set("Access-Control-Allow-Origin", "*");
        response.headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    }

    // 4. ROUTE: Geocode Proxy (Nominatim)
    // Usage: GET /geocode?lat=...&lng=...
    if (url.pathname === "/geocode") {
       const lat = url.searchParams.get("lat");
       const lng = url.searchParams.get("lng");
       
       const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
       
       const geoResponse = await fetch(nominatimUrl, {
           headers: { "User-Agent": "Grocesphere-Cloudflare-Worker/1.0" }
       });
       
       const data = await geoResponse.json();
       return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Grocesphere Worker Active", { status: 200, headers: corsHeaders });
  }
};
