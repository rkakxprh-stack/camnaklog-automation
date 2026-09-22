// wordpress.js
// WordPress.com REST API(v1.1)를 이용해 글을 발행하는 모듈
// 문서: https://developer.wordpress.com/docs/api/1.1/post/sites/%24site/posts/new/
//
// 참고: 워드프레스닷컴은 신규 인증 앱에서 온 글을 생성 응답에는 "publish"라고
// 표시해놓고, 몇 초 뒤 스팸 방지 시스템이 조용히 draft로 되돌리는 경우가 있습니다.
// 그래서 생성 응답을 신뢰하지 않고, publish를 요청한 경우 항상 한 번 더
// 명시적으로 상태를 재확정합니다.

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
 * 워드프레스에 새 글 발행
 */
async function publishPost({ title, content, status = "draft", category, date }) {
  const body = new URLSearchParams({ title, content, status });
  if (category) body.append("categories", category);
  if (date) body.append("date", date);

  let result = await callPostsApi("/posts/new", body);
  const postId = result.ID || result.id;

  if (postId && status === "publish") {
    // 생성 직후 응답은 신뢰하지 않고, 스팸 필터가 되돌릴 시간을 잠깐 준 뒤
    // 실제 상태를 다시 확인해서 draft면 강제로 재발행합니다.
    await sleep(3000);
    const check = await callPostsApi(`/posts/${postId}`, null, "GET");
    if (check.status !== "publish") {
      console.warn(
        `⚠️  글이 "${check.status}" 상태로 되돌아갔습니다 (postId=${postId}). 강제로 재발행합니다.`
      );
      result = await callPostsApi(`/posts/${postId}`, new URLSearchParams({ status: "publish" }));
    } else {
      result = check;
    }
  }

  return result;
}

module.exports = { publishPost };
