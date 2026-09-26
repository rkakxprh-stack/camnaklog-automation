name: 핫딜로그 발행 상태 점검(sweep)

# GitHub 예약 실행은 몇 시간씩 밀리는 경우가 많아서(실제로 오전 9시 예약이 오후 2시쯤 실행됨),
# 발행 직후 고정 시각에만 점검하면 글이 올라오기도 전에 점검이 끝나버립니다.
# 그래서 3시간마다 돌면서 지난 26시간 안에 draft로 되돌아간 글을 찾아 재발행합니다.
on:
  schedule:
    - cron: "0 */3 * * *"
  workflow_dispatch: {}

jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - name: 저장소 체크아웃
        uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: draft 되돌림 점검 및 재발행
        env:
          WPCOM_SITE: ${{ secrets.WPCOM_SITE }}
          WPCOM_ACCESS_TOKEN: ${{ secrets.WPCOM_ACCESS_TOKEN }}
          SWEEP_LOOKBACK_HOURS: "26"
        run: node scripts/sweep-drafts.js
