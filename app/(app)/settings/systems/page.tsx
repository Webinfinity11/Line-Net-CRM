import { redirect } from "next/navigation";

/** Systems became service categories; old links and bookmarks land on the new screen. */
export default function SystemsRedirect() {
  redirect("/settings/services/categories");
}
