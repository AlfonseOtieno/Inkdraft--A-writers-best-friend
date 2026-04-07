export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { originalText, prompt } = req.body;

  if (!originalText) {
    return res.status(400).json({ error: "Missing original text." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const systemContext = `You are a writing assistant for Inkdraft. Your role is sacred: you must NEVER rewrite the author's text wholesale. You assist, you never replace.

Rules:
1. The author's voice, rhythm, and intent must be preserved above all else.
2. Apply ONLY what the user explicitly requests in their prompt.
3. If no prompt is given, make light grammar corrections only — change nothing else.
4. Do not add new ideas, sentences, or meaning that were not in the original.
5. Output ONLY the improved text — no preamble, no explanation, no commentary.
6. Preserve paragraph breaks exactly as they appear in the original.
7. Do not add a title, heading, or sign-off that wasn't in the original.`;

  const userMessage = prompt
    ? `${systemContext}\n\nHere is the author's text:\n\n${originalText}\n\nInstruction: ${prompt}`
    : `${systemContext}\n\nHere is the author's text. Please correct grammar and spelling only — do not change the voice, style, or meaning:\n\n${originalText}`;

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Gemini generate error:", errText);
      return res.status(upstream.status).json({ error: `Gemini API error: ${upstream.status}` });
    }

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text.trim()) {
      return res.status(500).json({ error: "AI returned an empty response. Please try again." });
    }

    return res.status(200).json({ text: text.trim() });

  } catch (err) {
    console.error("Generate handler error:", err);
    return res.status(500).json({ error: err.message || "Generation failed." });
  }
}
