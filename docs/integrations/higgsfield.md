### Higgsfield API Integration

### Overview
Higgsfield provides APIs for generating videos from text or images. Some customers have access to identity/model training ("Soul ID") to achieve consistent person appearances across outputs.

### Authentication
- Headers:
  - `Authorization: Bearer YOUR_API_KEY`
  - `Content-Type: application/json`

### Base URL
- `https://higgsfieldapi.com/api/v1`

### Endpoints

#### Generate (Text-to-Video)
- Method: POST
- Path: `/generate`
- Request example:
```json
{
  "type": "text-to-video",
  "prompt": "A fashion influencer walking on a city sidewalk, cinematic lighting",
  "duration": 8,
  "resolution": "1080p",
  "aspect_ratio": "9:16",
  "seed": 42
}
```
- Response example:
```json
{ "success": true, "generation_id": "...", "type": "text-to-video" }
```

#### Generate (Image-to-Video)
- Method: POST
- Path: `/generate`
- Request example:
```json
{
  "type": "image-to-video",
  "prompt": "Outfit breakdown, smooth camera dolly",
  "image_url": "https://...",
  "duration": 8,
  "resolution": "1080p",
  "aspect_ratio": "9:16",
  "camera_fixed": false
}
```
- Response example:
```json
{ "success": true, "generation_id": "...", "type": "image-to-video" }
```

#### Status
- Method: GET
- Path: `/status/{generation_id}`
- Response example:
```json
{
  "status": "completed",
  "video_url": "https://...",
  "type": "image-to-video"
}
```

### Soul ID (Model Training) — confirm with your account
- Often provided as private/enterprise endpoints. Confirm exact API paths and payloads with your assigned documentation.
- Typical flow:
  1) Submit 20–50 HQ reference images of the influencer identity
  2) Create/train model (returns `model_id`)
  3) Poll model status until `ready`
  4) Use `model_id` in subsequent generations

- Example placeholders (replace with official endpoints):
  - POST `/soul/train`
  ```json
  { "name": "brand_influencer_v1", "images": ["https://...", "..."] }
  ```
  - GET `/soul/models/{model_id}`
  ```json
  { "model_id": "...", "status": "ready" }
  ```

### Limits and Quotas
- Respect HTTP 429 and any backoff headers. Constrain concurrency to provider guidance.

### References
- Public docs: `https://higgsfieldapi.com/documentation.php`


