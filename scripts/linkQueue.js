// linkQueue.js
// 사용자가 쿠팡 파트너스 사이트에서 수동으로 만들어 config/link-queue.json에
// 미리 넣어둔 제휴 링크들 중, 오늘의 트렌드 키워드와 매칭되는 게 있는지 찾습니다.

const path = require("path");
const fs = require("fs");

function loadQueue() {
  const file = path.join(__dirname, "..", "config", "link-queue.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

/**
 * 트렌드 키워드와 대기목록 중 서로 포함 관계인 항목을 찾아 반환 (없으면 null)
 */
function findMatch(trendKeyword) {
  const queue = loadQueue();
  const normalized = trendKeyword.replace(/\s/g, "").toLowerCase();

  return (
    queue.find((item) => {
      const k = item.keyword.replace(/\s/g, "").toLowerCase();
      return normalized.includes(k) || k.includes(normalized);
    }) || null
  );
}

module.exports = { findMatch, loadQueue };
