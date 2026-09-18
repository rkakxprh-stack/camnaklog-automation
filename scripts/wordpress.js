// wordpress.js
// WordPress.com REST API(v1.1)를 이용해 글을 발행하는 모듈
// 문서: https://developer.wordpress.com/docs/api/1.1/post/sites/%24site/posts/new/
//
// 인증 방법: WordPress.com은 OAuth2를 사용합니다.
// 1) https://developer.wordpress.com/apps/ 에서 새 애플리케이션 등록
// 2) 발급받은 client_id / client_secret으로 1회 OAuth 인증 진행 (README 참고)
// 3) 받은 access token을 WPCOM_ACCESS_TOKEN 환경변수(GitHub Secret)에 저장

const SITE = process.env.WPCOM_SITE; // 예: camnaklog2.wordpress.com

/**
 * 워드프레스에 새 글 발행
 * @param {Object} post
 * @param {string} post.title
 * @param {string} post.content - HTML 또는 구텐베르크 블록 마크업
 * @param {string} post.status - "publish" | "draft" | "future"
 * @param {string} post.category - 카테고리 이름 (예: "캠핑장비")
 * @param {string} [post.date] - status가 future일 때 예약 발행 시각 (ISO 8601)
 */
async function publishPost({ title, content, status = "draft", category, date }) {
  const token = process.env.WPCOM_ACCESS_TOKEN;

  if (!token || !SITE) {
    throw new Error(
      "WPCOM_ACCESS_TOKEN / WPCOM_SITE 환경변수가 설정되지 않았습니다."
    );
  }

  const body = new URLSearchParams({
    title,
    content,
    status,
  });

  if (category) body.append("categories", category);
  if (date) body.append("date", date);

  const res = await fetch(
    `https://public-api.wordpress.com/rest/v1.1/sites/${SITE}/posts/new`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`워드프레스 발행 실패 (${res.status}): ${text}`);
  }

  return res.json();
}

module.exports = { publishPost };
