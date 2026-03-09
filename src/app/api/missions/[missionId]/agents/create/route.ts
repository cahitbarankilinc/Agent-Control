import { NextResponse } from 'next/server';
import { createMissionAgentFromBrief } from '@/lib/openclaw';
import { listControlCenterData } from '@/lib/tasks-store';

export async function POST(request: Request, context: { params: Promise<{ missionId: string }> }) {
  try {
    const body = await request.json();
    const { missionId } = await context.params;
    if (!body.agentId || !body.role || !body.primaryModel) {
      return NextResponse.json({ error: 'agentId, role and primaryModel are required' }, { status: 400 });
    }

    const data = await listControlCenterData();
    const mission = data.missions.find((item) => item.id === missionId);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const binding = await createMissionAgentFromBrief({
      missionId,
      missionName: mission.name,
      agentId: String(body.agentId),
      role: String(body.role),
      primaryModel: String(body.primaryModel),
      fallbackModel: body.fallbackModel ? String(body.fallbackModel) : undefined,
    });

    return NextResponse.json({ binding }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
