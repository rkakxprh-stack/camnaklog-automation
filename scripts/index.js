// index.js
// 니치(해외직구 꿀템) 자동화 메인 스크립트
// 실행: node scripts/index.js

const path = require("path");
const niches = require(path.join(__dirname, "..", "config", "niche-keywords.json"));
const aliexpress = require("./aliexpress.js");
const { generateArticle } = require("./generateArticle.js");
const { publishPost } = require("./wordpress.js");

function pickTodayIndex(length) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 1000 / 60 / 60 / 24);
  return dayOfYear % length;
}

async function main() {
  const startIdx = pickTodayIndex(niches.length);
  let picked = null;
  let product = null;

  // 오늘 키워드부터 시작해서, 상품 검색이 안 되면 다음 키워드로 순차 폴백
  for (let i = 0; i < niches.length; i++) {
    const candidate = niches[(startIdx + i) % niches.length];
    console.log(`검색 시도: "${candidate.keyword}" (${candidate.category})`);
    try {
      const results = await aliexpress.searchProducts(candidate.keyword, 5);
      if (results.length > 0) {
        picked = candidate;
        product = { productName: results[0].name, price: results[0].price, url: results[0].url };
        break;
      }
      console.log("검색 결과 없음 → 다음 키워드 시도");
    } catch (err) {
      console.warn(`⚠️  검색 실패: ${err.message}`);
    }
  }

  if (!picked) {
    throw new Error("모든 니치 키워드에서 알리익스프레스 상품 검색에 실패했습니다.");
  }

  console.log(`오늘의 주제: ${picked.keyword} / 카테고리: ${picked.category}`);
  console.log(`선택된 상품: ${product.productName} (${product.price}원)`);

  const { title, content } = await generateArticle({
    keyword: picked.keyword,
    category: picked.category,
    product,
  });
  console.log(`생성된 제목: ${title}`);

  const status = process.env.PUBLISH_STATUS || "draft";
  const result = await publishPost({ title, content, status, category: picked.category });

  console.log(`✅ 처리 완료 (${status}): ${result.URL || result.short_URL}`);
}

main().catch((err) => {
  console.error("❌ 자동화 실행 중 오류:", err.message);
  process.exit(1);
});
