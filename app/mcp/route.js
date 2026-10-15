import { handleMcp } from '../../src/next-mcp.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = handleMcp;
export const GET = handleMcp;
export const DELETE = handleMcp;
