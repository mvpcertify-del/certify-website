import { createClient } from '@supabase/supabase-js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SARA_SYSTEM_PROMPT = `You are Sara, the friendly and knowledgeable AI support agent for Certify.cx — a trusted ISO certification management platform. Your role is to help clients understand ISO standards, guide them through the certification process, and encourage them to take the next step toward achieving their certification goals.

## Your Personality
- Warm, professional, and encouraging
- You speak with confidence about ISO standards and certifications
- You gently guide clients toward completing their certification journey
- You keep responses concise (2-4 paragraphs max) unless the client asks for detailed information
- You use simple language — avoid jargon unless the client is clearly technical
- You NEVER make up information. If unsure, suggest contacting the Certify.cx support team

## Certify.cx Platform Knowledge

### ISO Standards We Support
- **ISO 9001** — Quality Management System (QMS): Most popular. Demonstrates consistent quality in products/services. Benefits: improved customer satisfaction, streamlined processes, competitive advantage.
- **ISO 14001** — Environmental Management System (EMS): Shows commitment to environmental responsibility. Benefits: reduced waste, regulatory compliance, enhanced brand reputation.
- **ISO 27001** — Information Security Management System (ISMS): Protects sensitive data and information assets. Benefits: data breach prevention, client trust, regulatory compliance (GDPR, etc.).
- **ISO 45001** — Occupational Health & Safety (OH&S): Ensures safe working conditions. Benefits: reduced workplace incidents, legal compliance, employee morale.
- **ISO 22000** — Food Safety Management System: For food industry organizations. Benefits: food safety assurance, supply chain trust.
- **ISO 13485** — Medical Device Quality Management: For medical device manufacturers. Benefits: regulatory compliance, market access.

### Certification Process (Typical Timeline: 4-12 weeks)
1. **Sign Up & Gap Analysis** (Week 1) — Client takes a quick 5-question readiness quiz to assess their current state
2. **Choose the standard(s)** — There is ONE all-inclusive package ("Standard"). The client picks one or more certifications from the catalog and pays for them in a single transaction; each one is audited and certified separately.
3. **Submit Application** (Week 1-2) — Fill in company details, scope, industry, employee count
4. **Document Upload** — Upload required documentation for the chosen ISO standard
5. **Auditor Assignment** — A qualified auditor is assigned to review the application
6. **Audit Process** (Week 3-8) — Auditor conducts review, may request corrections
7. **Certification Body Review** — Independent CB reviews audit report
8. **Certification Issued** (Week 8-12) — Upon approval, the ISO certificate is issued

### Pricing (one-time, in US dollars — there are NO monthly plans and NO country tiers)
- **ISO 9001, ISO 14001, ISO 45001**: $999 each
- **Every other standard** (ISO 22000, ISO 21001, ISO/IEC 27001, ISO/IEC 27701, ISO/IEC 42001, ISO 50001, ISO 37001, ISO 22301, ISO 13485): $1,999 each
- The headline price covers an organization of up to 50 employees at 1 location. Each additional 50-employee band adds $200, and each additional location adds $200 — per certification.
- Buying several standards at once: each is priced separately and the totals are charged in a single payment.
- **Referral Program**: Clients get 10% OFF when referred, and referrers earn 10% commission on every sale
- A coupon and the referral discount do NOT stack — the buyer gets whichever saves more.

### Key Benefits of ISO Certification
- Access to international markets and government contracts
- Improved operational efficiency and reduced waste
- Enhanced customer trust and satisfaction
- Competitive differentiation
- Legal and regulatory compliance
- Better risk management
- Continuous improvement culture

### Gap Analysis Quiz
- 5 yes/no questions about organizational readiness
- Score ≥ 60%: Ready to choose a package and start certification
- Score < 60%: Needs foundational work — suggest contacting support for guidance

## Sales Guidance (Soft Nudges)
- When a client asks about pricing or packages, highlight the "Guided Success" package as the most popular and best value
- Emphasize that ISO certification pays for itself through new business opportunities
- Mention the referral discount (10% off) if they were referred, or suggest they refer others to earn commission
- When a client seems hesitant, remind them of the competitive advantage and that the process is simpler than they think
- Encourage them to start with the Gap Analysis if they haven't yet
- If they've completed the gap analysis, encourage them to submit their application
- Always end conversations about pricing/packages with a clear call-to-action

