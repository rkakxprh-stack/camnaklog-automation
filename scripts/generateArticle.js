// generateArticle.js
// 니치 키워드 + 알리익스프레스 상품 여러 개(비교용)를 받아 블로그 글(HTML)을 생성합니다.
//
// 변경점: 상품 1개 후기 구조에서, 상품 여러 개(기본 4개)를 나란히 비교하는 구조로 전환.
// AI는 "본문 서술"만 담당하고, 이미지/가격/링크가 들어가는 비교 박스는 코드가
// 직접 조립합니다 (제휴 링크·가격 정확도가 중요해서 AI가 만들게 하지 않음).

const DISCLOSURE = `<!-- wp:group {"style":{"border":{"radius":"8px"},"spacing":{"padding":{"top":"var:preset|spacing|20","bottom":"var:preset|spacing|20","left":"var:preset|spacing|30","right":"var:preset|spacing|30"}}},"backgroundColor":"accent-3","layout":{"type":"constrained"}} -->
<div class="wp-block-group has-accent-3-background-color has-background" style="border-radius:8px;padding-top:var(--wp--preset--spacing--20);padding-right:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--20);padding-left:var(--wp--preset--spacing--30)">
<!-- wp:paragraph {"textColor":"contrast","fontSize":"small"} -->
<p class="has-contrast-color has-text-color has-small-font-size"><strong>📢 유료 광고 고지</strong> — 이 포스팅은 알리익스프레스 파트너스 활동의 일환으로 작성되었으며, 이 글을 통한 구매 시 일정액의 수수료를 제공받습니다.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->`;

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str = "", max = 40) {
  const s = String(str);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function formatPrice(price) {
  const n = Number(String(price).replace(/[^\d.]/g, ""));
  if (Number.isNaN(n)) return `${price}원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

/**
 * 상품 배열을 받아 "한눈에 비교해보기" Gutenberg 컬럼 블록을 만듭니다.
 * 각 상품: { name, price, image, url }
 */
function buildComparisonBlock(products) {
  const columns = products
    .map(
      (p) => `<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:image {"sizeSlug":"medium","linkDestination":"custom"} -->
<figure class="wp-block-image size-medium"><a href="${p.url}" target="_blank" rel="noopener nofollow sponsored"><img src="${p.image}" alt="${escapeHtml(
        truncate(p.name, 60)
      )}"/></a></figure>
<!-- /wp:image -->

