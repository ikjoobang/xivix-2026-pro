import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'

type Bindings = {
  GEMINI_API_KEY_1?: string;
  GEMINI_API_KEY_2?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
}

const app = new Hono<{ Bindings: Bindings }>()
app.use('/*', cors())

// ⚡ 2026 최신 AI 엔진 설정
const SMART_ENGINE = 'gemini-1.5-pro-latest' // 고지능 전문가 상담 (텍스트)
const FAST_ENGINE = 'gemini-2.0-flash'       // 초고속 데이터/이미지 엔진

// 1. [데이터 정합성] 성별/나이 정밀 판별기 (워킹맘 오류 완벽 차단)
function analyzePersona(target: string, concern: string) {
  let gender = '여성'
  const maleKeywords = ['가장', '아빠', '남편', '남성', '아들', '형', '오빠']
  if (maleKeywords.some(k => target.includes(k) || concern.includes(k))) gender = '남성'
  
  const ageMatch = target.match(/(\d+)대/) || concern.match(/(\d+)대/)
  const age = ageMatch ? ageMatch[1] + '세' : '35세'
  return { gender, age, target }
}

// 2. [초 정밀 프롬프트] 상위 1% 보험 수석 컨설턴트 지식 내장
function getMasterPrompt(type: string, concern: string, target: string) {
  const p = analyzePersona(target, concern)
  return `당신은 2026년 대한민국 상위 1% 보험 수석 컨설턴트(XIVIX PRO)입니다. 
  입력된 질문사항 "${concern}"을 분석하여 중복 없는 독창적인 네이버 카페 최적화 콘텐츠를 생성하세요.

  [페르소나 매칭 - 절대 준수]
  - 연령/성별: ${p.age} / ${p.gender}
  - 질문자: 반드시 ${p.gender}의 화법을 사용. (워킹맘이면 여성 말투 필수)

  [알고리즘 대응 전략]
  - C-Rank: 상증법 제8조, CDR 척도, 손비처리 등 전문 지식을 자연스럽게 배치.
  - DIA/Agent N: '정보의 이득'을 극대화한 구체적인 수치와 해결책 제시.

  [분야별 전용 로직]
  - 상속/증여: 상속세 납부 재원 현금화 및 10년 주기 증여 비과세 전략.
  - CEO/법인: 법인세 절세 및 대표이사 퇴직금 재원 마련 플랜.
  - 치매/간병: CDR 단계별 보장 및 물가상승 방어형 체증형 일당 설계.

  [작성 지침]
  1. 타입: '보험초보' 눈높이 비유 사용. (보험은 세금으로부터 자산을 지키는 방패입니다)
  2. 금지: "엄마 친구", "지인" 언급 금지. (현대적 정보 습득 경로 활용)
  3. 포맷: 마크다운 표(|) 금지. 가독성을 위해 <br> 태그로 줄바꿈 처리.
  4. 중복 방지: 고정 템플릿 사용 금지. 입력된 단어를 분석해 수만 가지 상황 중 하나를 새롭게 창조.

  [출력 구조]
  [제목1][제목2][질문1][질문2][질문3][답변1][답변2][답변3][댓글1]...[댓글5][키워드5개]`
}

// 📝 Q&A 마스터 스트리밍 API (체감 속도 5초)
app.post('/api/generate/full', async (c) => {
  const { target, insuranceType, concern } = await c.req.json()
  const apiKey = c.env.GEMINI_API_KEY_1

  return streamText(c, async (stream) => {
    await stream.write(JSON.stringify({ type: 'status', step: 1, msg: '🔍 1단계: 타겟 및 고민의 Angle 정밀 분석 중...' }) + '\n')
    await stream.write(JSON.stringify({ type: 'status', step: 2, msg: '⚖️ 2단계: 최신 법리 및 약관 최적화 로직 가동...' }) + '\n')

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${SMART_ENGINE}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: getMasterPrompt(insuranceType, concern, target) }] }] })
    })

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
              const clean = text.replace(/\\n/g, '<br>').replace(/Analysis|Comparison|Evidence|Step \d+:/gi, '')
              await stream.write(JSON.stringify({ type: 'content', data: clean }) + '\n')
            }
          } catch(e) {
            // JSON 파싱 오류 무시
          }
        }
      }
    }
    await stream.write(JSON.stringify({ type: 'done' }) + '\n')
  })
})

// 📊 흑백 엑셀 설계서 API (컬러 완전 제거 + 랜덤화)
app.post('/api/generate/excel-data', async (c) => {
  const { insuranceType, target, concern } = await c.req.json()
  const p = analyzePersona(target, concern)
  const apiKey = c.env.GEMINI_API_KEY_1

  const prompt = `${insuranceType} (${p.gender}/${p.age}) 설계 데이터 생성. 
  - 흑백 엑셀 인쇄물용 데이터 (컬러 코드 배제).
  - 15개 이상의 리얼한 담보 구성 및 타겟 성별 강제 일치.
  - 출력 JSON: { "product": "상품명", "company": "랜덤보험사", "items": [{"name":"담보", "amount":"금액", "premium":"보험료"}], "total": "합계" }`
  
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FAST_ENGINE}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  })
  const json = await res.json() as any
  
  try {
    const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const jsonMatch = textContent.match(/\{[\s\S]*\}/)
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    return c.json({ success: true, data: { ...data, ...p } })
  } catch(e) {
    return c.json({ success: false, error: 'JSON 파싱 실패' })
  }
})