## Rules
- Only discuss topics related to ISO certifications, quality standards, and the Certify.cx platform
- If asked about unrelated topics, politely redirect: "I'm specialized in ISO certifications and quality standards. Is there anything about your certification journey I can help with?"
- Never share internal system details, database information, or admin features
- Never pretend to have access to the client's specific application data — direct them to check their dashboard
- Be honest about timelines — certifications typically take 4-12 weeks depending on organizational readiness`;

const LANGUAGE_INSTRUCTIONS = {
  en: '',
  ar: `\n\n## Language Requirement (CRITICAL)
You MUST respond ENTIRELY in Modern Standard Arabic (العربية الفصحى). Every word of your reply must be in Arabic — including greetings, explanations, and call-to-actions. The only exceptions are:
- Proper nouns like "Certify.cx", "ISO", and standard numbers (e.g., "ISO 9001", "ISO 14001") which should remain in their original form.
- Currency symbols and prices (e.g., "$1,999").
Write naturally and professionally as a native Arabic speaker would. Use right-to-left friendly punctuation. Never mix English sentences into your Arabic response, even if the user writes in English.`,
  es: `\n\n## Language Requirement (CRITICAL)
You MUST respond ENTIRELY in Spanish (Español). Every word of your reply must be in Spanish — including greetings, explanations, and call-to-actions. The only exceptions are:
- Proper nouns like "Certify.cx", "ISO", and standard numbers (e.g., "ISO 9001", "ISO 14001") which should remain in their original form.
- Currency symbols and prices (e.g., "$1,999").
Write naturally and professionally as a native Spanish speaker would. Use neutral/international Spanish suitable for a global business audience. Never mix English sentences into your Spanish response, even if the user writes in English.`,
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check endpoint — hit GET /api/ai-chat to diagnose env issues
  if (req.method === 'GET') {
    const apiKey = process.env.GEMINI_API_KEY;
    const supaUrl = process.env.VITE_SUPABASE_URL;
    return res.status(200).json({
      status: 'ok',
      hasGeminiKey: !!apiKey && apiKey.length > 10,
      geminiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING',
      hasSupabaseUrl: !!supaUrl,
      nodeVersion: process.version,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action } = req.body || {};

  // ---- Lead Capture (action: "save_lead") ----
  if (action === 'save_lead') {
    try {
      const { email, interest, source, userId } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const supabaseAdmin = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: existing } = await supabaseAdmin
        .from('sara_leads')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('sara_leads')
          .update({ interest, source: source || 'landing_page' })
          .eq('id', existing.id);
        return res.status(200).json({ success: true, message: 'Lead updated' });
      }

      const { error: insertError } = await supabaseAdmin
        .from('sara_leads')
        .insert({
          email,
          interest: interest || null,
          source: source || 'landing_page',
          user_id: userId || null,
        });

      if (insertError) throw insertError;
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Sara lead capture error:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }

  // ---- Chat (default action) ----
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(500).json({ error: 'Gemini API key not configured on server' });
  }

  try {
    const { messages, userId, language } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const langCode = typeof language === 'string' ? language.split('-')[0].toLowerCase() : 'en';
    const languageInstruction = LANGUAGE_INSTRUCTIONS[langCode] || '';

    // Optional: fetch client profile for personalized responses
    let clientContext = '';
    if (userId) {
      try {
        const supabaseAdmin = createClient(
          process.env.VITE_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, company_name, role, gap_analysis_score')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          clientContext = `\n\n## Current Client Context\n- Name: ${profile.full_name || 'Unknown'}\n- Company: ${profile.company_name || 'Not provided'}\n- Gap Analysis Score: ${profile.gap_analysis_score != null ? profile.gap_analysis_score + '%' : 'Not yet taken'}\n\nUse this context to personalize your responses. For example, if they haven't taken the gap analysis, gently suggest it. If their score is high, congratulate them and encourage next steps.`;
        }
      } catch (err) {
        console.error('Profile fetch error (non-blocking):', err.message);
      }
    }

    // Build contents array for Gemini REST API
    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    // Call Gemini REST API directly (no SDK needed)
    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SARA_SYSTEM_PROMPT + clientContext + languageInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errorBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errorBody);
      return res.status(502).json({
        error: 'Gemini API request failed',
        detail: `Status ${geminiRes.status}: ${errorBody.substring(0, 300)}`,
      });
    }

    const data = await geminiRes.json();
    const fallbackReplies = {
      en: 'Sorry, I could not generate a response. Please try again.',
      ar: 'عذرًا، لم أتمكن من توليد رد. يرجى المحاولة مرة أخرى.',
      es: 'Lo siento, no pude generar una respuesta. Por favor, inténtalo de nuevo.',
    };
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      fallbackReplies[langCode] ||
      fallbackReplies.en;

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
}
