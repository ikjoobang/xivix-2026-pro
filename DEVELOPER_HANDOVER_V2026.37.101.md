# XIVIX 2026 PRO - 개발자 인수인계 문서
## Version: V2026.37.101 (2026-02-07)

---

## 📌 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **프로젝트명** | XIVIX 2026 PRO (보험왕 AI 마케팅 플랫폼) |
| **현재 버전** | V2026.37.101 |
| **배포 플랫폼** | Cloudflare Pages |
| **데이터베이스** | Cloudflare D1 (SQLite) |
| **AI 엔진** | Google Gemini 2.5 Pro + OpenAI GPT-4o |
| **메인 코드** | `src/index.tsx` (11,976줄 - 백엔드+프론트엔드 통합) |

---

## 🔗 2. 서비스 URL

### 프론트엔드
| 페이지 | URL |
|--------|-----|
| 메인 (커스텀 도메인) | https://xivix.ai.kr |
| 메인 (Cloudflare) | https://xivix-2026-pro.pages.dev |
| 어드민 대시보드 | https://xivix.ai.kr/admin |

### 백엔드 API
| 서비스 | URL |
|--------|-----|
| Health Check | https://xivix.ai.kr/api/health |
| API 문서 | https://xivix.ai.kr/api/docs |
| Full Package (일반) | https://xivix.ai.kr/api/generate/full-package |
| Full Package (SSE) | https://xivix.ai.kr/api/generate/full-package-stream |
| 뉴스 Q&A | https://xivix.ai.kr/api/generate/news-qa |
| 질문 생성 | https://xivix.ai.kr/api/generate/question |
| 댓글 생성 | https://xivix.ai.kr/api/generate/comments |
| 트렌드 | https://xivix.ai.kr/api/trend |

### 저장소
| 항목 | URL |
|------|-----|
| GitHub | https://github.com/ikjoobang/xivix-2026-pro |

---

## 🛠️ 3. 기술 스택

```
├── Frontend
│   ├── HTML/CSS/JavaScript (Vanilla)
│   ├── TailwindCSS (CDN)
│   └── Font Awesome (CDN)
│
├── Backend
│   ├── Hono Framework (TypeScript)
│   ├── Cloudflare Workers Runtime
│   └── SSE (Server-Sent Events) 스트리밍
│
├── Database
│   └── Cloudflare D1 (SQLite)
│
├── AI Engines
│   ├── Google Gemini 2.5 Pro (PRO 엔진)
│   ├── Google Gemini 2.0 Flash (FLASH 엔진)
│   └── OpenAI GPT-4o (뉴스 Q&A 전용)
│
├── 외부 서비스
│   ├── Solapi (카카오 알림톡/SMS)
│   ├── 네이버 DataLab API (트렌드)
│   ├── 빗썸 API (비트코인 시세)
│   └── XIIM 미들웨어 (이미지 검색)
│
└── DevOps
    ├── Wrangler CLI
    ├── Vite Build
    └── PM2 (로컬 개발)
```

---

## 📁 4. 프로젝트 구조

```
/home/user/webapp/
├── src/
│   ├── index.tsx          # 메인 코드 (11,976줄) - 백엔드+프론트엔드 통합
│   └── renderer.tsx       # Hono JSX 렌더러
│
├── public/
│   ├── _headers           # Cloudflare 캐시/보안 헤더
│   ├── manifest.json      # PWA 매니페스트
│   └── static/            # 정적 파일
│
├── migrations/
│   └── 0001_users_table.sql  # D1 스키마
│
├── dist/                  # 빌드 출력 (배포용)
│   ├── _worker.js
│   └── _routes.json
│
├── .wrangler/             # Wrangler 로컬 상태
│
├── wrangler.jsonc         # Cloudflare 설정
├── vite.config.ts         # Vite 빌드 설정
├── package.json           # 의존성
├── tsconfig.json          # TypeScript 설정
└── ecosystem.config.cjs   # PM2 설정 (로컬 개발용)
```

---

## 🔑 5. 환경 변수 / API 키

### 5.1 wrangler.jsonc 설정
```jsonc
{
  "name": "xivix-2026-pro",
  "compatibility_date": "2026-01-17",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "xivix-production",
    "database_id": "cc1216aa-39ea-47d7-9489-4c2eceb678a2"
  }],
  "vars": {
    "SMS_MOCK_MODE": "true"  // true=SMS 미발송, false=실제 발송
  }
}
```

### 5.2 Bindings 인터페이스 (src/index.tsx 라인 1-15)
```typescript
type Bindings = {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_PRO?: string;
  GEMINI_API_KEY_FLASH?: string;
  OPENAI_API_KEY?: string;      // GPT-4o용
  NAVER_CLIENT_ID?: string;     // 트렌드 API
  NAVER_CLIENT_SECRET?: string;
  DB?: D1Database;              // Cloudflare D1
}
```

