export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing image data." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const prompt = `You are a precise handwriting transcription engine. Your only job is to transcribe handwritten text from images with perfect fidelity.

RULES — follow every single one:
1. Output ONLY the transcribed text. No preamble. No explanation. No commentary.
2. Preserve the EXACT words, spelling, punctuation, and line breaks as written. Do NOT correct anything.
3. If a word is unclear, make your best guess and wrap it in [brackets] so the writer can verify.
4. If a section is completely illegible, write [illegible].
5. Preserve paragraph breaks exactly as they appear.
6. Do not add any text that is not in the image.
7. Do not describe the image. Just transcribe the text.

Transcribe this handwritten text exactly as written.`;

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                }
              },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Gemini OCR error:", errText);
      return res.status(upstream.status).json({ error: `Gemini API error: ${upstream.status}` });
    }

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text.trim()) {
      return res.status(500).json({ error: "No text could be extracted from the image." });
    }

    return res.status(200).json({ text: text.trim() });

  } catch (err) {
    console.error("OCR handler error:", err);
    return res.status(500).json({ error: err.message || "OCR failed." });
  }
}
