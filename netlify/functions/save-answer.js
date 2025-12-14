exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const {
      GITHUB_TOKEN,
      GITHUB_USERNAME,
      REPO_NAME,
      GITHUB_BRANCH = "main",
      DID_API_KEY,
      KNOWLEDGE_ID,
      DID_DOCUMENT_ID,  // ← 새로 추가: D-ID 문서 ID
    } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_USERNAME || !REPO_NAME) {
      throw new Error("GitHub 환경변수가 누락되었습니다.");
    }

    const payload = JSON.parse(event.body || "{}");
    const { userName, sessionId, startedAt, endedAt, hwatu, word, dementia } = payload;

    if (!userName || !sessionId) {
      throw new Error("요청 데이터가 누락되었습니다. (userName/sessionId)");
    }

    /* ===============================
       새 세션 기록 생성 (간결한 형식)
    =============================== */
    const toKST = (iso) => {
      try {
        return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      } catch (e) {
        return String(iso || "");
      }
    };

    const hwatuPicked = (hwatu?.picked || []).map((c) => c.label || c.key || c.id).join(", ");
    const hwatuRecallPicked = (hwatu?.recallPicked || []).map((c) => c.label || c.key || c.id).join(", ");

    // 새 기록 블록
    const newRecord = [
      `========================================`,
      `[기록] ${userName} | ${toKST(startedAt)}`,
      `========================================`,
      `세션ID: ${sessionId}`,
      `종료: ${toKST(endedAt)}`,
      ``,
      `▶ 화투 기억훈련`,
      `  선택: ${hwatuPicked || "(없음)"}`,
      `  회상: ${hwatuRecallPicked || "(없음)"}`,
      `  결과: ${hwatu?.recallCorrect ?? 0}/${hwatu?.recallTotal ?? 3}`,
      ``,
      `▶ 낱말퀴즈: ${word?.score ?? 0}/${word?.total ?? 0}`,
      ...(word?.results || []).map((r, i) => 
        `  ${i + 1}. ${r.question} → ${r.userAnswer} (${r.isCorrect ? "O" : "X"})`
      ),
      ``,
      `▶ 치매예방퀴즈: ${dementia?.score ?? 0}/${dementia?.total ?? 0}`,
      ...(dementia?.results || []).map((r, i) => 
        `  ${i + 1}. ${r.question} → ${r.userAnswer} (${r.isCorrect ? "O" : "X"})`
      ),
      ``,
      ``
    ].join("\n");

    /* ===============================
       GitHub: 기존 파일 읽기 → 추가 → 업데이트
    =============================== */
    const fileName = "brain_activity_log.txt";
    const githubApiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${fileName}`;

    // 1) 기존 파일 가져오기
    const getResponse = await fetch(githubApiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
      },
    });

    let existingContent = "# 두뇌활동 기록\n\n";
    let sha = null;

    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
      existingContent = Buffer.from(fileData.content, "base64").toString("utf-8");
    }

    // 2) 새 기록 추가 (최신 기록이 위로)
    const updatedContent = existingContent.replace(
      "# 두뇌활동 기록\n\n",
      `# 두뇌활동 기록\n\n${newRecord}`
    );
    const updatedContentBase64 = Buffer.from(updatedContent, "utf-8").toString("base64");

    // 3) GitHub 업데이트
    const putBody = {
      message: `Update: ${userName} (${sessionId})`,
      content: updatedContentBase64,
      branch: GITHUB_BRANCH,
    };
    if (sha) putBody.sha = sha;  // 기존 파일이면 SHA 필수

    const putResponse = await fetch(githubApiUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(putBody),
    });

    if (!putResponse.ok) {
      const errText = await putResponse.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "GitHub 저장 실패", detail: errText }),
      };
    }

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPO_NAME}/${GITHUB_BRANCH}/${fileName}`;

    /* ===============================
       D-ID Knowledge: 삭제 → 재등록
    =============================== */
    if (DID_API_KEY && KNOWLEDGE_ID) {
      // 기존 문서 삭제 (DID_DOCUMENT_ID가 있을 때만)
      if (DID_DOCUMENT_ID) {
        await fetch(
          `https://api.d-id.com/knowledge/${KNOWLEDGE_ID}/documents/${DID_DOCUMENT_ID}`,
          {
            method: "DELETE",
            headers: { "Authorization": `Basic ${DID_API_KEY}` },
          }
        );
      }

      // 새 문서 등록
      const didResponse = await fetch(
        `https://api.d-id.com/knowledge/${KNOWLEDGE_ID}/documents`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${DID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documentType: "text",
            source_url: rawUrl,
            title: "두뇌활동_전체기록",
          }),
        }
      );

      if (!didResponse.ok) {
        const didErr = await didResponse.text();
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: "D-ID 등록 실패",
            detail: didErr,
            githubUrl: rawUrl,
          }),
        };
      }

      // 새로 생성된 문서 ID 반환 (필요시 저장)
      const didResult = await didResponse.json();
      console.log("New D-ID Document ID:", didResult.id);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "기록이 저장되었습니다.",
        githubUrl: rawUrl,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "서버 오류", detail: err.message }),
    };
  }
};