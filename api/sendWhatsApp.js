export default async function handler(req, res) {
  // ✅ טיפול ב-CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const idInstance = process.env.ID_INSTANCE;
    const apiTokenInstance = process.env.API_TOKEN_INSTANCE;
    const adminPhone = process.env.NOTIFY_ADMIN_PHONE_E164;

    if (!idInstance || !apiTokenInstance || !adminPhone) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    const cleanPhone = adminPhone.replace(/^\+/, "");
    const apiUrl = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
    const fullMessage = title ? `*${title}*\n\n${message}` : message;

    const payload = {
      chatId: `${cleanPhone}@c.us`,
      message: fullMessage,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error || data.message || "Unknown error",
        greenApiResponse: data,
      });
    }

    return res.status(200).json({
      success: true,
      messageId: data.idMessage,
      greenApiResponse: data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
