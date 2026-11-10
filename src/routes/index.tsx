import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { CablePlannerApp } from "@/components/planner/CablePlannerApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cable Planner — תכנון תוואי מזינים" },
      {
        name: "description",
        content: "תכנון תוואי מזינים חשמליים על תוכנית: כיול, סימון לוחות ומכשולים, ניתוב A* ובודק מזינים.",
      },
      { property: "og:title", content: "Cable Planner — תכנון תוואי מזינים" },
      {
        property: "og:description",
        content: "הצעת תוואי גאומטרית ובדיקות עזר למזינים חשמליים — לא תכנון מאושר.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground" dir="rtl">
          טוען את Cable Planner…
        </div>
      }
    >
      <CablePlannerApp />
    </ClientOnly>
  );
}