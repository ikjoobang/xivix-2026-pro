# XIVIX 2026 PRO | 보험 마케팅 마스터

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deployed-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://xivix-2026-pro.pages.dev)
[![Version](https://img.shields.io/badge/Version-2026.2.0-00ff88?style=for-the-badge)](https://xivix-2026-pro.pages.dev/api/health)

## 🌐 프로젝트 개요
- **Name**: XIVIX 2026 PRO
- **Goal**: 대한민국 상위 1% 보험 수석 컨설턴트 수준의 네이버 카페 최적화 콘텐츠 자동 생성
- **Version**: 2026.2.0
- **Status**: ✅ Production Ready

---

## 🔗 모든 링크 (전체 확인용)

### ■ 프론트엔드
| 페이지 | URL |
|--------|-----|
| 🏠 **메인 페이지** | https://xivix-2026-pro.pages.dev |
| 📊 **대시보드** | https://xivix-2026-pro.pages.dev (메인과 통합) |
| ⚙️ **어드민** | https://xivix-2026-pro.pages.dev/admin |

### ■ 백엔드 (API)
| 엔드포인트 | URL |
|------------|-----|
| 🖥️ **API 서버** | https://xivix-2026-pro.pages.dev/api |
| 📄 **API 문서 (Swagger)** | https://xivix-2026-pro.pages.dev/api/docs |
| 💚 **Health Check** | https://xivix-2026-pro.pages.dev/api/health |
| 📊 **통계 API** | https://xivix-2026-pro.pages.dev/api/admin/stats |

### ■ GitHub 저장소
| 항목 | URL |
|------|-----|
| 📁 **Backend Repository** | https://github.com/ikjoobang/xivix-2026-pro |

---

## 📝 타이포그래피 가이드 (v2026.2.0 신규)

### ■ 필수 사용 기호
| 기호 | 용도 | 예시 |
|------|------|------|
| **❶ ❷ ❸** | 단계별 프로세스 설명 | ❶ 결론부터 말씀드리면... |
| **■** | 핵심 개념/강조 포인트 | ■ [질문1] 상속세 절감 방법 |
| **✔️** | 체크리스트/장점 나열 | ✔️ 첫 번째 할 일 |

### ■ 텍스트 규격
- **모바일**: 17px / Line-height 1.65 / Letter-spacing -0.02em
- **PC**: 16px / Line-height 1.55 / Letter-spacing -0.01em
- **한글 규칙**: `word-break: keep-all` (단어 단위 줄바꿈)

### ■ 금지 사항
- ❌ 마크다운 표 (`|`) 사용 금지
- ❌ `<br>` 태그로 줄바꿈 대체
- ❌ Analysis, Evidence, Step 1: 등 영어 접두사 금지

---

## ✅ 완성된 기능

### 1. Q&A 마스터 스트리밍 API (`/api/generate/master`)
- **엔진**: `gemini-1.5-pro-002` (절대 변경 금지)
- 실시간 스트리밍 응답으로 체감 속도 5초 이내
- 페르소나 매칭: 성별/나이 자동 판별 (워킹맘 오류 완벽 차단)
- **1,200자 이상의 압도적 정보량** (각 답변당)
- 타이포그래피 기호 자동 적용 (❶❷❸, ■, ✔️)

### 2. 흑백 엑셀 설계서 API (`/api/generate/excel`)
- **엔진**: `gemini-2.0-flash`
- 15개 이상의 리얼한 담보 구성
- 컬러 완전 제거 (흑백 인쇄 최적화)
- 성별/나이 데이터 정합성 100%

### 3. 프리미엄 UI (Beyond Reality 스타일)
- ✔️ Glassmorphism 유리 질감 효과
- ✔️ 3D Hover 인터랙션
- ✔️ 반응형 타이포그래피 (17px/16px)
- ✔️ 플로팅 애니메이션 & 그라데이션 텍스트
- ✔️ 파티클 시스템 (Canvas 애니메이션)
- ✔️ 네온 글로우 검색창

### 4. API 키 중앙관리 시스템
- 7개 Gemini API 키 자동 폴백
- 429/403 에러 시 자동 키 전환
- 모든 키 소진 시 에러 메시지 표시

### 5. TXT/PDF 다운로드
- TXT: 순수 텍스트 다운로드
- PDF: 브라우저 인쇄 기능 활용

### 6. 어드민 대시보드
- 활성 API 키 현황
- 엔진 버전 모니터링
- 타이포그래피 가이드 시각화
- 시스템 상태 확인

---

## 📋 분야별 전용 로직

| 분야 | 핵심 내용 |
|------|----------|
| **상속/증여** | 상증법 제8조, 수익자 지정 절세, 10년 주기 증여 비과세 |
| **CEO/법인** | 법인세 손비처리, 가지급금 정리, 퇴직금 재원 |
| **치매/간병** | CDR 척도별 판정, ADL 보장 공백, 체증형 일당 |
| **유병자보험** | 간편심사 기준, 고지의무, 기왕증 부담보 |

---

## 🛠️ API 엔드포인트 상세

### POST `/api/generate/master`
**Q&A 콘텐츠 스트리밍 생성 (타이포그래피 적용)**
```json
{
  "target": "30대 워킹맘",
  "insuranceType": "상속/증여",
  "company": "삼성생명",
  "style": "전문가 팩트체크형",
  "concern": "자녀 증여 시 세금 절약 방법"
}
```

**응답 형식 (스트리밍)**
```
{"type":"status","step":1,"msg":"🔍 1단계: 타겟 페르소나 정밀 분석 중..."}
{"type":"status","step":2,"msg":"⚖️ 2단계: 삼성생명 최신 약관 및 법리 대입 중..."}
{"type":"status","step":3,"msg":"🧠 3단계: 전문가 뇌 교체 및 콘텐츠 생성 중..."}
{"type":"content","data":"❶ 결론부터 말씀드리면..."}
{"type":"done"}
```

### POST `/api/generate/excel`
**흑백 엑셀 설계서 데이터 생성**
```json
{
  "target": "30대 워킹맘",
  "insuranceType": "상속/증여",
  "company": "삼성생명",
  "concern": "자녀 증여"
}
```

### GET `/api/health`
**서버 상태 확인 (타이포그래피 가이드 포함)**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T16:08:14.129Z",
  "version": "2026.2.0",
  "engines": {
    "expert": "gemini-1.5-pro-002",
    "data": "gemini-2.0-flash"
  },
  "apiKeysAvailable": 7,
  "typographyGuide": {
    "process": "❶ ❷ ❸",
    "emphasis": "■",
    "check": "✔️"
  }
}
```

---

## 🔧 기술 스택
- **Framework**: Hono 4.x
- **Runtime**: Cloudflare Workers
- **AI Engine**: Google Gemini 1.5 Pro 002 / 2.0 Flash
- **Frontend**: TailwindCSS CDN + Vanilla JS + Canvas Particles
- **Build**: Vite
- **Deploy**: Cloudflare Pages

---

## 📦 프로젝트 구조
```
webapp/
├── src/
│   └── index.tsx           # 메인 앱 (API + UI + Admin)
├── dist/                   # 빌드 출력
├── public/                 # 정적 파일
├── ecosystem.config.cjs    # PM2 설정
├── wrangler.jsonc          # Cloudflare 설정
├── package.json
└── README.md
```

---

## 🚀 배포 상태
- **Platform**: Cloudflare Pages
- **Status**: ✅ Production Active
- **URL**: https://xivix-2026-pro.pages.dev
- **Last Updated**: 2026-01-17

---

## 📌 중요 지침 (절대 변경 금지)

### ❶ AI 엔진 버전
- **전문가 엔진**: `gemini-1.5-pro-002`
- **데이터 엔진**: `gemini-2.0-flash`

### ❷ 타이포그래피 사양
- **모바일**: 17px / Line 1.65
- **PC**: 16px / Line 1.55
- **기호**: ❶❷❸ (프로세스), ■ (강조), ✔️ (체크)

### ❸ 성별 판별 로직
- 워킹맘/엄마/주부/아내/여성/딸/언니/누나 = **여성**
- 가장/아빠/남편/남성/오빠/형/아들 = **남성**

### ❹ 콘텐츠 분량
- 각 답변당 **최소 1,200자 이상**

---

## 🎯 알고리즘 대응 전략

### C-Rank (전문성 시그널)
- 상증법 제8조, CDR 척도, 손비처리 등 전문 용어 자연 배치

### DIA / Agent N
- '정보의 이득' 극대화
- 구체적 수치와 실행 가능한 해결책 제시

---

## 🔑 환경 변수

### 로컬 개발 (.dev.vars)
```
GEMINI_API_KEY_1=your_key_1
GEMINI_API_KEY_2=your_key_2
...
NAVER_CLIENT_ID=fUhHJ1HWyF6fFw_aBfkg
NAVER_CLIENT_SECRET=gA4jUFDYK0
```

### 프로덕션 (Cloudflare Secrets)
```bash
npx wrangler secret put GEMINI_API_KEY_1
```

---

**Made with ❤️ by XIVIX Team | 2026**
