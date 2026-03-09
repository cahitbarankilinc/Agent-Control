import { NextResponse } from 'next/server';
import { createTask, listTasks } from '@/lib/tasks-store';

export async function GET() {
  return NextResponse.json({ tasks: await listTasks() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.agentId || !body.prompt) {
      return NextResponse.json({ error: 'title, agentId and prompt are required' }, { status: 400 });
    }

    const task = await createTask({
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
