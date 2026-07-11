const NICKNAME_WORDS = [
    'Pine', 'Wave', 'Star', 'Moon', 'Sky', 'Wind', 'Rain', 'Mint', 'Silk', 'Camp',
    'River', 'Stone', 'Ocean', 'Valley', 'Sand', 'Sunny', 'Green', 'Happy', 'Smile', 'Dream',
    'Rock', 'Baby', 'Cat', 'Lake', 'Hill', 'Tree', 'Bird', 'Fish', 'Bear', 'Deer',
    'Seed', 'Cloud', 'Beach', 'Boy', 'Girl', 'Pink', 'Blue', 'Yellow', 'Black', 'White',
  ]
  
  /**
   * userId를 결정적으로 해시해 단어 하나를 고른다.
   * 같은 userId는 언제 호출해도 항상 같은 단어를 반환한다
   * (마이페이지/랭킹 등 여러 화면에서 폴백 닉네임이 서로 달라지는 것 방지).
   */
  function hashUserId(userId: string): number {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
    }
    return hash
  }
  
  /**
   * profiles row가 없는 사용자에게 보여줄 기본 닉네임을 생성한다.
   * 예: "Ocean991e"
   */
  export function generateFallbackNickname(userId: string): string {
    const word = NICKNAME_WORDS[hashUserId(userId) % NICKNAME_WORDS.length]
    const suffix = userId.slice(-4)
    return `${word}${suffix}`
  }