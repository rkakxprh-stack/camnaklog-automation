// index.js
// 니치(알리 꿀템) 자동화 메인 스크립트
// 실행: node scripts/index.js
//
// 흐름: 오늘의 니치 키워드 선택 → (이미 쓴 키워드는 건너뜀) → 알리익스프레스 상품 4개 검색
//      → 상품 이미지 사이드로드 → 글 생성 → 발행

const path = require("path");
const niches = require(path.join(__dirname, "..", "config", "niche-keywords.json"));
const aliexpress = require("./aliexpress.js");
const { generateArticle } = require("./generateArticle.js");
const { publishPost, uploadMediaFromUrl, getUsedKeywords } = require("./wordpress.js");

const COMPARE_COUNT = 4; // 비교 박스에 넣을 상품 개수
const MIN_VALID_PRODUCTS = 2; // 이 개수 미만이면 검색 결과가 부실하다고 보고 다음 키워드로 폴백

function pickTodayIndex(length) {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 1000 / 60 / 60 / 24);
  return dayOfYear % length;
}

/**
 * 후보 키워드를 순서대로 시도해서, 상품이 충분히 검색되는 첫 키워드를 고릅니다.
 */
async function findNicheWithProducts(candidates) {
  for (const candidate of candidates) {
    console.log(`검색 시도: "${candidate.keyword}" (${candidate.category})`);
    try {
      const results = await aliexpress.searchProducts(candidate.keyword, 8);
      const valid = results.filter((p) => p.name && p.price && p.url && p.image);

      if (valid.length >= MIN_VALID_PRODUCTS) {
        return { picked: candidate, products: valid.slice(0, COMPARE_COUNT) };
      }
      console.log(`검색 결과 부족(${valid.length}개) → 다음 키워드 시도`);
    } catch (err) {
      console.warn(`⚠️  검색 실패: ${err.message}`);
    }
  }
  return null;
}

async function main() {
  const startIdx = pickTodayIndex(niches.length);
  const ordered = niches.map((_, i) => niches[(startIdx + i) % niches.length]);

  // 이미 글로 쓴 키워드는 건너뛰기 (같은 주제 글이 여러 개 생겨 서로 검색 순위를 깎는 것 방지)
  const used = await getUsedKeywords();
  const unused = ordered.filter((n) => !used.has(n.keyword));
  console.log(`전체 키워드 ${ordered.length}개 중 아직 안 쓴 키워드 ${unused.length}개`);

  let found = await findNicheWithProducts(unused);

  // 모든 키워드를 한 번씩 다 쓴 경우에만, 예전 키워드를 다시 사용
  if (!found && unused.length < ordered.length) {
    console.log("안 쓴 키워드로는 상품을 찾지 못해, 이미 쓴 키워드까지 포함해서 다시 시도합니다.");
    found = await findNicheWithProducts(ordered.filter((n) => used.has(n.keyword)));
  }

  if (!found) {
    throw new Error("모든 니치 키워드에서 알리익스프레스 상품(이미지 포함) 검색에 실패했습니다.");
  }

  const { picked } = found;
  const products = found.products;

  console.log(`오늘의 주제: ${picked.keyword} / 카테고리: ${picked.category}`);
  console.log(`비교 상품 ${products.length}개: ${products.map((p) => p.name).join(" / ")}`);

  // 상품 이미지를 워드프레스 미디어 라이브러리로 전부 사이드로드
  let featuredMediaId = null;
  for (let i = 0; i < products.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000)); // 연속 업로드 부담 완화
    const uploaded = await uploadMediaFromUrl(products[i].image);
    if (uploaded) {
      products[i] = { ...products[i], image: uploaded.url };
      if (featuredMediaId === null) featuredMediaId = uploaded.id; // 첫 번째로 성공한 이미지를 대표 이미지로
    } else {
      console.warn(`⚠️  ${products[i].name} 이미지 사이드로드 실패, 원본 URL 그대로 사용`);
    }
  }

  const { title, content, excerpt, tags } = await generateArticle({
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
    tags,
    status,
    category: picked.category,
    featuredMediaId,
  });

  console.log(`✅ 처리 완료 (${status}): ${result.URL || result.short_URL}`);
}

main().catch((err) => {
  console.error("❌ 자동화 실행 중 오류:", err.message);
  process.exit(1);
});
