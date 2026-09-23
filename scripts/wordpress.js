// wordpress.js
// WordPress.com REST API(v1.1)를 이용해 글을 발행하는 모듈
// 문서: https://developer.wordpress.com/docs/api/1.1/post/sites/%24site/posts/new/
//
// 참고: 워드프레스닷컴은 신규 인증 앱에서 온 글을 생성 응답에는 "publish"라고
// 표시해놓고, 몇 초~몇십 분 뒤 스팸 방지 시스템이 조용히 draft로 되돌리는 경우가
// 있습니다. 그래서 생성 응답을 신뢰하지 않고, publish를 요청한 경우 상태가 실제로
// "publish"로 확정될 때까지 지수 백오프로 여러 번 재확인/재발행합니다. (그래도
// 그 이후에 또 늦게 되돌아갈 수 있어서, 별도 sweep-drafts.js가 안전망 역할을 합니다.)

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

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 같은 카테고리의 최근 발행 글을 찾아 "관련 글" 링크 목록으로 씁니다.
 * 실패해도 전체 발행을 막지 않도록, 실패 시 빈 배열을 반환하고 경고만 남깁니다.
 */
async function getRelatedPosts({ category, limit = 3 }) {
  if (!category) return [];
  try {
    const query = new URLSearchParams({
      category,
      number: String(limit),
      status: "publish",
    });
    const result = await callPostsApi(`/posts/?${query.toString()}`, null, "GET");
    return (result.posts || [])
      .map((p) => ({ title: p.title, url: p.URL || p.short_URL }))
      .filter((p) => p.title && p.url);
  } catch (err) {
    console.warn(`⚠️  관련 글 조회 실패 (건너뜁니다): ${err.message}`);
    return [];
  }
}

function buildRelatedPostsBlock(posts) {
  if (!posts.length) return "";
  const items = posts
    .map(
      (p) =>
        `<!-- wp:list-item -->\n<li><a href="${p.url}">${escapeHtml(p.title)}</a></li>\n<!-- /wp:list-item -->`
    )
    .join("\n\n");

  return `<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">이런 글도 함께 보면 좋아요</h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list">
${items}
</ul>
<!-- /wp:list -->`;
}

/**
 * 외부 이미지 URL(알리익스프레스 상품 이미지 등)을 워드프레스 미디어 라이브러리로
 * 사이드로드(sideload)해서 정식 미디어 아이템으로 등록합니다.
 * 실패해도 전체 발행을 막지 않도록, 실패 시 null을 반환하고 경고만 남깁니다.
 */
async function uploadMediaFromUrl(imageUrl, attempt = 1) {
  try {
    const body = new URLSearchParams();
    body.append("media_urls[]", imageUrl);
    const result = await callPostsApi("/media/new", body);
    const media = result?.media?.[0];
    if (!media || !media.ID) {
      throw new Error(`업로드 응답에 media ID가 없습니다: ${JSON.stringify(result)}`);
    }
    return { id: media.ID, url: media.URL || media.guid || imageUrl };
  } catch (err) {
    if (attempt < 3) {
      console.warn(`⚠️  이미지 업로드 실패 (${attempt}번째), ${attempt * 2}초 후 재시도: ${err.message}`);
      await sleep(attempt * 2000);
      return uploadMediaFromUrl(imageUrl, attempt + 1);
    }
    console.warn(`⚠️  이미지 업로드 최종 실패 (원본 URL로 계속 진행합니다): ${err.message}`);
    return null;
  }
}

/**
 * 글이 실제로 "publish" 상태로 확정될 때까지 재확인 + 필요시 재발행을 반복합니다.
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
 * @param {string} featuredImageUrl - 대표 이미지로 쓸 외부 이미지 URL (선택)
 */
async function publishPost({ title, content, status = "draft", category, date, featuredImageUrl, featuredMediaId, excerpt, tags }) {
  let mediaId = featuredMediaId || null;
  if (!mediaId && featuredImageUrl) {
    const uploaded = await uploadMediaFromUrl(featuredImageUrl);
    mediaId = uploaded?.id || null;
  }

  let finalContent = content;
  if (category) {
    const related = await getRelatedPosts({ category, limit: 3 });
    const relatedBlock = buildRelatedPostsBlock(related);
    if (relatedBlock) finalContent = `${finalContent}\n\n${relatedBlock}`;
  }

  const body = new URLSearchParams({ title, content: finalContent, status });
  if (category) body.append("categories", category);
  if (date) body.append("date", date);
  if (mediaId) body.append("featured_image", String(mediaId));
  if (excerpt) body.append("excerpt", excerpt);
  if (tags && tags.length) body.append("tags", tags.join(","));

  let result = await callPostsApi("/posts/new", body);
  const postId = result.ID || result.id;

  if (postId && status === "publish") {
    result = await ensurePublished(postId);
  }

  return result;
}

module.exports = { publishPost, uploadMediaFromUrl };
