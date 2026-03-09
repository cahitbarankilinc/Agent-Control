import { NextResponse } from 'next/server';
import { importAgentToMission } from '@/lib/openclaw';

export async function POST(request: Request, context: { params: Promise<{ missionId: string }> }) {
  try {
    const body = await request.json();
    const { missionId } = await context.params;
    if (!body.agentId || !body.role) {
      return NextResponse.json({ error: 'agentId and role are required' }, { status: 400 });
    }

    const binding = await importAgentToMission({
      missionId,
      agentId: String(body.agentId),
      role: String(body.role),
      notes: body.notes ? String(body.notes) : undefined,
    });

    return NextResponse.json({ binding }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
