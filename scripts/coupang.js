// coupang.js
// 쿠팡파트너스 Open API 호출용 모듈
// 공식 문서: https://partners.coupang.com/#/apply/wiki (오픈API 가이드)

const crypto = require("crypto");

const DOMAIN = "https://api-gateway.coupang.com";

/**
 * 쿠팡 Open API 서명(HMAC-SHA256) 생성
 * 쿠팡은 요청마다 access-key/secret-key로 서명한 Authorization 헤더가 필요합니다.
 */
function generateAuthHeader({ method, path, query, accessKey, secretKey }) {
  const datetime = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .slice(2); // yyMMddTHHmmssZ 형태로 변환

  const message = `${datetime}${method}${path}${query || ""}`;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(message)
    .digest("hex");

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 키워드로 상품 검색 (검색 결과에는 이미 파트너스 제휴 링크가 포함되어 있습니다)
 * @param {string} keyword - 검색할 상품 키워드 (예: "4인용 텐트")
 * @param {number} limit - 가져올 상품 개수 (기본 5, 최대 100)
 */
async function searchProducts(keyword, limit = 5) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      "COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  const path = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
  const query = `?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;

  const authorization = generateAuthHeader({
    method: "GET",
    path,
    query,
    accessKey,
    secretKey,
  });

  const res = await fetch(`${DOMAIN}${path}${query}`, {
    method: "GET",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`쿠팡 API 호출 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  const products = data?.data?.productData || [];

  return products.map((p) => ({
    name: p.productName,
    price: p.productPrice,
    image: p.productImage,
    url: p.productUrl, // 이미 제휴 파라미터가 포함된 링크
    isRocket: p.isRocket,
    rating: p.rating,
  }));
}

module.exports = { searchProducts };
