import { NextResponse } from 'next/server';
import { createMission, listControlCenterData } from '@/lib/tasks-store';

export async function GET() {
  const data = await listControlCenterData();
  return NextResponse.json({ missions: data.missions });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.description) {
      return NextResponse.json({ error: 'name and description are required' }, { status: 400 });
    }

    const mission = await createMission({
      name: String(body.name),
      description: String(body.description),
      color: body.color ? String(body.color) : undefined,
    });

    return NextResponse.json({ mission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
