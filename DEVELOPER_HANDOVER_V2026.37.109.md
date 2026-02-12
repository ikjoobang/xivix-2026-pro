# XIVIX 2026 PRO — 개발자 인수인계 문서

> **버전**: V2026.37.109  
> **최종 갱신**: 2026-02-12  
> **프로덕션 URL**: https://xivix.ai.kr  
> **Cloudflare Pages**: https://xivix-2026-pro.pages.dev  
> **GitHub**: https://github.com/ikjoobang/xivix-2026-pro  

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉터리 구조](#3-디렉터리-구조)
4. [환경 변수 / 시크릿](#4-환경-변수--시크릿)
5. [AI 엔진 구성](#5-ai-엔진-구성)
6. [백엔드 API 엔드포인트 전체 목록](#6-백엔드-api-엔드포인트-전체-목록)
7. [핵심 비즈니스 로직 상세](#7-핵심-비즈니스-로직-상세)
8. [프론트엔드 구조 상세](#8-프론트엔드-구조-상세)
9. [D1 데이터베이스 스키마](#9-d1-데이터베이스-스키마)
10. [외부 서비스 연동](#10-외부-서비스-연동)
11. [빌드 / 개발 / 배포 절차](#11-빌드--개발--배포-절차)
12. [프롬프트 엔지니어링 핵심 규칙](#12-프롬프트-엔지니어링-핵심-규칙)
13. [버전 히스토리 (주요 마일스톤)](#13-버전-히스토리-주요-마일스톤)
14. [알려진 이슈 / 기술 부채](#14-알려진-이슈--기술-부채)
15. [운영 가이드](#15-운영-가이드)
16. [향후 로드맵 / 미구현 사항](#16-향후-로드맵--미구현-사항)

---

## 1. 프로젝트 개요

### 1.1 프로젝트 정의

**XIVIX 2026 PRO**는 보험 설계사(FP)를 위한 **AI 기반 보험 콘텐츠 자동 생성 엔진**입니다.

- **핵심 기능**: 보험 가입설계서 이미지(또는 텍스트)를 업로드하면 AI가 OCR → 분석 → 네이버 카페용 Q&A 콘텐츠(제목/본문/전문가답변/댓글/해시태그)를 자동 생성
- **사용자**: 수천 명의 보험설계사 (유료 멤버십)
- **목표**: 네이버 C-RANK, DIA, AEO, GEO 알고리즘 최적화를 통한 카페 상위노출 1위

### 1.2 비즈니스 모델

- 유료 멤버십 (가입 신청 → 입금 → 관리자 수동 승인)
- 기간: 1개월/3개월/6개월/12개월
- 관리자: 방익주 대표 (010-4845-3065), 김미경 (010-3159-3697)

### 1.3 2가지 콘텐츠 생성 모드

| 모드 | 입력 | AI 엔진 | 출력 |
|------|------|---------|------|
| **보험 설계서 Q&A** (신규, 핵심) | 설계서 이미지 1~10장 + 텍스트 | GPT-4o (OpenAI) | 초보자 질문글 + 전문가답변 + 댓글3 + 해시태그10 |
| **키워드 콘텐츠** (기존) | 키워드/트렌드 선택 | Gemini 2.5 Pro/Flash | 전문가글 + 바이럴질문 + 댓글5 + SEO키워드 |

---

## 2. 기술 스택

| 레이어 | 기술 | 비고 |
|--------|------|------|
| **프레임워크** | Hono v4.11.4 | Cloudflare Workers 네이티브 |
| **런타임** | Cloudflare Workers (Edge) | Node.js API 사용 불가 |
| **빌드** | Vite 6.x + @hono/vite-build | `dist/` 폴더로 빌드 |
| **언어** | TypeScript (ESNext, JSX → hono/jsx) | 단일 파일 `src/index.tsx` (12,844줄) |
| **DB** | Cloudflare D1 (SQLite) | 바인딩명: `DB`, DB명: `xivix-production` |
| **AI 1** | OpenAI GPT-4o | 보험 설계서 Q&A (OCR + 생성) |
| **AI 2** | Google Gemini 2.5 Pro / 2.0 Flash | 키워드 콘텐츠 (제목/본문/댓글) |
| **검색 데이터** | 네이버 데이터랩 API | 실시간 보험 트렌드 |
| **시세 데이터** | 빗썸 API (BTC), 시뮬레이션 (금/환율) | 대시보드 티커 |
| **SMS** | 솔라피(Solapi) API | 승인/만료/정지 알림 |
| **알림** | 네이버 톡톡 Chatbot API | 가입 신청 관리자 알림 |
| **프론트엔드** | Vanilla JS + Tailwind CSS (CDN) + Font Awesome | 인라인 HTML (SPA 아님) |
| **이미지 프록시** | XIIM (외부 마이크로서비스) | `xivix-xiim.pages.dev` |
| **호스팅** | Cloudflare Pages | 커스텀 도메인 `xivix.ai.kr` |
| **VCS** | Git → GitHub | `ikjoobang/xivix-2026-pro`, branch: `main` |
| **프로세스 관리** | PM2 (로컬 개발) | `ecosystem.config.cjs` |

---

## 3. 디렉터리 구조

```
webapp/
├── src/
│   ├── index.tsx          # ★ 메인 애플리케이션 (12,844줄) — 백엔드 API + 프론트엔드 HTML 전부
│   └── renderer.tsx       # Hono JSX 렌더러 (style.css 연결)
├── public/
│   ├── _headers           # Cloudflare Pages 커스텀 헤더 (캐시 비활성화)
│   ├── manifest.json      # PWA 매니페스트
│   └── static/
│       └── style.css      # 최소 스타일시트 (대부분 인라인 CSS)
├── migrations/
│   └── 0001_users_table.sql  # D1 초기 마이그레이션 (users 테이블)
├── dist/                  # Vite 빌드 산출물 (git 미추적)
├── .wrangler/             # 로컬 D1 SQLite (git 미추적)
├── .dev.vars              # 로컬 환경 변수 (git 미추적, API 키 포함)
├── ecosystem.config.cjs   # PM2 설정 (로컬 개발용)
├── wrangler.jsonc         # Cloudflare 설정 (D1 바인딩, SMS 목업 모드)
├── vite.config.ts         # Vite + Hono 빌드 설정
├── tsconfig.json          # TypeScript 설정
├── package.json           # 의존성 및 스크립트
└── .gitignore             # node_modules, .wrangler, .env 등 제외
```

### 3.1 핵심 파일: `src/index.tsx` 구조 맵

| 라인 범위 | 섹션 | 설명 |
|-----------|------|------|
| 1–17 | 임포트/타입/앱 초기화 | `Hono<{ Bindings }>`, CORS 미들웨어 |
| 18–258 | 상수/설정 | ENGINE, 콘텐츠 길이, 제목 금지어, 전문가 지식베이스, 마스터 프롬프트, 페르소나, 랜덤화 매트릭스, 제목 패턴 |
| 259–590 | 유틸리티 함수 | `getApiKey`, `callGeminiWithPersona`, `callOpenAI`, `analyzeTarget`, `buildExpertPrompt`, `buildBeginnerPrompt`, `buildCommentPrompt` |
| 594–686 | API: 키워드 콘텐츠 | `/api/generate/master` (SSE), `/api/generate/question`, `/api/generate/comments` |
| 688–977 | API: 트렌드/시세/뉴스 | `/api/trend`, `/api/market-data`, `/api/insurance-news` |
| 980–1075 | API: 이미지 업로드/분석 | `/api/upload`, `/api/analyze/image` |
| 1084–2380 | API: Full Package (기존) | `/api/generate/full-package` (비스트리밍), `/api/generate/full-package-stream` (SSE) |
| 2382–2538 | API: 인증 | `/api/login`, `/api/registration` |
| 2540–2690 | API: 시스템 | `/manifest.json`, `/api/health`, `/api/docs`, `/api/admin/stats` |
| 2700–2886 | 솔라피 SMS / 네이버 톡톡 | SMS 발송, 알림톡, Webhook |
| 2889–3290 | API: 관리자 | `/api/admin/*` (대기유저, 승인, 정지, 거절, 연장, 설정, 테스트SMS, 만료알림) |
| 3292–3475 | API: XIIM 프록시 / SVG 생성 | `/api/xiim/process`, `/api/xiim/openai/generate` |
| 3476–3710 | API: 10가지 질문 생성 | `/api/generate/questions` (OCR → 초보자 질문 10개) |
| 3714–4626 | ★ API: 보험 Q&A 생성 | `/api/generate/news-qa` (5단계 SSE 파이프라인) |
| 4628–12752 | 프론트엔드 HTML/CSS/JS | `mainPageHtml` (인라인 SPA 전체) |
| 12754–12844 | 라우트 핸들러 | `GET /`, `GET /admin`, `GET /admin/dashboard` |

---

## 4. 환경 변수 / 시크릿

### 4.1 프로덕션 (Cloudflare Dashboard → Settings → Environment variables)

| 변수명 | 용도 | 비고 |
|--------|------|------|
| `GEMINI_API_KEY` | Gemini API 호환 키 (폴백) | PRO 키 없을 때 사용 |
| `GEMINI_API_KEY_PRO` | Gemini 2.5 Pro 전용 키 | 품질 글쓰기, 전문가 답변, OCR |
| `GEMINI_API_KEY_FLASH` | Gemini 2.0 Flash 전용 키 | 초보 질문, 댓글 생성 |
| `OPENAI_API_KEY` | OpenAI GPT-4o 키 | 보험 설계서 Q&A (핵심!) |
| `NAVER_CLIENT_ID` | 네이버 개발자 앱 Client ID | 데이터랩 검색 트렌드 |
| `NAVER_CLIENT_SECRET` | 네이버 개발자 앱 Client Secret | 데이터랩 검색 트렌드 |
| `SOLAPI_API_KEY` | 솔라피 API Key | SMS/알림톡 발송 |
| `SOLAPI_API_SECRET` | 솔라피 API Secret | HMAC-SHA256 서명 |

### 4.2 wrangler.jsonc 공개 변수

| 변수명 | 값 | 용도 |
|--------|-----|------|
| `SMS_MOCK_MODE` | `"true"` | `"true"`이면 SMS 실제 발송 안 하고 로그만 출력 |

### 4.3 로컬 개발 (`.dev.vars`)

```env
GEMINI_API_KEY_PRO=실제키
GEMINI_API_KEY_FLASH=실제키
GEMINI_API_KEY=실제키
OPENAI_API_KEY=실제키
NAVER_CLIENT_ID=실제키
NAVER_CLIENT_SECRET=실제키
```

### 4.4 D1 바인딩

| 바인딩명 | 데이터베이스명 | database_id |
|----------|---------------|-------------|
| `DB` | `xivix-production` | `cc1216aa-39ea-47d7-9489-4c2eceb678a2` |

---

## 5. AI 엔진 구성

```typescript
const ENGINE = {
  FLASH: 'gemini-2.0-flash',   // 빠른 처리 (질문/댓글)
  PRO: 'gemini-2.5-pro',       // 품질 글쓰기 (전문가 답변, OCR)
  VISION: 'gemini-2.5-pro',    // 이미지 OCR (PRO와 동일)
  GPT4O: 'gpt-4o'              // 보험 설계서 Q&A 전용
}
```

### 5.1 API 키 우선순위 (Gemini)

```
GEMINI_API_KEY_PRO → GEMINI_API_KEY_FLASH → GEMINI_API_KEY (순서대로 폴백)
```

### 5.2 GPT-4o 호출 (보험 Q&A)

- **엔드포인트**: `https://api.openai.com/v1/chat/completions`
- **모델**: `gpt-4o`
- **temperature**: 0.85 (답변/댓글), 0.5 (해시태그)
- **max_tokens**: 2000 (답변), 1200 (댓글), 500 (해시태그), 4000 (일반)
- **JSON 모드**: `response_format: { type: 'json_object' }` (분석/Q&A)

### 5.3 Gemini 호출 (키워드 콘텐츠)

- **엔드포인트**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **스트리밍**: `streamGenerateContent?alt=sse` (SSE 방식)
- **temperature**: 0.9, **topP**: 0.95, **topK**: 40
- **max_tokens**: 8192

---

## 6. 백엔드 API 엔드포인트 전체 목록

### 6.1 콘텐츠 생성 API

| 메서드 | 경로 | 설명 | AI 엔진 | 응답 |
|--------|------|------|---------|------|
| POST | `/api/generate/master` | 전문가 페르소나 콘텐츠 (SSE) | Gemini PRO | SSE stream |
| POST | `/api/generate/question` | 초보 질문 게시글 생성 | Gemini FLASH | JSON |
| POST | `/api/generate/comments` | 댓글 5개 생성 | Gemini FLASH | JSON |
| POST | `/api/generate/full-package` | 통합 콘텐츠 (비스트리밍) | Gemini/GPT | JSON |
| POST | `/api/generate/full-package-stream` | ★ 통합 콘텐츠 (SSE 스트리밍) | Gemini/GPT | SSE stream |
| POST | `/api/generate/questions` | 보험 설계서 → 10가지 초보자 질문 | GPT-4o | JSON |
| POST | `/api/generate/news-qa` | ★★ 보험 Q&A 5단계 파이프라인 (SSE) | GPT-4o | SSE stream |

### 6.2 데이터 API

| 메서드 | 경로 | 설명 | 데이터 소스 |
|--------|------|------|------------|
| GET | `/api/trend` | 보험 트렌드 키워드 8개 | 네이버 데이터랩 + 시뮬레이션 폴백 |
| GET | `/api/market-data` | 금시세/BTC/환율 | 빗썸 API + 시뮬레이션 |
| GET | `/api/insurance-news` | 보험 뉴스 헤드라인 | 시간대별 하드코딩 풀 |

### 6.3 이미지 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/upload` | Base64 이미지 업로드 (검증만, 저장 불가) |
| POST | `/api/analyze/image` | Gemini Vision OCR 단독 분석 |
| POST | `/api/xiim/process` | XIIM 외부 서비스 프록시 |
| POST | `/api/xiim/openai/generate` | SVG 보험 설계서 이미지 생성 |

### 6.4 인증 API

| 메서드 | 경로 | 설명 | 상태값 |
|--------|------|------|--------|
| POST | `/api/login` | 로그인 (전화번호 + 비밀번호) | `APPROVED`/`PENDING` |
| POST | `/api/registration` | 멤버십 가입 신청 | → D1 저장 + 톡톡 알림 |

### 6.5 관리자 API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/pending-users` | 대기 중인 가입 신청 목록 |
| POST | `/api/admin/approve` | 사용자 승인 (SMS 발송) |
| POST | `/api/admin/suspend` | 사용자 정지 |
| POST | `/api/admin/reject` | 사용자 거절 (D1에서 삭제) |
| POST | `/api/admin/extend` | 멤버십 연장 (일 단위) |
| GET | `/api/admin/settings` | 설정 조회 |
| POST | `/api/admin/settings` | 설정 변경 |
| POST | `/api/admin/test-sms` | SMS 테스트 발송 |
| GET | `/api/admin/expiring-users` | 만료 예정 사용자 조회 |
| POST | `/api/admin/send-expiry-reminders` | 만료 알림 일괄 발송 |

### 6.6 시스템 / 정적

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스체크 + 엔진/버전 정보 |
| GET | `/api/docs` | API 문서 (JSON) |
| GET | `/api/admin/stats` | 시스템 통계 |
| GET | `/manifest.json` | PWA 매니페스트 |
| POST | `/api/webhook/talktalk` | 네이버 톡톡 Webhook 수신 |
| GET | `/api/webhook/talktalk` | 톡톡 Webhook 검증 |
| GET | `/` | 메인 페이지 (인라인 HTML SPA) |
| GET | `/admin` | 관리자 페이지 리다이렉트 |
| GET | `/admin/dashboard` | 관리자 대시보드 (인라인 HTML) |

---

## 7. 핵심 비즈니스 로직 상세

### 7.1 ★ 보험 설계서 Q&A 파이프라인 (`/api/generate/news-qa`)

**5단계 SSE 스트리밍 파이프라인** — 이 프로젝트의 핵심 기능:

```
Step 1: OCR 분석 (GPT-4o Vision)
  ├── 이미지 → OCR + 텍스트 → 통합분석
  ├── analysisCache 있으면 → OCR 스킵 (캐시 사용)
  └── 출력: analysisData (JSON)
         ├── company, product_name, product_type
         ├── insured_age, insured_gender
         ├── payment_period, coverage_period
         ├── monthly_premium, total_premium
         ├── surrender_values (해약환급금 배열)
         ├── interest_rate
         ├── key_benefits (담보 배열)
         └── user_concern

Step 2: Q&A 콘텐츠 생성 (GPT-4o)
  ├── 입력: analysisData + effectiveQuestion + writer(페르소나)
  ├── 페르소나: 나이/보험종류별 자동 선택 (writerPool)
  ├── 제목 패턴: 건강보험/연금보험 분기 (titlePatterns)
  ├── 구조 변형: 4가지 랜덤 (structureVariants)
  └── 출력: { title, content, questions_in_content, reference_data }

Step 3: 전문가 답변 생성 (GPT-4o)
  ├── 전문가 풀: 건강보험용 healthExpertPool / 연금보험용 pensionExpertPool
  ├── V2026.37.109: 건강보험일 때 "연금전문가K" 선택 방지
  ├── 답변 길이: 800~1200자
  ├── 핵심 규칙: 담보명 5개 이상 따옴표로 인용
  └── 출력: expertAnswer (순수 텍스트)

Step 4: 댓글 3개 생성 (GPT-4o)
  ├── 3가지 페르소나: 공감형 / 정보형 / 질문형
  ├── 닉네임: 시드 기반 랜덤 풀에서 선택
  ├── 건강보험: "은퇴/연금/적금" 용어 금지
  └── 출력: comments[3]

Step 5: 해시태그 10개 생성 (GPT-4o)
  ├── 구성: 보험유형(2~3) + 담보(2~3) + 행동유도(2~3) + 정보(1~2)
  ├── 이미지에 없는 회사명 태그 금지
  └── 출력: hashtags[10]
```

### 7.2 10가지 질문 선택 모드 (`/api/generate/questions`)

V2026.37.105에서 도입된 **2단계 UX 흐름**:

1. 사용자가 이미지/텍스트를 업로드
2. `/api/generate/questions` → GPT-4o가 OCR + 10가지 초보자 질문 생성
3. 사용자가 10개 중 1개 선택
4. 선택한 질문 + `analysisCache` → `/api/generate/news-qa`로 전달 (OCR 재분석 없음)

### 7.3 키워드 콘텐츠 파이프라인 (`/api/generate/full-package-stream`)

기존 콘텐츠 생성 모드 (SSE):

```
Context Priority: 이미지 > 입력텍스트 > 트렌드키워드
  ↓
이미지 있으면 → Gemini Vision OCR → 키워드 자동 추출
  ↓
OCR 데이터 바인딩 (보험사명, 상품명, 보험료, 담보)
  ↓
제목 5개 + 바이럴 질문 3개 생성 (Gemini PRO 또는 GPT-4o)
  ↓
전문가 본문 생성 (500~1400자, C-RANK 최적화)
  ↓
댓글 5개 생성 (길이 다양화: 짧은 2 + 긴 3)
  ↓
이미지 생성 시도 (XIIM 프록시 또는 SVG 생성)
  ↓
최종 결과 SSE 전송 (제목/본문/댓글/키워드/이미지)
```

### 7.4 보험 종류 자동 판별 시스템

코드 전체에서 **담보 기반** 보험 종류를 판별하는 로직이 반복 사용됨:

```typescript
// isHealthType 판별 (V2026.37.106~109에서 강화)
const isHealthType = /건강|보장|진단|수술|치료|입원/.test(product_type) 
  || /진단비|수술비|치료비/.test(benefits)
```

이 플래그에 의해 분기되는 항목:
- 페르소나 (writerPool)
- 제목 패턴 (titlePatterns)
- 구조 변형 (structureVariants)
- 전문가 풀 (healthExpertPool vs pensionExpertPool)
- 댓글 금지 용어
- 시스템 프롬프트 (건강보험에서 "은퇴/연금/적금" 표현 금지)

### 7.5 중복 방지 랜덤 시드 시스템

```typescript
const seed = Date.now() % 1000000
```

시드가 영향을 미치는 항목:
- `writerPool[seed % length]` → 페르소나 선택
- `titlePatterns[seed % length]` → 제목 패턴 선택
- `structureVariants[seed % length]` → 본문 구조 선택
- `expertPool[(seed + 3) % length]` → 전문가 닉네임 선택
- `nickPools.empathy[(seed + 1) % length]` → 댓글 닉네임 선택
- 프롬프트에 `시드=${seed}` 주입 → GPT에게 매번 다른 표현 요구

### 7.6 인증/멤버십 흐름

```
가입 신청 (/api/registration)
  ├── 전화번호 정규화 (01048453065 → 010-4845-3065)
  ├── D1에 INSERT (status='PENDING')
  ├── 네이버 톡톡 알림 → 관리자에게 알림
  └── SMS (솔라피) → 가입자에게 알림 (Mock 모드 시 로그만)

관리자 승인 (/api/admin/approve)
  ├── D1 UPDATE (status='APPROVED', approved_at, expires_at)
  ├── SMS 발송 → 가입자에게 승인 알림
  └── 로그인 가능 상태

로그인 (/api/login)
  ├── 전화번호 정규화
  ├── D1 조회 → password_hash 비교 (btoa)
  ├── status === 'APPROVED' → 로그인 성공
  └── status === 'PENDING' → 대기 중 메시지
```

**⚠️ 보안 주의**: 비밀번호는 `btoa()` (Base64)로만 해싱 → 프로덕션에서는 `bcrypt` 또는 `argon2` 교체 필요

### 7.7 프론트엔드 VIP 토큰 시스템

```javascript
function checkVipToken() {
  // localStorage에 'xivix_vip_token'과 'xivix_vip_name' 확인
  // 없으면 → 로그인 화면 표시
  // 있으면 → 메인 화면 표시
}
```

- 관리자 판별: `phone === '010-4845-3065' || phone === '010-3159-3697'`
- API 사용 제한: `getApiUsage()` / `incrementApiUsage()` (localStorage 기반)

---

## 8. 프론트엔드 구조 상세

### 8.1 HTML 구조 (`mainPageHtml`, 라인 4628~12752)

전체 프론트엔드가 **하나의 템플릿 리터럴**로 `src/index.tsx`에 인라인되어 있음.

```
<div class="app-container">
  <header class="app-header">     → 상단 고정 (XIVIX 로고, 실시간 시세 티커)
  <main class="app-content">
    ├── 로그인 화면 (#login-screen)
    ├── 메인 대시보드
    │   ├── 보험 트렌드 키워드 (#trend-section)
    │   ├── 뉴스 티커 (#news-ticker)
    │   ├── 2가지 모드 탭
    │   │   ├── 키워드 모드 (#keyword-mode)
    │   │   │   ├── 키워드 입력/트렌드 선택
    │   │   │   ├── AI 모델 선택 (Gemini/GPT-4o)
    │   │   │   ├── 이미지 업로드 (최대 6장)
    │   │   │   └── 결과 표시 (제목/본문/댓글/키워드/이미지)
    │   │   └── Q&A 모드 (#news-qa-mode) ★
    │   │       ├── 이미지 업로드 (최대 10장)
    │   │       ├── 텍스트 입력
    │   │       ├── 진행률 바
    │   │       ├── 10가지 질문 선택 (#question-selector)
    │   │       └── 결과 표시 (분석/제목/본문/전문가답변/댓글/해시태그)
    │   └── 마케팅 이미지 생성 섹션
    └── 관리자 패널 (방익주/김미경 전용)
  <footer class="app-footer">     → PWA 설치 버튼, 새로고침
</div>
```

### 8.2 주요 프론트엔드 함수

| 함수명 | 라인 | 설명 |
|--------|------|------|
| `setMode(mode)` | 9922 | 'keyword' / 'news-qa' 모드 전환 |
| `goGenerateNewsQA()` | 9932 | ★ Q&A 생성 시작 (이미지 → API → SSE) |
| `processNewsQAStream()` | 10067 | SSE 스트림 파싱 (step/complete/error) |
| `showQuestionSelector()` | 10113 | 10가지 질문 선택 UI 표시 |
| `renderInsuranceQAResults()` | 10175 | Q&A 결과 렌더링 (분석/제목/본문/답변/댓글/해시태그) |
| `goGenerateStream()` | 10496 | 키워드 콘텐츠 생성 (SSE) |
| `renderContentsRealtime()` | 10924 | 실시간 콘텐츠 렌더링 |
| `generateMarketingImage()` | 11222 | 마케팅 이미지 생성 (XIIM/SVG) |
| `fetchMarketData()` | 7722 | 시세 데이터 갱신 (30초 주기) |
| `fetchInsuranceNews()` | 7790 | 뉴스 갱신 |
| `loadTrends()` | 8298 | 트렌드 키워드 로딩 |
| `saveUserState()` / `loadUserState()` | 7891/7934 | localStorage 상태 저장/복원 |
| `saveResultData()` / `loadResultData()` | 7906/7958 | 결과 데이터 24시간 유지 |
| `copyInsuranceAll()` | 10405 | 전체 결과 클립보드 복사 |
| `downloadInsuranceAsTxt()` | 10434 | 결과 TXT 다운로드 |
| `loadPendingUsers()` | 12459 | 관리자: 대기 사용자 목록 |
| `approveUser(phone)` | 12544 | 관리자: 사용자 승인 |

### 8.3 CDN 라이브러리

```html
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800">
```

### 8.4 CSS 디자인 시스템

```css
:root {
  --bg-dark: #0a0a0f;        /* 배경 (거의 검정) */
  --primary: #4f8cff;         /* 기본 색상 (파란색) */
  --accent: #7c5cff;          /* 강조색 (보라색) */
  --text: #e8eaed;            /* 본문 텍스트 */
  --text-muted: rgba(232, 234, 237, 0.5);
  --border: rgba(255,255,255,0.08);
  --green: #10b981;           /* 상승/성공 */
  --red: #ef4444;             /* 하락/오류 */
  --orange: #f59e0b;          /* 경고 */
}
```

---

## 9. D1 데이터베이스 스키마

### 9.1 `membership_users` 테이블

> **주의**: 마이그레이션 파일(`0001_users_table.sql`)은 `users` 테이블명이지만, 프로덕션 코드에서는 `membership_users` 테이블을 사용합니다.

```sql
CREATE TABLE IF NOT EXISTS membership_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- 성명
  phone TEXT UNIQUE NOT NULL,            -- 전화번호 (010-XXXX-XXXX 형식)
  password_hash TEXT NOT NULL,           -- 비밀번호 해시 (btoa = Base64)
  status TEXT DEFAULT 'PENDING',         -- PENDING | APPROVED | SUSPENDED
  created_at TEXT DEFAULT (datetime('now')),  -- 가입 신청일
  approved_at TEXT,                      -- 승인일
  expires_at TEXT,                       -- 만료일 (YYYY-MM-DD)
  ip TEXT,                               -- 가입 시 IP
  notification_sent INTEGER DEFAULT 0    -- 알림 발송 여부
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON membership_users(phone);
CREATE INDEX IF NOT EXISTS idx_users_status ON membership_users(status);
```

### 9.2 로컬 개발 DB 위치

- `.wrangler/state/v3/d1/` (로컬 SQLite 자동 생성)
- 리셋: `rm -rf .wrangler/state/v3/d1 && npx wrangler d1 migrations apply xivix-production --local`

---

## 10. 외부 서비스 연동

### 10.1 OpenAI API (GPT-4o)

- **용도**: 보험 설계서 OCR + Q&A 생성 (핵심 엔진)
- **엔드포인트**: `https://api.openai.com/v1/chat/completions`
- **모델**: `gpt-4o`
- **인증**: `Authorization: Bearer ${OPENAI_API_KEY}`
- **비전**: `content: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }]`

### 10.2 Google Gemini API

- **용도**: 키워드 콘텐츠 생성, 단독 이미지 OCR
- **엔드포인트**: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}`
- **스트리밍**: `streamGenerateContent?alt=sse`
- **비전**: `inline_data: { mime_type, data: base64 }`

### 10.3 네이버 데이터랩 API

- **용도**: 실시간 보험 검색 트렌드
- **엔드포인트**: `https://openapi.naver.com/v1/datalab/search`
- **인증**: `X-Naver-Client-Id`, `X-Naver-Client-Secret`
- **제한**: 최대 5개 키워드 그룹/요청, 매 요청마다 랜덤 5개 선택
- **폴백**: API 키 없거나 에러 시 → `generateRealtimeTrends()` 시뮬레이션 데이터

### 10.4 빗썸 API

- **용도**: 비트코인 실시간 시세 (대시보드 티커)
- **엔드포인트**: `https://api.bithumb.com/public/ticker/BTC_KRW`
- **인증**: 없음 (공개 API)
- **폴백**: API 실패 시 → 시뮬레이션 값 (기준가 1.45억원 ± 100만원)

### 10.5 솔라피(Solapi) SMS/알림톡

- **용도**: 멤버십 승인/만료/정지 SMS 알림
- **엔드포인트**: `https://api.solapi.com/messages/v4/send`
- **인증**: HMAC-SHA256 (`apiKey + date + salt + signature`)
- **발신번호**: `01039880124`
- **모드**: `SMS_MOCK_MODE=true`면 실제 발송 안 함 (개발 비용 절감)
- **향후**: 카카오 알림톡 템플릿 승인 후 `type: 'ATA'`로 변경 예정

### 10.6 네이버 톡톡

- **용도**: 가입 신청 시 관리자에게 실시간 알림
- **엔드포인트**: `https://gw.talk.naver.com/chatbot/v1/event`
- **인증**: `Bearer ${TALKTALK_CONFIG.accessToken}`
- **대상**: `targetId: 'w45btu'`

### 10.7 XIIM 이미지 마이크로서비스

- **용도**: 마케팅 이미지 생성 (프록시)
- **엔드포인트**: `https://xivix-xiim.pages.dev/api/process`
- **방식**: 서버→서버 통신 (CORS 우회)

---

## 11. 빌드 / 개발 / 배포 절차

### 11.1 로컬 개발 환경 설정

```bash
# 1. 의존성 설치
cd /home/user/webapp && npm install

# 2. 환경 변수 설정
cat > .dev.vars << 'EOF'
GEMINI_API_KEY_PRO=실제키
GEMINI_API_KEY_FLASH=실제키
OPENAI_API_KEY=실제키
NAVER_CLIENT_ID=실제키
NAVER_CLIENT_SECRET=실제키
EOF

# 3. D1 마이그레이션 (로컬)
npx wrangler d1 migrations apply xivix-production --local

# 4. 빌드
npm run build

# 5. 개발 서버 시작 (PM2)
pm2 start ecosystem.config.cjs

# 6. 확인
curl http://localhost:3000/api/health
```

### 11.2 PM2 설정 (`ecosystem.config.cjs`)

```javascript
module.exports = {
  apps: [{
    name: 'xivix-2026',
    script: 'npx',
    args: 'wrangler pages dev dist --d1=xivix-production --local --ip 0.0.0.0 --port 3000',
    env: { NODE_ENV: 'development', PORT: 3000 },
    watch: false,
    instances: 1,
    exec_mode: 'fork'
  }]
}
```

### 11.3 프로덕션 배포

```bash
# 1. 빌드
cd /home/user/webapp && npm run build

# 2. Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name xivix-2026-pro

# 3. (필요 시) 시크릿 설정
npx wrangler pages secret put OPENAI_API_KEY --project-name xivix-2026-pro
npx wrangler pages secret put GEMINI_API_KEY_PRO --project-name xivix-2026-pro
# ... 기타 시크릿

# 4. D1 마이그레이션 (프로덕션)
npx wrangler d1 migrations apply xivix-production

# 5. 확인
curl https://xivix.ai.kr/api/health
```

### 11.4 package.json 스크립트

```json
{
  "dev": "vite",
  "dev:sandbox": "wrangler pages dev dist --ip 0.0.0.0 --port 3000",
  "build": "vite build",
  "preview": "wrangler pages dev dist",
  "deploy": "npm run build && wrangler pages deploy dist",
  "deploy:prod": "npm run build && wrangler pages deploy dist --project-name xivix-2026",
  "clean-port": "fuser -k 3000/tcp 2>/dev/null || true",
  "test": "curl http://localhost:3000"
}
```

### 11.5 Git 워크플로

```bash
# 커밋 컨벤션
git commit -m "V2026.37.XXX - [type]: [description]"

# type 종류
# feat: 새 기능
# fix: 버그 수정
# hotfix: 긴급 수정
# chore: 유지보수
# docs: 문서

# 배포
git push origin main
npx wrangler pages deploy dist --project-name xivix-2026-pro
```

---

## 12. 프롬프트 엔지니어링 핵심 규칙

### 12.1 모든 프롬프트 공통 금지 규칙

| 규칙 | 설명 |
|------|------|
| 회사명/상품명 환각 금지 | 이미지에 없는 보험회사명(삼성생명, 한화생명 등)을 절대 추측/생성 금지 → "이 보험" 사용 |
| 금액 환각 금지 | 설계서에 있는 숫자만 사용, 없는 숫자 만들기 금지 |
| OCR 정확도 최우선 | "2,000만원"과 "200만원" 구분 (쉼표 확인), 10배 차이 |
| 보험종류 자동판별 | 담보에 진단비/수술비 → 건강보험, 연금/적립 → 연금보험 |
| 건강보험 용어 금지 | 건강보험인데 "은퇴", "연금", "적금 대신", "환급률" 사용 금지 |

### 12.2 담보 인용 규칙 (V2026.37.109)

- 전문가 답변에서 **5개 이상** 담보명을 따옴표로 감싸서 인용
- 각 담보의 보장금액도 함께 언급
- 가능하면 **전체** 담보 목록을 빠짐없이 언급

### 12.3 제목 규칙

- **필수**: 질문형 ("`~까요?`", "`~인가요?`", "`~될까요?`")
- **길이**: 30~50자
- **금지어**: '가이드', '전략', '포인트', '대비', '선택', '추천', '충격', '손해', '필독', '100%', '절대' 등
- **필수 포함**: 실제 담보명 1개 이상

### 12.4 전문가 답변 규칙

- **길이**: 800~1200자 (담보가 많으면 더 길어도 됨)
- **톤**: 긍정적/희망적 (부정적 표현 금지)
- **구조**: 인사 → 공감 → 담보 분석(5개 이상 인용) → 주의점 → 비교 추천 → 마무리
- **종료**: "`~거든요`", "`~해볼 수 있어요`" ("`~됩니다`" 금지)

### 12.5 댓글 규칙

- **3개** (공감형 / 정보형 / 질문형)
- **필수 존댓말** ("~요", "~습니다")
- **반말 절대 금지**
- **길이**: 공감형 100~150자, 정보형 120~180자, 질문형 80~120자
- **금지**: 이미지에 없는 보험회사명

---

## 13. 버전 히스토리 (주요 마일스톤)

| 버전 | 날짜 | 핵심 변경 |
|------|------|----------|
| **V2026.37.109** | 2026-02-12 | UI "GPT-4o" → "AI생성" 변경, selectedQuestion+analysisCache 핫픽스, 전문가 풀 건강/연금 분리, 답변 길이 800~1200자 |
| **V2026.37.108** | 2026-02-12 | OCR 금액 정확도 강화 (2,000 vs 200 구분, 쉼표 감지) |
| **V2026.37.107** | 2026-02-12 | 건강보험 페르소나/제목/댓글 분리, 연금 용어 금지 |
| **V2026.37.106** | 2026-02-11 | 담보명 구체적 인용 강제, 보험종류 자동판별, 회사명/상품명 환각 방지 |
| **V2026.37.105** | 2026-02-11 | ★ 10가지 초보자 질문 선택 모드 (CEO 핵심 지시), analysisCache 도입 |
| **V2026.37.104** | 2026-02-10 | 텍스트+이미지 동시 입력 모드, 이미지 후 결과 미표시 버그 수정 |
| **V2026.37.103** | 2026-02-10 | 이익금액 서버 직접 계산, OPENAI_API_KEY 시크릿 배포 |
| **V2026.37.102** | 2026-02-09 | Q&A 프롬프트 개선, 사용자 맥락/이익금 계산/해시태그 중복 방지 |
| **V2026.37.101** | 2026-02-08 | ★★ OpenAI GPT-4o 통합, 보험 설계서 Q&A 기능 대폭 강화, OCR 프롬프트 재설계 |
| **V2026.37.99** | 2026-02-07 | 보험 설계서 Q&A 기능 완성 (GPT-4o) |
| **V2026.37.95~97** | 2026-02-06 | 뉴스 Q&A 텍스트 입력 지원, 댓글 길이 다양화 |
| **V2026.37.91** | 2026-02-04 | SVG 보험 설계서 이미지 생성기 도입 (DALL-E 대체) |
| **V2026.37.82~85** | 2026-02-02 | GPT-4o 기본엔진, OCR 프롬프트 강화, 실시간 시세 API |
| **V2026.37.73~80** | 2026-02-01 | GPT-4o/Gemini 선택 UI, OpenAI API 통합, 관리자 페이지 보안 |
| **V2026.37.33~45** | 2026-01-24 | D1 인증 시스템, 솔라피 SMS, 네이버 톡톡, Mock 모드 |
| **V2026.37.0~1** | 2026-01-20 | CEO 지시: 글 길이 축소, 바이럴 질문 랜덤 길이, C-RANK/DIA 최적화 |
| **v2026.16~36** | 2026-01-17~19 | SSE 스트리밍, 제목 금지어, 전문 지식베이스, 2컬럼 레이아웃 |
| **a75b77b** (최초) | 2026-01-15 | 프로젝트 초기 생성 |

---

## 14. 알려진 이슈 / 기술 부채

### 14.1 보안 이슈 🔴

| ID | 심각도 | 설명 | 해결 방안 |
|----|--------|------|----------|
| S-1 | **Critical** | 비밀번호 `btoa()` (Base64) 해싱 → 실질적 평문 저장 | Web Crypto `PBKDF2` 또는 `bcrypt` 적용 |
| S-2 | **High** | 관리자 인증이 전화번호 하드코딩 (`010-4845-3065`) | JWT 기반 관리자 인증 도입 |
| S-3 | **High** | API 엔드포인트 인증 없음 (누구나 호출 가능) | API 키/세션 미들웨어 추가 |
| S-4 | **Medium** | 네이버 톡톡 accessToken 하드코딩 (소스코드 내) | 환경 변수로 이동 |
| S-5 | **Medium** | 프론트엔드 VIP 인증이 localStorage 기반 (조작 가능) | 서버 세션/JWT 검증 |

### 14.2 아키텍처 이슈 🟡

| ID | 설명 | 해결 방안 |
|----|------|----------|
| A-1 | `src/index.tsx` 단일 파일 12,844줄 → 유지보수 곤란 | 라우트/서비스/프론트엔드 분리 |
| A-2 | 프론트엔드 HTML/CSS/JS가 백엔드와 혼재 | `public/` 폴더로 분리 또는 React/Vue 도입 |
| A-3 | 인라인 CSS 수천 줄 → `style.css`에 1줄만 | CSS 파일로 분리 |
| A-4 | 메모리 폴백 (`pendingUsers` 배열) → Workers 재시작 시 유실 | D1 전용으로 통일 |

### 14.3 기능 이슈 🟢

| ID | 설명 | 영향 |
|----|------|------|
| F-1 | 파일 업로드가 Base64 → 메모리만 사용, 영구 저장 없음 | R2 연동 필요 |
| F-2 | 금시세/환율이 시뮬레이션 데이터 | 실제 API 연동 필요 |
| F-3 | 보험 뉴스가 하드코딩된 풀에서 랜덤 선택 | 크롤링 또는 뉴스 API 연동 |
| F-4 | OCR이 100% 정확하지 않음 (금액 오독 가능) | 사용자 검증 단계 추가 |
| F-5 | 마이그레이션 파일 `users` vs 코드 `membership_users` 불일치 | 마이그레이션 파일 업데이트 |

---

## 15. 운영 가이드

### 15.1 일상 운영

```bash
# 헬스체크
curl https://xivix.ai.kr/api/health

# D1 사용자 수 확인
npx wrangler d1 execute xivix-production --command="SELECT status, COUNT(*) as cnt FROM membership_users GROUP BY status"

# 만료 예정 사용자 확인
npx wrangler d1 execute xivix-production --command="SELECT name, phone, expires_at FROM membership_users WHERE expires_at <= date('now', '+3 days') AND status='APPROVED'"
```

### 15.2 긴급 대응

```bash
# 로그 확인 (Cloudflare Dashboard → Workers & Pages → xivix-2026-pro → Logs)

# API 키 교체 (긴급)
npx wrangler pages secret put OPENAI_API_KEY --project-name xivix-2026-pro
# → 새 키 입력 후 Enter

# 롤백 (이전 배포로)
# Cloudflare Dashboard → Deployments → 이전 배포 선택 → "Rollback"

# SMS Mock 모드 전환 (비용 절감)
# wrangler.jsonc → vars.SMS_MOCK_MODE: "true" → 재배포
```

### 15.3 프로덕션 환경 변수 설정 위치

1. **Cloudflare Dashboard** 접속
2. **Workers & Pages** → `xivix-2026-pro` 선택
3. **Settings** → **Environment variables**
4. Production 탭에서 시크릿 추가/수정

---

## 16. 향후 로드맵 / 미구현 사항

### 16.1 우선 개선 항목 (높은 우선순위)

- [ ] **보안 강화**: 비밀번호 해싱 (btoa → PBKDF2/bcrypt)
- [ ] **코드 리팩토링**: `src/index.tsx` 12,844줄 → 모듈 분리
  - `src/routes/auth.ts`, `src/routes/admin.ts`, `src/routes/qa.ts` 등
- [ ] **서버 세션**: JWT 기반 인증 미들웨어 도입
- [ ] **관리자 인증 강화**: 하드코딩된 전화번호 → DB 기반 역할 시스템
- [ ] **카카오 알림톡 전환**: 솔라피 `type: 'SMS'` → `'ATA'` (템플릿 승인 후)

### 16.2 기능 확장 (중간 우선순위)

- [ ] **R2 스토리지**: 이미지 영구 저장 + CDN 서빙
- [ ] **사용자 대시보드**: 생성 이력, 사용량 통계
- [ ] **멤버십 자동 결제**: Toss Payments / 카카오페이 연동
- [ ] **실시간 뉴스**: 보험 뉴스 API 연동 (하드코딩 풀 대체)
- [ ] **실시간 시세**: 금/환율 실제 API 연동 (시뮬레이션 대체)

### 16.3 품질 향상 (낮은 우선순위)

- [ ] **OCR 정확도 개선**: 멀티 패스 검증 (1차 OCR → 2차 검증)
- [ ] **A/B 테스트**: 프롬프트 변형별 성과 측정
- [ ] **분석 리포트**: 생성된 콘텐츠의 네이버 카페 노출 성과 추적
- [ ] **프론트엔드 프레임워크**: React/Vue 도입으로 유지보수성 향상
- [ ] **테스트 코드**: API 엔드포인트 단위 테스트 / E2E 테스트

---

## 부록: 빠른 참조

### A. 핵심 라우트 요약

```
GET  /                          → 메인 페이지 (인라인 SPA)
GET  /admin                     → 관리자 페이지
POST /api/generate/news-qa      → ★ 보험 Q&A 생성 (5단계 SSE)
POST /api/generate/questions    → 10가지 질문 생성
POST /api/generate/full-package-stream → 키워드 콘텐츠 (SSE)
POST /api/login                 → 로그인
POST /api/registration          → 가입 신청
GET  /api/health                → 헬스체크
```

### B. 환경 변수 체크리스트

```
□ OPENAI_API_KEY          (GPT-4o - 보험 Q&A 핵심)
□ GEMINI_API_KEY_PRO      (Gemini Pro - 키워드 콘텐츠)
□ GEMINI_API_KEY_FLASH    (Gemini Flash - 질문/댓글)
□ GEMINI_API_KEY          (폴백)
□ NAVER_CLIENT_ID         (검색 트렌드)
□ NAVER_CLIENT_SECRET     (검색 트렌드)
□ SOLAPI_API_KEY          (SMS 발송)
□ SOLAPI_API_SECRET       (SMS 서명)
□ DB (D1 바인딩)          (wrangler.jsonc에 설정됨)
```

### C. 테스트 API 호출 예시

```bash
# 헬스체크
curl https://xivix.ai.kr/api/health | jq

# 트렌드 조회
curl https://xivix.ai.kr/api/trend | jq

# 시세 조회
curl https://xivix.ai.kr/api/market-data | jq

# 보험 Q&A 생성 (텍스트만)
curl -X POST https://xivix.ai.kr/api/generate/news-qa \
  -H "Content-Type: application/json" \
  -d '{"newsText":"40세 남성, 20년납 건강보험 월 5만원인데 괜찮은가요?"}' \
  --no-buffer

# 로그인
curl -X POST https://xivix.ai.kr/api/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"010-1234-5678","password":"test1234"}'
```

---

> **문서 작성자**: AI 개발 어시스턴트  
> **검수 요청**: 인수 받는 개발자가 이 문서를 읽고 불명확한 부분이 있으면 코드 직접 확인 후 보완 바랍니다.  
> **코드 베이스**: `src/index.tsx` (12,844줄) — 모든 로직이 이 파일에 집중되어 있으므로 이 파일만 읽으면 전체 시스템을 파악할 수 있습니다.
