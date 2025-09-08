### Google Gemini API – Image Generation Integration

### Overview
Use Google’s Gemini API to generate influencer outfit imagery by combining:
- Moodboard image (style reference)
- Influencer image (or future: a stable identity from your model provider)
- Optimized text prompt

The Gemini Image Generation flow produces images as base64 in the response, which you should decode and store (e.g., Supabase Storage) before downstream use.

### Authentication
- API Key (Google AI Studio / Gemini API)
  - Query param: `?key=YOUR_API_KEY`
  - Or header: `x-goog-api-key: YOUR_API_KEY`

### Base URL
- `https://generativelanguage.googleapis.com`

### Models (examples; check docs for currently available image-capable models)
- `models/gemini-2.0-flash-exp`
- `models/gemini-2.5-flash` (where image generation is supported)

### Text-to-Image (pure prompt)
- Method: POST
- Path: `/v1beta/models/{model}:generateContent?key=YOUR_API_KEY`
- Request (uses the image_generation tool and asks for an image binary response):
```json
{
  "contents": [
    { "role": "user", "parts": [ { "text": "Ultra-realistic studio photo of a fashion influencer wearing a streetwear outfit, soft light, 85mm, high detail" } ] }
  ],
  "tools": [ { "image_generation": {} } ],
  "generationConfig": { "responseMimeType": "image/png" }
}
```
- Response (first candidate image as base64):
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inline_data": {
              "mime_type": "image/png",
              "data": "iVBORw0KGgoAAA..."  
            }
          }
        ]
      }
    }
  ]
}
```

### Image+Image Guided (moodboard + influencer image + prompt)
- Method: POST
- Path: `/v1beta/models/{model}:generateContent?key=YOUR_API_KEY`
- Request (two input images + textual guidance; inline base64 shown for brevity):
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "inline_data": { "mime_type": "image/jpeg", "data": "<BASE64_MOODBBOARD>" } },
        { "inline_data": { "mime_type": "image/jpeg", "data": "<BASE64_INFLUENCER>" } },
        { "text": "Generate a high-quality image of the influencer wearing an outfit inspired by the moodboard aesthetics: streetwear, dark palette, oversized hoodie, cargo pants, clean sneakers. Maintain facial identity from the influencer image." }
      ]
    }
  ],
  "tools": [ { "image_generation": {} } ],
  "generationConfig": { "responseMimeType": "image/png" }
}
```
- Response: same shape as Text-to-Image (image returned as base64 in `inline_data.data`).

Notes:
- For large inputs, you can first upload files via the Gemini File API and reference them using `file_data` parts instead of `inline_data`.
- Always decode the base64 and store to your CDN/storage before embedding or further processing.

### Errors & Limits
- Standard Google API error codes (400/401/429/500). Observe quota limits in Google AI Studio and implement exponential backoff on 429.

### Environment Variables
- `GOOGLE_API_KEY`

### Official Docs
- Google Gemini API – Image Generation: `https://ai.google.dev/gemini-api/docs/image-generation`


