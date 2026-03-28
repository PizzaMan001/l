export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Usage: /?url=URL_OR_BASE64', { status: 400 });
    }

    try {
      // 1. Try to decode if it looks like Base64, otherwise use as is
      if (!targetUrl.startsWith('http')) {
        targetUrl = atob(targetUrl);
      }

      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://profamouslife.com/",
        "Origin": "https://profamouslife.com",
      };

      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return new Response(`Source Error: ${response.status}`, { status: response.status });
      }

      // 2. Handle M3U8 Rewriting
      if (targetUrl.includes('.m3u8')) {
        let manifest = await response.text();

        // Rewrite paths: matches lines NOT starting with # (the actual TS/M3U8 links)
        const rewrittenManifest = manifest.replace(/^(?![#\s]).+/gm, (match) => {
          const segment = match.trim();
          const fullSegmentUrl = segment.startsWith('http') ? segment : baseUrl + segment;
          // Use btoa to ensure the query string doesn't break the URL structure
          return `${url.origin}/?url=${btoa(fullSegmentUrl)}`;
        });

        return new Response(rewrittenManifest, {
          headers: { 
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*" 
          }
        });
      }

      // 3. Handle TS Segments
      return new Response(response.body, {
        headers: { 
          "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
          "Access-Control-Allow-Origin": "*" 
        }
      });

    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
