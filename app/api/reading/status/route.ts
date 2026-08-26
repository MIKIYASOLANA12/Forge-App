import { NextResponse } from 'next/server';
import { getReadingSystemStatus } from '@/lib/readingEngine';

export async function GET() {
  try {
    const status = await getReadingSystemStatus();
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('Reading status error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
