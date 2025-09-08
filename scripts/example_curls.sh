#!/usr/bin/env bash
set -euo pipefail
: "${PUBLIC_BASE_URL:?set PUBLIC_BASE_URL}" 

curl -s -X POST "$PUBLIC_BASE_URL/api/influencer/run" \
  -H "Content-Type: application/json" \
  -d '{
    "persona": { "age_range":"20-25","gender_presentation":"women","skin_tone":"Fitzpatrick 3","hair":{"length":"long","color_hex":"#2b1b12"},"fashion_style_tags":["streetwear","minimal"] },
    "scenePreset": "city_street_corner",
    "posePreset": "three_quarter",
    "moodboard": { "images": ["https://example.com/mb1.jpg"] },
    "counts": { "candidates": 8, "variants": 50 },
    "video": { "enabled": false }
  }' | jq .
