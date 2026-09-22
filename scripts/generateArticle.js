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
