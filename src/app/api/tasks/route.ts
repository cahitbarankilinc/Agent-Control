import { NextResponse } from 'next/server';
import { createTask, listControlCenterData } from '@/lib/tasks-store';

export async function GET() {
  const data = await listControlCenterData();
  return NextResponse.json({ tasks: data.tasks });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.agentId || !body.prompt || !body.missionId) {
      return NextResponse.json({ error: 'title, missionId, agentId and prompt are required' }, { status: 400 });
    }

    const task = await createTask({
      missionId: String(body.missionId),
      title: String(body.title),
      agentId: String(body.agentId),
      prompt: String(body.prompt),
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
