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
  
  if (maleKeywords.some(k => target.includes(k) || concern.includes(k))) {
    gender = '남성'
  }
  if (femaleKeywords.some(k => target.includes(k) || concern.includes(k))) {
    gender = '여성'
  }
  
  const ageMatch = target.match(/(\d+)대/) || concern.match(/(\d+)대/)
  const age = ageMatch ? ageMatch[1] + '세' : '35세'
  
  return { gender, age, target }
}

// ============================================
// [로직 2] 김미경 지사장급 초정밀 전문가 프롬프트
// - 타이포그래피 가이드 ❶❷❸, ■, ✔️ 강제 적용
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
- 보험사명 "${data.company}"을 답변에 자연스럽게 포함할 것

[전문가 지식 가이드 - 절대 준수]
1. 상속/증여: 상증법 제8조(간주상속재산) 법리, 수익자 지정에 따른 상속세 절세 원리, 10년 주기 증여 한도 소명 전략.
2. CEO/법인: 법인세 손비처리 한도, 가지급금 정리용 퇴직금 재원, 임원배상책임 리스크 관리.
3. 치매/간병: CDR 척도별 판정 기준(CDR 0.5~3단계), ADL(일상생활장애) 보장 공백, 체증형 일당의 화폐가치 방어 논리.
4. 유병자보험: 간편심사 기준, 고지의무 범위, 기왕증 부담보 조건.

[타이포그래피 가이드 - 필수 적용]
- 단계별 프로세스 설명 시 반드시 ❶ ❷ ❸ 기호 사용
- 핵심 개념 정의 시 반드시 ■ (Black Square) 기호 사용
- 체크리스트/장점 나열 시 반드시 ✔️ (Check Mark) 기호 사용
- 마크다운 표(|) 금지, HTML <br> 태그로 줄바꿈
- word-break: keep-all 규칙에 맞게 한글 단어 단위 줄바꿈

[콘텐츠 구성 가이드]
- 질문: 수만 가지 상황 중 랜덤 생성 (보험 초보가 동네 형에게 묻듯 현실적으로)
- 답변: 3가지 스타일로 작성하되 각 답변당 최소 1,200자 이상의 압도적 정보량과 공감 제공
- 각 답변에 전문 용어(상증법 제8조, CDR 척도, 손비처리)를 자연스럽게 배치

[알고리즘 대응 전략]
- C-Rank: 전문 지식을 자연스럽게 녹여 '전문성' 시그널 발생
- DIA/Agent N: '정보의 이득'을 극대화한 구체적인 수치와 해결책 제시

[출력 구조 - 반드시 이 형식으로]

=== SEO 노출 점수 ===
등급: S/A/B/C 중 하나
점수: 0~100점
예상 노출 순위: 상위 n%

=== 제목 (2개) ===
❶ (클릭을 유도하는 제목)
❷ (정보성을 강조하는 제목)

=== 키워드 (5개) ===
✔️ 키워드1
✔️ 키워드2
✔️ 키워드3
✔️ 키워드4
✔️ 키워드5

=== 질문 (3개) ===

■ [질문1]
(${p.gender}의 화법으로 현실적인 고민을 질문)

■ [질문2]
(다른 상황의 질문)

■ [질문3]
(또 다른 상황의 질문)

=== 전문가 답변 ===

■ [답변1 - ${data.style}]

❶ 결론부터 말씀드리면...
(핵심 결론 먼저 제시)

❷ 상세 설명
(전문 지식을 쉽게 풀어서 설명, 1,200자 이상)

❸ 실행 가이드
✔️ 첫 번째 할 일
✔️ 두 번째 할 일
✔️ 세 번째 할 일

■ [답변2]
(위와 동일한 구조로 1,200자 이상)

■ [답변3]
(위와 동일한 구조로 1,200자 이상)

=== 핵심 포인트 ===
❶ (가장 중요한 포인트)
❷ (두 번째 중요한 포인트)
❸ (세 번째 중요한 포인트)

