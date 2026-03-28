const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/proxy', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send("Error: Missing 'url' parameter (Base64 encoded).");
    }

    try {
        // 1. Decode the URL from Base64
        const decodedUrl = Buffer.from(url, 'base64').toString('utf-8');
        
        // 2. Prepare headers (Mirroring your PHP logic)
        const config = {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
                "Referer": "https://profamouslife.com/",
                "Origin": "https://profamouslife.com",
            },
            responseType: decodedUrl.includes('.m3u8') ? 'text' : 'arraybuffer',
            timeout: 15000,
            validateStatus: false 
        };

        const response = await axios.get(decodedUrl, config);

        // Forward the status code from the source
        if (response.status !== 200) {
            return res.status(response.status).send(`Source Error: ${response.status}`);
        }

        // 3. Handle Playlist Rewriting (.m3u8)
        if (decodedUrl.includes('.m3u8')) {
            const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);
            
            // Rewrite relative .ts paths to proxied Base64 paths
            const rewritten = response.data.replace(/^(.*\.ts.*)$/gm, (match) => {
                const segmentUrl = match.trim().startsWith('http') ? match.trim() : baseUrl + match.trim();
                const encodedSegment = Buffer.from(segmentUrl).toString('base64');
                return `proxy?url=${encodedSegment}`;
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewritten);
        }

        // 4. Handle Video Segments (.ts)
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp2t');
        return res.send(response.data);

    } catch (error) {
        res.status(500).send("Proxy Exception: " + error.message);
    }
});

// Root route for usage instructions
app.get('/', (req, res) => {
    res.send("HLS Proxy is running. Usage: /proxy?url=[BASE64_ENCODED_URL]");
});

app.listen(PORT, () => console.log(`Proxy active on port ${PORT}`));
