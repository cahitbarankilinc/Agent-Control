import { NextResponse } from 'next/server';
import { createMissionPipeline } from '@/lib/openclaw';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.missionId || !body.name) {
      return NextResponse.json({ error: 'missionId and name are required' }, { status: 400 });
    }

    const pipeline = await createMissionPipeline({
      missionId: String(body.missionId),
      name: String(body.name),
      description: body.description ? String(body.description) : undefined,
      loopMode: body.loopMode ?? 'none',
      loopValue: body.loopValue ? String(body.loopValue) : undefined,
      agentId: body.agentId ? String(body.agentId) : undefined,
      prompt: body.prompt ? String(body.prompt) : undefined,
    });

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
