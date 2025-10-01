import { sandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { logger } from '$lib/utils/logger.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { toolCalls, sandboxId } = body as any;

	if (!Array.isArray(toolCalls)) {
		return json({ success: false, error: 'toolCalls array required' }, { status: 400 });
	}

	try {
		const previews: Array<{
			filePath: string;
			previousContent?: string | null;
			proposedContent?: string | null;
		}> = [];
		for (const tc of toolCalls) {
			if (['write_file', 'edit_file'].includes(tc.name)) {
				const filePath = tc.parameters?.filePath || tc.parameters?.path;
				let previous: string | null = null;
				try {
					if (sandboxId) {
						const file = await sandboxManager.readFile(sandboxId, filePath);
						const raw = file?.content ?? null;
						previous = raw && typeof raw !== 'string' ? String(raw) : raw;
					}
				} catch (err) {
					// Read may fail (file not exist) -> previous remains null
				}
				previews.push({
					filePath,
					previousContent: previous,
					proposedContent: tc.parameters?.content ?? null
				});
			}
		}

		return json({ success: true, previews });
	} catch (err: any) {
		logger.error('Preview generation failed', err?.message ?? err);
		return json({ success: false, error: err?.message ?? String(err) }, { status: 500 });
	}
};
