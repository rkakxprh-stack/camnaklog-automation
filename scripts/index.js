// index.js
// 전체 자동화 흐름을 실행하는 메인 스크립트
// 실행: node scripts/index.js

const { getTrendingKeywords } = require("./trending.js");
const { classifyKeyword } = require("./classify.js");
const { findMatch, loadQueue } = require("./linkQueue.js");
const { generateArticle } = require("./generateArticle.js");
const { publishPost } = require("./wordpress.js");
const aliexpress = require("./aliexpress.js");

const MAX_KEYWORDS_TO_CHECK = 8;

async function pickShoppableTrend(keywords) {
  const candidates = keywords.slice(0, MAX_KEYWORDS_TO_CHECK);
  for (const keyword of candidates) {
    const category = await classifyKeyword(keyword);
    if (category) {
      console.log(`✅ "${keyword}" → 적합 (${category})`);
      return { keyword, category };
    }
    console.log(`⏭️  "${keyword}" → 쇼핑 콘텐츠로 부적합, 다음 키워드 확인`);
  }
  return null;
}

function pickFallbackFromQueue() {
  const queue = loadQueue();
  if (queue.length === 0) return null;
  const entry = queue[Math.floor(Math.random() * queue.length)];
  return { keyword: entry.keyword, category: "구매가이드", queuedProduct: entry };
}

async function main() {
  const keywords = await getTrendingKeywords();
  if (keywords.length === 0) {
    throw new Error("구글 트렌드에서 키워드를 가져오지 못했습니다.");
  }

  let picked = await pickShoppableTrend(keywords);
  let queuedProduct = null;

  if (!picked) {
    console.log("⚠️  오늘 트렌드 중 쇼핑 관련 키워드를 찾지 못했습니다. 등록된 상품 목록에서 대체 주제를 고릅니다.");
    picked = pickFallbackFromQueue();
    if (!picked) {
      throw new Error(
        "쇼핑 관련 트렌드도 없고, config/link-queue.json에 등록된 상품도 없어 오늘은 글을 만들 수 없습니다."
      );
    }
    queuedProduct = picked.queuedProduct;
  }

  const { keyword, category } = picked;
  console.log(`오늘의 주제: ${keyword} / 카테고리: ${category}`);

  let matchedProduct = queuedProduct ? { ...queuedProduct, source: "coupang" } : null;

  if (!matchedProduct && category === "해외직구 큐레이션" && process.env.ALIEXPRESS_APP_KEY) {
    try {
      const results = await aliexpress.searchProducts(keyword, 5);
      if (results.length > 0) {
        const p = results[0];
        matchedProduct = { productName: p.name, price: p.price, url: p.url, source: "aliexpress" };
        console.log(`알리익스프레스 자동 매칭됨: ${matchedProduct.productName}`);
      }
    } catch (err) {
      console.warn(`⚠️  알리익스프레스 검색 실패 (${err.message})`);
    }
  }

  if (!matchedProduct) {
    matchedProduct = findMatch(keyword);
    if (matchedProduct) {
      matchedProduct = { ...matchedProduct, source: "coupang" };
      console.log(`쿠팡 링크 매칭됨: ${matchedProduct.productName}`);
    } else {
      console.log("매칭되는 링크 없음 → 링크 없이 정보성 글로 작성");
    }
  }

  const { title, content } = await generateArticle({ keyword, category, product: matchedProduct });
  console.log(`생성된 제목: ${title}`);

  const status = matchedProduct ? process.env.PUBLISH_STATUS || "draft" : "draft";

  const result = await publishPost({ title, content, status, category });

  console.log(`✅ 처리 완료 (${status}): ${result.URL || result.short_URL}`);
}

main().catch((err) => {
  console.error("❌ 자동화 실행 중 오류:", err.message);
  process.exit(1);
});
