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

  const criticPrompt = `You are a literary editor and writing critic for Inkdraft. Your role is to evaluate the writer's work honestly — pointing out what is strong, what is weak, and exactly where improvements can be made.

CRITICAL RULES:
1. You are an editor, not a ghostwriter. Do NOT rewrite, rephrase, or generate any replacement text.
2. Do NOT produce a "corrected version" of the writer's work.
3. Reference specific lines, phrases, or passages from the original text when pointing out issues.
4. If the writer's work is strong in a particular area, say so clearly and specifically.
5. If there are no significant problems in an area, do not invent them.
6. Be honest but constructive. A good editor respects the writer's voice.
7. Structure your critique clearly with headings based on what the writer asked you to evaluate.
8. Keep your critique focused ONLY on what the writer has asked you to look at in their prompt.
9. End with a brief overall assessment — one or two sentences on the writing's current state.

The writer will tell you what to evaluate. Focus only on that. Do not evaluate things they did not ask about.`;

  const userMessage = prompt
    ? `${criticPrompt}\n\nHere is the writer's text:\n\n"""\n${originalText}\n"""\n\nWhat the writer wants you to evaluate:\n${prompt}`
    : `${criticPrompt}\n\nHere is the writer's text:\n\n"""\n${originalText}\n"""\n\nThe writer has not specified what to evaluate. Give a brief general assessment covering: overall clarity, any obvious structural issues, and the strength of the writing voice. Keep it concise.`;

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("Gemini critic error:", errText);
      return res.status(upstream.status).json({ error: "Gemini API error: " + upstream.status });
    }

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text.trim()) {
      return res.status(500).json({ error: "AI returned an empty response. Please try again." });
    }

    return res.status(200).json({ critique: text.trim() });

  } catch (err) {
    console.error("Critic handler error:", err);
    return res.status(500).json({ error: err.message || "Critique failed." });
  }
}
