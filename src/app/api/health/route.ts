import { connection } from "next/server";
import { getDemoHealth } from "@/lib/services/demo-health";

export async function GET() {
  await connection();
  return Response.json(await getDemoHealth(), { headers: { "Cache-Control": "no-store" } });
}