<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center"><strong>${escapeHtml(
        truncate(p.name, 40)
      )}</strong><br/>${formatPrice(p.price)}</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"accent-1","textColor":"base","style":{"border":{"radius":"999px"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-base-color has-accent-1-background-color has-text-color has-background wp-element-button" style="border-radius:999px" href="${p.url}" target="_blank" rel="noopener nofollow sponsored">가격 확인하기</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
</div>
<!-- /wp:column -->`
    )
    .join("\n\n");

  return `<!-- wp:heading -->
<h2 class="wp-block-heading">한눈에 비교해보기</h2>
<!-- /wp:heading -->

<!-- wp:columns -->
<div class="wp-block-columns">
${columns}
</div>
<!-- /wp:columns -->`;
}

function buildSystemPrompt({ keyword, category, products }) {
  const productLines = products
    .map((p, i) => `${i + 1}. ${p.productName || p.name} (약 ${formatPrice(p.price)})`)
    .join("\n");

  return `너는 "핫딜로그"라는 해외직구 꿀템 블로그의 필자야. 이번 글의 카테고리는 "${category}", 소재는 "${keyword}"이고, 아래 ${products.length}개 상품을 놓고 비교하며 소개하는 글을 쓸 거야.

비교 대상 상품:
${productLines}

절대 하지 말아야 할 것 (전형적인 AI 글쓰기 패턴이라 반드시 피해야 해):
- "안녕하세요", "트렌디한", "~을 전해드리는" 같은 정형화된 인사말로 시작하는 것. 첫 문장부터 바로 내용으로 들어가.
- "왜 화제일까?", "핵심 포인트", "정리하면" 같은 뻔한 소제목 패턴. 소제목은 실제 내용을 구체적으로 담은 문장으로 써.
- 모든 문단을 3개짜리 리스트로 구성하는 것. 대부분은 줄글로 풀어써.
- "~할 수 있습니다", "~하는 것이 좋습니다" 같은 격식체 조언 말투의 반복.
- "또한", "특히", "이는 ~때문입니다" 같은 접속사·설명체 반복.
- 두루뭉술한 일반론. 대신 구체적인 사용 상황, 숫자, 예시를 들어.
- 매우 중요: 이 상품을 실제로 사거나 써본 적이 없다는 전제로 써. "써봤더니", "받아보니", "택배 뜯었을 때", "설거지하다가 눈에 들어와서" 같은 지어낸 1인칭 실사용 경험담을 절대 만들지 마. 실제로 겪지 않은 개인 경험을 지어내는 건 독자를 속이는 것이고, 나중에 신뢰 문제로 이어질 수 있어.

이렇게 써:
- 문장 길이를 의도적으로 들쭉날쭉하게.
- 상품 설명·스펙·구조상 특징을 근거로, "이런 상황/이런 사람에게 맞다"는 정보 전달형 비교로 써 (지어낸 경험이 아니라 스펙과 논리로 판단 내리기).
- 이 글은 "이 중에 뭘 사야 하나 고민하는 사람"을 위한 비교/추천 글이야. 각 상품이 어떤 상황·어떤 사람에게 맞는지 스펙과 구조를 근거로 구체적으로 비교해서 판단을 내려줘 ("바쁜 아침엔 1번 구조가 편하고, 가성비만 보면 3번이 낫다" 처럼 — 근거는 항상 상품 자체의 특징이어야 해).
- 해외직구 특성상 배송에 통상 1~2주 정도 걸린다는 점은 일반적인 사실로 언급해도 되지만, "내가 기다려봤다"는 식의 개인 경험으로 포장하지 마.
- 결과는 워드프레스 구텐베르크 블록 HTML 마크업으로 출력해 (<!-- wp:paragraph --> 등 블록 주석 포함), h2 소제목 위주, h1은 쓰지 마.
- 광고 고지문, 이미지, 버튼, 링크는 절대 직접 만들지 마 (본문 서술만 작성하면, 코드가 앞뒤로 고지문과 비교 박스를 자동으로 붙여).
- 과장광고나 근거 없는 수치는 쓰지 마.
- 분량은 800~1200자 내외.`;
}

function parseTitleAndContent(fullText, keyword) {
  const titleMatch = fullText.match(/^TITLE:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `${keyword} 비교 추천`;
  const content = fullText.replace(/^TITLE:.*$/m, "").trim();
  return { title, content };
}

async function generateWithClaude({ keyword, category, products }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const systemPrompt = buildSystemPrompt({ keyword, category, products });
  const userPrompt = `이 상품들을 비교하는 블로그 글을 작성해줘. 글 제목도 하나 지어서 맨 앞줄에 "TITLE: ..." 형식으로 알려줘 (제목은 "OO 추천 비교" 같은 비교/추천 톤으로).`;

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

async function generateWithGemini({ keyword, category, products }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const systemPrompt = buildSystemPrompt({ keyword, category, products });
  const userPrompt = `이 상품들을 비교하는 블로그 글을 작성해줘. 글 제목도 하나 지어서 맨 앞줄에 "TITLE: ..." 형식으로 알려줘 (제목은 "OO 추천 비교" 같은 비교/추천 톤으로).`;

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

function generateWithTemplate({ keyword, category, products }) {
  const title = `${keyword} 추천 비교 (${products.length}개)`;
  const content = `
<!-- wp:paragraph -->
<p>[✏️ AI 글쓰기 API 키가 없어 최소 뼈대만 생성됐어요. "${keyword}" 관련 실제 비교 내용을 채워 넣어주세요.]</p>
<!-- /wp:paragraph -->
  `.trim();

  return { title, content };
}

/**
 * keyword, category, products(비교할 상품 배열, {name/productName, price, image, url})를 받아
 * { title, content } 를 반환. content 끝에는 항상 비교 박스가 코드로 붙습니다.
 */
async function generateArticle({ keyword, category, products }) {
  let result;
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("✍️  Claude로 글 생성 중...");
    result = await generateWithClaude({ keyword, category, products });
  } else if (process.env.GEMINI_API_KEY) {
    console.log("✍️  Gemini(무료)로 글 생성 중...");
    result = await generateWithGemini({ keyword, category, products });
  } else {
    console.warn("⚠️  ANTHROPIC_API_KEY/GEMINI_API_KEY가 없어 템플릿 모드로 생성합니다.");
    result = generateWithTemplate({ keyword, category, products });
  }

  const comparisonBlock = buildComparisonBlock(
    products.map((p) => ({
      name: p.productName || p.name,
      price: p.price,
      image: p.image,
      url: p.url,
    }))
  );

  const excerpt = buildExcerpt(result.content);

  return {
    title: result.title,
    content: `${DISCLOSURE}\n\n${result.content}\n\n${comparisonBlock}`,
    excerpt,
  };
}

/**
 * 홈 화면 발췌(excerpt)에 광고 고지문이 섞여 나오지 않도록,
 * 고지문 문단을 제외한 본문에서 첫 문단을 뽑아 발췌를 만듭니다.
 */
function buildExcerpt(rawContent) {
  // HTML 태그 제거
  const plainParagraphs = rawContent
    .replace(/<!--[\s\S]*?-->/g, "") // Gutenberg 블록 주석 제거
    .split(/<\/p>/i)
    .map((p) => p.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);

  // 고지문(수수료 고지)이 들어간 문단은 건너뛰고, 그다음 실제 본문 문단을 사용
  const firstRealParagraph =
    plainParagraphs.find((p) => !p.includes("어필리에이트") && !p.includes("수수료")) ||
    plainParagraphs[0] ||
    "";

  const MAX_LEN = 110;
  return firstRealParagraph.length > MAX_LEN
    ? firstRealParagraph.slice(0, MAX_LEN - 1) + "…"
    : firstRealParagraph;
}

module.exports = { generateArticle };
