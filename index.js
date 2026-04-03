export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Cloudflare handles the URL-decoding of the 'url' parameter automatically
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Usage: /?url=ENCODED_URL', { status: 400 });
    }

    try {
      // 1. Properly determine the Base URL for relative segments
      // We strip the query parameters from the targetUrl to get a clean path
      const urlObj = new URL(targetUrl);
      const baseUrl = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);

      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Referer": "https://executeandship.com/",
        "Origin": "https://executeandship.com",
      };

      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return new Response(`Source Error: ${response.status}`, { status: response.status });
      }

      // 2. M3U8 Rewriting Logic
      if (targetUrl.includes('.m3u8')) {
        let manifest = await response.text();

        // This regex catches lines ending in .ts or lines containing .ts? (for tokens)
        const rewrittenManifest = manifest.replace(/^(.*\.ts.*)$/gm, (match) => {
          const segment = match.trim();
          let fullSegmentUrl;
          
          if (segment.startsWith('http')) {
            fullSegmentUrl = segment;
          } else {
            // Join base path with segment name, then re-attach original tokens if needed
            // If the source needs the SAME md5/expires for segments, we append them here:
            const separator = segment.includes('?') ? '&' : '?';
            fullSegmentUrl = baseUrl + segment;
            
            // Re-append source parameters if they aren't in the segment line already
            if (!segment.includes('md5=') && urlObj.search) {
               fullSegmentUrl += (segment.includes('?') ? '&' : '?') + urlObj.search.substring(1);
            }
          }
          
          return `?url=${encodeURIComponent(fullSegmentUrl)}`;
        });

        return new Response(rewrittenManifest, {
          headers: { 
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*" 
          }
        });
      }

      // 3. TS Segment Streaming
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
