import { NextResponse } from 'next/server';
import { scheduleTask } from '@/lib/openclaw';

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  try {
    const body = await request.json();
    const { taskId } = await context.params;
    if (!body.mode || !body.value) {
      return NextResponse.json({ error: 'mode and value are required' }, { status: 400 });
    }

    const result = await scheduleTask(taskId, {
      mode: body.mode,
      value: String(body.value),
      timezone: body.timezone ? String(body.timezone) : undefined,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
