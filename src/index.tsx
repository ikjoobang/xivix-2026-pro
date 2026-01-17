import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'

type Bindings = {
  GEMINI_API_KEY_1?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GEMINI_API_KEY_4?: string;
  GEMINI_API_KEY_5?: string;
  GEMINI_API_KEY_6?: string;
  GEMINI_API_KEY_7?: string;
  GEMINI_API_KEY_8?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/*', cors())

/**
 * ⚡ 2026 XIVIX 하이브리드 엔진 (절대 변경 금지)
 * - 전문가 지능: gemini-1.5-pro-002 (보험사 약관 및 법리 해석)
 * - 데이터 렌더링: gemini-2.0-flash (이미지 데이터, 실시간 속도)
 */
const EXPERT_ENGINE = 'gemini-1.5-pro-002'
const DATA_ENGINE = 'gemini-2.0-flash'

// ============================================
// [API 키 중앙 관리 시스템 - 자동 폴백]
// ============================================
const API_KEYS = [
  'AIzaSyCrGS-5UYdayfOxtoush_qMSyWWVuelsR0',
  'AIzaSyAwKHI8j8AEQsqHEGXHq7gOTXcgb_6fses',
  'AIzaSyD9ZRwGBDdamELhnN2H0gEQgggcUQHRuZU',
  'AIzaSyAWwXPyN2pzq8UdHQG8eywBkc7H3tuJ21U',
  'AIzaSyCqVZcoR6KJEgimH7cXazEBxd6sOIGikks',
  'AIzaSyAjwvLFLAOxJF9xC8OC24T-YuI_SFaEKII',
  'AIzaSyAx1ugm1G7kTAIp2enyBvc1ECYqVNfOHHc'
]

let currentKeyIndex = 0

function getNextApiKey(): string {
  const key = API_KEYS[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length
  return key
}

async function callGeminiWithFallback(model: string, prompt: string, isStream: boolean = false): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const apiKey = getNextApiKey()
    try {
      const endpoint = isStream 
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192
          }
        })
      })
      
      if (response.ok) {
        return response
      }
      
      // 429 (Rate Limit) 또는 403 (Forbidden) 시 다음 키로
      if (response.status === 429 || response.status === 403) {
        console.log(`API Key ${currentKeyIndex} failed with status ${response.status}, trying next...`)
        continue
      }
      
      return response
    } catch (error) {
      lastError = error as Error
      console.log(`API Key ${currentKeyIndex} error, trying next...`)
    }
  }
  
  throw lastError || new Error('All API keys exhausted')
}

// ============================================
// [로직 1] 성별/나이/페르소나 무결점 매핑
// ============================================
function getPersona(target: string, concern: string) {
  let gender = '여성'
  const maleKeywords = ['가장', '아빠', '남편', '남성', '오빠', '형', '아들', '남자']
  const femaleKeywords = ['워킹맘', '엄마', '주부', '아내', '여성', '딸', '언니', '누나', '여자']
  
  // 남성 키워드 우선 체크
  if (maleKeywords.some(k => target.includes(k) || concern.includes(k))) {
    gender = '남성'
  }
  // 여성 키워드 강제 적용 (워킹맘 오류 차단)
  if (femaleKeywords.some(k => target.includes(k) || concern.includes(k))) {
    gender = '여성'
  }
  
  const ageMatch = target.match(/(\d+)대/) || concern.match(/(\d+)대/)
  const age = ageMatch ? ageMatch[1] + '세' : '35세'
  
  return { gender, age, target }
}

