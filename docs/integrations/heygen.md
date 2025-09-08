### HeyGen API Integration

### Overview
HeyGen provides APIs for avatar video generation, translations, and interactive avatars. Creating entirely new custom avatars ("influencers") and bulk generating stills typically requires enterprise/private endpoints; verify availability with your account manager.

### Authentication
- Header: `X-API-KEY: YOUR_API_KEY`

### Base URLs
- Primary: `https://api.heygen.com/v2`
- Status (legacy): `https://api.heygen.com/v1`

### Endpoints

#### Create Avatar Video (v2)
- Method: POST
- Path: `/video/generate`
- Request example:
```json
{
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "Daisy-inskirt-20220818",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "Welcome to the HeyGen API!",
        "voice_id": "2d5b0e6cf36f460aa7fc47e3eee4ba54"
      },
      "background": { "type": "color", "value": "#000000" }
    }
  ],
  "dimension": { "width": 1080, "height": 1920 }
}
```
- Response example:
```json
{ "error": null, "data": { "video_id": "..." } }
```

#### Check Video Status (v1)
- Method: GET
- Path: `/video_status.get?video_id={video_id}`
- Response example:
```json
{
  "code": 100,
  "data": {
    "status": "completed",
    "video_url": "https://...",
    "thumbnail_url": "https://..."
  },
  "message": "Success"
}
```

#### Generate From Template (v2)
- Method: POST
- Path: `/template/{template_id}/generate`
- Request example:
```json
{
  "title": "Personalized",
  "variables": {
    "name": {
      "name": "name",
      "type": "text",
      "properties": { "content": "Alec" }
    }
  }
}
```
- Response example:
```json
{ "error": null, "data": { "video_id": "..." } }
```

### Custom Avatar / Influencer Creation (Enterprise)
- Creating a new influencer identity and producing ~50 multi-angle stills is commonly an enterprise/private workflow.
- Ask for: character creation endpoint, reference set upload, bulk stills generation, async job polling, and limits.

### Rate Limits
- Vary by plan (Free/Pro/Scale/Enterprise). Handle HTTP 429 with exponential backoff.

### References
- Docs: `https://docs.heygen.com/`
- API overview: `https://www.heygen.com/api`
- Getting API key: Help Center article (Space Settings → API)