### 5.3 하드코딩된 API 키 위치 (보안 주의!)
| 키 | 라인 번호 | 용도 |
|----|----------|------|
| GEMINI_PRO_KEY | ~280 | Gemini 2.5 Pro |
| GEMINI_FLASH_KEY | ~280 | Gemini 2.0 Flash |
| NAVER_CLIENT_ID | 754 | 네이버 DataLab |
| NAVER_CLIENT_SECRET | 755 | 네이버 DataLab |
| SOLAPI_API_KEY | ~2712 | SMS/알림톡 |
| XIIM_API_KEY | ~3292 | XIIM 이미지 |

### 5.4 네이버 카페 API 정보 (연동 예정)
```
Client ID: fUhHJ1HWyF6fFw_aBfkg
Client Secret: gA4jUFDYK0
Cafe ID: 10347037
Menu ID: 189
API URL: https://openapi.naver.com/v1/cafe/10347037/menu/189/articles
※ OAuth 2.0 Access Token 필요 (사용자 로그인 연동 필요)
```

---

## 📊 6. 데이터베이스 스키마

### 6.1 users 테이블 (migrations/0001_users_table.sql)
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',  -- PENDING, APPROVED, SUSPENDED
  created_at TEXT DEFAULT (datetime('now')),
  approved_at TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
```

### 6.2 사용자 상태
| 상태 | 설명 |
|------|------|
| PENDING | 가입 신청 대기 |
| APPROVED | 승인됨 (서비스 이용 가능) |
| SUSPENDED | 정지됨 |

---

## 🔌 7. API 엔드포인트 상세

### 7.1 인증 API
```
POST /api/login
  Body: { phone, password }
  Response: { success, user, token }

POST /api/registration
  Body: { name, phone, password }
  Response: { success, message }
```

### 7.2 콘텐츠 생성 API

#### Full Package (일반)
```
POST /api/generate/full-package
  Body: {
    topic: string,           // 키워드 (예: "암보험")
    images?: [{              // 이미지 배열 (최대 10장)
      base64: string,
      mimeType: string
    }],
    aiModel?: 'gemini' | 'gpt'  // AI 엔진 선택
  }
  Response: {
    titles: string[],        // 제목 5개
    viralQuestions: string[], // 바이럴 질문 3개
    contents: string[],      // 본문 3개 (공감형/팩트형/영업형)
    comments: string[],      // 댓글 5개
    seoKeywords: string[],   // SEO 키워드 5개
    hashtags: string[],      // 해시태그 5개
    seo: { score, grade, rank },
    report_data: [],         // 보장 분석 데이터 (이미지 OCR 시)
    imageAnalysis: {}        // 이미지 분석 결과
  }
```

#### Full Package (SSE 스트리밍)
```
POST /api/generate/full-package-stream
  Body: (동일)
  Response: SSE 스트림
    - { type: 'step', step: 1-5, label: string }
    - { type: 'progress', percent: number }
    - { type: 'titles', data: [...] }
    - { type: 'questions', data: [...] }
    - { type: 'content', index: 0-2, data: {...} }
    - { type: 'comments', data: [...] }
    - { type: 'complete', data: {...} }
```

#### 뉴스 Q&A (GPT-4o 전용)
```
POST /api/generate/news-qa
  Body: {
    newsText?: string,       // 뉴스 기사 텍스트
    images?: [{base64, mimeType}]  // 뉴스 캡처 이미지
  }
  Response: SSE 스트림
    - Step 1: 뉴스 분석
    - Step 2: Q&A 생성
    - Step 3: 전문가 답변
    - Step 4: 댓글 생성
    - Step 5: 해시태그 생성
```

### 7.3 어드민 API
```
GET  /api/admin/pending-users     - 전체 사용자 목록
POST /api/admin/approve           - 사용자 승인 (plan_type, expiry_date)
POST /api/admin/suspend           - 사용자 정지
POST /api/admin/reject            - 사용자 삭제
POST /api/admin/extend            - 기간 연장
GET  /api/admin/expiring-users    - 만료 예정자 조회
POST /api/admin/send-expiry-reminders - 만료 알림 일괄 발송
GET  /api/admin/settings          - 설정 조회
POST /api/admin/settings          - 설정 저장
POST /api/admin/test-sms          - SMS 테스트 발송
```

### 7.4 유틸리티 API
```
GET  /api/health          - 서버 상태/버전 확인
GET  /api/docs            - OpenAPI 문서
GET  /api/trend           - 네이버 트렌드 데이터
GET  /api/market-data     - 실시간 시세 (금/비트코인/환율)
GET  /api/insurance-news  - 보험 뉴스
GET  /manifest.json       - PWA 매니페스트
```

---

## 🖼️ 8. XIIM 이미지 미들웨어 연동

### 8.1 엔드포인트
```
POST /api/xiim/process
  → Proxy to: https://xivix-xiim.pages.dev/api/process