// ============================================
// [로직 2] 김미경 지사장급 초정밀 전문가 프롬프트
// ============================================
function getExpertPrompt(data: any) {
  const p = getPersona(data.target, data.concern)
  
  return `당신은 대한민국 상위 1% 보험 수석 컨설턴트(XIVIX PRO)입니다.
보험사: ${data.company}, 스타일: ${data.style}, 타겟: ${p.age}/${p.gender}/${p.target}

[핵심 미션]
입력된 Angle "${data.concern}"을 분석하여 네이버 카페 알고리즘(C-Rank, DIA, Agent N)을 강제로 통과시키는 S등급 콘텐츠를 생성하십시오.

[페르소나 매칭 - 절대 준수]
- 현재 페르소나: ${p.gender} / ${p.age}
- 질문자 화법: 반드시 ${p.gender}의 자연스러운 말투 사용
- 워킹맘/엄마 = 무조건 여성, 가장/아빠 = 무조건 남성

[전문가 지식 가이드 - 절대 준수]
1. 상속/증여: 상증법 제8조(간주상속재산) 법리, 수익자 지정에 따른 상속세 절세 원리, 10년 주기 증여 한도 소명 전략.
2. CEO/법인: 법인세 손비처리 한도, 가지급금 정리용 퇴직금 재원, 임원배상책임 리스크 관리.
3. 치매/간병: CDR 척도별 판정 기준, ADL(일상생활장애) 보장 공백, 체증형 일당의 화폐가치 방어 논리.
4. 유병자보험: 간편심사 기준, 고지의무 범위, 기왕증 부담보 조건.

[콘텐츠 구성 가이드]
- 질문: 수만 가지 상황 중 랜덤 생성 (보험 초보가 동네 형에게 묻듯 현실적으로)
- 답변: 3가지 스타일로 작성하되 총 1,200자 이상의 압도적 정보량과 공감 제공
- 시각 계층: ❶ ❷ ❸ (프로세스), ■ (강조), ✔️ (체크) 기호 필수 사용
- 마크다운 표(|) 금지, HTML <br> 태그로 줄바꿈

[알고리즘 대응 전략]
- C-Rank: 전문 용어(상증법 제8조, CDR 척도, 손비처리)를 자연스럽게 배치
- DIA/Agent N: '정보의 이득'을 극대화한 구체적인 수치와 해결책 제시

[출력 구조]
=== SEO 노출 점수 ===
(S/A/B/C 등급 및 점수)

=== 제목 (2개) ===
1. 
2. 

=== 키워드 (5개) ===
1. 2. 3. 4. 5.

=== 질문 (3개) ===
[질문1]
[질문2]
[질문3]

=== 전문가 답변 (3개) ===
[답변1 - ${data.style}]
(1,200자 이상 상세 답변)

[답변2]
(1,200자 이상 상세 답변)

[답변3]
(1,200자 이상 상세 답변)

=== 핵심 포인트 ===
❶ 
❷ 
❸ 

=== 댓글 (5개) ===
[댓글1]
[댓글2]
[댓글3]
[댓글4]
[댓글5]`
}

// ============================================
// [로직 3] 흑백 엑셀 설계서 프롬프트
// ============================================
function getExcelPrompt(data: any) {
  const p = getPersona(data.target, data.concern)
  
  return `${data.insuranceType} 보험 설계서 데이터 생성.

[필수 조건]
- 피보험자: ${p.gender} / ${p.age}
- 보험사: ${data.company}
- 흑백 엑셀 인쇄물용 데이터 (컬러 코드 완전 배제)
- 15개 이상의 리얼한 담보 구성
- 2026년 실제 시장가 기준 보험료

[출력 형식 - 반드시 JSON만 출력]
{
  "product": "${data.insuranceType} 마스터 플랜",
  "company": "${data.company}",
  "insured": "${p.target}",
  "gender": "${p.gender}",
  "age": "${p.age}",
  "items": [
    {"name": "담보명", "amount": "가입금액", "premium": "보험료"}
  ],
  "total": "월 합계 보험료"
}`
}

// ============================================
// 📝 마스터 통합 스트리밍 API
// ============================================
app.post('/api/generate/master', async (c) => {
  const body = await c.req.json()

  return streamText(c, async (stream) => {
    await stream.write(JSON.stringify({ type: 'status', step: 1, msg: '🔍 1단계: 타겟 페르소나 정밀 분석 중...' }) + '\n')
    await stream.write(JSON.stringify({ type: 'status', step: 2, msg: '⚖️ 2단계: 2026년 최신 보험 법리 대입 중...' }) + '\n')
    await stream.write(JSON.stringify({ type: 'status', step: 3, msg: '🧠 3단계: 전문가 뇌 교체 및 콘텐츠 생성 중...' }) + '\n')

    try {
      const response = await callGeminiWithFallback(EXPERT_ENGINE, getExpertPrompt(body), true)
      
      if (!response.ok) {
        await stream.write(JSON.stringify({ type: 'error', msg: 'API 호출 실패. 잠시 후 다시 시도해주세요.' }) + '\n')
        return
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6))
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                const clean = text
                  .replace(/\n/g, '<br>')
                  .replace(/Analysis|Evidence|Step \d+:/gi, '')
                await stream.write(JSON.stringify({ type: 'content', data: clean }) + '\n')
              }
            } catch (e) {
              // JSON 파싱 오류 무시
            }
          }
        }
      }
      
      await stream.write(JSON.stringify({ type: 'done' }) + '\n')
    } catch (error) {
      await stream.write(JSON.stringify({ type: 'error', msg: '모든 API 키가 소진되었습니다. 관리자에게 문의하세요.' }) + '\n')
    }
  })
})

