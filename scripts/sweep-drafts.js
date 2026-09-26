// sweep-drafts.js
// 자동 발행 스크립트(index.js)가 끝난 뒤에도, 워드프레스닷컴 스팸 필터가
// 뒤늦게(수 분~수십 분 후) 글을 draft로 되돌리는 경우를 잡아내기 위한 "청소" 스크립트.
// auto-publish.yml과는 별도로, 시간차를 두고 실행되는 sweep-drafts.yml에서 돌립니다.
//
// 동작: 최근 N시간 이내에 수정된 draft 상태 글을 전부 찾아서 강제로 publish로 되돌립니다.
// 전제: 이 블로그는 100% 자동 발행 운영이라 "일부러 draft로 남겨둔 글"이 없습니다.

const SITE = process.env.WPCOM_SITE;
const LOOKBACK_HOURS = Number(process.env.SWEEP_LOOKBACK_HOURS || 6);

async function callApi(path, method = "GET", body = null) {
  const token = process.env.WPCOM_ACCESS_TOKEN;
  if (!token || !SITE) {
    throw new Error(
      "WPCOM_ACCESS_TOKEN / WPCOM_SITE 환경변수가 설정되지 않았습니다."
    );
  }

  const options = { method, headers: { Authorization: `Bearer ${token}` } };
  if (body) {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = body.toString();
  }

  const res = await fetch(
    `https://public-api.wordpress.com/rest/v1.1/sites/${SITE}${path}`,
    options
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`워드프레스 API 호출 실패 (${res.status}): ${text}`);
  }

  return res.json();
}

async function main() {
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  console.log(
    `🔍 최근 ${LOOKBACK_HOURS}시간 이내 draft 글 확인 중... (기준: ${cutoff.toISOString()})`
  );

  const list = await callApi(`/posts/?status=draft&number=50`);
  const drafts = (list.posts || []).filter(
    (p) => new Date(p.modified) >= cutoff
  );

  if (drafts.length === 0) {
    console.log("✅ 되돌아간 글 없음. 정상입니다.");
    return;
  }

  console.log(`⚠️  ${drafts.length}개의 draft 발견. 강제로 재발행합니다.`);

  let failures = 0;
  for (const post of drafts) {
    console.log(`→ 재발행 시도: [${post.ID}] ${post.title}`);
    try {
      const body = new URLSearchParams({ status: "publish" });
      const result = await callApi(`/posts/${post.ID}`, "POST", body);
      console.log(`  결과: ${result.status} — ${result.URL}`);
      if (result.status !== "publish") failures++;
    } catch (err) {
      console.error(`  ❌ 재발행 실패: ${err.message}`);
      failures++;
    }
  }

  if (failures > 0) {
    throw new Error(
      `${failures}개 글은 재발행에 실패했습니다. wp-admin에서 수동 확인이 필요합니다.`
    );
  }
}

main().catch((err) => {
  console.error("❌ sweep 실행 중 오류:", err.message);
  process.exit(1);
});
