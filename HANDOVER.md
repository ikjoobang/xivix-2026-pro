# 🔐 XIVIX 2026 PRO - 인수인계 문서

**버전**: v2026.36.2  
**최종 업데이트**: 2026-01-19  
**프로젝트명**: XIVIX_Insurance_King_2026  
**GitHub**: https://github.com/ikjoobang/xivix-2026-pro

---

## ❶ 인수인계 파일 체크리스트

| # | 파일/항목 | 상태 | 비고 |
|---|----------|------|------|
| 1 | **소스 코드 압축본** | ✅ 완료 | `xivix-2026-pro-handover.zip` (86KB) |
| 2 | **환경 변수 (.dev.vars)** | ✅ 포함 | 압축파일 내 포함 |
| 3 | **패키지 명세서 (package.json)** | ✅ 포함 | 압축파일 내 포함 |
| 4 | **GitHub 저장소 소유권** | ✅ ikjoobang 소유 | https://github.com/ikjoobang/xivix-2026-pro |
| 5 | **DB 덤프** | ❌ 해당없음 | Cloudflare D1/KV 미사용 (Stateless) |

---

## ❷ 환경 변수 설정 (.dev.vars)

```bash
# ========================
# XIVIX 2026 PRO - API Keys
# ========================

# PRO 모델용 (품질 글쓰기, 전문가 답변)
GEMINI_API_KEY_PRO=AIzaSyDFff_AvuCv2NuzRewWYbm7JqZ-665L53M

# FLASH 모델용 (질문 퍼포먼스, 댓글 생성)
GEMINI_API_KEY_FLASH=AIzaSyBQ0asiNIp2OkTGf4loAdZR4gXYJbw3PEg

# 기본 키 (하위 호환용)
GEMINI_API_KEY=AIzaSyDFff_AvuCv2NuzRewWYbm7JqZ-665L53M

# 네이버 검색 트렌드 API
NAVER_CLIENT_ID=fUhHJ1HWyF6fFw_aBfkg
NAVER_CLIENT_SECRET=gA4jUFDYK0
```

### ⚠️ 보안 주의사항
- 이 파일은 **절대 GitHub에 커밋하지 마세요** (.gitignore에 포함됨)
- 프로덕션 배포 시 Cloudflare Secrets로 설정:
  ```bash
  npx wrangler secret put GEMINI_API_KEY_PRO --project-name xivix-2026-pro
  npx wrangler secret put GEMINI_API_KEY_FLASH --project-name xivix-2026-pro
  npx wrangler secret put NAVER_CLIENT_ID --project-name xivix-2026-pro
  npx wrangler secret put NAVER_CLIENT_SECRET --project-name xivix-2026-pro
  ```

---

## ❸ 프로덕션 URL

| 페이지 | URL |
|--------|-----|
| 🏠 **메인** | https://xivix-2026-pro.pages.dev |
| 📋 **서비스 이용약관** | https://xivix-2026-pro.pages.dev/terms |
| 🔐 **개인정보 처리방침** | https://xivix-2026-pro.pages.dev/privacy |
| 🔧 **Admin** | https://xivix-2026-pro.pages.dev/admin |
| 💚 **Health** | https://xivix-2026-pro.pages.dev/api/health |
| 📄 **API Docs** | https://xivix-2026-pro.pages.dev/api/docs |

---

