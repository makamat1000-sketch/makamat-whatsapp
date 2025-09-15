import { groups } from "./groupsConfig.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, message, image } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const { ID_INSTANCE, API_TOKEN_INSTANCE, WEBHOOK_TOKEN } = process.env;
    if (req.headers["x-webhook-token"] !== WEBHOOK_TOKEN) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const apiUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;
    const fullMessage = `${title ? `*${title}*\n\n` : ""}${message}\n\n— הודעה זו נשלחה אוטומטית מאתר *MAKAMAT* 🔗 https://makamat-shlomo.com`;

    const results = [];
    for (const chatId of groups) {
      const payload = image
        ? { chatId, urlFile: image, caption: fullMessage }
        : { chatId, message: fullMessage };

      const r = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      results.push(await r.json());
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("💥 Broadcast error:", err);
    return res.status(500).json({ error: err.message });
  }
}
