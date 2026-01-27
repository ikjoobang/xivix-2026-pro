# XIVIX 2026 PRO - 개발자 인수인계 문서

## 📌 프로젝트 개요
- **프로젝트명**: XIVIX 2026 PRO (보험왕 AI 마케팅 플랫폼)
- **버전**: V2026.37.50
- **배포 플랫폼**: Cloudflare Pages
- **데이터베이스**: Cloudflare D1 (SQLite)

---

## 🔗 서비스 URL

### 프론트엔드
| 페이지 | URL |
|--------|-----|
| 메인 (커스텀 도메인) | https://xivix.ai.kr |
| 메인 (Cloudflare) | https://xivix-2026-pro.pages.dev |
| 어드민 | https://xivix.ai.kr/admin |

### 백엔드 API
| 서비스 | URL |
|--------|-----|
| API 서버 | https://xivix.ai.kr/api/ |
| Health Check | https://xivix.ai.kr/api/health |
| API 문서 | https://xivix.ai.kr/api/docs |

### 저장소
| 항목 | URL |
|------|-----|
| GitHub | https://github.com/ikjoobang/xivix-2026-pro |

---

## 🛠️ 기술 스택

```
Frontend: HTML/CSS/JavaScript (Vanilla) + TailwindCSS (CDN)
Backend: Hono Framework (TypeScript)
Runtime: Cloudflare Workers
Database: Cloudflare D1 (SQLite)
AI: Google Gemini 2.5 Pro / 2.0 Flash
SMS: Solapi (카카오 알림톡/SMS)
이미지: XIIM 미들웨어 (별도 서비스)
```

---

## 📁 프로젝트 구조

```
/home/user/webapp/
├── src/
│   ├── index.tsx          # 메인 코드 (8,040줄) - 백엔드+프론트엔드 통합
│   └── renderer.tsx       # Hono 렌더러
├── public/
│   └── _headers           # Cloudflare 헤더 설정
├── migrations/            # D1 마이그레이션
├── wrangler.jsonc         # Cloudflare 설정
├── package.json
├── vite.config.ts
└── ecosystem.config.cjs   # PM2 설정 (로컬 개발용)
```

---

## 🔑 환경 변수 / API 키

### wrangler.jsonc 설정
```jsonc
{
  "name": "xivix-2026-pro",
  "d1_databases": [{
    "binding": "DB",
    "database_name": "xivix-production",
    "database_id": "cc1216aa-39ea-47d7-9489-4c2eceb678a2"
  }],
  "vars": {
    "SMS_MOCK_MODE": "true"  // true=SMS 발송 안함, false=실제 발송
  }
}
```

### 코드 내 하드코딩된 키 (src/index.tsx)
```javascript
// Gemini API (라인 ~280)
GEMINI_PRO_KEY = '...'
GEMINI_FLASH_KEY = '...'

// 네이버 트렌드 API (라인 ~290)
NAVER_CLIENT_ID = 'fUhHJ1HWyF6fFw_aBfkg'
NAVER_CLIENT_SECRET = 'gA4jUFDYK0'

// Solapi SMS (라인 ~2010)
SOLAPI_API_KEY = '...'
SOLAPI_API_SECRET = '...'

// XIIM 미들웨어 (라인 ~7012)
XIIM_API_KEY = 'xivix_prod_a752571bf2f96ac9c54e5720c05a56b7'
XIIM_USER_ID = 'xivix_production'
```

---

## 📊 데이터베이스 스키마

### membership_users 테이블
```sql
CREATE TABLE membership_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, SUSPENDED
  created_at DATETIME,
  approved_at DATETIME,
  ip TEXT,
  notification_sent INTEGER DEFAULT 0,
  plan_type TEXT DEFAULT '1m',    -- 1m, 3m, 6m, 12m
  expiry_date TEXT,
  is_suspended INTEGER DEFAULT 0
);
```

### 현재 승인된 사용자 (화이트리스트)
| 이름 | 전화번호 | 비밀번호 | 상태 |
|------|---------|---------|------|
| 방익주 | 010-4845-3065 | 711766 | APPROVED |
| 김미경 | 010-3159-3697 | 090729 | APPROVED |

---

## 🔌 API 엔드포인트

### 인증
```
POST /api/login          - 로그인
POST /api/registration   - 회원가입 신청
```

### 어드민
```
GET  /api/admin/pending-users  - 사용자 목록
POST /api/admin/approve        - 승인
POST /api/admin/suspend        - 정지
POST /api/admin/extend         - 기간 연장
POST /api/admin/reject         - 거절 (삭제)
GET  /api/admin/settings       - 설정 조회
POST /api/admin/settings       - 설정 저장
```

### 콘텐츠 생성
```
POST /api/generate       - AI 콘텐츠 생성 (SSE 스트리밍)
GET  /api/health         - 서버 상태
GET  /api/docs           - API 문서
```

---

