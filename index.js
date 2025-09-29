// Root launcher for Render worker
// Install crash/rejection guards BEFORE importing the worker
process.on('unhandledRejection', (reason) => {
  try {
    const msg = (reason && reason.stack) || (reason && reason.message) || JSON.stringify(reason);
    console.error('[root] unhandledRejection', msg);
  } catch(_) { console.error('[root] unhandledRejection <non-printable>'); }
});
process.on('uncaughtException', (err) => {
  try {
    const msg = (err && err.stack) || (err && err.message) || String(err);
    console.error('[root] uncaughtException', msg);
  } catch(_) { console.error('[root] uncaughtException <non-printable>'); }
});

// Keeping this at repo root avoids Start Command path issues
import './worker/index.js';


