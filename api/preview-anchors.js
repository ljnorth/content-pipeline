import { AnchorBuilder } from '../src/automation/anchors.js';
import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res){
  try{
    const { username, k = 24 } = req.query || {};
    if (!username) return res.status(400).json({ error: 'username required' });
    const db = new SupabaseClient();
    const { data: prof } = await db.client
      .from('account_profiles')
      .select('content_strategy')
      .eq('username', username)
      .single();
    const inspo = prof?.content_strategy?.inspoAccounts || [];
    if (!Array.isArray(inspo) || inspo.length === 0){
      return res.json({ anchor:null, images:[], message:'no inspoAccounts configured' });
    }
    const ab = new AnchorBuilder();
    const { anchor } = await ab.buildAnchorsFromInspo(inspo, Number(prof?.content_strategy?.anchorSettings?.windowDays || 90));
    if (!anchor) return res.json({ anchor:null, images:[] });
    const nn = await ab.nearestBySql(anchor, Number(k));
    res.json({ anchor, images: nn });
  }catch(e){ res.status(500).json({ error: e.message }); }
}


