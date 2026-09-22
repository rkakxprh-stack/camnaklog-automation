// generateArticle.js
// 니치 키워드 + 알리익스프레스 상품 정보를 받아 블로그 글(HTML)을 생성합니다.

const DISCLOSURE =
  "<p><em>이 포스팅은 알리익스프레스 어필리에이트 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</em></p>";

function buildButtonBlock(url) {
  return `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"accent-1","textColor":"base","style":{"border":{"radius":"999px"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-base-color has-accent-1-background-color has-text-color has-background wp-element-button" style="border-radius:999px" href="${url}" target="_blank" rel="noopener nofollow sponsored">알리익스프레스에서 가격 확인하기</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
}

function buildSystemPrompt({ keyword, category, product }) {
  return `너는 "핫딜로그"라는 해외직구 꿀템 블로그의 필자야. 이번 글의 카테고리는 "${category}", 소재는 "${keyword}"이고, 실제로 소개할 상품은 "${product.productName}"(가격 약 ${product.price}원)이야.

절대 하지 말아야 할 것 (전형적인 AI 글쓰기 패턴이라 반드시 피해야 해):
- "안녕하세요", "트렌디한", "~을 전해드리는" 같은 정형화된 인사말로 시작하는 것. 첫 문장부터 바로 내용으로 들어가.
- "왜 화제일까?", "핵심 포인트", "정리하면" 같은 뻔한 소제목 패턴. 소제목은 실제 내용을 구체적으로 담은 문장으로 써.
- 모든 문단을 3개짜리 리스트로 구성하는 것. 대부분은 줄글로 풀어써.
- "~할 수 있습니다", "~하는 것이 좋습니다" 같은 격식체 조언 말투의 반복. 실제 써본 사람처럼 구체적인 판단을 담아서 써 ("이 정도면 살 만하다", "가성비는 애매하다" 처럼).
- "또한", "특히", "이는 ~때문입니다" 같은 접속사·설명체 반복.
- 두루뭉술한 일반론. 대신 구체적인 사용 상황, 숫자, 예시를 들어.

이렇게 써:
- 문장 길이를 의도적으로 들쭉날쭉하게.
- "개인적으로는", "솔직히" 같은 주관적 톤 활용 가능.
- 이 상품이 어떤 상황에서 쓸모 있는지, 배송(해외직구라 시간 걸림)까지 감안해서 솔직하게 써.
- 결과는 워드프레스 구텐베르크 블록 HTML 마크업으로 출력해 (<!-- wp:paragraph --> 등 블록 주석 포함), h2 소제목 위주, h1은 쓰지 마.
- 글 맨 처음에는 반드시 이 문장을 그대로 포함해: "${DISCLOSURE}"
- 마지막에는 다음 버튼 블록을 정확히 그대로 포함해:
${buildButtonBlock(product.url)}
- 과장광고나 근거 없는 수치는 쓰지 마.
- 분량은 700~1000자 내외.`;
}

function parseTitleAndContent(fullText, keyword) {
  const titleMatch = fullText.match(/^TITLE:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `${keyword} 해외직구 추천`;
  const content = fullText.replace(/^TITLE:.*$/m, "").trim();
  return { title, content };
}

async function generateWithClaude({ keyword, category, product }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const systemPrompt = buildSystemPrompt({ keyword, category, product });
  const userPrompt = `이 상품을 소개하는 블로그 글을 작성해줘. 글 제목도 하나 지어서 맨 앞줄에 "TITLE: ..." 형식으로 알려줘.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API 호출 실패 (${res.status}): ${text}`);
  }
  const data = await res.json();
  const fullText = data.content.map((b) => b.text || "").join("\n");
  return parseTitleAndContent(fullText, keyword);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce({ apiKey, systemPrompt, userPrompt }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Gemini API 호출 실패 (${res.status}): ${text}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const fullText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
  if (!fullText) throw new Error("Gemini 응답이 비어 있습니다 (안전 필터에 걸렸을 수 있어요).");
  return fullText;
}

async function generateWithGemini({ keyword, category, product }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = buildSystemPrompt({ keyword, category, product });
  const userPrompt = `이 상품을 소개하는 블로그 글을 작성해줘. 글 제목도 하나 지어서 맨 앞줄에 "TITLE: ..." 형식으로 알려줘.`;

  const maxAttempts = 3;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const fullText = await callGeminiOnce({ apiKey, systemPrompt, userPrompt });
      return parseTitleAndContent(fullText, keyword);
    } catch (err) {
      lastError = err;
      const retryable = err.status === 503 || err.status === 429;
      if (!retryable || attempt === maxAttempts) break;
      const waitMs = attempt * 10000;
      console.warn(`⚠️  Gemini 일시적 오류(${err.status}), ${waitMs / 1000}초 후 재시도 (${attempt}/${maxAttempts})`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

function generateWithTemplate({ keyword, category, product }) {
  const title = `${keyword} 해외직구 추천: ${product.productName}`;
  const content = `
<!-- wp:paragraph -->
<p>${DISCLOSURE}</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>[✏️ AI 글쓰기 API 키가 없어 최소 뼈대만 생성됐어요. "${keyword}" 관련 실제 내용을 채워 넣어주세요. 상품: ${product.productName}, 가격: ${product.price}원]</p>
<!-- /wp:paragraph -->

${buildButtonBlock(product.url)}
  `.trim();

  return { title, content };
}

async function generateArticle({ keyword, category, product }) {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("✍️  Claude로 글 생성 중...");
    return generateWithClaude({ keyword, category, product });
  }
  if (process.env.GEMINI_API_KEY) {
    console.log("✍️  Gemini(무료)로 글 생성 중...");
    return generateWithGemini({ keyword, category, product });
  }
  console.warn("⚠️  ANTHROPIC_API_KEY/GEMINI_API_KEY가 없어 템플릿 모드로 생성합니다.");
  return generateWithTemplate({ keyword, category, product });
}

module.exports = { generateArticle };
