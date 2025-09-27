export class PostForMe {
  constructor() {
    this.base = (process.env.POST_FOR_ME_API_BASE || 'https://api.postforme.dev/v1').replace(/\/$/, '');
    this.key = process.env.POST_FOR_ME_API_KEY;
    if (!this.key) throw new Error('POST_FOR_ME_API_KEY not set');
  }

  async _req(path, opts = {}) {
    const res = await fetch(`${this.base}${path}` , {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.key}`,
        ...(opts.headers || {})
      }
    });
    const txt = await res.text();
    let body = null;
    try { body = txt ? JSON.parse(txt) : null; } catch { body = txt; }
    if (!res.ok) {
      const msg = (body && (body.error?.message || body.error || body.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return body;
  }

  async listAccounts(platform = 'instagram') {
    const q = new URLSearchParams({ platform });
    return await this._req(`/social-accounts?${q.toString()}`);
  }

  async createPost({ caption, media, social_accounts, scheduled_at = null, platform_configurations = null, account_configurations = null, external_id = null, isDraft = false }) {
    const payload = {
      caption,
      social_accounts,
      ...(Array.isArray(media) && media.length ? { media } : {}),
      ...(scheduled_at ? { scheduled_at } : {}),
      ...(platform_configurations ? { platform_configurations } : {}),
      ...(account_configurations ? { account_configurations } : {}),
      ...(external_id ? { external_id } : {}),
      ...(isDraft ? { isDraft } : {})
    };
    return await this._req('/social-posts', { method: 'POST', body: JSON.stringify(payload) });
  }

  async createUploadUrl() {
    return await this._req('/media/create-upload-url', { method: 'POST' });
  }
}