// ============================================
// 📊 흑백 엑셀 설계서 API
// ============================================
app.post('/api/generate/excel', async (c) => {
  const body = await c.req.json()
  const p = getPersona(body.target, body.concern)

  try {
    const response = await callGeminiWithFallback(DATA_ENGINE, getExcelPrompt(body), false)
    const json = await response.json() as any
    
    const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      return c.json({ 
        success: true, 
        data: { 
          ...data, 
          gender: p.gender, 
          age: p.age, 
          target: p.target 
        } 
      })
    }
    
    return c.json({ success: false, error: 'JSON 파싱 실패' })
  } catch (error) {
    return c.json({ success: false, error: 'API 호출 실패' })
  }
})

// ============================================
// 🏥 Health Check API
// ============================================
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2026.1.0',
    engines: {
      expert: EXPERT_ENGINE,
      data: DATA_ENGINE
    },
    apiKeysAvailable: API_KEYS.length
  })
})

// ============================================
// 📄 API 문서 (Swagger 스타일)
// ============================================
app.get('/api/docs', (c) => {
  return c.json({
    openapi: '3.0.0',
    info: {
      title: 'XIVIX 2026 PRO API',
      version: '2026.1.0',
      description: '대한민국 상위 1% 보험 마케팅 콘텐츠 생성 API'
    },
    servers: [{ url: '/' }],
    paths: {
      '/api/generate/master': {
        post: {
          summary: 'Q&A 콘텐츠 스트리밍 생성',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    target: { type: 'string', example: '30대 워킹맘' },
                    insuranceType: { type: 'string', example: '상속/증여' },
                    company: { type: 'string', example: '삼성생명' },
                    style: { type: 'string', example: '전문가 팩트체크형' },
                    concern: { type: 'string', example: '자녀 증여 시 세금 절약' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: 'Streaming response' } }
        }
      },
      '/api/generate/excel': {
        post: {
          summary: '흑백 엑셀 설계서 데이터 생성',
          responses: { '200': { description: 'JSON response' } }
        }
      },
      '/api/health': {
        get: {
          summary: 'Health Check',
          responses: { '200': { description: 'Server status' } }
        }
      }
    }
  })
})

// ============================================
// 📊 어드민 대시보드 API
// ============================================
app.get('/api/admin/stats', (c) => {
  return c.json({
    totalKeys: API_KEYS.length,
    currentKeyIndex: currentKeyIndex,
    engines: {
      expert: EXPERT_ENGINE,
      data: DATA_ENGINE
    },
    features: ['Q&A 생성', '엑셀 설계서', 'TXT 다운로드', 'PDF 생성'],
    lastUpdated: new Date().toISOString()
  })
})

