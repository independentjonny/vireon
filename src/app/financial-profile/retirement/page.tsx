import { redirect } from "next/navigation";
export default function Page() {
  redirect("/goals?edit=retirement#retirement");
}