=== 댓글 (5개) ===
✔️ [댓글1] (공감하는 댓글)
✔️ [댓글2] (질문하는 댓글)
✔️ [댓글3] (정보 추가하는 댓글)
✔️ [댓글4] (감사하는 댓글)
✔️ [댓글5] (경험 공유하는 댓글)`
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
- ${data.company}의 실제 상품명 스타일로 작성

[출력 형식 - 반드시 JSON만 출력]
{
  "product": "${data.company} ${data.insuranceType} 마스터 플랜",
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
    await stream.write(JSON.stringify({ type: 'status', step: 2, msg: `⚖️ 2단계: ${body.company} 최신 약관 및 법리 대입 중...` }) + '\n')
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
    version: '2026.2.0',
    engines: {
      expert: EXPERT_ENGINE,
      data: DATA_ENGINE
    },
    apiKeysAvailable: API_KEYS.length,
    typographyGuide: {
      process: '❶ ❷ ❸',
      emphasis: '■',
      check: '✔️'
    }
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
      version: '2026.2.0',
      description: '대한민국 상위 1% 보험 마케팅 콘텐츠 생성 API - 타이포그래피 가이드 적용'
    },
    servers: [{ url: '/' }],
    paths: {
      '/api/generate/master': {
        post: {
          summary: 'Q&A 콘텐츠 스트리밍 생성',
          description: '❶❷❸, ■, ✔️ 기호가 적용된 전문가 콘텐츠 생성',
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
          responses: { '200': { description: 'Streaming response with typography symbols' } }
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
          responses: { '200': { description: 'Server status with typography guide' } }
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
    features: ['Q&A 생성', '엑셀 설계서', 'TXT 다운로드', 'PDF 생성', '타이포그래피 가이드'],
    typographySymbols: ['❶❷❸ (프로세스)', '■ (강조)', '✔️ (체크)'],
    lastUpdated: new Date().toISOString()
  })
})

// ============================================
// 🖥️ 메인 UI - 2026 BEYOND REALITY 스타일
// 움직이는 UI/UX + 3D + 파티클 + 네온 + 마이크로인터랙션
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
  /* ============================================
     [2026 BEYOND REALITY] 움직이는 UI/UX 마스터
     ============================================ */
  :root { 
    --neon-green: #00ff88;
    --neon-cyan: #00f5ff;
    --neon-purple: #bf00ff;
    --neon-pink: #ff00aa;
    --glass-bg: rgba(10,10,10,0.6);
    --glass-border: rgba(255,255,255,0.08);
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  html { scroll-behavior: smooth; }
  
  body { 
    background: #000; 
    color: #fff; 
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif;
    word-break: keep-all;
    overflow-x: hidden;
    min-height: 100vh;
  }

  /* 반응형 폰트 */
  @media (max-width: 768px) {
    body { font-size: 17px; line-height: 1.65; letter-spacing: -0.02em; }
    .content-area { padding: 0 16px; }
    .hero-title { font-size: 2.5rem !important; }
  }
  @media (min-width: 769px) {
    body { font-size: 16px; line-height: 1.55; letter-spacing: -0.01em; }
    .content-area { max-width: 1400px; margin: 0 auto; padding: 0 40px; }
  }

  /* ============================================
     [움직이는 배경] 파티클 + 그라디언트 애니메이션
     ============================================ */
  .animated-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    background: 
      radial-gradient(ellipse at 20% 80%, rgba(0,255,136,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(0,245,255,0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(191,0,255,0.05) 0%, transparent 60%),
      linear-gradient(180deg, #000 0%, #0a0a0a 50%, #000 100%);
    animation: bgPulse 8s ease-in-out infinite;
  }
  
  @keyframes bgPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }

  /* 파티클 캔버스 */
  #particles { position: fixed; top: 0; left: 0; z-index: 0; pointer-events: none; }

  /* 움직이는 그리드 */
  .moving-grid {
    position: fixed;
    top: 0;
    left: 0;
    width: 200%;
    height: 200%;
    background-image: 
      linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    animation: gridMove 20s linear infinite;
    z-index: 0;
    pointer-events: none;
  }
  
  @keyframes gridMove {
    0% { transform: translate(0, 0); }
    100% { transform: translate(-60px, -60px); }
  }

  /* ============================================
     [글래스모피즘] 고급 블러 카드
     ============================================ */
  .glass-card {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 32px;
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    position: relative;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
  }
  
  .glass-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: -150%;
    width: 150%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03), transparent);
    transform: skewX(-20deg);
    transition: 0.8s ease;
  }
  
  .glass-card:hover {
    border-color: rgba(0,255,136,0.3);
    box-shadow: 
      0 0 40px rgba(0,255,136,0.15),
      0 30px 60px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.1);
    transform: translateY(-8px) scale(1.01);
  }
  
  .glass-card:hover::before {
    left: 150%;
  }

  /* ============================================
     [3D 호버 효과] perspective 카드
     ============================================ */
  .card-3d {
    perspective: 1000px;
    transform-style: preserve-3d;
  }
  
  .card-3d-inner {
    transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    transform-style: preserve-3d;
  }
  
  .card-3d:hover .card-3d-inner {
    transform: rotateX(5deg) rotateY(-5deg);
  }

  /* ============================================
     [네온 글로우 검색창] 트렌디한 입력 필드
     ============================================ */
  .search-container {
    position: relative;
    margin: 40px auto;
    max-width: 900px;
  }
  
  .neon-input-wrapper {
    position: relative;
    border-radius: 28px;
    padding: 3px;
    background: linear-gradient(135deg, var(--neon-green), var(--neon-cyan), var(--neon-purple), var(--neon-pink));
    background-size: 300% 300%;
    animation: neonBorder 4s ease infinite;
  }
  
  @keyframes neonBorder {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  .neon-input-wrapper::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 30px;
    background: inherit;
    filter: blur(15px);
    opacity: 0.6;
    z-index: -1;
    animation: neonPulse 2s ease-in-out infinite;
  }
  
  @keyframes neonPulse {
    0%, 100% { opacity: 0.4; filter: blur(15px); }
    50% { opacity: 0.8; filter: blur(25px); }
  }
  
  .neon-input {
    width: 100%;
    background: rgba(0,0,0,0.9);
    border: none;
    border-radius: 25px;
    padding: 24px 32px;
    font-size: 18px;
    color: #fff;
    outline: none;
    transition: all 0.3s ease;
  }
  
  .neon-input::placeholder {
    color: rgba(255,255,255,0.4);
    transition: all 0.3s ease;
  }
  
  .neon-input:focus::placeholder {
    color: transparent;
    transform: translateY(-20px);
  }
  
  .neon-input:focus {
    box-shadow: inset 0 0 30px rgba(0,255,136,0.1);
  }
  
  /* 타이핑 커서 애니메이션 */
  .typing-cursor {
    display: inline-block;
    width: 2px;
    height: 24px;
    background: var(--neon-green);
    margin-left: 4px;
    animation: blink 0.8s ease-in-out infinite;
    vertical-align: middle;
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  /* ============================================
     [3D 버튼] 눌림 효과 + 네온
     ============================================ */
  .btn-3d {
    position: relative;
    background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
    border: none;
    border-radius: 20px;
    padding: 20px 48px;
    font-weight: 800;
    font-size: 18px;
    color: #000;
    cursor: pointer;
    overflow: hidden;
    transform-style: preserve-3d;
    transition: all 0.3s ease;
    box-shadow: 
      0 8px 0 #00994d,
      0 15px 30px rgba(0,255,136,0.3);
  }
  
  .btn-3d::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transition: 0.5s;
  }
  
  .btn-3d:hover {
    transform: translateY(-4px);
    box-shadow: 
      0 12px 0 #00994d,
      0 25px 50px rgba(0,255,136,0.5);
  }
  
  .btn-3d:hover::before {
    left: 100%;
  }
  
  .btn-3d:active {
    transform: translateY(4px);
    box-shadow: 
      0 4px 0 #00994d,
      0 8px 20px rgba(0,255,136,0.2);
  }

  /* ============================================
     [칩 버튼] 마이크로 인터랙션
     ============================================ */
  .chip {
    position: relative;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 14px 24px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  }
  
  .chip::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    background: rgba(0,255,136,0.2);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: width 0.6s ease, height 0.6s ease;
  }
  
  .chip:hover {
    color: #fff;
    border-color: rgba(255,255,255,0.3);
    transform: translateY(-2px);
  }
  
  .chip:hover::after {
    width: 200px;
    height: 200px;
  }
  
  .chip.active {
    background: rgba(0,255,136,0.15);
    border-color: var(--neon-green);
    color: var(--neon-green);
    font-weight: 700;
    box-shadow: 0 0 20px rgba(0,255,136,0.2);
  }
  
  .chip-gold {
    border-color: rgba(255,200,0,0.3);
    color: rgba(255,200,0,0.8);
  }
  
  .chip-gold.active {
    background: rgba(255,200,0,0.15);
    border-color: #ffc800;
    color: #ffc800;
    box-shadow: 0 0 20px rgba(255,200,0,0.2);
  }

  /* ============================================
     [로고 애니메이션] 3D 회전 + 글로우
     ============================================ */
  .logo-container {
    position: relative;
    width: 80px;
    height: 80px;
    perspective: 500px;
  }
  
  .logo-cube {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    animation: logoCube 10s ease-in-out infinite;
  }
  
  @keyframes logoCube {
    0%, 100% { transform: rotateY(0deg) rotateX(0deg); }
    25% { transform: rotateY(10deg) rotateX(5deg); }
    50% { transform: rotateY(0deg) rotateX(0deg); }
    75% { transform: rotateY(-10deg) rotateX(-5deg); }
  }
  
  .logo-face {
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #00ff88 0%, #00aa55 100%);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    font-weight: 900;
    color: #000;
    box-shadow: 
      0 0 30px rgba(0,255,136,0.5),
      inset 0 0 30px rgba(255,255,255,0.2);
  }

  /* ============================================
     [히어로 타이틀] 글리치 + 그라디언트
     ============================================ */
  .hero-title {
    font-size: 4rem;
    font-weight: 900;
    letter-spacing: -0.05em;
    background: linear-gradient(135deg, #fff 0%, #00ff88 50%, #00f5ff 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: titleGradient 5s ease infinite;
    position: relative;
  }
  
  @keyframes titleGradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  .hero-title::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    background: linear-gradient(135deg, #00ff88, #00f5ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    opacity: 0;
    animation: glitch 3s ease-in-out infinite;
  }
  
  @keyframes glitch {
    0%, 90%, 100% { opacity: 0; transform: translate(0); }
    92% { opacity: 0.8; transform: translate(-2px, 2px); }
    94% { opacity: 0.8; transform: translate(2px, -2px); }
    96% { opacity: 0; }
  }

  /* ============================================
     [스텝 인디케이터] 프로그레스 라인
     ============================================ */
  .step-indicator {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: rgba(0,255,136,0.1);
    border-radius: 12px;
    border: 1px solid rgba(0,255,136,0.2);
  }
  
  .step-number {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 14px;
    transition: all 0.3s ease;
  }
  
  .step-number.active {
    background: var(--neon-green);
    color: #000;
    box-shadow: 0 0 20px rgba(0,255,136,0.4);
  }
  
  .step-number.inactive {
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.5);
  }

  /* ============================================
     [프로그레스 바] 애니메이션
     ============================================ */
  .progress-container {
    position: relative;
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan));
    border-radius: 4px;
    position: relative;
    transition: width 0.5s ease;
  }
  
  .progress-bar-fill::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: progressShine 1.5s ease-in-out infinite;
  }
  
  @keyframes progressShine {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* ============================================
     [Select 드롭다운] 커스텀 스타일
     ============================================ */
  .custom-select {
    position: relative;
    background: rgba(0,0,0,0.6);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 18px 24px;
    color: #fff;
    font-size: 16px;
    width: 100%;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: all 0.3s ease;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2300ff88' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 16px center;
    background-size: 20px;
  }
  
  .custom-select:hover {
    border-color: rgba(0,255,136,0.3);
  }
  
  .custom-select:focus {
    border-color: var(--neon-green);
    box-shadow: 0 0 20px rgba(0,255,136,0.15);
  }
  
  .custom-select option {
    background: #111;
    color: #fff;
    padding: 12px;
  }

  /* ============================================
     [텍스트에어리어] 네온 포커스
     ============================================ */
  .neon-textarea {
    width: 100%;
    min-height: 140px;
    background: rgba(0,0,0,0.6);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 20px 24px;
    color: #fff;
    font-size: 18px;
    line-height: 1.6;
    resize: none;
    outline: none;
    transition: all 0.3s ease;
  }
  
  .neon-textarea::placeholder {
    color: rgba(255,255,255,0.3);
  }
  
  .neon-textarea:focus {
    border-color: var(--neon-green);
    box-shadow: 
      0 0 30px rgba(0,255,136,0.15),
      inset 0 0 20px rgba(0,255,136,0.05);
  }

  /* ============================================
     [결과 카드] 애니메이션 등장
     ============================================ */
  .result-card {
    animation: cardSlideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    opacity: 0;
    transform: translateY(40px);
  }
  
  @keyframes cardSlideUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ============================================
     [엑셀 시트] 프리미엄 스타일
     ============================================ */
  .excel-sheet {
    background: #fff;
    color: #000;
    padding: 48px;
    border-radius: 0;
    font-family: 'Malgun Gothic', -apple-system, sans-serif;
    width: 100%;
    max-width: 700px;
    box-shadow: 
      0 50px 100px rgba(0,0,0,0.8),
      0 0 0 1px rgba(255,255,255,0.1);
    position: relative;
    transform: perspective(1000px) rotateX(2deg);
    transition: transform 0.5s ease;
  }
  
  .excel-sheet:hover {
    transform: perspective(1000px) rotateX(0deg) scale(1.02);
  }
  
  .excel-sheet::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan), var(--neon-purple));
  }
  
  .excel-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    margin-top: 20px;
  }
  
  .excel-table th {
    background: #1a1a1a;
    color: #fff;
    border: 1px solid #333;
    padding: 14px;
    font-size: 13px;
    font-weight: 700;
  }
  
  .excel-table td {
    border: 1px solid #ddd;
    padding: 12px 16px;
    font-size: 13px;
    transition: background 0.2s ease;
  }
  
  .excel-table tr:hover td {
    background: #f5f5f5;
  }

  /* ============================================
     [스크롤바] 네온 스타일
     ============================================ */
  ::-webkit-scrollbar { width: 10px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { 
    background: linear-gradient(180deg, var(--neon-green), var(--neon-cyan));
    border-radius: 5px;
  }
  ::-webkit-scrollbar-thumb:hover { 
    background: linear-gradient(180deg, #00ff88, #00f5ff);
  }

  /* ============================================
     [로딩 스피너] 네온 링
     ============================================ */
  .neon-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(0,255,136,0.1);
    border-top-color: var(--neon-green);
    border-right-color: var(--neon-cyan);
    border-radius: 50%;
    animation: neonSpin 1s linear infinite;
  }
  
  @keyframes neonSpin {
    to { transform: rotate(360deg); }
  }

  /* ============================================
     [플로팅 요소] 장식
     ============================================ */
  .floating-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.5;
    animation: floatOrb 8s ease-in-out infinite;
  }
  
  @keyframes floatOrb {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(30px, -30px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
  }

  /* 타이포그래피 가이드 */
  strong, b { font-weight: 700; color: #fff; }
  a { color: var(--neon-green); text-decoration: none; font-weight: 500; transition: all 0.3s ease; }
  a:hover { text-shadow: 0 0 10px rgba(0,255,136,0.5); }

  /* 콘텐츠 영역 */
  #content { font-size: inherit; line-height: 1.8; }
  #content br { display: block; margin: 8px 0; }
  
  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .hero-title { font-size: 2rem !important; }
    .btn-3d { padding: 16px 32px; font-size: 16px; }
    .glass-card { border-radius: 24px; }
    .neon-input { padding: 20px 24px; font-size: 16px; }
  }
</style>
</head>
<body>
  <!-- 움직이는 배경 -->
  <div class="animated-bg"></div>
  <div class="moving-grid"></div>
  <canvas id="particles"></canvas>
  
  <!-- 플로팅 오브 장식 -->
  <div class="floating-orb" style="top: 10%; left: 5%; width: 300px; height: 300px; background: var(--neon-green);"></div>
  <div class="floating-orb" style="top: 60%; right: 10%; width: 200px; height: 200px; background: var(--neon-cyan); animation-delay: -3s;"></div>
  <div class="floating-orb" style="bottom: 10%; left: 30%; width: 250px; height: 250px; background: var(--neon-purple); animation-delay: -5s;"></div>

  <div class="content-area relative z-10 py-12 space-y-10">
    
    <!-- 헤더 -->
    <header class="glass-card p-8 md:p-10 card-3d">
      <div class="card-3d-inner flex items-center justify-between flex-wrap gap-6">
        <div class="flex items-center gap-5">
          <div class="logo-container">
            <div class="logo-cube">
              <div class="logo-face">X</div>
            </div>
          </div>
          <div>
            <h1 class="hero-title" data-text="XIVIX 2026 PRO">XIVIX <span style="color: #00ff88; -webkit-text-fill-color: #00ff88;">2026</span> PRO</h1>
            <p class="text-sm text-gray-400 mt-2 flex items-center gap-2">
              <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              상위 1% 보험 마케팅 마스터 엔진
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <a href="/admin" class="chip"><i class="fas fa-cog mr-2"></i>Admin</a>
          <a href="/api/docs" class="chip"><i class="fas fa-book mr-2"></i>Docs</a>
        </div>
      </div>
    </header>

    <!-- 네온 검색창 (핵심 고민 입력) -->
    <section class="glass-card p-10 md:p-14 space-y-10">
      
      <!-- 메인 검색창 -->
      <div class="search-container">
        <div class="text-center mb-6">
          <span class="text-sm font-medium text-gray-400 uppercase tracking-wider">핵심 고민 / Angle</span>
          <h2 class="text-2xl md:text-3xl font-bold mt-2">무엇이 궁금하신가요?</h2>
        </div>
        <div class="neon-input-wrapper">
          <textarea id="concern" class="neon-input resize-none" rows="3" placeholder="예: 워킹맘인데 아이 교육자금으로 증여하려면 세금이 얼마나 나올까요?"></textarea>
        </div>
      </div>
      
      <!-- 설정 그리드 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
        
        <!-- 타겟 -->
        <div class="space-y-4">
          <div class="step-indicator">
            <span class="step-number active">❶</span>
            <span class="text-sm font-medium">타겟 고객</span>
          </div>
          <div class="flex flex-wrap gap-2" id="target-chips">
            <button class="chip active" onclick="selectChip(this, 'target')">30대 워킹맘</button>
            <button class="chip" onclick="selectChip(this, 'target')">40대 가장</button>
            <button class="chip" onclick="selectChip(this, 'target')">50대 은퇴예정자</button>
            <button class="chip" onclick="selectChip(this, 'target')">법인대표/CEO</button>
            <button class="chip" onclick="selectChip(this, 'target')">자영업자</button>
          </div>
        </div>

        <!-- 보험 종류 -->
        <div class="space-y-4">
          <div class="step-indicator">
            <span class="step-number active">❷</span>
            <span class="text-sm font-medium">보험 종류</span>
          </div>
          <div class="flex flex-wrap gap-2" id="type-chips">
            <button class="chip active" onclick="selectChip(this, 'insuranceType')">상속/증여</button>
            <button class="chip chip-gold" onclick="selectChip(this, 'insuranceType')">CEO/법인</button>
            <button class="chip chip-gold" onclick="selectChip(this, 'insuranceType')">치매/간병</button>
            <button class="chip" onclick="selectChip(this, 'insuranceType')">유병자보험</button>
            <button class="chip" onclick="selectChip(this, 'insuranceType')">종신보험</button>
          </div>
        </div>

        <!-- 보험사 -->
        <div class="space-y-4">
          <div class="step-indicator">
            <span class="step-number active">❸</span>
            <span class="text-sm font-medium">보험사</span>
          </div>
          <select id="company" class="custom-select">
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

        <!-- 스타일 -->
        <div class="space-y-4">
          <div class="step-indicator">
            <span class="step-number active">❹</span>
            <span class="text-sm font-medium">제안서 스타일</span>
          </div>
          <select id="style" class="custom-select">
            <option>전문가 팩트체크형</option>
            <option>감성 공감 위로형</option>
            <option>세무 절세 분석형</option>
          </select>
        </div>
      </div>

      <!-- 생성 버튼 -->
      <div class="flex justify-center pt-6">
        <button onclick="generateContent()" id="generateBtn" class="btn-3d">
          <i class="fas fa-bolt mr-3"></i>
          AI 콘텐츠 생성
        </button>
      </div>
    </section>

    <!-- 프로그레스 섹션 -->
    <section id="progress-section" class="glass-card p-6 hidden">
      <div class="flex items-center justify-between mb-4">
        <span id="progress-text" class="text-sm font-bold text-green-400">🔍 분석 중...</span>
        <span id="progress-percent" class="text-sm font-bold text-green-400">0%</span>
      </div>
      <div class="progress-container">
        <div id="progress-fill" class="progress-bar-fill" style="width: 0%"></div>
      </div>
    </section>

    <!-- 결과 섹션 -->
    <section id="result-section" class="hidden space-y-8">
      <!-- 콘텐츠 결과 -->
      <div class="glass-card p-8 md:p-12 result-card" style="animation-delay: 0.1s; border-left: 4px solid var(--neon-green);">
        <div class="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <h2 class="text-xl font-black flex items-center gap-3">
            <i class="fas fa-file-alt text-green-400"></i>
            <span>Generated Content</span>
          </h2>
          <div class="flex gap-3">
            <button onclick="downloadTxt()" class="chip"><i class="fas fa-download mr-2"></i>TXT</button>
            <button onclick="downloadPdf()" class="chip"><i class="fas fa-file-pdf mr-2"></i>PDF</button>
            <button onclick="copyAll()" class="chip"><i class="fas fa-copy mr-2"></i>복사</button>
          </div>
        </div>
        <div id="content" class="space-y-4 text-gray-200"></div>
      </div>

      <!-- 엑셀 설계서 -->
      <div class="glass-card p-8 md:p-12 result-card" style="animation-delay: 0.2s;">
        <div class="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <h2 class="text-xl font-black flex items-center gap-3">
            <i class="fas fa-table text-cyan-400"></i>
            <span>Monochrome Excel Policy</span>
          </h2>
          <button onclick="generateExcel()" class="btn-3d" style="padding: 12px 24px; font-size: 14px; box-shadow: 0 4px 0 #00994d, 0 8px 16px rgba(0,255,136,0.2);">
            <i class="fas fa-sync mr-2"></i>설계서 생성
          </button>
        </div>
        <div id="excel-area" class="flex justify-center items-center min-h-[300px] bg-black/30 rounded-2xl border border-dashed border-gray-700">
          <div class="text-center text-gray-500">
            <i class="fas fa-file-excel text-4xl mb-4 opacity-30"></i>
            <p>설계서 생성 버튼을 클릭하세요</p>
          </div>
        </div>
      </div>
    </section>

  </div>

  <script>
    // ============================================
    // [파티클 시스템] Canvas 애니메이션
    // ============================================
    const canvas = document.getElementById('particles');
    const ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const particles = [];
    const particleCount = 80;
    
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2,
        color: ['#00ff88', '#00f5ff', '#bf00ff'][Math.floor(Math.random() * 3)]
      });
    }
    
    function animateParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, i) => {
        p.x += p.speedX;
        p.y += p.speedY;
        
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        
        // 연결선
        particles.forEach((p2, j) => {
          if (i === j) return;
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 120) * 0.15;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      
      ctx.globalAlpha = 1;
      requestAnimationFrame(animateParticles);
    }
    animateParticles();

    // ============================================
    // [상태 관리]
    // ============================================
    let state = {
      target: '30대 워킹맘',
      insuranceType: '상속/증여',
      company: '삼성생명',
      style: '전문가 팩트체크형',
      concern: ''
    };

    // ============================================
    // [칩 선택] 리플 효과
    // ============================================
    function selectChip(el, key) {
      const parent = el.parentElement;
      parent.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      state[key] = el.innerText;
      
      // 리플 효과
      const ripple = document.createElement('span');
      ripple.style.cssText = 'position:absolute;background:rgba(0,255,136,0.3);border-radius:50%;transform:scale(0);animation:ripple 0.6s linear;pointer-events:none;';
      const rect = el.getBoundingClientRect();
      ripple.style.width = ripple.style.height = Math.max(rect.width, rect.height) + 'px';
      ripple.style.left = '50%';
      ripple.style.top = '50%';
      ripple.style.marginLeft = -Math.max(rect.width, rect.height) / 2 + 'px';
      ripple.style.marginTop = -Math.max(rect.width, rect.height) / 2 + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }

    // 리플 애니메이션 CSS 추가
    const style = document.createElement('style');
    style.textContent = '@keyframes ripple { to { transform: scale(2); opacity: 0; } }';
    document.head.appendChild(style);

    // ============================================
    // [콘텐츠 생성] 스트리밍
    // ============================================
    async function generateContent() {
      const concern = document.getElementById('concern').value;
      if (!concern.trim()) {
        // 커스텀 알림
        showToast('핵심 고민(Angle)을 입력해주세요!', 'warning');
        document.getElementById('concern').focus();
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
      progressText.innerText = '🔍 타겟 페르소나 정밀 분석 중...';

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
                showToast('콘텐츠 생성이 완료되었습니다!', 'success');
              } else if (json.type === 'error') {
                content.innerHTML = '<span class="text-red-400">' + json.msg + '</span>';
                showToast(json.msg, 'error');
              }
            } catch (e) {}
          }
        }
      } catch (error) {
        document.getElementById('content').innerHTML = '<span class="text-red-400">네트워크 오류가 발생했습니다.</span>';
        showToast('네트워크 오류가 발생했습니다.', 'error');
      }
    }

    // ============================================
    // [엑셀 설계서 생성]
    // ============================================
    async function generateExcel() {
      const area = document.getElementById('excel-area');
      area.innerHTML = '<div class="neon-spinner"></div>';

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
          html += '<div style="font-size:24px; font-weight:900; border-bottom:3px solid #000; padding-bottom:15px; margin-bottom:20px; letter-spacing:-1px;">' + (d.product || '보험설계서') + '</div>';
          html += '<div style="font-size:13px; margin-bottom:20px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; border-bottom:1px solid #ddd; padding-bottom:12px;">';
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
          html += '<div style="text-align:right; font-size:20px; font-weight:900; margin-top:25px; border-top:2px solid #000; padding-top:15px; color:#000;">월 합계 보험료: ' + (d.total || '-') + '</div>';
          html += '<div style="margin-top:30px; font-size:10px; color:#666; text-align:center; border:1px solid #ddd; padding:12px; background:#f9f9f9;">※ 본 제안서는 가상의 설계 예시이며, 실제 가입 시 보험사 공식 설계서를 반드시 확인하시기 바랍니다.</div>';
          html += '</div>';
          
          area.innerHTML = html;
          showToast('설계서가 생성되었습니다!', 'success');
        } else {
          area.innerHTML = '<span class="text-red-400">설계서 생성에 실패했습니다.</span>';
          showToast('설계서 생성에 실패했습니다.', 'error');
        }
      } catch (error) {
        area.innerHTML = '<span class="text-red-400">네트워크 오류가 발생했습니다.</span>';
        showToast('네트워크 오류가 발생했습니다.', 'error');
      }
    }

    // ============================================
    // [토스트 알림]
    // ============================================
    function showToast(message, type = 'info') {
      const colors = {
        success: 'linear-gradient(135deg, #00ff88, #00aa55)',
        error: 'linear-gradient(135deg, #ff4444, #cc0000)',
        warning: 'linear-gradient(135deg, #ffaa00, #ff8800)',
        info: 'linear-gradient(135deg, #00f5ff, #0088ff)'
      };
      
      const toast = document.createElement('div');
      toast.style.cssText = \`
        position: fixed;
        bottom: 30px;
        right: 30px;
        padding: 16px 28px;
        background: \${colors[type]};
        color: \${type === 'warning' ? '#000' : '#fff'};
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        z-index: 9999;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      \`;
      toast.innerText = message;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
      }, 10);
      
      setTimeout(() => {
        toast.style.transform = 'translateY(100px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
      }, 3000);
    }

    // ============================================
    // [다운로드 기능들]
    // ============================================
    function downloadTxt() {
      const content = document.getElementById('content').innerText;
      if (!content) {
        showToast('먼저 콘텐츠를 생성해주세요!', 'warning');
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
      showToast('TXT 파일이 다운로드되었습니다!', 'success');
    }

    function downloadPdf() {
      const content = document.getElementById('content').innerText;
      if (!content) {
        showToast('먼저 콘텐츠를 생성해주세요!', 'warning');
        return;
      }
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(\`
        <!DOCTYPE html>
        <html>
        <head>
          <title>XIVIX 2026 PRO - \${state.insuranceType}</title>
          <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; line-height: 1.8; word-break: keep-all; }
            h1 { color: #00aa55; border-bottom: 3px solid #00aa55; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>XIVIX 2026 PRO - \${state.insuranceType}</h1>
          <p><strong>타겟:</strong> \${state.target} | <strong>보험사:</strong> \${state.company} | <strong>스타일:</strong> \${state.style}</p>
          <hr>
          <pre style="white-space: pre-wrap; font-family: inherit;">\${content}</pre>
        </body>
        </html>
      \`);
      printWindow.document.close();
      printWindow.print();
    }

    function copyAll() {
      const content = document.getElementById('content').innerText;
      if (!content) {
        showToast('먼저 콘텐츠를 생성해주세요!', 'warning');
        return;
      }
      
      navigator.clipboard.writeText(content).then(function() {
        showToast('전체 내용이 클립보드에 복사되었습니다!', 'success');
      });
    }

    // ============================================
    // [마우스 추적 효과] 카드에 3D 효과
    // ============================================
    document.querySelectorAll('.card-3d').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.querySelector('.card-3d-inner').style.transform = 
          \`rotateX(\${rotateX}deg) rotateY(\${rotateY}deg)\`;
      });
      
      card.addEventListener('mouseleave', () => {
        card.querySelector('.card-3d-inner').style.transform = 'rotateX(0) rotateY(0)';
      });
    });
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
  body { background: #0a0a0a; color: #fff; font-family: -apple-system, sans-serif; word-break: keep-all; }
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
          <p class="text-sm text-gray-500">XIVIX 2026 PRO 관리자 패널 | 타이포그래피 가이드 v2</p>
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
        <div class="text-3xl font-black text-orange-500">v2026.2</div>
        <div class="text-sm text-gray-400 mt-2">시스템 버전</div>
      </div>
    </div>

    <!-- 타이포그래피 가이드 -->
    <div class="card p-8">
      <h2 class="text-xl font-bold mb-6"><i class="fas fa-font mr-2 text-yellow-500"></i>타이포그래피 가이드</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-4 bg-black/30 rounded-lg">
          <div class="text-2xl mb-2">❶ ❷ ❸</div>
          <div class="text-sm text-gray-400">프로세스 / 단계별 설명</div>
        </div>
        <div class="p-4 bg-black/30 rounded-lg">
          <div class="text-2xl mb-2">■</div>
          <div class="text-sm text-gray-400">핵심 개념 / 강조 포인트</div>
        </div>
        <div class="p-4 bg-black/30 rounded-lg">
          <div class="text-2xl mb-2">✔️</div>
          <div class="text-sm text-gray-400">체크리스트 / 장점 나열</div>
        </div>
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
