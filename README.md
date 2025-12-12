# 치매예방 두뇌 게임 🧠

D-ID 아바타가 함께하는 치매예방 퀴즈 시스템입니다.
사용자가 퀴즈를 풀면 결과가 GitHub에 저장되고, D-ID Knowledge Base에 등록되어 아바타가 학습합니다.

## 📁 파일 구조

```
dementia-prevention-quiz/
├── index.html              # 퀴즈 화면 + D-ID 아바타
├── netlify.toml            # Netlify 설정
├── package.json            # 의존성
├── README.md               # 이 파일
└── netlify/
    └── functions/
        └── save-answer.js  # 답변 저장 서버리스 함수
```

## 🚀 배포 방법

### 1단계: GitHub 저장소 생성

1. GitHub에서 새 저장소 생성: `dementia-prevention-quiz`
2. 모든 파일 업로드

### 2단계: 지식 저장용 저장소 생성

1. GitHub에서 새 저장소 생성: `dementia-quiz-knowledge`
2. README.md만 있는 빈 저장소로 생성
3. **반드시 Public으로 설정** (D-ID가 읽을 수 있어야 함)

### 3단계: Netlify 연결

1. [netlify.com](https://netlify.com) 접속 및 로그인
2. "Add new site" → "Import an existing project"
3. GitHub 연결 → `dementia-prevention-quiz` 저장소 선택
4. Deploy settings:
   - Build command: (비워두기)
   - Publish directory: `.`
5. "Deploy site" 클릭

### 4단계: 환경변수 설정 ⚠️ 중요!

Netlify 대시보드 → Site settings → Environment variables

| 변수명 | 값 | 설명 |
|--------|-----|------|
| `DID_API_KEY` | (D-ID API 키) | D-ID Studio에서 발급 |
| `KNOWLEDGE_ID` | (Knowledge Base ID) | D-ID Agent의 Knowledge ID |
| `GITHUB_TOKEN` | (GitHub PAT) | repo 권한 필요 |
| `GITHUB_USERNAME` | sdkparkforbi | GitHub 사용자명 |
| `REPO_NAME` | dementia-quiz-knowledge | 지식 저장 저장소명 |

### 5단계: D-ID Knowledge ID 확인 방법

D-ID Studio에서:
1. Agents → 해당 Agent 선택
2. Knowledge 탭에서 Knowledge Base ID 확인

또는 API로 확인:
```bash
curl -X GET "https://api.d-id.com/agents/v2_agt_adow2aMU" \
  -H "Authorization: Basic YOUR_API_KEY"
```

### 6단계: 재배포

환경변수 설정 후 Netlify에서 "Trigger deploy" 클릭

---

## 🔧 GitHub Token 생성 방법

1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. 권한: `repo` 체크
5. Generate token → 복사하여 Netlify 환경변수에 저장

---

## 🎯 작동 원리

```
사용자가 퀴즈 풀기
      ↓
Netlify Function 호출
      ↓
GitHub에 결과 파일 저장 (quiz_홍길동_1702345678.txt)
      ↓
D-ID Knowledge Base에 문서 URL 등록
      ↓
아바타가 사용자 기록 학습
      ↓
"홍길동님의 점수는?" 질문에 답변 가능!
```

---

## 🤖 아바타에게 물어볼 수 있는 질문

퀴즈를 푼 후 아바타에게:
- "방금 내 점수가 어떻게 됐어?"
- "어떤 문제를 틀렸어?"
- "치매예방에 대해 더 알려줘"

---

## 📊 저장되는 데이터 예시

```
치매예방 퀴즈 결과 기록
========================
이름: 홍길동
점수: 4/5점
정답률: 80%
일시: 2024/12/12 오후 3:30:00

상세 결과:
문제1: 다음 중 치매 예방에 가장 효과적인 활동은?
선택: 규칙적인 운동과 두뇌 활동
정답: 규칙적인 운동과 두뇌 활동
결과: 정답

...

분석:
홍길동님은 치매예방 지식이 양호합니다.
```

---

## 🔐 보안

- API 키는 Netlify 환경변수에만 저장 (코드에 노출 안됨)
- 서버리스 함수에서만 API 호출
- HTTPS 자동 적용

---

## 💡 커스터마이징

### 퀴즈 문제 변경
`index.html`의 `quizData` 배열 수정

### 아바타 변경
`index.html`의 D-ID 스크립트에서:
- `data-agent-id`: 다른 Agent ID로 변경
- `data-client-key`: 해당 Agent의 Client Key로 변경

---

## 📞 문의

- D-ID 문서: https://docs.d-id.com
- Netlify 문서: https://docs.netlify.com
