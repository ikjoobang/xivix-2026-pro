# XIVIX 2026 PRO | 보험 마케팅 마스터

## 프로젝트 개요
- **Name**: XIVIX 2026 PRO
- **Goal**: 대한민국 상위 1% 보험 수석 컨설턴트 수준의 네이버 카페 최적화 콘텐츠 자동 생성
- **Features**: AI 기반 Q&A 콘텐츠 생성, 흑백 엑셀 설계서 생성, 스트리밍 응답

## URLs
- **Sandbox Preview**: https://3000-i41v15mnpukpom1lv9rdi-02b9cc79.sandbox.novita.ai
- **Production**: (Cloudflare 배포 후 설정)

## 핵심 기능

### ✅ 완성된 기능
1. **Q&A 마스터 스트리밍 API** (`/api/generate/full`)
   - Gemini 1.5 Pro 기반 고품질 콘텐츠 생성
   - 실시간 스트리밍 응답으로 체감 속도 5초
   - 페르소나 매칭: 성별/나이 자동 판별 (워킹맘 오류 완벽 차단)

2. **흑백 엑셀 설계서 API** (`/api/generate/excel-data`)
   - Gemini 2.0 Flash 기반 초고속 처리
   - 15개 이상 담보 구성
   - 컬러 완전 제거 (흑백 인쇄 최적화)

3. **프리미엄 블랙 UI**
   - V29 감성 다크 테마
   - 모바일/데스크톱 반응형
   - 전체 복사 기능

### 📋 분야별 전용 로직
- **상속/증여**: 상속세 납부 재원 현금화, 10년 주기 증여 비과세 전략
- **CEO/법인**: 법인세 절세, 대표이사 퇴직금 재원 마련 플랜
- **치매/간병**: CDR 단계별 보장, 체증형 일당 설계

## API 엔드포인트

| 엔드포인트 | 메소드 | 설명 |
|-----------|--------|------|
| `/` | GET | 메인 UI 페이지 |
| `/api/generate/full` | POST | Q&A 콘텐츠 스트리밍 생성 |
| `/api/generate/excel-data` | POST | 엑셀 설계서 데이터 생성 |

### 요청 파라미터
```json
{
  "target": "30대 워킹맘",
  "insuranceType": "상속/증여",
  "concern": "자녀 증여 시 세금 절약 방법"
}
```

## 기술 스택
- **Framework**: Hono 4.x
- **Runtime**: Cloudflare Workers
- **AI Engine**: Google Gemini 1.5 Pro / 2.0 Flash
- **Frontend**: TailwindCSS CDN + Vanilla JS
- **Build**: Vite

## 환경 변수 (Secrets)

### 로컬 개발 (.dev.vars)
```
GEMINI_API_KEY_1=your_gemini_api_key
GEMINI_API_KEY_2=your_backup_key (선택)
NAVER_CLIENT_ID=your_naver_id (선택)
NAVER_CLIENT_SECRET=your_naver_secret (선택)
```

### 프로덕션 배포
```bash
npx wrangler secret put GEMINI_API_KEY_1
```

## 프로젝트 구조
```
webapp/
├── src/
│   └── index.tsx       # 메인 Hono 앱 (API + UI)
├── dist/               # 빌드 출력
├── public/             # 정적 파일
├── ecosystem.config.cjs # PM2 설정
├── wrangler.jsonc      # Cloudflare 설정
└── package.json
```

## 개발 명령어
```bash
npm run build          # 프로젝트 빌드
npm run dev:sandbox    # 샌드박스 개발 서버
npm run deploy         # Cloudflare Pages 배포
```

## 배포 상태
- **Platform**: Cloudflare Pages
- **Status**: ✅ 개발 완료 / 배포 대기
- **Tech Stack**: Hono + TypeScript + TailwindCSS
- **Last Updated**: 2026-01-17

## 알고리즘 대응 전략
- **C-Rank**: 상증법 제8조, CDR 척도 등 전문 지식 자연 배치
- **DIA/Agent N**: '정보의 이득' 극대화 구체적 수치 제시

## 작성 지침 (AI 프롬프트)
1. '보험초보' 눈높이 비유 사용
2. "엄마 친구", "지인" 언급 금지
3. 마크다운 표(|) 금지, `<br>` 태그 활용
4. 고정 템플릿 사용 금지 (매번 새로운 창조)
