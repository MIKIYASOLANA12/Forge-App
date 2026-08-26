import { NextResponse } from 'next/server';
import { getAccountabilityStatus } from '@/lib/accountabilityRecheck';

export async function GET() {
  try {
    const status = await getAccountabilityStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error: any) {
    console.error('Accountability status error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load accountability status' }, { status: 500 });
  }
}