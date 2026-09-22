// wordpress.js
// WordPress.com REST API(v1.1)를 이용해 글을 발행하는 모듈
// 문서: https://developer.wordpress.com/docs/api/1.1/post/sites/%24site/posts/new/
//
// 참고: 워드프레스닷컴은 신규 인증 앱에서 온 글을 생성 응답에는 "publish"라고
// 표시해놓고, 몇 초 뒤 스팸 방지 시스템이 조용히 draft로 되돌리는 경우가 있습니다.
// 그래서 생성 응답을 신뢰하지 않고, publish를 요청한 경우 상태가 실제로
// "publish"로 확정될 때까지 지수 백오프로 여러 번 재확인/재발행합니다.

const SITE = process.env.WPCOM_SITE; // 예: camnaklog2.wordpress.com

async function callPostsApi(path, body, method = "POST") {
  const token = process.env.WPCOM_ACCESS_TOKEN;
  if (!token || !SITE) {
    throw new Error(
      "WPCOM_ACCESS_TOKEN / WPCOM_SITE 환경변수가 설정되지 않았습니다."
    );
  }

  const options = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };

  if (method === "POST") {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = body.toString();
  }

  const res = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${SITE}${path}`, options);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`워드프레스 API 호출 실패 (${res.status}): ${text}`);
  }

  return res.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 글이 실제로 "publish" 상태로 확정될 때까지 재확인 + 필요시 재발행을 반복합니다.
 * 스팸 필터가 늦게 개입하거나 재발행 후 또 되돌리는 경우까지 커버하기 위해
 * 단발성 체크 대신 지수 백오프 루프를 사용합니다.
 */
async function ensurePublished(postId) {
  const delays = [5000, 10000, 20000, 40000]; // 5s → 10s → 20s → 40s, 총 4번 확인

  for (let attempt = 1; attempt <= delays.length; attempt++) {
    await sleep(delays[attempt - 1]);

    const check = await callPostsApi(`/posts/${postId}`, null, "GET");
    if (check.status === "publish") {
      if (attempt > 1) {
        console.log(`✅ ${attempt}번째 확인에서 publish 상태 확정 (postId=${postId})`);
      }
      return check;
    }

    console.warn(
      `⚠️  ${attempt}번째 확인: 상태가 "${check.status}"로 되돌아감 (postId=${postId}). 재발행 시도...`
    );
    await callPostsApi(`/posts/${postId}`, new URLSearchParams({ status: "publish" }));
  }

  // 여기까지 왔다는 건 마지막 재발행 직후 상태를 아직 확인 안 했다는 뜻이므로 한 번 더 확인
  const finalCheck = await callPostsApi(`/posts/${postId}`, null, "GET");
  if (finalCheck.status !== "publish") {
    throw new Error(
      `postId=${postId} 발행 실패: ${delays.length}번 재시도 후에도 상태가 "${finalCheck.status}"입니다. wp-admin에서 수동 확인이 필요합니다.`
    );
  }
  return finalCheck;
}

/**
 * 워드프레스에 새 글 발행
 */
async function publishPost({ title, content, status = "draft", category, date }) {
  const body = new URLSearchParams({ title, content, status });
  if (category) body.append("categories", category);
  if (date) body.append("date", date);

  let result = await callPostsApi("/posts/new", body);
  const postId = result.ID || result.id;

  if (postId && status === "publish") {
    // 생성 직후 응답은 신뢰하지 않고, 실제로 publish가 확정될 때까지 재확인/재발행
    result = await ensurePublished(postId);
  }

  return result;
}

module.exports = { publishPost };
