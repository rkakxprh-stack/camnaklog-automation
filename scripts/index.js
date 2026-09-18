// index.js
// 전체 자동화 흐름을 실행하는 메인 스크립트
// 실행: node scripts/index.js

const path = require("path");
const categories = require(path.join(__dirname, "..", "config", "categories.json"));
const { getTrendingKeywords } = require("./trending.js");
const { findMatch } = require("./linkQueue.js");
const { generateArticle } = require("./generateArticle.js");
const { publishPost } = require("./wordpress.js");

function pickTodayCategory() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 1000 / 60 / 60 / 24);
  return categories[dayOfYear % categories.length];
}

async function main() {
  const keywords = await getTrendingKeywords();
  if (keywords.length === 0) {
    throw new Error("구글 트렌드에서 키워드를 가져오지 못했습니다.");
  }

  // 오늘 아직 다루지 않은 첫 번째 트렌드 키워드를 사용 (필요하면 발행 이력 체크 로직 추가 가능)
  const keyword = keywords[0];
  console.log(`오늘의 트렌드 키워드: ${keyword}`);

  const category = pickTodayCategory();
  console.log(`오늘의 카테고리: ${category.name}`);

  const matchedProduct = findMatch(keyword);
  if (matchedProduct) {
    console.log(`쿠팡 링크 매칭됨: ${matchedProduct.productName}`);
  } else {
    console.log("매칭되는 쿠팡 링크 없음 → 링크 없이 정보성 글로 작성");
  }

  const { title, content } = await generateArticle({
    keyword,
    category: category.name,
    product: matchedProduct,
  });
  console.log(`생성된 제목: ${title}`);

  // 링크가 없는 글은 안전하게 draft로, 링크가 있는 글은 설정된 PUBLISH_STATUS를 따름
  const status = matchedProduct ? process.env.PUBLISH_STATUS || "draft" : "draft";

  const result = await publishPost({
    title,
    content,
    status,
    category: category.name,
  });

  console.log(`✅ 처리 완료 (${status}): ${result.URL || result.short_URL}`);
}

main().catch((err) => {
  console.error("❌ 자동화 실행 중 오류:", err.message);
  process.exit(1);
});
