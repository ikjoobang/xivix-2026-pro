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

