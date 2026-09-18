# 핫딜로그 자동 발행 스크립트 (v2 — 쿠팡 API 승인 없이도 동작)

매일 정해진 시간에 **구글 트렌드의 한국 실시간 인기 검색어**를 가져와서 글을 자동으로 쓰고 워드프레스에 올리는 자동화 도구예요.

## 이전 버전과 달라진 점

쿠팡파트너스 Open API 승인이 안 나도 돌아가도록 구조를 바꿨어요.

- **주제 발굴**: 쿠팡 API 대신 구글 트렌드(무료, 승인 불필요)에서 실시간 인기 검색어를 가져와요.
- **제휴 링크**: API 없이는 자동으로 상품을 검색할 수 없어서, 대신 `config/link-queue.json`에 미리 준비해둔 링크 중 오늘의 트렌드 키워드와 맞는 게 있으면 그걸 써요.
  - 맞는 링크가 있으면 → 완성된 글(링크 포함)로 발행
  - 없으면 → 링크 없이 정보성 글만 초안(draft)으로 만들어둬요. 나중에 사람이 쿠팡 파트너스 사이트에서 수동으로 링크를 만들어 끼워넣고 발행하면 돼요.
- 나중에 쿠팡 Open API가 승인되면, scripts/coupang.js를 다시 연결해서 이 매칭 과정 자체를 자동화할 수 있어요 (코드는 이미 만들어져 있어요).

---

## config/link-queue.json 사용법

쿠팡 파트너스 사이트(https://partners.coupang.com)에서 API 없이도 항상 수동으로 제휴 링크를 만들 수 있어요. 화제가 될 만한 제품을 발견하면, 이 파일에 이렇게 추가해두세요:

```json
[
  {
    "keyword": "에어팟 프로3",
    "productName": "Apple 에어팟 프로 3세대",
    "price": "289,000",
    "url": "https://link.coupang.com/a/실제링크"
  }
]
```

- keyword: 이 키워드가 오늘의 트렌드 검색어에 포함되거나 포함하면 매칭돼요 (부분 일치).
- 여러 개 등록해두면, 트렌드 키워드가 뜰 때마다 자동으로 매칭을 시도해요.

---

## 준비물

### 1. 워드프레스닷컴 OAuth Access Token
(이미 발급받으셨으면 이 단계는 건너뛰세요)

### 2. (선택) Anthropic API 키
Claude로 글을 자동 작성하려면 필요해요. 없으면 최소 뼈대 템플릿만 생성돼요.

### 3. (나중에, 선택) 쿠팡파트너스 API 키
승인이 나면 나중에 추가하면 돼요. 지금 당장은 없어도 전체 흐름이 돌아가요.

### 4. GitHub 저장소 + Secrets

| Secret 이름 | 값 |
|---|---|
| WPCOM_SITE | camnaklog2.wordpress.com |
| WPCOM_ACCESS_TOKEN | 발급받은 토큰 |
| ANTHROPIC_API_KEY | (선택) Claude API 키 |
| PUBLISH_STATUS | draft 권장 (링크 매칭된 글만 이 값을 따름, 링크 없는 글은 항상 draft) |
| COUPANG_ACCESS_KEY | (나중에 승인되면) |
| COUPANG_SECRET_KEY | (나중에 승인되면) |

---

## 실행 확인

- 저장소 Actions 탭 → 워크플로 선택 → Run workflow로 수동 테스트
- 매일 한국시간 오전 9시에 자동 실행
- 링크 매칭이 하나도 안 되는 날에도, 초안 글은 계속 쌓이니 워드프레스 관리자 화면에서 초안함을 주기적으로 확인해서 링크 추가 후 발행해주세요.

## 로컬 테스트

```bash
npm install
export WPCOM_SITE=camnaklog2.wordpress.com
export WPCOM_ACCESS_TOKEN=...
export ANTHROPIC_API_KEY=...
node scripts/index.js
```