## 🖼️ XIIM 이미지 미들웨어 API

### 엔드포인트
```
POST https://xivix-xiim.pages.dev/api/process
```

### 요청 파라미터
```json
{
  "api_key": "xivix_prod_a752571bf2f96ac9c54e5720c05a56b7",
  "request_info": {
    "keyword": "[선택한 제목] [보험사] 설계안",
    "user_id": "xivix_production",
    "target_company": "SAMSUNG_LIFE",
    "title": "[사용자가 선택한 제목]",
    "source_url": "https://xivix.ai.kr",
    "skip_verification": false
  }
}
```

### 응답 구조
```json
{
  "status": "success",
  "data": {
    "final_url": "https://cloudinary.com/..."
  }
}
```

---

## 🚀 배포 방법

### 1. 로컬 개발
```bash
cd /home/user/webapp
npm install
npm run build
pm2 start ecosystem.config.cjs
# http://localhost:3000 에서 확인
```

### 2. Cloudflare 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name xivix-2026-pro
```

### 3. D1 마이그레이션
```bash
# 로컬
npx wrangler d1 execute xivix-production --local --file=./migrations/0001_init.sql

# 프로덕션
npx wrangler d1 execute xivix-production --remote --file=./migrations/0001_init.sql
```

### 4. 사용자 비밀번호 변경
```bash
# base64 인코딩
echo -n "새비밀번호" | base64

# D1 업데이트
npx wrangler d1 execute xivix-production --remote \
  --command="UPDATE membership_users SET password_hash = 'BASE64값' WHERE phone = '010-xxxx-xxxx'"
