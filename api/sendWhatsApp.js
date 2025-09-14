// Rate limit פשוט בזיכרון
const cache = new Map();
const RATE_LIMIT_MS = 1000;
const okRate = (k) => {
  const n = Date.now();
  if (cache.has(k) && n - cache.get(k) < RATE_LIMIT_MS) return false;
  cache.set(k, n);
  return true;
};

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
    const { title, message, to = "group" } = req.body || {};
    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }
    if (!okRate("sendWhatsApp")) {
      return res.status(429).json({ success: false, error: "Rate limit exceeded" });
    }

    const {
      ID_INSTANCE,
      API_TOKEN_INSTANCE,
      NOTIFY_ADMIN_PHONE_E164,
      NOTIFY_ADMIN_GROUP_ID,
    } = process.env;

    if (!ID_INSTANCE || !API_TOKEN_INSTANCE || !NOTIFY_ADMIN_PHONE_E164 || !NOTIFY_ADMIN_GROUP_ID) {
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    // ✅ פה ההבדל הקריטי: בוחרים בין פרטי לקבוצה
    const clean = NOTIFY_ADMIN_PHONE_E164.replace(/^\+/, "");
    const targetId =
      to === "admin"
        ? `${clean}@c.us`
        : NOTIFY_ADMIN_GROUP_ID; // ← שולח לקבוצה

    const apiUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;
    const fullMessage = title ? `*${title}*\n\n${message}` : message;

    const payload = { chatId: targetId, message: fullMessage };

    const r = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: data.message || "Green-API error",
      });
    }

    return res.status(200).json({
      success: true,
      messageId: data.idMessage,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
