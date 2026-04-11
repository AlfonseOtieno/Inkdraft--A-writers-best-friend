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

  const prompt = `You are a handwriting transcription engine. Your job is to transcribe handwritten text AND honestly report your confidence for every word.

OUTPUT FORMAT — you must return a JSON object with this exact shape:
{
  "words": [
    { "text": "word", "confident": true },
    { "text": "unclear_word", "confident": false },
    { "text": "\\n", "confident": true }
  ]
}

RULES — follow every single one:
1. Return ONLY the raw JSON object. No markdown fences, no preamble, no explanation.
2. Split the handwriting into individual words. Each word is one entry in the array.
3. For line breaks, insert an entry: { "text": "\\n", "confident": true }
4. For paragraph breaks (blank lines), insert TWO newline entries in a row.
5. "confident": true means you can clearly read this word with high certainty.
6. "confident": false means the word is smudged, ambiguous, partially illegible, or you are guessing. Be strict — if there is any reasonable doubt, mark it false.
7. If a word is completely illegible, use "text": "[illegible]" and "confident": false.
8. Do NOT correct spelling. Transcribe exactly what is written, even if it looks like a mistake.
9. Do NOT add words that are not in the image.
10. Punctuation attached to a word (e.g. "word,") should be included in that word's text.

Be honest and strict about confidence. It is better to mark too many words as uncertain than to silently guess wrong. The writer depends on your honesty to catch errors.`;

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
            maxOutputTokens: 4000,
            responseMimeType: "application/json",
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
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse the word-confidence JSON
    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: if JSON fails, return raw text without confidence data
      console.error("OCR JSON parse failed, returning raw text");
      return res.status(200).json({ text: raw.trim(), words: null });
    }

    if (!Array.isArray(parsed.words)) {
      return res.status(500).json({ error: "Unexpected OCR response format." });
    }

    // Build the plain text for the textarea
    let plainText = "";
    for (const w of parsed.words) {
      if (w.text === "\n") {
        plainText += "\n";
      } else {
        plainText += (plainText && !plainText.endsWith("\n") ? " " : "") + w.text;
      }
    }

    return res.status(200).json({
      text: plainText.trim(),
      words: parsed.words,
    });

  } catch (err) {
    console.error("OCR handler error:", err);
    return res.status(500).json({ error: err.message || "OCR failed." });
  }
}
