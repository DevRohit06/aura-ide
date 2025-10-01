import type { CodebaseDocument } from '$lib/services/vector-db.service';

// Temporary in-memory document store for session/project-scoped attachments
class TempDocsService {
	// store per-session and per-project
	private sessionStore: Map<string, Map<string, CodebaseDocument>> = new Map();
	private projectStore: Map<string, Map<string, CodebaseDocument>> = new Map();

	addDocumentsForSession(sessionId: string, projectId: string, docs: CodebaseDocument[]) {
		if (!this.sessionStore.has(sessionId)) this.sessionStore.set(sessionId, new Map());
		const map = this.sessionStore.get(sessionId)!;
		for (const d of docs) map.set(d.filePath, d);
		// also add to project store so agent workflows that run under project context can see them
		if (!this.projectStore.has(projectId)) this.projectStore.set(projectId, new Map());
		const pmap = this.projectStore.get(projectId)!;
		for (const d of docs) pmap.set(d.filePath, d);
	}

	addDocumentsForProject(projectId: string, docs: CodebaseDocument[]) {
		if (!this.projectStore.has(projectId)) this.projectStore.set(projectId, new Map());
		const pmap = this.projectStore.get(projectId)!;
		for (const d of docs) pmap.set(d.filePath, d);
	}

	getDocumentsForSession(sessionId: string): CodebaseDocument[] {
		const map = this.sessionStore.get(sessionId);
		if (!map) return [];
		return Array.from(map.values());
	}

	getDocumentsForProject(projectId: string): CodebaseDocument[] {
		const map = this.projectStore.get(projectId);
		if (!map) return [];
		return Array.from(map.values());
	}

	getDocument(projectId: string, filePath: string): CodebaseDocument | null {
		const pmap = this.projectStore.get(projectId);
		if (pmap && pmap.has(filePath)) return pmap.get(filePath)!;
		// fallback: search session stores
		for (const map of this.sessionStore.values()) {
			if (map.has(filePath)) return map.get(filePath)!;
		}
		return null;
	}

	clearSession(sessionId: string) {
		this.sessionStore.delete(sessionId);
	}

	clearProject(projectId: string) {
		this.projectStore.delete(projectId);
	}
}

export const tempDocsService = new TempDocsService();
