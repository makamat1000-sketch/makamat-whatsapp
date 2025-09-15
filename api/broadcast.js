import { GROUPS, SIGNATURE } from "./groupsConfig.js";

export default async function handler(req, res) {
  // טיפול ב־CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Token");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // אימות עם הטוקן
  const token = req.headers["x-webhook-token"];
  if (token !== process.env.WEBHOOK_TOKEN) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { title, message, image } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "Message is required" });
    }

    const { ID_INSTANCE, API_TOKEN_INSTANCE } = process.env;
    if (!ID_INSTANCE || !API_TOKEN_INSTANCE) {
      return res.status(500).json({ success: false, error: "Missing Green API credentials" });
    }

    const apiUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;

    // הודעה מלאה עם חתימה
    const fullMessage = `${title ? `*${title}*\n\n` : ""}${message}\n\n${SIGNATURE}`;

    const results = [];

    for (const chatId of GROUPS) {
      const payload = image
        ? { chatId, urlFile: image, caption: fullMessage }
        : { chatId, message: fullMessage };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      results.push({
        chatId,
        status: response.ok ? "sent" : "failed",
        messageId: data.idMessage || null,
        error: response.ok ? null : data.error || data.message || "Unknown error",
      });
    }

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error("💥 Broadcast error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
