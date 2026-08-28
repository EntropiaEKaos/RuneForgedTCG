import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin — Runeforge",
};

// The standalone Card Creator panel (AdminClient/AdminCreator) was retired:
// the Card Authoring Studio at /admin/studio/cards covers every card type
// (including Sentinela) plus QA tests, validation and the publish pipeline,
// which the old panel never had. /admin now forwards to the Studio Control
// Room instead of hosting a second, weaker card editor.
export default function AdminPage() {
  redirect("/admin/studio");
}
