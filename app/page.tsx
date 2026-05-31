import { redirect } from "next/navigation";
import { getOptionalOwnerSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getOptionalOwnerSession();

  redirect(session ? "/journal" : "/login");
}
