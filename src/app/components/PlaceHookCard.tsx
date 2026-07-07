const HOOKS: { name: string; hook: string }[] = [
    { name: '경포해변', hook: '낮보다 밤이 더 아름다운 강릉 대표 해변' },
    { name: '경포대', hook: '천년의 풍경이 기다리는 강릉 최고의 전망' },
    { name: '안목해변 커피거리', hook: '바다를 마시는 특별한 커피 한 잔' },
    { name: '오죽헌', hook: '신사임당과 율곡이 숨 쉬던 집' },
    { name: '강릉중앙시장', hook: '강릉 먹거리의 모든 것이 모인 곳' },
    { name: '주문진수산시장', hook: '갓 잡은 바다의 맛을 만나는 시장' },
    { name: '선교장', hook: '300년 양반가의 시간을 걷다' },
    { name: '강릉대도호부관아', hook: '조선시대 강릉으로 떠나는 시간여행' },
    { name: '하슬라아트월드', hook: '바다와 예술이 만나는 감성 여행지' },
    { name: '모래시계공원', hook: '드라마보다 더 유명한 그 장소' },
    { name: '강릉월화거리', hook: '걷기만 해도 추억이 쌓이는 거리' },
    { name: '월화거리야시장', hook: '밤이 되면 더 맛있는 강릉 야시장' },
    { name: '송정해수욕장', hook: '현지인이 아끼는 조용한 바다' },
    { name: '풍호마을', hook: '시간이 천천히 흐르는 작은 어촌' },
    { name: '사천해변', hook: '에메랄드빛 바다가 숨겨둔 명소' },
    { name: '솔향대게', hook: '살이 꽉 찬 대게의 진짜 맛' },
    { name: '초당순두부마을', hook: '강릉에 오면 꼭 먹어야 할 순두부' },
    { name: '연곡해변', hook: '캠핑과 바다가 함께하는 힐링 명소' },
    { name: '강문해변', hook: '커피와 일출이 가장 잘 어울리는 해변' },
    { name: '서울양계', hook: '현지인이 줄 서는 닭강정 맛집' },
    { name: '대게특별시', hook: '푸짐한 대게 한 상의 행복' },
    { name: '교동대게', hook: '강릉에서 만나는 프리미엄 대게' },
    { name: '강릉모루도서관', hook: '책과 쉼이 함께하는 감성 공간' },
    { name: '강릉시립중앙도서관', hook: '여행 중 잠시 쉬어가기 좋은 도서관' },
    { name: '초당작은도서관', hook: '조용한 마을 속 숨은 독서 명소' },
    { name: '사천진바위섬', hook: '파도와 바위가 만든 절경 포인트' },
    { name: '농산물 새벽시장', hook: '새벽에만 만날 수 있는 강릉의 활기' },
    { name: '중앙성남전통시장', hook: '강릉 사람들의 일상이 담긴 전통시장' },
    { name: '안반데기', hook: '구름 위에서 만나는 고원 풍경' },
    { name: '노추산 모정탑길', hook: '소원을 담은 돌탑길을 걸어보세요' },
    { name: '굴산사지 당간지주', hook: '천년 역사를 품은 고요한 문화유산' },
  ]
  
  export default function PlaceHookCard() {
    const picked = HOOKS[Math.floor(Math.random() * HOOKS.length)]
  
    return (
      <span className="max-w-[110px] truncate rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-seafoam shadow-sm sm:max-w-[140px]">
        📍 {picked.name}
      </span>
    )
  }