## ❹ 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx        # 메인 앱 (단일 파일 아키텍처)
│   └── renderer.tsx     # Hono 렌더러
├── public/
│   ├── static/
│   │   └── style.css
│   └── _headers
├── dist/                # 빌드 출력 (배포용)
├── .dev.vars            # 환경 변수 (개발용) ⚠️ 비밀
├── .gitignore
├── ecosystem.config.cjs # PM2 설정 (샌드박스용)
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc       # Cloudflare Pages 설정
├── README.md
└── HANDOVER.md          # 이 문서
```

---

## ❺ 핵심 기능 및 버전 히스토리

### 현재 버전: v2026.36.2

| 기능 | 설명 | 구현 위치 |
|------|------|----------|
| **2컬럼 Split View** | PC/Tablet (1024px+): 왼쪽 입력, 오른쪽 결과 | CSS Line ~2090 |
| **모바일 1컬럼** | 768px 이하: 결과물 상단, 입력 하단 고정 | CSS Line ~2147 |
| **Process Tracker** | 4단계 실시간 진행 상황 (데이터 분석→제목→답변→댓글) | JS Line ~3431 |
| **일일 4회 제한** | localStorage 기반, 00:00 KST 리셋 | JS Line ~3595 |
| **❶❷❸ 기호 검증** | 본문 내 번호 기호 필수 검증 | JS Line ~3641 |
| **카카오 로그인 환영 모달** | 첫 방문 시 환영 메시지 | HTML/CSS/JS |
| **미로그인 잠금 UI** | 결과물 블러 처리 + 카카오 로그인 유도 | HTML/CSS |
| **약관 페이지** | /terms, /privacy 라우트 | Hono Route |

### 버전 히스토리

| 버전 | 커밋 | 변경 내용 |
|------|------|----------|
| v2026.36.2 | 32e09c9 | 인수인계 최종 버전: 1024px 브레이크포인트 2컬럼 레이아웃 |
| v2026.36.1 | 15b22ab | 2컬럼 레이아웃 강제 적용 수정 (!important) |
| v2026.36.0 | 284922b | CEO v2026.30 마스터 업데이트 (상단 70% 압축, 2컬럼, 카카오 모달, 잠금 UI, 약관) |
| v2026.35.0 | 03fd584 | CEO 마스터 업데이트 (2컬럼 Grid, 상단 60% 압축, Process Tracker, 일일 4회) |
| v2026.34.0 | f2baaeb | source_url 직접 입력 필드 추가 |

---

## ❻ 개발 및 배포 명령어

### 로컬 개발 (샌드박스)
```bash
# 의존성 설치
npm install

# 빌드
npm run build

# PM2로 개발 서버 시작
pm2 start ecosystem.config.cjs

# 서버 테스트
curl http://localhost:3000/api/health
```

### Cloudflare Pages 배포
```bash
# 빌드 + 배포
npm run build
npx wrangler pages deploy dist --project-name xivix-2026-pro

# 또는 한 번에
npm run deploy
```

---

## ❼ 마스터 프롬프트 엔진 (XIVIX V39)

### 핵심 설정
```json
{
  "engine": "XIVIX V39 ENGINE_SYNC_FINAL",
  "model": "gemini-2.5-pro",
  "persona": "30년 경력 MDRT 보험왕 & 심리 영업 마스터",
  "constraints": {
    "text_limit": "본문 1,200자+ (공백 포함)",
    "multimodal": "이미지 첨부 시 최우선 분석",
    "typography": "❶ ❷ ❸ 기호 필수 포함"
  },
  "output_format": "JSON_OBJECT",
  "knowledge_base": ["상증법 제8조", "CDR 척도", "법인세 손비처리", "체증형 설계"]
}
```

### 콘텐츠 길이 모드
- **SHORT**: 350-450자 (확률 30%)
- **MID**: 600-800자 (확률 50%)
- **LONG**: 1000-1300자 (확률 20%)

---

## ❽ 카카오 로그인 연동 (미완료)

### 현재 상태
- **데모 모드**: 카카오 로그인 버튼은 UI만 구현
- **실제 연동 필요 시**:
  1. 카카오 개발자 콘솔에서 앱 등록
  2. Redirect URI 설정: `https://xivix.kr/api/auth/callback/kakao`
  3. 동의항목: 닉네임, 이메일, 전화번호 (필수)
  4. `loginWithKakao()` 함수 활성화 (src/index.tsx 주석 참고)

### 코드 위치
- 로그인 버튼: HTML Line ~5700
- loginWithKakao(): JS Line ~4050

---

## ❾ 데이터 저장소

### 현재 상태: Stateless (서버리스)
- **Cloudflare D1**: 미사용
- **Cloudflare KV**: 미사용
- **LocalStorage**: 일일 사용량 (클라이언트 측)

### 향후 확장 시
```jsonc
// wrangler.jsonc에 추가
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "xivix-production",
    "database_id": "your-database-id"
  }
]
```

---

## ❿ 문의 및 지원

- **GitHub Issues**: https://github.com/ikjoobang/xivix-2026-pro/issues
- **프로젝트 소유자**: ikjoobang

---

**인수인계 완료일**: 2026-01-19  
**작성자**: AI Developer (GenSpark)

---

*이 문서와 함께 `xivix-2026-pro-handover.zip` 파일을 전달받으시면 인수인계 완료입니다.*
