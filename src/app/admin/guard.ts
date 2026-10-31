import "server-only";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/login?next=/admin");
  if (!viewer.isAdmin) redirect("/");
  return viewer;
}
