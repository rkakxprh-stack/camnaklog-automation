// wordpress.js
// WordPress.com REST API(v1.1)를 이용해 글을 발행하는 모듈
// 문서: https://developer.wordpress.com/docs/api/1.1/post/sites/%24site/posts/new/

const SITE = process.env.WPCOM_SITE; // 예: camnaklog2.wordpress.com

async function callPostsApi(path, body) {
  const token = process.env.WPCOM_ACCESS_TOKEN;
  if (!token || !SITE) {
    throw new Error(
      "WPCOM_ACCESS_TOKEN / WPCOM_SITE 환경변수가 설정되지 않았습니다."
    );
  }

  const res = await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${SITE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`워드프레스 API 호출 실패 (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * 워드프레스에 새 글 발행
 * @param {Object} post
 * @param {string} post.title
 * @param {string} post.content - HTML 또는 구텐베르크 블록 마크업
 * @param {string} post.status - "publish" | "draft" | "future"
 * @param {string} post.category - 카테고리 이름 (예: "구매가이드")
 * @param {string} [post.date] - status가 future일 때 예약 발행 시각 (ISO 8601)
 */
async function publishPost({ title, content, status = "draft", category, date }) {
  const body = new URLSearchParams({ title, content, status });
  if (category) body.append("categories", category);
  if (date) body.append("date", date);

  let result = await callPostsApi("/posts/new", body);

  // 안전장치: 워드프레스닷컴이 신규 인증 앱의 첫 글들을 스팸 방지 차원에서
  // 자동으로 draft 처리하는 경우가 있어, 요청한 상태와 실제 결과가 다르면
  // 한 번 더 강제로 상태를 맞춰줍니다.
  const postId = result.ID || result.id;
  const actualStatus = result.status;

  if (postId && status === "publish" && actualStatus !== "publish") {
    console.warn(
      `⚠️  워드프레스가 글을 "${actualStatus}" 상태로 저장했습니다. 강제로 발행 상태로 재조정합니다.`
    );
    const fixBody = new URLSearchParams({ status: "publish" });
    result = await callPostsApi(`/posts/${postId}`, fixBody);
  }

  return result;
}

module.exports = { publishPost };