```

---

## ⚙️ 주요 설정

### SMS Mock 모드
```javascript
// wrangler.jsonc
"vars": { "SMS_MOCK_MODE": "true" }  // 개발: true, 프로덕션: false
```

### 캐시 비활성화 (모바일 프리징 방지)
```javascript
// src/index.tsx - setSecurityHeaders()
c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
c.header('Pragma', 'no-cache');
c.header('Expires', '0');
```

### 네이버 SEO 최적화
- ❶❷❸ 특수기호 사용 금지 → 1. 2. 3. 숫자 사용
- AI 프롬프트에서 자동 적용됨

---

## 📝 최근 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v2026.37.51 | 2026-01-26 | **VIP 무제한** (방익주/김미경 API 무제한) + **모바일 세션 유지** (전화 후 복귀해도 데이터 유지) |
| v2026.37.50 | 2026-01-26 | XIIM API 동적 keyword + title 전송 |
| v2026.37.49 | 2026-01-26 | 로그인 후 자동 새로고침 (F5 불필요) |
| v2026.37.48 | 2026-01-22 | 모바일 viewport 고정 (흔들림 방지) |
| v2026.37.47 | 2026-01-22 | 캐시 헤더 + 카카오 Sync |
| v2026.37.46 | 2026-01-21 | 네이버 SEO 특수기호 제거 |
| v2026.37.45 | 2026-01-21 | SMS Mock 모드 추가 |
| v2026.37.44 | 2026-01-21 | 어드민 [거절] 버튼 + 모바일 카드 UI |

---

## ⚠️ 주의사항

1. **src/index.tsx 단일 파일** - 백엔드+프론트엔드 통합 (8,040줄)
2. **D1 데이터베이스** - 프로덕션 데이터 직접 수정 주의
3. **API 키** - 코드 내 하드코딩됨, 환경변수로 이전 권장
4. **SMS 비용** - SMS_MOCK_MODE=false 시 실제 비용 발생
5. **커스텀 도메인** - xivix.ai.kr → Cloudflare DNS 설정됨

---

## 📞 연락처

- **프로젝트 오너**: 방익주 대표 (010-4845-3065)
- **GitHub**: https://github.com/ikjoobang/xivix-2026-pro


## V2026.37.53 변경 사항 (2026-01-27)

### CEO 지시: 3단계 자동화 (분석→정리→이미지 생성)

**문제점:**
- 기존: 콘텐츠 생성 완료 후 사용자가 "마케팅 이미지 생성" 버튼을 수동 클릭해야 함
- 사장님 요청: 텍스트 입력/이미지 업로드 → Gemini 분석 → 정리 → 이미지 생성까지 한 번에 자동 완료

**수정 내용:**

1. **자동 이미지 생성 흐름**
   - SSE 스트리밍 완료 후 1.5초 뒤 `generateMarketingImage()` 자동 호출
   - 토스트 알림: "AI가 마케팅 이미지를 자동 생성합니다..."
   - `resultData.insurance`만 있으면 자동 시작 (company는 topic에서 추출 가능)

2. **보험사명 추출 로직 개선**
   - 우선순위: 이미지 OCR → topic 텍스트 → 기본값 '삼성생명'
   - 28개 보험사 목록에서 자동 매칭

3. **백엔드 응답 필드 추가**
   - `company`: 이미지 분석에서 추출한 보험사명
   - `productName`: 이미지 분석에서 추출한 상품명
   - 스트리밍 API + Full Package API 모두 적용

**핵심 코드 위치:**
- 자동 이미지 생성: `src/index.tsx` 라인 ~7045 (SSE complete 핸들러)
- 보험사 추출: `src/index.tsx` 라인 ~7340 (generateMarketingImage 함수)
- 백엔드 company 필드: `src/index.tsx` 라인 ~1111, ~1708

## V2026.37.54 변경 사항 (2026-01-27)

### XIIM 미들웨어 V2.4 대응 - Rate Limit & 재시도 로직

**XIIM 측 수정 완료 사항:**
- Subrequest 최적화: ~50+ → ~10개로 감소
- Rate Limiting: 분당 10회 제한, Retry-After 헤더
- 캐싱: KV 기반 5분 TTL
- 자동 재시도: 지수 백오프

**XIVIX 측 대응 완료:**

1. **HTTP 429 Rate Limit 처리**
   ```javascript
   if (response.status === 429) {
     const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
     await new Promise(r => setTimeout(r, retryAfter * 1000));
     // 재시도...
   }
   ```

2. **지수 백오프 재시도**
   - 최대 3회 시도
   - 대기 시간: 1초 → 2초 → 4초
   - UI에 재시도 진행 상황 표시

3. **캐시/Rate Limit 로깅**
   ```
   X-Cache: HIT/MISS
   X-RateLimit-Remaining: 남은 요청 수
   ```

**핵심 코드 위치:**
- 재시도 로직: `src/index.tsx` 라인 ~7440 (generateMarketingImage 함수 내)

## V2026.37.58 변경 사항 (2026-01-27)

### CEO 긴급 지시: 자동 재검색 시스템

**문제 상황**:
- XIIM 미들웨어가 "삼성금융 Open Collaboration" 등 홍보 포스터를 설계서로 반환
- "상속세", "일반보험" 등 특정 키워드에서 반복 발생
- 사용자가 3번 "이미지가 달라요" 버튼을 눌러도 같은 이미지 반환

**XIVIX 측 수정 (V2026.37.58)**:
1. **자동 재검색 루프**: 최대 3회까지 자동으로 다른 이미지 검색
2. **키워드 변형 전략**:
   - 시도 1: `{보험사} {상품} 설계안`
   - 시도 2: `{보험사} {상품} 가입설계서 보험료`
   - 시도 3: `{보험사} {상품} 보장분석표 담보`
   - 시도 4: `{상품} 가입제안서 월보험료`
3. **exclude_urls 파라미터**: 이전에 반환된 잘못된 이미지 URL을 제외 목록에 추가
4. **홍보물 패턴 감지**: URL에서 poster, banner, advertisement 등 패턴 감지
5. **XIIM verification 필드 활용**: is_design_document가 false면 자동 재시도

**핵심 코드 위치**:
- 자동 재검색 루프: `src/index.tsx` 라인 ~7452-7470
- 키워드 변형: `src/index.tsx` 라인 ~7458-7467
- 홍보물 패턴 감지: `src/index.tsx` 라인 ~7608-7645

---

### XIIM 미들웨어 요청 사항 (긴급)

**현재 문제**:
- `verification` 필드가 항상 `null`로 반환됨
- XIVIX가 설계서 여부를 판별할 수 없어 홍보물이 그대로 표시됨

**필수 요청 사항**:
1. **verification 필드 필수 반환**:
   ```json
   {
     "status": "success",
     "data": {
       "final_url": "...",
       "verification": {
         "is_design_document": true/false,
         "confidence": 0.0-1.0,
         "detected_company": "삼성생명",
         "detected_elements": ["피보험자", "월보험료", "담보표"],
         "reason": "판별 사유"
       }
     }
   }
   ```

2. **설계서 필수 요소 검증 (Gemini 프롬프트)**:
   - 필수 요소 (3개 이상 충족 시 설계서로 판정):
     - 피보험자 정보 (이름/나이/성별)
     - 월 보험료 금액 (숫자 + "원" 또는 "만원")
     - 담보 내역 표 (암진단비, 수술비, 입원일당 등)
     - 납입기간/보험기간
     - 보험사 로고 또는 상품명

3. **비설계서 제외 (명시적 필터링)**:
   - 홍보 포스터/광고/마케팅 이미지
   - 회사 소개/이벤트 이미지
   - 일러스트/아이콘/인포그래픽
   - 뉴스 기사/블로그 썸네일

**테스트 케이스**:
- `삼성생명 상속세 설계안` → 상속세 설계서 (홍보물 ❌)
- `삼성생명 일반보험 설계안` → 일반보험 설계서 (홍보물 ❌)
- `한화생명 종신보험 설계안` → 종신보험 설계서

**긴급도**: 🔴 최상 (수천 명의 설계사 사용 중)