```

### 8.2 요청 형식
```json
{
  "api_key": "xivix_prod_a752571bf2f96ac9c54e5720c05a56b7",
  "request_info": {
    "keyword": "[보험사] [상품] 설계안",
    "user_id": "xivix_production",
    "target_company": "SAMSUNG_LIFE",
    "title": "[선택한 제목]",
    "source_url": "https://xivix.ai.kr",
    "skip_verification": false
  }
}
```

### 8.3 응답 형식
```json
{
  "status": "success",
  "data": {
    "final_url": "https://cloudinary.com/...",
    "verification": {
      "is_design_document": true,
      "confidence": 0.95,
      "detected_company": "삼성생명"
    }
  }
}
```

---

## 🚀 9. 배포 가이드

### 9.1 로컬 개발
```bash
cd /home/user/webapp

# 의존성 설치
npm install

# 빌드
npm run build

# PM2로 로컬 서버 시작
pm2 start ecosystem.config.cjs

# 확인
curl http://localhost:3000/api/health
```

### 9.2 Cloudflare 배포
```bash
# 빌드 + 배포
npm run build
npx wrangler pages deploy dist --project-name xivix-2026-pro

# 또는 한번에
npm run deploy
```

### 9.3 D1 마이그레이션
```bash
# 로컬 DB
npx wrangler d1 execute xivix-production --local --file=./migrations/0001_users_table.sql

# 프로덕션 DB
npx wrangler d1 execute xivix-production --remote --file=./migrations/0001_users_table.sql

# SQL 직접 실행
npx wrangler d1 execute xivix-production --remote --command="SELECT * FROM users"
```

### 9.4 비밀번호 변경
```bash
# base64 인코딩
echo -n "새비밀번호" | base64

# DB 업데이트
npx wrangler d1 execute xivix-production --remote \
  --command="UPDATE users SET password_hash = 'BASE64값' WHERE phone = '010-xxxx-xxxx'"
