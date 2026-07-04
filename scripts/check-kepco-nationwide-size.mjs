// 한전 빅데이터포털 전기차 충전소 API — 전국 무필터 호출 시 규모 확인 (읽기 전용)
// 실행: node scripts/check-kepco-nationwide-size.mjs
//
// 목적: addr 파라미터 없이 호출했을 때
//   1) 실제로 전국 전체가 다 오는지 (아니면 일부만 샘플로 오는지)
//   2) 건수가 몇 건인지
//   3) 응답 크기(byte)와 응답 시간이 얼마나 되는지
// 를 확인해서, 리버스 지오코딩 없이 "전국 데이터 통째로 받아서 거리 계산" 방식이
// 실용적인지 판단하기 위함.

const API_KEY = "s6QyTSGRZHn3GbLOu1Z0DR59Nx3hfe8Z61c4si80"; // 발급받으신 키 그대로 사용
const BASE = "https://bigdata.kepco.co.kr/openapi/v1/EVchargeManage.do";

async function main() {
  console.log("=== addr 없이 전국 호출 ===");
  const url = `${BASE}?apiKey=${API_KEY}&returnType=json`;

  const start = Date.now();
  const res = await fetch(url);
  const text = await res.text();
  const elapsed = Date.now() - start;

  console.log(`상태 코드: ${res.status}`);
  console.log(`응답 시간: ${elapsed}ms`);
  console.log(`응답 크기: ${(text.length / 1024).toFixed(1)} KB`);

  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    console.error("❌ JSON 파싱 실패. 응답이 JSON이 아닐 수 있습니다.");
    console.log("응답 앞부분:", text.slice(0, 300));
    return;
  }

  if (json.errCd) {
    console.error(`❌ API 오류: ${json.errCd} ${json.errMsg}`);
    return;
  }

  const items = json.data ?? [];
  console.log(`\n총 건수: ${items.length}건`);

  // 지역(주소 앞부분) 다양성 확인 — 전국 데이터가 실제로 섞여 있는지
  const regionSet = new Set(
    items.map((it) => (it.addr ?? "").split(" ")[0]).filter(Boolean)
  );
  console.log(`등장한 광역지자체 종류: ${regionSet.size}개`);
  console.log([...regionSet].join(", "));

  // 강원특별자치도 강릉시 항목이 몇 건 섞여 있는지 (아까 addr 필터 결과 68건과 비교용)
  const gangneungCount = items.filter((it) =>
    (it.addr ?? "").includes("강릉시")
  ).length;
  console.log(`\n이 중 "강릉시" 포함 항목: ${gangneungCount}건`);

  console.log(
    "\n※ 판단 기준: 응답 시간이 수 초 이내이고 건수가 수만 건 이하면 '주기적 DB 동기화 + 로컬 거리계산' 방식이 실용적입니다."
  );
  console.log(
    "  건수가 너무 많거나(수십만 건) 응답이 느리면, 리버스 지오코딩으로 지역 좁혀서 호출하는 방식이 필요합니다."
  );
}

main().catch((err) => {
  console.error("❌ 예외 발생:", err);
});