// ============================================
// 🖥️ 메인 UI (Beyond Reality 스타일 + 타이포그래피 가이드)
// ============================================
const mainPageHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XIVIX 2026 PRO | 보험 마케팅 마스터</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<style>
  /* 사장님 가이드 타이포그래피 반영 */
  :root { 
    --naver-green: #03C75A; 
    --sub-orange: #FF6B35;
    --glass-bg: rgba(255,255,255,0.02);
    --glass-border: rgba(255,255,255,0.06);
  }
  
  * { box-sizing: border-box; }
  
  body { 
    background: #000; 
    color: #fff; 
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Pretendard', sans-serif;
    word-break: keep-all;
    overflow-x: hidden;
  }

  /* 반응형 폰트 사양 (사장님 가이드 100% 반영) */
  @media (max-width: 768px) {
    body { font-size: 17px; line-height: 1.65; letter-spacing: -0.02em; }
    .content-area { padding: 0 16px; }
  }
  @media (min-width: 769px) {
    body { font-size: 16px; line-height: 1.55; letter-spacing: -0.01em; }
    .content-area { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
  }

  /* 시각적 계층 구조 CSS */
  strong, b { font-weight: 700; color: #fff; }
  a { color: var(--naver-green); text-decoration: none; font-weight: 500; }
  a:hover { text-decoration: underline; }
  
  /* Beyond Reality 스타일 (Glassmorphism & 3D) */
  .glass-card { 
    background: var(--glass-bg); 
    border: 1px solid var(--glass-border); 
    border-radius: 32px; 
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    position: relative;
    overflow: hidden;
  }
  
  .glass-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
    transition: 0.5s;
  }
  
  .glass-card:hover {
    transform: translateY(-10px) scale(1.01);
    border-color: var(--naver-green);
    box-shadow: 0 30px 60px rgba(3,199,90,0.15), 0 0 40px rgba(3,199,90,0.1);
  }
  
  .glass-card:hover::before {
    left: 100%;
  }

  /* 애니메이션 */
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(3,199,90,0.3); }
    50% { box-shadow: 0 0 40px rgba(3,199,90,0.6); }
  }
  
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  .float-animation { animation: float 6s ease-in-out infinite; }
  .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
  
  .gradient-text {
    background: linear-gradient(135deg, #03C75A, #00ff88, #03C75A);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: gradient-shift 3s ease infinite;
  }

  /* 인풋 스타일 */
  .input-field {
    background: rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 16px 20px;
    color: #fff;
    width: 100%;
    outline: none;
    transition: all 0.3s ease;
  }
  
  .input-field:focus {
    border-color: var(--naver-green);
    box-shadow: 0 0 20px rgba(3,199,90,0.2);
  }

  /* 버튼 스타일 */
  .btn-primary {
    background: linear-gradient(135deg, #03C75A, #02a64b);
    border: none;
    border-radius: 24px;
    padding: 20px 40px;
    font-weight: 900;
    font-size: 20px;
    color: #fff;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .btn-primary:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 30px rgba(3,199,90,0.4);
  }
  
  .btn-primary:active {
    transform: scale(0.98);
  }

  /* 칩 스타일 */
  .chip {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 12px 20px;
    font-size: 14px;
    color: #888;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  
  .chip:hover {
    border-color: rgba(255,255,255,0.3);
    color: #fff;
  }
  
  .chip.active {
    background: rgba(3, 199, 90, 0.2);
    border-color: var(--naver-green);
    color: var(--naver-green);
    font-weight: 700;
  }
  
  .chip-gold {
    border-color: rgba(251, 191, 36, 0.3);
    color: #fbbf24;
  }

  /* 프로그레스 바 */
  .progress-bar {
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #03C75A, #00ff88);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  /* 엑셀 스타일 */
  .excel-sheet { 
    background: white; 
    color: black; 
    padding: 50px; 
    border: 3px solid #000; 
    font-family: 'Malgun Gothic', -apple-system, sans-serif; 
    width: 100%;
    max-width: 700px;
    box-shadow: 25px 25px 60px rgba(0,0,0,0.8);
    transform: rotate(-0.5deg);
  }
  
  .excel-table { 
    width: 100%; 
    border-collapse: collapse; 
    border: 2px solid #000; 
    margin-top: 20px; 
  }
  
  .excel-table th { 
    background: #e5e5e5; 
    border: 1px solid #000; 
    padding: 12px; 
    font-size: 13px; 
    font-weight: 700;
  }
  
  .excel-table td { 
    border: 1px solid #000; 
    padding: 10px 14px; 
    font-size: 13px; 
  }

  /* 스크롤바 커스텀 */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #555; }

  /* 배경 효과 */
  .bg-grid {
    background-image: 
      linear-gradient(rgba(3,199,90,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(3,199,90,0.03) 1px, transparent 1px);
    background-size: 50px 50px;
  }
  
  /* 로딩 스피너 */
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(3,199,90,0.2);
    border-top-color: var(--naver-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
</head>
<body class="bg-grid">
  <!-- 배경 글로우 효과 -->
  <div class="fixed inset-0 pointer-events-none overflow-hidden">
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl float-animation"></div>
    <div class="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl float-animation" style="animation-delay: -3s;"></div>
  </div>

  <div class="content-area relative z-10 py-12 space-y-12">
    <!-- 헤더 -->
    <header class="glass-card p-8 md:p-12">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl flex items-center justify-center font-black text-3xl shadow-lg pulse-glow">X</div>
          <div>
            <h1 class="text-3xl md:text-4xl font-black tracking-tighter italic">XIVIX <span class="gradient-text">2026 PRO</span></h1>
            <p class="text-sm text-gray-500 mt-1">상위 1% 보험 마케팅 마스터</p>
          </div>
        </div>
        <div class="flex gap-3">
          <a href="/admin" class="chip"><i class="fas fa-cog mr-2"></i>Admin</a>
          <a href="/api/docs" class="chip"><i class="fas fa-book mr-2"></i>API Docs</a>
        </div>
      </div>
    </header>

    <!-- 메인 입력 섹션 -->
    <section class="glass-card p-8 md:p-12 space-y-10">
      <!-- Step 1: 타겟 선택 -->
      <div class="space-y-4">
        <label class="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
          <span class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs">1</span>
          타겟 고객 선택
        </label>
        <div class="flex flex-wrap gap-3" id="target-chips">
          <button class="chip active" onclick="selectChip(this, 'target')">30대 워킹맘</button>
          <button class="chip" onclick="selectChip(this, 'target')">40대 가장</button>
          <button class="chip" onclick="selectChip(this, 'target')">50대 은퇴예정자</button>
          <button class="chip" onclick="selectChip(this, 'target')">법인대표/CEO</button>
          <button class="chip" onclick="selectChip(this, 'target')">자영업자</button>
        </div>
      </div>

      <!-- Step 2: 보험 종류 -->
      <div class="space-y-4">
        <label class="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
          <span class="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white text-xs">2</span>
          보험 종류 선택
        </label>
        <div class="flex flex-wrap gap-3" id="type-chips">
          <button class="chip active" onclick="selectChip(this, 'insuranceType')">상속/증여</button>
          <button class="chip chip-gold" onclick="selectChip(this, 'insuranceType')">CEO/법인</button>
          <button class="chip chip-gold" onclick="selectChip(this, 'insuranceType')">치매/간병</button>
          <button class="chip" onclick="selectChip(this, 'insuranceType')">유병자보험</button>
          <button class="chip" onclick="selectChip(this, 'insuranceType')">종신보험</button>
        </div>
      </div>

      <!-- Step 3: 보험사 & 스타일 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-3">
          <label class="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
            <span class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs">3</span>
            보험사 선택
          </label>
          <select id="company" class="input-field">
            <optgroup label="생명보험사">
              <option>삼성생명</option>
              <option>한화생명</option>
              <option>교보생명</option>
              <option>신한라이프</option>
              <option>NH농협생명</option>
              <option>메트라이프</option>
            </optgroup>
            <optgroup label="손해보험사">
              <option>현대해상</option>
              <option>DB손해보험</option>
              <option>KB손해보험</option>
              <option>삼성화재</option>
              <option>메리츠화재</option>
              <option>한화손해보험</option>
            </optgroup>
          </select>
        </div>
        <div class="space-y-3">
          <label class="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
            <span class="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs">4</span>
            제안서 스타일
          </label>
          <select id="style" class="input-field">
            <option>전문가 팩트체크형</option>
            <option>감성 공감 위로형</option>
            <option>세무 절세 분석형</option>
          </select>
        </div>
      </div>

      <!-- Step 4: 핵심 고민 입력 -->
      <div class="space-y-3">
        <label class="flex items-center gap-2 text-sm font-bold text-red-400 uppercase tracking-widest">
          <span class="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white text-xs">5</span>
          핵심 고민 (Angle) - 가장 중요!
        </label>
        <textarea id="concern" class="input-field h-32 resize-none text-xl" placeholder="예: 워킹맘인데 아이 교육자금으로 증여하려면 세금이 얼마나 나올까요?"></textarea>
      </div>

      <!-- 생성 버튼 -->
      <button onclick="generateContent()" id="generateBtn" class="btn-primary w-full text-center">
        <i class="fas fa-rocket mr-3"></i>🚀 데이터 대입 및 콘텐츠 생성 시작
      </button>
    </section>

    <!-- 프로그레스 섹션 -->
    <section id="progress-section" class="glass-card p-6 hidden">
      <div class="flex items-center justify-between mb-4">
        <span id="progress-text" class="text-sm font-bold text-green-400">분석 중...</span>
        <span id="progress-percent" class="text-sm font-bold text-green-400">0%</span>
      </div>
      <div class="progress-bar">
        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
      </div>
    </section>

    <!-- 결과 섹션 -->
    <section id="result-section" class="hidden space-y-8">
      <!-- 콘텐츠 결과 -->
      <div class="glass-card p-8 md:p-12 border-l-8 border-green-500">
        <div class="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <h2 class="text-xl font-black text-gray-400 uppercase tracking-wider">
            <i class="fas fa-file-alt mr-2 text-green-500"></i>Generated Content
          </h2>
          <div class="flex gap-3">
            <button onclick="downloadTxt()" class="chip"><i class="fas fa-download mr-2"></i>TXT</button>
            <button onclick="downloadPdf()" class="chip"><i class="fas fa-file-pdf mr-2"></i>PDF</button>
            <button onclick="copyAll()" class="chip"><i class="fas fa-copy mr-2"></i>복사</button>
          </div>
        </div>
        <div id="content" class="space-y-6 text-gray-200 leading-relaxed"></div>
      </div>

      <!-- 엑셀 설계서 -->
      <div class="glass-card p-8 md:p-12">
        <div class="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <h2 class="text-xl font-black text-gray-400 uppercase tracking-wider">
            <i class="fas fa-table mr-2 text-blue-500"></i>Monochrome Excel Policy
          </h2>
          <button onclick="generateExcel()" class="chip bg-blue-600 border-blue-500 text-white">
            <i class="fas fa-sync mr-2"></i>설계서 생성
          </button>
        </div>
        <div id="excel-area" class="flex justify-center bg-black/30 p-10 rounded-2xl border border-dashed border-gray-700 min-h-[300px] items-center">
          <span class="text-gray-600">설계서 생성 버튼을 클릭하세요</span>
        </div>
      </div>
    </section>
  </div>

  <script>
    // 상태 관리
    let state = {
      target: '30대 워킹맘',
      insuranceType: '상속/증여',
      company: '삼성생명',
      style: '전문가 팩트체크형',
      concern: ''
    };

    // 칩 선택
    function selectChip(el, key) {
      const parent = el.parentElement;
      parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      state[key] = el.innerText;
    }

    // 콘텐츠 생성
    async function generateContent() {
      const concern = document.getElementById('concern').value;
      if (!concern.trim()) {
        alert('핵심 고민(Angle)을 입력해주세요!');
        return;
      }

      state.concern = concern;
      state.company = document.getElementById('company').value;
      state.style = document.getElementById('style').value;

      // UI 업데이트
      document.getElementById('progress-section').classList.remove('hidden');
      document.getElementById('result-section').classList.remove('hidden');
      document.getElementById('content').innerHTML = '';
      
      const progressFill = document.getElementById('progress-fill');
      const progressText = document.getElementById('progress-text');
      const progressPercent = document.getElementById('progress-percent');
      
      progressFill.style.width = '10%';
      progressPercent.innerText = '10%';

      try {
        const response = await fetch('/api/generate/master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const content = document.getElementById('content');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const lines = decoder.decode(value).split('\\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              if (json.type === 'status') {
                progressText.innerText = json.msg;
                const percent = json.step * 25;
                progressFill.style.width = percent + '%';
                progressPercent.innerText = percent + '%';
              } else if (json.type === 'content') {
                content.innerHTML += json.data;
                progressFill.style.width = '90%';
                progressPercent.innerText = '90%';
              } else if (json.type === 'done') {
                progressFill.style.width = '100%';
                progressPercent.innerText = '100%';
                progressText.innerText = '✅ 콘텐츠 생성 완료!';
              } else if (json.type === 'error') {
                content.innerHTML = '<span class="text-red-400">' + json.msg + '</span>';
              }
            } catch (e) {}
          }
        }
      } catch (error) {
        document.getElementById('content').innerHTML = '<span class="text-red-400">네트워크 오류가 발생했습니다.</span>';
      }
    }

    // 엑셀 설계서 생성
    async function generateExcel() {
      const area = document.getElementById('excel-area');
      area.innerHTML = '<div class="spinner"></div>';

      try {
        const response = await fetch('/api/generate/excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });

        const json = await response.json();
        
        if (json.success && json.data) {
          const d = json.data;
          let html = '<div class="excel-sheet">';
          html += '<div style="font-size:28px; font-weight:900; border-bottom:4px solid #000; padding-bottom:15px; margin-bottom:20px; text-transform:uppercase; letter-spacing:-1px;">' + (d.product || '보험설계서') + '</div>';
          html += '<div style="font-size:14px; margin-bottom:20px; display:flex; justify-content:space-between; border-bottom:1px solid #ddd; padding-bottom:12px;">';
          html += '<span><b>피보험자:</b> ' + d.target + ' (' + d.gender + '/' + d.age + ')</span>';
          html += '<span><b>보험사:</b> ' + (d.company || state.company) + '</span>';
          html += '<span><b>문서코드:</b> ' + Math.random().toString(36).substr(2, 9).toUpperCase() + '</span>';
          html += '</div>';
          html += '<table class="excel-table"><tr><th>보장 항목</th><th style="width:130px;">가입금액</th><th style="width:110px;">보험료</th></tr>';
          
          if (d.items && Array.isArray(d.items)) {
            d.items.forEach(function(item) {
              html += '<tr><td>' + item.name + '</td><td style="text-align:right; font-weight:bold;">' + item.amount + '</td><td style="text-align:right;">' + item.premium + '</td></tr>';
            });
          }
          
          html += '</table>';
          html += '<div style="text-align:right; font-size:24px; font-weight:900; margin-top:30px; border-top:3px solid #000; padding-top:20px; color:#000;">월 합계 보험료: ' + (d.total || '-') + '</div>';
          html += '<div style="margin-top:40px; font-size:11px; color:#666; text-align:center; border:1px solid #ddd; padding:15px; background:#f9f9f9;">※ 본 제안서는 가상의 설계 예시이며, 실제 가입 시 보험사 공식 설계서를 반드시 확인하시기 바랍니다.</div>';
          html += '</div>';
          
          area.innerHTML = html;
        } else {
          area.innerHTML = '<span class="text-red-400">설계서 생성에 실패했습니다.</span>';
        }
      } catch (error) {
        area.innerHTML = '<span class="text-red-400">네트워크 오류가 발생했습니다.</span>';
      }
    }

    // TXT 다운로드
    function downloadTxt() {
      const content = document.getElementById('content').innerText;
      if (!content) {
        alert('먼저 콘텐츠를 생성해주세요!');
        return;
      }
      
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'XIVIX_' + state.insuranceType + '_' + new Date().toISOString().slice(0,10) + '.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // PDF 다운로드 (간이 버전)
    function downloadPdf() {
      const content = document.getElementById('content').innerText;
      if (!content) {
        alert('먼저 콘텐츠를 생성해주세요!');
        return;
      }
      
      // PDF 생성을 위한 새 창 열기
      const printWindow = window.open('', '_blank');
      printWindow.document.write(\`
        <!DOCTYPE html>
        <html>
        <head>
          <title>XIVIX 2026 PRO - \${state.insuranceType}</title>
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; line-height: 1.8; }
            h1 { color: #03C75A; border-bottom: 3px solid #03C75A; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>XIVIX 2026 PRO - \${state.insuranceType}</h1>
          <p><strong>타겟:</strong> \${state.target} | <strong>보험사:</strong> \${state.company} | <strong>스타일:</strong> \${state.style}</p>
          <hr>
          <pre style="white-space: pre-wrap;">\${content}</pre>
        </body>
        </html>
      \`);
      printWindow.document.close();
      printWindow.print();
    }

    // 전체 복사
    function copyAll() {
      const content = document.getElementById('content').innerText;
      if (!content) {
        alert('먼저 콘텐츠를 생성해주세요!');
        return;
      }
      
      navigator.clipboard.writeText(content).then(function() {
        alert('✅ 전체 내용이 클립보드에 복사되었습니다!');
      });
    }
  </script>
</body>
</html>
`

// ============================================
// 🔧 어드민 대시보드 페이지
// ============================================
const adminPageHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XIVIX 2026 PRO | Admin Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<style>
  body { background: #0a0a0a; color: #fff; font-family: -apple-system, sans-serif; }
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; }
  .stat-card { transition: all 0.3s ease; }
  .stat-card:hover { transform: translateY(-5px); border-color: #03C75A; }
</style>
</head>
<body class="p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <!-- 헤더 -->
    <header class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center font-black text-xl">X</div>
        <div>
          <h1 class="text-2xl font-black">Admin Dashboard</h1>
          <p class="text-sm text-gray-500">XIVIX 2026 PRO 관리자 패널</p>
        </div>
      </div>
      <a href="/" class="px-4 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition">
        <i class="fas fa-arrow-left mr-2"></i>메인으로
      </a>
    </header>

    <!-- 통계 카드 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="card stat-card p-6">
        <div class="text-3xl font-black text-green-500" id="totalKeys">-</div>
        <div class="text-sm text-gray-400 mt-2">활성 API 키</div>
      </div>
      <div class="card stat-card p-6">
        <div class="text-3xl font-black text-blue-500" id="expertEngine">-</div>
        <div class="text-sm text-gray-400 mt-2">전문가 엔진</div>
      </div>
      <div class="card stat-card p-6">
        <div class="text-3xl font-black text-purple-500" id="dataEngine">-</div>
        <div class="text-sm text-gray-400 mt-2">데이터 엔진</div>
      </div>
      <div class="card stat-card p-6">
        <div class="text-3xl font-black text-orange-500">v2026.1</div>
        <div class="text-sm text-gray-400 mt-2">시스템 버전</div>
      </div>
    </div>

    <!-- 시스템 정보 -->
    <div class="card p-8">
      <h2 class="text-xl font-bold mb-6"><i class="fas fa-server mr-2 text-green-500"></i>시스템 상태</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="font-bold text-gray-400 mb-3">API 엔드포인트</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between p-3 bg-black/30 rounded-lg">
              <span>POST /api/generate/master</span>
              <span class="text-green-400">● Active</span>
            </div>
            <div class="flex justify-between p-3 bg-black/30 rounded-lg">
              <span>POST /api/generate/excel</span>
              <span class="text-green-400">● Active</span>
            </div>
            <div class="flex justify-between p-3 bg-black/30 rounded-lg">
              <span>GET /api/health</span>
              <span class="text-green-400">● Active</span>
            </div>
            <div class="flex justify-between p-3 bg-black/30 rounded-lg">
              <span>GET /api/docs</span>
              <span class="text-green-400">● Active</span>
            </div>
          </div>
        </div>
        <div>
          <h3 class="font-bold text-gray-400 mb-3">기능 목록</h3>
          <div class="space-y-2 text-sm" id="features"></div>
        </div>
      </div>
    </div>

    <!-- 빠른 링크 -->
    <div class="card p-8">
      <h2 class="text-xl font-bold mb-6"><i class="fas fa-link mr-2 text-blue-500"></i>빠른 링크</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a href="/" class="p-4 bg-green-600/20 border border-green-600/30 rounded-xl text-center hover:bg-green-600/30 transition">
          <i class="fas fa-home text-2xl text-green-500 mb-2"></i>
          <div class="text-sm">메인 페이지</div>
        </a>
        <a href="/api/docs" class="p-4 bg-blue-600/20 border border-blue-600/30 rounded-xl text-center hover:bg-blue-600/30 transition">
          <i class="fas fa-book text-2xl text-blue-500 mb-2"></i>
          <div class="text-sm">API 문서</div>
        </a>
        <a href="/api/health" class="p-4 bg-purple-600/20 border border-purple-600/30 rounded-xl text-center hover:bg-purple-600/30 transition">
          <i class="fas fa-heartbeat text-2xl text-purple-500 mb-2"></i>
          <div class="text-sm">Health Check</div>
        </a>
        <a href="/api/admin/stats" class="p-4 bg-orange-600/20 border border-orange-600/30 rounded-xl text-center hover:bg-orange-600/30 transition">
          <i class="fas fa-chart-bar text-2xl text-orange-500 mb-2"></i>
          <div class="text-sm">통계 API</div>
        </a>
      </div>
    </div>
  </div>

  <script>
    // 통계 로드
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => {
        document.getElementById('totalKeys').innerText = data.totalKeys;
        document.getElementById('expertEngine').innerText = data.engines.expert.split('-').pop();
        document.getElementById('dataEngine').innerText = data.engines.data.split('-').pop();
        
        const features = document.getElementById('features');
        data.features.forEach(f => {
          features.innerHTML += '<div class="p-3 bg-black/30 rounded-lg flex items-center"><i class="fas fa-check text-green-400 mr-3"></i>' + f + '</div>';
        });
      });
  </script>
</body>
</html>
`

app.get('/', (c) => c.html(mainPageHtml))
app.get('/admin', (c) => c.html(adminPageHtml))

export default app
