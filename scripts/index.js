// index.js
// 니치(해외직구 꿀템) 자동화 메인 스크립트
// 실행: node scripts/index.js
//
// 변경점: 상품 1개만 골라 후기 쓰던 구조에서, 상품 여러 개(기본 4개)를 비교하는
// 구조로 전환. 대표 이미지도 함께 업로드합니다.

const path = require("path");
const niches = require(path.join(__dirname, "..", "config", "niche-keywords.json"));
const aliexpress = require("./aliexpress.js");
const { generateArticle } = require("./generateArticle.js");
const { publishPost, uploadMediaFromUrl } = require("./wordpress.js");

const COMPARE_COUNT = 4; // 비교 박스에 넣을 상품 개수
const MIN_VALID_PRODUCTS = 2; // 이 개수 미만이면 검색 결과가 부실하다고 보고 다음 키워드로 폴백

function pickTodayIndex(length) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 1000 / 60 / 60 / 24);
  return dayOfYear % length;
}

async function main() {
  const startIdx = pickTodayIndex(niches.length);
  let picked = null;
  let products = null;

  // 오늘 키워드부터 시작해서, 상품 검색이 부실하면 다음 키워드로 순차 폴백
  for (let i = 0; i < niches.length; i++) {
    const candidate = niches[(startIdx + i) % niches.length];
    console.log(`검색 시도: "${candidate.keyword}" (${candidate.category})`);
    try {
      const results = await aliexpress.searchProducts(candidate.keyword, 8);
      const valid = results.filter((p) => p.name && p.price && p.url && p.image);

      if (valid.length >= MIN_VALID_PRODUCTS) {
        picked = candidate;
        products = valid.slice(0, COMPARE_COUNT);
        break;
      }
      console.log(`검색 결과 부족(${valid.length}개) → 다음 키워드 시도`);
    } catch (err) {
      console.warn(`⚠️  검색 실패: ${err.message}`);
    }
  }

  if (!picked) {
    throw new Error("모든 니치 키워드에서 알리익스프레스 상품(이미지 포함) 검색에 실패했습니다.");
  }

  console.log(`오늘의 주제: ${picked.keyword} / 카테고리: ${picked.category}`);
  console.log(`비교 상품 ${products.length}개: ${products.map((p) => p.name).join(" / ")}`);

  // 상품 이미지를 워드프레스 미디어 라이브러리로 전부 사이드로드
  // (알리익스프레스 CDN에 그대로 링크하는 대신 자체 호스팅 → 로딩 속도·안정성 개선)
  let featuredMediaId = null;
  for (let i = 0; i < products.length; i++) {
    const uploaded = await uploadMediaFromUrl(products[i].image);
    if (uploaded) {
      products[i] = { ...products[i], image: uploaded.url };
      if (i === 0) featuredMediaId = uploaded.id;
    } else {
      console.warn(`⚠️  ${products[i].name} 이미지 사이드로드 실패, 원본 URL 그대로 사용`);
    }
  }

  const { title, content, excerpt } = await generateArticle({
    keyword: picked.keyword,
    category: picked.category,
    products,
  });
  console.log(`생성된 제목: ${title}`);

  const status = process.env.PUBLISH_STATUS || "draft";
  const result = await publishPost({
    title,
    content,
    excerpt,
    status,
    category: picked.category,
    featuredMediaId, // 이미 위에서 사이드로드했으니 재업로드하지 않음
  });

  console.log(`✅ 처리 완료 (${status}): ${result.URL || result.short_URL}`);
}

main().catch((err) => {
  console.error("❌ 자동화 실행 중 오류:", err.message);
  process.exit(1);
});
