import crypto from "crypto";

// דה־דופ: לא לשלוח פעמיים את אותו אירוע תוך 60 שניות
const dedup = new Set();
const touch = (h) => {
  dedup.add(h);
  setTimeout(() => dedup.delete(h), 60000);
};

// רייט־לימיט: מקסימום הודעה אחת בשנייה
const pace = new Map();
const okRate = (k) => {
  const n = Date.now();
  if (pace.has(k) && n - pace.get(k) < 1000) return false;
  pace.set(k, n);
  return true;
};

// מיפוי אירועים → טקסט
function render(event, d = {}) {
  switch (event) {
    case "contact.created":
      return `📝 *פנייה חדשה*\n\n*שם:* ${d.name || "-"}\n*טלפון:* ${d.phone || "-"}\n*אימייל:* ${d.email || "-"}\n*הודעה:* ${d.message || "-"}`;
    case "course.signup":
      return `🎓 *הרשמה לקורס*\n\n*שם:* ${d.name || "-"}\n*קורס:* ${d.course || "-"}\n*טלפון:* ${d.phone || "-"}\n*אימייל:* ${d.email || "-"}`;
    case "payment.succeeded":
      return `💳 *תשלום התקבל*\n\n*שם:* ${d.name || "-"}\n*סכום:* ${d.amount || 0} ₪\n*קורס:* ${d.course || "-"}`;
    case "payment.failed":
      return `⚠️ *תשלום נכשל*\n\n*שם:* ${d.name || "-"}\n*שגיאה:* ${d.error || "-"}`;
    case "error.raised":
      return `🛑 *שגיאה במערכת*\n\n*פרטים:* ${d.error || "-"}`;
    case "user.signup":
      return `👤 *משתמש חדש*\n\n*שם:* ${d.name || "-"}\n*אימייל:* ${d.email || "-"}`;
    default:
      return `🔔 *התראה כללית*\n\n${JSON.stringify(d, null, 2)}`;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Token");
  if (req.method === "OPTIONS") return res.status(200).end();

  // אימות
  const token = req.headers["x-webhook-token"];
  if (token !== process.env.WEBHOOK_TOKEN) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { event, data = {}, to = "group" } = req.body || {};
    if (!event) {
      return res.status(400).json({ success: false, error: "Event is required" });
    }

    // דה־דופ
    const key = crypto.createHash("md5").update(event + JSON.stringify(data)).digest("hex");
    if (dedup.has(key)) {
      return res.status(200).json({ success: true, message: "Duplicate skipped" });
    }
    touch(key);

    // רייט־לימיט
    if (!okRate("notifyEvent")) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded" });
    }

    const msg = render(event, data);
    const { ID_INSTANCE, API_TOKEN_INSTANCE, NOTIFY_ADMIN_PHONE_E164, NOTIFY_ADMIN_GROUP_ID } = process.env;
    if (!ID_INSTANCE || !API_TOKEN_INSTANCE || !NOTIFY_ADMIN_PHONE_E164 || !NOTIFY_ADMIN_GROUP_ID) {
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    const clean = NOTIFY_ADMIN_PHONE_E164.replace(/^\+/, "");
    const chatId = to === "admin" ? `${clean}@c.us` : NOTIFY_ADMIN_GROUP_ID;
    const apiUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;

    const r = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: msg }),
    });

    const j = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: j.message || "Green-API error" });
    }

    return res.status(200).json({ success: true, messageId: j.idMessage });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
