// classify.js
// 트렌드 키워드가 "핫딜로그"(제품비교/구매가이드/해외직구 큐레이션) 컨텐츠로
// 적합한지 AI에게 짧게 물어봐서 판단합니다. 스포츠 경기 결과, 정치 이슈,
// 연예 가십처럼 쇼핑과 무관한 키워드를 걸러내기 위한 필터예요.

const VALID_CATEGORIES = ["제품비교", "구매가이드", "해외직구 큐레이션"];

function buildPrompt(keyword) {
  return `다음은 지금 한국에서 실시간으로 인기 있는 검색어야: "${keyword}"

이 키워드가 쇼핑/제품 블로그(카테고리: 제품비교, 구매가이드, 해외직구 큐레이션)의 글감으로 자연스럽게 쓰일 수 있는지 판단해줘.
- 특정 제품군(가전, 전자기기, 패션, 생활용품 등)과 직접 연결되거나, "이 키워드 때문에 요즘 관련 제품 수요가 늘 것 같다"고 볼 수 있으면 적합.
- 스포츠 경기/선수, 정치 이슈, 연예인 가십, 사건사고처럼 특정 제품과 자연스럽게 연결하기 어려우면 부적합.

아래 형식으로만 답해. 다른 말은 절대 하지 마:
적합하면 → CATEGORY: 제품비교 또는 CATEGORY: 구매가이드 또는 CATEGORY: 해외직구 큐레이션 중 가장 잘 맞는 것 하나
부적합하면 → CATEGORY: 없음`;
}

function parseCategory(text) {
  const match = text.match(/CATEGORY:\s*(.+)/);
  if (!match) return null;
  const value = match[1].trim();
  return VALID_CATEGORIES.includes(value) ? value : null;
}

async function classifyWithGemini(keyword) {
  const apiKey = process.env.GEMINI_API_KEY;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(keyword) }] }],
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return parseCategory(text);
}

async function classifyWithClaude(keyword) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 50,
      messages: [{ role: "user", content: buildPrompt(keyword) }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data.content.map((b) => b.text || "").join("");
  return parseCategory(text);
}

/**
 * 키워드가 쇼핑 블로그에 적합한지 판단. 적합하면 카테고리명(string), 아니면 null 반환.
 */
async function classifyKeyword(keyword) {
  try {
    if (process.env.ANTHROPIC_API_KEY) return await classifyWithClaude(keyword);
    if (process.env.GEMINI_API_KEY) return await classifyWithGemini(keyword);
  } catch (err) {
    console.warn(`⚠️  키워드 분류 실패 (${keyword}): ${err.message}`);
  }
  return null;
}

module.exports = { classifyKeyword };
