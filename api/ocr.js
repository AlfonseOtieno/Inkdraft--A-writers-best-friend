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

  // Step 1: Plain transcription — exact text, uncertain words in {{double braces}}
  const transcribePrompt = `You are a handwriting transcription engine. Transcribe the handwritten text in this image.

OUTPUT RULES — follow exactly:
1. Output ONLY the transcribed text. No explanation, no preamble, no commentary.
2. Copy the EXACT words as written. Do NOT fix spelling or grammar.
3. Preserve line breaks and paragraph breaks exactly as on the paper.
4. For words you can read clearly: write them normally.
5. For words you are uncertain about (smudged, ambiguous, hard to read): wrap them in double curly braces like {{this}}.
6. For completely illegible sections: write {{illegible}}.
7. Do NOT invent or add words that are not visible in the image.
8. Be honest — if you are not fully certain about a word, mark it with {{braces}}.`;

  // Step 2: Grammar check — find positions of grammar errors
  const grammarPrompt = `You are a grammar checker. You will be given a piece of text transcribed from handwriting.

Your job: identify grammar and spelling errors in the text.

Return ONLY a JSON array of the exact error words/phrases, like this:
["word1", "phrase two", "word3"]

Rules:
- Only include clear grammar or spelling errors.
- Do NOT include uncertain words that are marked with {{braces}} — those are OCR uncertainty, not grammar errors.
- If there are no errors, return an empty array: []
- Return ONLY the raw JSON array, nothing else.`;

  try {
    // ── CALL 1: Transcribe ──────────────────────────────
    const transcribeRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: transcribePrompt }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
        }),
      }
    );

    if (!transcribeRes.ok) {
      const errText = await transcribeRes.text();
      console.error("Gemini transcribe error:", errText);
      return res.status(transcribeRes.status).json({ error: `Gemini API error: ${transcribeRes.status}` });
    }

    const transcribeData = await transcribeRes.json();
    const rawText = transcribeData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!rawText) {
      return res.status(500).json({ error: "No text could be extracted from the image." });
    }

    // Parse uncertain words from {{braces}}
    const uncertainWords = [];
    const plainText = rawText.replace(/\{\{([^}]+)\}\}/g, (match, word) => {
      uncertainWords.push(word);
      return word; // strip braces for plain text, keep the word
    });

    // ── CALL 2: Grammar check (on plain text) ──────────
    let grammarErrors = [];
    try {
      const grammarRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: `${grammarPrompt}\n\nText to check:\n${plainText}` }]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
          }),
        }
      );

      if (grammarRes.ok) {
        const grammarData = await grammarRes.json();
        const grammarRaw = grammarData?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        const grammarClean = grammarRaw.replace(/```json|```/g, "").trim();
        grammarErrors = JSON.parse(grammarClean);
        if (!Array.isArray(grammarErrors)) grammarErrors = [];
      }
    } catch (grammarErr) {
      console.warn("Grammar check failed (non-fatal):", grammarErr.message);
      grammarErrors = [];
    }

    return res.status(200).json({
      text: plainText.trim(),
      uncertainWords,
      grammarErrors,
    });

  } catch (err) {
    console.error("OCR handler error:", err);
    return res.status(500).json({ error: err.message || "OCR failed." });
  }
}
