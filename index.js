export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const encodedUrl = url.searchParams.get('url');

    // 1. Basic usage check
    if (!encodedUrl) {
      return new Response('Usage: /?url=' + btoa('https://example.com/video.m3u8'), { status: 400 });
    }

    try {
      // 2. Decode the target URL
      const targetUrl = atob(encodedUrl);
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      // 3. Define headers required by the source
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Referer": "https://profamouslife.com/",
        "Origin": "https://profamouslife.com",
      };

      // 4. Fetch the content from the source
      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return new Response(`Source returned error: ${response.status}`, { status: response.status });
      }

      // 5. Handle M3U8 Rewriting
      if (targetUrl.includes('.m3u8')) {
        let manifest = await response.text();

        // Rewrite .ts lines to point back to THIS worker
        // Logic: Replace filename.ts with /?url=BASE64(full_url)
        const rewrittenManifest = manifest.replace(/^(.*\.ts.*)$/gm, (match) => {
          const segment = match.trim();
          const fullSegmentUrl = segment.startsWith('http') ? segment : baseUrl + segment;
          return `?url=${btoa(fullSegmentUrl)}`;
        });

        return new Response(rewrittenManifest, {
          headers: { "Content-Type": "application/vnd.apple.mpegurl" }
        });
      }

      // 6. Handle TS Segments (Direct stream)
      return new Response(response.body, {
        headers: { 
          "Content-Type": response.headers.get("Content-Type") || "video/mp2t",
          "Access-Control-Allow-Origin": "*" // Ensure CORS is open for players
        }
      });

    } catch (e) {
      return new Response("Proxy Error: " + e.message, { status: 500 });
    }
  }
};
