exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    /* ===============================
       환경변수
    =============================== */
    const {
      GITHUB_TOKEN,
      GITHUB_USERNAME,
      REPO_NAME,
      GITHUB_BRANCH = 'main',
      DID_API_KEY,
      KNOWLEDGE_ID
    } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !REPO_NAME) {
      throw new Error('GitHub 환경변수가 누락되었습니다.');
    }

    /* ===============================
       요청 데이터
    =============================== */
    const { userName, score, total, results, timestamp } =
      JSON.parse(event.body);

    /* ===============================
       파일 내용 (한글 OK)
    =============================== */
    const resultDetails = results.map((r, i) =>
      `문제 ${i + 1}
질문: ${r.question}
선택: ${r.userAnswer}
정답: ${r.correctAnswer}
결과: ${r.isCorrect ? '정답' : '오답'}`
    ).join('\n\n');

    const fileContent = `
치매예방 퀴즈 결과
========================
이름: ${userName}
점수: ${score} / ${total}
정답률: ${Math.round((score / total) * 100)}%
응답 시간: ${new Date(timestamp).toLocaleString('ko-KR')}

상세 결과
------------------------
${resultDetails}
`.trim();

    /* ===============================
       파일명 (ASCII만 사용)
    =============================== */
    const fileName = `quiz_${Date.now()}.txt`;
    const fileContentBase64 =
      Buffer.from(fileContent, 'utf-8').toString('base64');

    /* ===============================
       GitHub 파일 생성
    =============================== */
    const githubApiUrl =
      `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${fileName}`;

    const githubResponse = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add quiz result (${userName})`,
        content: fileContentBase64,
        branch: GITHUB_BRANCH
      })
    });

    const githubText = await githubResponse.text();
    console.log('GitHub status:', githubResponse.status);
    console.log('GitHub response:', githubText);

    if (!githubResponse.ok) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'GitHub 저장 실패',
          detail: githubText
        })
      };
    }

    /* ===============================
       Raw URL (D-ID용)
    =============================== */
    const rawUrl =
      `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${GITHUB_BRANCH}/${fileName}`;

    /* ===============================
       D-ID Knowledge 등록 (선택)
       → 환경변수 있으면 실행
    =============================== */
    if (DID_API_KEY && KNOWLEDGE_ID) {
      const didResponse = await fetch(
        `https://api.d-id.com/knowledge/${KNOWLEDGE_ID}/documents`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${DID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentType: 'text',
            source_url: rawUrl,
            title: `${userName}_치매예방퀴즈결과`
          })
        }
      );

      const didText = await didResponse.text();
      console.log('D-ID status:', didResponse.status);
      console.log('D-ID response:', didText);

      if (!didResponse.ok) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'D-ID Knowledge 등록 실패',
            detail: didText,
            githubUrl: rawUrl
          })
        };
      }
    }

    /* ===============================
       성공 응답
    =============================== */
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: '퀴즈 결과가 GitHub에 저장되었습니다.',
        githubUrl: rawUrl
      })
    };

  } catch (err) {
    console.error('Function error:', err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: '서버 처리 중 오류 발생',
        detail: err.message
      })
    };
  }
};
