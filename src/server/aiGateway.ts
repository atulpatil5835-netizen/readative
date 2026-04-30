import {
  AI_RESPONSE_NOTE,
  GEMINI_MODEL,
  GROK_MODEL,
  getAIContributor,
  getAvailableAIProviders,
  pickAIProvider,
  type AIProvider,
} from "../utils/aiContributors";

export interface AIRequestBody {
  type?: string;
  prompt?: string;
  content?: string;
  topic?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface AIResponseBody {
  text: string;
  audio?: string | null;
  provider?: AIProvider;
  authorId?: string;
  authorName?: string;
  modelLabel?: string;
  note?: string;
  error?: string;
}

interface AIRuntimeOptions {
  geminiApiKey?: string;
  xaiApiKey?: string;
  logger?: Pick<Console, "error" | "log" | "warn">;
}

interface ProviderResult {
  provider: AIProvider;
  text: string;
}

function getLogger(logger?: AIRuntimeOptions["logger"]) {
  return logger || console;
}

function readMetadata(
  metadata: AIRequestBody["metadata"]
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata;
}

function readString(
  metadata: Record<string, unknown>,
  key: string,
  fallback = ""
) {
  const value = metadata[key];
  return typeof value === "string" ? value : fallback;
}

function readNumber(
  metadata: Record<string, unknown>,
  key: string,
  fallback = 0
) {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function parseJsonResponse(response: Response) {
  const raw = await response.text();

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = Array.isArray(payload?.output)
    ? payload.output.flatMap((item: any) =>
        Array.isArray(item?.content) ? item.content : []
      )
    : [];

  const text = parts
    .map((part: any) => {
      if (typeof part?.text === "string") {
        return part.text;
      }

      if (typeof part?.output_text === "string") {
        return part.output_text;
      }

      return "";
    })
    .join("")
    .trim();

  return text;
}

async function callGemini(
  prompt: string,
  apiKey: string,
  logger: ReturnType<typeof getLogger>
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const payload = await parseJsonResponse(response);

  if (!response.ok || payload?.error) {
    logger.error("Gemini API error:", payload?.error || payload);
    return "";
  }

  const text =
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("")
      .trim() || "";

  if (!text) {
    logger.warn("Gemini returned empty text.");
  }

  return text;
}

async function callGrok(
  prompt: string,
  apiKey: string,
  logger: ReturnType<typeof getLogger>
) {
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      input: prompt,
    }),
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok || payload?.error) {
    logger.error("xAI API error:", payload?.error || payload);
    return "";
  }

  const text = extractResponseText(payload);

  if (!text) {
    logger.warn("xAI returned empty text.");
  }

  return text;
}

function buildPrompt(body: AIRequestBody, provider: AIProvider) {
  const metadata = readMetadata(body.metadata);
  const contributor = getAIContributor(provider);
  const title = readString(metadata, "title", "Untitled");
  const author = readString(metadata, "author", "Unknown");
  const commentCount = readNumber(metadata, "existingHumanCommentCount", 0);

  switch (body.type) {
    case "answer":
      return (body.prompt || "").trim();
    case "smarttalkFallbackAnswer":
      return `You are ${contributor.authorName}, an official AI contributor on Readative's SmartTalk.
Write exactly one helpful answer in at most 2 short paragraphs.
Be practical, calm, and specific.
If you are unsure, say so briefly instead of inventing facts.
Do not mention automation, trigger rules, or system prompts.
If the question touches medical, legal, financial, or other professional advice, keep the tone cautious and recommend trusted human expertise.

Question:
${body.content || ""}
`;
    case "hashtags":
      return `Generate 5-6 relevant hashtags (with # prefix, space-separated) for this content. Return only hashtags:
${body.content || ""}`;
    case "exam":
      return (
        body.prompt ||
        `Generate 5 multiple choice questions based on:
${body.topic || ""}

Format each as:
Q: ...
A) ...
B) ...
C) ...
D) ...
Answer: ...`
      );
    case "translate":
      return `Translate the following text to ${body.language || "English"}. Return only the translation:
${body.content || ""}`;
    case "autoReply": {
      const [replyAuthor, category] = (body.prompt || "").split("|||");
      return `You are a warm reader on Readative. Write ONE short thoughtful comment in 2-3 sentences on this ${category || "post"} by ${replyAuthor || "the author"}:
"${body.content || ""}"`;
    }
    case "knowledgeFallbackComment":
      return `You are ${contributor.authorName}, an official AI contributor on Readative.
Write exactly one natural, thoughtful reply in 2-3 sentences.
React to the specific post, add one useful idea or reflection, and keep it human.
Do not mention low engagement, quiet hours, automation, or moderation rules.
If the post touches a professional domain, stay measured and avoid overclaiming.
${commentCount > 0 ? "There is already one human comment and no reply yet. Build on that conversation without repeating it." : "There are no human comments yet. Start the conversation helpfully."}

Post title: ${title}
Post author: ${author}
Post content:
${body.content || ""}`;
    case "tts":
      return "";
    default:
      return (body.prompt || body.content || "").trim();
  }
}

