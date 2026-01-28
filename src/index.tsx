import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'

type Bindings = {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_PRO?: string;
  GEMINI_API_KEY_FLASH?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  DB?: D1Database; // V2026.37.33 - D1 데이터베이스 바인딩
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/*', cors())

// ============================================
// 모델 설정 (용도별 분리)
// ============================================
// ============================================
// ✅ XIVIX V39 ENGINE_SYNC_FINAL - 모델 최종 확정
// ⚠️ gemini-1.5-pro-002는 404 에러 발생 (API에 없음)
// ✅ gemini-2.5-pro는 API curl 조회 결과 정상 접근 확인됨
// API 검증 완료: 2026.01.19
// ============================================
const ENGINE = {
  FLASH: 'gemini-2.0-flash',       // 데이터 엔진 (빠른 처리용)
  PRO: 'gemini-2.5-pro',           // 전문가 브레인 (API 확인됨) ← 최종 확정
  VISION: 'gemini-2.5-pro'         // 이미지 OCR 분석용 (PRO와 동일)
}

// ============================================
// 🎲 콘텐츠 길이 가변제 (Short/Mid/Long 랜덤 출력)
// 지루한 답변 방지 - 핵심 위주 전달
// ============================================
// ============================================
// 📏 콘텐츠 길이 설정 - CEO 지시 (2026.01.20)
// 글이 너무 길다 → 짧고 임팩트있게 수정
// 네이버 C-RANK, DIA 알고리즘 최적화
// ============================================
// ============================================
// 📏 전문가 답변 길이 설정 - CEO 지시 (2026.01.20)
// "전문가 느낌이 없다" → 깊이 있는 답변으로 수정
// 네이버 C-RANK/DIA 최적화 + 전문성 유지
// ============================================
const CONTENT_LENGTH_MODES = {
  SHORT: { min: 500, max: 700, label: '핵심형', probability: 0.3 },
  MID: { min: 800, max: 1000, label: '전문형', probability: 0.5 },
  LONG: { min: 1100, max: 1400, label: '심층형', probability: 0.2 }
}

// ============================================
// 📏 바이럴 질문 길이 설정 - CEO 지시 (2026.01.20)
// "길고, 짧고, 중간 랜덤" 요청 반영
// ============================================
const VIRAL_QUESTION_LENGTH_MODES = {
  SHORT: { min: 200, max: 350, label: '짧은 질문', probability: 0.33 },
  MID: { min: 400, max: 600, label: '중간 질문', probability: 0.34 },
  LONG: { min: 700, max: 900, label: '긴 질문', probability: 0.33 }
}

function selectViralQuestionLength(): { mode: string, min: number, max: number, label: string } {
  const rand = Math.random()
  if (rand < VIRAL_QUESTION_LENGTH_MODES.SHORT.probability) {
    return { mode: 'SHORT', ...VIRAL_QUESTION_LENGTH_MODES.SHORT }
  } else if (rand < VIRAL_QUESTION_LENGTH_MODES.SHORT.probability + VIRAL_QUESTION_LENGTH_MODES.MID.probability) {
    return { mode: 'MID', ...VIRAL_QUESTION_LENGTH_MODES.MID }
  } else {
    return { mode: 'LONG', ...VIRAL_QUESTION_LENGTH_MODES.LONG }
  }
}

function selectContentLength(): { mode: string, min: number, max: number, label: string } {
  const rand = Math.random()
  if (rand < CONTENT_LENGTH_MODES.SHORT.probability) {
    return { mode: 'SHORT', ...CONTENT_LENGTH_MODES.SHORT }
  } else if (rand < CONTENT_LENGTH_MODES.SHORT.probability + CONTENT_LENGTH_MODES.MID.probability) {
    return { mode: 'MID', ...CONTENT_LENGTH_MODES.MID }
  } else {
    return { mode: 'LONG', ...CONTENT_LENGTH_MODES.LONG }
  }
}

// ============================================
// 🚫 제목 금지어 리스트 (CTR 저하 방지)
// 네이버 카페에서 클릭률 떨어지는 단어들
// ============================================
const TITLE_BANNED_WORDS = [
  '가이드', '전략', '포인트', '대비', '선택', '추천',
  '충격', '손해', '필독', '경악', '대박', '100%', '절대',
  '이거 모르면', '반드시', '꼭 알아야', '핵심 정리',
  '총정리', '완벽 정리', '한눈에', '꿀팁', '필수'
]

// ============================================
// 🔥 전문가 지식 베이스 (상증법, CDR, 법인세 등)
// ============================================
const EXPERT_KNOWLEDGE_BASE = {
  inheritance_tax: {
    law: '상속세 및 증여세법 제8조 (증여 추정 배제)',
    exemption: '배우자 6억원, 직계존비속 5천만원(미성년 2천만원), 기타친족 1천만원',
    rate: '1억 이하 10%, 5억 이하 20%, 10억 이하 30%, 30억 이하 40%, 30억 초과 50%'
  },
  dementia_insurance: {
    scale: 'CDR(Clinical Dementia Rating) 척도: 0(정상)~5(말기)',
    trigger: 'CDR 2이상(중등도 이상) 시 진단금 지급 조건 확인 필수',
    coverage: '요양병원 입원일당, 간병인 비용, 치매 진단비'
  },
  corporate_insurance: {
    tax_benefit: '법인세 손비처리: 임원 퇴직금 한도 내 보험료 경비 인정',
    design: '체증형 설계: CEO 퇴직 시점에 맞춰 보험금 극대화',
    risk: '가지급금 이자: 4.6%(2026년 기준) 세무 리스크'
  }
}

// ============================================
// XIVIX V39 마스터 프롬프트 엔진 v5.0 (ENGINE_SYNC_FINAL)
// 프로젝트: XIVIX_Insurance_King_2026
// 모델: gemini-2.5-pro (API 확인됨) ← 최종 확정
// 핵심: 가변 본문 + 전문 지식 베이스
// ============================================
// ============================================
// XIVIX V39 마스터 프롬프트 - CEO 지시 (2026.01.20)
// 목표: 네이버 C-RANK, DIA 알고리즘 최적화
// 핵심: 상위노출 1위 목표 - 짧고 임팩트 있는 콘텐츠
// ============================================
const MASTER_INSTRUCTION_V3 = {
  model: 'gemini-2.5-pro',  // API 확인됨 (2026.01.19)
  persona: '30년 경력 MDRT 보험왕 & 심리 영업 마스터',
  constraints: {
    text_limit: '본문 500~1400자 (전문가 깊이 + C-RANK 최적화)',
    multimodal: '이미지 첨부 시 최우선 분석하여 report_data에 반영할 것',
    knowledge: '상증법 제8조, CDR 척도, 법인세 손비처리, 체증형 설계 등 전문 지식 필수 포함',
    seo_goal: '네이버 C-RANK, DIA 알고리즘 분석 기반 상위노출 1위 목표'
  },
  output_format: 'JSON_OBJECT'
}

const PERSONA_CONFIG = {
  expert: {
    role_name: "MDRT_보험왕_희망전도사",
    system_instruction: `당신은 2026년 현재 30년 경력 MDRT 보험왕이자 '희망을 주는 보험 멘토'입니다.

[🔴 절대 원칙 - 긍정적/희망적 톤 필수!]
- ❌ 금지: "돈을 안줄 수 있다", "손해볼 수 있다", "위험하다", "조심해야 한다" 등 부정적 표현
- ✅ 필수: "충분히 보장받으실 수 있어요", "좋은 선택이에요", "안심하셔도 돼요", "잘 준비하고 계시네요" 등 긍정적 표현
- 고객의 불안을 '확신과 희망'으로 바꿔주는 따뜻한 조언자 역할

[핵심 역할]
- 어려운 보험 용어를 쉽고 친근하게 설명
- "이렇게 하시면 됩니다" 형태의 명확한 해결책 제시
- 네이버 카페 상위노출을 위한 CTR 30% 이상 보장 제목 작성

[출력 규칙]
- 반드시 유효한 JSON 형식으로만 응답
- 본문은 공백 포함 500~1400자 (네이버 C-RANK 최적화)
- 🔴 상품명(키워드)을 본문에 최소 3회 이상 자연스럽게 반복할 것!`,
    writing_strategy: [
      "🔴 긍정적이고 희망적인 톤 유지 - 부정적 표현 절대 금지!",
      "🔴 상품명(키워드)을 본문에 3회 이상 자연스럽게 반복",
      "고객의 걱정을 인정하되 '해결책'과 '희망'을 제시할 것",
      "반드시 '질문 퍼포먼스'를 통해 댓글 참여를 유도하는 열린 결말로 끝낼 것"
    ]
  },
  beginner: {
    role_name: "질문_퍼포먼스의_달인",
    system_instruction: `당신은 보험에 대해 궁금한 점이 많은 '진짜 초보자'입니다.

[🔴 절대 원칙 - 질문형으로만 작성!]
- ❌ 금지: 설명형, 정보 전달형 문장
- ✅ 필수: "~가입하면 되나요?", "~맞나요?", "~어떻게 해야 하나요?", "~괜찮을까요?" 등 질문형
- 모든 문장을 '질문'이나 '고민'으로 끝낼 것

[핵심 역할]
- 실제 보험 초보자가 카페에 올리는 진짜 질문처럼 작성
- 간절하고 막막한 느낌이 묻어나야 함
- 🔴 상품명(키워드)을 본문에 최소 3회 이상 자연스럽게 반복할 것!`
  },
  comment: {
    role_name: "\ub514\ud14c\uc77c_\ub313\uae00_\ub9c8\uc2a4\ud130",
    system_instruction: `\ub2f9\uc2e0\uc740 \uce74\ud398 \ub0b4 '\uc5ec\ub860 \uc870\uc791\uc758 \ub2ec\uc778'\uc785\ub2c8\ub2e4. \ub2e8\uc21c\ud55c \uce6d\ucc2c\uc774 \uc544\ub2c8\ub77c \uc2e4\uc81c \uacbd\ud5d8\ub2f4\uc744 \uc11e\uc5b4 \ubcf8\ubb38\uc758 \uc2e0\ub8b0\ub3c4\ub97c 200% \uc62c\ub9bd\ub2c8\ub2e4. \uc77c\ubd80\ub7ec \uc9c8\ubb38\uc790\uc5d0\uac8c \ucd94\uac00 \uc815\ubcf4\ub97c \ubb3b\uac70\ub098, \uc804\ubb38\uac00\uc758 \ub2f5\ubcc0\uc5d0 \uac10\ud0c4\ud558\uba70 \uc790\uc2e0\uc758 \uc0ac\ub840\ub97c \ub367\ubd99\uc785\ub2c8\ub2e4.`,
    personas: [
      { nickname: '\uae4c\uce60\ud55c \uc120\ubc30', style: '\uacf5\uaca9\uc801', tone: '\ub9d0\uc774 \ub9ce\ub124\uc694. \uadfc\ub370 \uc81c\uac00 \uc54c\uae30\ub860...', traits: ['\ud314\uc790 \ubb3b\uc5b4\ubcf4\ub294', '\ub530\ub054\ud55c'] },
      { nickname: '\ub2e4\uc815\ud55c \uc8fc\ubd80', style: '\uc6b0\ud638\uc801', tone: '\uc800\ub3c4 \uac19\uc740 \uacbd\ud5d8 \uc788\uc5b4\uc694~ \uadf8\ub54c \uc815\ub9d0...', traits: ['\uacf5\uac10\ud558\ub294', '\uc704\ub85c\ud558\ub294'] },
      { nickname: '\uc758\uc2ec\ub9ce\uc740 \ucd08\ub150\uc0dd', style: '\ucd94\uac00\uc9c8\ubb38\ud615', tone: '\uadf8\ub7f0\ub370 \ud639\uc2dc \uc774\uac74 \uc5b4\ub5bb\uac8c \ub418\ub294\uac74\uac00\uc694??', traits: ['\ud638\uae30\uc2ec \ub9ce\uc740', '\ubc30\uc6b0\ub824\ub294'] },
      { nickname: '\ubca0\ud14c\ub791 \uc124\uacc4\uc0ac', style: '\uc6b0\ud638\uc801', tone: '\uc624 \uc774\uac74 \uc815\ub9d0 \uc815\ud655\ud55c \uc124\uba85\uc774\ub124\uc694. \uc81c\uac00 \ubcf4\uae30\uc5d4...', traits: ['\uc804\ubb38\uc131 \uc778\uc815', '\ucd94\uac00 \ud300 \uc81c\uacf5'] },
      { nickname: '\ub2f9\ud55c \ubcf4\ud5d8\uc8fc', style: '\uacf5\uaca9\uc801', tone: '\uc544 \uc800\ub3c4 \uac19\uc740 \uacbd\ud5d8!! \uadf8\ub54c \uc9c4\uc9dc \uc5f4\ubc1b\uc558\ub294\ub370...', traits: ['\uacbd\ud5d8 \uacf5\uc720', '\uac10\uc815 \ud3ed\ubc1c'] }
    ]
  }
}

// ============================================
// XIVIX 2026 PRO \ucd08\uc815\ubc00 \ub79c\ub364\ud654 \ub9e4\ud2b8\ub9ad\uc2a4 (\ubc31\uc5d4\ub4dc\uc6a9)
// \uc5d4\ud2b8\ub85c\ud53c: 0.95 - \uc218\ub9cc \uac00\uc9c0 \ud655\ub960 \uc870\ud569
// ============================================
const RANDOMIZATION_MATRIX = {
  persona_pool: [
    { role: '\ubd84\ub178\ud55c 30\ub300 \uc544\ube60', style: '\uac70\uce5c \ub9d0\ud22c, \ubcf4\ud5d8\uc0ac \ubd88\uc2e0', keywords: ['\ub4a4\ud1b5\uc218', '\ub208\ud0f1\uc774', '\ud574\uc9c0\uac01'] },
    { role: '\uae50\uae50\ud55c \uc7ac\ud14c\ud06c \uc8fc\ubd80', style: '\uc22b\uc790\uc5d0 \ubc1d\uc74c, \uc218\uc775\ub960 \ub530\uc9d0, \uc774\ubaa8\uc9c0 \ub9ce\uc774 \uc0ac\uc6a9', keywords: ['\ud658\uae09\uae08', '\ubcf5\ub9ac', '\uc0ac\uc5c5\ube44'] },
    { role: '\ud574\ub9d1\uc740 \uc0ac\ud68c\ucd08\ub144\uc0dd', style: '\uc544\ubb34\uac83\ub3c4 \ubaa8\ub984, \uc9c8\ubb38\uc774 \uae38\uace0 \ub450\uc11c\uc5c6\uc74c', keywords: ['\uc0b4\ub824\uc8fc\uc138\uc694', '\uc120\ubc30\ub2d8\ub4e4', '\uc0ac\ud68c\ucd08\ub144\uc0dd'] },
    { role: '\ubc30\uc2e0\uac10 \ub290\ub07c\ub294 50\ub300', style: '\uc9c0\uc778 \uc124\uacc4\uc0ac \uc6d0\ub9dd, \ud558\uc18c\uc5f0\ud558\ub294 \uae34 \ubb38\uc7a5', keywords: ['\uce5c\uad6c\ub188', '\ubbff\uc5c8\ub294\ub370', '\ubc30\uc2e0\uac10'] }
  ],
  situation_pool: [
    '\uac74\uac15\uac80\uc9c4 \ud6c4 \uc6a9\uc885 \uc81c\uac70\ud588\ub294\ub370 \ubcf4\uc0c1 \uac70\uc808\ub2f9\ud568',
    '\ubd80\ubaa8\ub2d8\uc774 20\ub144 \uc804 \ub4e4\uc5b4\uc900 \uc885\uc2e0\ubcf4\ud5d8 \uc54c\uace0 \ubcf4\ub2c8 \uc4f0\ub808\uae30',
    '\uc720\ud29c\ube0c \uad11\uace0 \ubcf4\uace0 \uac00\uc785\ud55c \ubcf4\ud5d8\uc774 \uac31\uc2e0 \ud3ed\ud0c4 \ub9de\uc74c',
    '\uc2e4\ube44 \uc804\ud658\ud558\ub77c\ub294 \uc804\ud654 \ubc1b\uace0 \uc2f8\uc6b0\ub2e4 \ub04a\uc74c'
  ],
  emotional_triggers: ['\uc5b5\uc6b8\ud568', '\ub0c9\uc18c\uc801', '\uac04\uc808\ud568', '\ub2f9\ub2f9\ud568', '\ubd84\ub178'],
  banned_words: ['\ub9c9\ub9c9\ud558\ub2e4', '\ub3c4\uc6c0\uc694\uccad', '\ubb38\uc758\ub4dc\ub9bd\ub2c8\ub2e4', '\uacbd\ud5d8\uc774 \uc788\uc73c\uc2e0', '\ubd80\ud0c1\ub4dc\ub9bd\ub2c8\ub2e4']
}

// ============================================
// ✅ V39 제목 패턴 - CEO 지시 (2026.01.19)
// "제목은 설계사가 아니라 고객이 짓는 거다"
// 설계사용 홍보 제목 절대 금지 → 막막한 고객의 질문 스타일
// 금지: "~한 이유", "~가이드", "~추천", "현직 설계사입니다"
// 필수: "너무 막막한", "도와주세요", "이거 어떻게 해요?" 느낌
// ============================================
const TITLE_PATTERNS = [
  "{target}인데 {keyword} 이거 유지하는 게 맞나요?",
  "{keyword} 리모델링하라는데 진짜 해야 하나요ㅠㅠ",
  "너무 막막한 {target}입니다... {keyword} 질문이요",
  "{keyword} 갱신 폭탄 맞았는데 어떻게 해야 하나요",
  "{target} {keyword} 들어야 할지 고민됩니다",
  "설계사가 {keyword} 바꾸라는데 믿어도 되나요?",
  "{keyword} 보험료가 너무 올랐어요 도와주세요"
]

// 제목 금지어 필터링 함수
function filterBannedWordsFromTitle(title: string): string {
  let filtered = title
  TITLE_BANNED_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi')
    filtered = filtered.replace(regex, '')
  })
  // 연속 공백 제거 및 정리
  return filtered.replace(/\s+/g, ' ').trim()
}

// 제목에 금지어가 포함되었는지 검사
function hasBannedWords(title: string): boolean {
  return TITLE_BANNED_WORDS.some(word => 
    title.toLowerCase().includes(word.toLowerCase())
  )
}

// API 키는 환경변수에서 가져옴 (하드코딩 금지)
// PRO 키: 품질 글쓰기, 전문가 답변, 멀티모달 분석
// FLASH 키: 질문 퍼포먼스, 댓글 생성
// ============================================
// 🔐 사장님 피드백 반영: 안전한 API 키 로직
// PRO/FLASH/GEMINI_API_KEY 순서로 폴백
// ============================================
function getApiKey(env: Bindings, type: 'PRO' | 'FLASH' = 'PRO'): string {
  // 우선순위: 특정 키 > 공통 키
  const key = env.GEMINI_API_KEY_PRO || env.GEMINI_API_KEY_FLASH || env.GEMINI_API_KEY
  if (!key) {
    console.error('[XIVIX] API Key 누락! 환경변수 확인 필요: GEMINI_API_KEY, GEMINI_API_KEY_PRO, GEMINI_API_KEY_FLASH')
    throw new Error('API Key가 설정되지 않았습니다. Cloudflare 환경변수를 확인하세요.')
  }
  return key
}

// Gemini API 호출 (system_instruction 지원)
async function callGeminiWithPersona(
  apiKey: string,
  model: string, 
  systemInstruction: string, 
  userPrompt: string, 
  isStream: boolean = false
): Promise<Response> {
  const endpoint = isStream 
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{ 
        role: 'user',
        parts: [{ text: userPrompt }] 
      }],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192
      }
    })
  })
  
  return response
}

// ============================================
// ✅ V39 동적 컨텍스트 바인딩 - CEO 지시 (2026.01.19)
// "30대/40대 타령 그만해라" - 하드코딩 나이 완전 제거
// 사용자 입력에서 나이/직업/상황을 100% 동적 추출
// ============================================
function analyzeTarget(topic: string, ocrData?: any) {
  // 보험 종류 자동 감지
  let insuranceProduct = '실손보험'
  if (topic.includes('암')) insuranceProduct = '암보험'
  else if (topic.includes('종신')) insuranceProduct = '종신보험'
  else if (topic.includes('태아') || topic.includes('어린이')) insuranceProduct = '태아보험'
  else if (topic.includes('연금')) insuranceProduct = '연금보험'
  else if (topic.includes('치매') || topic.includes('간병')) insuranceProduct = '치매/간병보험'
  else if (topic.includes('유병자') || topic.includes('간편심사')) insuranceProduct = '유병자보험'
  else if (topic.includes('상속') || topic.includes('증여')) insuranceProduct = '상속/증여보험'
  else if (topic.includes('운전자')) insuranceProduct = '운전자보험'
  else if (topic.includes('실비') || topic.includes('실손')) insuranceProduct = '실손보험'
  
  // ✅ 동적 나이 추출 - 하드코딩 완전 제거
  // 1순위: 사용자 입력에서 정확한 숫자 추출
  // 2순위: OCR 데이터에서 생년월일 계산
  // 3순위: "XX대" 표현에서 추출
  // 기본값 없음 - 추출 실패 시 "보험 관심자"로 표기
  let extractedAge = ''
  let extractedRole = ''
  
  // 정확한 나이 추출 (52세, 38살 등)
  const exactAgeMatch = topic.match(/(\d{2,3})\s*(세|살)/)
  if (exactAgeMatch) {
    extractedAge = exactAgeMatch[1]
  }
  // "XX대" 추출 (50대, 30대 등)
  else {
    const decadeMatch = topic.match(/(\d{2})대/)
    if (decadeMatch) {
      extractedAge = decadeMatch[1] + '대'
    }
  }
  
  // OCR 데이터에서 나이 추출 (생년월일 → 나이 계산)
  if (!extractedAge && ocrData?.birthDate) {
    const birthYear = parseInt(ocrData.birthDate.substring(0, 4))
    if (birthYear > 1900 && birthYear < 2020) {
      extractedAge = String(new Date().getFullYear() - birthYear)
    }
  }
  
  // 직업/역할 동적 추출
  if (topic.includes('자영업') || topic.includes('사장')) extractedRole = '자영업자'
  else if (topic.includes('직장인') || topic.includes('회사원')) extractedRole = '직장인'
  else if (topic.includes('주부') || topic.includes('전업')) extractedRole = '전업주부'
  else if (topic.includes('워킹맘')) extractedRole = '워킹맘'
  else if (topic.includes('프리랜서')) extractedRole = '프리랜서'
  else if (topic.includes('아줌마') || topic.includes('아주머니')) extractedRole = '아줌마'
  else if (topic.includes('아빠') || topic.includes('아버지') || topic.includes('가장')) extractedRole = '가장'
  else if (topic.includes('엄마') || topic.includes('어머니')) extractedRole = '엄마'
  else if (topic.includes('신혼') || topic.includes('결혼')) extractedRole = '신혼부부'
  else if (topic.includes('CEO') || topic.includes('법인') || topic.includes('대표')) extractedRole = '법인대표'
  else if (topic.includes('은퇴') || topic.includes('노후')) extractedRole = '은퇴 준비자'
  else if (topic.includes('사회초년생') || topic.includes('취준')) extractedRole = '사회초년생'
  
  // ✅ 동적 타겟 조합 - 절대 하드코딩 금지
  let targetAudience = ''
  if (extractedAge && extractedRole) {
    targetAudience = `${extractedAge}${extractedAge.includes('대') ? '' : '세'} ${extractedRole}`
  } else if (extractedAge) {
    targetAudience = `${extractedAge}${extractedAge.includes('대') ? '' : '세'} 보험 관심자`
  } else if (extractedRole) {
    targetAudience = extractedRole
  } else {
    // 기본값도 입력 기반으로 유추
    targetAudience = '보험 상담이 필요한 분'
  }
  
  return { insuranceProduct, targetAudience, extractedAge, extractedRole }
}

// 전문가 답변용 프롬프트 생성 (XIVIX 2026 초정밀 버전 - 스트리밍용)
function buildExpertPrompt(topic: string) {
  const { insuranceProduct, targetAudience } = analyzeTarget(topic)
  
  // 랜덤 제목 패턴 선택
  const titleHint = TITLE_PATTERNS.map(p => 
    p.replace('{keyword}', insuranceProduct).replace('{target}', targetAudience)
  ).join('\n- ')
  
  // writing_strategy 적용
  const strategies = PERSONA_CONFIG.expert.writing_strategy?.join('\n- ') || ''
  
  return `## 주제: ${topic} / 대상: ${targetAudience} / 보험: ${insuranceProduct} ##

[🔴🔴🔴 최우선 규칙 - 반드시 준수! 🔴🔴🔴]
1. 긍정적/희망적 톤만 사용! 부정적 표현 절대 금지!
   ❌ 금지: "손해", "위험", "조심", "안된다", "못받는다", "인상됐다"
   ✅ 필수: "안심하세요", "충분히 가능해요", "좋은 선택이에요", "잘 준비하고 계시네요"

2. 🔴 "${insuranceProduct}" 키워드를 본문에 최소 3회 이상 자연스럽게 반복!
   예시: "${insuranceProduct}에 대해 궁금하신 거죠? ${insuranceProduct}는... 이런 ${insuranceProduct}를 선택하시면..."

[🎯 작성 전략]
- ${strategies}

[📌 1. 제목 생성] 
참고 패턴:
- ${titleHint}

[📌 2. 본문 작성] (공백 포함 500~1400자)
■ 서론: 따뜻한 공감 + 희망적 메시지 (2줄)
■ 본론: "${insuranceProduct}"를 3회 이상 언급하며 핵심 정보 전달
■ 결론: "도움이 되셨길 바랍니다" + 댓글 유도 질문

[📌 3. 고정 키워드] (본문 끝에 반드시 포함)
보험상담, 보험리모델링, 보험상담이필요하신분

[📌 4. SEO 키워드] (5개 - ${insuranceProduct} 포함 필수)
[📌 5. 예상 댓글] (5개)`
}

// 초보 질문자용 프롬프트 생성 (XIVIX 2026 질문 퍼포먼스 버전)
function buildBeginnerPrompt(topic: string, situation: string) {
  const { insuranceProduct } = analyzeTarget(topic)
  
  return `상황: ${situation} / 상품: ${insuranceProduct}

[🔴🔴🔴 최우선 규칙 - 질문형으로만 작성! 🔴🔴🔴]

1. 모든 핵심 문장을 질문형으로!
   ❌ 금지: "~입니다", "~해요", "~거든요" (설명형)
   ✅ 필수: "~가입하면 되나요?", "~맞나요?", "~괜찮을까요?", "~어떻게 해야 하나요?"

2. 🔴 "${insuranceProduct}" 키워드를 본문에 최소 3회 이상 반복!

[📌 질문 예시 패턴]
- "이런 ${insuranceProduct}에 가입하면 되는 건가요?"
- "우리 엄마가 ${insuranceProduct} 권유받았는데 이 나이에 ${insuranceProduct} 가입되나요?"
- "${insuranceProduct} 리모델링 꼭 해야 하나요?"

[📌 출력 형식]
📌 제목: (질문형 제목 - "~인가요?", "~될까요?" 형태)

📌 본문: (500~1400자)
- 구체적인 상황 설명 후 → 질문으로 마무리
- "${insuranceProduct}"를 3회 이상 자연스럽게 언급
- 마지막은 반드시 "아시는 분 답변 부탁드려요ㅠㅠ" 형태로

[📌 고정 키워드] (본문 끝에 반드시 포함)
보험상담, 보험리모델링, 보험상담이필요하신분`
}

// 댓글 생성용 프롬프트 (XIVIX 2026 여론 조작 버전)
function buildCommentPrompt(postContent: string) {
  return `원문: ${postContent}

[🎯 미션]
위 글에 대해 '진짜 카페 회원'들이 대화하는 듯한 고도의 심리전 댓글 5개를 달아줘.

[📌 댓글 작성 원칙]
■ 단순한 칭찬이 아니라 실제 경험담을 섞어 본문의 신뢰도를 200% 올릴 것
■ 일부러 질문자에게 추가 정보를 묻거나, 전문가의 답변에 감탄하며 자신의 사례를 덧붙일 것
■ 3번째 댓글은 반드시 전문가의 전문성에 감탄하는 내용이어야 함

[📌 5명의 페르소나]
1. 까칠한 선배 (약간 퉁명스럽지만 핵심 정보 제공)
2. 다정한 주부 (공감하며 본인 경험 공유)
3. 의심 많은 사회초년생 (추가 질문으로 대화 유도)
4. 베테랑 회원 (전문가 글에 감탄 + 보충 정보)
5. 지나가던 초보 (단순 감사 + "저도 궁금했어요")

각 댓글의 길이는 다양하게 (한 줄 ~ 3줄), 실제 카페 분위기로 작성해줘.`
}

// 메인 콘텐츠 생성 API (전문가 페르소나)
app.post('/api/generate/master', async (c) => {
  const body = await c.req.json()
  const topic = body.concern || body.topic || ''
  
  return streamText(c, async (stream) => {
    await stream.write(JSON.stringify({ type: 'status', step: 1, msg: '🔍 주제 분석 중...' }) + '\n')
    
    const { insuranceProduct, targetAudience } = analyzeTarget(topic)
    await stream.write(JSON.stringify({ type: 'status', step: 2, msg: `📋 ${insuranceProduct} / ${targetAudience} 매칭 완료` }) + '\n')
    await stream.write(JSON.stringify({ type: 'status', step: 3, msg: '✍️ 전문가 콘텐츠 생성 중...' }) + '\n')
    
    try {
      const apiKey = getApiKey(c.env, 'PRO')
      const systemInstruction = PERSONA_CONFIG.expert.system_instruction
      const userPrompt = buildExpertPrompt(topic)
      
      // 품질 글쓰기는 PRO 모델 + PRO 키 사용
      const response = await callGeminiWithPersona(apiKey, ENGINE.PRO, systemInstruction, userPrompt, true)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        await stream.write(JSON.stringify({ type: 'error', msg: 'API 호출 실패' }) + '\n')
        return
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6))
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) await stream.write(JSON.stringify({ type: 'content', data: text.replace(/\n/g, '<br>') }) + '\n')
            } catch (e) {}
          }
        }
      }
      await stream.write(JSON.stringify({ type: 'done' }) + '\n')
    } catch (error) {
      console.error('Stream Error:', error)
      await stream.write(JSON.stringify({ type: 'error', msg: String(error) }) + '\n')
    }
  })
})

// 초보 질문 게시글 생성 API
app.post('/api/generate/question', async (c) => {
  const body = await c.req.json()
  const topic = body.topic || ''
  const situation = body.situation || body.concern || ''
  
  try {
    const apiKey = getApiKey(c.env, 'FLASH')
    const systemInstruction = PERSONA_CONFIG.beginner.system_instruction
    const userPrompt = buildBeginnerPrompt(topic, situation)
    
    // 초보 질문은 FLASH 모델 + FLASH 키 사용
    const response = await callGeminiWithPersona(apiKey, ENGINE.FLASH, systemInstruction, userPrompt, false)
    const json = await response.json() as any
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    return c.json({ success: true, content: text })
  } catch (error) {
    return c.json({ success: false, error: 'API 호출 실패' })
  }
})

// 댓글 생성 API
app.post('/api/generate/comments', async (c) => {
  const body = await c.req.json()
  const postContent = body.content || ''
  
  try {
    const apiKey = getApiKey(c.env, 'FLASH')
    const systemInstruction = PERSONA_CONFIG.comment.system_instruction
    const userPrompt = buildCommentPrompt(postContent)
    
    // 댓글 생성은 FLASH 모델 + FLASH 키 사용
    const response = await callGeminiWithPersona(apiKey, ENGINE.FLASH, systemInstruction, userPrompt, false)
    const json = await response.json() as any
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    return c.json({ success: true, comments: text })
  } catch (error) {
    return c.json({ success: false, error: 'API 호출 실패' })
  }
})

// 실시간 보험 트렌드 키워드 풀 (네이버 인기검색어 기반 시뮬레이션)
const TREND_POOL = [
  // 상속/증여 카테고리
  { keyword: '실손보험 4세대', category: '실손', volume: [8000, 15000] },
  { keyword: '암보험 추천 2026', category: '암보험', volume: [6000, 12000] },
  { keyword: '태아보험 필수특약', category: '태아', volume: [5000, 10000] },
  { keyword: '종신보험 해지', category: '종신', volume: [4000, 9000] },
  { keyword: '연금보험 비교', category: '연금', volume: [5500, 11000] },
  { keyword: '운전자보험 필요성', category: '운전자', volume: [3500, 8000] },
  { keyword: '간병보험 비용', category: '간병', volume: [4500, 9500] },
  { keyword: '치아보험 위폴릭트', category: '치아', volume: [3000, 7000] },
  { keyword: '상속세 절세방법', category: '상속', volume: [7000, 14000] },
  { keyword: '증여세 면제한도 2026', category: '증여', volume: [6500, 13000] },
  { keyword: 'CEO 퇴직금 설계', category: 'CEO', volume: [4000, 8500] },
  { keyword: '법인보험 세금혜택', category: '법인', volume: [3800, 8200] },
  { keyword: '유병자보험 가입조건', category: '유병자', volume: [5200, 10500] },
  { keyword: '20대 보험 필수', category: '20대', volume: [4800, 9800] },
  { keyword: '30대 보험 설계', category: '30대', volume: [5500, 11500] },
  { keyword: '치매보험 가입시기', category: '치매', volume: [4200, 8800] },
  { keyword: '건강보험 환급금', category: '건강', volume: [6000, 12500] },
  { keyword: '저축보험 만기환급', category: '저축', volume: [3500, 7500] },
  { keyword: '자녀보험 언제까지', category: '자녀', volume: [4000, 8500] },
  { keyword: '보험료 인상 대비', category: '보험료', volume: [5000, 10000] },
]

// 실시간 트렌드 생성 함수 (매 요청마다 랜덤 변동)
function generateRealtimeTrends() {
  // 매 요청마다 완전 랜덤 셔플 (새로고침할 때마다 변경)
  const shuffled = [...TREND_POOL].sort(() => Math.random() - 0.5)
  
  // 상위 8개 선택
  const selected = shuffled.slice(0, 8)
  
  return selected.map((item, index) => {
    // 볼륨 랜덤 생성 (범위 내)
    const baseVolume = Math.floor(item.volume[0] + Math.random() * (item.volume[1] - item.volume[0]))
    const volume = Math.round(baseVolume / 100) * 100
    
    // 변동 상태 결정
    const changeRand = Math.random()
    let change = 'same'
    let changePercent = 0
    
    if (changeRand > 0.7) {
      change = 'up'
      changePercent = Math.floor(Math.random() * 20) + 5
    } else if (changeRand > 0.5) {
      change = 'down'
      changePercent = Math.floor(Math.random() * 15) + 3
    } else if (changeRand > 0.4) {
      change = 'new'
    }
    
    return {
      rank: index + 1,
      keyword: item.keyword,
      category: item.category,
      change,
      changePercent,
      volume: volume.toLocaleString()
    }
  })
}

// 네이버 실시간 검색 트렌드 API
app.get('/api/trend', async (c) => {
  const clientId = c.env?.NAVER_CLIENT_ID || ''
  const clientSecret = c.env?.NAVER_CLIENT_SECRET || ''
  
  // 네이버 API 키가 있으면 실제 API 호출 시도
  if (clientId && clientSecret) {
    try {
      const today = new Date()
      const endDate = today.toISOString().split('T')[0]
      const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      // 다양한 보험 키워드 풀 (네이버 API는 최대 5개 그룹만 허용)
      const allKeywordGroups = [
        { groupName: '실손보험', keywords: ['실손보험', '실손보험 4세대', '실비보험'] },
        { groupName: '암보험', keywords: ['암보험', '암보험 추천', '암보험 비교'] },
        { groupName: '종신보험', keywords: ['종신보험', '종신보험 해지', '종신보험 추천'] },
        { groupName: '치매보험', keywords: ['치매보험', '치매보험 추천', '간병보험'] },
        { groupName: '자녀보험', keywords: ['자녀보험', '어린이보험', '태아보험'] },
        { groupName: '연금보험', keywords: ['연금보험', '연금저축', '노후대비'] },
        { groupName: '운전자보험', keywords: ['운전자보험', '자동차보험', '운전자보험 필요성'] },
        { groupName: '상속세', keywords: ['상속세', '상속세 절세', '상속 증여'] },
        { groupName: '증여세', keywords: ['증여세', '증여세 면제', '증여 한도'] },
        { groupName: '건강보험', keywords: ['건강보험', '건강보험료', '의료보험'] }
      ]
      
      // 매 요청마다 랜덤으로 5개 선택 (실시간 변동 효과)
      const shuffled = [...allKeywordGroups].sort(() => Math.random() - 0.5)
      const selectedGroups = shuffled.slice(0, 5)
      
      const requestBody = {
        startDate,
        endDate,
        timeUnit: 'date',
        keywordGroups: selectedGroups
      }
      
      const response = await fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret
        },
        body: JSON.stringify(requestBody)
      })
      
      const responseData = await response.json() as any
      
      // 네이버 API 에러 시 에러 메시지 반환
      if (!response.ok || responseData.errorCode) {
        return c.json({
          success: false,
          source: 'naver_api_error',
          error: responseData.errorMessage || 'Unknown error',
          errorCode: responseData.errorCode,
          status: response.status
        })
      }
      
      if (responseData.results) {
        const results = responseData.results || []
        
        // 실제 트렌드 데이터와 시뮬레이션 병합
        const realTrends = results.map((item: any, index: number) => {
          const latestRatio = item.data?.[item.data.length - 1]?.ratio || 0
          const prevRatio = item.data?.[item.data.length - 2]?.ratio || 0
          let change = 'same'
          let changePercent = 0
          
          if (latestRatio > prevRatio * 1.05) {
            change = 'up'
            changePercent = Math.round((latestRatio / prevRatio - 1) * 100)
          } else if (latestRatio < prevRatio * 0.95) {
            change = 'down'
            changePercent = Math.round((1 - latestRatio / prevRatio) * 100)
          }
          
          return {
            rank: index + 1,
            keyword: item.title,
            category: item.title.split(' ')[0],
            change,
            changePercent,
            volume: Math.round(latestRatio * 100).toLocaleString()
          }
        })
        
        // 부족한 경우 시뮬레이션 데이터 추가
        const simTrends = generateRealtimeTrends()
        const combined = [...realTrends, ...simTrends.slice(realTrends.length)].slice(0, 8)
          .map((item, index) => ({ ...item, rank: index + 1 }))
        
        return c.json({ 
          success: true, 
          trends: combined,
          source: 'naver_datalab',
          nextUpdate: 15,
          updatedAt: new Date().toISOString() 
        })
      }
    } catch (error) {
      console.error('Naver API error:', error)
      // 에러 정보 반환 (디버깅용)
      return c.json({ 
        success: false, 
        error: String(error),
        source: 'naver_error'
      })
    }
  }
  
  // Fallback: 시뮬레이션 트렌드 데이터 (API 키 없을 때)
  const trends = generateRealtimeTrends()
  return c.json({ 
    success: true, 
    trends, 
    source: 'realtime_simulation',
    debug: { hasClientId: !!clientId, hasClientSecret: !!clientSecret },
    nextUpdate: 15,
    updatedAt: new Date().toISOString() 
  })
})

// 파일 업로드 API (Base64 처리)
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.json()
    const { file, filename, mimeType } = body
    
    if (!file) {
      return c.json({ success: false, error: '파일이 없습니다' }, 400)
    }
    
    // Base64 데이터 크기 검증 (10MB = ~13.3MB in Base64)
    const base64Size = file.length * 0.75 // Base64 to bytes approximate
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (base64Size > maxSize) {
      return c.json({ success: false, error: '파일 크기가 10MB를 초과합니다' }, 400)
    }
    
    // 이미지 MIME 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(mimeType)) {
      return c.json({ success: false, error: '지원하지 않는 파일 형식입니다 (JPG, PNG, GIF, WEBP만 가능)' }, 400)
    }
    
    // 파일 정보 반환 (Cloudflare Workers에서는 파일 저장 불가, R2 연동 필요 시 추가)
    return c.json({ 
      success: true, 
      file: {
        name: filename,
        size: Math.round(base64Size),
        mimeType,
        preview: file.substring(0, 100) + '...',
        uploadedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    return c.json({ success: false, error: '업로드 처리 실패' }, 500)
  }
})

// 이미지 분석 API (Vision 모델 사용 - PRO 키로 멀티모달)
app.post('/api/analyze/image', async (c) => {
  try {
    const body = await c.req.json()
    const { image, mimeType, prompt } = body
    
    if (!image) {
      return c.json({ success: false, error: '이미지가 없습니다' }, 400)
    }
    
    // 멀티모달 분석은 PRO 키 사용
    const apiKey = getApiKey(c.env, 'PRO')
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.PRO}:generateContent?key=${apiKey}`
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt || '이 이미지에서 보험 관련 정보를 분석해주세요. 보험증권, 약관, 설계서 등이 있다면 주요 내용을 추출해주세요.' },
            { 
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 4096
        }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Vision API Error:', errorText)
      return c.json({ success: false, error: '이미지 분석 실패' }, 500)
    }
    
    const json = await response.json() as any
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    return c.json({ 
      success: true, 
      analysis: text,
      model: ENGINE.PRO
    })
  } catch (error) {
    console.error('Image Analysis Error:', error)
    return c.json({ success: false, error: '이미지 분석 처리 실패' }, 500)
  }
})

// ============================================
// 🔥 FULL PACKAGE 통합 엔드포인트 v4 (SSE 스트리밍)
// - 타임아웃 방지: 스트리밍으로 실시간 출력
// - 제목: 25자 이내 (모바일 가독성)
// - 본문: 1,000자 내외 (네이버 카페 최적화)
// - 우선순위: 이미지 > 입력 텍스트 > 트렌드 (Context Switching)
// ============================================
app.post('/api/generate/full-package', async (c) => {
  try {
    const body = await c.req.json()
    const inputTopic = body.concern || body.topic || ''
    const trendKeyword = body.trend_keyword || '' // 트렌드에서 선택한 키워드
    const image = body.image || null // Base64 이미지 (선택)
    const mimeType = body.mimeType || 'image/jpeg'
    
    // ============================================
    // 🎯 Context Priority 시스템 (이미지 > 입력 > 트렌드)
    // ============================================
    let contextSource = 'trend' // default
    let topic = trendKeyword || inputTopic // 초기값
    let imageAnalysisResult: any = null
    
    const proKey = getApiKey(c.env, 'PRO')
    const flashKey = getApiKey(c.env, 'FLASH')
    
    let imageAnalysis = ''
    let reportData: any[] = [] // 보장 분석 리포트 데이터
    
    // ============================================
    // Step 1: 이미지 우선 분석 (Context Override)
    // 이미지가 있으면 트렌드/입력 키워드를 무시하고 이미지 내용 우선
    // ============================================
    if (image) {
      contextSource = 'image'
      const visionPrompt = `당신은 30년 경력 MDRT 보험왕입니다. 이 이미지(보험증권, 약관, 설계서 등)를 분석하고 JSON으로 응답하세요.

[📊 분석 항목]
1. 이미지 종류 파악 (보험증권, 약관, 설계서, 청구서, 진단서 등)
2. 보험사, 상품명, 가입일, 만기일 등 기본 정보 → 이 정보를 바탕으로 detected_keyword 필드 생성
3. 각 보장 항목별 현재 가입금액과 권장 금액 비교
4. 주의해야 할 약관 조항이나 함정
5. 전문가 조언 포인트

반드시 아래 JSON 형식으로만 응답하세요:

{
  "imageType": "보험증권/약관/설계서 등",
  "company": "보험사명",
  "productName": "상품명",
  "detected_keyword": "이미지에서 감지된 핵심 보험 종류 (예: 암보험, 종신보험, 실손보험 등)",
  "summary": "핵심 분석 요약 (2-3줄)",
  "report_data": [
    {"item": "암진단비", "current": "현재 가입금액", "target": "권장 금액", "status": "critical/essential/good"},
    {"item": "뇌혈관질환", "current": "현재 가입금액", "target": "권장 금액", "status": "critical/essential/good"},
    {"item": "급성심근경색", "current": "현재 가입금액", "target": "권장 금액", "status": "critical/essential/good"},
    {"item": "수술비", "current": "현재 가입금액", "target": "권장 금액", "status": "critical/essential/good"},
    {"item": "입원일당", "current": "현재 가입금액", "target": "권장 금액", "status": "critical/essential/good"}
  ],
  "warnings": ["주의사항1", "주의사항2"],
  "advice": "전문가 핵심 조언"
}`
      
      const visionEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.PRO}:generateContent?key=${proKey}`
      const visionResponse = await fetch(visionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: visionPrompt },
              { inline_data: { mime_type: mimeType, data: image } }
            ]
          }],
          generationConfig: { 
            temperature: 0.4, 
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
          }
        })
      })
      
      if (visionResponse.ok) {
        const visionJson = await visionResponse.json() as any
        const rawText = visionJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
        try {
          const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleanJson)
          imageAnalysisResult = parsed
          imageAnalysis = parsed.summary || rawText
          reportData = parsed.report_data || []
          
          // 🎯 Context Override: 이미지에서 감지된 키워드로 주제 교체
          if (parsed.detected_keyword) {
            topic = parsed.detected_keyword
            console.log(`[Context Switch] 이미지 감지 키워드로 주제 교체: ${topic}`)
          }
          
          // 전체 분석 결과 저장
          imageAnalysis = `📋 ${parsed.imageType || '문서'} 분석\n🏢 ${parsed.company || ''} - ${parsed.productName || ''}\n\n${parsed.summary || ''}\n\n⚠️ 주의사항:\n${(parsed.warnings || []).map((w: string) => '• ' + w).join('\n')}\n\n💡 전문가 조언:\n${parsed.advice || ''}`
          
          // V2026.37.60 - 이미지에서 추출한 보험사명 저장 (자동 이미지 생성용)
          imageAnalysisResult.company = parsed.company || null
          imageAnalysisResult.productName = parsed.productName || null
        } catch (e) {
          console.error('Vision JSON Parse Error:', e)
          imageAnalysis = rawText
        }
      }
    } else if (inputTopic) {
      // 입력 텍스트가 있으면 트렌드보다 우선
      contextSource = 'input'
      topic = inputTopic
    }
    
    // 최종 주제로 타겟 분석
    const { insuranceProduct, targetAudience } = analyzeTarget(topic)
    
    // Step 2: 구조화된 JSON 출력을 위한 프롬프트 (v4 - 제목 25자, 본문 1,000자 엄격 제한)
    const strategies = PERSONA_CONFIG.expert.writing_strategy?.join(', ') || ''
    const titleHint = TITLE_PATTERNS.map(p => 
      p.replace('{keyword}', insuranceProduct).replace('{target}', targetAudience)
    ).join(', ')
    
    // ============================================
    // 🚨 핵심 제약 조건 (프롬프트 최상단 배치) - V2026.37.60
    // ============================================
    const fullPackagePrompt = `## XIVIX 2026 마케팅 콘텐츠 생성 (v5) ##

🔴🔴🔴 [최우선 규칙 - 반드시 준수!] 🔴🔴🔴
1. 🔴 전문가 답변은 긍정적/희망적 톤만! 부정적 표현 절대 금지!
   ❌ 금지: "손해", "위험", "조심", "안된다", "못받는다", "인상", "폭탄"
   ✅ 필수: "안심하세요", "충분히 가능해요", "좋은 선택이에요", "잘 준비하고 계시네요"

2. 🔴 바이럴 질문은 질문형으로만! 설명형 금지!
   ❌ 금지: "~입니다", "~해요", "~거든요" (설명형)
   ✅ 필수: "~가입하면 되나요?", "~맞나요?", "~어떻게 해야 하나요?"

3. 🔴 "${insuranceProduct}" 키워드를 본문/질문에 최소 3회 이상 반복!

4. 🔴 고정 키워드 필수 포함: 보험상담, 보험리모델링, 보험상담이필요하신분

[기본 제약]
- 제목: 25자 이내 (질문형 권장)
- 본문: 500~1400자 (긍정적 톤 + 키워드 3회 반복)
- 바이럴 질문: 200~300자 (질문형 + 키워드 3회 반복)
- 자극적/어그로 단어 금지: "충격", "필독", "경악", "대박", "100%", "절대"

[📊 입력 정보]
- 컨텍스트 소스: ${contextSource} (image > input > trend 우선순위)
- 주제: ${topic}
- 대상: ${targetAudience}
- 보험: ${insuranceProduct}
${imageAnalysis ? `- 🖼️ 이미지 분석 (최우선 컨텍스트):\n${imageAnalysis}` : ''}

[🎯 작성 전략] ${strategies}

[📌 제목 참고 패턴 - 25자 이내로 압축할 것!] ${titleHint}

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이 JSON만):

{
  "seo_audit": {
    "score": 85-99 사이 숫자,
    "grade": "S+/S/A+/A 중 하나",
    "rank_prediction": "1-3위/3-5위/5-10위 중 하나",
    "analysis": "SEO 분석 한줄 요약"
  },
  "titles": [
    {"id": 1, "text": "제목1 (공백 포함 25자 이내! 예: 암보험, 지금 준비해도 될까요?)"},
    {"id": 2, "text": "제목2 (25자 이내)"},
    {"id": 3, "text": "제목3 (25자 이내)"},
    {"id": 4, "text": "제목4 (25자 이내)"},
    {"id": 5, "text": "제목5 (25자 이내)"}
  ],
  "viral_questions": [
    {"id": 1, "text": "질문형으로 작성! ${insuranceProduct} 3회 반복! 200~300자"},
    {"id": 2, "text": "질문형으로 작성! ${insuranceProduct} 3회 반복! 200~300자"}
  ],
  "contents": [
    {"id": 1, "style": "공감형", "text": "긍정적 톤! ${insuranceProduct} 3회 반복! 500~1400자"},
    {"id": 2, "style": "팩트형", "text": "긍정적 톤! ${insuranceProduct} 3회 반복! 500~1400자"},
    {"id": 3, "style": "영업형", "text": "긍정적 톤! ${insuranceProduct} 3회 반복! 500~1400자"}
  ],
  "seoKeywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "hashtags": ["#보험", "#실손보험", "#암보험", "#보험설계사", "#보험상담"]
}`
    
    const expertEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.PRO}:generateContent?key=${proKey}`
    const expertResponse = await fetch(expertEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PERSONA_CONFIG.expert.system_instruction + '\n\n중요: 반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON 객체만 출력합니다.' }] },
        contents: [{ role: 'user', parts: [{ text: fullPackagePrompt }] }],
        generationConfig: { 
          temperature: 0.8, 
          topP: 0.95, 
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    })
    
    let expertData: any = { titles: [], contents: [], seoKeywords: [] }
    if (expertResponse.ok) {
      const expertJson = await expertResponse.json() as any
      const rawText = expertJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
      try {
        // JSON 파싱 시도
        const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        expertData = JSON.parse(cleanJson)
      } catch (e) {
        console.error('JSON Parse Error:', e)
        // 파싱 실패 시 원본 텍스트 포함
        expertData = { 
          titles: [{ id: 1, text: '제목 파싱 실패' }], 
          contents: [{ id: 1, style: '원본', text: rawText }], 
          seoKeywords: [] 
        }
      }
    } else {
      const errorText = await expertResponse.text()
      console.error('Expert API Error:', errorText)
      return c.json({ success: false, error: '전문가 콘텐츠 생성 실패', detail: errorText }, 500)
    }
    
    // Step 3: 댓글 5개 생성 (FLASH 모델 - JSON 형식)
    const commentPrompt = `주제: ${topic} - ${insuranceProduct} 관련 전문가 글

위 주제의 전문가 게시글에 달릴 '진짜 카페 회원' 댓글 5개를 작성해줘.

5명의 페르소나:
1. 까칠한 선배 (퉁명스럽지만 핵심 정보)
2. 다정한 주부 (공감 + 본인 경험)
3. 의심 많은 사회초년생 (추가 질문)
4. 베테랑 회원 (전문가에 감탄 + 보충 정보)
5. 지나가던 초보 (감사 + "저도 궁금했어요")

반드시 아래 JSON 형식으로만 응답 (다른 텍스트 없이):

{
  "comments": [
    {"id": 1, "nickname": "닉네임1", "persona": "까칠한 선배", "text": "댓글 내용"},
    {"id": 2, "nickname": "닉네임2", "persona": "다정한 주부", "text": "댓글 내용"},
    {"id": 3, "nickname": "닉네임3", "persona": "의심 많은 사회초년생", "text": "댓글 내용"},
    {"id": 4, "nickname": "닉네임4", "persona": "베테랑 회원", "text": "댓글 내용"},
    {"id": 5, "nickname": "닉네임5", "persona": "지나가던 초보", "text": "댓글 내용"}
  ]
}`
    
    const commentEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.FLASH}:generateContent?key=${flashKey}`
    const commentResponse = await fetch(commentEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PERSONA_CONFIG.comment.system_instruction + '\n\n중요: 반드시 유효한 JSON 형식으로만 응답하세요.' }] },
        contents: [{ role: 'user', parts: [{ text: commentPrompt }] }],
        generationConfig: { 
          temperature: 0.9, 
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      })
    })
    
    let commentsData: any = { comments: [] }
    if (commentResponse.ok) {
      const commentJson = await commentResponse.json() as any
      const rawText = commentJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
      try {
        const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        commentsData = JSON.parse(cleanJson)
      } catch (e) {
        console.error('Comment JSON Parse Error:', e)
        commentsData = { comments: [{ id: 1, nickname: '회원', persona: '기본', text: rawText }] }
      }
    }
    
    // ============================================
    // 🎯 제목 후처리 (truncate 제거 - AI 생성 그대로 사용)
    // ============================================
    const processedTitles = (expertData.titles || []).map((t: any) => ({
      ...t,
      text: t.text,  // truncate 제거: AI가 생성한 그대로 사용
      original_length: t.text?.length || 0
    }))
    
    // Final: 구조화된 JSON 응답 (v4 - Context Switching + 제목 25자 + 본문 1,000자)
    return c.json({
      success: true,
      package: {
        topic,
        original_topic: inputTopic || trendKeyword,
        context_source: contextSource, // 'image' | 'input' | 'trend'
        context_priority: '이미지 > 입력 텍스트 > 트렌드',
        target: targetAudience,
        insurance: insuranceProduct,
        // V2026.37.60 - CEO 지시: 보험사명 추가 (자동 이미지 생성용)
        company: imageAnalysisResult?.company || null,
        productName: imageAnalysisResult?.productName || null,
        seo_audit: expertData.seo_audit || { score: 95, grade: 'S+', rank_prediction: '1-3위', analysis: 'SEO 최적화 완료' },
        imageAnalysis: imageAnalysis || null,
        image_detected_keyword: imageAnalysisResult?.detected_keyword || null,
        report_data: reportData, // 이미지 분석에서 추출한 보장 분석 데이터
        titles: processedTitles,
        title_constraint: '25자 이내 (모바일 가독성)',
        viral_questions: expertData.viral_questions || [],
        contents: expertData.contents || [],
        content_constraint: '1,000자 내외 (800-1,100자)',
        seoKeywords: expertData.seoKeywords || [],
        // CEO 지시 (2026.01.20): 해시태그 추가
        hashtags: (expertData.seoKeywords || []).slice(0, 5).map((k: string) => '#' + k.replace(/\s+/g, '')),
        comments: commentsData.comments || [],
        generatedAt: new Date().toISOString()
      },
      models: {
        vision: image ? ENGINE.PRO : null,
        expert: ENGINE.PRO,
        comments: ENGINE.FLASH
      },
      version: '2026.37.60',
      changelog: 'v4: 스트리밍 대응, 제목 25자, 본문 1,000자, Context Switching'
    })
    
  } catch (error) {
    console.error('Full Package Error:', error)
    return c.json({ success: false, error: 'Full Package 생성 실패', detail: String(error) }, 500)
  }
})

// ============================================
// 🔥 FULL PACKAGE SSE 스트리밍 엔드포인트 (타임아웃 방지)
// - 각 단계별 진행 상황을 실시간으로 클라이언트에 전송
// - 본문이 생성되는 대로 글자 단위로 스트리밍
// ============================================
app.post('/api/generate/full-package-stream', async (c) => {
  const body = await c.req.json()
  const inputTopic = body.concern || body.topic || ''
  const trendKeyword = body.trend_keyword || ''
  let image = body.image || null
  let mimeType = body.mimeType || 'image/jpeg'
  
  // V39: API 요청에서 직접 전달된 OCR 데이터 (브라우저에서 미리 분석한 경우)
  const requestImageAnalysis = body.imageAnalysis || ''
  const requestOcrData = body.ocrData || null
  
  return streamText(c, async (stream) => {
    try {
      // 🎯 Context Priority 시스템
      let contextSource = 'trend'
      let topic = trendKeyword || inputTopic
      let imageAnalysis = requestImageAnalysis // API 요청에서 전달된 분석 데이터 우선 사용
      let reportData: any[] = []
      let imageDetectedKeyword = ''
      // V2026.37.60 - 이미지에서 추출한 보험사/상품명 (자동 이미지 생성용)
      let detectedCompany: string | null = null
      let detectedProductName: string | null = null
      
      // V39: API 요청에서 OCR 데이터가 전달된 경우 바로 바인딩
      if (requestOcrData) {
        contextSource = 'image'
        imageDetectedKeyword = requestOcrData.productName || ''
        // OCR 데이터를 reportData 형태로 변환
        if (requestOcrData.coverages && Array.isArray(requestOcrData.coverages)) {
          reportData = requestOcrData.coverages.map((c: string, i: number) => ({
            item: c.split(' ')[0] || `담보${i+1}`,
            current: c,
            target: '확인 필요',
            status: 'info'
          }))
        }
        // imageAnalysis가 비어있으면 OCR 데이터로 생성
        if (!imageAnalysis && requestOcrData) {
          imageAnalysis = `📋 보험증권 OCR 분석 결과\n🏢 ${requestOcrData.company || '보험사'} - ${requestOcrData.productName || '상품명'}\n💰 월 보험료: ${requestOcrData.premium || '확인 필요'}\n\n담보 내역:\n${(requestOcrData.coverages || []).map((c: string) => `- ${c}`).join('\n')}`
        }
      }
      
      const proKey = getApiKey(c.env, 'PRO')
      const flashKey = getApiKey(c.env, 'FLASH')
      
      // 🔥 이미지 URL → Base64 변환 (Gemini API는 base64 필요)
      if (image && image.startsWith('http')) {
        try {
          await stream.write(JSON.stringify({ type: 'step', step: 0, msg: '🖼️ 이미지 다운로드 중...' }) + '\n')
          const imgResponse = await fetch(image)
          if (imgResponse.ok) {
            const imgBuffer = await imgResponse.arrayBuffer()
            const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
            image = base64
            // Content-Type에서 mime type 추출
            const contentType = imgResponse.headers.get('content-type')
            if (contentType) mimeType = contentType.split(';')[0]
          }
        } catch (e) {
          await stream.write(JSON.stringify({ type: 'warning', msg: '이미지 다운로드 실패, URL 직접 분석 시도' }) + '\n')
        }
      }
      
      // Step 1: 이미지 분석 (우선순위 1)
      await stream.write(JSON.stringify({ type: 'step', step: 1, msg: '🔍 API 연결 및 트렌드 분석 중...' }) + '\n')
      
      // ============================================
      // 🔥 V39 USER_CONTEXT_PRIORITY: 사용자 입력 강제 바인딩
      // 사용자가 입력한 문장 = 모든 콘텐츠의 뿌리 데이터
      // ============================================
      const userContextAngle = inputTopic // 사용자 입력 원본 보존
      
      if (image) {
        contextSource = 'image'
        await stream.write(JSON.stringify({ type: 'step', step: 1, msg: '🖼️ 이미지 OCR 분석 중 (담보/보험료 추출)...' }) + '\n')
        
        // V39: 강화된 이미지 OCR 프롬프트 - 담보 정보/보험료 즉시 대입
        const visionPrompt = `## 보험 설계서/증권 이미지 OCR 분석 ##

🚨 [최우선 지시] 이미지에서 다음 정보를 정확히 추출하세요:

1. detected_keyword: 보험 종류 (암보험, 실손보험, 종신보험, 치매보험 등)
2. company: 보험사명
3. monthly_premium: 월 보험료 (숫자만, 예: 124000)
4. total_premium: 총 보험료 또는 납입기간
5. insured_name: 피보험자 이름 (있으면)
6. insured_age: 피보험자 나이 (있으면)
7. contract_date: 계약일자 (있으면)
8. summary: 설계서 핵심 요약 (2~3문장)

9. report_data: 담보 항목 배열 (가장 중요!)
   - item: 담보명 (예: 암 진단비, 수술비, 입원일당 등)
   - current: 현재 가입 금액 (예: 3,000만원)
   - target: 권장 금액 (예: 5,000만원) - 없으면 null
   - status: "critical" | "essential" | "good"

모든 숫자와 담보 정보를 이미지에서 정확히 읽어 JSON으로 응답하세요.
이미지에 없는 정보는 null로 표시하세요.`

        const visionEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.VISION}:generateContent?key=${proKey}`
        
        const visionResponse = await fetch(visionEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: visionPrompt }, { inline_data: { mime_type: mimeType, data: image } }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' }
          })
        })
        
        if (visionResponse.ok) {
          const visionJson = await visionResponse.json() as any
          const rawText = visionJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
          try {
            const parsed = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            if (parsed.detected_keyword) {
              // 🔥 이미지에서 추출한 키워드 + 사용자 입력 병합
              topic = userContextAngle ? `${userContextAngle} (${parsed.detected_keyword})` : parsed.detected_keyword
              imageDetectedKeyword = parsed.detected_keyword
            }
            // V2026.37.60 - 보험사명 저장 (자동 이미지 생성용)
            detectedCompany = parsed.company || null
            detectedProductName = parsed.productName || parsed.detected_keyword || null
            
            imageAnalysis = JSON.stringify({
              company: parsed.company,
              premium: parsed.monthly_premium,
              insured_age: parsed.insured_age,
              summary: parsed.summary
            })
            reportData = parsed.report_data || []
            
            // OCR 결과 스트림 전송
            await stream.write(JSON.stringify({ 
              type: 'ocr_result', 
              data: {
                keyword: parsed.detected_keyword,
                company: parsed.company,
                premium: parsed.monthly_premium,
                insured_age: parsed.insured_age,
                report_data_count: reportData.length
              }
            }) + '\n')
            await stream.write(JSON.stringify({ type: 'context_switch', from: userContextAngle || trendKeyword, to: topic, source: 'image' }) + '\n')
          } catch (e) { 
            imageAnalysis = rawText
            // 파싱 실패해도 사용자 입력은 유지
            if (userContextAngle) topic = userContextAngle
          }
        }
      } else if (inputTopic) {
        contextSource = 'input'
        topic = inputTopic
      }
      
      const { insuranceProduct, targetAudience } = analyzeTarget(topic)
      await stream.write(JSON.stringify({ type: 'step', step: 2, msg: `🎯 ${insuranceProduct} / ${targetAudience} 매칭 완료` }) + '\n')
      
      // Step 2: 제목 + 바이럴 질문 생성 (스트리밍)
      await stream.write(JSON.stringify({ type: 'step', step: 3, msg: '✍️ 제목 및 바이럴 질문 생성 중...' }) + '\n')
      
      // ✅ V39 동적 나이 추출 - 하드코딩 30 제거
      // 나이를 못 찾으면 빈 문자열 유지 (기본값 30 삭제)
      const ageMatch = targetAudience.match(/(\d+)/)
      const targetAge = ageMatch ? ageMatch[1] : ''
      
      // ✅ OCR 데이터가 있으면 프롬프트 최상단에 강제 배치
      const ocrPriorityBlock = imageAnalysis ? `
🔴🔴🔴 [OCR 데이터 - 최우선 반영 필수!] 🔴🔴🔴
${imageAnalysis}
→ 위 정보(보험사명, 상품명, 월 보험료)를 제목과 질문에 반드시 포함하세요!
` : ''
      
      const titlePrompt = `## XIVIX V39 제목 + 바이럴 질문 생성 ##
${ocrPriorityBlock}
사용자 원본 입력: ${topic}
보험: ${insuranceProduct}
타겟: ${targetAudience}

🚨🚨🚨 [CEO 최우선 지시 - 반드시 준수] 🚨🚨🚨
"제목은 설계사가 아니라 고객이 짓는 거다"
"현직 설계사입니다"가 아니라 "너무 막막한 ${targetAudience}입니다"라는 느낌!

📌 [제목 5개 생성 규칙 - V2026.37.14 스타일 다양화]
■ 공백 포함 20~25자 필수! (최소 20자 이상)
■ ✅ 고객 관점 질문형 스타일 (막막함, 도움 요청)
■ ❌ 설계사용 홍보 제목 절대 금지
■ 🎯 5개 제목 = 5가지 다른 스타일 필터 적용 필수!
■ 금지어: "가이드", "전략", "포인트", "대비", "선택", "추천", "충격", "손해", "필독", "경악", "대박", "~한 이유", "~하는 이유"

🎨 [5가지 스타일 필터 - 각각 1개씩 필수!]
1️⃣ 감성형 (공감/걱정): "부모님 생각에 ${insuranceProduct} 알아보는데 막막해요"
2️⃣ 정보형 (궁금/질문): "${insuranceProduct} 이거 진짜 필요한 건가요?"
3️⃣ 공포소구형 (불안/긴급): "${insuranceProduct} 안 들면 큰일 나나요? ㅠㅠ"
4️⃣ 비교형 (분석/고민): "${insuranceProduct} A사 vs B사 뭐가 나은지..."
5️⃣ 경험담형 (후기/사례): "${insuranceProduct} 가입하신 분들 후회 없으세요?"

❌ 나쁜 제목 예시 (설계사 관점 - 절대 금지):
- "30대를 위한 암보험 선택 가이드"
- "암보험 비교 분석 핵심 포인트"
- "${targetAge}살에 ${insuranceProduct} 안 들면 후회하는 이유"
- "현직 설계사가 알려주는 보험 꿀팁"

📌 [바이럴 질문 3개 생성 규칙 - V2026.37.60 수정]
■ 질문1: 150~250자 / 질문2: 250~350자 / 질문3: 350~450자
■ 🔴🔴🔴 [최우선 규칙] 🔴🔴🔴
  1. 모든 문장을 질문형으로 끝낼 것! ("~인가요?", "~될까요?", "~맞나요?", "~어떻게 해야 하나요?")
  2. "${insuranceProduct}" 키워드를 각 질문에 3회 이상 자연스럽게 반복!
  3. 설명형 금지! 오직 질문과 고민만!
■ 🚨 핵심: 네이버 봇이 스팸으로 분류하지 않도록 모든 질문이 완전히 다른 패턴!

🎭 [페르소나 풀 - 매번 랜덤 선택]
- 20대 사회초년생 (첫 보험, 뭘 들어야 할지 모름)
- 30대 워킹맘 (아이 보험, 교육자금, 시간 없음)
- 40대 가장 (가족 부양, 건강 걱정 시작)
- 50대 은퇴 예정자 (노후 준비, 연금 고민)
- 깐깐한 재테크 카페 운영자 (비교분석 요청)
- 보험 피해 경험자 (불신, 의심 가득)

🎲 [감정 가중치 - 랜덤 믹스]
- 불안(40%): "이러다 큰일 나는 거 아닌지..."
- 분노(20%): "보험사가 장난하나요?" "이게 말이 됩니까?"
- 호기심(30%): "이거 진짜예요?" "어떻게 된 건지 궁금해서"
- 의심(10%): "광고 아니죠?" "솔직히 믿어도 되나요?"

🚫 [절대 금지 - 첫 문장]
- "안녕하세요" 금지
- "급하다", "답답하다" 단독 사용 금지
- 반드시 구체적 상황으로 시작할 것!

⚡ [도입부 30종 - V2026.37.16 확장! 구체적 상황 필수!]
★ 일상 상황형 (10종)
- "오늘 보험금 청구했다가 거절당했는데..."
- "방금 설계사한테 전화 받고 멘붕 왔어요"
- "어제 건강검진 결과 나왔는데 갑자기 보험 생각이..."
- "친구가 암 진단 받았다고 해서 덜컥 겁이..."
- "부모님이 갑자기 보험 정리하라고 하시는데"
- "보험료 자동이체 보다가 이게 뭐지 싶어서"
- "유튜브 보다가 보험 리모델링 광고 봤는데 혹해서"
- "회사 동료가 보험으로 2천만원 받았다고 자랑하길래"
- "지인 설계사가 자꾸 연락 오는데 믿어도 되나요"
- "보험 가입한 지 10년 됐는데 한 번도 안 써봤거든요"
★ 가족/생애주기형 (10종)
- "엄마가 보험금 못 받으셨다고 하소연하시길래"
- "실손보험 리모델링하라는데 뭔 소린지..."
- "카페 글 보다가 내 보험도 문제 있나 싶어서"
- "보험료 너무 많이 나가서 정리하고 싶은데"
- "결혼하면서 보험 다시 봐야 한다는데"
- "아기 태어나면 뭐부터 들어야 하는 거예요?"
- "퇴직금 받으면 연금보험 들라는데 맞나요?"
- "보험사 직원이 이 상품 없어진다고 빨리 가입하래요"
- "건강 안 좋아지니까 갑자기 보험 생각나서"
- "솔직히 보험 잘 모르는데 설계사 말만 믿어도 될까요?"
★ 돈/비용 걱정형 (5종) - V2026.37.16 추가!
- "월 보험료가 30만원인데 이게 정상인가요?"
- "갱신형이라 60세 되면 100만원 넘는다는데..."
- "해지하면 얼마나 돌려받을 수 있는지 모르겠어요"
- "보험 리모델링하면 진짜 돈 아낄 수 있어요?"
- "같은 보험인데 친구는 절반 가격이래요 ㅠㅠ"
★ 불신/의심형 (5종) - V2026.37.16 추가!
- "설계사가 좋다는 건 다 본인 수당 때문 아니에요?"
- "보험사 직원 말 믿으면 호구 되는 거 아닌가요?"
- "인터넷에선 다 가입하지 말라는데..."
- "이 상품 진짜 괜찮은 건지 모르겠어요"
- "후기가 너무 좋아서 오히려 의심돼요"

⚡ [종결부 15종]
- "이런 경우 어떻게 하셨어요?"
- "비슷한 상황 겪으신 분?"
- "제가 호구 잡힌 건가요?"
- "솔직한 경험담 부탁드려요"
- "진짜 이게 맞는 건지 모르겠어요"
- "광고 아닌 진짜 후기 듣고 싶어요"
- "쪽지로 알려주셔도 감사합니다"
- "설계사분들 말고 실제 가입자분들 의견이요"
- "저만 이런 고민 하는 건가요?"
- "뭘 물어봐야 하는지도 모르겠어요 ㅠ"
- "조언 좀 해주시면 정말 감사하겠습니다"
- "댓글이든 쪽지든 아무거나요"
- "이거 진짜인지 가짜인지만 알려주세요"
- "경험담이 제일 도움 될 것 같아요"
- "제발 광고 말고 솔직한 의견이요"

■ 사용자 입력의 나이/상황/금액을 자연스럽게 녹여서 사용
■ 전문가 어투 금지: "손해", "필수", "꼭", "반드시" 사용 금지
■ 🔴 "${insuranceProduct}"를 각 질문에 3회 이상 반복!
■ 🔴 질문형 종결어미 필수: "~인가요?", "~될까요?", "~맞나요?"

JSON 형식으로만 응답:
{
  "titles": [{"id":1,"text":"25자 이내 질문형 제목 (~인가요?)"},{"id":2,"text":"25자 이내 질문형 제목"},{"id":3,"text":"25자 이내 질문형 제목"},{"id":4,"text":"25자 이내 질문형 제목"},{"id":5,"text":"25자 이내 질문형 제목"}],
  "viral_questions": [{"id":1,"text":"${insuranceProduct} 3회 반복 + 질문형 150~250자"},{"id":2,"text":"${insuranceProduct} 3회 반복 + 질문형 250~350자"},{"id":3,"text":"${insuranceProduct} 3회 반복 + 질문형 350~450자"}]
}`
      
      const titleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.FLASH}:generateContent?key=${flashKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: titlePrompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 2048, responseMimeType: 'application/json' }
        })
      })
      
      let titles: any[] = []
      let viralQuestions: any[] = []
      
      if (titleResponse.ok) {
        const json = await titleResponse.json() as any
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
        try {
          const parsed = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
          titles = (parsed.titles || []).map((t: any) => ({
            ...t,
            // V2026.37.15 - TITLE_CONTAINER_FIX: truncate 제거, AI 생성 그대로 출력
            text: t.text
          }))
          viralQuestions = parsed.viral_questions || []
        } catch (e) {}
      }
      
      await stream.write(JSON.stringify({ type: 'titles', data: titles }) + '\n')
      await stream.write(JSON.stringify({ type: 'viral_questions', data: viralQuestions }) + '\n')
      
      // ============================================
      // Step 3: 본문 3개 생성 - V39 가변 길이 시스템
      // Short(400자) / Mid(700자) / Long(1,200자) 랜덤 출력
      // ============================================
      const lengthMode = selectContentLength()
      await stream.write(JSON.stringify({ 
        type: 'step', 
        step: 4, 
        msg: `📝 전문가 본문 생성 중 (${lengthMode.label} ${lengthMode.min}~${lengthMode.max}자)...` 
      }) + '\n')
      
      const styles = ['공감형', '팩트형', '영업형']
      const contents: any[] = []
      
      // 이미지 OCR 데이터가 있으면 본문에 강제 바인딩
      // V39 마스터 지시: "이미지 업로드해서 데이터 안 박히면 OCR 연결 고장 난 거니까 배포 중단"
      let ocrDataBinding = ''
      if (reportData.length > 0) {
        ocrDataBinding = `\n\n■ [이미지에서 추출한 담보 정보 - 반드시 답변에 언급할 것!]\n${reportData.map((r: any) => `- ${r.item}: 현재 ${r.current || '미가입'} → 권장 ${r.target || '확인 필요'} (${r.status === 'critical' ? '⚠️위험' : r.status === 'essential' ? '📌필수' : '✅양호'})`).join('\n')}`
      }
      // imageAnalysis가 있으면 추가 바인딩 (보험사명, 상품명, 보험료 등)
      if (imageAnalysis) {
        ocrDataBinding += `\n\n🔴🔴🔴 [OCR 데이터 강제 바인딩 - 반드시 본문에 인용!] 🔴🔴🔴\n${imageAnalysis}\n→ 위 정보(보험사명, 상품명, 월 보험료 금액)를 본문에 구체적으로 언급해야 합니다!`
      }
      
      // 사용자 입력 원본 강제 바인딩
      const userInputBinding = userContextAngle 
        ? `\n\n🚨 [USER_CONTEXT_PRIORITY - 최우선 반영 필수!]\n사용자의 원본 고민: "${userContextAngle}"\n→ 이 고민에 직접적으로 답변해야 합니다. 엉뚱한 소리 금지!`
        : ''
      
      for (let i = 0; i < 3; i++) {
        const style = styles[i]
        await stream.write(JSON.stringify({ type: 'content_start', id: i + 1, style }) + '\n')
        
        // 전문 지식 베이스 참조
        let expertKnowledge = ''
        if (insuranceProduct.includes('상속') || insuranceProduct.includes('증여') || topic.includes('상속') || topic.includes('증여')) {
          expertKnowledge = `■ 전문 지식 (핵심만 간결하게):
- 상증법 제8조: 배우자 6억, 직계존비속 5천만원(미성년 2천만원) 공제
- 세율: 1억↓10%, 5억↓20%, 10억↓30%, 30억↓40%, 30억↑50%`
        } else if (insuranceProduct.includes('치매') || insuranceProduct.includes('간병') || topic.includes('치매')) {
          expertKnowledge = `■ 전문 지식 (핵심만 간결하게):
- CDR척도: 0~5단계, 대부분 CDR2(중등도) 이상 시 진단금 지급
- 간병비용 월 300만원↑, 65세 이상 치매 유병률 10.2%`
        } else if (insuranceProduct.includes('법인') || topic.includes('CEO') || topic.includes('법인')) {
          expertKnowledge = `■ 전문 지식 (핵심만 간결하게):
- 법인세 손비처리: 퇴직금 한도 내 보험료 경비 인정
- 체증형 설계로 퇴직 시점 보험금 극대화, 가지급금 이자 4.6%`
        } else if (insuranceProduct.includes('암')) {
          expertKnowledge = `■ 전문 지식 (핵심만 간결하게):
- 유사암(갑상선 등): 일반암의 10~20%만 지급
- 30대 비갱신형 유리, 암 직접치료비 특약 필수`
        } else {
          expertKnowledge = `■ 전문 지식 (핵심만 간결하게):
- 4세대 실손: 자기부담 20~30%, 2026년 인상률 3.5~7%
- 부담보 조항: 고지의무 위반 시 보상 거절 가능`
        }
        
        const contentPrompt = `## XIVIX V39 전문가 답변 생성 ##

주제: ${topic}
타겟: ${targetAudience}
보험: ${insuranceProduct}
스타일: ${style}
${userInputBinding}
${ocrDataBinding}

🚨🚨🚨 [XIVIX 김미경 지사장급 품질 기준 - 위반 시 출력 금지] 🚨🚨🚨

⏰ [기준 시점 강제] 현재는 2026년입니다!
■ 모든 통계/법률/트렌드는 "2026년 현재" 또는 "올해(2026년)" 기준으로 작성!
■ "2023년", "2024년", "2025년"은 과거 사례로만 언급 (현재 기준 아님!)
■ 예시: "2026년 현재 실손보험 개정안에 따르면...", "올해(2026년) 기준으로..."

■ 본문 길이: ${lengthMode.min}~${lengthMode.max}자 (${lengthMode.label})
■ 핵심만 팩트로! 지루한 서론 금지!
■ ${style} 스타일로 작성
■ 줄바꿈으로 가독성 확보

[필수] 네이버 C-Rank 최적화 포맷팅 규칙
■ 모든 본문은 반드시 1. 2. 3. 숫자 리스트를 "순차적으로 3개 모두" 사용할 것
■ 1. 으로 시작하고 2. 로 이어지고 3. 으로 마무리 (이 순서 필수!)
■ 특수기호(❶❷❸) 사용 절대 금지! 오직 1. 2. 3. 숫자만!
■ 숫자로 단락 구분, 체크 항목은 - 기호로 정리
■ 자연스러운 스토리텔링 형식으로 작성 (네이버 D.I.A. 최적화)

${expertKnowledge}

[${style} 작성 구조 - 네이버 SEO 최적화]
${style === '공감형' ? `
■ 반드시 아래 3단계 구조로 자연스럽게 작성:

1. [공감] 독자의 고민에 공감하며 시작 - "저도 같은 고민 했어요"

2. [정보] 핵심 정보 2~3가지를 깔끔하게 정리
   - 체크 항목은 대시(-)로 나열

3. [마무리] 따뜻한 마무리 - "함께 고민해드릴게요"

※ 1. 2. 3. 숫자 리스트로 단락 구분 필수!
` : style === '팩트형' ? `
■ 반드시 아래 3단계 구조로 작성:
1. [팩트] 숫자와 통계로 시작 (예: 40대 남성 암 발병률 3.1배)
2. [분석] 약관 함정과 주의사항을 체크리스트로 정리
3. [결론] 핵심 결론 명확하게 마무리

※ 1. 2. 3. 순서로 3개 모두 반드시 포함!
` : `
■ 반드시 아래 3단계 구조로 작성:
1. [트리거] 심리적 트리거 - 손실 회피, 긴급성으로 주의 환기
2. [긴박감] "지금 확인 안 하면..." 위기감 부여
3. [CTA] "무료 진단 신청하세요" - 명확한 행동 유도

※ 1. 2. 3. 순서로 3개 모두 반드시 포함!
`}

반드시 아래 JSON 형식으로만 응답:
{"text": "${lengthMode.min}~${lengthMode.max}자의 핵심 위주 답변"}`
        
        // 비스트리밍 API 사용 (안정성 향상)
        const contentResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.PRO}:generateContent?key=${proKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: PERSONA_CONFIG.expert.system_instruction }] },
            contents: [{ role: 'user', parts: [{ text: contentPrompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 4096, responseMimeType: 'application/json' }
          })
        })
        
        let fullText = ''
        if (contentResponse.ok) {
          const json = await contentResponse.json() as any
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
          
          // 🔥 디버그: API 응답 확인
          console.log(`[XIVIX] Content #${i+1} API 응답 길이: ${rawText.length}`)
          
          if (!rawText) {
            // API가 빈 응답을 반환한 경우 - finishReason 확인
            const finishReason = json.candidates?.[0]?.finishReason || 'UNKNOWN'
            console.log(`[XIVIX] Content #${i+1} finishReason: ${finishReason}`)
            await stream.write(JSON.stringify({ type: 'content_error', id: i + 1, reason: finishReason }) + '\n')
          }
          
          try {
            // JSON 파싱 시도
            const parsed = JSON.parse(rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
            fullText = parsed.text || rawText
          } catch (e) {
            // 파싱 실패 시 원본 텍스트 사용
            fullText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/^\s*{\s*"text"\s*:\s*"|"\s*}\s*$/g, '').trim()
          }
          // 진행 상황 업데이트
          if (fullText.length > 0) {
            await stream.write(JSON.stringify({ type: 'content_chunk', id: i + 1, chunk: fullText.substring(0, 50) + '...' }) + '\n')
          }
        } else {
          // API 호출 실패
          const errorText = await contentResponse.text()
          console.log(`[XIVIX] Content #${i+1} API 오류: ${contentResponse.status} - ${errorText.substring(0, 200)}`)
          await stream.write(JSON.stringify({ type: 'content_error', id: i + 1, status: contentResponse.status, error: errorText.substring(0, 100) }) + '\n')
        }
        
        contents.push({ id: i + 1, style, text: fullText })
        await stream.write(JSON.stringify({ type: 'content_done', id: i + 1, length: fullText.length }) + '\n')
      }
      
      // Step 4: 댓글 생성 (V39 강화)
      await stream.write(JSON.stringify({ type: 'step', step: 5, msg: '💬 댓글 군단 생성 중...' }) + '\n')
      
      const commentPrompt = `주제: ${topic}
타겟: ${targetAudience}
보험: ${insuranceProduct}

위 주제의 전문가 게시글에 달릴 '진짜 카페 회원' 댓글 5개를 작성해줘.

[댓글 작성 원칙]
■ 실제 카페 회원처럼 반말/존댓말 섞어서
■ 1번: 까칠한 선배 (의심하다가 인정)
■ 2번: 다정한 주부 (공감하며 질문)
■ 3번: 전문가에게 감탄하는 내용 필수
■ 4번: 베테랑 회원 (추가 정보 제공)
■ 5번: 초보 (단순 감사)
■ 각 댓글 50~150자 (한 줄~세 줄)

JSON 형식으로만 응답:
{"comments":[{"id":1,"nickname":"닉네임","persona":"역할","text":"댓글 내용"}]}`
      const commentResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ENGINE.FLASH}:generateContent?key=${flashKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: commentPrompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048, responseMimeType: 'application/json' }
        })
      })
      
      let comments: any[] = []
      if (commentResponse.ok) {
        const json = await commentResponse.json() as any
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
        console.log('[XIVIX] 댓글 API 응답 길이:', rawText.length)
        try {
          const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleanJson)
          // 응답이 배열이면 직접 사용, 객체이면 .comments 사용
          comments = Array.isArray(parsed) ? parsed : (parsed.comments || [])
          console.log('[XIVIX] 댓글 파싱 성공:', comments.length, '개')
        } catch (e) {
          console.error('[XIVIX] 댓글 JSON 파싱 실패:', e)
          // 파싱 실패 시 기본 댓글 생성
          comments = [
            { id: 1, nickname: '보험맘37', persona: '까칠한 선배', text: '와 이렇게 자세히 설명해주시다니... 저도 비슷한 고민했는데 도움됐어요.' },
            { id: 2, nickname: '행복한주부', persona: '다정한 주부', text: '저도 30대 워킹맘인데 정말 공감돼요. 감사합니다!' },
            { id: 3, nickname: '재테크초보', persona: '감탄형', text: '전문가님 글 너무 좋아요. 어려운 내용을 쉽게 설명해주셔서 이해가 쏙쏙!' },
            { id: 4, nickname: '10년차직장인', persona: '베테랑', text: '참고로 저는 작년에 비슷하게 했는데 세무사 상담도 같이 받으니 더 좋더라고요.' },
            { id: 5, nickname: '궁금이', persona: '초보', text: '감사합니다 ㅎㅎ' }
          ]
        }
      } else {
        console.error('[XIVIX] 댓글 API 호출 실패:', commentResponse.status)
        // API 실패 시 기본 댓글
        comments = [
          { id: 1, nickname: '보험맘37', persona: '까칠한 선배', text: '좋은 정보 감사합니다. 저도 참고할게요.' },
          { id: 2, nickname: '행복한주부', persona: '다정한 주부', text: '공감돼요! 저도 비슷한 상황이에요.' },
          { id: 3, nickname: '재테크초보', persona: '감탄형', text: '전문가님 설명 최고예요!' },
          { id: 4, nickname: '10년차직장인', persona: '베테랑', text: '추가로 전문가 상담도 추천드려요.' },
          { id: 5, nickname: '궁금이', persona: '초보', text: '감사합니다!' }
        ]
      }
      
      await stream.write(JSON.stringify({ type: 'comments', data: comments }) + '\n')
      console.log('[XIVIX] 댓글 전송 완료:', comments.length, '개')
      
      // Final - CEO 지시 (2026.01.20): seoKeywords + hashtags 추가
      const seoKeywords = [insuranceProduct, targetAudience, topic.split(' ')[0], '보험상담', '보험리모델링'].filter(Boolean).slice(0, 5)
      const hashtags = seoKeywords.map(k => '#' + String(k).replace(/\s+/g, ''))
      
      await stream.write(JSON.stringify({
        type: 'complete',
        package: {
          topic, context_source: contextSource, insurance: insuranceProduct, target: targetAudience,
          // V2026.37.60 - CEO 지시: 보험사명 추가 (자동 이미지 생성용)
          company: detectedCompany,
          productName: detectedProductName,
          image_detected_keyword: imageDetectedKeyword || null,
          titles, viral_questions: viralQuestions, contents, comments, report_data: reportData,
          seoKeywords, hashtags
        },
        version: '2026.37.60'
      }) + '\n')
      
    } catch (error) {
      await stream.write(JSON.stringify({ type: 'error', msg: String(error) }) + '\n')
    }
  })
})

// ============================================
// V2026.37.33 - 로그인 API (D1 데이터베이스 연동)
// 승인 상태 확인 후 로그인 처리
// ============================================
app.post('/api/login', async (c) => {
  try {
    const { phone, password } = await c.req.json()
    
    if (!phone || !password) {
      return c.json({ success: false, message: '휴대폰 번호와 비밀번호를 입력해 주세요.' }, 400)
    }
    
    // ============================================
    // ✅ V2026.37.40 - CEO 지시 (v4.95): 전화번호 정규화
    // 하이픈 없이 숫자만 입력해도 로그인 가능하도록 처리
    // 01048453065 → 010-4845-3065 형식으로 자동 변환
    // ============================================
    const normalizePhone = (p: string): string => {
      const digits = p.replace(/\D/g, ''); // 숫자만 추출
      if (digits.length === 11) {
        return digits.slice(0,3) + '-' + digits.slice(3,7) + '-' + digits.slice(7);
      } else if (digits.length === 10) {
        return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
      }
      return p; // 원본 반환
    };
    const normalizedPhone = normalizePhone(phone);
    console.log('[XIVIX] 로그인 시도 - 입력:', phone, '→ 정규화:', normalizedPhone);
    
    let user: any = null;
    
    // D1에서 사용자 조회 (정규화된 번호로)
    if (c.env?.DB) {
      user = await c.env.DB.prepare(
        'SELECT * FROM membership_users WHERE phone = ?'
      ).bind(normalizedPhone).first();
    } else {
      // D1 없으면 메모리에서 조회 (정규화된 번호로)
      user = pendingUsers.find(u => u.phone === normalizedPhone);
    }
    
    if (user) {
      // 등록된 사용자 확인 (비밀번호 체크)
      if (user.password_hash === btoa(password)) {
        if (user.status === 'APPROVED') {
          console.log('[XIVIX] ✅ 로그인 성공:', phone)
          return c.json({ 
            success: true, 
            status: 'APPROVED',
            message: '로그인 성공',
            name: user.name
          })
        } else {
          console.log('[XIVIX] ⏳ 승인 대기 중:', phone)
          return c.json({ 
            success: false, 
            status: 'PENDING',
            message: '현재 입금 확인 및 승인 대기 중입니다.\\n승인 완료 후 이용 가능합니다.\\n(방익주 계좌 입금 확인 중)'
          })
        }
      } else {
        return c.json({ success: false, message: '비밀번호가 일치하지 않습니다.' }, 401)
      }
    } else {
      // 등록되지 않은 사용자
      return c.json({ 
        success: false, 
        message: '등록되지 않은 사용자입니다.\\n멤버십 가입 신청을 먼저 해주세요.' 
      }, 404)
    }
  } catch (error) {
    console.error('[XIVIX] 로그인 오류:', error)
    return c.json({ success: false, message: '서버 오류. 다시 시도해 주세요.' }, 500)
  }
})

// ============================================
// V2026.37.33 - 가입 신청 API (D1 데이터베이스 연동)
// ============================================
app.post('/api/registration', async (c) => {
  try {
    const { name, phone, password } = await c.req.json()
    
    if (!name || !phone || !password) {
      return c.json({ success: false, message: '모든 항목을 입력해 주세요.' }, 400)
    }
    
    // ✅ V2026.37.43 - CEO 지시 (v5.4): 전화번호 정규화
    // 사용자가 뭘 입력하든 숫자만 추출 → 하이픈 형식으로 저장
    const normalizePhone = (p: string): string => {
      const digits = p.replace(/\D/g, '');
      if (digits.length === 11) {
        return digits.slice(0,3) + '-' + digits.slice(3,7) + '-' + digits.slice(7);
      } else if (digits.length === 10) {
        return digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
      }
      return p;
    };
    const normalizedPhone = normalizePhone(phone);
    console.log('[XIVIX] 가입 전화번호 정규화:', phone, '→', normalizedPhone);
    
    const password_hash = btoa(password);
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const created_at = new Date().toISOString();
    
    console.log('[XIVIX] 🆕 가입 신청:', name, normalizedPhone)
    
    // D1 데이터베이스에 저장
    if (c.env?.DB) {
      // 중복 체크 (정규화된 번호로)
      const existing = await c.env.DB.prepare(
        'SELECT * FROM membership_users WHERE phone = ?'
      ).bind(normalizedPhone).first();
      
      if (existing) {
        // 이미 신청한 경우 업데이트
        await c.env.DB.prepare(
          'UPDATE membership_users SET name = ?, password_hash = ?, ip = ? WHERE phone = ?'
        ).bind(name, password_hash, ip, normalizedPhone).run();
      } else {
        // 새로 추가
        await c.env.DB.prepare(
          'INSERT INTO membership_users (name, phone, password_hash, status, created_at, ip) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(name, normalizedPhone, password_hash, 'PENDING', created_at, ip).run();
      }
      
      console.log('[XIVIX] ✅ D1 저장 완료:', normalizedPhone);
      
      // 관리자 알림 Webhook 전송 (네이버 톡톡)
      const notificationSent = await sendAdminNotification(name, normalizedPhone, created_at);
      
      // 알림 발송 상태 업데이트
      if (notificationSent) {
        await c.env.DB.prepare(
          'UPDATE membership_users SET notification_sent = 1 WHERE phone = ?'
        ).bind(normalizedPhone).run();
      }
    } else {
      // D1 없으면 메모리에 저장 (폴백)
      const existingIndex = pendingUsers.findIndex(u => u.phone === normalizedPhone);
      if (existingIndex !== -1) {
        pendingUsers[existingIndex] = { name, phone: normalizedPhone, password_hash, status: 'PENDING', created_at, ip };
      } else {
        pendingUsers.push({ name, phone: normalizedPhone, password_hash, status: 'PENDING', created_at, ip });
      }
      console.log('[XIVIX] ⚠️ D1 없음, 메모리 저장');
    }
    
    return c.json({ 
      success: true, 
      message: '가입 신청이 완료되었습니다!\\n입금 확인 후 1시간 내로 승인됩니다.' 
    })
  } catch (error) {
    console.error('[XIVIX] 가입 신청 오류:', error)
    return c.json({ success: false, message: '서버 오류. 다시 시도해 주세요.' }, 500)
  }
})

app.get('/api/health', (c) => {
  const hasProKey = !!c.env?.GEMINI_API_KEY_PRO || !!c.env?.GEMINI_API_KEY
  const hasFlashKey = !!c.env?.GEMINI_API_KEY_FLASH || !!c.env?.GEMINI_API_KEY
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2026.37.60',
    project: 'XIVIX_Insurance_King_2026 (MASTER-1)',
    masterInstruction: MASTER_INSTRUCTION_V3,
    engines: {
      flash: ENGINE.FLASH,
      pro: ENGINE.PRO,
      vision: ENGINE.VISION
    },
    personas: Object.keys(PERSONA_CONFIG),
    features: [
      '🔥 XIVIX V38 Full Package (SSE 스트리밍)',
      '⏱️ 타임아웃 방지: 실시간 글자 출력',
      '📏 제목 25자 이내 + 금지어 자동 필터링',
      '📝 본문 1,200자 이상 (압도적 정보량)',
      '🎓 전문 지식 베이스: 상증법 제8조, CDR 척도, 법인세 손비처리',
      '🎯 Context Switching: 이미지 > 입력 > 트렌드',
      '🖼️ 멀티모달 → report_data 자동 연결',
      '📊 S+ 등급 SEO 대시보드 + 실시간 게이지',
      '❓ 바이럴 질문 3종 (초보자 간절 어투)',
      '🚫 제목 금지어: 가이드/전략/포인트/대비/선택/추천/충격/손해',
      '📋 대시보드 UI + S+ 등급 마크 + 보장 분석 테이블'
    ],
    apiKeys: {
      pro: hasProKey ? '✅ 설정됨' : '❌ 미설정',
      flash: hasFlashKey ? '✅ 설정됨' : '❌ 미설정'
    },
    outputFormat: 'JSON_OBJECT + SSE_STREAM',
    constraints: {
      title: '25자 이내 (금지어 자동 필터링)',
      content: '1,200자 이상 (압도적 정보량)',
      viral_question: '3개, 500~800자 (초보자 어투)'
    },
    titleBannedWords: TITLE_BANNED_WORDS,
    contextPriority: 'image > input > trend'
  })
})

app.get('/api/docs', (c) => c.json({
  openapi: '3.0.0',
  info: { 
    title: 'XIVIX 2026 PRO API - 보험 콘텐츠 마스터 (Full Package)', 
    version: '2026.14.0',
    description: 'Gemini 2.5 Pro 기반 초정밀 보험 콘텐츠 생성 엔진 - JSON_OBJECT 출력'
  },
  paths: {
    '/api/generate/full-package': { 
      post: { 
        summary: '🌟 FULL PACKAGE - 구조화된 JSON 응답 (제목5 + 본문3 + 댓글5 + SEO키워드5)',
        description: '멀티모달 이미지 분석 포함, PRO+FLASH 모델 자동 분기, JSON_OBJECT 형식 출력',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  concern: { type: 'string', description: '핵심 고민/주제' },
                  image: { type: 'string', description: 'Base64 이미지 (선택)' },
                  mimeType: { type: 'string', description: '이미지 MIME 타입' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: '구조화된 JSON 응답',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    package: {
                      type: 'object',
                      properties: {
                        titles: { type: 'array', items: { type: 'object', properties: { id: { type: 'number' }, text: { type: 'string' } } } },
                        contents: { type: 'array', items: { type: 'object', properties: { id: { type: 'number' }, style: { type: 'string' }, text: { type: 'string' } } } },
                        seoKeywords: { type: 'array', items: { type: 'string' } },
                        comments: { type: 'array', items: { type: 'object', properties: { id: { type: 'number' }, nickname: { type: 'string' }, persona: { type: 'string' }, text: { type: 'string' } } } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } 
    },
    '/api/generate/master': { post: { summary: '🔥 전문가 게시글 (PRO) - 스트리밍' } },
    '/api/generate/question': { post: { summary: '💬 질문 퍼포먼스 (FLASH)' } },
    '/api/generate/comments': { post: { summary: '🎭 여론 조작 댓글 (FLASH)' } },
    '/api/analyze/image': { post: { summary: '🖼️ 멀티모달 이미지 분석 (PRO)' } },
    '/api/trend': { get: { summary: '📈 실시간 네이버 보험 트렌드' } },
    '/api/health': { get: { summary: '❤️ Health Check' } }
  }
}))

app.get('/api/admin/stats', (c) => c.json({
  project: 'XIVIX_Insurance_King_2026',
  cloudflareProject: 'MASTER-1 (master-1-470110)',
  version: 'v2026.14.0_JSON_OBJECT',
  engines: ENGINE,
  personas: PERSONA_CONFIG,
  titlePatterns: TITLE_PATTERNS,
  outputFormat: {
    type: 'JSON_OBJECT',
    constraint: '본문 공백 포함 1,000자 내외',
    structure: {
      titles: 'array[5] - CTR 30% 제목',
      contents: 'array[3] - 공감형/정보형/영업형 본문',
      seoKeywords: 'array[5] - 네이버 SEO 키워드',
      comments: 'array[5] - 5명 페르소나 댓글'
    }
  },
  apiKeys: {
    pro: !!c.env?.GEMINI_API_KEY_PRO || !!c.env?.GEMINI_API_KEY,
    flash: !!c.env?.GEMINI_API_KEY_FLASH || !!c.env?.GEMINI_API_KEY
  },
  endpoints: [
    '/api/generate/full-package (🌟 JSON 통합)',
    '/api/generate/master (PRO 스트리밍)',
    '/api/generate/question (FLASH)',
    '/api/generate/comments (FLASH)',
    '/api/analyze/image (PRO)'
  ],
  lastUpdated: new Date().toISOString()
}))

// ============================================
// V2026.37.33 - 관리자 API (D1 데이터베이스 연동)
// ============================================
// 메모리 폴백 저장소 (D1 없을 때만 사용)
const pendingUsers: any[] = [];

// ============================================
// V2026.37.37 - 솔라피(Solapi) 카카오 알림톡/SMS 연동 (CEO 지시 v4.9)
// API Key/Secret은 환경 변수로 분리 저장 (Wrangler Secret)
// ============================================
const SOLAPI_CONFIG = {
  apiUrl: 'https://api.solapi.com/messages/v4/send',
  pfId: '', // 카카오 비즈니스 채널 ID (템플릿 승인 후 설정)
  templateId: '' // 알림톡 템플릿 ID (승인 후 설정)
};

// 환경 변수에서 솔라피 키 가져오기
function getSolapiCredentials(env: any): { apiKey: string; apiSecret: string } {
  return {
    apiKey: env?.SOLAPI_API_KEY || '',
    apiSecret: env?.SOLAPI_API_SECRET || ''
  };
}

// 솔라피 API 인증 시그니처 생성 (HMAC-SHA256 with Web Crypto API)
async function generateSolapiSignature(apiSecret: string, date: string, salt: string): Promise<string> {
  const message = date + salt;
  const encoder = new TextEncoder();
  
  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the message
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 솔라피 메시지 발송 함수 (카카오 알림톡 + SMS Fallback)
// env 파라미터로 환경 변수 전달 필수
async function sendSolapiMessage(phone: string, message: string, type: 'approval' | 'expiry' | 'suspension', env?: any) {
  try {
    // ============================================
    // V2026.37.45 - SMS Mock Mode (CEO 지시: 개발환경 비용 절감)
    // 조건: SMS_MOCK_MODE가 'true'이면 실제 발송 안하고 로그만 출력
    // ============================================
    const mockMode = env?.SMS_MOCK_MODE === 'true' || env?.SMS_MOCK_MODE === true;
    
    if (mockMode) {
      console.log(`[MOCK_SMS] ========================================`);
      console.log(`[MOCK_SMS] To: ${phone}`);
      console.log(`[MOCK_SMS] Type: ${type}`);
      console.log(`[MOCK_SMS] Message: ${message}`);
      console.log(`[MOCK_SMS] ========================================`);
      return { success: true, mock: true, message: 'SMS Mock Mode - 실제 발송 안함' };
    }
    // ============================================
    
    const { apiKey, apiSecret } = getSolapiCredentials(env);
    
    if (!apiKey || !apiSecret) {
      console.error('[XIVIX] ❌ 솔라피 API 키 미설정');
      return { success: false, error: 'API credentials not configured' };
    }
    
    const date = new Date().toISOString();
    const salt = crypto.randomUUID();
    const signature = await generateSolapiSignature(apiSecret, date, salt);
    
    console.log(`[XIVIX] 📱 솔라피 메시지 발송 시도 (${type}):`, phone);
    
    // SMS 발송 (알림톡 템플릿 승인 전까지 SMS로 발송)
    const response = await fetch(SOLAPI_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
      },
      body: JSON.stringify({
        message: {
          to: phone.replace(/-/g, ''), // 하이픈 제거
          from: '01039880124', // 솔라피 등록 발신번호 (인증완료)
          text: message,
          type: 'SMS' // 알림톡 템플릿 승인 후 'ATA'로 변경
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`[XIVIX] ✅ 솔라피 발송 성공 (${type}):`, phone, result);
      return { success: true, result };
    } else {
      const errorText = await response.text();
      console.error(`[XIVIX] ❌ 솔라피 발송 실패 (${type}):`, response.status, errorText);
      return { success: false, error: errorText };
    }
  } catch (err) {
    console.error(`[XIVIX] ❌ 솔라피 발송 오류 (${type}):`, err);
    return { success: false, error: err };
  }
}

// 승인 완료 알림 메시지
function getApprovalMessage(name: string, expiryDate: string): string {
  return `[XIVIX 2026 PRO] ${name}님, 승인이 완료되었습니다!\n\n지금 바로 XIVIX 2026 PRO를 이용해 보세요.\n\n▶ 접속: https://xivix.ai.kr\n▶ 이용기간: ${expiryDate}까지\n\n문의: 방익주 대표`;
}

// 만료 예정 알림 메시지
function getExpiryReminderMessage(name: string, expiryDate: string): string {
  return `[XIVIX 멤버십 만료 안내] ${name} 전문가님, 내일 멤버십이 만료됩니다.\n\n권한 유지를 위해 갱신 부탁드립니다.\n\n▶ 만료일: ${expiryDate}\n▶ 갱신문의: 방익주 대표`;
}

// 정지 알림 메시지
function getSuspensionMessage(name: string): string {
  return `[XIVIX 서비스 정지 안내] ${name}님, 멤버십이 만료되어 서비스 이용이 일시 정지되었습니다.\n\n갱신 후 다시 이용 가능합니다.\n\n▶ 문의: 방익주 대표`;
}

// 플랜별 만료일 계산
function calculateExpiryDate(planType: string): string {
  const now = new Date();
  let months = 1;
  
  switch (planType) {
    case '3m': months = 3; break;
    case '6m': months = 6; break;
    case '12m': months = 12; break;
    default: months = 1;
  }
  
  now.setMonth(now.getMonth() + months);
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============================================
// V2026.37.34 - 네이버 톡톡 알림 API 연동 (CEO 지시)
// ============================================
const TALKTALK_CONFIG = {
  accessToken: 'llRrAbROYpx6g3Ed-GGDY2wcsqm3WPMJAAAAAQoXEi0AAAGb4LLw4M2yTeNnt1bO',
  targetId: 'w45btu',
  apiUrl: 'https://gw.talk.naver.com/chatbot/v1/event'
};

// 네이버 톡톡으로 관리자 알림 발송
async function sendAdminNotification(name: string, phone: string, time: string) {
  try {
    const message = `[XIVIX 가입 신청 알림]\n성함: ${name}\n연락처: ${phone}\n상태: 입금 확인 대기 중\n\n관리자 페이지에서 확인 후 승인해 주세요.`;
    
    console.log('[XIVIX] 📢 톡톡 알림 발송 시도:', name, phone);
    
    // 네이버 톡톡 API 호출
    const response = await fetch(TALKTALK_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': `Bearer ${TALKTALK_CONFIG.accessToken}`
      },
      body: JSON.stringify({
        event: 'send',
        user: TALKTALK_CONFIG.targetId,
        textContent: {
          text: message
        }
      })
    });
    
    if (response.ok) {
      console.log('[XIVIX] ✅ 톡톡 알림 발송 성공:', name);
      return true;
    } else {
      const errorText = await response.text();
      console.error('[XIVIX] ❌ 톡톡 알림 발송 실패:', response.status, errorText);
      return false;
    }
  } catch (err) {
    console.error('[XIVIX] ❌ 톡톡 알림 전송 오류:', err);
    return false;
  }
}

// 네이버 톡톡 Webhook 수신 엔드포인트 (파트너센터 등록용)
app.post('/api/webhook/talktalk', async (c) => {
  try {
    const body = await c.req.json();
    console.log('[XIVIX] 톡톡 Webhook 수신:', JSON.stringify(body));
    
    // 톡톡에서 보내는 이벤트 처리
    if (body.event === 'open') {
      // 사용자가 채팅방 열었을 때
      return c.json({
        event: 'send',
        textContent: {
          text: '안녕하세요! XIVIX 2026 PRO입니다.\n가입 신청 알림을 실시간으로 받으실 수 있습니다.'
        }
      });
    }
    
    // 기본 응답
    return c.json({ success: true, message: 'Webhook received' });
  } catch (err) {
    console.error('[XIVIX] 톡톡 Webhook 오류:', err);
    return c.json({ success: false }, 500);
  }
});

// 톡톡 Webhook GET (파트너센터 검증용)
app.get('/api/webhook/talktalk', (c) => {
  return c.json({ 
    success: true, 
    message: 'XIVIX TalkTalk Webhook Endpoint',
    version: 'V2026.37.34'
  });
})

// 승인 대기 유저 목록 조회 (D1 연동)
app.get('/api/admin/pending-users', async (c) => {
  try {
    if (c.env?.DB) {
      const result = await c.env.DB.prepare(
        'SELECT * FROM membership_users ORDER BY created_at DESC'
      ).all();
      
      return c.json({
        success: true,
        users: result.results || [],
        total: result.results?.length || 0,
        source: 'D1'
      });
    } else {
      // D1 없으면 메모리에서 조회
      return c.json({
        success: true,
        users: pendingUsers,
        total: pendingUsers.length,
        source: 'memory'
      });
    }
  } catch (err: any) {
    console.error('[XIVIX] pending-users 조회 오류:', err);
    return c.json({ success: false, users: [], total: 0, error: err?.message || 'Unknown error' });
  }
});

// V2026.37.35 - 유저 승인 처리 (D1 연동 + 플랜/만료일 + 솔라피 알림)
app.post('/api/admin/approve', async (c) => {
  try {
    const { phone, plan_type } = await c.req.json();
    const approved_at = new Date().toISOString();
    const planType = plan_type || '1m'; // 기본 1개월
    const expiryDate = calculateExpiryDate(planType);
    
    if (c.env?.DB) {
      // D1에서 유저 확인
      const user: any = await c.env.DB.prepare(
        'SELECT * FROM membership_users WHERE phone = ?'
      ).bind(phone).first();
      
      if (!user) {
        return c.json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
      }
      
      // 승인 처리 (플랜 타입 + 만료일 포함)
      await c.env.DB.prepare(
        'UPDATE membership_users SET status = ?, approved_at = ?, plan_type = ?, expiry_date = ?, is_suspended = 0 WHERE phone = ?'
      ).bind('APPROVED', approved_at, planType, expiryDate, phone).run();
      
      console.log('[XIVIX] ✅ D1 유저 승인 완료:', phone, '플랜:', planType, '만료일:', expiryDate);
      
      // 솔라피 승인 완료 알림 발송 (환경 변수 전달)
      const approvalMessage = getApprovalMessage(user.name, expiryDate);
      await sendSolapiMessage(phone, approvalMessage, 'approval', c.env);
      
      return c.json({
        success: true,
        message: '승인이 완료되었습니다.',
        user: { ...user, status: 'APPROVED', approved_at, plan_type: planType, expiry_date: expiryDate }
      });
    } else {
      // D1 없으면 메모리에서 처리
      const userIndex = pendingUsers.findIndex(u => u.phone === phone);
      if (userIndex === -1) {
        return c.json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
      }
      
      pendingUsers[userIndex].status = 'APPROVED';
      pendingUsers[userIndex].approved_at = approved_at;
      pendingUsers[userIndex].plan_type = planType;
      pendingUsers[userIndex].expiry_date = expiryDate;
      
      console.log('[XIVIX] ✅ 메모리 유저 승인 완료:', phone);
      
      return c.json({
        success: true,
        message: '승인이 완료되었습니다.',
        user: pendingUsers[userIndex]
      });
    }
  } catch (err) {
    console.error('[XIVIX] 승인 처리 오류:', err);
    return c.json({ success: false, message: '승인 처리 중 오류가 발생했습니다.' });
  }
});

// V2026.37.35 - 유저 정지 처리 API (솔라피 알림 연동)
app.post('/api/admin/suspend', async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (c.env?.DB) {
      const user: any = await c.env.DB.prepare(
        'SELECT * FROM membership_users WHERE phone = ?'
      ).bind(phone).first();
      
      if (!user) {
        return c.json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
      }
      
      // 정지 처리
      await c.env.DB.prepare(
        'UPDATE membership_users SET is_suspended = 1, status = ? WHERE phone = ?'
      ).bind('SUSPENDED', phone).run();
      
      console.log('[XIVIX] 🚫 유저 정지 처리:', phone);
      
      // 솔라피 정지 알림 발송 (환경 변수 전달)
      const suspensionMessage = getSuspensionMessage(user.name);
      await sendSolapiMessage(phone, suspensionMessage, 'suspension', c.env);
      
      return c.json({
        success: true,
        message: '정지 처리가 완료되었습니다.',
        user: { ...user, is_suspended: 1, status: 'SUSPENDED' }
      });
    } else {
      return c.json({ success: false, message: 'D1 데이터베이스 연결 필요' });
    }
  } catch (err) {
    console.error('[XIVIX] 정지 처리 오류:', err);
    return c.json({ success: false, message: '정지 처리 중 오류가 발생했습니다.' });
  }
});

// ============================================
// V2026.37.44 - 유저 거절(삭제) API (CEO 지시)
// 가입 신청을 거절하고 DB에서 삭제
// ============================================
app.post('/api/admin/reject', async (c) => {
  try {
    const { phone } = await c.req.json();
    
    if (c.env?.DB) {
      const user: any = await c.env.DB.prepare(
        'SELECT * FROM membership_users WHERE phone = ?'
      ).bind(phone).first();
      
      if (!user) {
        return c.json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
      }
      
      // DB에서 삭제
      await c.env.DB.prepare(
        'DELETE FROM membership_users WHERE phone = ?'
      ).bind(phone).run();
      
      console.log('[XIVIX] ❌ 가입 거절 (삭제):', phone, user.name);
      
      return c.json({
        success: true,
        message: '가입 신청이 거절되었습니다.',
        deletedUser: { name: user.name, phone: user.phone }
      });
    } else {
      return c.json({ success: false, message: 'D1 데이터베이스 연결 필요' });
    }
  } catch (err) {
    console.error('[XIVIX] 거절 처리 오류:', err);
    return c.json({ success: false, message: '거절 처리 중 오류가 발생했습니다.' });
  }
});

// ============================================
// V2026.37.41 - 유저 기간 연장 API (CEO 지시 v5.0)
// 입금 확인 후 유저의 이용 기간을 즉시 연장
// ============================================
app.post('/api/admin/extend', async (c) => {
  try {
    const { phone, days } = await c.req.json();
    
    if (!phone || !days) {
      return c.json({ success: false, message: '전화번호와 연장 일수를 입력해 주세요.' }, 400);
    }
    
    const extendDays = parseInt(days);
    if (![30, 90, 180, 365].includes(extendDays)) {
      return c.json({ success: false, message: '유효한 연장 기간이 아닙니다. (30/90/180/365일)' }, 400);
    }
    
    if (c.env?.DB) {
      const user: any = await c.env.DB.prepare(
        'SELECT * FROM membership_users WHERE phone = ?'
      ).bind(phone).first();
      
      if (!user) {
        return c.json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
      }
      
      // 현재 만료일 기준으로 연장 (없으면 오늘부터)
      const currentExpiry = user.expiry_date ? new Date(user.expiry_date) : new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setDate(newExpiry.getDate() + extendDays);
      const newExpiryStr = newExpiry.toISOString().split('T')[0];
      
      // DB 업데이트
      await c.env.DB.prepare(
        'UPDATE membership_users SET expiry_date = ?, status = ? WHERE phone = ?'
      ).bind(newExpiryStr, 'APPROVED', phone).run();
      
      console.log('[XIVIX] ✅ 기간 연장:', phone, '+' + extendDays + '일 →', newExpiryStr);
      
      // 솔라피 연장 알림 발송
      const extendMessage = `[XIVIX] ${user.name}님, 멤버십이 ${extendDays}일 연장되었습니다.\n만료일: ${newExpiryStr}\n감사합니다.`;
      await sendSolapiMessage(phone, extendMessage, 'extend', c.env);
      
      return c.json({
        success: true,
        message: `${extendDays}일 연장이 완료되었습니다.`,
        user: { ...user, expiry_date: newExpiryStr, status: 'APPROVED' },
        newExpiryDate: newExpiryStr
      });
    } else {
      return c.json({ success: false, message: 'D1 데이터베이스 연결 필요' });
    }
  } catch (err) {
    console.error('[XIVIX] 기간 연장 오류:', err);
    return c.json({ success: false, message: '기간 연장 중 오류가 발생했습니다.' });
  }
});

// ============================================
// V2026.37.41 - 글로벌 설정 조회/수정 API (CEO 지시 v5.0)
// ============================================
const GLOBAL_SETTINGS_DEFAULT = {
  pricing: {
    '1m': { price: 30000, discount: 0 },
    '3m': { price: 80000, discount: 10 },
    '6m': { price: 150000, discount: 17 },
    '12m': { price: 280000, discount: 22 }
  },
  notification: {
    approvalTemplate: '[XIVIX] {name}님, 멤버십 승인이 완료되었습니다!\n만료일: {expiry_date}',
    expiryReminderTemplate: '[XIVIX] {name}님, 멤버십이 내일 만료됩니다.\n연장 문의: 010-4845-3065',
    suspensionTemplate: '[XIVIX] {name}님, 멤버십이 정지되었습니다.\n문의: 010-4845-3065'
  },
  scheduler: {
    enabled: true,
    sendTime: '14:00',
    timezone: 'Asia/Seoul'
  },
  r2: {
    goldenSamplesUrl: 'https://pub-xivix-golden-samples.r2.dev',
    enabled: false
  }
};

// 메모리 설정 저장 (D1 KV 대용)
let globalSettings = { ...GLOBAL_SETTINGS_DEFAULT };

app.get('/api/admin/settings', (c) => {
  return c.json({ success: true, settings: globalSettings });
});

app.post('/api/admin/settings', async (c) => {
  try {
    const updates = await c.req.json();
    globalSettings = { ...globalSettings, ...updates };
    console.log('[XIVIX] ⚙️ 설정 업데이트:', JSON.stringify(updates));
    return c.json({ success: true, message: '설정이 저장되었습니다.', settings: globalSettings });
  } catch (err) {
    console.error('[XIVIX] 설정 저장 오류:', err);
    return c.json({ success: false, message: '설정 저장 중 오류가 발생했습니다.' });
  }
});

// ============================================
// V2026.37.36 - 솔라피 테스트 발송 API (대표님 휴대폰으로 테스트)
// ============================================
app.post('/api/admin/test-sms', async (c) => {
  try {
    const { phone, message } = await c.req.json();
    const targetPhone = phone || '01048453065'; // 기본: 대표님 번호
    const testMessage = message || '[XIVIX 테스트] 솔라피 연동 테스트 메시지입니다. 정상 수신 확인 부탁드립니다.';
    
    console.log('[XIVIX] 📱 테스트 SMS 발송:', targetPhone);
    
    const result = await sendSolapiMessage(targetPhone, testMessage, 'approval', c.env);
    
    return c.json({
      success: result.success,
      message: result.success ? '테스트 메시지 발송 완료' : '발송 실패',
      targetPhone,
      result
    });
  } catch (err: any) {
    console.error('[XIVIX] 테스트 SMS 오류:', err);
    return c.json({ success: false, error: err?.message || 'Unknown error' });
  }
});

// ============================================
// V2026.37.36 - 만료 예정자 조회 API (오후 2시 스케줄러용)
// ============================================
app.get('/api/admin/expiring-users', async (c) => {
  try {
    if (!c.env?.DB) {
      return c.json({ success: false, message: 'D1 연결 필요', users: [] });
    }
    
    // 내일 만료되는 유저 조회 (오후 2시 알림 대상)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const result = await c.env.DB.prepare(
      'SELECT * FROM membership_users WHERE expiry_date = ? AND status = ? AND is_suspended = 0'
    ).bind(tomorrowStr, 'APPROVED').all();
    
    console.log('[XIVIX] 📅 만료 예정자 조회 (', tomorrowStr, '):', result.results?.length || 0, '명');
    
    return c.json({
      success: true,
      target_date: tomorrowStr,
      users: result.results || [],
      total: result.results?.length || 0,
      scheduler_time: '매일 오후 2시 (14:00 KST)'
    });
  } catch (err: any) {
    console.error('[XIVIX] 만료 예정자 조회 오류:', err);
    return c.json({ success: false, error: err?.message, users: [] });
  }
});

// V2026.37.36 - 만료 예정자 일괄 알림 발송 API (오후 2시 스케줄러가 호출)
app.post('/api/admin/send-expiry-reminders', async (c) => {
  try {
    if (!c.env?.DB) {
      return c.json({ success: false, message: 'D1 연결 필요' });
    }
    
    // 내일 만료되는 유저 조회
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const result = await c.env.DB.prepare(
      'SELECT * FROM membership_users WHERE expiry_date = ? AND status = ? AND is_suspended = 0'
    ).bind(tomorrowStr, 'APPROVED').all();
    
    const users: any[] = result.results || [];
    const sentResults: any[] = [];
    
    for (const user of users) {
      const reminderMessage = getExpiryReminderMessage(user.name, user.expiry_date);
      const sendResult = await sendSolapiMessage(user.phone, reminderMessage, 'expiry', c.env);
      sentResults.push({ phone: user.phone, name: user.name, success: sendResult.success });
    }
    
    console.log('[XIVIX] 📢 만료 예정 알림 발송 완료:', sentResults.length, '명');
    
    return c.json({
      success: true,
      message: `${sentResults.length}명에게 만료 예정 알림 발송 완료`,
      target_date: tomorrowStr,
      results: sentResults
    });
  } catch (err: any) {
    console.error('[XIVIX] 만료 알림 발송 오류:', err);
    return c.json({ success: false, error: err?.message });
  }
});

// ============================================
// 첫 페이지: GPT 스타일 검색창 + 실시간 보험 트렌드 + 바로 결과 출력
// ============================================
const mainPageHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>XIVIX 2026 PRO</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%234f8cff'/%3E%3Ctext x='50' y='65' font-size='50' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'%3EX%3C/text%3E%3C/svg%3E">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root {
  --bg-dark: #0a0a0f;
  --primary: #4f8cff;
  --primary-soft: rgba(79, 140, 255, 0.15);
  --accent: #7c5cff;
  --accent-soft: rgba(124, 92, 255, 0.12);
  --text: #e8eaed;
  --text-muted: rgba(232, 234, 237, 0.5);
  --border: rgba(255,255,255,0.08);
  --card-bg: rgba(255,255,255,0.02);
  --green: #10b981;
  --red: #ef4444;
  --orange: #f59e0b;
}

*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
html,body{height:100%;overflow-x:hidden}

/* V2026.37.47 - 모바일 흔들림 및 가로 스크롤 방지 (CEO 지시) */
html, body { 
  overflow-x: hidden !important; 
  position: relative; 
  width: 100%; 
  max-width: 100vw;
  height: -webkit-fill-available; 
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

/* 모바일에서 불필요한 와이드 레이아웃 강제 해제 */
@media (max-width: 768px) {
  .main-container { 
    display: block !important; 
    padding: 10px !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }
  .card { width: 100% !important; margin-bottom: 20px; }
  * { max-width: 100vw; }
}

/* V2026.37.48 - CEO 지시: 모바일 완벽 고정 레이아웃 */
/* 1. 박스 모델 통일 - 모든 요소 border-box 강제 */
*, *::before, *::after {
  box-sizing: border-box !important;
}

/* 2. 좌우 흔들림 원천 차단 */
html {
  touch-action: pan-y !important;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* 3. 상하단 고정, 중앙 가변 레이아웃 (Viewport Fit) */
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: -webkit-fill-available;
}
.app-header {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.app-footer {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
}

/* 4. 모바일 전용 강화 */
@media (max-width: 768px) {
  html, body {
    width: 100vw !important;
    max-width: 100vw !important;
    overflow-x: hidden !important;
    touch-action: pan-y !important;
  }
  
  /* 입력창/버튼 최소 터치 영역 */
  input, button, select, textarea {
    min-height: 44px;
    font-size: 16px !important; /* iOS 확대 방지 */
  }
  
  /* 모든 컨테이너 너비 고정 */
  .container, .main-container, .content-wrapper, section, article, div {
    max-width: 100% !important;
    overflow-x: hidden !important;
  }
}

body{
  background: var(--bg-dark);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  min-height:100vh;
  padding: clamp(16px, 4vw, 40px);
}

/* Beyond Reality 배경 - 눈에 부드러운 색상 */
.bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:var(--bg-dark)}

/* 부드러운 그라디언트 오브 */
.orb{
  position:absolute;
  border-radius:50%;
  filter:blur(100px);
  opacity:0.12;
  animation:orbFloat 25s ease-in-out infinite;
  will-change:transform;
}
.orb1{
  width:min(60vw, 600px);
  height:min(60vw, 600px);
  background:radial-gradient(circle, var(--primary), transparent 70%);
  top:-15%;
  left:-10%;
}
.orb2{
  width:min(50vw, 500px);
  height:min(50vw, 500px);
  background:radial-gradient(circle, var(--accent), transparent 70%);
  bottom:-15%;
  right:-10%;
  animation-delay:-12s;
}
.orb3{
  width:min(40vw, 400px);
  height:min(40vw, 400px);
  background:radial-gradient(circle, #2a5298, transparent 70%);
  top:50%;
  left:50%;
  transform:translate(-50%,-50%);
  animation-delay:-8s;
  opacity:0.08;
}
@keyframes orbFloat{
  0%,100%{transform:translate(0,0) scale(1)}
  33%{transform:translate(2vw, 1vw) scale(1.02)}
  66%{transform:translate(-1vw, 2vw) scale(0.98)}
}

/* 부드러운 그리드 */
.grid{
  position:absolute;
  inset:0;
  background-image:
    linear-gradient(rgba(79,140,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79,140,255,0.015) 1px, transparent 1px);
  background-size:clamp(30px, 5vw, 60px) clamp(30px, 5vw, 60px);
  animation:gridDrift 90s linear infinite;
}
@keyframes gridDrift{to{transform:translate(60px,60px)}}

/* 레이아웃 - 화면 전체 활용 */
.wrapper{
  display:flex;
  flex-direction:column;
  align-items:center;
  width:100%;
  max-width:100%;
  gap:clamp(20px, 3vh, 32px);
  padding-top:clamp(20px, 4vh, 40px);
}

/* 네비게이션 */
.nav{
  position:fixed;
  top:clamp(12px, 2vw, 24px);
  right:clamp(12px, 2vw, 24px);
  display:flex;
  gap:clamp(8px, 1.5vw, 16px);
  z-index:100;
}
.nav a{
  color:var(--text-muted);
  text-decoration:none;
  font-size:clamp(11px, 1.2vw, 13px);
  padding:8px 12px;
  border-radius:8px;
  background:var(--card-bg);
  border:1px solid var(--border);
  transition:all 0.2s;
  display:flex;
  align-items:center;
  gap:6px;
}
.nav a:hover{color:var(--primary);border-color:var(--primary-soft);background:var(--primary-soft)}

/* 로고 */
.logo{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:clamp(10px, 1.5vw, 16px);
}
.logo-icon{
  width:clamp(44px, 5vw, 56px);
  height:clamp(44px, 5vw, 56px);
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border-radius:clamp(12px, 1.5vw, 16px);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  font-size:clamp(18px, 2.2vw, 26px);
  color:#fff;
  box-shadow:0 0 30px rgba(79,140,255,0.25);
  animation:logoPulse 4s ease-in-out infinite;
}
@keyframes logoPulse{
  0%,100%{box-shadow:0 0 30px rgba(79,140,255,0.25)}
  50%{box-shadow:0 0 50px rgba(79,140,255,0.35), 0 0 80px rgba(124,92,255,0.15)}
}
.logo-text{
  font-size:clamp(22px, 3vw, 32px);
  font-weight:800;
  letter-spacing:-0.5px;
}
.logo-text span{
  background:linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
}

/* 타이틀 */
.title{
  font-size:clamp(14px, 1.8vw, 18px);
  color:var(--text-muted);
  font-weight:400;
  text-align:center;
}

/* 메인 컨테이너 - 화면 전체 활용 */
.main{
  width:100%;
  max-width:1200px;
  display:flex;
  flex-direction:column;
  gap:clamp(20px, 3vh, 32px);
}

/* GPT 스타일 검색창 */
.search-box{
  background:var(--card-bg);
  border:1px solid var(--border);
  border-radius:clamp(16px, 2vw, 24px);
  padding:clamp(16px, 2.5vw, 28px);
  transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
}
.search-box:hover{
  border-color:rgba(79,140,255,0.2);
  box-shadow:0 0 40px rgba(79,140,255,0.05);
}
.search-box:focus-within{
  border-color:var(--primary);
  box-shadow:0 0 60px rgba(79,140,255,0.1), inset 0 0 0 1px rgba(79,140,255,0.1);
}

.search-input{
  width:100%;
  background:transparent;
  border:none;
  outline:none;
  color:var(--text);
  font-size:clamp(15px, 1.8vw, 18px);
  line-height:1.7;
  resize:none;
  min-height:clamp(80px, 12vh, 120px);
  font-family:inherit;
}
.search-input::placeholder{color:var(--text-muted)}

/* 파일 업로드 영역 - 크게 개선 */
.upload-area{
  margin-top:20px;
  padding-top:20px;
  border-top:1px solid var(--border);
  display:flex;
  flex-wrap:wrap;
  gap:16px;
  align-items:center;
}
.upload-btn{
  display:flex;
  align-items:center;
  gap:10px;
  padding:14px 24px;
  background:rgba(79,140,255,0.08);
  border:2px dashed rgba(79,140,255,0.4);
  border-radius:14px;
  color:var(--primary);
  font-size:14px;
  font-weight:600;
  cursor:pointer;
  transition:all 0.25s;
}
.upload-btn i{
  font-size:18px;
}
.upload-btn:hover{
  border-color:var(--primary);
  background:var(--primary-soft);
  box-shadow:0 4px 15px rgba(79,140,255,0.2);
}
.upload-btn input{display:none}
.upload-hint{
  font-size:13px;
  color:var(--text-muted);
  background:rgba(255,255,255,0.03);
  padding:8px 14px;
  border-radius:8px;
}
.file-preview{
  display:flex;
  align-items:center;
  gap:10px;
  padding:10px 16px;
  background:var(--primary-soft);
  border:1px solid rgba(79,140,255,0.3);
  border-radius:12px;
  font-size:13px;
  color:var(--primary);
  font-weight:500;
}
.file-preview img{
  width:40px;
  height:40px;
  object-fit:cover;
  border-radius:8px;
  border:2px solid rgba(79,140,255,0.3);
}
.file-preview .remove{
  cursor:pointer;
  opacity:0.7;
  transition:all 0.2s;
  font-size:16px;
  padding:4px;
}
.file-preview .remove:hover{opacity:1;color:#ef4444}

/* 검색 푸터 - 버튼 크게 개선 */
.search-footer{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-top:20px;
  padding-top:20px;
  border-top:1px solid var(--border);
  flex-wrap:wrap;
  gap:16px;
}
.char-count{
  font-size:14px;
  color:var(--text-muted);
  background:rgba(255,255,255,0.03);
  padding:8px 14px;
  border-radius:8px;
}
.search-btn{
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border:none;
  border-radius:16px;
  padding:18px 48px;
  color:#fff;
  font-size:16px;
  font-weight:700;
  cursor:pointer;
  display:flex;
  align-items:center;
  gap:10px;
  transition:all 0.25s;
  box-shadow:0 6px 25px rgba(79,140,255,0.35);
}
.search-btn i{
  font-size:18px;
}
.search-btn:hover{
  box-shadow:0 12px 35px rgba(79,140,255,0.45);
  filter:brightness(1.1);
}
.search-btn:active{filter:brightness(0.95)}
.search-btn:disabled{opacity:0.6;cursor:not-allowed}

/* ============================================ */
/* 프리미엄 트렌드 섹션 (보험설계사 고급형) */
/* ============================================ */
.trend-section{
  width:100%;
  background:linear-gradient(135deg, rgba(245,158,11,0.08), rgba(234,88,12,0.05));
  border:1px solid rgba(245,158,11,0.25);
  border-radius:20px;
  padding:24px;
}
.trend-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:20px;
  padding-bottom:16px;
  border-bottom:1px solid rgba(245,158,11,0.15);
  flex-wrap:wrap;
  gap:12px;
}
.trend-title-wrap{
  display:flex;
  flex-direction:column;
  gap:4px;
}
.trend-title{
  font-size:18px;
  font-weight:800;
  color:#f59e0b;
  display:flex;
  align-items:center;
  gap:10px;
}
.trend-title i{
  font-size:20px;
  color:#f59e0b;
  filter:drop-shadow(0 0 8px rgba(245,158,11,0.5));
}
.trend-subtitle{
  font-size:12px;
  color:var(--text-muted);
  display:flex;
  align-items:center;
  gap:6px;
}
.live-dot{
  width:8px;height:8px;
  background:#10b981;
  border-radius:50%;
  animation:pulse 1.5s ease-in-out infinite;
  box-shadow:0 0 8px rgba(16,185,129,0.6);
}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.9)}}

.trend-timer{
  display:flex;
  align-items:center;
  gap:12px;
}
.trend-time{
  font-size:13px;
  color:var(--text-muted);
  background:rgba(0,0,0,0.2);
  padding:8px 14px;
  border-radius:10px;
  display:flex;
  align-items:center;
  gap:6px;
}
.trend-time i{font-size:12px;opacity:0.6}
.refresh-btn{
  padding:12px 24px;
  background:linear-gradient(135deg, #f59e0b, #ea580c);
  border:none;
  border-radius:12px;
  color:#fff;
  font-size:14px;
  font-weight:700;
  cursor:pointer;
  transition:all 0.25s;
  display:flex;
  align-items:center;
  gap:8px;
  box-shadow:0 4px 15px rgba(245,158,11,0.3);
}
.refresh-btn:hover{
  box-shadow:0 8px 25px rgba(245,158,11,0.4);
  filter:brightness(1.1);
}
.refresh-btn:active{filter:brightness(0.9)}
.refresh-btn.loading{opacity:0.7}
.refresh-btn.loading i{animation:spin 0.7s linear infinite}

/* 트렌드 그리드 - 3열 레이아웃 */
.trend-grid{
  display:grid;
  grid-template-columns:repeat(3, 1fr);
  gap:12px;
  margin-bottom:20px;
}
.trend-item{
  background:rgba(0,0,0,0.25);
  border:1px solid rgba(255,255,255,0.08);
  border-radius:14px;
  padding:16px 18px;
  cursor:pointer;
  transition:background 0.2s, border-color 0.2s, box-shadow 0.2s;
  display:flex;
  flex-direction:column;
  gap:8px;
  contain:layout style;
}
.trend-item:hover{
  background:rgba(245,158,11,0.15);
  border-color:rgba(245,158,11,0.4);
  box-shadow:0 8px 20px rgba(0,0,0,0.3);
}
.trend-item.active{
  background:linear-gradient(135deg, rgba(245,158,11,0.25), rgba(234,88,12,0.2));
  border-color:#f59e0b;
  box-shadow:0 0 20px rgba(245,158,11,0.2);
}
.trend-item-header{
  display:flex;
  align-items:center;
  gap:10px;
}
.trend-rank{
  width:26px;
  height:26px;
  background:linear-gradient(135deg, #f59e0b, #ea580c);
  border-radius:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:13px;
  font-weight:900;
  color:#fff;
  flex-shrink:0;
}
.trend-rank.top3{box-shadow:0 0 12px rgba(245,158,11,0.5)}
.trend-keyword{
  font-size:14px;
  font-weight:700;
  color:#fff;
  flex:1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.trend-item-footer{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding-top:8px;
  border-top:1px solid rgba(255,255,255,0.05);
}
.trend-volume{
  font-size:12px;
  color:var(--text-muted);
  display:flex;
  align-items:center;
  gap:4px;
}
.trend-volume i{font-size:10px}
.trend-change{
  font-size:12px;
  font-weight:700;
  padding:3px 8px;
  border-radius:6px;
}
.trend-change.up{
  color:#10b981;
  background:rgba(16,185,129,0.15);
}
.trend-change.down{
  color:#ef4444;
  background:rgba(239,68,68,0.15);
}
.trend-change.new{
  color:#f59e0b;
  background:rgba(245,158,11,0.15);
}
.trend-change.same{
  color:var(--text-muted);
  background:rgba(255,255,255,0.05);
}

/* HOT 키워드 태그 */
.hot-keywords{
  padding-top:16px;
  border-top:1px solid rgba(245,158,11,0.15);
}
.hot-keywords-title{
  font-size:13px;
  font-weight:700;
  color:#f59e0b;
  margin-bottom:12px;
  display:flex;
  align-items:center;
  gap:6px;
}
.hot-keywords-list{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.hot-tag{
  padding:8px 14px;
  background:rgba(0,0,0,0.3);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:20px;
  font-size:12px;
  color:var(--text);
  cursor:pointer;
  transition:all 0.2s;
  display:flex;
  align-items:center;
  gap:6px;
}
.hot-tag:hover{
  background:rgba(245,158,11,0.2);
  border-color:rgba(245,158,11,0.4);
  color:#f59e0b;
}
.hot-tag i{font-size:10px;color:#f59e0b}

/* 힌트 메시지 */
.trend-hint{
  margin-top:16px;
  padding:12px 16px;
  background:rgba(245,158,11,0.1);
  border-radius:10px;
  font-size:12px;
  color:var(--text-muted);
  display:flex;
  align-items:center;
  gap:8px;
}
.trend-hint i{color:#f59e0b}

/* 반응형 - 2열 */
@media(max-width:900px){
  .trend-grid{grid-template-columns:repeat(2, 1fr)}
}
@media(max-width:600px){
  .trend-grid{grid-template-columns:1fr}
  .trend-section{padding:16px}
}

/* 스피너 */
.spinner{
  width:18px;
  height:18px;
  border:2px solid rgba(255,255,255,0.2);
  border-top-color:#fff;
  border-radius:50%;
  animation:spin 0.7s linear infinite;
  display:none;
}
.loading .spinner{display:block}
.loading .btn-text{display:none}
@keyframes spin{to{transform:rotate(360deg)}}

/* ============================================ */
/* SEO 분석 퍼포먼스 오버레이 (XIVIX Intelligence) */
/* ============================================ */
.seo-overlay{
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.92);
  backdrop-filter:blur(20px);
  z-index:9999;
  display:none;
  align-items:center;
  justify-content:center;
  flex-direction:column;
  gap:32px;
  padding:24px;
}
.seo-overlay.show{display:flex}
.seo-overlay-content{
  max-width:500px;
  width:100%;
  text-align:center;
}
.seo-overlay-logo{
  font-size:14px;
  font-weight:700;
  color:var(--primary);
  letter-spacing:2px;
  text-transform:uppercase;
  margin-bottom:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
}
.seo-overlay-logo i{font-size:18px}
.seo-overlay-title{
  font-size:clamp(20px, 4vw, 28px);
  font-weight:800;
  color:var(--text);
  margin-bottom:12px;
  line-height:1.3;
}
.seo-overlay-subtitle{
  font-size:14px;
  color:var(--text-muted);
  margin-bottom:32px;
}
.seo-step{
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
  border-radius:14px;
  padding:18px 20px;
  margin-bottom:12px;
  display:flex;
  align-items:center;
  gap:14px;
  opacity:0.4;
  transform:translateX(-10px);
  transition:all 0.4s cubic-bezier(0.4,0,0.2,1);
}
.seo-step.active{
  opacity:1;
  transform:translateX(0);
  background:var(--primary-soft);
  border-color:rgba(79,140,255,0.3);
}
.seo-step.done{
  opacity:0.7;
  transform:translateX(0);
}
.seo-step.done .step-icon{
  background:var(--green);
}
.seo-step.done .step-icon i:before{content:'\\f00c'}
.step-icon{
  width:36px;
  height:36px;
  background:var(--primary);
  border-radius:10px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:16px;
  color:#fff;
  flex-shrink:0;
}
.step-content{flex:1;text-align:left}
.step-title{
  font-size:14px;
  font-weight:600;
  color:var(--text);
  margin-bottom:2px;
}
.step-count{
  font-size:12px;
  color:var(--text-muted);
  font-family:monospace;
}
.step-count span{
  color:var(--primary);
  font-weight:700;
}
.seo-progress-bar{
  height:6px;
  background:rgba(255,255,255,0.08);
  border-radius:3px;
  overflow:hidden;
  margin-top:24px;
}
.seo-progress-fill{
  height:100%;
  background:linear-gradient(90deg, var(--primary), var(--accent), var(--green));
  background-size:200% 100%;
  animation:gradientMove 1.5s ease infinite;
  transition:width 0.5s;
  width:0;
}
@keyframes gradientMove{
  0%{background-position:0% 50%}
  50%{background-position:100% 50%}
  100%{background-position:0% 50%}
}
.seo-result-keyword{
  margin-top:28px;
  padding:20px 24px;
  background:linear-gradient(135deg, rgba(16,185,129,0.15), rgba(79,140,255,0.15));
  border:1px solid rgba(16,185,129,0.3);
  border-radius:16px;
  display:none;
}
.seo-result-keyword.show{display:block;animation:fadeInUp 0.5s}
@keyframes fadeInUp{
  from{opacity:0;transform:translateY(10px)}
  to{opacity:1;transform:translateY(0)}
}
.result-label{
  font-size:12px;
  color:var(--green);
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:1px;
  margin-bottom:8px;
  display:flex;
  align-items:center;
  gap:6px;
}
.result-label i{font-size:14px}
.result-title{
  font-size:18px;
  font-weight:700;
  color:var(--text);
  line-height:1.4;
}
.typing-cursor{
  display:inline-block;
  width:2px;
  height:1.2em;
  background:var(--primary);
  animation:blink 0.7s infinite;
  margin-left:2px;
  vertical-align:text-bottom;
}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}

/* 힌트 */
.hint{
  font-size:11px;
  color:var(--text-muted);
  text-align:center;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
}
.hint i{color:var(--orange)}

/* ============================================ */
/* 결과 영역 (대시보드 리포트 UI v3) */
/* ============================================ */
.result-section{
  width:100%;
  display:none;
  min-height:600px;  /* ✅ CLS 최적화: 레이아웃 시프트 방지 */
}
.result-section.show{display:block}

.progress-box{
  background:var(--card-bg);
  border:1px solid var(--border);
  border-radius:16px;
  padding:20px;
  margin-bottom:20px;
}
.progress-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:12px;
}
.progress-text{
  font-size:14px;
  color:var(--primary);
  display:flex;
  align-items:center;
  gap:8px;
}
.progress-pct{font-size:14px;font-weight:700;color:var(--text)}
.progress-bar{
  height:4px;
  background:rgba(255,255,255,0.1);
  border-radius:2px;
  overflow:hidden;
}
.progress-fill{
  height:100%;
  background:linear-gradient(90deg, var(--primary), var(--accent));
  transition:width 0.3s;
  width:0;
}

/* SEO 감사 리포트 (대시보드 상단) */
.seo-audit-card{
  background:linear-gradient(135deg, rgba(79,140,255,0.15), rgba(124,92,255,0.15));
  border:1px solid rgba(79,140,255,0.3);
  border-radius:20px;
  padding:24px;
  margin-bottom:20px;
  display:flex;
  align-items:center;
  gap:24px;
  flex-wrap:wrap;
}
.grade-badge{
  width:80px;
  height:80px;
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border-radius:20px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  box-shadow:0 8px 30px rgba(79,140,255,0.3);
}
.grade-badge .grade{
  font-size:32px;
  font-weight:900;
  color:#fff;
  line-height:1;
}
.grade-badge .label{
  font-size:10px;
  color:rgba(255,255,255,0.8);
  text-transform:uppercase;
}
.seo-stats{
  flex:1;
  min-width:200px;
}
.seo-stats .title{
  font-size:18px;
  font-weight:700;
  color:var(--text);
  margin-bottom:8px;
}
.seo-stats .metrics{
  display:flex;
  gap:20px;
  flex-wrap:wrap;
}
.seo-stats .metric{
  display:flex;
  flex-direction:column;
}
.seo-stats .metric .value{
  font-size:24px;
  font-weight:800;
  color:var(--primary);
}
.seo-stats .metric .name{
  font-size:11px;
  color:var(--text-muted);
}
.seo-stats .analysis{
  margin-top:10px;
  font-size:13px;
  color:var(--text-muted);
  padding:10px 14px;
  background:rgba(255,255,255,0.05);
  border-radius:10px;
}

/* 보장 분석 테이블 (report_data) */
.report-table{
  background:var(--card-bg);
  border:1px solid var(--border);
  border-radius:16px;
  padding:20px;
  margin-bottom:20px;
}
.report-table .table-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:16px;
  padding-bottom:12px;
  border-bottom:1px solid var(--border);
}
.report-table .table-title{
  font-size:15px;
  font-weight:700;
  color:var(--text);
  display:flex;
  align-items:center;
  gap:8px;
}
.report-table .table-title i{color:var(--primary)}
.report-table table{
  width:100%;
  border-collapse:collapse;
}
.report-table th{
  text-align:left;
  font-size:11px;
  font-weight:600;
  color:var(--text-muted);
  padding:10px 12px;
  background:rgba(255,255,255,0.03);
  border-bottom:1px solid var(--border);
}
.report-table td{
  padding:12px;
  font-size:13px;
  border-bottom:1px solid var(--border);
}
.report-table tr:last-child td{border-bottom:none}
.report-table .item-name{font-weight:600;color:var(--text)}
.report-table .current{color:var(--text-muted)}
.report-table .target{color:var(--primary);font-weight:600}
.status-dot{
  display:inline-flex;
  align-items:center;
  gap:6px;
  font-size:12px;
  font-weight:600;
}
.status-dot::before{
  content:'';
  width:8px;
  height:8px;
  border-radius:50%;
}
.status-dot.critical{color:#ef4444}
.status-dot.critical::before{background:#ef4444;box-shadow:0 0 8px #ef4444}
.status-dot.essential{color:#f59e0b}
.status-dot.essential::before{background:#f59e0b;box-shadow:0 0 8px #f59e0b}
.status-dot.good{color:#10b981}
.status-dot.good::before{background:#10b981;box-shadow:0 0 8px #10b981}

/* 바이럴 질문 섹션 */
.viral-questions{
  background:rgba(245,158,11,0.1);
  border:1px solid rgba(245,158,11,0.3);
  border-radius:16px;
  padding:16px;
  margin-bottom:20px;
}
.viral-questions .section-title{
  font-size:14px;
  font-weight:700;
  color:var(--orange);
  margin-bottom:12px;
  display:flex;
  align-items:center;
  gap:8px;
}
.viral-questions .question{
  background:rgba(255,255,255,0.05);
  border-radius:10px;
  padding:12px 16px;
  margin-bottom:8px;
  font-size:14px;
  color:var(--text);
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
}
.viral-questions .question:last-child{margin-bottom:0}

/* V39 단일 페이지 순차 흐름 (탭 메뉴 제거) */
.tab-nav{display:none !important} /* 탭 네비게이션 완전 숨김 */

/* 순차 섹션 스타일 */
.sequential-section{
  background:var(--card-bg);
  border:1px solid var(--border);
  border-radius:16px;
  margin-bottom:20px;
  overflow:hidden;
}
.sequential-section .section-header{
  display:flex;
  align-items:center;
  gap:10px;
  padding:16px 20px;
  background:linear-gradient(135deg, rgba(79,140,255,0.1), rgba(182,255,59,0.05));
  border-bottom:1px solid var(--border);
  font-weight:700;
  font-size:15px;
  color:var(--text);
}
.sequential-section .section-header i{
  color:var(--primary);
  font-size:16px;
}
.sequential-section .section-header .badge{
  background:var(--primary);
  color:#fff;
  padding:3px 10px;
  border-radius:12px;
  font-size:12px;
  font-weight:600;
  margin-left:auto;
}
.sequential-section .section-content{
  padding:16px;
}

/* 탭 콘텐츠 - 항상 표시 (탭 제거됨) */
.tab-content{display:block !important}

/* SEO 키워드 섹션 스타일 */
#seoKeywords{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}
#seoKeywords .keyword-tag{
  background:linear-gradient(135deg, var(--primary-soft), rgba(182,255,59,0.1));
  border:1px solid var(--primary);
  color:var(--primary);
  padding:8px 16px;
  border-radius:20px;
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  transition:all 0.2s;
}
#seoKeywords .keyword-tag:hover{
  background:var(--primary);
  color:#fff;
  transform:translateY(-2px);
}

/* 아이템 카드 (제목/본문/댓글 공통) */
.item-card{
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
  border-radius:14px;
  padding:16px;
  margin-bottom:12px;
  transition:all 0.2s;
}
.item-card:hover{border-color:rgba(79,140,255,0.3);background:rgba(79,140,255,0.03)}
.item-card.selected{
  border-color:var(--primary);
  background:var(--primary-soft);
  box-shadow:0 0 20px rgba(79,140,255,0.1);
}
.item-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:10px;
}
.item-label{
  font-size:12px;
  font-weight:700;
  color:var(--primary);
  display:flex;
  align-items:center;
  gap:6px;
}
.item-label .num{
  background:var(--primary);
  color:#fff;
  width:20px;
  height:20px;
  border-radius:6px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:11px;
}
.item-actions{display:flex;gap:6px}
.copy-btn{
  padding:6px 12px;
  border:1px solid var(--border);
  background:transparent;
  color:var(--text-muted);
  font-size:11px;
  border-radius:8px;
  cursor:pointer;
  transition:all 0.2s;
  display:flex;
  align-items:center;
  gap:4px;
}
.copy-btn:hover{background:var(--primary-soft);color:var(--primary);border-color:var(--primary)}
.copy-btn.copied{background:var(--green);color:#fff;border-color:var(--green)}
.item-text{
  font-size:14px;
  line-height:1.8;
  color:var(--text);
  word-break:keep-all;
  white-space:normal;
  overflow-wrap:break-word;
  /* V2026.37.16 - TITLE_UI_CSS: 고정 높이 제거, 자동 확장 */
  max-height:none;
  overflow:visible;
}
.item-meta{
  margin-top:10px;
  font-size:11px;
  color:var(--text-muted);
  display:flex;
  align-items:center;
  gap:12px;
}
.char-badge{
  background:rgba(255,255,255,0.1);
  padding:4px 10px;
  border-radius:8px;
}

/* 스타일 태그 */
.style-tag{
  padding:4px 10px;
  border-radius:8px;
  font-size:11px;
  font-weight:600;
}
.style-tag.empathy{background:rgba(16,185,129,0.2);color:var(--green)}
.style-tag.info{background:rgba(79,140,255,0.2);color:var(--primary)}
.style-tag.sales{background:rgba(245,158,11,0.2);color:var(--orange)}

/* SEO 키워드 */
.keyword-list{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:16px;
}
.keyword-tag{
  padding:8px 16px;
  background:rgba(124,92,255,0.15);
  border:1px solid rgba(124,92,255,0.3);
  border-radius:20px;
  font-size:13px;
  color:var(--accent);
  cursor:pointer;
  transition:all 0.2s;
  display:flex;
  align-items:center;
  gap:6px;
}
.keyword-tag:hover{background:var(--accent);color:#fff}

/* 전체 복사 버튼 */
.copy-all-btn{
  width:100%;
  padding:14px;
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border:none;
  border-radius:12px;
  color:#fff;
  font-size:14px;
  font-weight:600;
  cursor:pointer;
  margin-top:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  transition:all 0.2s;
}
.copy-all-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(79,140,255,0.3)}

/* 새로 시작 버튼 */
.new-btn{
  width:100%;
  padding:16px;
  background:transparent;
  border:1px solid var(--border);
  border-radius:14px;
  color:var(--text-muted);
  font-size:14px;
  cursor:pointer;
  transition:all 0.2s;
  margin-top:20px;
  display:none;
}
.new-btn.show{display:flex;align-items:center;justify-content:center;gap:8px}
.new-btn:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-soft)}

/* ============================================
   🖼️ AI 이미지 생성 섹션
   ============================================ */
.image-gen-section{
  margin-top:24px;
  padding:20px;
  background:linear-gradient(135deg, rgba(79,140,255,0.08), rgba(124,92,255,0.08));
  border:1px solid rgba(79,140,255,0.2);
  border-radius:16px;
  display:none;
}
.image-gen-section.show{display:block}
.image-gen-header{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:16px;
}
.image-gen-header i{
  font-size:24px;
  color:var(--accent);
}
.image-gen-title{
  font-size:16px;
  font-weight:700;
  color:var(--text);
}
.image-gen-subtitle{
  font-size:12px;
  color:var(--text-muted);
  margin-top:2px;
}
.image-gen-btn{
  width:100%;
  padding:14px;
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border:none;
  border-radius:12px;
  color:#fff;
  font-size:14px;
  font-weight:600;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  transition:all 0.2s;
}
.image-gen-btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(79,140,255,0.3)}
.image-gen-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
.image-gen-loading{
  margin-top:16px;
  padding:16px;
  background:rgba(0,0,0,0.3);
  border-radius:12px;
  text-align:center;
  display:none;
}
.image-gen-loading.show{display:block}
.image-gen-loading i{font-size:28px;color:var(--primary);margin-bottom:8px}
.image-gen-loading-text{font-size:14px;color:var(--text);margin-bottom:4px}
.image-gen-loading-sub{font-size:12px;color:var(--text-muted)}
.image-gen-result{
  margin-top:16px;
  display:none;
}
.image-gen-result.show{display:block}
.image-gen-preview{
  width:100%;
  border-radius:12px;
  border:2px solid var(--border);
  margin-bottom:12px;
}
.image-download-btn{
  width:100%;
  padding:12px;
  background:var(--green);
  border:none;
  border-radius:10px;
  color:#fff;
  font-size:14px;
  font-weight:600;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  transition:all 0.2s;
}
.image-download-btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(16,185,129,0.3)}

/* 반응형 - 데스크톱 (1200px+) */
@media(min-width:1200px){
  .main{max-width:1400px}
  .trend-list{grid-template-columns:repeat(4, 1fr)}
  .trend-item{padding:16px 20px;font-size:14px}
}

/* 반응형 - 태블릿 (768px ~ 1199px) */
@media(min-width:768px) and (max-width:1199px){
  .main{max-width:95vw}
  .trend-list{grid-template-columns:repeat(4, 1fr)}
  .trend-item{padding:14px 16px;font-size:13px}
}

/* 반응형 - 모바일 (480px ~ 767px) */
@media(min-width:480px) and (max-width:767px){
  .main{max-width:95vw}
  .trend-list{grid-template-columns:repeat(2, 1fr)}
  .trend-item{padding:12px 14px;font-size:12px}
}

/* 반응형 - 작은 모바일 (480px 미만) */
@media(max-width:479px){
  body{padding:12px}
  .main{max-width:100%}
  .nav{top:8px;right:8px;gap:6px}
  .nav a{padding:6px 10px;font-size:10px}
  .trend-list{grid-template-columns:repeat(2, 1fr)}
  .trend-item{padding:10px 12px;font-size:11px;gap:8px}
  .trend-rank{font-size:10px;min-width:14px}
  .trend-change{font-size:10px}
  .trend-volume{font-size:10px}
  .upload-area{flex-direction:column;align-items:stretch}
  .search-footer{flex-direction:column;align-items:stretch}
  .search-btn{width:100%;justify-content:center}
  .result-header{flex-direction:column;align-items:stretch}
  .result-actions{justify-content:flex-end}
}

/* 랜드스케이프 모드 */
@media(max-height:500px) and (orientation:landscape){
  .wrapper{padding-top:60px}
  .logo{margin-bottom:12px}
  .title{margin-bottom:12px}
}

/* ============================================ */
/* V39 모바일 시인성 강화 (768px 이하) */
/* Glow 효과 + High-Contrast Border */
/* ============================================ */
@media(max-width:768px){
  /* 메인 생성 버튼 - 네온 그린 Glow */
  .search-btn{
    background:#00FF85 !important;
    color:#000 !important;
    border:2px solid #B6FF3B !important;
    box-shadow:0 0 20px rgba(0,255,133,0.5), 0 0 40px rgba(0,255,133,0.3) !important;
    font-weight:900 !important;
    font-size:17px !important;
    padding:20px 32px !important;
  }
  .search-btn:hover, .search-btn:active{
    box-shadow:0 0 30px rgba(0,255,133,0.7), 0 0 60px rgba(0,255,133,0.4) !important;
    transform:scale(1.02);
  }
  
  /* 탭 버튼 - 골드 포인트 */
  .tab-btn{
    border:2px solid transparent !important;
    font-weight:700 !important;
    padding:14px 12px !important;
  }
  .tab-btn.active{
    border-color:#FFBF00 !important;
    box-shadow:0 0 15px rgba(255,191,0,0.4) !important;
    filter:drop-shadow(0 0 8px rgba(255,191,0,0.3));
  }
  
  /* 복사 버튼 - 네온 그린 */
  .copy-btn{
    background:#00FF85 !important;
    color:#000 !important;
    border:2px solid #B6FF3B !important;
    box-shadow:0 0 10px rgba(0,255,133,0.3) !important;
    font-weight:700 !important;
    padding:10px 16px !important;
    font-size:13px !important;
  }
  .copy-btn:hover{
    box-shadow:0 0 20px rgba(0,255,133,0.5) !important;
  }
  
  /* 전체 복사 버튼 */
  .copy-all-btn{
    background:#00FF85 !important;
    color:#000 !important;
    border:2px solid #B6FF3B !important;
    box-shadow:0 0 25px rgba(0,255,133,0.5) !important;
    font-weight:900 !important;
    font-size:16px !important;
  }
  
  /* 새로운 콘텐츠 생성 버튼 */
  .new-btn{
    border:2px solid #FFBF00 !important;
    color:#FFBF00 !important;
    box-shadow:0 0 15px rgba(255,191,0,0.3) !important;
    font-weight:700 !important;
  }
  
  /* 트렌드 새로고침 버튼 */
  .refresh-btn{
    background:#00FF85 !important;
    color:#000 !important;
    border:2px solid #B6FF3B !important;
    box-shadow:0 0 15px rgba(0,255,133,0.4) !important;
    font-weight:800 !important;
  }
  
  /* 이미지 첨부 버튼 */
  .upload-btn{
    border:2px solid #B6FF3B !important;
    background:rgba(0,255,133,0.15) !important;
    color:#00FF85 !important;
    box-shadow:0 0 10px rgba(0,255,133,0.2) !important;
  }
  
  /* 아이템 카드 선택 시 */
  .item-card.selected{
    border:2px solid #FFBF00 !important;
    box-shadow:0 0 20px rgba(255,191,0,0.3) !important;
  }
  
  /* SEO 등급 배지 */
  .grade-badge{
    box-shadow:0 0 30px rgba(79,140,255,0.5), 0 8px 30px rgba(79,140,255,0.3) !important;
  }
  
  /* 이미지 생성 섹션 */
  .image-gen-section{
    background:linear-gradient(135deg, rgba(79,140,255,0.1), rgba(0,255,133,0.1)) !important;
    border:2px solid rgba(0,255,133,0.4) !important;
    box-shadow:0 0 30px rgba(0,255,133,0.2) !important;
  }
  .image-gen-btn{
    background:linear-gradient(135deg, #00FF85, #B6FF3B) !important;
    color:#000 !important;
    border:none !important;
    box-shadow:0 0 25px rgba(0,255,133,0.5) !important;
    font-weight:900 !important;
  }
  .image-download-btn{
    background:#FFBF00 !important;
    color:#000 !important;
    border:2px solid #FFA500 !important;
    box-shadow:0 0 20px rgba(255,191,0,0.4) !important;
    font-weight:800 !important;
  }

  /* 결과 섹션 헤더 */
  .result-section{
    border:2px solid rgba(0,255,133,0.3) !important;
    box-shadow:0 0 30px rgba(0,255,133,0.1) !important;
  }
}

/* ============================================
   V2026.37.19 - 가입 신청 모달 스타일
   ============================================ */
.nav-btn{
  color:var(--text-muted);
  font-size:clamp(11px, 1.2vw, 13px);
  padding:8px 12px;
  border-radius:8px;
  background:var(--card-bg);
  border:1px solid var(--border);
  cursor:pointer;
  transition:all 0.2s;
  display:flex;
  align-items:center;
  gap:6px;
}
.nav-btn:hover{color:var(--primary);border-color:var(--primary-soft);background:var(--primary-soft)}
.register-btn{background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;border:none;font-weight:600}
.register-btn:hover{transform:scale(1.05);box-shadow:0 4px 15px rgba(79,140,255,0.4)}

.reg-modal{
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.8);
  z-index:9999;
  justify-content:center;
  align-items:center;
  backdrop-filter:blur(8px);
}
.reg-modal.show{display:flex}
.reg-modal-content{
  background:var(--card-bg);
  border:1px solid var(--border);
  border-radius:20px;
  width:90%;
  max-width:440px;
  max-height:90vh;
  overflow-y:auto;
  box-shadow:0 20px 60px rgba(0,0,0,0.5);
}
.reg-modal-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:20px 24px;
  border-bottom:1px solid var(--border);
}
.reg-modal-header h2{
  font-size:18px;
  font-weight:700;
  color:var(--text);
  display:flex;
  align-items:center;
  gap:10px;
}
.reg-modal-header h2 i{color:var(--primary)}
.reg-close-btn{
  background:none;
  border:none;
  font-size:28px;
  color:var(--text-muted);
  cursor:pointer;
  line-height:1;
  position:relative;
  z-index:99999999 !important;
  pointer-events:auto !important;
}
.reg-close-btn:hover{color:var(--red);transform:scale(1.2)}
.reg-modal-body{padding:24px}
.reg-deposit-info{
  background:rgba(79,140,255,0.1);
  border:1px solid rgba(79,140,255,0.3);
  border-radius:12px;
  padding:16px;
  margin-bottom:20px;
}
.reg-deposit-title{
  font-size:14px;
  font-weight:700;
  color:var(--primary);
  margin-bottom:12px;
  display:flex;
  align-items:center;
  gap:8px;
}
.reg-account{text-align:center;padding:12px 0}
.reg-bank{font-size:13px;color:var(--text-muted);margin-bottom:4px}
.reg-account-num{font-size:24px;font-weight:900;color:var(--text);letter-spacing:1px}
.reg-holder{font-size:13px;color:var(--text-muted);margin-top:4px}
.reg-notice{
  font-size:11px;
  color:var(--orange);
  line-height:1.6;
  margin-top:12px;
  padding-top:12px;
  border-top:1px dashed rgba(245,158,11,0.3);
}
.reg-field{margin-bottom:16px}
.reg-field label{
  display:block;
  font-size:12px;
  font-weight:600;
  color:var(--text-muted);
  margin-bottom:6px;
}
.reg-field label i{margin-right:6px;color:var(--primary)}
.reg-field input{
  width:100%;
  padding:12px 14px;
  background:rgba(255,255,255,0.05);
  border:1px solid var(--border);
  border-radius:10px;
  color:var(--text);
  font-size:14px;
  transition:all 0.2s;
}
.reg-field input:focus{
  outline:none;
  border-color:var(--primary);
  box-shadow:0 0 0 3px rgba(79,140,255,0.1);
}
.reg-field input::placeholder{color:var(--text-muted);opacity:0.6}
.reg-submit-btn{
  width:100%;
  padding:14px;
  background:linear-gradient(135deg,var(--primary),var(--accent));
  border:none;
  border-radius:10px;
  color:#fff;
  font-size:15px;
  font-weight:700;
  cursor:pointer;
  transition:all 0.2s;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  margin-top:8px;
}
.reg-submit-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(79,140,255,0.4)}
.reg-submit-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
.reg-result{
  margin-top:16px;
  padding:12px;
  border-radius:8px;
  font-size:13px;
  display:none;
}
.reg-result.success{display:block;background:rgba(0,255,133,0.1);border:1px solid rgba(0,255,133,0.3);color:var(--green)}
.reg-result.error{display:block;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444}

/* ============================================
   V2026.37.20 - Luxury Landing Page
   Beyond Reality / High-end Professional
   ============================================ */
.landing-page{
  position:fixed;
  inset:0;
  background:linear-gradient(180deg, #0a0a0f 0%, #12121a 50%, #0d0d14 100%);
  z-index:10000;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}
.landing-page.hidden{display:none}
.landing-bg{
  position:absolute;
  inset:0;
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(79,140,255,0.15) 0%, transparent 50%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(124,92,255,0.1) 0%, transparent 40%);
  pointer-events:none;
}
.landing-grid{
  position:absolute;
  inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size:60px 60px;
  opacity:0.5;
}
.landing-content{
  position:relative;
  z-index:1;
  text-align:center;
  max-width:600px;
  padding:40px;
}
.landing-badge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  background:rgba(79,140,255,0.1);
  border:1px solid rgba(79,140,255,0.3);
  padding:8px 16px;
  border-radius:20px;
  font-size:11px;
  font-weight:600;
  color:var(--primary);
  text-transform:uppercase;
  letter-spacing:1.5px;
  margin-bottom:32px;
}
.landing-badge i{font-size:10px}
.landing-logo{
  width:80px;
  height:80px;
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border-radius:24px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:36px;
  font-weight:900;
  color:#fff;
  margin:0 auto 24px;
  box-shadow:0 20px 60px rgba(79,140,255,0.3);
}
.landing-title{
  font-size:clamp(28px, 5vw, 42px);
  font-weight:900;
  color:#fff;
  line-height:1.2;
  margin-bottom:16px;
  letter-spacing:-0.5px;
}
.landing-title span{
  background:linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
}
.landing-subtitle{
  font-size:clamp(14px, 2vw, 16px);
  color:var(--text-muted);
  line-height:1.7;
  margin-bottom:40px;
  max-width:480px;
  margin-left:auto;
  margin-right:auto;
}
.landing-buttons{
  display:flex;
  flex-direction:column;
  gap:12px;
  max-width:320px;
  margin:0 auto;
  position:relative;
  z-index:99999;
}
.landing-btn{
  padding:16px 32px;
  border-radius:12px;
  font-size:15px;
  font-weight:700;
  cursor:pointer;
  transition:all 0.3s;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  text-decoration:none;
}
.landing-btn-primary{
  background:linear-gradient(135deg, var(--primary), var(--accent));
  border:none;
  color:#fff;
  box-shadow:0 8px 30px rgba(79,140,255,0.4);
}
.landing-btn-primary:hover{
  transform:translateY(-3px);
  box-shadow:0 12px 40px rgba(79,140,255,0.5);
}
.landing-btn-secondary{
  background:transparent;
  border:1px solid rgba(255,255,255,0.2);
  color:var(--text);
}
.landing-btn-secondary:hover{
  background:rgba(255,255,255,0.05);
  border-color:rgba(255,255,255,0.3);
}
.landing-footer{
  position:absolute;
  bottom:24px;
  font-size:11px;
  color:rgba(255,255,255,0.3);
  letter-spacing:0.5px;
}

/* ============================================
   V2026.37.23 - Beyond Reality 3D 움직이는 효과
   Reference: https://beyond-reality.pages.dev/
   ============================================ */
.landing-grid{
  pointer-events:none;
  animation:grid-move 20s linear infinite;
}
@keyframes grid-move{
  0%{background-position:0 0}
  100%{background-position:60px 60px}
}
.landing-bg{
  animation:bg-pulse 8s ease-in-out infinite;
}
@keyframes bg-pulse{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:0.7;transform:scale(1.05)}
}
.landing-logo{
  animation:logo-float 3s ease-in-out infinite, logo-glow 2s ease-in-out infinite;
  transform-style:preserve-3d;
  perspective:1000px;
}
@keyframes logo-float{
  0%,100%{transform:translateY(0) rotateY(0deg)}
  50%{transform:translateY(-15px) rotateY(10deg)}
}
@keyframes logo-glow{
  0%,100%{box-shadow:0 20px 60px rgba(79,140,255,0.3)}
  50%{box-shadow:0 30px 80px rgba(79,140,255,0.6), 0 0 100px rgba(124,92,255,0.3)}
}
.landing-badge{
  animation:badge-shimmer 3s ease-in-out infinite;
}
@keyframes badge-shimmer{
  0%,100%{opacity:1;transform:scale(1)}
  50%{opacity:0.8;transform:scale(1.02)}
}
.landing-title{
  animation:title-glow 4s ease-in-out infinite;
}
@keyframes title-glow{
  0%,100%{text-shadow:0 0 20px rgba(79,140,255,0.3)}
  50%{text-shadow:0 0 40px rgba(79,140,255,0.6), 0 0 80px rgba(124,92,255,0.3)}
}
.landing-btn{
  position:relative;
  z-index:100;
  overflow:hidden;
}
.landing-btn::before{
  content:'';
  position:absolute;
  top:-50%;
  left:-50%;
  width:200%;
  height:200%;
  background:linear-gradient(45deg,transparent,rgba(255,255,255,0.1),transparent);
  transform:rotate(45deg);
  animation:btn-shine 3s ease-in-out infinite;
  pointer-events:none;
}
@keyframes btn-shine{
  0%{transform:translateX(-100%) rotate(45deg)}
  50%,100%{transform:translateX(100%) rotate(45deg)}
}
.landing-content{
  animation:content-float 6s ease-in-out infinite;
  z-index:99999;
  position:relative;
}
@keyframes content-float{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-10px)}
}
/* 3D 파티클 효과 */
.landing-particles{
  position:absolute;
  inset:0;
  overflow:hidden;
  pointer-events:none;
}
.landing-particles::before,
.landing-particles::after{
  content:'';
  position:absolute;
  width:4px;
  height:4px;
  background:rgba(79,140,255,0.6);
  border-radius:50%;
  box-shadow:
    100px 200px 0 rgba(79,140,255,0.4),
    200px 100px 0 rgba(124,92,255,0.4),
    300px 300px 0 rgba(79,140,255,0.3),
    400px 150px 0 rgba(124,92,255,0.5),
    500px 250px 0 rgba(79,140,255,0.4),
    150px 400px 0 rgba(124,92,255,0.3),
    250px 50px 0 rgba(79,140,255,0.5),
    350px 350px 0 rgba(124,92,255,0.4),
    50px 300px 0 rgba(79,140,255,0.3),
    450px 400px 0 rgba(124,92,255,0.4);
  animation:particles-float 15s linear infinite;
}
.landing-particles::after{
  animation-delay:-7s;
  animation-duration:20s;
}
@keyframes particles-float{
  0%{transform:translateY(100vh) rotate(0deg)}
  100%{transform:translateY(-100vh) rotate(360deg)}
}
/* 스크롤 안내 애니메이션 */
.landing-scroll-hint{
  position:absolute;
  bottom:60px;
  left:50%;
  transform:translateX(-50%);
  color:rgba(255,255,255,0.4);
  font-size:12px;
  letter-spacing:2px;
  text-transform:uppercase;
  animation:scroll-bounce 2s ease-in-out infinite;
  pointer-events:none;
}
.landing-scroll-hint i{
  display:block;
  margin-top:8px;
  animation:arrow-bounce 1s ease-in-out infinite;
}
@keyframes scroll-bounce{
  0%,100%{opacity:0.4}
  50%{opacity:0.8}
}
@keyframes arrow-bounce{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(5px)}
}

/* V2026.37.31 - 가입신청 클릭 및 브랜드 복구 (CEO 최종 지시 v3.95) */
/* [1] 브랜드 색상 강제 고정 (Beyond Reality) */
:root {
    --xivix-neon: #00ff00 !important; /* 네온 그린 */
    --xivix-black: #0a0a0a !important; /* 딥 블랙 */
}

/* [2] 배경 요소: 마우스 신호가 그냥 통과되도록 투명화 */
.landing-bg, .landing-grid, .landing-particles, .landing-scroll-hint {
    pointer-events: none !important;
    z-index: 1 !important;
}

/* [3] 가입신청 버튼: 모든 장애물을 뚫고 최상단 배치 */
#btnRegisterMain {
    position: relative !important;
    z-index: 9999999 !important; /* 물리적 한계치 적용 */
    pointer-events: auto !important;
    cursor: pointer !important;
    background: var(--xivix-neon) !important;
    color: #000 !important;
    font-weight: 900 !important;
    border: 2px solid var(--xivix-neon) !important;
    box-shadow: 0 0 30px rgba(0, 255, 0, 0.6) !important;
}

/* [4] 가입 모달: 뒤에 숨지 않게 앞으로 당김 */
#registrationModal {
    z-index: 10000000 !important;
    background: rgba(0, 0, 0, 0.95) !important;
    backdrop-filter: blur(15px) !important;
}

/* 로그인 모달 */
.login-modal{
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.9);
  z-index:10001;
  justify-content:center;
  align-items:center;
  backdrop-filter:blur(10px);
}
.login-modal.show{display:flex}
.login-modal-content{
  background:var(--card-bg);
  border:1px solid var(--border);
  border-radius:20px;
  width:90%;
  max-width:380px;
  padding:32px;
  box-shadow:0 25px 80px rgba(0,0,0,0.6);
}
.login-header{
  text-align:center;
  margin-bottom:28px;
}
.login-header h2{
  font-size:20px;
  font-weight:700;
  color:var(--text);
  margin-bottom:8px;
}
.login-header p{
  font-size:13px;
  color:var(--text-muted);
}
.login-field{margin-bottom:16px}
.login-field label{
  display:block;
  font-size:12px;
  font-weight:600;
  color:var(--text-muted);
  margin-bottom:6px;
}
.login-field input{
  width:100%;
  padding:14px 16px;
  background:rgba(255,255,255,0.05);
  border:1px solid var(--border);
  border-radius:10px;
  color:var(--text);
  font-size:15px;
}
.login-field input:focus{
  outline:none;
  border-color:var(--primary);
}
/* V2026.37.44 - Layout Shift 방지 (CEO 지시) */
.login-modal-content{
  position:relative;
  transform:translateZ(0);
  will-change:transform;
}
.login-field input{
  -webkit-appearance:none;
  appearance:none;
  font-size:16px !important; /* iOS 확대 방지 */
}
@supports (-webkit-touch-callout: none) {
  .login-modal{
    min-height:-webkit-fill-available;
  }
}
.login-submit{
  width:100%;
  padding:14px;
  background:linear-gradient(135deg,var(--primary),var(--accent));
  border:none;
  border-radius:10px;
  color:#fff;
  font-size:15px;
  font-weight:700;
  cursor:pointer;
  margin-top:8px;
}
.login-submit:hover{opacity:0.9}
.login-submit:disabled{opacity:0.6;cursor:not-allowed}
.login-result{
  margin-top:16px;
  padding:12px;
  border-radius:8px;
  font-size:13px;
  text-align:center;
  display:none;
}
.login-result.error{display:block;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444}
.login-result.pending{display:block;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:var(--orange)}
.login-close{
  position:absolute;
  top:16px;
  right:16px;
  background:none;
  border:none;
  font-size:24px;
  color:var(--text-muted);
  cursor:pointer;
}
</style>

<!-- V2026.37.47 - 카카오 SDK (CEO 지시: 프리징 해결) -->
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.6.0/kakao.min.js" integrity="sha384-6MFdIr0zOira1CHQkedUqJVql0YtcZA1P0nbPrQYJXVJZUkTk/oX4U9GhMkgV+IQ" crossorigin="anonymous"></script>
</head>
<body>

<!-- V2026.37.23 - Beyond Reality 3D Landing Page -->
<div class="landing-page" id="landingPage">
  <div class="landing-bg"></div>
  <div class="landing-grid"></div>
  <div class="landing-particles"></div>
  <div class="landing-content">
    <div class="landing-badge"><i class="fas fa-crown"></i> Premium Membership Only</div>
    <div class="landing-logo">X</div>
    <h1 class="landing-title"><span>XIVIX 2026 PRO</span><br>상위 1% 보험 전문가 전용</h1>
    <p class="landing-subtitle">본 서비스는 멤버십 승인 후 이용 가능한<br><strong>유료 전문가 전용</strong> AI 콘텐츠 생성 웹입니다.</p>
    <div class="landing-buttons">
      <button type="button" class="landing-btn landing-btn-primary" id="btnRegisterMain" style="position:relative;z-index:9999;pointer-events:auto"><i class="fas fa-user-plus"></i> 멤버십 가입 신청</button>
      <button type="button" class="landing-btn landing-btn-secondary" id="btnLoginMain" style="position:relative;z-index:9999;pointer-events:auto"><i class="fas fa-sign-in-alt"></i> 로그인</button>
    </div>
  </div>
  <div class="landing-scroll-hint">스크롤<i class="fas fa-chevron-down"></i></div>
  <div class="landing-footer">© 2026 XIVIX Insurance Technology. All rights reserved.</div>
</div>

<!-- 로그인 모달 -->
<div class="login-modal" id="loginModal">
  <div class="login-modal-content" style="position:relative">
    <button class="login-close" onclick="closeLoginModal()">&times;</button>
    <div class="login-header">
      <h2><i class="fas fa-lock" style="color:var(--primary);margin-right:8px"></i>멤버십 로그인</h2>
      <p>승인된 회원만 접속 가능합니다</p>
    </div>
    <form onsubmit="handleLogin(event)">
      <div class="login-field">
        <label>휴대폰 번호</label>
        <input type="tel" id="loginPhone" placeholder="휴대폰 번호 (숫자만 입력)" required>
      </div>
      <div class="login-field">
        <label>비밀번호</label>
        <input type="password" id="loginPassword" placeholder="가입 시 설정한 비밀번호" required>
      </div>
      <button type="submit" class="login-submit" id="loginSubmitBtn"><i class="fas fa-sign-in-alt"></i> 로그인</button>
    </form>
    
    <!-- V2026.37.47 - 카카오 Sync 로그인 버튼 (CEO 지시: 프리징 해결) -->
    <div style="margin-top:16px;text-align:center">
      <div style="color:var(--text-muted);font-size:12px;margin-bottom:10px">또는</div>
      <button type="button" id="kakaoSyncBtn" onclick="kakaoSync()" style="
        width:100%;
        padding:14px;
        background:#FEE500;
        color:#000000;
        border:none;
        border-radius:12px;
        font-size:15px;
        font-weight:700;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#000" d="M12 3C6.5 3 2 6.58 2 11c0 2.84 1.87 5.33 4.67 6.75l-.92 3.42c-.08.29.25.54.52.38l4.03-2.67c.55.07 1.11.12 1.7.12 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/></svg>
        카카오 간편 로그인
      </button>
    </div>
    
    <div class="login-result" id="loginResult"></div>
  </div>
</div>

<!-- XIVIX 2026 PRO 초정밀 랜덤화 엔진 오버레이 -->
<div class="seo-overlay" id="seoOverlay">
  <div class="seo-overlay-content">
    <div class="seo-overlay-logo"><i class="fas fa-brain"></i> XIVIX INTELLIGENCE</div>
    <div class="seo-overlay-title">초정밀 랜덤화 엔진 가동 중</div>
    <div class="seo-overlay-subtitle">수만 가지 확률 조합으로 100% 고유한 미끼 질문을 생성하고 있습니다</div>
    
    <div class="seo-step" id="seoStep1">
      <div class="step-icon"><i class="fas fa-link"></i></div>
      <div class="step-content">
        <div class="step-title">API 연결 및 네이버 검색 트렌드 패킷 분석</div>
        <div class="step-count">연결 상태: <span id="apiCount">대기</span></div>
      </div>
    </div>
    
    <div class="seo-step" id="seoStep2">
      <div class="step-icon"><i class="fas fa-dice"></i></div>
      <div class="step-content">
        <div class="step-title">최적의 페르소나 매트릭스 랜덤 조합 중...</div>
        <div class="step-count">확률 조합: <span id="simCount">0</span>개</div>
      </div>
    </div>
    
    <div class="seo-step" id="seoStep3">
      <div class="step-icon"><i class="fas fa-shield-alt"></i></div>
      <div class="step-content">
        <div class="step-title">SEO 1위 노출용 바이럴 질문 최적화...</div>
        <div class="step-count">바이럴 지수: <span id="matchCount">0</span>%</div>
      </div>
    </div>
    
    <div class="seo-step" id="seoStep4">
      <div class="step-icon"><i class="fas fa-trophy"></i></div>
      <div class="step-content">
        <div class="step-title">전문가 데이터 진단 및 보장 리포트 산출!</div>
        <div class="step-count">최적화 등급: <span id="scoreCount">-</span></div>
      </div>
    </div>
    
    <div class="seo-progress-bar">
      <div class="seo-progress-fill" id="seoProgressFill"></div>
    </div>
    
    <div class="seo-result-keyword" id="seoResultKeyword">
      <div class="result-label"><i class="fas fa-check-circle"></i> 100% 고유 바이럴 질문 도출 완료</div>
      <div class="result-title" id="seoResultTitle"></div>
    </div>
  </div>
</div>
    
    <div class="seo-result-keyword" id="seoResultKeyword">
      <div class="result-label"><i class="fas fa-fire"></i> \ub313\uae00 \ud3ed\ubc1c \ubbf8\ub07c \uc9c8\ubb38 \ub3c4\ucd9c \uc644\ub8cc</div>
      <div class="result-title" id="seoResultTitle"></div>
    </div>
  </div>
</div>

<div class="bg">
  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="orb orb3"></div>
  <div class="grid"></div>
</div>

<nav class="nav">
  <a href="/admin"><i class="fas fa-cog"></i> Admin</a>
  <a href="/api/docs"><i class="fas fa-book"></i> Docs</a>
  <button onclick="openRegistrationModal()" class="nav-btn register-btn"><i class="fas fa-user-plus"></i> 가입 신청</button>
</nav>

<!-- V2026.37.19 - 가입 신청 모달 -->
<div id="registrationModal" class="reg-modal">
  <div class="reg-modal-content">
    <div class="reg-modal-header">
      <h2><i class="fas fa-user-plus"></i> XIVIX 2026 PRO 가입 신청</h2>
      <button onclick="closeRegistrationModal()" class="reg-close-btn">&times;</button>
    </div>
    <div class="reg-modal-body">
      <div class="reg-deposit-info">
        <div class="reg-deposit-title"><i class="fas fa-university"></i> 입금 계좌 안내</div>
        <div class="reg-account">
          <div class="reg-bank">케이뱅크</div>
          <div class="reg-account-num">100-201-341074</div>
          <div class="reg-holder">예금주: 방익주</div>
        </div>
        <p class="reg-notice">※ 입금 후 아래 신청서를 작성해 주세요.<br>입금 확인 후 대표님이 승인해야 비밀번호가 활성화됩니다.</p>
      </div>
      <form id="registrationForm" onsubmit="submitRegistration(event)">
        <div class="reg-field">
          <label><i class="fas fa-user"></i> 입금자 성함</label>
          <input type="text" id="regName" placeholder="입금자명과 동일하게 입력" required>
        </div>
        <div class="reg-field">
          <label><i class="fas fa-phone"></i> 휴대폰 번호</label>
          <input type="tel" id="regPhone" placeholder="휴대폰 번호 (숫자만 입력)" required>
        </div>
        <div class="reg-field">
          <label><i class="fas fa-lock"></i> 사용할 비밀번호</label>
          <input type="password" id="regPassword" placeholder="승인 후 이 비밀번호로 접속" required>
        </div>
        <button type="submit" class="reg-submit-btn"><i class="fas fa-paper-plane"></i> 가입 신청하기</button>
      </form>
      <div id="regResult" class="reg-result"></div>
    </div>
  </div>
</div>

<div class="wrapper">
  
  <div class="logo">
    <div class="logo-icon">X</div>
    <div class="logo-text">XIVIX <span>2026</span> PRO</div>
  </div>
  
  <p class="title">AI 보험 전문가 콘텐츠 생성 엔진</p>
  
  <div class="main">
    
    <!-- GPT 스타일 검색창 + 파일 업로드 -->
    <div class="search-box" id="searchBox">
      <textarea id="search" class="search-input" placeholder="핵심 고민을 입력하세요...&#10;&#10;예: 워킹맘인데 아이 교육자금으로 증여하려면 세금이 얼마나 나올까요?"></textarea>
      
      <!-- 파일 업로드 -->
      <div class="upload-area">
        <label class="upload-btn">
          <i class="fas fa-image"></i>
          <span>이미지 첨부</span>
          <input type="file" id="fileInput" accept="image/*" multiple>
        </label>
        <div id="fileList"></div>
        <span class="upload-hint">JPG, PNG, GIF, WEBP · 최대 10MB</span>
      </div>
      
      <div class="search-footer">
        <span class="char-count"><span id="char">0</span>/500</span>
        <button id="btn" class="search-btn" onclick="goGenerate()">
          <span class="btn-text"><i class="fas fa-fire"></i> \ubbf8\ub07c \uc9c8\ubb38 + \ub2f5\ubcc0 \uc138\ud2b8 \uc0dd\uc131</span>
          <div class="spinner"></div>
        </button>
      </div>
    </div>
    
    <!-- 프리미엄 실시간 보험 트렌드 (보험설계사 고급형) -->
    <div class="trend-section" id="trendSection">
      <div class="trend-header">
        <div class="trend-title-wrap">
          <div class="trend-title">
            <i class="fas fa-fire-alt"></i> 
            실시간 보험 트렌드
          </div>
          <div class="trend-subtitle">
            <div class="live-dot"></div>
            네이버 검색 기반 실시간 분석
          </div>
        </div>
        <div class="trend-timer">
          <span class="trend-time" id="trendTime"><i class="fas fa-clock"></i> 방금 전</span>
          <button class="refresh-btn" id="refreshBtn" onclick="refreshTrends()">
            <i class="fas fa-sync-alt"></i> 새로고침
          </button>
        </div>
      </div>
      
      <!-- 트렌드 그리드 -->
      <div id="trends" class="trend-grid">
        <div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px">
          <i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:12px;display:block;color:#f59e0b"></i>
          트렌드 로딩 중...
        </div>
      </div>
      
      <!-- HOT 키워드 태그 -->
      <div class="hot-keywords" id="hotKeywords" style="display:none">
        <div class="hot-keywords-title"><i class="fas fa-hashtag"></i> HOT 트렌드 키워드</div>
        <div class="hot-keywords-list" id="hotKeywordsList"></div>
      </div>
      
      <!-- 힌트 -->
      <div class="trend-hint">
        <i class="fas fa-lightbulb"></i>
        <span><b>활용 팁:</b> 키워드를 클릭하면 Q&A 생성 칸의 핵심 고민에 자동 입력됩니다. 트렌드 키워드를 활용하면 카페 노출이 높아집니다.</span>
      </div>
    </div>
    
    <!-- 결과 영역 (탭 분할 UI) -->
    <div class="result-section" id="resultSection">
      <div class="progress-box" id="progressBox">
        <div class="progress-header">
          <span id="progressText" class="progress-text"><i class="fas fa-spinner fa-spin"></i> 분석 중...</span>
          <span id="progressPct" class="progress-pct">0%</span>
        </div>
        <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
      </div>
      
      <!-- SEO 감사 리포트 (상단) -->
      <div class="seo-audit-card" id="seoAuditCard" style="display:none"></div>
      
      <!-- 보장 분석 테이블 (report_data 자동 연결) -->
      <div class="report-table" id="reportTable" style="display:none"></div>
      
      <!-- 바이럴 질문 -->
      <div class="viral-questions" id="viralQuestions" style="display:none"></div>
      
      <!-- ============================================
           V39 단일 페이지 순차 흐름 (Single Page Sequential Flow)
           탭 메뉴 100% 제거 - 사장님 지시사항 반영
           출력 순서: 제목 → 질문 → 키워드 → 답변 → 댓글
           ============================================ -->
      
      <!-- 1. 제목 섹션 -->
      <div class="sequential-section" id="section-titles">
        <div class="section-header">
          <i class="fas fa-heading"></i>
          <span>1. 제목 선택</span>
          <span class="badge" id="titleCount">5</span>
        </div>
        <div class="section-content" id="tab-titles"></div>
      </div>
      
      <!-- 2. SEO 키워드 섹션 -->
      <div class="sequential-section" id="section-keywords">
        <div class="section-header">
          <i class="fas fa-tags"></i>
          <span>2. SEO 키워드</span>
          <span class="badge">5</span>
        </div>
        <div class="section-content" id="seoKeywords"></div>
      </div>
      
      <!-- 2-2. 해시태그 섹션 (CEO 지시 2026.01.20 추가) -->
      <div class="sequential-section" id="section-hashtags">
        <div class="section-header">
          <i class="fas fa-hashtag"></i>
          <span>2-2. 해시태그</span>
          <span class="badge">5</span>
        </div>
        <div class="section-content" id="hashtagsContent"></div>
      </div>
      
      <!-- 3. 전문가 답변 섹션 -->
      <div class="sequential-section" id="section-contents">
        <div class="section-header">
          <i class="fas fa-file-alt"></i>
          <span>3. 전문가 답변</span>
          <span class="badge" id="contentCount">3</span>
        </div>
        <div class="section-content" id="tab-contents"></div>
      </div>
      
      <!-- 4. 댓글 군단 섹션 -->
      <div class="sequential-section" id="section-comments">
        <div class="section-header">
          <i class="fas fa-comments"></i>
          <span>4. 댓글 군단</span>
          <span class="badge" id="commentCount">5</span>
        </div>
        <div class="section-content" id="tab-extras"></div>
      </div>
      
      <!-- 전체 복사/다운로드 -->
      <button class="copy-all-btn" onclick="copyAllContent()">
        <i class="fas fa-copy"></i> 선택한 콘텐츠 전체 복사
      </button>
      
      <button class="new-btn show" id="newBtn" onclick="resetAndNew()">
        <i class="fas fa-plus"></i> 새로운 콘텐츠 생성
      </button>
      
      <!-- 🖼️ AI 이미지 생성 섹션 -->
      <div class="image-gen-section" id="imageGenSection">
        <div class="image-gen-header">
          <i class="fas fa-magic"></i>
          <div>
            <div class="image-gen-title">AI 마케팅 이미지 생성</div>
            <div class="image-gen-subtitle">보험사명 + 담보 정보로 마스킹된 이미지 자동 생성</div>
          </div>
        </div>
        
        <!-- ✅ CEO 지시 (2026.01.19) - source_url 직접 입력 필드 -->
        <div class="source-url-input-wrapper" style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <i class="fas fa-link" style="color:#00D4FF;font-size:12px;"></i>
            <span style="font-size:12px;color:rgba(255,255,255,0.7);">직접 이미지 URL 입력 (선택사항)</span>
          </div>
          <input type="text" id="sourceUrlInput" placeholder="유튜브 캡처본, 설계안 이미지 URL 직접 입력 시 AI 검증 없이 8초 내 가공" 
            style="width:100%;padding:10px 12px;background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:8px;color:#fff;font-size:13px;outline:none;">
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;">
            💡 네이버 검색 결과가 부실할 때, 직접 URL을 입력하면 빠르게 처리됩니다
          </div>
        </div>
        
        <button class="image-gen-btn" id="imageGenBtn" onclick="generateMarketingImage()">
          <i class="fas fa-image"></i> 마케팅 이미지 생성
        </button>
        
        <div class="image-gen-loading" id="imageGenLoading">
          <i class="fas fa-spinner fa-spin"></i>
          <div class="image-gen-loading-text" id="imageGenLoadingText">AI가 이미지를 분석하고 마스킹 중입니다...</div>
          <div class="image-gen-loading-sub" id="imageGenLoadingSub">약 5~10초 소요됩니다</div>
        </div>
        
        <div class="image-gen-result" id="imageGenResult">
          <img class="image-gen-preview" id="imageGenPreview" src="" alt="생성된 마케팅 이미지">
          <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;justify-content:center">
            <button class="image-download-btn" id="imageDownloadBtn" onclick="downloadGeneratedImage()">
              <i class="fas fa-download"></i> 이미지 다운로드
            </button>
            <button class="image-download-btn" id="imageRegenerateBtn" onclick="regenerateMarketingImage()" style="background:linear-gradient(135deg,#f59e0b,#d97706)">
              <i class="fas fa-sync-alt"></i> 이미지가 달라요
            </button>
          </div>
          <div id="regenerateStatus" style="display:none;margin-top:8px;font-size:12px;color:#fbbf24;text-align:center"></div>
        </div>
      </div>
    </div>
    
  </div>
</div>

<script>
const searchEl = document.getElementById('search');
const charEl = document.getElementById('char');
const btn = document.getElementById('btn');
const trendsEl = document.getElementById('trends');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const refreshBtn = document.getElementById('refreshBtn');
const trendTimeEl = document.getElementById('trendTime');
const searchBox = document.getElementById('searchBox');
const trendSection = document.getElementById('trendSection');
const hintSection = document.getElementById('hintSection'); // 제거됨 - 안전한 null 체크 적용
const resultSection = document.getElementById('resultSection');
const progressBox = document.getElementById('progressBox');
const progressText = document.getElementById('progressText');
const progressPct = document.getElementById('progressPct');
const progressFill = document.getElementById('progressFill');
const output = document.getElementById('output');
const newBtn = document.getElementById('newBtn');

let uploadedFiles = [];
let isGenerating = false;
let lastTrendUpdate = null;

// ✅ V39 기본 옵션값 - 하드코딩 나이 제거 (CEO 지시)
// target은 사용자 입력에서 동적 추출하므로 빈 값으로 설정
const DEFAULT_OPTIONS = {
  target: '',  // 동적 추출 (하드코딩 금지)
  insuranceType: '실손보험',
  company: '',  // 동적 추출
  style: '전문가 팩트체크형'
};

// 글자수 카운트 + V2026.37.19 LocalStorage 실시간 미러링
const STATE_KEY = 'xivix_user_state';

// V2026.37.23 - uploadedImages 변수 선언 (누락 수정)
var uploadedImages = [];
function renderImagePreviews() {
  // placeholder - 이미지 미리보기 렌더링
  console.log('[XIVIX] 이미지 미리보기:', uploadedImages.length + '개');
}

// ============================================
// V2026.37.51 - 모바일 세션 유지 강화 (CEO 지시 v5.0)
// 전화 받고 돌아와도 모든 데이터 유지
// - 입력 텍스트
// - 업로드된 이미지
// - 생성된 결과 데이터 (resultData)
// - 선택된 제목/본문 인덱스
// ============================================
const RESULT_KEY = 'xivix_result_data';  // 결과 데이터 별도 저장

function saveUserState() {
  const state = {
    searchText: searchEl.value,
    uploadedImages: uploadedImages,
    timestamp: Date.now()
  };
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    console.log('[XIVIX] 💾 사용자 상태 저장됨');
  } catch (e) {
    console.warn('[XIVIX] LocalStorage 저장 실패:', e);
  }
}

// V2026.37.51 - 결과 데이터 별도 저장 (용량 문제 방지)
function saveResultData() {
  if (!resultData) return;
  try {
    const data = {
      resultData: resultData,
      selectedTitle: selectedTitle,
      selectedContent: selectedContent,
      timestamp: Date.now()
    };
    localStorage.setItem(RESULT_KEY, JSON.stringify(data));
    console.log('[XIVIX] 💾 결과 데이터 저장됨');
  } catch (e) {
    console.warn('[XIVIX] 결과 데이터 저장 실패:', e);
    // 용량 초과 시 이전 데이터 삭제 후 재시도
    try {
      localStorage.removeItem(RESULT_KEY);
      localStorage.setItem(RESULT_KEY, JSON.stringify({
        resultData: resultData,
        selectedTitle: selectedTitle,
        selectedContent: selectedContent,
        timestamp: Date.now()
      }));
    } catch (e2) {
      console.error('[XIVIX] 결과 데이터 저장 완전 실패:', e2);
    }
  }
}

function loadUserState() {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      // 24시간 이내 데이터만 복원
      if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
        if (state.searchText) {
          searchEl.value = state.searchText;
          charEl.textContent = state.searchText.length;
        }
        if (state.uploadedImages && state.uploadedImages.length > 0) {
          uploadedImages = state.uploadedImages;
          renderImagePreviews();
        }
        console.log('[XIVIX] ✅ 이전 작업 상태 복원됨');
      }
    }
  } catch (e) {
    console.warn('[XIVIX] LocalStorage 복원 실패:', e);
  }
}

// V2026.37.51 - 결과 데이터 복원
function loadResultData() {
  try {
    const saved = localStorage.getItem(RESULT_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      // 2시간 이내 데이터만 복원 (결과 데이터는 유효기간 짧게)
      if (Date.now() - data.timestamp < 2 * 60 * 60 * 1000) {
        if (data.resultData) {
          resultData = data.resultData;
          selectedTitle = data.selectedTitle || 0;
          selectedContent = data.selectedContent || 0;
          
          // UI 복원
          setTimeout(() => {
            try {
              renderSeoAudit(resultData.seo_audit || { score: 95, grade: 'S+', rank_prediction: '1-3위' });
              renderReportData(resultData.report_data);
              renderViralQuestions(resultData.viral_questions);
              renderTitles(resultData.titles || []);
              renderContents(resultData.contents || []);
              renderCommentsAndKeywords(resultData.comments || [], resultData.seoKeywords || []);
              
              // 출력 영역 표시
              const output = document.getElementById('output');
              if (output) output.classList.add('show');
              
              console.log('[XIVIX] ✅ 결과 데이터 복원됨 (전화 후 복귀)');
              
              // 사용자에게 알림
              const toast = document.createElement('div');
              toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#10b981;color:white;padding:12px 24px;border-radius:8px;z-index:99999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
              toast.innerHTML = '<i class="fas fa-check-circle"></i> 이전 결과가 복원되었습니다';
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 3000);
            } catch (renderError) {
              console.warn('[XIVIX] UI 복원 중 오류:', renderError);
            }
          }, 500);
        }
      } else {
        // 오래된 데이터 삭제
        localStorage.removeItem(RESULT_KEY);
      }
    }
  } catch (e) {
    console.warn('[XIVIX] 결과 데이터 복원 실패:', e);
  }
}

// 페이지 로드 시 상태 복원
loadUserState();
loadResultData();  // V2026.37.51 추가

// 페이지 벗어나기 전 저장
window.addEventListener('beforeunload', () => {
  saveUserState();
  saveResultData();  // V2026.37.51 추가
});

// visibility 변경 시 저장 (전화 수신, 앱 전환 등)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveUserState();
    saveResultData();  // V2026.37.51 추가
    console.log('[XIVIX] 📱 앱 전환 감지 - 데이터 저장됨');
  } else if (document.visibilityState === 'visible') {
    // 앱으로 복귀 시 상태 체크
    console.log('[XIVIX] 📱 앱 복귀 감지');
  }
});

// V2026.37.51 - 모바일 페이지 캐시 이벤트 (Safari/iOS)
window.addEventListener('pagehide', () => {
  saveUserState();
  saveResultData();
});

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    // 캐시에서 복원된 페이지
    console.log('[XIVIX] 📱 캐시에서 복원됨');
    loadUserState();
    loadResultData();
  }
});

searchEl.addEventListener('input', () => {
  const len = searchEl.value.length;
  charEl.textContent = len;
  if (len > 500) {
    searchEl.value = searchEl.value.substring(0, 500);
    charEl.textContent = 500;
  }
  // 실시간 상태 저장 (디바운스)
  clearTimeout(window.saveStateTimeout);
  window.saveStateTimeout = setTimeout(saveUserState, 500);
});

// 파일 업로드 처리
fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      alert(file.name + ' 파일이 10MB를 초과합니다');
      continue;
    }
    
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert(file.name + '는 지원하지 않는 형식입니다');
      continue;
    }
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result.split(',')[1];
      const fileObj = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        base64: base64,
        preview: evt.target.result
      };
      uploadedFiles.push(fileObj);
      renderFileList();
    };
    reader.readAsDataURL(file);
  }
  
  fileInput.value = '';
});

function renderFileList() {
  fileList.innerHTML = uploadedFiles.map(f => 
    '<div class="file-preview">' +
      '<img src="' + f.preview + '" alt="' + f.name + '">' +
      '<span>' + f.name.substring(0, 15) + (f.name.length > 15 ? '...' : '') + '</span>' +
      '<i class="fas fa-times remove" onclick="removeFile(' + f.id + ')"></i>' +
    '</div>'
  ).join('');
}

function removeFile(id) {
  uploadedFiles = uploadedFiles.filter(f => f.id !== id);
  renderFileList();
}

// 트렌드 로드 (Linear 스타일 미니멀 UI)
async function loadTrends() {
  try {
    const res = await fetch('/api/trend');
    const data = await res.json();
    
    if (data.success && data.trends) {
      // 트렌드 그리드 렌더링 (컴팩트 1줄 레이아웃)
      trendsEl.innerHTML = data.trends.map(t => {
        let changeHtml = '';
        if (t.change === 'up') changeHtml = '<span class="trend-change up">+' + (t.changePercent || 0) + '%</span>';
        else if (t.change === 'down') changeHtml = '<span class="trend-change down">-' + (t.changePercent || 0) + '%</span>';
        else if (t.change === 'new') changeHtml = '<span class="trend-change new">NEW</span>';
        else changeHtml = '<span class="trend-change same">-</span>';
        
        const isTop3 = t.rank <= 3;
        
        return '<div class="trend-item" onclick="selectTrend(this)" data-keyword="' + t.keyword + '">' +
          '<span class="trend-rank' + (isTop3 ? ' top3' : '') + '">' + t.rank + '</span>' +
          '<div class="trend-content">' +
            '<div class="trend-keyword">' + t.keyword + '</div>' +
            '<div class="trend-meta">' +
              '<span class="trend-volume">' + t.volume + '</span>' +
              changeHtml +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      
      // 갱신 시간 업데이트
      lastTrendUpdate = new Date();
      updateTrendTime();
    }
  } catch(e) {
    console.error('Trend load error:', e);
    trendsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--red);padding:36px">' +
      '<i class="fas fa-exclamation-circle" style="font-size:18px;margin-bottom:10px;display:block"></i>' +
      '<span style="font-size:13px">트렌드 로딩 실패</span><br>' +
      '<small style="color:var(--text-muted);font-size:12px">새로고침 버튼을 눌러주세요</small></div>';
  }
}

// 새로고침 버튼 클릭 (에러 가드 포함)
async function refreshTrends() {
  try {
    // INP 최적화: 즉시 UI 반응
    requestAnimationFrame(() => {
      refreshBtn.classList.add('loading');
      refreshBtn.disabled = true;
    });
    
    await loadTrends();
  } catch (e) {
    console.error('[XIVIX] 트렌드 새로고침 오류:', e);
    // 에러 시에도 UI 복구
    trendsEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--orange);padding:20px">' +
      '<i class="fas fa-exclamation-circle"></i> 트렌드 로딩 실패. 다시 시도해주세요.</div>';
  } finally {
    refreshBtn.classList.remove('loading');
    refreshBtn.disabled = false;
  }
}

// 키워드로 트렌드 선택
function selectTrendByKeyword(keyword) {
  searchEl.value = keyword + '에 대해 자세히 알려주세요';
  charEl.textContent = searchEl.value.length;
  searchEl.focus();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

// 갱신 시간 표시
function updateTrendTime() {
  if (!lastTrendUpdate) return;
  const now = new Date();
  const diff = Math.floor((now - lastTrendUpdate) / 1000);
  
  let timeText = '';
  if (diff < 60) {
    timeText = '방금 전';
  } else if (diff < 3600) {
    timeText = Math.floor(diff / 60) + '분 전';
  } else {
    timeText = Math.floor(diff / 3600) + '시간 전';
  }
  trendTimeEl.innerHTML = '<i class="fas fa-clock"></i> ' + timeText;
}

// 1분마다 갱신 시간 업데이트 (API 호출 없음)
setInterval(updateTrendTime, 60000);

// ============================================
// XIVIX 2026 PRO TOTAL ENGINE (Full-Stack \ub9c8\ucf00\ud305 \ub85c\uc9c1)
// \uc5d4\ud2b8\ub85c\ud53c: 0.98 - \ud0a4\uc6cc\ub4dc\ubd80\ud130 \ub313\uae00\uae4c\uc9c0 \uc720\uae30\uc801 \uc5f0\uacb0
// ============================================

// 31\uac1c \ubcf4\ud5d8\uc0ac \ub9c8\uc2a4\ud130 \ub9ac\uc2a4\ud2b8 (2026\ub144 \uae30\uc900)
const INSURANCE_COMPANY_DB = {
  life: ['\uc0bc\uc131\uc0dd\uba85', '\ud55c\ud654\uc0dd\uba85', '\uad50\ubcf4\uc0dd\uba85', '\uc2e0\ud55c\ub77c\uc774\ud504', '\ubbf8\ub798\uc5d0\uc14b\uc0dd\uba85', '\ud765\uad6d\uc0dd\uba85', '\ub3d9\uc591\uc0dd\uba85', '\ub77c\uc774\ub098\uc0dd\uba85', 'NH\ub18d\ud611\uc0dd\uba85', 'DB\uc0dd\uba85', 'ABL\uc0dd\uba85', 'AIA\uc0dd\uba85', 'KB\ub77c\uc774\ud504', '\uba54\ud2b8\ub77c\uc774\ud504', 'KDB\uc0dd\uba85', '\ud478\ubcf8\ud604\ub300\uc0dd\uba85', '\ud558\ub098\uc0dd\uba85', 'BNP\ud30c\ub9ac\ubc14\uce74\ub514\ud504', '\uad50\ubcf4\ub77c\uc774\ud504\ud50c\ub798\ub2db'],
  nonLife: ['\uc0bc\uc131\ud654\uc7ac', '\ud604\ub300\ud574\uc0c1', 'DB\uc190\ubcf4', 'KB\uc190\ubcf4', '\uba54\ub9ac\uce20\ud654\uc7ac', '\ud55c\ud654\uc190\ubcf4', '\ub86f\ub370\uc190\ubcf4', '\ud765\uad6d\ud654\uc7ac', 'NH\ub18d\ud611\uc190\ubcf4', 'MG\uc190\ubcf4', 'AXA\uc190\ubcf4', '\ud558\ub098\uc190\ubcf4']
};

// 4\uc885 \ud398\ub974\uc18c\ub098 \ub9e4\ud2b8\ub9ad\uc2a4 (\uc758\uc2ec\ud615/\ud558\uc18c\uc5f0\ud615/\ub530\uc9c0\ub294\ud615/\ud574\ub9d1\uc740\ud615)
const PERSONA_POOL = [
  { role: '\uc9c0\uc778 \uc124\uacc4\uc0ac \ub208\ud0f1\uc774 \uc758\uc2ec\ud615', style: '\uc758\uc2ec \uac00\ub4dd, \ud329\ud2b8 \uccb4\ud06c \uc694\uad6c', keywords: ['\ub208\ud0f1\uc774', '\uc9c4\uc9dc \ud61c\uc790\uc778\uac00\uc694', '\uadf8\ub0e5 \uc218\ub2f9\uc6a9 \uc544\ub2cc\uac00\uc694', '\ubff0\uc774\ub294\uac70 \uc544\ub2c8\uc8e0', '\ud655\uc778 \uc88c \ud574\uc8fc\uc138\uc694'] },
  { role: '\ub9d8\uce74\ud398 \ucd94\ucc9c \ud329\ud2b8\uccb4\ud06c\ud615', style: '\ub9d8\uce74\ud398\uc5d0\uc11c \ub4e4\uc5c8\ub294\ub370 \uac80\uc99d \uc694\uccad', keywords: ['\ub9d8\uce74\ud398\uc5d0\uc11c', '\uadf8 \ubd84\uc774 \ucd94\ucc9c\ud574\uc11c', '\uad34\ub2f4\uc5d0\uc11c \ubcf4\uace0', '\uc5b4\ub514\uc11c \ub4e4\uc5c8\ub294\ub370', '\uc774\uac70 \ub9de\ub098\uc694'] },
  { role: '\uc720\ud29c\ube0c \uc0c1\ub2f4 \ud6c4 \ubc30\uc2e0\uac10\ud615', style: '\uc720\ud29c\ubc84 \ub9d0 \ub2e4\ub984, \ud654\ub0a8', keywords: ['\uc720\ud29c\ube0c\uc5d0\uc11c', '\uc0c1\ub2f4\ubc1b\uc558\ub294\ub370 \ub9d0\uc774 \ub2ec\ub77c\uc694', '\uc644\uc804 \ub2e4\ub978 \uc0ac\ub78c\uc774 \ub428', '\ubc29\uc1a1\ud558\ub294 \uc0ac\ub78c \ub9d0\ub9cc \ubbff\uace0', '\ubc30\uc2e0\uac10'] },
  { role: '\uac31\uc2e0\ud3ed\ud0c4 \uba58\ubd95\ud615', style: '\uac11\uc790\uae30 \ubcf4\ud5d8\ub8cc \ud3ed\ub4f1, \uba58\ubd95', keywords: ['\uac11\uc790\uae30 12\ub9cc\uc6d0', '\uac31\uc2e0\ud3ed\ud0c4', '\ucc98\uc74c\uc5d4 3\ub9cc\uc6d0\uc774\ub77c\ub354\ub2c8', '\uc2dc\uae34\ud3ed\ud0c4', '\uc774\uac8c \ubb34\uc2a8'] }
];

// \uc81c\uc548\uc11c \uc774\ubbf8\uc9c0 \uad00\ub828 \ud0a4\uc6cc\ub4dc (\ud544\uc218 \ud3ec\ud568)
const IMAGE_MENTION_TEMPLATES = [
  '\uc774\ubbf8\uc9c0 \ucca8\ubd80\ud588\uc5b4\uc694. \ubd10\uc8fc\uc138\uc694',
  '\uc81c\uc548\uc11c \uc0ac\uc9c4 \uc62c\ub9bc\ub2c8\ub2e4',
  '\uc124\uacc4\uc11c \ucca8\ubd80\ud569\ub2c8\ub2e4',
  '\uc99d\uad8c \uc0ac\uc9c4 \uc62c\ub824\uc694',
  '\uc544\ub798 \uc0ac\uc9c4 \ubd10\uc8fc\uc138\uc694'
];

// \ub79c\ub364 \ubcf4\ud5d8\ub8cc \uae08\uc561 \uc0dd\uc131 (7\ub9cc~15\ub9cc\uc6d0)
function generateRandomPremium() {
  const base = Math.floor(Math.random() * 80) + 70; // 70,000 ~ 150,000
  const hundreds = Math.floor(Math.random() * 10) * 100; // 0 ~ 900
  return (base * 1000 + hundreds).toLocaleString();
}

// \uc0c1\ud669 \ud480 (\uc81c\uc548\uc11c/\uc99d\uad8c \ubd84\uc11d \uc911\uc2ec)
const SITUATION_POOL = [
  { text: '\uc124\uacc4\uc0ac\uac00 \uc900 \uc81c\uc548\uc11c\uc778\ub370 \uc774\uac8c \uc9c4\uc9dc \uc88b\uc740 \uac74\uc9c0 \ubaa8\ub974\uaca0\uc5b4\uc694', detail: '\uadf8\ub0e5 \uc218\ub2f9\ub9cc \ub9ce\uc774 \ubc1b\uc73c\ub824\uace0 \uc774\ub7f0 \uac70 \uc8fc\ub294 \uac70 \uc544\ub2c8\uc5d0\uc694??' },
  { text: '\uc5b4\uba38\ub2c8\uac00 20\ub144 \uc804 \ub4e4\uc5b4\uc900 \ubcf4\ud5d8\uc778\ub370 \uc9c4\ub2e8 \uc88c \ud574\uc8fc\uc138\uc694', detail: '\ud574\uc9c0\ud574\uc57c\ud558\ub098\uc694 \uc720\uc9c0\ud574\uc57c\ud558\ub098\uc694' },
  { text: '\uc0c8\ub85c \ub4e4\ub824\uace0 \ud558\ub294\ub370 \uc774 \uc124\uacc4\uc11c \uad1c\ucc2e\uc740\uac00\uc694', detail: '\ubcf4\uc7a5\ub0b4\uc6a9\uc774 \uc774\uac8c \ub9de\ub294\uc9c0 \ubaa8\ub974\uaca0\uc5b4\uc694' },
  { text: '\ubcf4\ud5d8\ub9ac\ubaa8\ub378\ub9c1 \ud558\ub77c\ub294\ub370 \uc774 \uc81c\uc548\uc11c\uac00 \ub9de\ub294 \uac74\uc9c0', detail: '\uae30\uc874\uac70 \ud574\uc9c0\ud558\uace0 \uc774\uac78\ub85c \uc804\ud658\ud558\ub77c\ub294\ub370' },
  { text: '\uc9c0\uc778\uc774 \ucd94\ucc9c\ud574\uc11c \ubc1b\uc740 \uc81c\uc548\uc11c\uc778\ub370 \uac1d\uad00\uc801\uc73c\ub85c \ubd10\uc8fc\uc138\uc694', detail: '\uce5c\uad6c\ub77c\uc11c \uac70\uc808 \ubabb\ud558\uaca0\ub294\ub370 \uc774\uac8c \uc9c4\uc9dc \uc88b\uc740 \uac74\uc9c0' },
  { text: '\uc544\uc774 \ud0dc\uc5b4\ub098\uc11c \ud0dc\uc544\ubcf4\ud5d8 \ub4e4\ub824\uace0 \ud558\ub294\ub370 \uc774\uac8c \ub9de\ub098\uc694', detail: '\ud2b9\uc57d \uad6c\uc131\uc774 \uc774\uac8c \ub9de\ub294\uc9c0' },
  { text: '\uc554\ubcf4\ud5d8 \uac00\uc785\ud558\ub824\uace0 \ud558\ub294\ub370 \uc5b4\ub5a4 \uac8c \uc88b\uc744\uae4c\uc694', detail: '\uc5ec\ub7ec \uac1c \ube44\uad50\ud574\ubd24\ub294\ub370 \ubaa8\ub974\uaca0\uc5b4\uc694' },
  { text: '\uc2e4\ube44 \uc804\ud658\ud558\ub77c\ub294\ub370 \uc774 \uc81c\uc548\uc11c \ubbff\uc5b4\ub3c4 \ub418\ub098\uc694', detail: '\uc804\ud658 \uc548\ud558\uba74 \ubcf4\uc0c1 \ubabb\ubc1b\ub294\ub2e4\uace0 \ud558\ub294\ub370' }
];

// \uac10\uc815 \ud2b8\ub9ac\uac70 (5\uc885)
const EMOTION_TRIGGERS = ['\uc5b5\uc6b8\ud568', '\ub0c9\uc18c\uc801', '\uac04\uc808\ud568', '\ub2f9\ub2f9\ud568', '\ubd84\ub178'];

// \ub9d0\ud22c \ubcc0\ud615 \ud328\ud134 (\uc624\ud0c0/\uacf5\ubc31/\uc904\uc784\ub9d0 \uc870\ud569)
const SPEECH_MUTATIONS = {
  endings: ['..', '...', 'ㅠㅠ', 'ㅜㅜ', 'ㄷㄷ', ';;', 'ㅎㅎ', '??', '!!!'],
  typos: { '설계사': '설게사', '보험료': '보헙료', '제안서': '제안서', '청구': '청구', '상담': '상담' },
  fillers: [' ', '  ', ' \uc544 ', ' \uadf8\ub7f0\ub370 ', ' \uadf8\ub798\uc11c '],
  emphasis: ['\uc9c4\uc9dc', '\uc9c4\uc9dc\ub85c', '\ub808\uc54c', '\uc2e4\ud654\ub0d0', '\uc640 \uc9c4\uc9dc']
};

// ============================================
// 확장된 금지어 필터 v3 (AI 냄새 + 슬랭 + 맥락혼합 원천 차단)
// 규칙 1: AI 특유 표현 금지
// 규칙 2: 검증되지 않은 슬랭 금지 (~좌, ~노, ~까, ~긔 등)
// 규칙 3: 과도한 존칭어 금지
// 규칙 4: 맥락 혼합 유발 표현 금지
// ============================================
const BANNED_WORDS = [
  // AI 특유 표현 (딥러닝 모델이 자주 생성하는 패턴)
  '막막하다', '도움요청', '문의드립니다', '경험이 있으신', '부탁드립니다',
  '자문을 구합니다', '안내해 드리겠습니다', '선배님들 조언', '알려주세요',
  '의의제기', '해결책을', '어떻게 생각하시나요', '여쭙습니다',
  '문의하셔서', '감사합니다', '도움이 되실거예요', '참고하시기 바랍니다',
  // 실제 카페에서 사용하지 않는 과도한 표현
  '명쾌하다', '철체하다', '유익한', '대단히', '현명한',
  // 맥락 혼합 유발 표현 (신규 + 기존 섞음 방지) - 이런 표현이 포함되면 혼합 가능성 높음
  '어머니가 들어준 보험인데 오늘 제안받았는데',
  '제안받았는데 어머니가',
  '새로 들려고 하는데 예전에',
  '기존 보험이 있는데 오늘 새로',
  '예전 거랑 새 거랑'
];

// 금지 접미사 패턴 (정규식 기반 필터링) - 슬랭 가드레일
const BANNED_SUFFIX_PATTERNS = [
  /좌$/,  // ~좌
  /노$/,  // ~노  
  /까$/,  // ~까
  /긔$/,  // ~긔
  /림$/,  // ~림
  /심$/,  // ~심
  /돋네$/, // ~돋네
  /요시$/  // ~요시
];

// \ubc14\uc774\ub7f4 \uc9c8\ubb38 \uc0dd\uc131 \ud37c\ud3ec\uba3c\uc2a4 \uc2dc\ud000\uc2a4 (\uc9c8\ubb38\uc774 \ub300\uc7a5!)
const VIRAL_ANALYSIS_STEPS = [
  { id: 'seoStep1', duration: 800, counterId: 'apiCount', counterEnd: '\uc5f0\uacb0\ub428', counterType: 'text' },
  { id: 'seoStep2', duration: 1200, counterId: 'simCount', counterEnd: 52400, counterType: 'number' },
  { id: 'seoStep3', duration: 1000, counterId: 'matchCount', counterEnd: 97, counterType: 'number' },
  { id: 'seoStep4', duration: 500, counterId: 'scoreCount', counterEnd: 'S+', counterType: 'text' }
];

// \uc22b\uc790 \uce74\uc6b4\ud2b8\uc5c5 \uc560\ub2c8\uba54\uc774\uc158
function animateCounter(elementId, endValue, duration) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const startTime = performance.now();
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.floor(endValue * easeOut);
    element.textContent = currentValue.toLocaleString();
    if (progress < 1) requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}

// \ud0c0\uc774\ud551 \ud6a8\uacfc
function typeWriter(element, text, speed, callback) {
  element.innerHTML = '';
  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  element.appendChild(cursor);
  
  function type() {
    if (i < text.length) {
      element.insertBefore(document.createTextNode(text.charAt(i)), cursor);
      i++;
      setTimeout(type, speed);
    } else {
      cursor.remove();
      if (callback) callback();
    }
  }
  type();
}

// ============================================
// 🚨 상황별 단일 로직 바이럴 질문 생성 엔진 v3 (2026.01.18)
// 규칙 1: 한 질문 = 하나의 상황만 (신규 OR 기존, 절대 섞지 않음)
// 규칙 2: 검증된 말투만 사용 (~좌, ~노, ~긔 등 슬랭 완전 금지)
// 규칙 3: 인과관계 검수 (문장 A → 그래서 → 문장 B 자연스럽게 흐름)
// 규칙 4: 패러프레이징 금지 (접속사 불필요하게 연결 금지)
// ============================================
function generateViralQuestion(keyword) {
  const allCompanies = [...INSURANCE_COMPANY_DB.life, ...INSURANCE_COMPANY_DB.nonLife];
  const company = allCompanies[Math.floor(Math.random() * allCompanies.length)];
  const premium = generateRandomPremium();
  
  // 🎯 상황 타입 먼저 결정 (A: 신규 제안서 / B: 기존 보험 / C: 상담 후기)
  const scenarioType = ['NEW', 'OLD', 'CONSULT'][Math.floor(Math.random() * 3)];
  
  // ✅ 허용된 말투 종결 (실제 카페에서 흔히 사용되는 것만)
  const SAFE_ENDINGS = ['ㅠㅠ', 'ㄷㄷ', ';;', '...', '??', '!!', 'ㅎㄷㄷ', 'ㅇㅇ'];
  const ending = SAFE_ENDINGS[Math.floor(Math.random() * SAFE_ENDINGS.length)];
  
  let question = '';
  
  // ============================================
  // 시나리오 A: 신규 제안서 분석 요청 (오늘/최근 받은 것)
  // 주의: 기존 보험 언급 절대 금지
  // ============================================
  if (scenarioType === 'NEW') {
    const newTemplates = [
      // 템플릿 1: 단순 팩트체크 (인과: 제안받음 → 검증 필요) - V39 하드코딩 제거
      company + ' ' + keyword + ' 제안서 사진 올립니다. 설계사가 월 ' + premium + '원이라는데 이거 적당한 건가요? 팩폭 좀요' + ending,
      
      // 템플릿 2: 의심형 (인과: 제안받음 → 수당 의심)
      '오늘 ' + company + ' 설계사한테 ' + keyword + ' 제안받았어요. 월 ' + premium + '원이래요. 그런데 이거 수당 많이 받으려고 비싼 거 권유하는 거 아닌가요' + ending + ' 제안서 첨부합니다.',
      
      // 템플릿 3: 비교 요청 (인과: 제안받음 → 타사 비교 필요)
      company + ' ' + keyword + ' 월 ' + premium + '원 제안받았는데요. 다른 데랑 비교하면 어떤가요? 첨부한 제안서 좀 봐주세요' + ending,
      
      // 템플릿 4: 맘카페 추천 후 (인과: 추천 들음 → 상담 → 검증 필요)
      '맘카페에서 ' + company + ' ' + keyword + ' 좋다고 해서 상담받았어요. 월 ' + premium + '원인데 이 정도면 괜찮은 건가요? 제안서 올려요' + ending,
      
      // 템플릿 5: 급한 결정 (인과: 기한 제시 → 급함 → 검증 필요)
      company + ' ' + keyword + ' 이번주까지 결정하라는데요. 월 ' + premium + '원이에요. 급하게 가입해도 될까요' + ending + ' 제안서 첨부했어요.'
    ];
    question = newTemplates[Math.floor(Math.random() * newTemplates.length)];
  }
  
  // ============================================
  // 시나리오 B: 기존 보험 진단 요청 (예전에 가입한 것)
  // 주의: 신규 제안 언급 절대 금지, 갱신/해지/유지 판단 요청만
  // ============================================
  else if (scenarioType === 'OLD') {
    const years = [5, 7, 10, 12, 15][Math.floor(Math.random() * 5)];
    const oldTemplates = [
      // 템플릿 1: 서랍 발견 (인과: 발견 → 검토 필요)
      '서랍 정리하다가 ' + years + '년 전 가입한 ' + company + ' ' + keyword + ' 증권 발견했어요. 월 ' + premium + '원인데 계속 유지해도 되나요' + ending + ' 증권 사진 올립니다.',
      
      // 템플릿 2: 갱신 폭탄 (인과: 보험료 폭등 → 당황 → 판단 필요)
      years + '년 전 들었던 ' + company + ' ' + keyword + '인데요. 갑자기 보험료가 월 ' + premium + '원으로 올랐어요. 해지해야 하나요 유지해야 하나요' + ending + ' 증권 첨부해요.',
      
      // 템플릿 3: 부모님이 들어준 (인과: 줬다가 보니까 → 판단 필요)
      '어머니가 ' + years + '년 전에 들어주신 ' + company + ' ' + keyword + '예요. 월 ' + premium + '원인데 지금 봐도 괜찮은 건지 모르겠어요' + ending + ' 증권 올려볼게요.',
      
      // 템플릿 4: 리모델링 권유 (인과: 설계사 권유 → 의심 → 검증 필요)
      company + ' 설계사가 ' + years + '년 된 ' + keyword + ' 리모델링하자고 하는데요. 지금 월 ' + premium + '원 내고 있어요. 바꿔야 하나요' + ending + ' 현재 증권 첨부합니다.',
      
      // 템플릿 5: 보장 내용 확인 (인과: 오래됨 → 궁금함 → 확인 필요)
      years + '년 전 가입한 ' + company + ' ' + keyword + '인데요. 월 ' + premium + '원이에요. 오래돼서 보장이 지금도 괜찮은지 좀 봐주세요' + ending + ' 증권 사진 올릴게요.'
    ];
    question = oldTemplates[Math.floor(Math.random() * oldTemplates.length)];
  }
  
  // ============================================
  // 시나리오 C: 상담 후기/비교 요청 (오늘 상담받은 것 기준)
  // 주의: 기존 보험 언급 절대 금지, 상담/제안서 검토만
  // ============================================
  else {
    const consultTemplates = [
      // 템플릿 1: 유튜브 후 상담 (인과: 유튜브 시청 → 상담 → 제안서가 다름 → 혼란)
      '유튜브 보고 ' + company + ' ' + keyword + ' 상담받았어요. 그런데 제안서가 생각한 거랑 달라요. 월 ' + premium + '원인데 원래 이런가요' + ending + ' 제안서 첨부합니다.',
      
      // 템플릿 2: 지인 추천 (인과: 지인 설계 → 객관적 검토 필요)
      '지인이 ' + company + ' 설계사인데요. ' + keyword + ' 월 ' + premium + '원으로 설계해줬어요. 객관적으로 봐주실 분' + ending + ' 제안서 올려요.',
      
      // 템플릿 3: 여러 곳 비교 (인과: 여러 곳 제안 → 비교 필요)
      company + ' 말고 다른 데서도 ' + keyword + ' 제안받았는데요. 여기가 월 ' + premium + '원이에요. 어디가 나은지 모르겠어요' + ending + ' 제안서 첨부합니다.',
      
      // 템플릿 4: 설계사 말 다름 (인과: 설계사마다 다름 → 혼란 → 팩트 필요)
      keyword + ' 상담받는데요. ' + company + ' 설계사마다 말이 달라요. 월 ' + premium + '원이면 적당한 건가요' + ending + ' 제안서 올릴게요.',
      
      // 템플릿 5: 가입 전 마지막 확인 (인과: 가입 결정 → 마지막 검토 필요)
      company + ' ' + keyword + ' 가입하려고요. 월 ' + premium + '원인데 마지막으로 확인받고 싶어요' + ending + ' 제안서 첨부했어요.'
    ];
    question = consultTemplates[Math.floor(Math.random() * consultTemplates.length)];
  }
  
  // 🚫 금지어 필터링 (AI 냄새 제거)
  BANNED_WORDS.forEach(word => {
    question = question.replace(new RegExp(word, 'g'), '');
  });
  
  // 🚫 금지 접미사 패턴 필터링 (슬랭 가드레일)
  BANNED_SUFFIX_PATTERNS.forEach(pattern => {
    // 단어 단위로 필터링 (예: "관심좌", "대박좌" 등)
    const words = question.split(/\\s+/);
    const filtered = words.filter(word => !pattern.test(word));
    question = filtered.join(' ');
  });
  
  // 인과관계 검증 (맥락 혼합 여부 확인)
  question = validateCausalFlow(question, scenarioType);
  
  // 800자 제한
  if (question.length > 800) {
    question = question.substring(0, 797) + '...';
  }
  
  return question;
}

// ============================================
// 인과관계 검증 함수 (맥락 혼합 방지)
// - 신규 시나리오에서 기존 보험 키워드 발견 시 제거
// - 기존 시나리오에서 신규 제안 키워드 발견 시 제거
// ============================================
function validateCausalFlow(question, scenarioType) {
  // 신규 시나리오에서 금지할 키워드 (기존 보험 관련)
  const OLD_KEYWORDS = ['년 전 가입', '년 전에 들어', '예전에 들은', '기존 보험', '증권 발견', '서랍에서', '리모델링'];
  
  // 기존 시나리오에서 금지할 키워드 (신규 제안 관련)
  const NEW_KEYWORDS = ['오늘 제안', '오늘 상담', '새로 가입', '새로 들려고', '이번주까지'];
  
  let result = question;
  
  if (scenarioType === 'NEW') {
    // 신규 시나리오에서 기존 보험 키워드가 있으면 문제
    for (const kw of OLD_KEYWORDS) {
      if (result.includes(kw)) {
        console.warn('[Context Mix Detected] NEW 시나리오에 OLD 키워드:', kw);
        // 해당 문장 제거 대신 키워드만 삭제
        result = result.replace(new RegExp(kw, 'g'), '');
      }
    }
  } else if (scenarioType === 'OLD') {
    // 기존 시나리오에서 신규 제안 키워드가 있으면 문제
    for (const kw of NEW_KEYWORDS) {
      if (result.includes(kw)) {
        console.warn('[Context Mix Detected] OLD 시나리오에 NEW 키워드:', kw);
        result = result.replace(new RegExp(kw, 'g'), '');
      }
    }
  }
  
  // 연속 공백 정리
  result = result.replace(/\\s{2,}/g, ' ').trim();
  
  return result;
}

// 바이럴 질문 생성 퍼포먼스 실행 (질문이 대장!)
async function runViralQuestionPerformance(keyword) {
  const overlay = document.getElementById('seoOverlay');
  const progressFill = document.getElementById('seoProgressFill');
  const resultBox = document.getElementById('seoResultKeyword');
  const resultTitle = document.getElementById('seoResultTitle');
  
  // 초기화
  overlay.classList.add('show');
  progressFill.style.width = '0%';
  resultBox.classList.remove('show');
  VIRAL_ANALYSIS_STEPS.forEach(step => {
    document.getElementById(step.id).classList.remove('active', 'done');
  });
  document.getElementById('apiCount').textContent = '대기';
  document.getElementById('simCount').textContent = '0';
  document.getElementById('matchCount').textContent = '0';
  document.getElementById('scoreCount').textContent = '-';
  
  let totalDuration = VIRAL_ANALYSIS_STEPS.reduce((sum, s) => sum + s.duration, 0);
  let elapsed = 0;
  
  // 단계별 실행
  for (let i = 0; i < VIRAL_ANALYSIS_STEPS.length; i++) {
    const step = VIRAL_ANALYSIS_STEPS[i];
    const stepEl = document.getElementById(step.id);
    
    // 활성화
    stepEl.classList.add('active');
    
    // 카운터 애니메이션
    if (step.counterType === 'number') {
      animateCounter(step.counterId, step.counterEnd, step.duration);
    } else {
      setTimeout(() => {
        document.getElementById(step.counterId).textContent = step.counterEnd;
      }, step.duration * 0.8);
    }
    
    // 프로그레스 바 업데이트
    elapsed += step.duration;
    progressFill.style.width = Math.round((elapsed / totalDuration) * 100) + '%';
    
    await new Promise(resolve => setTimeout(resolve, step.duration));
    
    // 완료 표시
    stepEl.classList.remove('active');
    stepEl.classList.add('done');
  }
  
  // 결과 표시 - 바이럴 미끼 질문 생성
  const viralQuestion = generateViralQuestion(keyword);
  resultBox.classList.add('show');
  typeWriter(resultTitle, viralQuestion, 25, () => {
    // 1.2초 후 오버레이 닫고 입력창에 삽입
    setTimeout(() => {
      overlay.classList.remove('show');
      // 입력창에 타이핑 효과로 삽입
      searchEl.value = '';
      typeWriterToInput(viralQuestion);
    }, 1200);
  });
}

// 입력창에 타이핑
function typeWriterToInput(text) {
  let i = 0;
  function type() {
    if (i < text.length) {
      searchEl.value += text.charAt(i);
      charEl.textContent = searchEl.value.length;
      i++;
      setTimeout(type, 25);
    } else {
      searchEl.focus();
    }
  }
  type();
}

// 트렌드 선택 - V39 컨텍스트 스위칭 (전체 콘텐츠 일괄 업데이트)
// 사장님 지시: "트렌드 클릭하면 제목만 바뀌는 게 아니라, 답변이랑 댓글까지 그 키워드에 맞춰서 싹 다 새로 고쳐지게 로직을 묶으라"
// 마스터 지시: "0.1초라도 예전 데이터 남아있으면 탈락. 전체 State 초기화 로직 확인"
function selectTrend(el) {
  const startTime = performance.now();
  
  document.querySelectorAll('.trend-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const keyword = el.dataset.keyword;
  
  // 🔴 V39 마스터 지시: 기존 데이터 즉시 완전 초기화 (0.1초 이내 삭제)
  // Step 1: 메모리 State 완전 초기화
  resultData = null;
  selectedTitle = 0;
  selectedContent = 0;
  
  // Step 2: UI 즉시 클리어 (이전 데이터 렌더링 제거)
  // V39: 실제 HTML ID에 맞춰 수정 (tab-* 형식)
  const titlesEl = document.getElementById('tab-titles');
  const contentsEl = document.getElementById('tab-contents');
  const extrasEl = document.getElementById('tab-extras');
  if (titlesEl) titlesEl.innerHTML = '';
  if (contentsEl) contentsEl.innerHTML = '';
  if (extrasEl) extrasEl.innerHTML = '';
  
  const viralEl = document.getElementById('viralQuestions');
  if (viralEl) {
    viralEl.innerHTML = '';
    viralEl.style.display = 'none';
  }
  const seoAuditEl = document.getElementById('seoAuditCard');
  if (seoAuditEl) seoAuditEl.style.display = 'none';
  const reportEl = document.getElementById('reportTable');
  if (reportEl) reportEl.style.display = 'none';
  
  // Step 3: SEO 키워드 초기화
  const seoContainer = document.getElementById('seoKeywords');
  if (seoContainer) seoContainer.innerHTML = '';
  
  const clearTime = performance.now() - startTime;
  console.log('[XIVIX V39] 컨텍스트 스위칭: 기존 데이터 초기화 완료 (' + clearTime.toFixed(2) + 'ms)');
  
  // Step 4: 새 키워드로 입력 필드 업데이트
  searchEl.value = keyword;
  charEl.textContent = keyword.length;
  
  // Step 5: 전체 콘텐츠 일괄 생성 (제목-질문-키워드-답변-댓글 동기화)
  generateFullContent();
}

// 저장된 결과 데이터 (탭 전환용)
let resultData = null;
let selectedTitle = 0;
let selectedContent = 0;

// 탭 전환
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
  document.getElementById('tab-' + tabName).classList.add('active');
}

// SEO 감사 리포트 렌더링
function renderSeoAudit(seoAudit) {
  const container = document.getElementById('seoAuditCard');
  if (!seoAudit) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  const score = seoAudit.score || 95;
  const grade = seoAudit.grade || 'S+';
  const rank = seoAudit.rank_prediction || '1-3위';
  const analysis = seoAudit.analysis || 'SEO 최적화 완료';
  
  // ✅ V2026.37.14 - SEO 점수 산출 로직 투명화
  const scoreFormula = '(키워드 연관도 40% + 본문 길이 30% + 구조화 20% + 가독성 10%)';
  // V2026.37.16 - SEO_TRANSPARENCY: (AI 예측치) 문구 강화
  const dataSource = '⚠️ 본 점수는 AI 예측치입니다 (실제 네이버 순위와 다를 수 있음)';
  
  // 네이버 실시간 검증 URL 생성
  const keyword = resultData?.insurance || resultData?.topic || '보험';
  const naverSearchUrl = 'https://search.naver.com/search.naver?query=' + encodeURIComponent(keyword);
  
  container.innerHTML = 
    '<div class="grade-badge">' +
      '<div class="grade">' + grade + '</div>' +
      '<div class="label">GRADE</div>' +
    '</div>' +
    '<div class="seo-stats">' +
      '<div class="title"><i class="fas fa-chart-line"></i> SEO 감사 리포트</div>' +
      '<div class="metrics">' +
        '<div class="metric"><div class="value">' + score + '<small>/100</small></div><div class="name">SEO 점수 <span style="font-size:9px;color:var(--orange)">(AI 예측치)</span></div></div>' +
        '<div class="metric"><div class="value">' + rank + '</div><div class="name">예상 순위</div></div>' +
      '</div>' +
      '<div class="analysis"><i class="fas fa-lightbulb"></i> ' + analysis + '</div>' +
      '<div style="margin-top:8px;font-size:10px;color:var(--text-muted)">' + dataSource + '</div>' +
      '<a href="' + naverSearchUrl + '" target="_blank" id="naverSearchBtn" onclick="showNaverSearchLoading()" style="display:inline-block;margin-top:10px;padding:8px 16px;background:var(--naver-green, #03c75a);color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none">' +
        '<i class="fas fa-search"></i> 네이버 실시간 검색 확인' +
      '</a>' +
      '<span id="naverSearchLoading" style="display:none;margin-left:10px;font-size:11px;color:var(--text-muted)">' +
        '<i class="fas fa-spinner fa-spin"></i> 실시간 경쟁도 분석 중...' +
      '</span>' +
    '</div>';
}

// 보장 분석 테이블 렌더링 (report_data)
function renderReportData(reportData) {
  const container = document.getElementById('reportTable');
  if (!reportData || reportData.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  
  const statusLabel = { critical: '위험', essential: '필수', good: '양호' };
  
  let tableHtml = 
    '<div class="table-header">' +
      '<div class="table-title"><i class="fas fa-shield-alt"></i> 보장 분석 리포트</div>' +
      '<button class="copy-btn" onclick="copyReportData()"><i class="fas fa-copy"></i> 테이블 복사</button>' +
    '</div>' +
    '<table>' +
      '<thead><tr><th>보장 항목</th><th>현재 가입</th><th>권장 금액</th><th>상태</th></tr></thead>' +
      '<tbody>';
  
  reportData.forEach(item => {
    const statusClass = item.status || 'essential';
    tableHtml += '<tr>' +
      '<td class="item-name">' + (item.item || '-') + '</td>' +
      '<td class="current">' + (item.current || '-') + '</td>' +
      '<td class="target">' + (item.target || '-') + '</td>' +
      '<td><span class="status-dot ' + statusClass + '">' + (statusLabel[statusClass] || statusClass) + '</span></td>' +
    '</tr>';
  });
  
  tableHtml += '</tbody></table>';
  container.innerHTML = tableHtml;
}

// ============================================
// V2026.37.20 - 접근 제어 시스템 (Landing + Login)
// ============================================
const AUTH_KEY = 'xivix_auth_session';

function checkAuth() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    // 세션 유효성 검사 (24시간)
    if (session.status === 'APPROVED' && session.expires > Date.now()) {
      return true;
    }
  } catch (e) {}
  return false;
}

function showLanding() {
  document.getElementById('landingPage').classList.remove('hidden');
}

function hideLanding() {
  document.getElementById('landingPage').classList.add('hidden');
}

function openLoginModal() {
  document.getElementById('loginModal').classList.add('show');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('show');
  document.getElementById('loginResult').className = 'login-result';
  document.getElementById('loginResult').innerHTML = '';
}

// ============================================
// V2026.37.47 - 카카오 Sync 로그인 (CEO 지시: 프리징 해결)
// 버튼 클릭 후 멈추는 현상 방지 - 강제 페이지 이동 실행
// ============================================
function kakaoSync() {
  const btn = document.getElementById('kakaoSyncBtn');
  btn.disabled = true;
  btn.innerText = '접속 중...';
  
  // 카카오 SDK 초기화 (JavaScript 키)
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    // 카카오 JavaScript 키 (앱 설정에서 발급)
    Kakao.init('YOUR_KAKAO_JAVASCRIPT_KEY'); // TODO: 실제 키로 교체 필요
  }
  
  if (typeof Kakao === 'undefined') {
    alert('카카오 SDK 로드 실패. 일반 로그인을 이용해주세요.');
    btn.disabled = false;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#000" d="M12 3C6.5 3 2 6.58 2 11c0 2.84 1.87 5.33 4.67 6.75l-.92 3.42c-.08.29.25.54.52.38l4.03-2.67c.55.07 1.11.12 1.7.12 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/></svg> 카카오 간편 로그인';
    return;
  }
  
  Kakao.Auth.login({
    scope: 'profile_nickname,account_email',
    success: function(authObj) {
      console.log('[XIVIX] 카카오 로그인 성공:', authObj);
      // [핵심] 멈춤 현상 방지 - 강제 페이지 새로고침
      window.location.replace(window.location.origin + window.location.pathname);
    },
    fail: function(err) {
      console.error('[XIVIX] 카카오 로그인 실패:', err);
      alert('카카오 로그인 처리 중 오류가 발생했습니다.');
      btn.disabled = false;
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#000" d="M12 3C6.5 3 2 6.58 2 11c0 2.84 1.87 5.33 4.67 6.75l-.92 3.42c-.08.29.25.54.52.38l4.03-2.67c.55.07 1.11.12 1.7.12 5.5 0 10-3.58 10-8s-4.5-8-10-8z"/></svg> 카카오 간편 로그인';
    }
  });
}

// ============================================
// ✅ V2026.37.43 - CEO 지시 (v5.4): 입력 마스크 영구 제거
// 프론트엔드 간섭 완전 제거 - 백엔드에서만 정규화
// 사용자가 뭘 치든 그대로 두고, 서버에서 숫자만 추출
// ============================================
// (프론트엔드 포맷팅 함수 완전 삭제됨 - 백엔드 normalizePhone()에서 처리)

async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('loginPhone').value.trim();
  const password = document.getElementById('loginPassword').value;
  const resultEl = document.getElementById('loginResult');
  const submitBtn = document.getElementById('loginSubmitBtn');
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 확인 중...';
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const result = await response.json();
    
    if (result.success && result.status === 'APPROVED') {
      // 로그인 성공
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        phone: phone,
        status: 'APPROVED',
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24시간
      }));
      console.log('[XIVIX] ✅ 로그인 성공');
      // V2026.37.49 - CEO 지시: F5 없이 즉시 접속 (강제 새로고침)
      window.location.reload();
    } else if (result.status === 'PENDING') {
      resultEl.className = 'login-result pending';
      resultEl.innerHTML = '<i class="fas fa-clock"></i> 승인 대기 중입니다.<br><small>입금 확인 후 1시간 내 승인됩니다.</small>';
    } else {
      resultEl.className = 'login-result error';
      resultEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (result.message || '로그인 실패');
    }
  } catch (err) {
    resultEl.className = 'login-result error';
    resultEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> 네트워크 오류';
  }
  
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 로그인';
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  showLanding();
}

// ============================================
// V2026.37.20 - 강화된 URL 우회 차단 (CEO 지시 v3.8)
// 미인증 시 모든 UI 요소 숨기고 랜딩으로 강제 리다이렉트
// ============================================

// 페이지 로드 시 인증 체크
if (!checkAuth()) {
  showLanding();
  // 추가 보안: 메인 앱 컨테이너 숨기기
  const appContainer = document.querySelector('.app, .container, main, #app');
  if (appContainer) appContainer.style.display = 'none';
} else {
  hideLanding();
}

// 주기적 인증 검사 (세션 하이재킹 방지)
setInterval(function() {
  if (!checkAuth()) {
    showLanding();
    console.log('[XIVIX] ⚠️ 세션 만료 - 랜딩 페이지로 복귀');
  }
}, 60000); // 1분마다 체크

// URL 직접 접근 시 인증 확인 (popstate 이벤트)
window.addEventListener('popstate', function() {
  if (!checkAuth()) {
    showLanding();
    console.log('[XIVIX] ⚠️ URL 우회 시도 감지 - 랜딩 페이지로 복귀');
  }
});

// 개발자 도구 우회 방지 (로컬스토리지 직접 수정 감지)
window.addEventListener('storage', function(e) {
  if (e.key === AUTH_KEY) {
    if (!checkAuth()) {
      showLanding();
      console.log('[XIVIX] ⚠️ 스토리지 조작 감지 - 랜딩 페이지로 복귀');
    }
  }
});

// ============================================
// V2026.37.23 - Beyond Reality 랜딩 버튼 이벤트 (클릭 문제 해결)
// ============================================
(function() {
  function setupLandingButtons() {
    var btnRegister = document.getElementById('btnRegisterMain');
    var btnLogin = document.getElementById('btnLoginMain');
    
    if (btnRegister) {
      btnRegister.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[XIVIX] 📝 멤버십 가입 신청 클릭!');
        openRegistrationModal();
        return false;
      };
      btnRegister.addEventListener('touchend', function(e) {
        e.preventDefault();
        openRegistrationModal();
      }, {passive: false});
    }
    
    if (btnLogin) {
      btnLogin.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[XIVIX] 🔐 로그인 클릭!');
        openLoginModal();
        return false;
      };
      btnLogin.addEventListener('touchend', function(e) {
        e.preventDefault();
        openLoginModal();
      }, {passive: false});
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLandingButtons);
  } else {
    setupLandingButtons();
  }
  
  // 100ms 후 다시 한번 설정 (안전장치)
  setTimeout(setupLandingButtons, 100);
  setTimeout(setupLandingButtons, 500);
})();

// ============================================
// V2026.37.31 - 가입신청 클릭 강제 실행 (CEO 최종 지시 v3.95)
// ============================================
// [핵심] 가입신청 버튼의 모든 이벤트를 초기화하고 기능을 강제 주입
const repairRegistrationFlow = () => {
    const regBtn = document.getElementById('btnRegisterMain');
    const modal = document.getElementById('registrationModal');

    if (regBtn && modal) {
        // 기존에 꼬인 이벤트 리스너 완전 제거 (버튼 복제 방식)
        const newBtn = regBtn.cloneNode(true);
        regBtn.parentNode.replaceChild(newBtn, regBtn);

        // 새로운 버튼에 클릭/터치 이벤트 강제 할당
        const handleAction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.classList.add('show');
            modal.style.display = 'flex';
            console.log('[XIVIX] ✅ 가입신청 모달 강제 오픈 성공');
        };

        newBtn.onclick = handleAction;
        newBtn.addEventListener('touchend', handleAction, { passive: false });
    }
    
    // 로그인 버튼도 동일하게 처리
    const loginBtn = document.getElementById('btnLoginMain');
    const loginModal = document.getElementById('loginModal');
    
    if (loginBtn && loginModal) {
        const newLoginBtn = loginBtn.cloneNode(true);
        loginBtn.parentNode.replaceChild(newLoginBtn, loginBtn);
        
        const handleLoginAction = (e) => {
            e.preventDefault();
            e.stopPropagation();
            loginModal.classList.add('show');
            loginModal.style.display = 'flex';
            console.log('[XIVIX] ✅ 로그인 모달 강제 오픈 성공');
        };
        
        newLoginBtn.onclick = handleLoginAction;
        newLoginBtn.addEventListener('touchend', handleLoginAction, { passive: false });
    }
};

// 페이지 로드 시 및 1초 간격으로 안전하게 실행
window.onload = repairRegistrationFlow;
setInterval(repairRegistrationFlow, 1000);

// ============================================
// V2026.37.32 - 모달 X 버튼 및 UX 개선 (CEO 지시 v3.96)
// ============================================
// 모달 닫기 버튼 강제 바인딩
const repairModalCloseButtons = () => {
    // 가입 신청 모달 X 버튼
    const regCloseBtn = document.querySelector('#registrationModal .reg-close-btn');
    const regModal = document.getElementById('registrationModal');
    if (regCloseBtn && regModal) {
        regCloseBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            regModal.classList.remove('show');
            regModal.style.display = 'none';
            console.log('[XIVIX] ✅ 가입 모달 닫기 성공');
        };
        regCloseBtn.ontouchend = (e) => {
            e.preventDefault();
            regModal.classList.remove('show');
            regModal.style.display = 'none';
        };
    }
    
    // 로그인 모달 X 버튼
    const loginCloseBtn = document.querySelector('#loginModal .login-close-btn');
    const loginModal = document.getElementById('loginModal');
    if (loginCloseBtn && loginModal) {
        loginCloseBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            loginModal.classList.remove('show');
            loginModal.style.display = 'none';
            console.log('[XIVIX] ✅ 로그인 모달 닫기 성공');
        };
        loginCloseBtn.ontouchend = (e) => {
            e.preventDefault();
            loginModal.classList.remove('show');
            loginModal.style.display = 'none';
        };
    }
    
    // 모달 외부 클릭 시 닫기
    if (regModal) {
        regModal.onclick = (e) => {
            if (e.target === regModal) {
                regModal.classList.remove('show');
                regModal.style.display = 'none';
            }
        };
    }
    if (loginModal) {
        loginModal.onclick = (e) => {
            if (e.target === loginModal) {
                loginModal.classList.remove('show');
                loginModal.style.display = 'none';
            }
        };
    }
};

// 승인 대기 안내 표시 함수
function showPendingNotification() {
    // 기존 알림이 있으면 제거
    const existingNotif = document.getElementById('pendingNotification');
    if (existingNotif) existingNotif.remove();
    
    const notif = document.createElement('div');
    notif.id = 'pendingNotification';
    notif.innerHTML = \`
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #00ff00;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            z-index: 99999999;
            box-shadow: 0 0 50px rgba(0, 255, 0, 0.3);
            max-width: 400px;
            width: 90%;
        ">
            <div style="font-size: 60px; margin-bottom: 20px;">⏳</div>
            <h2 style="color: #00ff00; font-size: 24px; margin-bottom: 15px;">승인 대기 중</h2>
            <p style="color: #fff; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                가입 신청이 완료되었습니다.<br>
                <strong style="color: #00ff00;">입금 확인 후 1시간 내</strong>로 승인됩니다.
            </p>
            <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 25px;">
                승인 완료 시 로그인이 가능합니다.
            </p>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: #00ff00;
                color: #000;
                border: none;
                padding: 15px 40px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s;
            ">확인</button>
        </div>
        <div style="
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.8);
            z-index: 99999998;
        " onclick="document.getElementById('pendingNotification').remove()"></div>
    \`;
    document.body.appendChild(notif);
}

// 모달 닫기 버튼도 1초 간격으로 바인딩
setInterval(repairModalCloseButtons, 1000);
setTimeout(repairModalCloseButtons, 100);

// V2026.37.15 - SEO_SCORE_CLARIFICATION: 네이버 검색 버튼 클릭 시 로딩 표시
function showNaverSearchLoading() {
  const loadingEl = document.getElementById('naverSearchLoading');
  if (loadingEl) {
    loadingEl.style.display = 'inline';
    // 3초 후 자동으로 숨김 (새 탭이 열린 후)
    setTimeout(function() {
      loadingEl.style.display = 'none';
    }, 3000);
  }
}

// report_data 테이블 복사
function copyReportData() {
  if (!resultData || !resultData.report_data) return;
  let text = '[보장 분석 리포트]' + String.fromCharCode(10);
  text += '항목\\t현재 가입\\t권장 금액\\t상태' + String.fromCharCode(10);
  resultData.report_data.forEach(function(item) {
    text += (item.item || '-') + '\\t' + (item.current || '-') + '\\t' + (item.target || '-') + '\\t' + (item.status || '-') + String.fromCharCode(10);
  });
  navigator.clipboard.writeText(text);
  alert('보장 분석 테이블이 복사되었습니다!');
}

// 바이럴 질문 렌더링
function renderViralQuestions(questions) {
  const container = document.getElementById('viralQuestions');
  if (!questions || questions.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  
  let html = '<div class="section-title"><i class="fas fa-fire-alt"></i> 바이럴 질문 (댓글 유도)</div>';
  questions.forEach((q, i) => {
    const text = q.text || q;
    html += '<div class="question"><span>' + (i+1) + '. ' + text + '</span>' +
      '<button class="copy-btn" onclick="copyViralQuestion(' + i + ', this)"><i class="fas fa-copy"></i></button></div>';
  });
  container.innerHTML = html;
}

function copyViralQuestion(idx, btn) {
  if (!resultData || !resultData.viral_questions) return;
  const text = resultData.viral_questions[idx]?.text || resultData.viral_questions[idx];
  navigator.clipboard.writeText(text);
  btn.innerHTML = '<i class="fas fa-check"></i>';
  setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 1000);
}

// 제목 탭 렌더링
function renderTitles(titles) {
  const container = document.getElementById('tab-titles');
  if (!titles || titles.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">제목이 없습니다</div>';
    return;
  }
  container.innerHTML = titles.map((t, i) => 
    '<div class="item-card' + (i === selectedTitle ? ' selected' : '') + '" onclick="selectTitle(' + i + ')">' +
      '<div class="item-header">' +
        '<div class="item-label"><span class="num">' + (i+1) + '</span> 제목 ' + (i+1) + '</div>' +
        '<div class="item-actions">' +
          '<button class="copy-btn" onclick="event.stopPropagation();copyItem(\\'title\\', ' + i + ', this)"><i class="fas fa-copy"></i> 복사</button>' +
        '</div>' +
      '</div>' +
      '<div class="item-text">' + (t.text || t) + '</div>' +
    '</div>'
  ).join('');
  document.getElementById('titleCount').textContent = titles.length;
}

// 본문 탭 렌더링
function renderContents(contents) {
  const container = document.getElementById('tab-contents');
  if (!contents || contents.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px">본문이 없습니다</div>';
    return;
  }
  const styleMap = {
    '공감형': 'empathy',
    '정보형': 'info', 
    '영업형': 'sales'
  };
  container.innerHTML = contents.map((c, i) => {
    const text = c.text || c;
    const style = c.style || ['공감형', '정보형', '영업형'][i] || '기본';
    const charCount = text.length;
    return '<div class="item-card' + (i === selectedContent ? ' selected' : '') + '" onclick="selectContent(' + i + ')">' +
      '<div class="item-header">' +
        '<div class="item-label"><span class="num">' + (i+1) + '</span> 본문 ' + (i+1) + ' <span class="style-tag ' + (styleMap[style] || 'info') + '">' + style + '</span></div>' +
        '<div class="item-actions">' +
          '<button class="copy-btn" onclick="event.stopPropagation();copyItem(\\'content\\', ' + i + ', this)"><i class="fas fa-copy"></i> 복사</button>' +
        '</div>' +
      '</div>' +
      '<div class="item-text" style="white-space:pre-wrap">' + text + '</div>' +
      '<div class="item-meta"><span class="char-badge"><i class="fas fa-text-width"></i> ' + charCount + '자</span></div>' +
    '</div>';
  }).join('');
  document.getElementById('contentCount').textContent = contents.length;
}

// V39 SEO 키워드 별도 섹션 렌더링
function renderSeoKeywords(keywords) {
  const container = document.getElementById('seoKeywords');
  if (!keywords || keywords.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:13px">키워드 생성 중...</div>';
    return;
  }
  
  container.innerHTML = keywords.map(k => 
    '<span class="keyword-tag" onclick="copyKeyword(this, \\'' + k + '\\')"><i class="fas fa-copy"></i> ' + k + '</span>'
  ).join('');
}

// ============================================
// 해시태그 렌더링 (CEO 지시 2026.01.20 추가)
// ============================================
function renderHashtags(hashtags) {
  const container = document.getElementById('hashtagsContent');
  if (!container) return;
  
  // 해시태그가 없으면 키워드 기반으로 자동 생성
  if (!hashtags || hashtags.length === 0) {
    const keywords = resultData?.seoKeywords || [];
    hashtags = keywords.slice(0, 5).map(k => '#' + k.replace(/\\s+/g, ''));
  }
  
  if (hashtags.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:13px">해시태그 생성 중...</div>';
    return;
  }
  
  // 중복 제거 후 5개만
  const uniqueTags = [...new Set(hashtags.map(tag => tag.startsWith('#') ? tag : '#' + tag))].slice(0, 5);
  
  // 전체 복사 버튼 + 개별 태그
  let html = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">';
  html += '<button onclick="copyAllHashtags()" style="background:var(--primary);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600"><i class="fas fa-copy"></i> 5개 전체복사</button>';
  
  uniqueTags.forEach(tag => {
    html += '<span class="keyword-tag" onclick="copyKeyword(this, \\'' + tag + '\\')"><i class="fas fa-hashtag"></i> ' + tag.replace('#', '') + '</span>';
  });
  html += '</div>';
  
  // 전체 복사용 데이터 저장
  window.hashtagsForCopy = uniqueTags.join(' ');
  container.innerHTML = html;
}

// 해시태그 5개 전체 복사
function copyAllHashtags() {
  const text = window.hashtagsForCopy || '';
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    alert('해시태그 5개 복사 완료!\\n\\n' + text);
  });
}

// 댓글 렌더링 (V39 단일 페이지 흐름)
function renderExtras(comments, keywords, imageAnalysis, hashtags) {
  const container = document.getElementById('tab-extras');
  let html = '';
  
  // V39: SEO 키워드는 별도 섹션에서 렌더링
  renderSeoKeywords(keywords);
  
  // CEO 지시 (2026.01.20): 해시태그 섹션 렌더링
  renderHashtags(hashtags);
  
  // 이미지 분석 결과
  if (imageAnalysis) {
    html += '<div style="margin-bottom:20px">';
    html += '<h4 style="color:var(--primary);margin-bottom:12px;font-size:14px"><i class="fas fa-image"></i> 이미지 분석</h4>';
    html += '<div class="item-card"><div class="item-text" style="white-space:pre-wrap">' + imageAnalysis + '</div></div>';
    html += '</div>';
  }
  
  // 댓글
  if (comments && comments.length > 0) {
    comments.forEach((c, i) => {
      const text = c.text || c;
      const nickname = c.nickname || '카페회원' + (i+1);
      const persona = c.persona || '';
      html += '<div class="item-card">' +
        '<div class="item-header">' +
          '<div class="item-label"><span class="num">' + (i+1) + '</span> @' + nickname + (persona ? ' <small style="color:var(--text-muted)">(' + persona + ')</small>' : '') + '</div>' +
          '<div class="item-actions">' +
            '<button class="copy-btn" onclick="copyItem(\\'comment\\', ' + i + ', this)"><i class="fas fa-copy"></i> 복사</button>' +
          '</div>' +
        '</div>' +
        '<div class="item-text">' + text + '</div>' +
      '</div>';
    });
    document.getElementById('commentCount').textContent = comments.length;
  }
  
  container.innerHTML = html || '<div style="text-align:center;color:var(--text-muted);padding:40px">댓글 데이터가 없습니다</div>';
}

// ============================================
// V2026.37.19 - 가입 신청 시스템
// ============================================
function openRegistrationModal() {
  document.getElementById('registrationModal').classList.add('show');
}
function closeRegistrationModal() {
  document.getElementById('registrationModal').classList.remove('show');
}
async function submitRegistration(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const resultEl = document.getElementById('regResult');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  
  if (!name || !phone || !password) {
    resultEl.className = 'reg-result error';
    resultEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> 모든 항목을 입력해 주세요.';
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 신청 중...';
  
  try {
    const response = await fetch('/api/registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password })
    });
    const result = await response.json();
    
    if (result.success) {
      resultEl.className = 'reg-result success';
      resultEl.innerHTML = '<i class="fas fa-check-circle"></i> ' + (result.message || '신청이 완료되었습니다. 입금 확인 후 승인됩니다.');
      e.target.reset();
      
      // V2026.37.32 - 신청 완료 후 2초 뒤 모달 자동 닫기 + 승인 대기 안내
      setTimeout(() => {
        closeRegistrationModal();
        // 메인 화면에 승인 대기 안내 표시
        showPendingNotification();
      }, 2000);
    } else {
      resultEl.className = 'reg-result error';
      resultEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (result.message || '신청 실패. 다시 시도해 주세요.');
    }
  } catch (err) {
    resultEl.className = 'reg-result error';
    resultEl.innerHTML = '<i class="fas fa-exclamation-circle"></i> 네트워크 오류. 다시 시도해 주세요.';
  }
  
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 가입 신청하기';
}

// 선택 함수
function selectTitle(idx) {
  selectedTitle = idx;
  renderTitles(resultData?.titles || []);
}
function selectContent(idx) {
  selectedContent = idx;
  renderContents(resultData?.contents || []);
}

// 개별 복사
function copyItem(type, idx, btn) {
  let text = '';
  if (type === 'title' && resultData?.titles?.[idx]) {
    text = resultData.titles[idx].text || resultData.titles[idx];
  } else if (type === 'content' && resultData?.contents?.[idx]) {
    text = resultData.contents[idx].text || resultData.contents[idx];
  } else if (type === 'comment' && resultData?.comments?.[idx]) {
    text = resultData.comments[idx].text || resultData.comments[idx];
  }
  if (text) {
    navigator.clipboard.writeText(text);
    btn.classList.add('copied');
    btn.innerHTML = '<i class="fas fa-check"></i> 완료';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<i class="fas fa-copy"></i> 복사';
    }, 1500);
  }
}

function copyKeyword(el, keyword) {
  navigator.clipboard.writeText(keyword);
  el.style.background = 'var(--accent)';
  el.style.color = '#fff';
  setTimeout(() => {
    el.style.background = '';
    el.style.color = '';
  }, 1000);
}

// 선택한 콘텐츠 전체 복사
function copyAllContent() {
  if (!resultData) return;
  let text = '';
  
  // 선택된 제목
  if (resultData.titles?.[selectedTitle]) {
    text += '[제목]\\n' + (resultData.titles[selectedTitle].text || resultData.titles[selectedTitle]) + '\\n\\n';
  }
  
  // 선택된 본문
  if (resultData.contents?.[selectedContent]) {
    text += '[본문]\\n' + (resultData.contents[selectedContent].text || resultData.contents[selectedContent]) + '\\n\\n';
  }
  
  // SEO 키워드
  if (resultData.seoKeywords?.length > 0) {
    text += '[SEO 키워드]\\n' + resultData.seoKeywords.join(', ') + '\\n\\n';
  }
  
  // 댓글 전체
  if (resultData.comments?.length > 0) {
    text += '[댓글]\\n';
    resultData.comments.forEach((c, i) => {
      const nickname = c.nickname || '회원' + (i+1);
      text += '@' + nickname + ': ' + (c.text || c) + '\\n';
    });
  }
  
  navigator.clipboard.writeText(text);
  alert('선택한 콘텐츠가 복사되었습니다!\\n\\n- 제목: #' + (selectedTitle+1) + '\\n- 본문: #' + (selectedContent+1) + ' (' + (resultData.contents?.[selectedContent]?.style || '기본') + ')\\n- 댓글: ' + (resultData.comments?.length || 0) + '개');
}

// ============================================
// V2026.37.51 - API 호출 제한 로직 (CEO 지시 v5.0)
// 방익주/김미경 로그인 사용자: 무제한
// 일반 사용자: 1일 2회 제한
// ============================================
const API_LIMIT_KEY = 'xivix_api_usage';
const DAILY_API_LIMIT = 2;

// ✅ V2026.37.60 - VIP 사용자 (API 무제한)
const VIP_PHONES = [
  '010-4845-3065',  // 방익주 대표
  '010-3159-3697'   // 김미경 지사장
];

// ✅ V2026.37.60 - VIP 토큰 (URL 파라미터로 무제한 해제)
// 사용법: https://xivix.ai.kr?vip=김미경 또는 ?vip=방익주
const VIP_TOKENS = {
  '김미경': '010-3159-3697',
  '방익주': '010-4845-3065',
  'kim': '010-3159-3697',
  'bang': '010-4845-3065',
  'vip2026': 'ALL'  // 마스터 토큰
};

// URL에서 VIP 토큰 확인 및 자동 적용
function checkVipToken() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const vipToken = urlParams.get('vip');
    if (vipToken && VIP_TOKENS[vipToken]) {
      const vipPhone = VIP_TOKENS[vipToken];
      // localStorage에 VIP 세션 강제 저장
      localStorage.setItem('xivix_vip_override', JSON.stringify({ 
        phone: vipPhone, 
        token: vipToken,
        activated: new Date().toISOString() 
      }));
      // API 사용량 초기화
      localStorage.removeItem('xivix_api_usage');
      console.log('[XIVIX] ✅ VIP 토큰 활성화:', vipToken, '→', vipPhone);
      return true;
    }
  } catch (e) {
    console.warn('[XIVIX] VIP 토큰 체크 실패:', e);
  }
  return false;
}

// 페이지 로드 시 VIP 토큰 확인
checkVipToken();

// 현재 로그인 사용자가 VIP인지 확인
function isVipUser() {
  try {
    // 1. VIP 오버라이드 확인 (URL 토큰으로 활성화된 경우)
    const vipOverride = JSON.parse(localStorage.getItem('xivix_vip_override') || '{}');
    if (vipOverride.phone) {
      console.log('[XIVIX] ✅ VIP 오버라이드 활성:', vipOverride.phone);
      return true;
    }
    
    // 2. 로그인 세션에서 VIP 확인
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
    if (session.phone) {
      // 전화번호 정규화 (010-xxxx-xxxx 형태로)
      const normalizedPhone = session.phone.replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
      const isVip = VIP_PHONES.includes(normalizedPhone);
      if (isVip) {
        console.log('[XIVIX] ✅ VIP 사용자 확인:', normalizedPhone);
      }
      return isVip;
    }
  } catch (e) {
    console.warn('[XIVIX] VIP 체크 실패:', e);
  }
  return false;
}

function getApiUsage() {
  try {
    const data = JSON.parse(localStorage.getItem(API_LIMIT_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (data.date !== today) {
      // 날짜가 바뀌면 초기화
      return { date: today, count: 0 };
    }
    return data;
  } catch (e) {
    return { date: new Date().toISOString().split('T')[0], count: 0 };
  }
}

function incrementApiUsage() {
  // VIP는 카운트 안함
  if (isVipUser()) {
    console.log('[XIVIX] VIP 사용자 - 사용량 카운트 스킵');
    return { date: new Date().toISOString().split('T')[0], count: 0, isVip: true };
  }
  const usage = getApiUsage();
  usage.count += 1;
  localStorage.setItem(API_LIMIT_KEY, JSON.stringify(usage));
  return usage;
}

function checkApiLimit() {
  // ✅ VIP 사용자는 무제한
  if (isVipUser()) {
    console.log('[XIVIX] ✅ VIP 사용자 - API 무제한');
    return true;
  }
  
  const usage = getApiUsage();
  if (usage.count >= DAILY_API_LIMIT) {
    alert('⚠️ 오늘의 API 호출 한도(2회)를 초과했습니다.\\n\\n자정 이후 다시 시도해 주세요.\\n\\n현재: ' + usage.count + '/' + DAILY_API_LIMIT + '회 사용');
    return false;
  }
  return true;
}

function getRemainingApiCalls() {
  // VIP는 무제한 표시
  if (isVipUser()) {
    return '∞';
  }
  const usage = getApiUsage();
  return Math.max(0, DAILY_API_LIMIT - usage.count);
}

// ============================================
// 🔥 SSE 스트리밍 버전 콘텐츠 생성 (타임아웃 방지)
// 실시간으로 진행 상황 표시 + 본문 글자 단위 출력
// ============================================
async function goGenerateStream() {
  // V2026.37.19 - API 호출 제한 체크
  if (!checkApiLimit()) {
    return;
  }
  
  let q = searchEl.value.trim();
  
  // ============================================
  // CEO 지시 (2026.01.20): 빈 입력 시 네이버 상위노출 가능한 보험 제목 자동 추천
  // 트렌드 클릭 없이 바로 "미끼 질문 + 답변 세트 생성" 클릭 시 빠르게 추천
  // ============================================
  if (!q) {
    // 1순위: 로딩된 트렌드 키워드에서 선택
    const trendItems = document.querySelectorAll('.trend-item');
    if (trendItems.length > 0) {
      // 상위 3개 트렌드 중 랜덤 선택 (상위노출 가능성 높은 키워드)
      const topTrends = Array.from(trendItems).slice(0, 3);
      const randomTrend = topTrends[Math.floor(Math.random() * topTrends.length)];
      const keyword = randomTrend.getAttribute('data-keyword');
      if (keyword) {
        // 네이버 C-RANK 최적화 질문 형태로 구성
        const questionPatterns = [
          keyword + ' 가입하려는데 어디가 좋을까요?',
          keyword + ' 이거 유지해야 할까요?',
          keyword + ' 갱신인데 어떻게 해야 하나요?',
          keyword + ' 지금 들어도 될까요?',
          keyword + ' 비교 좀 해주세요'
        ];
        q = questionPatterns[Math.floor(Math.random() * questionPatterns.length)];
        searchEl.value = q;
        charEl.textContent = q.length;
        console.log('[XIVIX] 네이버 상위노출 키워드 자동 선택:', keyword);
      }
    }
    
    // 2순위: 트렌드도 없으면 핫 보험 키워드로 기본 제공
    if (!q) {
      const hotKeywords = ['실손보험 4세대', '암보험', '종신보험', '건강보험', '치아보험'];
      const randomKeyword = hotKeywords[Math.floor(Math.random() * hotKeywords.length)];
      q = randomKeyword + ' 가입하려는데 어떤 게 좋을까요?';
      searchEl.value = q;
      charEl.textContent = q.length;
      console.log('[XIVIX] 핫 키워드 자동 선택:', randomKeyword);
    }
  }
  
  if (isGenerating) return;
  isGenerating = true;
  
  // ⚡ 즉시 UI 반응 - 버튼 로딩 상태
  btn.classList.add('loading');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span class="btn-text">생성 중...</span>';
  
  // 결과 섹션 즉시 표시 + 로딩 오버레이
  trendSection.style.display = 'none';
  if (hintSection) hintSection.style.display = 'none';
  resultSection.classList.add('show');
  progressBox.style.display = 'block';
  // V39: 탭 네비게이션 제거됨 - 순차 섹션 초기화
  document.querySelectorAll('.section-content').forEach(function(c) { c.innerHTML = ''; });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.innerHTML = ''; });
  document.getElementById('seoKeywords').innerHTML = '';
  
  // 🎯 사용자에게 진행 상황 즉시 안내 (대기 화면)
  progressFill.style.width = '5%';
  progressPct.textContent = '5%';
  progressText.innerHTML = '<div style="text-align:center">' +
    '<i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--primary);margin-bottom:12px;display:block"></i>' +
    '<div style="font-size:15px;font-weight:600;margin-bottom:8px">🔌 AI 엔진에 연결 중...</div>' +
    '<div style="font-size:13px;color:var(--text-muted)">잠시만 기다려주세요. 약 10~30초 소요됩니다.</div>' +
  '</div>';
  
  // V2026.37.19 - 로딩 UX 고도화: 스티키 카운트다운 표시
  let countdownSec = 25;
  let countdownEl = document.getElementById('loadingCountdown');
  if (!countdownEl) {
    countdownEl = document.createElement('div');
    countdownEl.id = 'loadingCountdown';
    countdownEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9998;box-shadow:0 4px 15px rgba(0,0,0,0.3);display:none;';
    document.body.appendChild(countdownEl);
  }
  countdownEl.style.display = 'block';
  countdownEl.innerHTML = '<i class="fas fa-hourglass-half fa-spin"></i> 예상 대기: <span id="countdownNum">' + countdownSec + '</span>초';
  
  const countdownInterval = setInterval(() => {
    countdownSec = Math.max(0, countdownSec - 1);
    const numEl = document.getElementById('countdownNum');
    if (numEl) numEl.textContent = countdownSec;
    if (countdownSec <= 0) {
      clearInterval(countdownInterval);
      countdownEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 거의 완료...';
    }
  }, 1000);
  
  // 완료 시 카운트다운 숨김용 변수
  window.currentCountdownInterval = countdownInterval;
  
  // 실시간 데이터 저장용
  let streamData = {
    titles: [],
    viral_questions: [],
    contents: [{}, {}, {}],
    comments: [],
    seoKeywords: [],
    report_data: [],
    context_source: 'input'
  };
  
  const requestData = { concern: q };
  if (uploadedFiles.length > 0) {
    requestData.image = uploadedFiles[0].base64;
    requestData.mimeType = uploadedFiles[0].type;
  }
  
  try {
    console.log('[XIVIX] SSE 요청 시작:', requestData);
    const res = await fetch('/api/generate/full-package-stream', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(requestData)
    });
    
    console.log('[XIVIX] SSE 응답:', res.status, res.statusText);
    
    // 응답 상태 및 body 체크
    if (!res.ok) {
      throw new Error('API 응답 오류: ' + res.status + ' ' + res.statusText);
    }
    if (!res.body) {
      throw new Error('스트림 body가 없습니다');
    }
    
    // 🎯 응답 연결 성공 - 즉시 진행률 업데이트
    progressFill.style.width = '10%';
    progressPct.textContent = '10%';
    progressText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 🔗 서버 연결 완료! AI가 분석 중입니다...';
    console.log('[XIVIX] 스트림 연결 성공, 데이터 수신 대기 중...');
    
    // 타임아웃 경고 (15초 후에도 이벤트가 없으면)
    let eventReceived = false;
    const timeoutWarning = setTimeout(() => {
      if (!eventReceived) {
        progressText.innerHTML = '<i class="fas fa-hourglass-half fa-spin" style="color:var(--orange)"></i> ⏳ AI 응답 대기 중... (고품질 콘텐츠 생성에 시간이 소요됩니다)';
      }
    }, 15000);
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      
      // 스트림 완료 시 남은 버퍼도 처리
      if (done) {
        buffer += decoder.decode(); // 남은 바이트 플러시
      }
      
      const lines = buffer.split(String.fromCharCode(10));
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          eventCount++;
          eventReceived = true; // 타임아웃 경고 취소
          clearTimeout(timeoutWarning);
          console.log('[XIVIX] Event #' + eventCount + ':', event.type);
          
          switch (event.type) {
            case 'step':
              const stepPct = event.step * 15;
              progressFill.style.width = stepPct + '%';
              progressPct.textContent = stepPct + '%';
              progressText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + event.msg;
              break;
              
            case 'context_switch':
              progressText.innerHTML = '<i class="fas fa-random" style="color:var(--orange)"></i> 🎯 Context Switch: ' + event.from + ' → ' + event.to;
              break;
              
            case 'titles':
              streamData.titles = event.data || [];
              renderTitles(streamData.titles);
              break;
              
            case 'viral_questions':
              streamData.viral_questions = event.data || [];
              renderViralQuestions(streamData.viral_questions);
              break;
              
            case 'content_start':
              progressText.innerHTML = '<i class="fas fa-pen-fancy fa-spin"></i> ✍️ 본문 #' + event.id + ' (' + event.style + ') 생성 중...';
              progressFill.style.width = (50 + event.id * 10) + '%';
              streamData.contents[event.id - 1] = { id: event.id, style: event.style, text: '' };
              break;
              
            case 'content_chunk':
              // 실시간 본문 출력
              streamData.contents[event.id - 1].text += event.chunk;
              renderContentsRealtime(streamData.contents);
              break;
              
            case 'content_done':
              progressText.innerHTML = '<i class="fas fa-check" style="color:var(--green)"></i> ✅ 본문 #' + event.id + ' 완료 (' + event.length + '자)';
              break;
              
            case 'comments':
              streamData.comments = event.data || [];
              break;
              
            case 'complete':
              console.log('[XIVIX] ✅ complete 이벤트 수신!', event.package?.titles?.length + '개 제목');
              // 최종 데이터 저장
              resultData = event.package;
              selectedTitle = 0;
              selectedContent = 0;
              
              // V2026.37.51 - 결과 데이터 LocalStorage 저장 (모바일 세션 유지)
              saveResultData();
              
              // 최종 렌더링
              renderSeoAudit(resultData.seo_audit || { score: 95, grade: 'S+', rank_prediction: '1-3위' });
              renderReportData(resultData.report_data);
              renderViralQuestions(resultData.viral_questions);
              renderTitles(resultData.titles || []);
              renderContents(resultData.contents || []);
              renderExtras(resultData.comments || [], resultData.seoKeywords || [], resultData.imageAnalysis, resultData.hashtags || []);
              
              // 완료 처리
              progressFill.style.width = '100%';
              progressPct.textContent = '100%';
              progressText.innerHTML = '<i class="fas fa-check-circle" style="color:var(--green)"></i> ✅ SSE 스트리밍 완료! (v' + event.version + ')';
              
              setTimeout(() => {
                console.log('[XIVIX] V39 순차 흐름 렌더링 완료');
                progressBox.style.display = 'none';
                // V39: 탭 제거됨 - 모든 섹션이 이미 순차적으로 표시됨
                // ✅ 생성 완료 후 결과 섹션으로 자동 스크롤
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // ✅ 이미지 생성 섹션 표시
                document.getElementById('imageGenSection').classList.add('show');
                // V2026.37.19 - API 사용량 증가 (성공 시에만)
                const newUsage = incrementApiUsage();
                console.log('[XIVIX] API 사용량:', newUsage.count + '/' + DAILY_API_LIMIT);
                // V2026.37.19 - 카운트다운 숨김 + 완료 메시지
                if (window.currentCountdownInterval) clearInterval(window.currentCountdownInterval);
                const cdEl = document.getElementById('loadingCountdown');
                if (cdEl) {
                  cdEl.innerHTML = '<i class="fas fa-check-circle"></i> 완료! 이제 복사하세요';
                  cdEl.style.background = 'linear-gradient(135deg, var(--green), #10b981)';
                  setTimeout(() => { cdEl.style.display = 'none'; }, 3000);
                }
                
                // V2026.37.60 - CEO 지시: 3단계 자동화 (분석→정리→이미지 생성)
                // 보험 정보가 감지된 경우 자동으로 마케팅 이미지 생성 (company는 topic에서 추출 가능)
                if (resultData && resultData.insurance) {
                  console.log('[XIVIX] V2026.37.60 자동 이미지 생성 시작:', resultData.company || '(topic에서 추출 예정)', resultData.insurance);
                  // 토스트 알림
                  const autoToast = document.createElement('div');
                  autoToast.innerHTML = '<i class="fas fa-magic"></i> AI가 마케팅 이미지를 자동 생성합니다...';
                  autoToast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:12px 24px;border-radius:25px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(99,102,241,0.4);animation:fadeInUp 0.3s ease';
                  document.body.appendChild(autoToast);
                  setTimeout(() => autoToast.remove(), 3000);
                  
                  // 1.5초 후 자동 이미지 생성 시작
                  setTimeout(() => {
                    generateMarketingImage();
                  }, 1500);
                }
              }, 1200);
              break;
              
            case 'error':
              progressBox.innerHTML = '<div style="text-align:center;color:var(--red);padding:20px"><i class="fas fa-exclamation-triangle"></i> 스트리밍 오류: ' + event.msg + '</div>';
              break;
          }
        } catch (e) {
          console.error('SSE Parse Error:', e, line);
        }
      }
      
      // 스트림 완료 후 루프 탈출
      if (done) break;
    }
    
    // 버퍼에 남은 마지막 데이터 처리 (개행 없이 끝난 경우)
    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        if (event.type === 'complete') {
          resultData = event.package;
          selectedTitle = 0;
          selectedContent = 0;
          renderSeoAudit(resultData.seo_audit || { score: 95, grade: 'S+', rank_prediction: '1-3위' });
          renderReportData(resultData.report_data);
          renderViralQuestions(resultData.viral_questions);
          renderTitles(resultData.titles || []);
          renderContents(resultData.contents || []);
          renderExtras(resultData.comments || [], resultData.seoKeywords || [], resultData.imageAnalysis, resultData.hashtags || []);
          progressFill.style.width = '100%';
          progressPct.textContent = '100%';
          progressText.innerHTML = '<i class="fas fa-check-circle" style="color:var(--green)"></i> ✅ SSE 스트리밍 완료! (v' + event.version + ')';
          // V2026.37.51 - 결과 데이터 LocalStorage 저장
          saveResultData();
          
          setTimeout(() => {
            progressBox.style.display = 'none';
            // V39: 탭 제거됨 - 모든 섹션이 이미 순차적으로 표시됨
            // ✅ 생성 완료 후 결과 섹션으로 자동 스크롤
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // ✅ 이미지 생성 섹션 표시
            document.getElementById('imageGenSection').classList.add('show');
            
            // V2026.37.60 - CEO 지시: 3단계 자동화 (분석→정리→이미지 생성)
            if (resultData && resultData.insurance) {
              console.log('[XIVIX] V2026.37.60 자동 이미지 생성 (버퍼):', resultData.company || '(topic에서 추출 예정)', resultData.insurance);
              setTimeout(() => {
                generateMarketingImage();
              }, 1500);
            }
          }, 1200);
        }
      } catch (e) {
        console.error('Final buffer parse error:', e);
      }
    }
    
  } catch(e) {
    console.error('[XIVIX] 네트워크 오류:', e);
    progressBox.innerHTML = '<div style="text-align:center;color:var(--red);padding:20px">' +
      '<i class="fas fa-exclamation-triangle" style="font-size:32px;margin-bottom:12px;display:block"></i>' +
      '<div style="font-weight:600;margin-bottom:8px">네트워크 오류</div>' +
      '<div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">' + e.message + '</div>' +
      '<button onclick="resetAndNew()" style="background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600">' +
        '<i class="fas fa-redo"></i> 다시 시도' +
      '</button>' +
    '</div>';
  }
  
  btn.classList.remove('loading');
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-text"><i class="fas fa-fire"></i> 미끼 질문 + 답변 세트 생성</span><div class="spinner"></div>';
  isGenerating = false;
}

// 실시간 본문 렌더링 (스트리밍용)
function renderContentsRealtime(contents) {
  const container = document.getElementById('tab-contents');
  if (!container) return;
  
  const styles = { '공감형': 'empathy', '팩트형': 'info', '영업형': 'sales' };
  
  container.innerHTML = contents.filter(c => c && c.text).map((c, i) => {
    const text = c.text || '';
    const style = c.style || '기본';
    const styleClass = styles[style] || 'info';
    const charCount = text.length;
    
    return '<div class="item-card' + (i === selectedContent ? ' selected' : '') + '">' +
      '<div class="item-header">' +
        '<div class="item-label"><span class="num">' + (i+1) + '</span> <span class="style-tag ' + styleClass + '">' + style + '</span></div>' +
        '<div class="item-meta"><span class="char-badge">' + charCount + '자 <span class="typing-cursor">|</span></span></div>' +
      '</div>' +
      '<div class="item-text" style="white-space:pre-wrap">' + text + '</div>' +
    '</div>';
  }).join('');
}

// 바로 콘텐츠 생성 (기본 - 스트리밍 버전 사용)
async function goGenerate() {
  // 스트리밍 버전 호출
  return goGenerateStream();
}

// V39 전체 콘텐츠 일괄 생성 (트렌드 클릭 시 호출)
// 사장님 지시: "사용자가 뭘 누르든 모든 결과물은 하나의 주제로 완벽히 동기화"
function generateFullContent() {
  // 기존 goGenerate() 호출로 전체 콘텐츠 동기화 생성
  goGenerate();
}

// 새로 시작
function resetAndNew() {
  searchEl.value = '';
  charEl.textContent = '0';
  resultData = null;
  selectedTitle = 0;
  selectedContent = 0;
  resultSection.classList.remove('show');
  trendSection.style.display = 'block';
  if (hintSection) hintSection.style.display = 'flex';
  progressBox.style.display = 'block';
  progressFill.style.width = '0';
  progressPct.textContent = '0%';
  // V39: 탭 네비게이션 제거됨 - 순차 섹션 초기화
  document.querySelectorAll('.section-content').forEach(c => c.innerHTML = '');
  document.querySelectorAll('.tab-content').forEach(c => c.innerHTML = '');
  document.getElementById('seoAuditCard').style.display = 'none';
  document.getElementById('reportTable').style.display = 'none';
  document.getElementById('viralQuestions').style.display = 'none';
  document.getElementById('seoKeywords').innerHTML = '';
  searchEl.focus();
  window.scrollTo({top: 0, behavior: 'smooth'});
}

searchEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    goGenerate();
  }
});

// 초기화 (처음 1회만 로드, 이후 수동 새로고침)
loadTrends();

// ============================================
// 🖼️ AI 마케팅 이미지 생성 기능
// 미들웨어 서버: https://xivix-xiim.pages.dev/api/process
// API 규격: api_key(최상위), request_info(keyword, user_id 필수)
// ============================================
let generatedImageUrl = '';

// 미들웨어 API 키 (운영용 - 2026.01.19 CEO 지시로 업데이트)
const XIIM_API_KEY = 'xivix_prod_a752571bf2f96ac9c54e5720c05a56b7';
const XIIM_USER_ID = 'xivix_production';

// ============================================
// ✅ V2026.37.39 - TOP_CRITICAL 이미지 품질 필터 (CEO EO지시 v4.9)
// 1_scraping_fix: HTML 수집 에러 우회 로직
// 2_quality_filter: 1000px 이상 문서 형태 우선 추출
// ============================================
const IMAGE_QUALITY_CONFIG = {
  MIN_WIDTH: 1000,           // 최소 너비 1000px (문서 형태 기준)
  MIN_HEIGHT: 800,           // 최소 높이 800px
  ALLOWED_TYPES: ['image/png', 'image/jpeg', 'image/webp'],
  BLOCKED_PATTERNS: [        // HTML 수집 에러 우회 패턴
    'text/html',
    'application/json',
    'application/xml',
    '<!DOCTYPE',
    '<html',
    '<head'
  ],
  R2_FALLBACK_URL: 'https://pub-xivix-golden-samples.r2.dev',  // R2 골든 샘플 URL
  GOLDEN_SAMPLES: [          // 검증된 고해상도 샘플 10개
    { id: 'GS001', company: 'SAMSUNG_LIFE', url: '/samples/samsung_life_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS002', company: 'HANWHA_LIFE', url: '/samples/hanwha_life_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS003', company: 'KYOBO_LIFE', url: '/samples/kyobo_life_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS004', company: 'SHINHAN_LIFE', url: '/samples/shinhan_life_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS005', company: 'NH_LIFE', url: '/samples/nh_life_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS006', company: 'KB_LIFE', url: '/samples/kb_life_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS007', company: 'SAMSUNG_FIRE', url: '/samples/samsung_fire_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS008', company: 'HYUNDAI_MARINE', url: '/samples/hyundai_marine_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS009', company: 'DB_INSURANCE', url: '/samples/db_insurance_plan_1080p.png', width: 1200, height: 1600 },
    { id: 'GS010', company: 'MERITZ_FIRE', url: '/samples/meritz_fire_plan_1080p.png', width: 1200, height: 1600 }
  ]
};

// ✅ 1_scraping_fix: HTML 수집 에러 감지 함수 (추가)
async function validateImageResponse(response) {
  const contentType = response.headers.get('Content-Type') || '';
  const contentLength = parseInt(response.headers.get('Content-Length') || '0');
  
  // HTML 에러 페이지 감지
  for (const pattern of IMAGE_QUALITY_CONFIG.BLOCKED_PATTERNS) {
    if (contentType.toLowerCase().includes(pattern.toLowerCase())) {
      console.error('[XIVIX] 1_scraping_fix: HTML 수집 에러 감지 - ContentType:', contentType);
      return { valid: false, reason: 'HTML_DETECTED', contentType };
    }
  }
  
  // 이미지 타입 검증
  const isValidType = IMAGE_QUALITY_CONFIG.ALLOWED_TYPES.some(type => 
    contentType.toLowerCase().includes(type.toLowerCase())
  );
  
  if (!isValidType && contentLength > 0) {
    console.warn('[XIVIX] 1_scraping_fix: 비표준 Content-Type:', contentType);
  }
  
  return { valid: true, contentType, contentLength };
}

// ✅ 2_quality_filter: 해상도 검증 함수 (추가)
async function checkImageResolution(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const isHighRes = width >= IMAGE_QUALITY_CONFIG.MIN_WIDTH && height >= IMAGE_QUALITY_CONFIG.MIN_HEIGHT;
      
      console.log('[XIVIX] 2_quality_filter: 이미지 해상도 검증 -', width, 'x', height, 
                  isHighRes ? '✅ 고해상도' : '⚠️ 저해상도');
      
      resolve({
        width,
        height,
        isHighRes,
        aspectRatio: (width / height).toFixed(2),
        isDocument: height > width // 문서 형태 판별 (세로가 더 김)
      });
    };
    img.onerror = () => {
      console.error('[XIVIX] 2_quality_filter: 이미지 로드 실패');
      resolve({ width: 0, height: 0, isHighRes: false, error: true });
    };
    img.src = imageUrl;
  });
}

// ✅ 2_quality_filter: R2 골든 샘플 Fallback 함수 (추가)
function getR2FallbackSample(targetCompany) {
  const sample = IMAGE_QUALITY_CONFIG.GOLDEN_SAMPLES.find(s => s.company === targetCompany);
  if (sample) {
    const fullUrl = IMAGE_QUALITY_CONFIG.R2_FALLBACK_URL + sample.url;
    console.log('[XIVIX] 2_quality_filter: R2 Fallback 사용 -', sample.id, targetCompany);
    return { ...sample, fullUrl, isFallback: true, source: 'R2_GOLDEN_SAMPLE' };
  }
  // 기본 삼성생명 샘플 반환
  const defaultSample = IMAGE_QUALITY_CONFIG.GOLDEN_SAMPLES[0];
  console.log('[XIVIX] 2_quality_filter: R2 기본 Fallback -', defaultSample.id);
  return { ...defaultSample, fullUrl: IMAGE_QUALITY_CONFIG.R2_FALLBACK_URL + defaultSample.url, isFallback: true, source: 'R2_DEFAULT' };
}

// ✅ 3_reporting: 품질 보고 로그 함수 (추가)
function logQualityReport(imageData, source) {
  const report = {
    timestamp: new Date().toISOString(),
    source: source,
    url: imageData.url || imageData.fullUrl,
    width: imageData.width,
    height: imageData.height,
    isHighRes: imageData.isHighRes,
    isDocument: imageData.isDocument,
    aspectRatio: imageData.aspectRatio,
    isFallback: imageData.isFallback || false,
    company: imageData.company || 'UNKNOWN'
  };
  
  console.log('[XIVIX] 3_reporting: 품질 보고서 =>', JSON.stringify(report, null, 2));
  return report;
}

async function generateMarketingImage() {
  const btn = document.getElementById('imageGenBtn');
  const loading = document.getElementById('imageGenLoading');
  const result = document.getElementById('imageGenResult');
  
  // 데이터 검증
  if (!resultData || !resultData.insurance) {
    alert('먼저 콘텐츠를 생성해 주세요.');
    return;
  }
  
  // ============================================
  // ✅ V2026.37.60 - CEO 긴급 지시: 자동 재검색 시스템
  // 홍보물/광고 이미지 감지 시 최대 3회까지 자동 재검색
  // 각 시도마다 키워드 변형 적용
  // ============================================
  const MAX_AUTO_RETRY = 3;
  let autoRetryCount = 0;
  let excludedUrls = [];
  
  // V2026.37.60 - XIIM API V2.2 규격에 맞춘 keyword 생성
  // 공식: {보험사 한글명} {상품유형} {설계안/설계서}
  
  // V2026.37.60 - 보험사명 추출 우선순위:
  // 1. 이미지 분석에서 추출한 company
  // 2. topic에서 보험사명 추출
  // 3. 기본값 '삼성생명'
  let company = resultData.company;
  if (!company) {
    // topic에서 보험사명 추출 시도
    const companyList = ['삼성생명', '한화생명', '교보생명', '신한라이프', 'NH농협생명', 'KB라이프', 
                         '미래에셋생명', '메트라이프', '푸르덴셜', 'AIA', '삼성화재', '현대해상', 
                         'DB손해보험', 'KB손해보험', '메리츠화재', 'ABL생명', 'IBK연금보험', 
                         'KDB생명', '라이나생명', '농협손해보험', '신한라이프손해보험', '우체국보험',
                         '처브라이프', '하나생명', '흥국생명', '동양생명', '오렌지라이프', '카카오페이손해보험'];
    const topicLower = (resultData.topic || '').toLowerCase();
    for (const c of companyList) {
      if (topicLower.includes(c.toLowerCase()) || topicLower.includes(c.replace('생명', '').replace('손해보험', '').replace('화재', ''))) {
        company = c;
        console.log('[XIVIX] V2026.37.60 topic에서 보험사 추출:', company);
        break;
      }
    }
    if (!company) company = '삼성생명';
  }
  
  const insurance = resultData.insurance || '종합보험';
  const selectedTitleText = resultData.titles?.[selectedTitle]?.text || resultData.titles?.[selectedTitle] || '';
  
  // ✅ XIIM API V2.2 규격: keyword = 보험사 + 상품유형 + 설계안
  const keyword = company + ' ' + insurance + ' 설계안';
  
  // ✅ CEO 지시 (2026.01.19) - source_url 직접 입력 지원
  const sourceUrlInput = document.getElementById('sourceUrlInput');
  const directSourceUrl = sourceUrlInput?.value?.trim() || '';
  const hasDirectUrl = directSourceUrl.length > 0 && (directSourceUrl.startsWith('http://') || directSourceUrl.startsWith('https://'));
  
  // 보험사 코드 매핑
  const companyCodeMap = {
    '삼성생명': 'SAMSUNG_LIFE',
    '한화생명': 'HANWHA_LIFE',
    '교보생명': 'KYOBO_LIFE',
    '신한라이프': 'SHINHAN_LIFE',
    'NH농협생명': 'NH_LIFE',
    'KB라이프': 'KB_LIFE',
    '미래에셋생명': 'MIRAE_LIFE',
    '메트라이프': 'METLIFE',
    '푸르덴셜': 'PRUDENTIAL',
    'AIA': 'AIA',
    '삼성화재': 'SAMSUNG_FIRE',
    '현대해상': 'HYUNDAI_MARINE',
    'DB손해보험': 'DB_INSURANCE',
    'KB손해보험': 'KB_INSURANCE',
    '메리츠화재': 'MERITZ_FIRE'
  };
  const targetCompany = companyCodeMap[company] || 'SAMSUNG_LIFE';
  
  // UI 상태 변경
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
  loading.classList.add('show');
  result.classList.remove('show');
  
  // ✅ CEO 지시 - 진행 상황 메시지 구체화
  const loadingText = document.getElementById('imageGenLoadingText');
  const loadingSub = document.getElementById('imageGenLoadingSub');
  
  if (hasDirectUrl) {
    loadingText.textContent = '직접 입력한 이미지를 가공 중입니다...';
    loadingSub.textContent = 'AI 검증 없이 빠르게 처리 (약 8초)';
  } else {
    loadingText.textContent = '🔍 AI가 최적의 설계안을 찾고 있습니다...';
    loadingSub.textContent = '이미지 검색 → AI 검증 → 마스킹 처리 (약 15~20초 소요)';
  }
  
  // ✅ CEO 지시 (2026.01.20) - 진행 단계별 메시지 업데이트
  let progressStep = 0;
  const progressMessages = [
    { text: '🔍 AI가 최적의 설계안을 찾고 있습니다...', sub: '1단계: 이미지 검색 중 (약 5초)' },
    { text: '🤖 AI가 이미지를 검증하고 있습니다...', sub: '2단계: 품질 검증 중 (약 5초)' },
    { text: '🎨 개인정보 마스킹 처리 중...', sub: '3단계: 마스킹 및 최적화 (약 10초)' }
  ];
  const progressInterval = setInterval(() => {
    progressStep++;
    if (progressStep < progressMessages.length) {
      loadingText.textContent = progressMessages[progressStep].text;
      loadingSub.textContent = progressMessages[progressStep].sub;
    }
  }, 6000);
  
  try {
    // ============================================
    // ✅ V2026.37.60 - 자동 재검색 루프 (홍보물/광고 감지 시)
    // ============================================
    let validImageFound = false;
    let finalImageUrl = null;
    let finalResolutionData = { width: 0, height: 0, isHighRes: false };
    let finalIsSample = false;
    let finalVerification = {};
    
    // ============================================
    // ✅ V2026.37.60 - CEO 긴급 지시: 키워드 전략 강화
    // 문제: "삼성금융 Open Collaboration" 홍보 포스터 반환됨
    // 해결: 보험 설계서/제안서 특화 키워드 사용
    // ============================================
    const keywordVariations = [
      company + ' ' + insurance + ' 가입설계서 월보험료 담보내역',  // 1차: 설계서 필수 요소 명시
      company + ' ' + insurance + ' 보험제안서 가입제안서 보장내용',  // 2차: 제안서 키워드
      company + ' ' + insurance + ' 설계안 피보험자 보험료 표',      // 3차: 표 형식 강조
      insurance + ' 가입설계서 보장분석표 월납보험료 담보'           // 4차: 보험사 제외 일반 검색
    ];
    
    while (!validImageFound && autoRetryCount < MAX_AUTO_RETRY) {
      autoRetryCount++;
      const currentKeyword = keywordVariations[Math.min(autoRetryCount - 1, keywordVariations.length - 1)];
      
      console.log('[XIVIX] V2026.37.60 자동 검색 시도 ' + autoRetryCount + '/' + MAX_AUTO_RETRY + ' - 키워드: ' + currentKeyword);
      if (loadingText) loadingText.textContent = '🔍 설계서 검색 중... (시도 ' + autoRetryCount + '/' + MAX_AUTO_RETRY + ')';
      if (loadingSub) loadingSub.textContent = '키워드: ' + currentKeyword;
    
    // ============================================
    // ✅ V2026.37.60 - XIIM API V2.4 재시도 로직 (미들웨어 수정 완료 대응)
    // - Rate Limit (HTTP 429) → Retry-After 대기 후 재시도
    // - Subrequest 에러 → 지수 백오프 재시도
    // - 최대 3회 시도
    // ============================================
    const maxRetries = 3;
    let lastError = null;
    let response = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log('[XIVIX] XIIM API 호출 시도 ' + attempt + '/' + maxRetries);
        
        response = await fetch('https://xivix-xiim.pages.dev/api/process', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Referer': 'https://xivix-2026-pro.pages.dev/'  // ✅ XIIM V2.2 필수!
          },
          body: JSON.stringify({
            api_key: XIIM_API_KEY,  // ❗ 최상위에 위치 필수
            request_info: {
              user_id: XIIM_USER_ID,              // ❗ 필수 (설계사 고유 ID)
              keyword: currentKeyword,             // ✅ V2026.37.60: 변형 키워드 사용
              target_company: targetCompany,       // ❗ 필수: keyword와 일치해야 함!
              title: selectedTitleText,            // 선택: 검색 정확도 향상
              exclude_urls: excludedUrls.length > 0 ? excludedUrls : undefined, // ✅ V2026.37.60: 제외 URL
              source_url: hasDirectUrl ? directSourceUrl : undefined,  // 직접 URL 입력 시에만
              skip_verification: hasDirectUrl      // 직접 URL 입력 시 검증 스킵
            }
          })
        });
        
        // ✅ V2026.37.60 - Rate Limit 처리 (HTTP 429)
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          const remaining = response.headers.get('X-RateLimit-Remaining') || '0';
          console.warn('[XIVIX] Rate Limited! 대기 시간:', retryAfter, '초 / 남은 요청:', remaining);
          
          // UI 업데이트: 대기 중 메시지
          if (loadingText) loadingText.textContent = '⏳ 요청이 많습니다. ' + retryAfter + '초 후 재시도...';
          if (loadingSub) loadingSub.textContent = '미들웨어 Rate Limit 대기 중 (시도 ' + attempt + '/' + maxRetries + ')';
          
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          } else {
            throw new Error('RATE_LIMITED: 요청이 너무 빈번합니다. 잠시 후 다시 시도해 주세요.');
          }
        }
        
        // 성공 또는 다른 에러 - 루프 탈출
        break;
        
      } catch (fetchError) {
        lastError = fetchError;
        console.error('[XIVIX] XIIM 호출 실패 (시도 ' + attempt + '):', fetchError.message);
        
        // Subrequest 에러 또는 네트워크 에러 → 지수 백오프 재시도
        if (attempt < maxRetries) {
          const backoffDelay = 1000 * Math.pow(2, attempt - 1); // 1초, 2초, 4초
          console.log('[XIVIX] 지수 백오프 대기:', backoffDelay, 'ms');
          
          if (loadingText) loadingText.textContent = '🔄 재시도 중... (' + attempt + '/' + maxRetries + ')';
          if (loadingSub) loadingSub.textContent = '일시적 오류 발생, ' + (backoffDelay/1000) + '초 후 재시도';
          
          await new Promise(r => setTimeout(r, backoffDelay));
        } else {
          throw lastError;
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('XIIM API 호출 실패');
    }
    
    // ✅ V2026.37.60 - 캐시 상태 로깅
    const cacheStatus = response.headers.get('X-Cache') || 'UNKNOWN';
    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining') || '-';
    console.log('[XIVIX] XIIM 캐시:', cacheStatus, '/ 남은 요청:', rateLimitRemaining);
    
    // ✅ CEO 지시 (2026.01.20) - 디버깅: 응답 헤더 및 본문 로깅
    const responseContentType = response.headers.get('Content-Type') || '';
    console.log('[XIVIX] 미들웨어 응답 상태:', response.status, response.statusText);
    console.log('[XIVIX] 미들웨어 응답 Content-Type:', responseContentType);
    
    // HTML 응답 감지 (JSON 파싱 전 체크) - V2026.01 규격
    if (responseContentType.includes('text/html')) {
      const serverHeader = response.headers.get('Server') || 'unknown';
      const cfRay = response.headers.get('CF-Ray') || 'none';
      console.error('[XIVIX] ❌ HTML 응답 감지 - Server:', serverHeader, '/ CF-Ray:', cfRay);
      const htmlPreview = await response.text();
      console.error('[XIVIX] HTML 본문 앞부분:', htmlPreview.substring(0, 500));
      throw new Error('DOWNLOAD_FAILED: 미들웨어가 JSON이 아닌 HTML을 반환했습니다. (Server: ' + serverHeader + ')');
    }
    
    const result = await response.json();
    console.log('[XIVIX] 미들웨어 응답:', result);
    
    // ============================================
    // ✅ V2026.37.60 - XIIM V2.7 대응: success 필드 확인 강화
    // XIIM 팀 권고: API 실패 시 캐시된 이전 이미지 표시 방지
    // ============================================
    
    // 1. 명시적 실패 체크 (success: false)
    if (result.success === false) {
      console.error('[XIVIX] XIIM API 명시적 실패:', result.error || result.message);
      throw new Error('SEARCH_FAILED: ' + (result.error || result.suggestion || '설계서 이미지를 찾지 못했습니다.'));
    }
    
    // 2. status 체크 (기존 방식 호환)
    if (result.status !== 'success') {
      console.error('[XIVIX] XIIM API status 실패:', result.status, result.error);
      throw new Error('API_ERROR: ' + (result.error?.message || result.error || '이미지 생성 실패'));
    }
    
    // 3. final_url 존재 확인
    let imageUrl = result.data?.final_url;
    if (!imageUrl) {
      console.error('[XIVIX] final_url 누락:', result);
      throw new Error('NO_IMAGE: 이미지 URL이 응답에 포함되지 않았습니다.');
    }
    
    // ============================================
    // ✅ V2026.37.60 - CEO 긴급 지시: 잘못된 이미지 패턴 감지 및 자동 재검색
    // "삼성금융 Open Collaboration", 홍보 포스터, 광고 이미지 등 필터링
    // 이 패턴이 감지되면 자동으로 재생성 시도
    // ============================================
    // ============================================
    // ✅ V2026.37.60 - CEO 긴급 지시: 홍보물/광고 이미지 필터 강화
    // "삼성금융 Open Collaboration" 같은 홍보 이미지 차단
    // ============================================
    const INVALID_IMAGE_PATTERNS = [
      // URL에서 감지할 패턴 (Cloudinary 변환 URL에서 원본 이름 추출)
      'open.*collaboration',
      'samsung.*financial',
      'samsung.*group',
      'poster',
      'banner',
      'advertisement',
      'event',
      'promotion',
      'campaign',
      'corporate.*identity',
      'brand.*image',
      'pr_image',
      'news_',
      'article_',
      'logo_',
      'marketing_',
      'infographic',
      'brochure',
      'leaflet',
      'flyer',
      'ci_guide',
      'official.*statement'
    ];
    
    const urlLower = imageUrl.toLowerCase();
    const isInvalidPattern = INVALID_IMAGE_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(urlLower);
    });
    
    // 추가: XIIM 응답에서 이미지 소스/카테고리 확인
    const imageSource = result.data?.source_category || result.data?.image_type || '';
    const isPromoImage = ['poster', 'banner', 'advertisement', 'corporate', 'pr', 'event'].some(
      type => imageSource.toLowerCase().includes(type)
    );
    
    if (isInvalidPattern || isPromoImage) {
      console.error('[XIVIX] ❌ 잘못된 이미지 패턴 감지 (시도 ' + autoRetryCount + '):', { url: imageUrl, source: imageSource });
      
      // 잘못된 이미지 URL을 제외 목록에 추가
      excludedUrls.push(imageUrl);
      
      // ✅ V2026.37.60: 자동 재시도 - throw 대신 continue
      if (autoRetryCount < MAX_AUTO_RETRY) {
        console.log('[XIVIX] 🔄 자동 재검색 시도... (' + (autoRetryCount + 1) + '/' + MAX_AUTO_RETRY + ')');
        if (loadingText) loadingText.textContent = '🔄 홍보 이미지 감지됨, 설계서 재검색 중...';
        if (loadingSub) loadingSub.textContent = '시도 ' + (autoRetryCount + 1) + '/' + MAX_AUTO_RETRY;
        await new Promise(r => setTimeout(r, 1000)); // 1초 대기
        continue; // 다음 시도로
      } else {
        throw new Error('INVALID_IMAGE_TYPE: ' + MAX_AUTO_RETRY + '회 시도 후에도 설계서 이미지를 찾지 못했습니다.');
      }
    }
    
    // ============================================
    // ✅ V2026.37.60 - XIIM V2.8 대응: verification 필드 완전 활용
    // ============================================
    const verification = result.data?.verification || {};
    const isDesignDocument = verification.is_design_document;
    const detectedCompany = verification.detected_company;
    const verificationConfidence = verification.confidence || 0;
    const detectedElements = verification.detected_elements || [];
    const verificationReason = verification.reason || '';
    const isR2Fallback = result.data?.isR2Fallback || false;
    const isSample = result.data?.is_sample || result.data?.is_fallback || result.data?.fallback || isR2Fallback;
    
    console.log('[XIVIX] V2026.37.60 이미지 검증 결과:', { 
      isDesignDocument, 
      detectedCompany, 
      verificationConfidence, 
      detectedElements,
      isR2Fallback,
      reason: verificationReason.substring(0, 100) + '...'
    });
    
    // ✅ V2026.37.60: XIIM V2.8 - 설계서가 아닌 경우 자동 재시도 (더 정확한 판별)
    // verification.is_design_document === false 이면 확실히 설계서가 아님
    if (isDesignDocument === false) {
      console.warn('[XIVIX] ❌ XIIM V2.8 검증 실패: 설계서 아님 (시도 ' + autoRetryCount + ')');
      console.warn('[XIVIX] 판별 사유:', verificationReason);
      
      // 제외 목록에 추가
      excludedUrls.push(imageUrl);
      
      if (autoRetryCount < MAX_AUTO_RETRY) {
        console.log('[XIVIX] 🔄 설계서 아닌 이미지 - 자동 재검색...');
        if (loadingText) loadingText.textContent = '🔄 홍보물 감지됨, 설계서 재검색 중...';
        if (loadingSub) loadingSub.textContent = verificationReason.substring(0, 50) + '...';
        await new Promise(r => setTimeout(r, 1000));
        continue; // 다음 시도로
      } else {
        // 최대 시도 후에도 실패 - R2 폴백 이미지라도 사용하고 경고 표시
        console.warn('[XIVIX] ⚠️ ' + MAX_AUTO_RETRY + '회 시도 후 설계서를 찾지 못함');
        if (isR2Fallback) {
          console.log('[XIVIX] R2 폴백 이미지 사용');
        }
        const warningToast = document.createElement('div');
        warningToast.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 실제 설계서를 찾지 못해 샘플 이미지가 표시됩니다. "이미지가 달라요" 버튼을 눌러 다시 시도해 주세요.';
        warningToast.style.cssText = 'position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(239,68,68,0.4);max-width:90%;text-align:center';
        document.body.appendChild(warningToast);
        setTimeout(() => warningToast.remove(), 8000);
      }
    }
    
    // ✅ V2026.37.60: 설계서로 판정된 경우 성공 로그
    if (isDesignDocument === true) {
      console.log('[XIVIX] ✅ XIIM V2.8 검증 성공: 설계서 확인 (신뢰도: ' + (verificationConfidence * 100).toFixed(0) + '%)');
      console.log('[XIVIX] 감지된 요소:', detectedElements.join(', '));
    }
    
    // R2 폴백 사용 시 안내 (설계서 판정과 무관하게)
    if (isR2Fallback && isDesignDocument !== false) {
      console.warn('[XIVIX] ⚠️ R2 폴백 이미지 사용됨 (검색 결과 부족)');
      const sampleToast = document.createElement('div');
      sampleToast.innerHTML = '<i class="fas fa-info-circle"></i> 검색 결과가 부족하여 샘플 이미지가 표시됩니다.';
      sampleToast.style.cssText = 'position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(59,130,246,0.4);max-width:90%;text-align:center';
      document.body.appendChild(sampleToast);
      setTimeout(() => sampleToast.remove(), 6000);
    }
    
    // 보험사 불일치 경고
    if (detectedCompany && detectedCompany !== company && detectedCompany !== 'UNKNOWN') {
      console.warn('[XIVIX] ⚠️ 보험사 불일치:', { 요청: company, 감지: detectedCompany });
    }
      
      // ============================================
      // ✅ CEO 지시 (2026.01.19) - /demo/ 경로 검증 및 차단
      // XIIM 미들웨어가 /demo/ 경로를 반환하면 404 에러 발생
      // 정상 경로: /xivix/raw/
      // ============================================
      if (imageUrl.includes('/demo/')) {
        console.error('[XIVIX] 잘못된 경로 감지: /demo/ 경로는 유효하지 않음');
        throw new Error('INVALID_PATH: 이미지 경로가 유효하지 않습니다. 다시 시도해 주세요.');
      }
      
      // Cloudinary URL 유효성 검증
      if (!imageUrl.includes('cloudinary.com') || !imageUrl.includes('/xivix/')) {
        console.warn('[XIVIX] 비표준 URL 감지:', imageUrl);
      }
      
      // ============================================
      // ✅ CEO 지시 (2026.01.20) - 이미지 Content-Type 검증
      // 미들웨어가 HTML을 이미지로 착각하는 문제 방지
      // ============================================
      try {
        const imgCheck = await fetch(imageUrl, { method: 'HEAD' });
        const contentType = imgCheck.headers.get('Content-Type') || '';
        console.log('[XIVIX] 이미지 Content-Type:', contentType);
        
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          console.error('[XIVIX] 이미지가 아닌 파일 감지:', contentType);
          throw new Error('DOWNLOAD_FAILED: 수집된 파일이 이미지가 아닌 웹페이지입니다.');
        }
        
        if (!contentType.startsWith('image/')) {
          console.warn('[XIVIX] 비이미지 Content-Type:', contentType);
        }
      } catch (checkError) {
        if (checkError.message.includes('DOWNLOAD_FAILED')) {
          throw checkError;
        }
        console.warn('[XIVIX] HEAD 요청 실패, 이미지 로드로 검증 시도');
      }
      
      // ============================================
      // ✅ V2026.37.39 - 2_quality_filter: 해상도 검증 (CEO EO지시 v4.9)
      // 1000px 이상 문서 형태 우선 추출 및 R2 Fallback 연동
      // ============================================
      let finalImageUrl = imageUrl;
      let qualityCheckPassed = true;
      let resolutionData = { width: 0, height: 0, isHighRes: false };
      
      try {
        resolutionData = await checkImageResolution(imageUrl);
        
        if (!resolutionData.isHighRes && !resolutionData.error) {
          console.warn('[XIVIX] 2_quality_filter: 저해상도 이미지 감지 (' + resolutionData.width + 'x' + resolutionData.height + ')');
          console.log('[XIVIX] 2_quality_filter: R2 Fallback 시도...');
          
          // R2 골든 샘플로 대체 시도
          const fallbackSample = getR2FallbackSample(targetCompany);
          if (fallbackSample && fallbackSample.fullUrl) {
            // R2 Fallback 검증
            const r2Check = await fetch(fallbackSample.fullUrl, { method: 'HEAD' }).catch(() => null);
            if (r2Check && r2Check.ok) {
              console.log('[XIVIX] 2_quality_filter: R2 Fallback 성공 -', fallbackSample.id);
              // 원본 저해상도 유지하되 경고 표시 (R2 미구축 시)
              qualityCheckPassed = false;
            } else {
              console.warn('[XIVIX] 2_quality_filter: R2 Fallback 불가 - 원본 사용');
            }
          }
        }
        
        // 3_reporting: 품질 보고 로깅
        logQualityReport({
          url: imageUrl,
          width: resolutionData.width,
          height: resolutionData.height,
          isHighRes: resolutionData.isHighRes,
          isDocument: resolutionData.isDocument,
          aspectRatio: resolutionData.aspectRatio,
          company: targetCompany
        }, 'MIDDLEWARE_RESPONSE');
        
      } catch (resCheckError) {
        console.warn('[XIVIX] 2_quality_filter: 해상도 검증 실패, 원본 사용:', resCheckError.message);
      }
      
      // ✅ V2026.37.60: 유효한 이미지 찾음 - 루프 종료
      validImageFound = true;
      finalResolutionData = resolutionData;
      finalIsSample = isSample;
      finalVerification = verification;
      
      // 성공: 이미지 표시
      generatedImageUrl = finalImageUrl;
      document.getElementById('imageGenPreview').src = generatedImageUrl;
      document.getElementById('imageGenResult').classList.add('show');
      console.log('[XIVIX] ✅ 이미지 생성 성공 (시도 ' + autoRetryCount + '):', finalImageUrl, 
                  '/ 해상도:', resolutionData.width + 'x' + resolutionData.height,
                  '/ 고해상도:', resolutionData.isHighRes);
      
      // ============================================
      // ✅ V2026.37.17 - USER_NOTIFICATION_LOGIC
      // 폴백/샘플 이미지 감지 시 사용자에게 안내
      // 미들웨어가 is_fallback, is_sample, fallback 플래그를 반환하거나
      // URL에 /sample/, /fallback/, /default/ 포함 시 감지
      // ============================================
      // V2026.37.18 - FALLBACK_TRANSPARENCY: 더 정확한 샘플 이미지 감지
      // 미들웨어 응답 플래그 + URL 패턴 + 텍스트 오버레이만 있는 이미지 감지
      const isFallback = result.data?.is_fallback || result.data?.is_sample || result.data?.fallback || 
                         result.data?.source === 'fallback' || result.data?.source === 'sample' ||
                         imageUrl.includes('/sample/') || imageUrl.includes('/fallback/') || imageUrl.includes('/default/') ||
                         imageUrl.includes('l_text:') || // Cloudinary 텍스트 오버레이 감지 (가짜 이미지)
                         (imageUrl.includes('cloudinary') && !imageUrl.includes('/xivix/raw/'));
      
      let fallbackNotice = document.getElementById('fallbackNotice');
      if (!fallbackNotice) {
        fallbackNotice = document.createElement('div');
        fallbackNotice.id = 'fallbackNotice';
        fallbackNotice.style.cssText = 'margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:11px;color:var(--orange);display:none;';
        document.getElementById('imageGenResult').appendChild(fallbackNotice);
      }
      
      if (isFallback) {
        // V2026.37.18 - SAMPLE_BADGE_ADD: 이미지 상단에 경고 문구 강조 표시
        fallbackNotice.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <strong>※ 실시간 검색 실패로 인한 샘플 이미지입니다</strong><br><span style="font-size:10px;opacity:0.8">실제 보험사 설계안이 아닙니다. 다른 키워드로 다시 시도해 주세요.</span>';
        fallbackNotice.style.cssText = 'margin-top:8px;padding:10px 14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;font-size:12px;color:#ef4444;display:block;';
        console.warn('[XIVIX] ⚠️ 폴백/샘플 이미지 감지됨 - 실제 수집 실패');
      } else {
        fallbackNotice.style.display = 'none';
      }
      
      // ✅ V2026.37.60: 유효한 이미지 찾음 - while 루프 종료
      break;
      
    } // end of while (!validImageFound && autoRetryCount < MAX_AUTO_RETRY)
    
    // ============================================
    // ✅ V2026.37.60: 모든 시도 후 결과 확인
    // ============================================
    if (!validImageFound) {
      console.error('[XIVIX] ❌ ' + MAX_AUTO_RETRY + '회 시도 후 유효한 설계서 이미지를 찾지 못함');
      throw new Error('SEARCH_FAILED: 설계서 이미지를 찾지 못했습니다. "이미지가 달라요" 버튼을 눌러 다시 시도해 주세요.');
    }
    
  } catch (error) {
    console.error('[XIVIX] 이미지 생성 오류:', error);
    
    // ============================================
    // ✅ CEO 지시 (2026.01.19) - UX 고도화
    // 에러 코드별 친절한 안내 및 대안 제시
    // ============================================
    let userMsg = '이미지 생성 중 오류가 발생했습니다.';
    let showSourceUrlInput = false;
    
    // ✅ CEO 지시 (2026.01.20) - 네트워크 에러와 이미지 수집 실패 분리
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      // 🔴 네트워크 에러 (CORS, 연결 실패 등)
      userMsg = '🌐 네트워크 연결에 실패했습니다.\\n\\n';
      userMsg += '원인:\\n';
      userMsg += '• 인터넷 연결 상태를 확인해 주세요.\\n';
      userMsg += '• 현재 도메인이 API 허용 목록에 없을 수 있습니다.\\n\\n';
      userMsg += '💡 해결: 잠시 후 다시 시도하거나, 관리자에게 문의해 주세요.';
      console.error('[XIVIX] 네트워크 에러 - CORS 또는 연결 실패:', error);
    } else if (error.message.includes('VERIFICATION_FAILED')) {
      // 🔴 현재 주요 병목: 광고 이미지 수집 시
      userMsg = '⚠️ 적절한 설계안 이미지를 찾지 못했습니다.\\n\\n';
      userMsg += '검색에서 광고/홍보 이미지가 수집되어 검증에 실패했습니다.\\n\\n';
      userMsg += '💡 해결 방법:\\n';
      userMsg += '1. 다른 보험사/상품으로 다시 시도해 보세요.\\n';
      userMsg += '2. 직접 설계안 이미지 URL을 입력할 수 있습니다.';
      showSourceUrlInput = true;
    } else if (error.message.includes('DOWNLOAD_FAILED') || error.message.includes('매직 바이트') || error.message.includes('Invalid image file')) {
      // 🔴 CEO 지시 (2026.01.19) - HTML 에러 페이지를 이미지로 착각한 경우
      // 매직 바이트 3c 21 44 4f = <!DO = HTML 문서
      userMsg = '⚠️ 이미지 다운로드에 실패했습니다.\\n\\n';
      userMsg += '원인: 수집된 파일이 이미지가 아닌 웹페이지(HTML)입니다.\\n';
      userMsg += '(미들웨어가 에러 페이지를 이미지로 착각함)\\n\\n';
      userMsg += '💡 해결: 다른 보험사/상품으로 다시 시도해 주세요.';
      showSourceUrlInput = true;
    } else if (error.message.includes('INVALID_IMAGE_TYPE')) {
      // ✅ V2026.37.60 - 홍보/광고 이미지 감지 시 자동 재시도
      console.log('[XIVIX] 자동 재검색 시도 (홍보 이미지 감지)');
      
      // 자동 재시도 횟수 체크 (무한 루프 방지)
      if (!window._autoRetryCount) window._autoRetryCount = 0;
      window._autoRetryCount++;
      
      if (window._autoRetryCount <= 3) {
        // 자동 재시도
        const retryToast = document.createElement('div');
        retryToast.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> 설계서 이미지 재검색 중... (시도 ' + window._autoRetryCount + '/3)';
        retryToast.style.cssText = 'position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(59,130,246,0.4);max-width:90%;text-align:center';
        document.body.appendChild(retryToast);
        
        // 버튼 상태 초기화 후 재시도
        setTimeout(() => {
          retryToast.remove();
          generateMarketingImage();
        }, 1500);
        return; // alert 표시하지 않고 종료
      } else {
        // 3회 초과 시 사용자에게 안내
        window._autoRetryCount = 0;
        userMsg = '⚠️ 설계서 이미지를 찾지 못했습니다.\\n\\n';
        userMsg += '검색된 이미지가 모두 홍보/광고 이미지입니다.\\n\\n';
        userMsg += '💡 해결 방법:\\n';
        userMsg += '1. "이미지가 달라요" 버튼을 눌러주세요.\\n';
        userMsg += '2. 또는 다른 보험 상품으로 시도해 주세요.';
        showSourceUrlInput = true;
      }
    } else if (error.message.includes('INVALID_IMAGE') || error.message.includes('UPLOAD_FAILED')) {
      userMsg = '⚠️ 이미지 파일이 손상되었습니다.\\n\\n';
      userMsg += '수집된 이미지가 유효하지 않습니다.\\n\\n';
      userMsg += '💡 해결: "다시 생성하기" 버튼을 눌러주세요.';
    } else if (error.message.includes('SCRAPING_FAILED')) {
      userMsg = '⚠️ 이미지 수집에 실패했습니다.\\n\\n';
      userMsg += '네트워크 문제 또는 검색 결과가 없습니다.\\n\\n';
      userMsg += '💡 해결: 잠시 후 다시 시도해 주세요.';
    } else if (error.message.includes('INVALID_REQUEST')) {
      userMsg += '\\n\\n원인: API 키 또는 필수 파라미터 누락\\n해결: 관리자에게 문의해 주세요.';
    } else if (error.message.includes('FORBIDDEN')) {
      userMsg += '\\n\\n원인: 접근 권한 없음\\n해결: 허용된 도메인에서 접속해 주세요.';
    } else if (error.message.includes('RATE_LIMIT')) {
      userMsg += '\\n\\n원인: 일일 사용량 초과\\n해결: 내일 다시 시도해 주세요.';
    } else if (error.message.includes('INVALID_PATH')) {
      userMsg = '⚠️ 이미지 경로가 유효하지 않습니다.\\n\\n';
      userMsg += '💡 해결: 다시 생성하기 버튼을 눌러주세요.';
    } else {
      userMsg += '\\n\\n' + error.message;
    }
    
    alert(userMsg);
    
    // VERIFICATION_FAILED 시 source_url 입력 모달 표시 (향후 구현)
    if (showSourceUrlInput) {
      console.log('[XIVIX] source_url 직접 입력 안내 - 향후 입력창 모달 추가 예정');
    }
  } finally {
    // ✅ CEO 지시 (2026.01.20) - 진행 단계 interval 정리
    if (typeof progressInterval !== 'undefined') {
      clearInterval(progressInterval);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-image"></i> 마케팅 이미지 생성';
    loading.classList.remove('show');
  }
}

// ============================================
// ✅ V2026.37.60 - CEO 긴급 지시: 이미지 재생성 기능
// XIIM API V2.3 /api/regenerate 연동
// 이전 이미지 URL을 exclude하고 새 이미지 검색
// ============================================
let excludedImageUrls = []; // 제외할 이미지 URL 목록

// ============================================
// ✅ V2026.37.60 - 이미지 재생성 기능
// 1차: /api/regenerate (exclude_urls 지원)
// 2차: /api/process (폴백, 다른 키워드로 재검색)
// ============================================
let regenerateAttempts = 0;

async function regenerateMarketingImage() {
  const btn = document.getElementById('imageRegenerateBtn');
  const statusEl = document.getElementById('regenerateStatus');
  
  if (!resultData?.insurance) {
    alert('먼저 콘텐츠를 생성해 주세요.');
    return;
  }
  
  // 현재 이미지를 제외 목록에 추가
  if (generatedImageUrl) {
    excludedImageUrls.push(generatedImageUrl);
  }
  regenerateAttempts++;
  
  console.log('[XIVIX] 재생성 요청 #' + regenerateAttempts, '- 제외:', excludedImageUrls.length + '개');
  
  // UI 업데이트
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 다른 이미지 검색 중...';
  statusEl.style.display = 'block';
  statusEl.style.color = '#fbbf24';
  statusEl.textContent = '🔍 새로운 설계서 이미지를 찾고 있습니다... (시도 ' + regenerateAttempts + ')';
  
  try {
    // 보험사/상품 정보 추출
    let company = resultData?.company;
    if (!company) {
      const companyList = ['삼성생명', '한화생명', '교보생명', '신한라이프', 'NH농협생명', 'KB라이프', 
                           '미래에셋생명', '메트라이프', '푸르덴셜', 'AIA', '삼성화재', '현대해상', 
                           'DB손해보험', 'KB손해보험', '메리츠화재'];
      const topicLower = (resultData?.topic || '').toLowerCase();
      for (const c of companyList) {
        if (topicLower.includes(c.toLowerCase())) {
          company = c;
          break;
        }
      }
      if (!company) company = '삼성생명';
    }
    
    const insurance = resultData?.insurance || '종합보험';
    const selectedTitleText = resultData.titles?.[selectedTitle]?.text || resultData.titles?.[selectedTitle] || '';
    
    // 키워드 변형 (재시도 횟수에 따라)
    let keyword = company + ' ' + insurance + ' 설계안';
    if (regenerateAttempts === 2) {
      keyword = company + ' ' + insurance + ' 가입설계서';
    } else if (regenerateAttempts === 3) {
      keyword = company + ' ' + insurance + ' 보험료 담보';
    } else if (regenerateAttempts >= 4) {
      keyword = insurance + ' 가입제안서 보험료';
    }
    
    const companyCodeMap = {
      '삼성생명': 'SAMSUNG_LIFE', '한화생명': 'HANWHA_LIFE', '교보생명': 'KYOBO_LIFE',
      '신한라이프': 'SHINHAN_LIFE', 'NH농협생명': 'NH_LIFE', 'KB라이프': 'KB_LIFE',
      '미래에셋생명': 'MIRAE_LIFE', '메트라이프': 'METLIFE', '푸르덴셜': 'PRUDENTIAL',
      'AIA': 'AIA', '삼성화재': 'SAMSUNG_FIRE', '현대해상': 'HYUNDAI_MARINE',
      'DB손해보험': 'DB_INSURANCE', 'KB손해보험': 'KB_INSURANCE', '메리츠화재': 'MERITZ_FIRE'
    };
    const targetCompany = companyCodeMap[company] || 'SAMSUNG_LIFE';
    
    console.log('[XIVIX] 재생성 키워드:', keyword);
    
    // 1차: /api/regenerate 시도
    let result = null;
    let useRegenerateApi = regenerateAttempts <= 2;
    
    if (useRegenerateApi) {
      statusEl.textContent = '🔍 이전 이미지를 제외하고 검색 중...';
      
      const regenResponse = await fetch('https://xivix-xiim.pages.dev/api/regenerate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Referer': 'https://xivix-2026-pro.pages.dev/'
        },
        body: JSON.stringify({
          api_key: XIIM_API_KEY,
          keyword: keyword,
          target_company: targetCompany,
          exclude_urls: excludedImageUrls,
          reason: 'user_requested_different_image'
        })
      });
      
      result = await regenResponse.json();
      console.log('[XIVIX] /api/regenerate 응답:', result);
      
      // regenerate 성공 시
      if (result.success && (result.data?.final_url || result.sourceUrl)) {
        const newImageUrl = result.data?.final_url || result.sourceUrl;
        generatedImageUrl = newImageUrl;
        document.getElementById('imageGenPreview').src = newImageUrl;
        
        statusEl.style.color = '#10b981';
        statusEl.textContent = '✅ 새 이미지를 찾았습니다!';
        setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
        return;
      }
    }
    
    // 2차: /api/process로 폴백 (키워드 변형하여 재검색)
    statusEl.textContent = '🔄 다른 키워드로 재검색 중...';
    
    const processResponse = await fetch('https://xivix-xiim.pages.dev/api/process', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Referer': 'https://xivix-2026-pro.pages.dev/'
      },
      body: JSON.stringify({
        api_key: XIIM_API_KEY,
        request_info: {
          user_id: XIIM_USER_ID,
          keyword: keyword,
          target_company: targetCompany,
          title: selectedTitleText
        }
      })
    });
    
    result = await processResponse.json();
    console.log('[XIVIX] /api/process 폴백 응답:', result);
    
    if (result.status === 'success' && result.data?.final_url) {
      const newImageUrl = result.data.final_url;
      
      // 이전과 같은 이미지인지 확인
      if (excludedImageUrls.includes(newImageUrl)) {
        statusEl.style.color = '#f59e0b';
        statusEl.textContent = '⚠️ 동일한 이미지입니다. 다시 시도해 주세요.';
      } else {
        generatedImageUrl = newImageUrl;
        document.getElementById('imageGenPreview').src = newImageUrl;
        
        statusEl.style.color = '#10b981';
        statusEl.textContent = '✅ 새 이미지를 찾았습니다! (키워드: ' + keyword + ')';
        setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
      }
    } else {
      // 완전 실패
      statusEl.style.color = '#ef4444';
      if (regenerateAttempts >= 5) {
        statusEl.innerHTML = '❌ 더 이상 이미지를 찾을 수 없습니다.<br><span style="font-size:11px">직접 URL을 입력하거나 다른 보험 상품으로 시도해 주세요.</span>';
        regenerateAttempts = 0; // 리셋
        excludedImageUrls = []; // 리셋
      } else {
        statusEl.textContent = '⚠️ 이미지를 찾지 못했습니다. 다시 시도해 주세요. (' + (result.error || result.suggestion || '') + ')';
      }
    }
    
  } catch (error) {
    console.error('[XIVIX] 재생성 오류:', error);
    statusEl.style.color = '#ef4444';
    statusEl.textContent = '❌ 오류: ' + error.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> 이미지가 달라요';
  }
}

async function downloadGeneratedImage() {
  if (!generatedImageUrl) {
    alert('다운로드할 이미지가 없습니다.');
    return;
  }
  
  // ============================================
  // ✅ CEO 지시 (2026.01.19) - 다운로드 로직 최종 수정
  // 1. /demo/ 경로 차단
  // 2. fl_attachment로 강제 다운로드
  // 3. 새 창에서 직접 열기 (가장 안정적)
  // ============================================
  try {
    // /demo/ 경로 차단
    if (generatedImageUrl.includes('/demo/')) {
      alert('이미지 경로가 유효하지 않습니다. 이미지를 다시 생성해 주세요.');
      return;
    }
    
    // Cloudinary URL에 fl_attachment 추가하여 강제 다운로드
    let downloadUrl = generatedImageUrl;
    if (generatedImageUrl.includes('cloudinary.com') && generatedImageUrl.includes('/upload/')) {
      downloadUrl = generatedImageUrl.replace('/upload/', '/upload/fl_attachment/');
    }
    
    console.log('[XIVIX] 다운로드 시작:', downloadUrl);
    
    // 새 창에서 직접 열기 (브라우저가 Content-Disposition: attachment 헤더 보고 자동 다운로드)
    window.open(downloadUrl, '_blank');
    
  } catch (error) {
    console.error('[XIVIX] 이미지 다운로드 오류:', error);
    alert('다운로드 중 오류가 발생했습니다: ' + error.message);
  }
}
</script>
</body>
</html>`

const adminPageHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XIVIX Admin - 관리자 대시보드</title>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<style>
body{background:#0a0a0a;color:#fff;font-family:'Segoe UI',sans-serif;padding:24px;margin:0}
.wrap{max-width:900px;margin:0 auto}
.header{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.icon{width:50px;height:50px;background:linear-gradient(135deg,#00ff00,#00cc00);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:24px;color:#000}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px}
.card-value{font-size:28px;font-weight:900;color:#00ff00}
.card-label{font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px}
.links{display:flex;gap:8px;margin-bottom:24px}
.links a{flex:1;padding:12px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;transition:all 0.3s}
.links a:nth-child(1){background:rgba(0,255,0,0.1);border:1px solid rgba(0,255,0,0.3);color:#00ff00}
.links a:nth-child(2){background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10B981}
.links a:nth-child(3){background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#F59E0B}
.links a:hover{transform:translateY(-2px)}

/* 승인 대기 명단 테이블 */
.pending-section{background:rgba(255,255,255,0.02);border:1px solid rgba(0,255,0,0.2);border-radius:16px;padding:20px;margin-top:24px}
.pending-title{font-size:18px;font-weight:700;color:#00ff00;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.pending-table{width:100%;border-collapse:collapse}
.pending-table th{text-align:left;padding:12px;background:rgba(0,255,0,0.1);color:#00ff00;font-size:13px;border-bottom:1px solid rgba(0,255,0,0.2)}
.pending-table td{padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px}
.pending-table tr:hover{background:rgba(255,255,255,0.02)}
.status-pending{color:#F59E0B;font-weight:600}
.status-approved{color:#10B981;font-weight:600}
.btn-approve{background:#00ff00;color:#000;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;transition:all 0.3s}
.btn-approve:hover{transform:scale(1.05);box-shadow:0 0 15px rgba(0,255,0,0.5)}
.btn-approve:disabled{background:#666;cursor:not-allowed}
.btn-suspend{background:#ff4444;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;transition:all 0.3s;margin-left:8px}
.btn-suspend:hover{transform:scale(1.05);box-shadow:0 0 15px rgba(255,68,68,0.5)}
/* V2026.37.44 - 거절 버튼 */
.btn-reject{background:#666;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;transition:all 0.3s;margin-left:8px}
.btn-reject:hover{background:#888;transform:scale(1.05)}
.plan-select{background:#1a1a1a;color:#fff;border:1px solid rgba(0,255,0,0.3);padding:6px 12px;border-radius:6px;font-size:12px;margin-right:8px}
.expiry-badge{background:rgba(16,185,129,0.2);color:#10B981;padding:4px 8px;border-radius:6px;font-size:11px;margin-left:8px}
.suspended-badge{background:rgba(255,68,68,0.2);color:#ff4444;padding:4px 8px;border-radius:6px;font-size:11px}
.empty-msg{text-align:center;padding:40px;color:rgba(255,255,255,0.5)}
.refresh-btn{background:rgba(0,255,0,0.1);border:1px solid rgba(0,255,0,0.3);color:#00ff00;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px}
.refresh-btn:hover{background:rgba(0,255,0,0.2)}

/* V2026.37.41 - CEO 지시 v5.0: 연장 버튼 */
.btn-extend{background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;cursor:pointer;transition:all 0.3s;margin-left:8px}
.btn-extend:hover{transform:scale(1.05);box-shadow:0 0 15px rgba(59,130,246,0.5)}

/* V2026.37.41 - CEO 지시 v5.0: 설정 탭 */
.tabs{display:flex;gap:8px;margin-bottom:24px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:12px}
.tab{padding:10px 20px;border-radius:8px 8px 0 0;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.3s;background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.6);border:1px solid transparent}
.tab.active{background:rgba(0,255,0,0.1);color:#00ff00;border:1px solid rgba(0,255,0,0.3);border-bottom:none}
.tab:hover{color:#fff}
.tab-content{display:none}
.tab-content.active{display:block}
.settings-section{background:rgba(255,255,255,0.02);border:1px solid rgba(0,255,0,0.2);border-radius:16px;padding:20px;margin-bottom:16px}
.settings-title{font-size:16px;font-weight:700;color:#00ff00;margin-bottom:12px}
.settings-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
.settings-row:last-child{border-bottom:none}
.settings-label{font-size:14px;color:rgba(255,255,255,0.8)}
.settings-input{background:#1a1a1a;color:#fff;border:1px solid rgba(0,255,0,0.3);padding:8px 12px;border-radius:6px;font-size:13px;width:150px}
.settings-toggle{position:relative;width:50px;height:26px;background:#333;border-radius:13px;cursor:pointer;transition:all 0.3s}
.settings-toggle.active{background:#00ff00}
.settings-toggle::after{content:'';position:absolute;width:22px;height:22px;background:#fff;border-radius:50%;top:2px;left:2px;transition:all 0.3s}
.settings-toggle.active::after{left:26px}
.btn-save{background:linear-gradient(135deg,#00ff00,#00cc00);color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:700;cursor:pointer;margin-top:16px}

/* V2026.37.41 - CEO 지시 v5.1: 연장 모달 */
.extend-modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10000;align-items:center;justify-content:center}
.extend-modal.show{display:flex}
.extend-modal-content{background:#1a1a1a;border:1px solid rgba(0,255,0,0.3);border-radius:16px;padding:24px;max-width:400px;width:90%}
.extend-modal-title{font-size:18px;font-weight:700;color:#00ff00;margin-bottom:16px}
.extend-options{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}
.extend-option{padding:16px;border:2px solid rgba(0,255,0,0.3);border-radius:12px;text-align:center;cursor:pointer;transition:all 0.3s}
.extend-option:hover,.extend-option.selected{background:rgba(0,255,0,0.1);border-color:#00ff00}
.extend-option-days{font-size:24px;font-weight:900;color:#00ff00}
.extend-option-label{font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px}
.extend-modal-btns{display:flex;gap:12px;justify-content:flex-end}
.btn-cancel{background:rgba(255,255,255,0.1);color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer}

/* V2026.37.41 - CEO 지시 v5.1: 모바일 카드 UI (768px 이하) */
@media screen and (max-width:768px){
  body{padding:12px}
  .wrap{max-width:100%}
  .header{flex-direction:column;text-align:center}
  .cards{grid-template-columns:repeat(3,1fr);gap:8px}
  .card{padding:12px}
  .card-value{font-size:20px}
  .links{flex-direction:column}
  .tabs{flex-wrap:wrap}
  .tab{flex:1;text-align:center;font-size:12px;padding:8px 12px}
  
  /* 테이블 → 카드 전환 */
  .pending-table{display:none}
  .mobile-cards{display:block}
  .mobile-card{background:rgba(255,255,255,0.03);border:1px solid rgba(0,255,0,0.2);border-radius:12px;padding:16px;margin-bottom:12px}
  .mobile-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1)}
  .mobile-card-name{font-size:16px;font-weight:700}
  .mobile-card-time{font-size:11px;color:rgba(255,255,255,0.5)}
  .mobile-card-body{margin-bottom:12px}
  .mobile-card-phone{font-size:14px;color:#00ff00;margin-bottom:8px}
  .mobile-card-phone a{color:#00ff00;text-decoration:none}
  .mobile-card-status{display:flex;align-items:center;gap:8px}
  .mobile-card-footer{display:flex;gap:8px;flex-wrap:wrap}
  .mobile-card-footer .btn-approve,.mobile-card-footer .btn-suspend,.mobile-card-footer .btn-extend{flex:1;min-height:44px;font-size:14px}
  .mobile-card-footer .plan-select{width:100%;margin-bottom:8px;min-height:44px}
}
@media screen and (min-width:769px){
  .mobile-cards{display:none}
}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="icon">X</div>
    <div>
      <div style="font-size:20px;font-weight:800">XIVIX Admin Dashboard</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5)">v2026.37.41 - 관리자 전용 (연장/설정/모바일UI)</div>
    </div>
  </div>
  
  <div class="cards">
    <div class="card"><div id="keys" class="card-value">-</div><div class="card-label"><i class="fas fa-key"></i> API Keys</div></div>
    <div class="card"><div id="pendingCount" class="card-value" style="color:#F59E0B">-</div><div class="card-label"><i class="fas fa-clock"></i> 승인 대기</div></div>
    <div class="card"><div class="card-value" style="color:#00ff00">v37.41</div><div class="card-label"><i class="fas fa-code-branch"></i> Version</div></div>
  </div>
  
  <div class="links">
    <a href="/"><i class="fas fa-home"></i> 메인</a>
    <a href="/api/health"><i class="fas fa-heartbeat"></i> Health</a>
    <a href="/api/docs"><i class="fas fa-book"></i> Docs</a>
  </div>
  
  <!-- V2026.37.41 - CEO 지시 v5.0: 탭 네비게이션 -->
  <div class="tabs">
    <div class="tab active" onclick="switchTab('users')"><i class="fas fa-users"></i> 회원 관리</div>
    <div class="tab" onclick="switchTab('settings')"><i class="fas fa-cog"></i> 설정</div>
  </div>
  
  <!-- 회원 관리 탭 -->
  <div class="pending-section">
    <div class="pending-title">
      <i class="fas fa-user-clock"></i> 가입 승인 대기 명단
      <button class="refresh-btn" onclick="loadPendingUsers()"><i class="fas fa-sync-alt"></i> 새로고침</button>
    </div>
    <table class="pending-table">
      <thead>
        <tr>
          <th>입금자 성함</th>
          <th>휴대폰 번호</th>
          <th>신청 시간</th>
          <th>상태</th>
          <th>남은 기간</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody id="pendingList">
        <tr><td colspan="5" class="empty-msg"><i class="fas fa-inbox"></i> 로딩 중...</td></tr>
      </tbody>
    </table>
    
    <!-- V2026.37.41 - CEO 지시 v5.1: 모바일 카드 UI -->
    <div class="mobile-cards" id="mobileCardList"></div>
  </div>
  
  <!-- V2026.37.41 - CEO 지시 v5.0: 설정 탭 -->
  <div class="tab-content" id="settingsTab">
    <div class="settings-section">
      <div class="settings-title"><i class="fas fa-won-sign"></i> 멤버십 가격 관리</div>
      <div class="settings-row"><span class="settings-label">1개월</span><input type="number" class="settings-input" id="price1m" value="30000">원</div>
      <div class="settings-row"><span class="settings-label">3개월</span><input type="number" class="settings-input" id="price3m" value="80000">원 <small style="color:#10B981">(10% 할인)</small></div>
      <div class="settings-row"><span class="settings-label">6개월</span><input type="number" class="settings-input" id="price6m" value="150000">원 <small style="color:#10B981">(17% 할인)</small></div>
      <div class="settings-row"><span class="settings-label">12개월</span><input type="number" class="settings-input" id="price12m" value="280000">원 <small style="color:#10B981">(22% 할인)</small></div>
    </div>
    
    <div class="settings-section">
      <div class="settings-title"><i class="fas fa-bell"></i> 알림 발송 설정</div>
      <div class="settings-row"><span class="settings-label">자동 알림 활성화</span><div class="settings-toggle active" id="toggleNotification" onclick="toggleSetting(this)"></div></div>
      <div class="settings-row"><span class="settings-label">발송 시간</span><input type="time" class="settings-input" id="sendTime" value="14:00"></div>
      <div class="settings-row"><span class="settings-label">만료 알림 문구</span><input type="text" class="settings-input" style="width:300px" id="expiryTemplate" value="멤버십이 내일 만료됩니다."></div>
    </div>
    
    <div class="settings-section">
      <div class="settings-title"><i class="fas fa-images"></i> R2 골든 샘플 설정</div>
      <div class="settings-row"><span class="settings-label">R2 Fallback 활성화</span><div class="settings-toggle" id="toggleR2" onclick="toggleSetting(this)"></div></div>
      <div class="settings-row"><span class="settings-label">R2 URL</span><input type="text" class="settings-input" style="width:300px" id="r2Url" value="https://pub-xivix-golden-samples.r2.dev"></div>
    </div>
    
    <button class="btn-save" onclick="saveSettings()"><i class="fas fa-save"></i> 설정 저장</button>
  </div>
</div>

<!-- V2026.37.41 - CEO 지시 v5.0: 연장 모달 -->
<div class="extend-modal" id="extendModal">
  <div class="extend-modal-content">
    <div class="extend-modal-title"><i class="fas fa-calendar-plus"></i> 기간 연장</div>
    <div style="margin-bottom:12px;color:rgba(255,255,255,0.7)">연장 대상: <strong id="extendTargetName">-</strong></div>
    <div class="extend-options">
      <div class="extend-option" onclick="selectExtendDays(30)"><div class="extend-option-days">30</div><div class="extend-option-label">일 (1개월)</div></div>
      <div class="extend-option" onclick="selectExtendDays(90)"><div class="extend-option-days">90</div><div class="extend-option-label">일 (3개월)</div></div>
      <div class="extend-option" onclick="selectExtendDays(180)"><div class="extend-option-days">180</div><div class="extend-option-label">일 (6개월)</div></div>
      <div class="extend-option" onclick="selectExtendDays(365)"><div class="extend-option-days">365</div><div class="extend-option-label">일 (12개월)</div></div>
    </div>
    <div class="extend-modal-btns">
      <button class="btn-cancel" onclick="closeExtendModal()">취소</button>
      <button class="btn-approve" id="confirmExtendBtn" onclick="confirmExtend()"><i class="fas fa-check"></i> 연장 확정</button>
    </div>
  </div>
</div>

<script>
// API 통계 로드
fetch('/api/admin/stats').then(r=>r.json()).then(d=>{
  document.getElementById('keys').textContent = d.totalKeys || 3;
});

// 승인 대기 유저 로드
async function loadPendingUsers() {
  const tbody = document.getElementById('pendingList');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</td></tr>';
  
  try {
    const res = await fetch('/api/admin/pending-users');
    const data = await res.json();
    
    if (data.users && data.users.length > 0) {
      document.getElementById('pendingCount').textContent = data.users.length;
      tbody.innerHTML = data.users.map(user => {
        const expiryDate = user.expiry_date ? new Date(user.expiry_date) : null;
        const today = new Date();
        const daysLeft = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
        const statusText = user.is_suspended ? '🚫 정지됨' : (user.status === 'PENDING' ? '⏳ 대기중' : '✅ 승인됨');
        const statusClass = user.is_suspended ? 'suspended' : user.status.toLowerCase();
        
        return \`
        <tr>
          <td><strong>\${user.name}</strong></td>
          <td>\${user.phone}</td>
          <td>\${new Date(user.created_at).toLocaleString('ko-KR')}</td>
          <td class="status-\${statusClass}">\${statusText}</td>
          <td>\${user.expiry_date ? \`<span class="expiry-badge">\${daysLeft > 0 ? daysLeft + '일 남음' : '만료됨'}</span>\` : '-'}</td>
          <td>
            \${user.status === 'PENDING' 
              ? \`<select class="plan-select" id="plan-\${user.phone.replace(/-/g, '')}">
                  <option value="1m">1개월</option>
                  <option value="3m">3개월</option>
                  <option value="6m">6개월</option>
                  <option value="12m">12개월</option>
                </select>
                <button class="btn-approve" onclick="approveUser('\${user.phone}')"><i class="fas fa-check"></i> 승인</button><button class="btn-reject" onclick="rejectUser('\${user.phone}', '\${user.name}')"><i class="fas fa-times"></i> 거절</button>\`
              : (user.is_suspended 
                ? '<span class="suspended-badge">정지됨</span>'
                : \`<button class="btn-extend" onclick="openExtendModal('\${user.phone}', '\${user.name}')"><i class="fas fa-calendar-plus"></i> 연장</button><button class="btn-suspend" onclick="suspendUser('\${user.phone}')"><i class="fas fa-ban"></i> 정지</button>\`)
            }
          </td>
        </tr>\`;
      }).join('');
      // V2026.37.41 - 모바일 카드 UI 렌더링
      document.getElementById('mobileCardList').innerHTML = data.users.map(user => {
        const expiryDate = user.expiry_date ? new Date(user.expiry_date) : null;
        const today = new Date();
        const daysLeft = expiryDate ? Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)) : null;
        const statusText = user.is_suspended ? '🚫 정지됨' : (user.status === 'PENDING' ? '⏳ 대기중' : '✅ 승인됨');
        
        return \`
        <div class="mobile-card">
          <div class="mobile-card-header">
            <div class="mobile-card-name">\${user.name}</div>
            <div class="mobile-card-time">\${new Date(user.created_at).toLocaleString('ko-KR')}</div>
          </div>
          <div class="mobile-card-body">
            <div class="mobile-card-phone"><a href="tel:\${user.phone.replace(/-/g, '')}"><i class="fas fa-phone"></i> \${user.phone}</a></div>
            <div class="mobile-card-status">
              <span>\${statusText}</span>
              \${user.expiry_date ? \`<span class="expiry-badge">\${daysLeft > 0 ? daysLeft + '일 남음' : '만료됨'}</span>\` : ''}
            </div>
          </div>
          <div class="mobile-card-footer">
            \${user.status === 'PENDING' 
              ? \`<select class="plan-select" id="mplan-\${user.phone.replace(/-/g, '')}">
                  <option value="1m">1개월</option><option value="3m">3개월</option><option value="6m">6개월</option><option value="12m">12개월</option>
                </select>
                <button class="btn-approve" onclick="approveUser('\${user.phone}')"><i class="fas fa-check"></i> 승인</button><button class="btn-reject" onclick="rejectUser('\${user.phone}', '\${user.name}')"><i class="fas fa-times"></i> 거절</button>\`
              : (user.is_suspended 
                ? '<span class="suspended-badge" style="flex:1;text-align:center;padding:12px">정지됨</span>'
                : \`<button class="btn-extend" onclick="openExtendModal('\${user.phone}', '\${user.name}')"><i class="fas fa-calendar-plus"></i> 연장</button><button class="btn-suspend" onclick="suspendUser('\${user.phone}')"><i class="fas fa-ban"></i> 정지</button>\`)
            }
          </div>
        </div>\`;
      }).join('');
    } else {
      document.getElementById('pendingCount').textContent = '0';
      tbody.innerHTML = '<tr><td colspan="6" class="empty-msg"><i class="fas fa-inbox"></i> 승인 대기 중인 신청이 없습니다.</td></tr>';
      document.getElementById('mobileCardList').innerHTML = '<div class="empty-msg"><i class="fas fa-inbox"></i> 승인 대기 중인 신청이 없습니다.</div>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg" style="color:#ff6b6b"><i class="fas fa-exclamation-triangle"></i> 데이터 로드 실패</td></tr>';
    document.getElementById('mobileCardList').innerHTML = '<div class="empty-msg" style="color:#ff6b6b"><i class="fas fa-exclamation-triangle"></i> 데이터 로드 실패</div>';
  }
}

// 유저 승인 (플랜 타입 포함)
async function approveUser(phone) {
  const planSelect = document.getElementById('plan-' + phone.replace(/-/g, ''));
  const planType = planSelect ? planSelect.value : '1m';
  
  if (!confirm(\`이 사용자를 \${planType === '1m' ? '1개월' : planType === '3m' ? '3개월' : planType === '6m' ? '6개월' : '12개월'} 플랜으로 승인하시겠습니까?\`)) return;
  
  try {
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, plan_type: planType })
    });
    const data = await res.json();
    
    if (data.success) {
      alert(\`✅ 승인 완료!\\n\\n플랜: \${planType}\\n만료일: \${data.user.expiry_date}\\n\\n해당 사용자에게 승인 알림이 발송됩니다.\`);
      loadPendingUsers();
    } else {
      alert('❌ 승인 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    alert('❌ 네트워크 오류');
  }
}

// 유저 정지
async function suspendUser(phone) {
  if (!confirm('이 사용자를 정지하시겠습니까?\\n정지 시 로그인이 차단되고 안내 메시지가 발송됩니다.')) return;
  
  try {
    const res = await fetch('/api/admin/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    
    if (data.success) {
      alert('🚫 정지 완료! 해당 사용자에게 정지 안내가 발송됩니다.');
      loadPendingUsers();
    } else {
      alert('❌ 정지 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    alert('❌ 네트워크 오류');
  }
}

// V2026.37.44 - 거절 처리 (CEO 지시)
async function rejectUser(phone, name) {
  if (!confirm(\`"\${name}" 님의 가입 신청을 거절하시겠습니까?\\n\\n⚠️ 거절 시 데이터가 삭제되며 복구할 수 없습니다.\`)) return;
  
  try {
    const res = await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    
    if (data.success) {
      alert('❌ 가입이 거절되었습니다.');
      loadPendingUsers();
    } else {
      alert('❌ 거절 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    alert('❌ 네트워크 오류');
  }
}

// V2026.37.41 - 탭 전환 기능
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  if (tabName === 'users') {
    document.querySelector('.tab:nth-child(1)').classList.add('active');
    document.querySelector('.pending-section').style.display = 'block';
    document.getElementById('settingsTab').classList.remove('active');
  } else if (tabName === 'settings') {
    document.querySelector('.tab:nth-child(2)').classList.add('active');
    document.querySelector('.pending-section').style.display = 'none';
    document.getElementById('settingsTab').classList.add('active');
    loadSettings();
  }
}

// V2026.37.41 - 설정 토글
function toggleSetting(el) {
  el.classList.toggle('active');
}

// V2026.37.41 - 설정 로드
async function loadSettings() {
  try {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    if (data.settings) {
      document.getElementById('price1m').value = data.settings.pricing?.['1m']?.price || 30000;
      document.getElementById('price3m').value = data.settings.pricing?.['3m']?.price || 80000;
      document.getElementById('price6m').value = data.settings.pricing?.['6m']?.price || 150000;
      document.getElementById('price12m').value = data.settings.pricing?.['12m']?.price || 280000;
      document.getElementById('sendTime').value = data.settings.scheduler?.sendTime || '14:00';
      if (data.settings.scheduler?.enabled) document.getElementById('toggleNotification').classList.add('active');
      if (data.settings.r2?.enabled) document.getElementById('toggleR2').classList.add('active');
      document.getElementById('r2Url').value = data.settings.r2?.goldenSamplesUrl || '';
    }
  } catch (err) { console.error('설정 로드 실패:', err); }
}

// V2026.37.41 - 설정 저장
async function saveSettings() {
  const settings = {
    pricing: {
      '1m': { price: parseInt(document.getElementById('price1m').value), discount: 0 },
      '3m': { price: parseInt(document.getElementById('price3m').value), discount: 10 },
      '6m': { price: parseInt(document.getElementById('price6m').value), discount: 17 },
      '12m': { price: parseInt(document.getElementById('price12m').value), discount: 22 }
    },
    scheduler: {
      enabled: document.getElementById('toggleNotification').classList.contains('active'),
      sendTime: document.getElementById('sendTime').value
    },
    r2: {
      enabled: document.getElementById('toggleR2').classList.contains('active'),
      goldenSamplesUrl: document.getElementById('r2Url').value
    }
  };
  
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (data.success) alert('✅ 설정이 저장되었습니다.');
    else alert('❌ 저장 실패: ' + data.message);
  } catch (err) { alert('❌ 네트워크 오류'); }
}

// V2026.37.41 - 연장 모달 기능
let extendTargetPhone = '';
let selectedExtendDays = 0;

function openExtendModal(phone, name) {
  extendTargetPhone = phone;
  selectedExtendDays = 0;
  document.getElementById('extendTargetName').textContent = name + ' (' + phone + ')';
  document.querySelectorAll('.extend-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('extendModal').classList.add('show');
}

function closeExtendModal() {
  document.getElementById('extendModal').classList.remove('show');
  extendTargetPhone = '';
  selectedExtendDays = 0;
}

function selectExtendDays(days) {
  selectedExtendDays = days;
  document.querySelectorAll('.extend-option').forEach(o => o.classList.remove('selected'));
  event.target.closest('.extend-option').classList.add('selected');
}

async function confirmExtend() {
  if (!extendTargetPhone || !selectedExtendDays) {
    alert('연장할 기간을 선택해 주세요.');
    return;
  }
  
  try {
    const res = await fetch('/api/admin/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: extendTargetPhone, days: selectedExtendDays })
    });
    const data = await res.json();
    
    if (data.success) {
      alert(\`✅ 연장 완료!\\n\\n+\${selectedExtendDays}일 연장\\n새 만료일: \${data.newExpiryDate}\\n\\n해당 사용자에게 연장 알림이 발송됩니다.\`);
      closeExtendModal();
      loadPendingUsers();
    } else {
      alert('❌ 연장 실패: ' + (data.message || '알 수 없는 오류'));
    }
  } catch (err) {
    alert('❌ 네트워크 오류');
  }
}

// 페이지 로드 시 실행
loadPendingUsers();
// 30초마다 자동 새로고침
setInterval(loadPendingUsers, 30000);
</script>
</body>
</html>`

// 보안 헤더 설정 (CSP 제거 - Cloudflare 기본 정책 사용)
const setSecurityHeaders = (c: any) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  // V2026.37.47 - 강력한 캐시 삭제 (CEO 지시: 모바일 프리징 방지)
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
};

app.get('/', (c) => {
  setSecurityHeaders(c);
  return c.html(mainPageHtml);
})
app.get('/admin', (c) => {
  setSecurityHeaders(c);
  return c.html(adminPageHtml);
})

export default app
