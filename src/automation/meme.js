import OpenAI from 'openai';

export function computeCalendarContext(now = new Date(), tz = 'America/New_York', audienceKind='adult'){
  const d = new Date(now.toLocaleString('en-US', { timeZone: tz }));
  const m = d.getMonth()+1; const dd = d.getDate();
  const season = (m<=2||m===12)?'winter':(m<=5?'spring':(m<=8?'summer':'fall'));
  const events = [];
  if (m===8||m===9) events.push(audienceKind==='teen'?'back_to_school':'fall_refresh');
  if (m===10) events.push('halloween');
  if (m===11) events.push('thanksgiving','black_friday');
  if (m===12) events.push('holiday','gift_list','new_year_coming');
  if (m===1 && dd<15) events.push('new_year_goals');
  if (m===2) events.push('valentines');
  if (m===3||m===4) events.push('spring_break');
  if (m===4||m===5) events.push('prom_graduation');
  return { season, events: [...new Set(events)] };
}

export async function generateMemeCopy({ username, profile, aesthetic, useCalendarChance=0.35 }){
  const tz = profile?.timezone || 'America/New_York';
  const ta = String(profile?.target_audience?.age||'');
  const audienceKind = (ta.includes('13')||ta.includes('18')) ? 'teen' : 'adult';
  const { season, events } = computeCalendarContext(new Date(), tz, audienceKind);
  const useCalendar = (events.length>0) && (Math.random() < useCalendarChance);
  const hook = useCalendar ? (events[0]) : null;
  const nowIso = new Date().toISOString();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You write short meme headers for vertical fashion videos.
Constraints:
- Max 60 chars, 1–2 very short lines. No emojis/hashtags.
- Audience: ${JSON.stringify(profile?.target_audience||{})}
- Aesthetic theme: ${aesthetic||'mixed'}
- Now: ${nowIso} | Season: ${season} | Event: ${hook||'none'}
Write something relatable for this account. If Event is 'none', ignore calendar. If not, weave it lightly.
Return JSON: {"text":"...","calendar_used":${useCalendar}}`;
  const r = await openai.chat.completions.create({
    model:'gpt-4o-mini', messages:[{role:'user', content:prompt}], response_format:{type:'json_object'}, max_tokens:80, temperature:0.6
  });
  const out = JSON.parse(r.choices?.[0]?.message?.content || '{}');
  if (!out.text || out.text.length>60) throw new Error('meme copy invalid');
  return out;
}


