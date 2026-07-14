import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { unstable_cache } from "next/cache";
import "./globals.css";
import BottomTabNav from "./components/BottomTabNav";
import NicknameOnboarding from "./components/NicknameOnboarding";
import SplashScreen from "./components/SplashScreen";
import KakaoSdk from "./components/KakaoSdk";
import { createAdminClient } from "@/lib/supabase/admin";

async function fetchRandomAwardPhoto() {
  const supabase = createAdminClient();

  const { count, error: countError } = await supabase
    .from("travel_award_photos")
    .select("*", { count: "exact", head: true });

  if (countError || !count) {
    if (countError) console.error("Beautiful Korea!! count 조회 오류:", countError.message);
    return null;
  }

  const randomOffset = Math.floor(Math.random() * count);

  const { data, error } = await supabase
    .from("travel_award_photos")
    .select("org_image, ko_title, ko_cman_nm, film_day")
    .range(randomOffset, randomOffset)
    .single();

  if (error || !data) {
    if (error) console.error("Beautiful Korea!! 랜덤 조회 오류:", error.message);
    return null;
  }

  return {
    url: data.org_image as string,
    title: data.ko_title as string,
    photographer: data.ko_cman_nm as string,
    filmDay: data.film_day as string,
  };
}

// 스플래시 화면은 클라이언트에서 최초 마운트 시 2.5초만 노출되고 끝나는데,
// 이 fetch가 캐싱 없이 RootLayout(모든 탭 공유)에 있으면 Next.js가 레이아웃 전체를 동적으로 취급해
// 탭을 누를 때마다(모든 네비게이션마다) DB 쿼리 2개(count + 랜덤 select)가 매번 재실행된다.
// (2026-07-14, 배포 후 "탭 전환 자체가 매번 느림" 리포트로 확인된 원인)
// unstable_cache로 감싸 5분(300초)에 한 번만 재조회하도록 해서 탭 전환마다 DB 왕복이 생기지 않게 한다.
const getRandomAwardPhoto = unstable_cache(fetchRandomAwardPhoto, ["random-award-photo"], {
  revalidate: 300,
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "보고 (BOGO) | 강릉 FLOW",
  description: "도장 한 칸마다, 강릉의 다른 얼굴을 찍어가요.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const backgroundPhoto = await getRandomAwardPhoto();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
      <div className="flex-1 pb-20">{children}</div>
        <NicknameOnboarding />
        <BottomTabNav />
        <SplashScreen backgroundPhoto={backgroundPhoto} />
        <KakaoSdk />
      </body>
    </html>
  );
}
