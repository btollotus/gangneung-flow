'use server'
confirmVisit(placeId, userLat, userLng, clientDistance) 흐름:

1. createClient() (server.ts, 쿠키 기반) → supabase.auth.getUser()
   → user 없으면 에러 반환 (위조된 user_id를 신뢰하지 않기 위해 여기서 직접 확인)

2. createAdminClient() (service_role) 생성

3. admin으로 places 테이블에서 해당 placeId의 base_xp, latitude, longitude를
   DB에서 직접 다시 조회 (클라이언트가 보낸 값은 신뢰 안 함)

4. [신규 제안] 서버에서 Haversine 거리 재계산
   → 클라이언트가 보낸 lat/lng와 DB의 장소 좌표로 거리를 한 번 더 계산
   → 200m 초과면 에러 반환 ("클라이언트 로직을 조작해서 멀리서도 체크인되는 것" 방지)

5. xp_earned = base_xp 그대로 (옵션 A로 확정됨)

6. happened_at = new Date().toISOString()
   (지금 이 순간의 timestamp라 UTC 문자열 그대로 OK —
    날짜지침의 +09:00 규칙은 "날짜만 있는 문자열"을 다룰 때 얘기였고,
    "지금 당장"을 기록하는 경우엔 해당 안 됨)

7. visits insert (user_id, place_id, latitude, longitude, distance_meters, xp_earned, happened_at)
   → 실패 시 에러 로깅 + 사용자에게 실패 반환

8. place_actions insert (action_type='visit_verified', weight=0.6, 같은 happened_at)
   → 실패해도 visits는 이미 저장됐으니, 로깅만 하고 사용자에게는 성공으로 처리
     (이 로그는 보조 분석용이라 핵심 흐름을 막지 않음 — 맞는지 확인 부탁드립니다)

9. user_scores 갱신:
   - 해당 user의 visits 전체를 다시 조회해서
     total_xp = SUM(xp_earned), distinct_places_visited = COUNT(DISTINCT place_id)
     를 재계산 (누적 증가 방식이 아니라 매번 재집계 — 33곳 규모라 성능 문제 없고,
     드리프트 버그를 원천적으로 막음)
   - user_scores에 upsert (user_id 기준)
   - level 컬럼은 건드리지 않음 (칭호는 동적 계산이라는 기존 결정과 일치 — 맞는지 확인 부탁드립니다)

10. { success: true, xpEarned } 반환