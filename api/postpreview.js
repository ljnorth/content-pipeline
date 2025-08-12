import { SupabaseClient } from '../src/database/supabase-client.js';

export default async function handler(req, res) {
  const { batchId } = req.query;
  if (!batchId) {
    return res.status(400).json({ error: 'batchId is required' });
  }

  try {
    const db = new SupabaseClient();
    const { data: batch, error } = await db.client
      .from('preview_batches')
      .select('*')
      .eq('preview_id', batchId)
      .single();

    if (error || !batch) {
      return res.status(404).send(renderNotFound(batchId));
    }

    const html = renderPage(batchId, batch.account_username, batch.posts || []);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send(`<pre>${e.message}</pre>`);
  }
}

function renderNotFound(batchId) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Preview Not Found</title><link rel="stylesheet" href="/assets/style.css"></head><body><main style="max-width:900px;margin:40px auto;padding:24px"><h2>Preview not found</h2><p>We couldn't find a preview for ID <code>${batchId}</code>. It may have expired.</p></main></body></html>`;
}

function renderPage(batchId, username, posts) {
  const firstPost = Array.isArray(posts) && posts.length ? posts[0] : null;
  const caption = firstPost?.caption || `Daily content for @${username}`;
  const images = firstPost?.images || [];
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview – ${username}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/style.css">
  <style>
    body { background: linear-gradient(135deg,#667eea 0%,#764ba2 100%); }
    .container { max-width: 1100px; margin: 24px auto; padding: 16px; }
    .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 8px 28px rgba(0,0,0,.08); }
    .tabs { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px }
    .tab { padding:8px 12px; border-radius:8px; background:#eee; cursor:pointer; font-weight:600; }
    .tab.active { background:#667eea; color:#fff }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap: 16px; }
    .thumb { width: 100%; height: 280px; object-fit: cover; border-radius: 10px; }
    .bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
    .pill { padding:10px 14px; border-radius:8px; background:#667eea; color:#fff; border:none; cursor:pointer; font-weight:600 }
    .pill.secondary { background:#6c757d }
    .pill.warn { background:#ff6b35 }
    .muted { color:#666 }
  </style>
 </head>
 <body>
  <header class="nav"><div class="nav-inner">
    <div class="brand"><span class="dot"></span> EasyPost</div>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/managed.html">Managed</a>
      <a href="/sources.html">Sources</a>
      <a href="/random.html">Random</a>
      <a href="/docs.html">Docs</a>
    </div>
  </div></header>
  <main class="container">
    <div class="card" style="margin-bottom:16px">
      <h2>Preview for @${username}</h2>
      <p class="muted">Batch: ${batchId}</p>
      <div class="tabs" id="postTabs"></div>
      <div class="bar" style="margin-top:8px">
        <button class="pill" id="downloadAll">📦 Download All</button>
        <button class="pill" id="downloadSelected">📥 Download Selected</button>
        <button class="pill secondary" id="selectAll">Select All</button>
        <button class="pill secondary" id="clearAll">Clear</button>
        <button class="pill warn" id="rerollSelected">🔄 Replace Selected</button>
        <span id="status" class="muted"></span>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div id="caption" style="background:#f8f9fa;border-left:4px solid #667eea;padding:12px;border-radius:8px">${escapeHtml(caption)}</div>
    </div>
    <div class="grid" id="grid">
      ${images.map(img => renderImage(img)).join('')}
    </div>
  </main>
  <script>
    const batchId = ${JSON.stringify(batchId)};
    const username = ${JSON.stringify(username)};
    const posts = ${JSON.stringify(posts)};
    let currentIndex = 0;
    function setStatus(t, kind){ const el=document.getElementById('status'); el.textContent=t; el.style.color = kind==='err'?'#b00020':'#666'; }
    function allCheckboxes(){ return Array.from(document.querySelectorAll('.imgcb')); }
    function renderTabs(){
      const tabs = document.getElementById('postTabs');
      tabs.innerHTML = '';
      posts.forEach((p, i) => {
        const b = document.createElement('button');
        b.className = 'tab' + (i===currentIndex ? ' active' : '');
        b.textContent = 'Post ' + (i+1);
        b.onclick = () => { currentIndex = i; renderPost(); renderTabs(); };
        tabs.appendChild(b);
      });
    }
    function renderPost(){
      const post = posts[currentIndex] || { caption: 'Post '+(currentIndex+1), images: [] };
      document.getElementById('caption').textContent = post.caption || 'Post ' + (currentIndex+1);
      const grid = document.getElementById('grid');
      grid.innerHTML = (post.images||[]).map(img => ${renderImage.toString()}(img)).join('');
    }
    document.getElementById('selectAll').onclick = ()=>{ allCheckboxes().forEach(cb=>cb.checked=true); setStatus('Selected '+allCheckboxes().length+' images'); };
    document.getElementById('clearAll').onclick = ()=>{ allCheckboxes().forEach(cb=>cb.checked=false); setStatus('Cleared selection'); };
    document.getElementById('downloadAll').onclick = ()=>{ window.location.href = '/api/postpreview/download/'+encodeURIComponent(batchId)+'?post='+(currentIndex+1); };
    document.getElementById('downloadSelected').onclick = ()=>{
      const ids = allCheckboxes().filter(cb=>cb.checked).map(cb=>parseInt(cb.value));
      if(ids.length===0){ setStatus('Select at least one image to download','err'); return; }
      var url = '/api/postpreview/download-selected/'+encodeURIComponent(batchId)+'?post='+(currentIndex+1)+'&imageIds='+ids.join(',');
      window.location.href = url;
    };
    document.getElementById('rerollSelected').onclick = async ()=>{
      const ids = allCheckboxes().filter(cb=>cb.checked).map(cb=>parseInt(cb.value));
      if(ids.length===0){ setStatus('Select at least one image to replace','err'); return; }
      const existingIds = Array.from(document.querySelectorAll('.imgcb')).map(cb=>parseInt(cb.value));
      setStatus('Replacing '+ids.length+' images...');
      try {
        const res = await fetch('/api/reroll-images-instant',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ imageIds: ids, accountUsername: username, existingImageIds: existingIds })});
        const json = await res.json();
        if(!res.ok || json.success===false){ throw new Error(json.error||'Failed'); }
        let i=0; for(const id of ids){ const card=document.querySelector('[data-img="'+id+'"]'); if(card){ const newImg=json.newImages[i++]; card.querySelector('img').src = newImg.imagePath || newImg.image_path; card.querySelector('.meta-aesthetic').textContent = newImg.aesthetic || 'mixed'; card.querySelector('.imgcb').value = newImg.id; card.dataset.img = newImg.id; } }
        setStatus('Replaced '+ids.length+' images');
      } catch(e){ setStatus('Error: '+e.message,'err'); }
    };
    renderTabs();
    renderPost();
  </script>
 </body>
 </html>`;
}

function renderImage(img){
  const url = img.imagePath || img.image_path;
  const aid = img.id;
  const aesthetic = img.aesthetic || 'mixed';
  return `<div class="card" data-img="${aid}"><img class="thumb" src="${url}" alt="image" /><div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="imgcb" value="${aid}"/> <span class="muted">ID ${aid}</span></label><span class="muted meta-aesthetic">${aesthetic}</span></div></div>`;
}

function escapeHtml(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }


