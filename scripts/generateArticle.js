// generateArticle.js
// 트렌드 키워드(+있으면 매칭된 제품 정보)를 받아 블로그 글(HTML)을 생성합니다.
// ANTHROPIC_API_KEY가 있으면 Claude API로 자동 작성하고, 없으면 최소 템플릿을 씁니다.

const COUPANG_DISCLOSURE =
  "<p><em>이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</em></p>";

function buildButtonBlock(url) {
  return `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"accent-1","textColor":"base","style":{"border":{"radius":"999px"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-base-color has-accent-1-background-color has-text-color has-background wp-element-button" style="border-radius:999px" href="${url}" target="_blank" rel="noopener nofollow sponsored">쿠팡에서 가격 확인하기</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->`;
}

async function generateWithClaude({ keyword, category, product }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const hasProduct = !!product;

  const systemPrompt = `너는 "핫딜로그"라는, 지금 가장 화제인 제품들을 다루는 블로그의 필자야. 카테고리는 "제품비교", "구매가이드", "해외직구 큐레이션" 셋 중 하나이고, 이번 글의 카테고리는 "${category}"야.

규칙:
- 결과는 반드시 워드프레스 구텐베르크 블록 HTML 마크업으로 출력해 (<!-- wp:paragraph --> 등 블록 주석 포함).
- 본문은 h2 소제목 위주로 구성하고, 별도 h1 제목은 쓰지 마.
- 실시간 인기 검색어 "${keyword}"가 왜 화제인지, 사람들이 무엇을 궁금해하는지를 자연스럽게 짚어줘.
- 과장광고나 근거 없는 수치는 쓰지 마.
- 분량은 700~1000자 내외.
${
  hasProduct
    ? `- 글 맨 처음에는 반드시 이 문장을 그대로 포함해: "${COUPANG_DISCLOSURE}"\n- 실제 제품명(${product.productName})과 가격(${product.price}원)을 자연스럽게 언급해.\n- 마지막에는 다음 버튼 블록을 정확히 그대로 포함해:\n${buildButtonBlock(product.url)}`
    : `- 이번 글에는 아직 연결할 쿠팡 제품 링크가 없어. 특정 제품을 단정적으로 추천하지 말고, "${keyword}"에 대한 정보/맥락 위주로 작성해. 글 말미에 특정 상품을 콕 집어 추천하는 CTA 문구는 넣지 마.`
}`;

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

  const titleMatch = fullText.match(/^TITLE:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `${keyword}, 지금 화제인 이유`;
  const content = fullText.replace(/^TITLE:.*$/m, "").trim();

  return { title, content };
}

function generateWithTemplate({ keyword, category, product }) {
  const title = product
    ? `${keyword} 요즘 화제, ${product.productName} 살펴보기`
    : `${keyword}, 요즘 왜 화제일까?`;

  const content = `
<!-- wp:paragraph -->
<p>[✏️ ANTHROPIC_API_KEY가 없어 최소 뼈대만 생성됐어요. "${keyword}"에 대한 실제 내용을 채워 넣어주세요. 카테고리: ${category}]</p>
<!-- /wp:paragraph -->
${
  product
    ? `\n<!-- wp:paragraph -->\n${COUPANG_DISCLOSURE}\n<!-- /wp:paragraph -->\n\n${buildButtonBlock(product.url)}`
    : ""
}
  `.trim();

  return { title, content };
}

async function generateArticle({ keyword, category, product }) {
  if (process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude({ keyword, category, product });
  }
  console.warn(
    "⚠️  ANTHROPIC_API_KEY가 없어 템플릿 모드로 생성합니다. 발행 전 반드시 직접 검토/수정하세요."
  );
  return generateWithTemplate({ keyword, category, product });
}

module.exports = { generateArticle };
