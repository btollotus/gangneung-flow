'use server'

type ModerationVerdict = 'auto_approved' | 'flagged' | 'blocked'

export interface ModerationResult {
  status: ModerationVerdict
  reason: string
}

const CATEGORIES_PROMPT = `업로드된 사진이 아래 커뮤니티 가이드라인을 위반하는지 판단해줘.

금지 카테고리:
- nudity: 성관계, 성기, 완전히 노출된 둔부 확대, 여성 유두 노출 (단 모유수유/출산/건강목적/시위/예술작품은 예외로 허용)
- minors_at_risk: 아동의 나체·부분노출, 미성년자 성적 콘텐츠 (조금이라도 의심되면 true)
- violence: 잔인하거나 자극적인 상해·유혈 이미지
- hate: 혐오 상징, 특정 집단에 대한 폭력 조장 표현
- self_harm: 자해를 미화·조장하는 이미지
- unrelated_ad: 강릉 관광 체크인 인증사진과 무관한 광고성 이미지

아래 JSON 형식으로만 답해. 다른 텍스트나 마크다운은 절대 포함하지 마.
{"verdict":"safe|uncertain|violation","categories":{"nudity":bool,"minors_at_risk":bool,"violence":bool,"hate":bool,"self_harm":bool,"unrelated_ad":bool},"reason":"한글로 짧게"}`

export async function moderatePhoto(
  base64Image: string,
  mediaType: string
): Promise<ModerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.')
    return { status: 'flagged', reason: '자동 검수 설정 오류 - 수동 검수 필요' }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Image },
              },
              { type: 'text', text: CATEGORIES_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude 이미지 검수 API 오류:', response.status, errorText.slice(0, 300))
      return { status: 'flagged', reason: '자동 검수 API 오류 - 수동 검수 필요' }
    }

    const data = await response.json()
    const textBlock = (data.content as { type: string; text?: string }[] | undefined)?.find(
      (block) => block.type === 'text'
    )
    const rawText = textBlock?.text

    if (!rawText) {
      console.error('Claude 이미지 검수 응답에 텍스트 블록이 없음')
      return { status: 'flagged', reason: '자동 검수 응답 형식 오류 - 수동 검수 필요' }
    }

    let parsed: {
        verdict?: string
        categories?: Record<string, boolean>
        reason?: string
      }
      // Claude가 순수 JSON이 아니라 ```json ... ``` 코드블록으로 감싸서 응답하는 경우가 있어 먼저 벗겨낸다
      const cleanedText = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/, '')
        .trim()
      try {
        parsed = JSON.parse(cleanedText)
      } catch {
        console.error('Claude 이미지 검수 JSON 파싱 실패:', rawText.slice(0, 300))
        return { status: 'flagged', reason: '자동 검수 응답 파싱 실패 - 수동 검수 필요' }
      }

    if (parsed.categories?.minors_at_risk === true) {
      return { status: 'blocked', reason: '미성년자 관련 위험 콘텐츠 감지' }
    }

    if (parsed.verdict === 'violation') {
      return { status: 'blocked', reason: parsed.reason || '커뮤니티 가이드라인 위반' }
    }
    if (parsed.verdict === 'safe') {
      return { status: 'auto_approved', reason: parsed.reason || '자동 승인' }
    }

    return { status: 'flagged', reason: parsed.reason || '자동 판단 불확실 - 수동 검수 필요' }
  } catch (e) {
    console.error('Claude 이미지 검수 호출 오류:', e instanceof Error ? e.message : e)
    return { status: 'flagged', reason: '자동 검수 호출 실패 - 수동 검수 필요' }
  }
}