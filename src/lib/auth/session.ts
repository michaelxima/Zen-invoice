import "server-only";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./options";
import { businessesQ } from "../db/queries";

export async function getSessionBusinessId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const businessId = session?.user?.businessId;
  if (!userId || !businessId) redirect("/login");

  const ownedBusiness = await businessesQ.findByIdForUser(businessId, userId);
  if (!ownedBusiness[0]) redirect("/login");
  return ownedBusiness[0].id;
}
