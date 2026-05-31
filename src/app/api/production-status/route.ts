import { productionStatus } from "@/lib/productionAgent";

export async function GET() {
  return Response.json(productionStatus());
}
