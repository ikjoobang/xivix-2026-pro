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
    version: '2026.3.0',
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
      version: '2026.3.0',
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
// 🖥️ 메인 UI - GPT 스타일 + 네이버 트렌드 검색창
// 깔끔하고 고급스러운 느낌 + 부드러운 애니메이션
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
  :root {
    --primary: #10B981;
    --primary-dark: #059669;
    --accent: #F59E0B;
    --bg-dark: #0a0a0a;
    --card-bg: rgba(18, 18, 18, 0.95);
    --border: rgba(255,255,255,0.08);
  }
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body { 
    background: var(--bg-dark);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', sans-serif;
    word-break: keep-all;
    min-height: 100vh;
  }

  /* 반응형 폰트 */
  @media (max-width: 768px) {
    body { font-size: 17px; line-height: 1.65; }
  }
  @media (min-width: 769px) {
    body { font-size: 16px; line-height: 1.55; }
  }

  /* 부드러운 그라디언트 배경 */
  .gradient-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    background: 
      radial-gradient(ellipse at 0% 0%, rgba(16, 185, 129, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at 100% 100%, rgba(245, 158, 11, 0.05) 0%, transparent 50%),
      var(--bg-dark);
  }

  /* 미세한 움직임 */
  .gradient-bg::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.03) 0%, transparent 50%);
    animation: pulse 8s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.1); opacity: 0.8; }
  }

  /* 컨테이너 */
  .container {
    max-width: 680px;
    margin: 0 auto;
    padding: 24px 20px;
  }

  /* 상단 배너 */
  .top-banner {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 16px;
    padding: 16px 20px;
    margin-bottom: 32px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .top-banner .icon {
    font-size: 20px;
  }

  .top-banner .text {
    font-size: 14px;
    color: rgba(255,255,255,0.9);
    line-height: 1.5;
  }

  .top-banner .highlight {
    color: #10B981;
    font-weight: 600;
  }

  /* 카드 */
  .card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 24px;
    padding: 32px;
    margin-bottom: 20px;
    backdrop-filter: blur(20px);
    transition: all 0.3s ease;
  }

  .card:hover {
    border-color: rgba(16, 185, 129, 0.2);
  }

  /* 스텝 헤더 */
  .step-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .step-number {
    width: 32px;
    height: 32px;
    background: var(--primary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    color: #000;
    flex-shrink: 0;
  }

  .step-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  /* 칩 버튼 */
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .chip {
    padding: 12px 20px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
  }

  .chip:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.2);
    color: #fff;
  }

  .chip.active {
    background: var(--primary);
    border-color: var(--primary);
    color: #000;
    font-weight: 600;
  }

  .chip.gold {
    border-color: rgba(245, 158, 11, 0.4);
    color: rgba(245, 158, 11, 0.9);
  }

  .chip.gold:hover {
    border-color: rgba(245, 158, 11, 0.6);
    background: rgba(245, 158, 11, 0.1);
  }

  .chip.gold.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }

  /* 셀렉트 */
  .custom-select {
    width: 100%;
    padding: 16px 20px;
    border-radius: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    font-size: 15px;
    cursor: pointer;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2310B981' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 16px center;
    transition: all 0.2s ease;
  }

  .custom-select:hover {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .custom-select:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  .custom-select option {
    background: #1a1a1a;
    color: #fff;
  }

  /* 텍스트에어리어 (네이버 트렌드 스타일) */
  .search-input {
    width: 100%;
    min-height: 120px;
    padding: 20px;
    border-radius: 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    color: #fff;
    font-size: 16px;
    line-height: 1.6;
    resize: none;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input::placeholder {
    color: rgba(255,255,255,0.35);
  }

  .search-input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }

  /* 중요 라벨 */
  .important-label {
    color: #EF4444;
    font-size: 13px;
    font-weight: 600;
  }

  /* 메인 버튼 */
  .main-btn {
    width: 100%;
    padding: 20px 32px;
    border: none;
    border-radius: 18px;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color: #000;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
  }

  .main-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(16, 185, 129, 0.4);
  }

  .main-btn:active {
    transform: translateY(0);
  }

  .main-btn .emoji {
    font-size: 20px;
  }

  /* 프로그레스 */
  .progress-section {
    margin-top: 32px;
  }

  .progress-bar {
    height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 12px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary), #34D399);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* 결과 영역 */
  .result-section {
    margin-top: 32px;
  }

  .result-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 28px;
    margin-bottom: 20px;
  }

  .result-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .result-title {
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .result-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }

  #content {
    line-height: 1.8;
    color: rgba(255,255,255,0.85);
  }

  #content br {
    display: block;
    margin: 6px 0;
  }

  /* 엑셀 시트 */
  .excel-sheet {
    background: #fff;
    color: #000;
    padding: 40px;
    border-radius: 8px;
    font-family: 'Malgun Gothic', sans-serif;
  }

  .excel-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    margin-top: 16px;
  }

  .excel-table th {
    background: #1a1a1a;
    color: #fff;
    border: 1px solid #333;
    padding: 12px;
    font-size: 13px;
    font-weight: 700;
  }

  .excel-table td {
    border: 1px solid #ddd;
    padding: 10px 14px;
    font-size: 13px;
  }

  /* 로딩 스피너 */
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(16, 185, 129, 0.2);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* 스크롤바 */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #0a0a0a; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #444; }

  /* 헤더 */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-icon {
    width: 44px;
    height: 44px;
    background: var(--primary);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 20px;
    color: #000;
  }

  .logo-text {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .logo-text span {
    color: var(--primary);
  }

  .nav-links {
    display: flex;
    gap: 8px;
  }

  .nav-link {
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.6);
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .nav-link:hover {
    background: rgba(255,255,255,0.05);
    color: #fff;
  }

  /* 모바일 */
  @media (max-width: 768px) {
    .container { padding: 16px; }
    .card { padding: 24px; border-radius: 20px; }
    .main-btn { padding: 18px 24px; font-size: 16px; }
    .header { flex-direction: column; gap: 16px; align-items: flex-start; }
  }
</style>
</head>
<body>
  <div class="gradient-bg"></div>

  <div class="container">
    <!-- 헤더 -->
    <header class="header">
      <div class="logo">
        <div class="logo-icon">X</div>
        <div class="logo-text">XIVIX <span>2026</span> PRO</div>
      </div>
      <nav class="nav-links">
        <a href="/admin" class="nav-link"><i class="fas fa-cog"></i> Admin</a>
        <a href="/api/docs" class="nav-link"><i class="fas fa-book"></i> Docs</a>
      </nav>
    </header>

    <!-- 타이포그래피 가이드 배너 -->
    <div class="top-banner">
      <span class="icon">💡</span>
      <div class="text">
        <strong>타이포그래피 가이드 적용:</strong> 모든 콘텐츠에<br>
        <span class="highlight">❶❷❸</span> (프로세스), <span class="highlight">■</span> (강조), <span class="highlight">✔️</span> (체크) 기호가 자동 적용됩니다.
      </div>
    </div>

    <!-- Step 1: 타겟 고객 선택 -->
    <div class="card">
      <div class="step-header">
        <div class="step-number">1</div>
        <div class="step-title">타겟 고객 선택</div>
      </div>
      <div class="chip-group" id="target-chips">
        <button class="chip active" onclick="selectChip(this, 'target')">30대 워킹맘</button>
        <button class="chip" onclick="selectChip(this, 'target')">40대 가장</button>
        <button class="chip" onclick="selectChip(this, 'target')">50대 은퇴예정자</button>
        <button class="chip" onclick="selectChip(this, 'target')">법인대표/CEO</button>
        <button class="chip" onclick="selectChip(this, 'target')">자영업자</button>
      </div>
    </div>

    <!-- Step 2: 보험 종류 선택 -->
    <div class="card">
      <div class="step-header">
        <div class="step-number">2</div>
        <div class="step-title">보험 종류 선택</div>
      </div>
      <div class="chip-group" id="type-chips">
        <button class="chip gold active" onclick="selectChip(this, 'insuranceType')">상속/증여</button>
        <button class="chip gold" onclick="selectChip(this, 'insuranceType')">CEO/법인</button>
        <button class="chip gold" onclick="selectChip(this, 'insuranceType')">치매/간병</button>
        <button class="chip" onclick="selectChip(this, 'insuranceType')">유병자보험</button>
        <button class="chip" onclick="selectChip(this, 'insuranceType')">종신보험</button>
      </div>
    </div>

    <!-- Step 3: 보험사 선택 -->
    <div class="card">
      <div class="step-header">
        <div class="step-number">3</div>
        <div class="step-title">보험사 선택</div>
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

    <!-- Step 4: 제안서 스타일 -->
    <div class="card">
      <div class="step-header">
        <div class="step-number">4</div>
        <div class="step-title">제안서 스타일</div>
      </div>
      <select id="style" class="custom-select">
        <option>전문가 팩트체크형</option>
        <option>감성 공감 위로형</option>
        <option>세무 절세 분석형</option>
      </select>
    </div>

    <!-- Step 5: 핵심 고민 (가장 중요!) -->
    <div class="card">
      <div class="step-header">
        <div class="step-number">5</div>
        <div class="step-title">핵심 고민 (ANGLE) - <span class="important-label">가장 중요!</span></div>
      </div>
      <textarea id="concern" class="search-input" placeholder="예: 워킹맘인데 아이 교육자금으로 증여하려면 세금이 얼마나 나올까요?"></textarea>
    </div>

    <!-- 생성 버튼 -->
    <button onclick="generateContent()" id="generateBtn" class="main-btn">
      <span class="emoji">💎</span>
      <span class="emoji">🚀</span>
      데이터 대입 및 전문가 콘텐츠 생성
    </button>

    <!-- 프로그레스 -->
    <div id="progress-section" class="progress-section hidden">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span id="progress-text" style="font-size: 14px; color: var(--primary);">분석 중...</span>
        <span id="progress-percent" style="font-size: 14px; font-weight: 600; color: var(--primary);">0%</span>
      </div>
      <div class="progress-bar">
        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
      </div>
    </div>

    <!-- 결과 섹션 -->
    <div id="result-section" class="result-section hidden">
      <!-- 콘텐츠 결과 -->
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">
            <i class="fas fa-file-alt" style="color: var(--primary)"></i>
            Generated Content
          </div>
          <div class="result-actions">
            <button onclick="downloadTxt()" class="action-btn"><i class="fas fa-download"></i> TXT</button>
            <button onclick="downloadPdf()" class="action-btn"><i class="fas fa-file-pdf"></i> PDF</button>
            <button onclick="copyAll()" class="action-btn"><i class="fas fa-copy"></i> 복사</button>
          </div>
        </div>
        <div id="content"></div>
      </div>

      <!-- 엑셀 설계서 -->
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">
            <i class="fas fa-table" style="color: var(--accent)"></i>
            Monochrome Excel Policy
          </div>
          <button onclick="generateExcel()" class="action-btn" style="background: var(--primary); color: #000; border-color: var(--primary);">
            <i class="fas fa-sync"></i> 설계서 생성
          </button>
        </div>
        <div id="excel-area" style="display: flex; justify-content: center; align-items: center; min-height: 200px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
          <div style="text-align: center; color: rgba(255,255,255,0.4);">
            <i class="fas fa-file-excel" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
            <p>설계서 생성 버튼을 클릭하세요</p>
          </div>
        </div>
      </div>
    </div>
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

    // 토스트 알림
    function showToast(message, type = 'info') {
      const colors = {
        success: 'linear-gradient(135deg, #10B981, #059669)',
        error: 'linear-gradient(135deg, #EF4444, #DC2626)',
        warning: 'linear-gradient(135deg, #F59E0B, #D97706)',
        info: 'linear-gradient(135deg, #3B82F6, #2563EB)'
      };
      
      const toast = document.createElement('div');
      toast.style.cssText = \`
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 14px 24px;
        background: \${colors[type]};
        color: #fff;
        border-radius: 12px;
        font-weight: 600;
        font-size: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 9999;
        transform: translateY(100px);
        opacity: 0;
        transition: all 0.3s ease;
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
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // 콘텐츠 생성
    async function generateContent() {
      const concern = document.getElementById('concern').value;
      if (!concern.trim()) {
        showToast('핵심 고민(Angle)을 입력해주세요!', 'warning');
        document.getElementById('concern').focus();
        return;
      }

      state.concern = concern;
      state.company = document.getElementById('company').value;
      state.style = document.getElementById('style').value;

      document.getElementById('progress-section').classList.remove('hidden');
      document.getElementById('result-section').classList.remove('hidden');
      document.getElementById('content').innerHTML = '';
      
      const progressFill = document.getElementById('progress-fill');
      const progressText = document.getElementById('progress-text');
      const progressPercent = document.getElementById('progress-percent');
      
      progressFill.style.width = '10%';
      progressPercent.innerText = '10%';
      progressText.innerText = '🔍 타겟 페르소나 분석 중...';

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
                content.innerHTML = '<span style="color: #EF4444;">' + json.msg + '</span>';
                showToast(json.msg, 'error');
              }
            } catch (e) {}
          }
        }
      } catch (error) {
        document.getElementById('content').innerHTML = '<span style="color: #EF4444;">네트워크 오류가 발생했습니다.</span>';
        showToast('네트워크 오류가 발생했습니다.', 'error');
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
          html += '<div style="font-size: 22px; font-weight: 900; border-bottom: 3px solid #000; padding-bottom: 12px; margin-bottom: 16px;">' + (d.product || '보험설계서') + '</div>';
          html += '<div style="font-size: 13px; margin-bottom: 16px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">';
          html += '<span><b>피보험자:</b> ' + d.target + ' (' + d.gender + '/' + d.age + ')</span>';
          html += '<span><b>보험사:</b> ' + (d.company || state.company) + '</span>';
          html += '</div>';
          html += '<table class="excel-table"><tr><th>보장 항목</th><th style="width: 120px;">가입금액</th><th style="width: 100px;">보험료</th></tr>';
          
          if (d.items && Array.isArray(d.items)) {
            d.items.forEach(item => {
              html += '<tr><td>' + item.name + '</td><td style="text-align: right; font-weight: bold;">' + item.amount + '</td><td style="text-align: right;">' + item.premium + '</td></tr>';
            });
          }
          
          html += '</table>';
          html += '<div style="text-align: right; font-size: 18px; font-weight: 900; margin-top: 20px; border-top: 2px solid #000; padding-top: 12px;">월 합계: ' + (d.total || '-') + '</div>';
          html += '</div>';
          
          area.innerHTML = html;
          showToast('설계서가 생성되었습니다!', 'success');
        } else {
          area.innerHTML = '<span style="color: #EF4444;">설계서 생성에 실패했습니다.</span>';
          showToast('설계서 생성에 실패했습니다.', 'error');
        }
      } catch (error) {
        area.innerHTML = '<span style="color: #EF4444;">네트워크 오류가 발생했습니다.</span>';
        showToast('네트워크 오류가 발생했습니다.', 'error');
      }
    }

    // 다운로드 기능
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
            h1 { color: #10B981; border-bottom: 3px solid #10B981; padding-bottom: 10px; }
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
      
      navigator.clipboard.writeText(content).then(() => {
        showToast('전체 내용이 복사되었습니다!', 'success');
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
  .card { background: rgba(18,18,18,0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
  .stat-card { transition: all 0.3s ease; }
  .stat-card:hover { transform: translateY(-4px); border-color: #10B981; }
</style>
</head>
<body class="p-6">
  <div class="max-w-5xl mx-auto space-y-6">
    <header class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center font-black">X</div>
        <div>
          <h1 class="text-xl font-black">Admin Dashboard</h1>
          <p class="text-xs text-gray-500">XIVIX 2026 PRO</p>
        </div>
      </div>
      <a href="/" class="px-3 py-2 bg-gray-800 rounded-lg text-sm hover:bg-gray-700 transition">
        <i class="fas fa-arrow-left mr-2"></i>메인
      </a>
    </header>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card stat-card p-5">
        <div class="text-2xl font-black text-green-500" id="totalKeys">-</div>
        <div class="text-xs text-gray-400 mt-1">API 키</div>
      </div>
      <div class="card stat-card p-5">
        <div class="text-2xl font-black text-blue-500" id="expertEngine">-</div>
        <div class="text-xs text-gray-400 mt-1">전문가 엔진</div>
      </div>
      <div class="card stat-card p-5">
        <div class="text-2xl font-black text-purple-500" id="dataEngine">-</div>
        <div class="text-xs text-gray-400 mt-1">데이터 엔진</div>
      </div>
      <div class="card stat-card p-5">
        <div class="text-2xl font-black text-orange-500">v2026.3</div>
        <div class="text-xs text-gray-400 mt-1">버전</div>
      </div>
    </div>

    <div class="card p-6">
      <h2 class="font-bold mb-4"><i class="fas fa-link mr-2 text-green-500"></i>빠른 링크</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="/" class="p-3 bg-green-600/10 border border-green-600/20 rounded-xl text-center hover:bg-green-600/20 transition">
          <i class="fas fa-home text-green-500 mb-1"></i>
          <div class="text-xs">메인</div>
        </a>
        <a href="/api/docs" class="p-3 bg-blue-600/10 border border-blue-600/20 rounded-xl text-center hover:bg-blue-600/20 transition">
          <i class="fas fa-book text-blue-500 mb-1"></i>
          <div class="text-xs">API 문서</div>
        </a>
        <a href="/api/health" class="p-3 bg-purple-600/10 border border-purple-600/20 rounded-xl text-center hover:bg-purple-600/20 transition">
          <i class="fas fa-heartbeat text-purple-500 mb-1"></i>
          <div class="text-xs">Health</div>
        </a>
        <a href="/api/admin/stats" class="p-3 bg-orange-600/10 border border-orange-600/20 rounded-xl text-center hover:bg-orange-600/20 transition">
          <i class="fas fa-chart-bar text-orange-500 mb-1"></i>
          <div class="text-xs">Stats</div>
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
      });
  </script>
</body>
</html>
`

app.get('/', (c) => c.html(mainPageHtml))
app.get('/admin', (c) => c.html(adminPageHtml))

export default app
