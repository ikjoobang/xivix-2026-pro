# XIVIX 2026 PRO | 보험 마케팅 마스터

[![Deploy to Cloudflare Pages](https://img.shields.io/badge/Deployed-Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://xivix-2026-pro.pages.dev)

## 🌐 프로젝트 개요
- **Name**: XIVIX 2026 PRO
- **Goal**: 대한민국 상위 1% 보험 수석 컨설턴트 수준의 네이버 카페 최적화 콘텐츠 자동 생성
- **Version**: 2026.1.0
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

## ✅ 완성된 기능

### 1. Q&A 마스터 스트리밍 API (`/api/generate/master`)
- **엔진**: `gemini-1.5-pro-002` (절대 변경 금지)
- 실시간 스트리밍 응답으로 체감 속도 5초 이내
- 페르소나 매칭: 성별/나이 자동 판별 (워킹맘 오류 완벽 차단)
- 1,200자 이상의 압도적 정보량

### 2. 흑백 엑셀 설계서 API (`/api/generate/excel`)
- **엔진**: `gemini-2.0-flash`
- 15개 이상의 리얼한 담보 구성
- 컬러 완전 제거 (흑백 인쇄 최적화)
- 성별/나이 데이터 정합성 100%

### 3. 프리미엄 UI (Beyond Reality 스타일)
- Glassmorphism 유리 질감 효과
- 3D Hover 인터랙션
- 반응형 타이포그래피 (17px/16px)
- 플로팅 애니메이션 & 그라데이션 텍스트

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
**Q&A 콘텐츠 스트리밍 생성**
```json
{
  "target": "30대 워킹맘",
  "insuranceType": "상속/증여",
  "company": "삼성생명",
  "style": "전문가 팩트체크형",
  "concern": "자녀 증여 시 세금 절약 방법"
}
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
**서버 상태 확인**
```json
{
  "status": "healthy",
  "version": "2026.1.0",
  "engines": {
    "expert": "gemini-1.5-pro-002",
    "data": "gemini-2.0-flash"
  },
  "apiKeysAvailable": 7
}
```

---

## 🔧 기술 스택
- **Framework**: Hono 4.x
- **Runtime**: Cloudflare Workers
- **AI Engine**: Google Gemini 1.5 Pro 002 / 2.0 Flash
- **Frontend**: TailwindCSS CDN + Vanilla JS
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

## 📌 중요 지침

### 절대 변경 금지
1. **AI 엔진 버전**: `gemini-1.5-pro-002`, `gemini-2.0-flash`
2. **타이포그래피 사양**: 모바일 17px, PC 16px
3. **성별 판별 로직**: 워킹맘 = 여성, 가장 = 남성

### 알고리즘 대응
- **C-Rank**: 전문 용어 자연 배치 (상증법 제8조, CDR 척도 등)
- **DIA/Agent N**: '정보의 이득' 극대화

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