```

---

## ⚙️ 10. 주요 설정

### 10.1 캐시 비활성화 (public/_headers)
```
/*
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-XSS-Protection: 1; mode=block
```

### 10.2 AI 엔진 설정 (src/index.tsx 라인 26-32)
```typescript
const ENGINE = {
  FLASH: 'gemini-2.0-flash',      // 빠른 처리
  PRO: 'gemini-2.5-pro',          // 전문가 분석
  VISION: 'gemini-2.5-pro',       // 이미지 OCR
  GPT4O: 'gpt-4o'                 // 뉴스 Q&A
}
```

### 10.3 본문 길이 설정 (라인 42-49)
```typescript
const CONTENT_LENGTH_MODES = [
  { mode: 'SHORT', min: 500, max: 700, label: '핵심형', weight: 0.3 },
  { mode: 'MID', min: 800, max: 1000, label: '전문형', weight: 0.5 },
  { mode: 'LONG', min: 1100, max: 1400, label: '심층형', weight: 0.2 }
]
```

### 10.4 제목 금지어 (라인 56-67)
```typescript
const TITLE_BANNED_WORDS = [
  '가이드', '전략', '포인트', '충격', '필독', '핵심 정리',
  '필수', '꿀팁', '비밀', '대박', '경악', '소름', '절대',
  '반드시', '무조건', '최고의', '최악의', '완벽', '확실',
  '즉시', '지금 당장', '놀라운', '충격적', '믿기 힘든'
]
```

---

## 📝 11. 핵심 함수 목록

### 11.1 AI 호출 함수
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `callGeminiWithPersona()` | 273 | Gemini API 호출 (페르소나 포함) |
| `callOpenAI()` | 311 | GPT-4o API 호출 |
| `getApiKey()` | 262 | API 키 폴백 처리 |

### 11.2 프롬프트 빌더
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `analyzeTarget()` | 413 | 타겟 분석 (보험종류/연령) |
| `buildExpertPrompt()` | 500 | 전문가 답변 프롬프트 |
| `buildBeginnerPrompt()` | 541 | 초보자 질문 프롬프트 |
| `buildCommentPrompt()` | 572 | 댓글 생성 프롬프트 |

### 11.3 유틸리티 함수
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `selectContentLength()` | 80 | 본문 길이 랜덤 선택 |
| `selectViralQuestionLength()` | 69 | 질문 길이 랜덤 선택 |
| `filterBannedWordsFromTitle()` | 238 | 제목 금지어 필터링 |
| `generateRealtimeTrends()` | 714 | 트렌드 데이터 생성 |

### 11.4 SMS/알림 함수
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `sendSolapiMessage()` | 2748 | SMS/알림톡 발송 |
| `getSolapiCredentials()` | 2712 | Solapi 인증 정보 |
| `generateSolapiSignature()` | 2720 | HMAC 서명 생성 |
| `sendAdminNotification()` | 2852 | 관리자 알림 발송 |

---

## 🎨 12. 프론트엔드 주요 함수 (HTML 내장)

### 12.1 UI 제어
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `resetEverything()` | 7482 | 전체 새로고침/리셋 |
| `goGenerate()` | ~7800 | 일반 콘텐츠 생성 |
| `goGenerateNewsQA()` | ~8900 | 뉴스 Q&A 생성 |
| `renderFileList()` | ~7300 | 업로드 파일 목록 |
| `removeFile()` | ~7350 | 파일 삭제 |

### 12.2 결과 렌더링
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `renderTitles()` | ~8100 | 제목 5개 렌더링 |
| `renderContents()` | ~8200 | 본문 3개 렌더링 |
| `renderComments()` | ~8400 | 댓글 5개 렌더링 |
| `renderHashtags()` | ~8500 | 해시태그 렌더링 |
| `renderReportData()` | ~8627 | 보장 분석 테이블 |
| `renderSeoKeywords()` | ~8550 | SEO 키워드 렌더링 |

### 12.3 복사/다운로드
| 함수명 | 라인 | 설명 |
|--------|------|------|
| `copyToClipboard()` | ~7600 | 클립보드 복사 |
| `copyAll()` | ~7650 | 전체 복사 |
| `downloadTxt()` | ~9700 | TXT 다운로드 |
| `downloadPdf()` | ~9750 | PDF 다운로드 |

---

## ⚠️ 13. 주의사항

### 13.1 코드 구조
- **단일 파일 구조**: `src/index.tsx` 하나에 백엔드+프론트엔드 모두 포함 (11,976줄)
- **HTML 템플릿 리터럴**: 프론트엔드 HTML이 백틱(``) 안에 있음
- **수정 시 주의**: 백틱/따옴표 이스케이프 에러 발생 가능

### 13.2 보안
- **API 키 하드코딩**: 코드 내 API 키가 직접 입력되어 있음 → 환경변수 이전 권장
- **비밀번호 저장**: Base64 인코딩 (해시 아님) → bcrypt 등으로 변경 권장

### 13.3 SMS 비용
- `SMS_MOCK_MODE=true`: SMS 미발송 (개발용)
- `SMS_MOCK_MODE=false`: 실제 SMS 발송 (비용 발생)

### 13.4 데이터베이스
- 프로덕션 D1 직접 수정 시 주의
- 백업 없음 → 중요 변경 전 데이터 백업 권장

---

## 📋 14. 버전 히스토리 (최근)

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| V2026.37.101 | 2026-02-07 | 강제 브라우저 캐시 삭제, 전체 새로고침 버튼 |
| V2026.37.100 | 2026-02-07 | 전체 새로고침/리셋 버튼 추가 (PC/모바일) |
| V2026.37.99 | 2026-02-06 | 뉴스 Q&A API 다중 이미지 지원 (최대 10장) |
| V2026.37.98 | 2026-02-06 | 뉴스 Q&A SSE 스트리밍 5단계 |
| V2026.37.95 | 2026-02-05 | GPT-4o 뉴스 모드 추가, OCR 프롬프트 재설계 |

---

## 📞 15. 연락처

- **프로젝트 오너**: 방익주 대표
- **연락처**: 010-4845-3065
- **GitHub**: https://github.com/ikjoobang/xivix-2026-pro
- **서비스 URL**: https://xivix.ai.kr

---

## 🔧 16. 트러블슈팅

### Q1. 빌드 에러 발생 시
```bash
rm -rf dist .wrangler/tmp
npm run build
```

### Q2. 포트 충돌 시
```bash
fuser -k 3000/tcp
pm2 delete all
pm2 start ecosystem.config.cjs
```

### Q3. D1 연결 안될 때
```bash
# 로컬 D1 초기화
rm -rf .wrangler/state/v3/d1
npx wrangler d1 execute xivix-production --local --file=./migrations/0001_users_table.sql
```

### Q4. Cloudflare 인증 에러
```bash
npx wrangler whoami
# 실패 시 재로그인
npx wrangler login
```

### Q5. PM2 로그 확인
```bash
pm2 logs xivix-2026 --nostream
```

---

**문서 작성일**: 2026-02-07
**작성 버전**: V2026.37.101
