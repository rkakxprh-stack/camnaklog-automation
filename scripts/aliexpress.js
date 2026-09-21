// aliexpress.js
// 알리익스프레스 어필리에이트 Open API 호출용 모듈 (HMAC-MD5 서명 방식)
// 문서: https://openservice.aliexpress.com (Affiliate API)

const crypto = require("crypto");

const API_URL = "https://api-sg.aliexpress.com/sync";

function sign(params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let base = sortedKeys.map((k) => `${k}${params[k]}`).join("");
  base = appSecret + base + appSecret;
  return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase();
}

async function callApi(method, extraParams = {}) {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error(
      "ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET 환경변수가 설정되지 않았습니다."
    );
  }

  const params = {
    app_key: appKey,
    method,
    timestamp: Date.now().toString(),
    sign_method: "md5",
    format: "json",
    v: "2.0",
    ...extraParams,
  };

  params.sign = sign(params, appSecret);

  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${query}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`알리익스프레스 API 호출 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.error_response) {
    throw new Error(
      `알리익스프레스 API 오류: ${data.error_response.msg || JSON.stringify(data.error_response)}`
    );
  }

  return data;
}

/**
 * 키워드로 상품 검색 (한국 배송 가능 상품 우선, 이미 제휴 추적 포함)
 */
async function searchProducts(keyword, limit = 5) {
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID || "default";

  const data = await callApi("aliexpress.affiliate.product.query", {
    keywords: keyword,
    page_no: "1",
    page_size: String(limit),
    target_currency: "KRW",
    target_language: "KO",
    tracking_id: trackingId,
    ship_to_country: "KR",
  });

  const products =
    data?.aliexpress_affiliate_product_query_response?.resp_result?.result
      ?.products?.product || [];

  return products.map((p) => ({
    name: p.product_title,
    price: p.target_sale_price,
    image: p.product_main_image_url,
    url: p.promotion_link || p.product_detail_url,
  }));
}

module.exports = { searchProducts };
