const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * 업로드된 이미지가 파티퀘스트 조건에 부합하는지 Claude Vision으로 판별
 * @param {string} imageUrl - Cloudinary 이미지 URL
 * @param {string} questContent - 퀘스트 내용 (예: "웃는 표정으로 셀카를 찍어라!")
 * @returns {Promise<{ approved: boolean, reason: string }>}
 */
async function validateImageForQuest(imageUrl, questContent) {
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl,
              },
            },
            {
              type: 'text',
              text: `파티 퀘스트 조건: "${questContent}"\n\n이 사진이 위 퀘스트 조건에 부합하나요? YES 또는 NO로만 답하세요.`,
            },
          ],
        },
      ],
    });

    const response = message.content[0].text.trim().toUpperCase();
    const approved = response.startsWith('YES');
    return { approved, reason: approved ? '인증 성공' : '퀘스트 조건에 맞지 않는 사진입니다.' };

  } catch (err) {
    console.error('❌ AI 이미지 판별 오류:', err.message);
    // API 오류 시 통과 처리 (서비스 중단 방지)
    return { approved: true, reason: 'AI 판별 오류로 자동 승인' };
  }
}

module.exports = { validateImageForQuest };
