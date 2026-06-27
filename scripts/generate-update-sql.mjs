// scripts/generate-update-sql.mjs
// 목적: place-details-result.json(수집 결과)을 읽어서 22곳에 대한
//       UPDATE SQL을 생성. TourAPI 호출 없음 — 로컬 파일 읽기/쓰기만.
// 실행: node scripts/generate-update-sql.mjs

import { readFile, writeFile } from "node:fs/promises";

const INPUT_PATH = "scripts/data/place-details-result.json";
const OUTPUT_PATH = "scripts/data/update-places-22.sql";

function sqlEscape(str) {
  if (str === null || str === undefined) return null;
  return String(str).replace(/'/g, "''");
}

function sqlValue(str) {
  const escaped = sqlEscape(str);
  return escaped === null ? "NULL" : `'${escaped}'`;
}

async function main() {
  const raw = await readFile(INPUT_PATH, "utf-8");
  const results = JSON.parse(raw);

  const lines = [];
  lines.push("-- ============================================================");
  lines.push("-- 강릉 FLOW 인사이트 — places 테이블 22곳 UPDATE");
  lines.push(`-- 생성일: ${new Date().toISOString().slice(0, 10)}`);
  lines.push("-- 출처: scripts/collect-place-details.mjs 수집 결과");
  lines.push("-- 대상 컬럼: description, address, image_url, api_content_id");
  lines.push("-- 주의: created_at/updated_at은 트리거가 자동 처리 — 여기서 입력 안 함");
  lines.push("-- ============================================================");
  lines.push("");

  for (const r of results) {
    lines.push(`-- ${r.name} (contentid=${r.contentid})`);
    lines.push(
      `UPDATE public.places SET ` +
        `description = ${sqlValue(r.description)}, ` +
        `address = ${sqlValue(r.address)}, ` +
        `image_url = ${sqlValue(r.image_url)}, ` +
        `api_content_id = ${sqlValue(r.contentid)} ` +
        `WHERE name = ${sqlValue(r.name)};`
    );
    lines.push("");
  }

  lines.push("-- ============================================================");
  lines.push("-- 검증용 쿼리 (실행 후 확인)");
  lines.push("-- ============================================================");
  lines.push(
    "-- SELECT name, api_content_id, address, length(description) AS desc_len, image_url IS NOT NULL AS has_image"
  );
  lines.push("-- FROM public.places WHERE api_content_id IS NOT NULL ORDER BY name;");
  lines.push("-- 예상 결과: 22행, desc_len과 has_image가 모두 채워져 있어야 함");

  const sql = lines.join("\n");
  await writeFile(OUTPUT_PATH, sql, "utf-8");
  console.log(`SQL 생성 완료: ${OUTPUT_PATH}`);
  console.log(`총 ${results.length}개 UPDATE문 생성됨.`);
}

main();
