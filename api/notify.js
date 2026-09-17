export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'Missing API key' });

  const { type, property, survey, slot, contact, partialStep } = req.body;

  const RECIPIENTS = [
    'gosia@avantmanagement.la'
  ];

  function formatSurvey(s) {
    if (!s) return '<p><em>No data yet.</em></p>';
    const rows = [
      ['Number of people', s.people],
      ['Preferred move-in date', s.moveIn],
      ['Pet', s.pet || 'Not specified'],
      ['Pet details', s.petDetail],
      ['Employment status', s.employment],
      ['Monthly income', s.earnings],
      ['Lease duration', s.leaseDuration],
      ['Existing lease to terminate', s.hasLease],
      ['Additional notes', s.notes],
    ].filter(([, v]) => v);

    return `<table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:40%;border-bottom:1px solid #e0e0e0">${k}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0">${v}</td>
        </tr>`).join('')}
    </table>`;
  }

  function formatSlot(sl) {
    if (!sl) return '<em>No time slot selected yet.</em>';
    const d = new Date(sl.datetime);
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  let subject, html;

  if (type === 'partial') {
    subject = `[Portal ALML] Incomplete application — ${property} (step: ${partialStep})`;
    html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0a0a0a;color:#fff;padding:20px 24px">
          <h2 style="margin:0;font-size:18px;font-weight:400;letter-spacing:.1em">ALML Properties — Incomplete Application</h2>
        </div>
        <div style="padding:24px">
          <p style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:.1em">Apartment</p>
          <p style="font-size:16px;margin:4px 0 20px"><strong>${property}</strong></p>
          <p style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:.1em">Last completed step</p>
          <p style="font-size:14px;margin:4px 0 20px">${partialStep}</p>
          <p style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:.1em">Data entered so far</p>
          <div style="margin-top:8px">${formatSurvey(survey)}</div>
          <p style="margin-top:20px;font-size:12px;color:#aaa">The applicant did not complete the booking process.</p>
        </div>
      </div>`;
  } else if (type === 'booking') {
    subject = `[Portal ALML] New viewing booked — ${property} · ${formatSlot(slot)}`;
    html = `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0a0a0a;color:#fff;padding:20px 24px">
          <h2 style="margin:0;font-size:18px;font-weight:400;letter-spacing:.1em">ALML Properties — New Viewing Booked</h2>
        </div>
        <div style="padding:24px">
          <div style="background:#f0ede8;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.1em">Viewing time</p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:400">${formatSlot(slot)}</p>
            <p style="margin:4px 0 0;font-size:14px;color:#555">${property}</p>
          </div>
          <p style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:.1em">Contact details</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 24px">
            <tr>
              <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:40%;border-bottom:1px solid #e0e0e0">Name</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0">${contact?.name || '—'}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;border-bottom:1px solid #e0e0e0">Phone</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0">${contact?.phone || '—'}</td>
            </tr>
          </table>
          <p style="color:#888;font-size:13px;text-transform:uppercase;letter-spacing:.1em">Application summary</p>
          <div style="margin-top:8px">${formatSurvey(survey)}</div>
        </div>
      </div>`;
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ALML Portal <onboarding@resend.dev>',
        to: RECIPIENTS,
        subject,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Resend error');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
