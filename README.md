# XIVIX 2026 PRO | 보험 마케팅 마스터 (v2026.15.0)

[![Version](https://img.shields.io/badge/Version-2026.15.0-00ff88?style=for-the-badge)](https://3000-i41v15mnpukpom1lv9rdi-02b9cc79.sandbox.novita.ai/api/health)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge)]()

---

## 📋 젠스파크 개발자 전달용 최종 가이드

### ■ 핵심 변경사항 (v2026.15.0)

| 항목 | 변경 내용 |
|------|----------|
| **본문 길이** | 공백 포함 **약 1,000자 내외** (약 1,200~1,500 토큰) |
| **출력 형식** | `JSON_OBJECT` (구조화된 응답) |
| **모델** | `gemini-2.5-pro` (품질), `gemini-2.0-flash` (댓글) |
| **UI/UX** | 탭 분할 + 대시보드 리포트 형태 |

### ■ 핵심 프롬프트 엔진 (JSON v3)

```json
{
  "model": "gemini-2.5-pro",
  "persona": "30년 경력 MDRT 보험왕 & 심리 영업 마스터",
  "constraints": {
    "text_limit": "본문은 공백 포함 1,000자 내외 (포스팅 최적화)",
    "multimodal": "이미지 첨부 시 최우선 분석하여 report_data에 반영"
  },
  "output_format": "JSON_OBJECT"
}
```

---

## 🔗 서비스 URL

### ■ 현재 샌드박스 (테스트용)
| 페이지 | URL |
|--------|-----|
| 🏠 **메인** | https://3000-i41v15mnpukpom1lv9rdi-02b9cc79.sandbox.novita.ai |
| 💚 **Health** | https://3000-i41v15mnpukpom1lv9rdi-02b9cc79.sandbox.novita.ai/api/health |
| 📄 **Docs** | https://3000-i41v15mnpukpom1lv9rdi-02b9cc79.sandbox.novita.ai/api/docs |

### ■ Cloudflare Pages (프로덕션)
| 페이지 | URL |
|--------|-----|
| 🏠 **메인** | https://xivix-2026-pro.pages.dev (배포 후) |
| 💚 **Health** | https://xivix-2026-pro.pages.dev/api/health |

---

## 📊 JSON 출력 구조 (v3)

### Full Package API 응답 예시

```json
{
  "success": true,
  "package": {
    "topic": "30대 직장인 암보험 가입 시기",
    "target": "30대 직장인",
    "insurance": "암보험",
    
    "seo_audit": {
      "score": 97,
      "grade": "S+",
      "rank_prediction": "1-3위",
      "analysis": "타겟의 불안 심리를 자극하는 키워드 조합으로 최상위 노출 확실"
    },
    
    "titles": [
      {"id": 1, "text": "[단독] 30대 암보험, 증권에 '이 단어' 없으면 10원도 못 받습니다"},
      {"id": 2, "text": "30대 주목! 암보험 이거 모르면 100% 손해봅니다"},
      {"id": 3, "text": "제 실제 보상 후기입니다.. 암보험 때문에 울다가 웃었네요"},
      {"id": 4, "text": "[충격] 30대 암보험 약관 뒤집어보니 이런 함정이..."},
      {"id": 5, "text": "30대라면 반드시 알아야 할 암보험의 진실"}
    ],
    
    "viral_questions": [
      {"id": 1, "text": "혹시 여러분도 암보험 갱신형으로 가입하셨나요? 비갱신형과 뭐가 다른지..."},
      {"id": 2, "text": "진단비 5천만원이면 충분할까요? 아니면 1억까지?"}
    ],
    
    "contents": [
      {"id": 1, "style": "공감형", "text": "본문1 (1000자 내외, 독자의 불안을 어루만지는 따뜻한 글)"},
      {"id": 2, "style": "팩트형", "text": "본문2 (1000자 내외, 베테랑도 모르는 약관 함정 폭로)"},
      {"id": 3, "style": "영업형", "text": "본문3 (1000자 내외, 심리적 트리거로 상담 유도)"}
    ],
    
    "seoKeywords": ["30대 암보험", "암보험 가입시기", "암보험 비교", "2026년 암보험", "직장인 보험"],
    
    "comments": [
      {"id": 1, "nickname": "매의눈선배", "persona": "까칠한 선배", "text": "30대 초반이면 늦은 거 아님..."},
      {"id": 2, "nickname": "다정한미소", "persona": "다정한 주부", "text": "저도 작년에 가입했는데..."},
      {"id": 3, "nickname": "궁금이", "persona": "의심 많은 사회초년생", "text": "근데 진단비는 얼마가 적정인가요?"},
      {"id": 4, "nickname": "보험고수", "persona": "베테랑 회원", "text": "전문가님 말씀 100% 공감합니다..."},
      {"id": 5, "nickname": "지나가던초보", "persona": "지나가던 초보", "text": "저도 궁금했는데 감사합니다!"}
    ],
    
    "imageAnalysis": null,
    "report_data": [],
    
    "generatedAt": "2026-01-18T06:30:00.000Z"
  },
  "models": {
    "vision": null,
    "expert": "gemini-2.5-pro",
    "comments": "gemini-2.0-flash"
  },
  "version": "2026.15.0"
}
```

### 이미지 분석 시 report_data 예시

```json
"imageAnalysis": "📋 보험증권 분석\n🏢 삼성생명 - 무배당 간편건강보험\n\n핵심 요약...",
"report_data": [
  {"item": "암진단비", "current": "2,000만원", "target": "5,000만원", "status": "critical"},
  {"item": "뇌혈관질환", "current": "1,500만원", "target": "3,000만원", "status": "essential"},
  {"item": "급성심근경색", "current": "1,500만원", "target": "3,000만원", "status": "essential"},
  {"item": "수술비", "current": "100만원", "target": "300만원", "status": "good"},
  {"item": "입원일당", "current": "5만원", "target": "10만원", "status": "essential"}
]
```

---

## 🎨 UI/UX 설계

### ■ 레이아웃 (대시보드 리포트 형태)

```
┌─────────────────────────────────────────────────┐
│  [S+] SEO 감사 리포트                           │
│  점수: 97/100 | 예상 순위: 1-3위               │
│  분석: 타겟의 불안 심리를 자극하는 키워드...    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  📊 보장 분석 리포트 (이미지 분석 시)           │
│  ┌─────────┬────────┬────────┬──────┐          │
│  │ 항목     │ 현재    │ 권장    │ 상태 │          │
│  ├─────────┼────────┼────────┼──────┤          │
│  │ 암진단비 │ 2천만   │ 5천만   │ ● 위험│          │
│  │ 뇌혈관   │ 1.5천   │ 3천만   │ ● 필수│          │
│  └─────────┴────────┴────────┴──────┘          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  🔥 바이럴 질문 (댓글 유도)                     │
│  1. 혹시 여러분도 암보험 갱신형으로 가입...?    │
│  2. 진단비 5천만원이면 충분할까요?              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  [제목 선택] [본문 선택] [댓글/키워드]  (탭)    │
│                                                 │
│  제목 1 (선택됨) ──────────────────── [복사]    │
│  제목 2 ─────────────────────────── [복사]    │
│  ...                                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│        [선택한 콘텐츠 전체 복사]                │
│        [새로운 콘텐츠 생성]                     │
└─────────────────────────────────────────────────┘
```

### ■ 복사 기능
- 각 제목 옆: [복사] 버튼
- 각 본문 하단: [복사] 버튼
- 각 댓글 옆: [복사] 버튼
- 각 키워드: 클릭 시 복사
- 보장 분석 테이블: [테이블 복사] 버튼
- 하단: [선택한 콘텐츠 전체 복사] 버튼

### ■ 상태 아이콘 (●)
- `critical` (위험): 빨간색 ●
- `essential` (필수): 주황색 ●
- `good` (양호): 초록색 ●

---

## 🔌 API 엔드포인트

### POST `/api/generate/full-package`
**🌟 메인 엔드포인트 - 제목 5종 + 본문 3개 + 댓글 5개 + SEO 키워드 5개**

```bash
curl -X POST https://your-domain/api/generate/full-package \
  -H "Content-Type: application/json" \
  -d '{
    "concern": "30대 직장인 암보험 가입 시기",
    "image": "base64_encoded_image (선택)",
    "mimeType": "image/jpeg (선택)"
  }'
```

### POST `/api/generate/master`
**전문가 콘텐츠 스트리밍 생성**

### POST `/api/generate/question`
**질문 퍼포먼스 게시글 생성**

### POST `/api/generate/comments`
**댓글 5개 생성**

### POST `/api/analyze/image`
**이미지 멀티모달 분석**

### GET `/api/trend`
**실시간 네이버 보험 트렌드**

### GET `/api/health`
**서버 상태 확인**

### GET `/api/docs`
**API 문서**

---

## 🔐 보안/배포

### ■ 환경 변수
```bash
# Cloudflare Secrets (프로덕션)
npx wrangler secret put GEMINI_API_KEY_PRO
npx wrangler secret put GEMINI_API_KEY_FLASH
npx wrangler secret put NAVER_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_SECRET

# 로컬 개발 (.dev.vars)
GEMINI_API_KEY_PRO=your_pro_key
GEMINI_API_KEY_FLASH=your_flash_key
```

### ■ 배포 명령어
```bash
# 빌드
npm run build

# Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name xivix-2026-pro
```

---

## 📦 프로젝트 구조

```
webapp/
├── src/
│   └── index.tsx           # 메인 앱 (API + UI + Admin)
├── dist/                   # 빌드 출력
├── public/                 # 정적 파일
├── ecosystem.config.cjs    # PM2 설정 (샌드박스)
├── wrangler.jsonc          # Cloudflare 설정
├── package.json
└── README.md
```

---

## ✅ 구현 완료 기능

- [x] **SEO 감사 리포트** (S+ 등급 마크, 점수, 예상 순위)
- [x] **바이럴 질문 2종** (댓글 유도용)
- [x] **이미지 분석 → report_data 자동 연결** (보장 분석 테이블)
- [x] **제목 5종** (CTR 30% 이상 자극적 제목)
- [x] **본문 3개** (공감형/팩트형/영업형, 각 1,000자 내외)
- [x] **댓글 5개** (5명 페르소나 - 까칠한 선배, 다정한 주부, 의심 많은 사초, 베테랑, 초보)
- [x] **SEO 키워드 5개**
- [x] **탭 분할 UI** (제목/본문/댓글+키워드)
- [x] **개별/전체 복사 기능**
- [x] **JSON_OBJECT 출력 형식**
- [x] **실시간 트렌드** (15초 갱신)

---

## 🎯 목표

> **1분 안에 네이버 카페 포스팅 완성**

1. 핵심 고민 입력 (선택: 이미지 첨부)
2. Full Package 생성 클릭
3. 제목 1개 선택 + 본문 1개 선택
4. [전체 복사] 클릭
5. 네이버 카페에 붙여넣기

---

## 📌 중요 제약사항

| 항목 | 제약 |
|------|------|
| **본문 길이** | 공백 포함 1,000자 내외 (네이버 카페 포스팅 최적화) |
| **토큰** | 약 1,200~1,500 토큰 |
| **제목** | CTR 30% 이상 보장 (자극적+신뢰감) |
| **모델 (품질)** | gemini-2.5-pro |
| **모델 (속도)** | gemini-2.0-flash |
| **출력 형식** | JSON_OBJECT |

---

## 🔄 버전 히스토리

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 2026.15.0 | 2026-01-18 | 대시보드 UI + report_data 자동 연결 + JSON v3 구조 |
| 2026.14.0 | 2026-01-18 | 탭 분할 UI + JSON_OBJECT 출력 |
| 2026.13.0 | 2026-01-17 | Full Package API 통합 |

---

**Made with ❤️ by XIVIX Team | 2026**
