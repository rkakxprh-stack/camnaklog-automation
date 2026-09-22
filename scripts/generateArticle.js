// generateArticle.js
// 트렌드 키워드(+있으면 매칭된 제품 정보)를 받아 블로그 글(HTML)을 생성합니다.
// 우선순위: ANTHROPIC_API_KEY 있으면 Claude, 없고 GEMINI_API_KEY 있으면 Gemini(무료),
// 둘 다 없으면 최소 템플릿.

const DISCLOSURES = {
  coupang:
    "<p><em>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</em></p>",
  aliexpress:
    "<p><em>이 포스팅은 알리익스프레스 어필리에이트 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</em></p>",
};

const BUTTON_LABELS = {
  coupang: "쿠팡에서 가격 확인하기",
  aliexpress: "알리익스프레스에서 가격 확인하기",
};

function getDisclosure(source) {
  return DISCLOSURES[source] || DISCLOSURES.coupang;
}

function buildButtonBlock(url, source) {
  const label = BUTTON_LABELS[source] || BUTTON_LABELS.coupang;
  return `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"accent-1","textColor":"base","style":{"border":{"radius":"999px"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-base-color has-accent-1-background-color has-text-color has-background wp-element-button" style="border-radius:999px" href="${url}" target="_blank" rel="noopener nofollow sponsored">${label}</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
}

function buildSystemPrompt({ keyword, category, product }) {
  const hasProduct = !!product;
  return `너는 "핫딜로그" 블로그에 글을 쓰는 필자야. 이번 글의 카테고리는 "${category}", 소재는 실시간 인기 검색어 "${keyword}"야.

절대 하지 말아야 할 것 (전형적인 AI 글쓰기 패턴이라 반드시 피해야 해):
- "안녕하세요", "트렌디한", "~을 전해드리는", "핫딜로그입니다" 같은 정형화된 자기소개/인사말로 시작하는 것. 첫 문장부터 바로 내용으로 들어가.
- "왜 지금 화제일까?", "핵심 포인트", "정리하면" 같은 뻔한 소제목 패턴. 소제목은 그 글의 실제 내용을 구체적으로 담은 문장으로 써 (예: "왜 화제일까?" 대신 "가격이 3만원대로 떨어진 이유").
- 모든 문단을 3개짜리 리스트로 구성하는 것. 리스트는 정말 나열이 자연스러운 곳에서만, 그것도 매 글마다 쓰지 마. 대부분은 줄글로 풀어써.
- "~할 수 있습니다", "~하는 것이 좋습니다", "~해보시길 바랍니다" 같은 격식체 조언 말투의 반복. 대신 실제 사람이 친구한테 얘기하듯 구체적으로 써 (예: "이 정도면 살 만하다" "굳이 지금 살 필요는 없어 보인다"처럼 판단을 담아서).
- "또한", "특히", "이는 ~때문입니다" 같은 접속사·설명체를 문단마다 반복하는 것.
- 두루뭉술한 일반론("최근 관심이 높아지고 있다", "많은 분들이 궁금해한다" 등). 대신 구체적인 숫자, 상황, 예시를 들어.

이렇게 써:
- 문장 길이를 의도적으로 들쭉날쭉하게 — 짧은 한 문장 다음에 긴 문장, 이런 식으로 리듬을 만들어.
- 저자 본인의 판단이나 살짝 주관적인 톤을 섞어도 좋아 ("개인적으로는", "솔직히" 같은 표현 활용 가능).
- 구체적인 디테일 하나를 골라서 그걸로 문단을 시작해도 좋아. 뻔한 배경 설명부터 시작하지 마.
- 결과는 워드프레스 구텐베르크 블록 HTML 마크업으로 출력해 (<!-- wp:paragraph --> 등 블록 주석 포함), h2 소제목 위주로 구성하고 h1은 쓰지 마.
- 과장광고나 근거 없는 수치는 쓰지 마.
- 분량은 700~1000자 내외.
${
  hasProduct
    ? `- 글 맨 처음에는 반드시 이 문장을 그대로 포함해: "${getDisclosure(product.source)}"\n- 실제 제품명(${product.productName})과 가격(${product.price}원)을 자연스럽게 언급해.\n- 마지막에는 다음 버튼 블록을 정확히 그대로 포함해:\n${buildButtonBlock(product.url, product.source)}`
    : `- 이번 글에는 아직 연결할 쿠팡 제품 링크가 없어. 특정 제품을 단정적으로 추천하지 말고, "${keyword}"에 대한 정보/맥락 위주로 작성해. 글 말미에 특정 상품을 콕 집어 추천하는 CTA 문구는 넣지 마.`
}`;
}

function parseTitleAndContent(fullText, keyword) {
  const titleMatch = fullText.match(/^TITLE:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `${keyword}, 지금 화제인 이유`;
  const content = fullText.replace(/^TITLE:.*$/m, "").trim();
  return { title, content };
}

async function generateWithClaude({ keyword, category, product }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const systemPrompt = buildSystemPrompt({ keyword, category, product });
  const userPrompt = `트렌드 키워드: ${keyword}\n\n이 키워드를 주제로 블로그 글을 작성해줘. 글 제목도 하나 지어서 맨 앞줄에 "TITLE: ..." 형식으로 알려줘.`;

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
  const fullText =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";

  if (!fullText) {
    throw new Error("Gemini 응답이 비어 있습니다 (안전 필터에 걸렸을 수 있어요).");
  }

  return fullText;
}

async function generateWithGemini({ keyword, category, product }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = buildSystemPrompt({ keyword, category, product });
  const userPrompt = `트렌드 키워드: ${keyword}\n\n이 키워드를 주제로 블로그 글을 작성해줘. 글 제목도 하나 지어서 맨 앞줄에 "TITLE: ..." 형식으로 알려줘.`;

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
      console.warn(
        `⚠️  Gemini 일시적 오류(${err.status}), ${waitMs / 1000}초 후 재시도 (${attempt}/${maxAttempts})`
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
}

function generateWithTemplate({ keyword, category, product }) {
  const title = product
    ? `${keyword} 요즘 화제, ${product.productName} 살펴보기`
    : `${keyword}, 요즘 왜 화제일까?`;

  const content = `
<!-- wp:paragraph -->
<p>[✏️ AI 글쓰기 API 키가 없어 최소 뼈대만 생성됐어요. "${keyword}"에 대한 실제 내용을 채워 넣어주세요. 카테고리: ${category}]</p>
<!-- /wp:paragraph -->
${
  product
    ? `\n<!-- wp:paragraph -->\n${getDisclosure(product.source)}\n<!-- /wp:paragraph -->\n\n${buildButtonBlock(product.url, product.source)}`
    : ""
}
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
  console.warn(
    "⚠️  ANTHROPIC_API_KEY/GEMINI_API_KEY가 없어 템플릿 모드로 생성합니다. 발행 전 반드시 직접 검토/수정하세요."
  );
  return generateWithTemplate({ keyword, category, product });
}

module.exports = { generateArticle };
