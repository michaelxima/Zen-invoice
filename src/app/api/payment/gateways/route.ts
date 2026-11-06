import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Gateway discovery is retired. Payment availability is determined per invoice by the connected Stripe account." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Gateway settings can only be changed through the authenticated Stripe Connect workflow." }, { status: 410 });
}