// 🖥️ 프리미엄 UI (V29 감성 + 모바일 복붙 최적화)
const mainPageHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>XIVIX 2026 | 보험 마케팅 마스터</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
<style>
  body { background: #000; color: #fff; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; letter-spacing: -0.5px; }
  .glass { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 24px; }
  .angle-box { background: #111; border: 2px solid #333; transition: 0.3s; }
  .angle-box:focus-within { border-color: #03C75A; box-shadow: 0 0 20px rgba(3,199,90,0.1); }
  .chip { background: #1a1a1a; border: 1px solid #333; padding: 12px 20px; border-radius: 14px; font-size: 14px; color: #888; cursor: pointer; transition: all 0.2s; }
  .chip:hover { border-color: #555; color: #aaa; }
  .chip.active { background: rgba(3, 199, 90, 0.2); border-color: #03C75A; color: #03C75A; font-weight: 800; }
  .chip-gold { border-color: #d97706; color: #fbbf24; }
  .chip-gold:hover { border-color: #f59e0b; }
  .excel-card { background: white; color: black; padding: 40px; border: 2px solid #000; font-family: 'Malgun Gothic', -apple-system, sans-serif; width: 100%; max-width: 650px; box-shadow: 15px 15px 40px rgba(0,0,0,0.6); transform: rotate(-0.2deg); }
  .excel-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 20px; }
  .excel-table th { background: #eee; border: 1px solid #000; padding: 10px; font-size: 13px; }
  .excel-table td { border: 1px solid #000; padding: 8px 12px; font-size: 13px; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
</style>
</head>
<body class="p-4 md:p-12">
<div class="max-w-7xl mx-auto space-y-10">
  <div class="flex items-center gap-4">
    <div class="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-green-900/20">X</div>
    <h1 class="text-3xl font-black italic tracking-tighter">XIVIX <span class="text-green-500">2026 PRO</span></h1>
  </div>

  <div class="glass p-10 space-y-8">
    <div class="angle-box rounded-3xl p-2 flex items-center">
      <div class="px-5 text-gray-500"><i class="fas fa-search"></i></div>
      <textarea id="concern" class="flex-1 bg-transparent border-none outline-none py-4 text-lg h-24 resize-none" placeholder="고객의 핵심 고민(Angle)을 입력하세요. (워킹맘 증여, CEO 절세 등)"></textarea>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <label class="text-sm font-bold text-blue-400 mb-4 block"><i class="fas fa-coins mr-2"></i>고부가가치 분야</label>
        <div class="flex flex-wrap gap-2" id="type-chips">
          <button class="chip active" onclick="sel(this, 'type')">상속/증여</button>
          <button class="chip chip-gold" onclick="sel(this, 'type')">CEO/법인</button>
          <button class="chip chip-gold" onclick="sel(this, 'type')">치매/간병</button>
          <button class="chip" onclick="sel(this, 'type')">유병자보험</button>
        </div>
      </div>
      <div>
        <label class="text-sm font-bold text-gray-400 mb-4 block"><i class="fas fa-user-circle mr-2"></i>타겟 고객</label>
        <div class="flex flex-wrap gap-2" id="target-chips">
          <button class="chip active" onclick="sel(this, 'target')">30대 워킹맘</button>
          <button class="chip" onclick="sel(this, 'target')">40대 가장</button>
          <button class="chip" onclick="sel(this, 'target')">법인대표</button>
        </div>
      </div>
    </div>

    <button onclick="run()" id="btn" class="w-full bg-green-600 hover:bg-green-500 py-6 rounded-3xl font-black text-2xl shadow-2xl transition active:scale-95">🚀 상위 노출 1위 콘텐츠 생성 시작</button>
  </div>

  <div class="space-y-6">
    <div id="gauge-container" class="hidden glass bg-green-950/20 p-6">
      <div class="flex justify-between mb-3 text-xs font-black text-green-400 tracking-widest">
        <span id="gauge-text">분석 중...</span>
        <span id="gauge-percent">0%</span>
      </div>
      <div class="w-full bg-gray-900 h-3 rounded-full overflow-hidden">
        <div id="gauge-bar" class="bg-green-500 h-full transition-all duration-700" style="width: 0%"></div>
      </div>
    </div>
    
    <div id="res-body" class="hidden glass p-10 min-h-[800px] border-l-8 border-green-600">
      <div class="flex justify-between mb-8 border-b border-white/5 pb-5">
        <span class="text-sm font-bold text-gray-500 tracking-tighter uppercase">XIVIX Expert Content Bundle</span>
        <button onclick="copyAll()" class="text-xs bg-white/10 px-4 py-2 rounded-xl hover:bg-white/20 transition">전체 복사</button>
      </div>
      <div id="content" class="text-gray-200 text-lg whitespace-pre-wrap leading-loose"></div>
    </div>

    <div class="glass p-10 flex flex-col items-center">
      <div class="w-full flex justify-between items-center mb-10">
        <span class="text-xl font-black text-gray-400 tracking-tighter uppercase">Virtual Monochrome Policy</span>
        <button onclick="makeImg()" class="bg-blue-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-blue-500 transition">설계서 생성</button>
      </div>
      <div id="img-area" class="w-full flex justify-center bg-black/50 p-10 rounded-3xl border border-dashed border-gray-800"></div>
    </div>
  </div>
</div>

<script>
  let state = { type: '상속/증여', target: '30대 워킹맘' };
  
  function sel(el, k) {
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    state[k] = el.innerText;
  }

  async function run() {
    const bar = document.getElementById('gauge-bar');
    const percent = document.getElementById('gauge-percent');
    const content = document.getElementById('content');
    document.getElementById('gauge-container').classList.remove('hidden');
    document.getElementById('res-body').classList.remove('hidden');
    content.innerHTML = ''; 
    bar.style.width = '15%'; 
    percent.innerText = '15%';

    const res = await fetch('/api/generate/full', {
      method: 'POST', 
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 
        insuranceType: state.type, 
        target: state.target, 
        concern: document.getElementById('concern').value 
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.type === 'status') {
            document.getElementById('gauge-text').innerText = json.msg;
            const newPercent = (json.step * 40);
            bar.style.width = newPercent + '%';
            percent.innerText = newPercent + '%';
          } else if (json.type === 'content') {
            content.innerHTML += json.data;
            bar.style.width = '95%';
            percent.innerText = '95%';
          } else if (json.type === 'done') {
            bar.style.width = '100%';
            percent.innerText = '100%';
            document.getElementById('gauge-text').innerText = '✅ 알고리즘 분석 완료!';
          }
        } catch(e) {}
      }
    }
  }

  async function makeImg() {
    const area = document.getElementById('img-area');
    area.innerHTML = '<span class="animate-pulse text-blue-400 font-bold uppercase tracking-widest">Excel Data Processing...</span>';
    
    const res = await fetch('/api/generate/excel-data', {
      method: 'POST', 
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ 
        insuranceType: state.type, 
        target: state.target, 
        concern: document.getElementById('concern').value 
      })
    });
    
    const json = await res.json();
    
    if(json.success && json.data) {
      const d = json.data;
      let h = '<div class="excel-card">';
      h += '<div style="font-size:30px; font-weight:900; border-bottom:4px solid #000; padding-bottom:12px; margin-bottom:25px; text-transform:uppercase; letter-spacing:-1px;">' + (d.product || '보험설계서') + '</div>';
      h += '<div style="font-size:15px; margin-bottom:25px; display:flex; justify-content:space-between; border-bottom:1px solid #eee; padding-bottom:10px;">';
      h += '<span><b>피보험자:</b> ' + d.target + ' (' + d.gender + '/' + d.age + ')</span>';
      h += '<span><b>문서코드:</b> ' + Math.random().toString(36).substr(2, 9).toUpperCase() + '</span>';
      h += '</div>';
      h += '<table class="excel-table"><tr><th>보장 항목 명칭</th><th style="width:120px;">가입금액</th><th style="width:100px;">보험료</th></tr>';
      
      if(d.items && Array.isArray(d.items)) {
        d.items.forEach(function(i) {
          h += '<tr><td>' + i.name + '</td><td style="text-align:right; font-weight:bold;">' + i.amount + '</td><td style="text-align:right;">' + i.premium + '</td></tr>';
        });
      }
      
      h += '</table>';
      h += '<div style="text-align:right; font-size:28px; font-weight:900; margin-top:35px; border-top:3px solid #000; padding-top:20px; color:#000;">합계 보험료: ' + (d.total || '-') + '</div>';
      h += '<div style="margin-top:45px; font-size:11px; color:#666; text-align:center; border:1px solid #ddd; padding:15px; background:#f9f9f9;">※ 본 제안서는 가상의 설계 예시이며, 실제 가입 시 보험사 공식 설계서를 반드시 확인하시기 바랍니다.</div>';
      h += '</div>';
      
      area.innerHTML = h;
    } else {
      area.innerHTML = '<span class="text-red-400 font-bold">데이터 생성 실패. API 키를 확인해주세요.</span>';
    }
  }

  function copyAll() {
    const text = document.getElementById('content').innerText;
    navigator.clipboard.writeText(text).then(function() {
      alert('전체 내용이 클립보드에 복사되었습니다.');
    });
  }
</script>
</body>
</html>
`

app.get('/', (c) => c.html(mainPageHtml))

export default app
