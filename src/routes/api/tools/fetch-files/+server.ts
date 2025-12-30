import { auth } from '$lib/auth';
import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import { json } from '@sveltejs/kit';

export const POST = async ({ request, headers }: { request: Request; headers: Headers }) => {
	try {
		// Authenticate server-side user session to respect access controls
		const session = await auth.api.getSession({ headers });
		if (!session?.user) {
			return json({ success: false, message: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const paths: string[] = Array.isArray(body.paths) ? body.paths : [];
		const sandboxId: string | undefined = body.sandboxId;
		const projectId: string | undefined = body.projectId;

		if (paths.length === 0) {
			return json({ success: false, message: 'paths array is required' }, { status: 400 });
		}

		const sandboxManager = SandboxManager.getInstance();

		// If sandboxId provided, use provider downloadFiles for efficiency
		let result: Record<string, string> = {};
		try {
			if (sandboxId) {
				const files = await sandboxManager.downloadFiles(sandboxId, paths, { provider: undefined });
				for (const [p, buf] of Object.entries(files)) {
					result[p] = buf.toString('utf-8');
				}
			} else if (projectId) {
				// Fall back to reading from file storage or single-file reads
				const fetches = paths.map(async (p) => {
					// Use internal files API to leverage existing code paths and auth
					const res = await fetch('/api/files', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ operation: 'read', projectId, path: p })
					});
					if (!res.ok) return { path: p, content: null };
					const payload = await res.json();
					return { path: p, content: payload?.data?.content || null };
				});

				const resolved = await Promise.all(fetches);
				for (const row of resolved) {
					if (row.content !== null) result[row.path] = row.content;
				}
			}
		} catch (err) {
			console.error('Batch fetch failed:', err);
			return json(
				{
					success: false,
					message: 'Failed to fetch files',
					error: err instanceof Error ? err.message : 'Unknown'
				},
				{ status: 500 }
			);
		}

		return json({ success: true, data: result });
	} catch (err) {
		console.error('Fetch files error:', err);
		return json(
			{ success: false, message: err instanceof Error ? err.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