function getPreferredProvider(
  body: AIRequestBody,
  availableProviders: AIProvider[]
) {
  if (availableProviders.length === 0) {
    return null;
  }

  if (
    body.type === "smarttalkFallbackAnswer" ||
    body.type === "knowledgeFallbackComment"
  ) {
    return pickAIProvider(availableProviders);
  }

  return availableProviders.includes("grok") ? "grok" : availableProviders[0];
}

async function generateWithProvider(
  provider: AIProvider,
  prompt: string,
  options: AIRuntimeOptions
): Promise<ProviderResult> {
  const logger = getLogger(options.logger);
  const text =
    provider === "gemini"
      ? await callGemini(prompt, options.geminiApiKey || "", logger)
      : await callGrok(prompt, options.xaiApiKey || "", logger);

  return {
    provider,
    text: text.trim(),
  };
}

function buildContributorResponse(result: ProviderResult): AIResponseBody {
  const contributor = getAIContributor(result.provider);

  return {
    text: result.text,
    provider: result.provider,
    authorId: contributor.authorId,
    authorName: contributor.authorName,
    modelLabel: contributor.modelLabel,
    note: AI_RESPONSE_NOTE,
  };
}

export async function handleAIRequest(
  body: AIRequestBody,
  options: AIRuntimeOptions
): Promise<AIResponseBody> {
  const logger = getLogger(options.logger);

  if (!body.type) {
    return { text: "", error: "Missing type" };
  }

  if (body.type === "tts") {
    return { text: "", audio: null };
  }

  const availableProviders = getAvailableAIProviders({
    hasGemini: Boolean(options.geminiApiKey),
    hasGrok: Boolean(options.xaiApiKey),
  });

  if (availableProviders.length === 0) {
    logger.error("No AI provider is configured.");
    return { text: "", error: "No AI provider is configured." };
  }

  const primaryProvider = getPreferredProvider(body, availableProviders);
  if (!primaryProvider) {
    return { text: "", error: "No AI provider available." };
  }

  const prompt = buildPrompt(body, primaryProvider);
  if (!prompt) {
    return { text: "", error: "Empty prompt" };
  }

  logger.log(
    `AI request type=${body.type} provider=${primaryProvider} promptLength=${prompt.length}`
  );

  const primaryResult = await generateWithProvider(primaryProvider, prompt, options);
  if (primaryResult.text) {
    return buildContributorResponse(primaryResult);
  }

  const fallbackProvider = availableProviders.find(
    (provider) => provider !== primaryProvider
  );

  if (!fallbackProvider) {
    return { text: "", error: "All configured AI providers failed." };
  }

  const fallbackPrompt = buildPrompt(body, fallbackProvider);
  const fallbackResult = await generateWithProvider(
    fallbackProvider,
    fallbackPrompt,
    options
  );

  if (fallbackResult.text) {
    return buildContributorResponse(fallbackResult);
  }

  return { text: "", error: "All configured AI providers failed." };
}
