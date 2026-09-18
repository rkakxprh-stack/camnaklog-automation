// trending.js
// 구글 트렌드의 한국 실시간 인기 검색어를 가져옵니다.
// 쿠팡 API와 무관하게, 별도 키/승인 없이 사용 가능한 공개 RSS 피드예요.
//
// 구글이 2025년경 트렌드 RSS 주소를 개편해서, 새 주소를 우선 시도하고
// 실패하면 예전 주소로 한 번 더 시도합니다.

const ENDPOINTS = [
  "https://trends.google.com/trending/rss?geo=KR",
  "https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR",
];

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; camnaklog-bot/1.0)",
    },
  });
  if (!res.ok) {
    throw new Error(`구글 트렌드 조회 실패 (${res.status}): ${url}`);
  }
  return res.text();
}

async function getTrendingKeywords() {
  let lastError = null;

  for (const url of ENDPOINTS) {
    try {
      const xml = await fetchRss(url);
      const titleMatches = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g)];
      const keywords = titleMatches
        .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim())
        .filter(Boolean);

      if (keywords.length > 0) {
        console.log(`✅ 트렌드 조회 성공: ${url}`);
        return keywords;
      }
    } catch (err) {
      console.warn(`⚠️  ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(
    `모든 트렌드 소스 조회에 실패했습니다. 마지막 오류: ${lastError?.message || "알 수 없음"}`
  );
}

module.exports = { getTrendingKeywords };
