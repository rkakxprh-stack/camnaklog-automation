// trending.js
// 구글 트렌드의 한국 실시간 인기 검색어를 가져옵니다.
// 쿠팡 API와 무관하게, 별도 키/승인 없이 사용 가능한 공개 RSS 피드예요.

async function getTrendingKeywords() {
  const res = await fetch(
    "https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR"
  );

  if (!res.ok) {
    throw new Error(`구글 트렌드 조회 실패 (${res.status})`);
  }

  const xml = await res.text();

  // 아주 단순한 XML 파싱 (외부 라이브러리 없이 <title> 태그만 추출)
  const titleMatches = [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g)];

  const keywords = titleMatches
    .map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim())
    .filter(Boolean);

  return keywords;
}

module.exports = { getTrendingKeywords };
