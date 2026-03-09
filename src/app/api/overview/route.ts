import { NextResponse } from 'next/server';
import { getDashboardOverview } from '@/lib/openclaw';

export async function GET() {
  try {
    const overview = await getDashboardOverview();
    return NextResponse.json(overview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
