/**
 * Port Forwarding API Routes
 * REST API endpoints for forwarding ports from sandbox to external access
 */

import { DatabaseService } from '$lib/services/database.service';
import { DaytonaService } from '$lib/services/sandbox/daytona.service';
import { SandboxManager } from '$lib/services/sandbox/sandbox-manager';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

interface ForwardPortRequest {
	internalPort: number;
	externalPort?: number;
	protocol?: 'tcp' | 'udp';
	public?: boolean;
}

interface StopPortForwardRequest {
	internalPort: number;
	externalPort?: number;
}

/**
 * POST /api/sandbox/[id]/forward-port
 * Forward a port from the sandbox to external access
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const body = (await request.json()) as ForwardPortRequest;
		const { internalPort, externalPort, protocol = 'tcp', public: isPublic = true } = body;

		if (!internalPort || internalPort <= 0 || internalPort > 65535) {
			return json({ error: 'Valid internal port is required (1-65535)' }, { status: 400 });
		}

		const sandboxManager = SandboxManager.getInstance();

		// Find project by sandbox ID to verify ownership
		const project = await DatabaseService.findProjectBySandboxId(sandboxId);
		if (!project || project.ownerId !== user.id) {
			return json({ error: 'Sandbox not found or access denied' }, { status: 404 });
		}

		console.log(`🔗 [PortForward] Forwarding port ${internalPort} for sandbox ${sandboxId}`, {
			internalPort,
			externalPort,
			protocol,
			public: isPublic,
			sandboxId,
			provider: project.sandboxProvider
		});

		// Use our properly implemented getPreviewUrl method
		const daytonaService = DaytonaService.getInstance();

		let portForward;
		try {
			const previewInfo = await daytonaService.getPreviewUrl(sandboxId, internalPort);
			console.log(`Preview link url: ${previewInfo.url}`);
			console.log(`Preview link token: ${previewInfo.token}`);

			const resultExternalPort = externalPort || internalPort;
			portForward = {
				externalPort: resultExternalPort,
				url: previewInfo.url,
				token: previewInfo.token
			};
		} catch (error) {
			console.error('Failed to get preview URL:', error);
			return json({ error: 'Failed to get preview URL' }, { status: 500 });
		}

		console.log(`✅ [PortForward] Port forwarded successfully`, {
			internalPort,
			externalPort: portForward.externalPort,
			url: portForward.url,
			sandboxId
		});

		// Update project metadata with port forwarding info
		const currentPorts = project.metadata?.forwardedPorts || [];
		const updatedPorts = [
			...currentPorts.filter((p: any) => p.internalPort !== internalPort),
			{
				internalPort,
				externalPort: portForward.externalPort,
				protocol,
				public: isPublic,
				url: portForward.url,
				token: portForward.token,
				createdAt: new Date().toISOString()
			}
		];

		await DatabaseService.updateProject(project.id, {
			metadata: {
				...project.metadata,
				forwardedPorts: updatedPorts
			},
			updatedAt: new Date()
		});

		return json({
			success: true,
			internalPort,
			externalPort: portForward.externalPort,
			url: portForward.url,
			token: portForward.token,
			protocol,
			public: isPublic,
			message: `Port ${internalPort} forwarded to ${portForward.externalPort}`
		});
	} catch (error) {
		console.error(`❌ [PortForward] Failed to forward port:`, error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to forward port',
				success: false
			},
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/sandbox/[id]/forward-port
 * Stop forwarding a port
 */
export const DELETE: RequestHandler = async ({ params, request, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		const body = (await request.json()) as StopPortForwardRequest;
		const { internalPort, externalPort } = body;

		if (!internalPort || internalPort <= 0 || internalPort > 65535) {
			return json({ error: 'Valid internal port is required (1-65535)' }, { status: 400 });
		}

		// Find project by sandbox ID to verify ownership
		const project = await DatabaseService.findProjectBySandboxId(sandboxId);
		if (!project || project.ownerId !== user.id) {
			return json({ error: 'Sandbox not found or access denied' }, { status: 404 });
		}

		console.log(`🔗 [PortForward] Stopping port forward ${internalPort} for sandbox ${sandboxId}`, {
			internalPort,
			externalPort,
			sandboxId,
			provider: project.sandboxProvider
		});

		// Note: Most sandbox providers don't have explicit "stop port forward" functionality
		// The port forwarding typically stops when the process using the port stops
		// We'll just update the project metadata

		// Update project metadata to remove port forwarding info
		const currentPorts = project.metadata?.forwardedPorts || [];
		const updatedPorts = currentPorts.filter((p: any) => p.internalPort !== internalPort);

		await DatabaseService.updateProject(project.id, {
			metadata: {
				...project.metadata,
				forwardedPorts: updatedPorts
			},
			updatedAt: new Date()
		});

		console.log(`✅ [PortForward] Port forward stopped`, {
			internalPort,
			sandboxId
		});

		return json({
			success: true,
			message: `Port forwarding for ${internalPort} stopped`
		});
	} catch (error) {
		console.error(`❌ [PortForward] Failed to stop port forward:`, error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to stop port forwarding',
				success: false
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/sandbox/[id]/forward-port
 * List all forwarded ports for a sandbox
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const user = locals.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sandboxId = params.id;
		if (!sandboxId) {
			return json({ error: 'Sandbox ID is required' }, { status: 400 });
		}

		// Find project by sandbox ID to verify ownership
		const project = await DatabaseService.findProjectBySandboxId(sandboxId);
		if (!project || project.ownerId !== user.id) {
			return json({ error: 'Sandbox not found or access denied' }, { status: 404 });
		}

		const forwardedPorts = project.metadata?.forwardedPorts || [];

		return json({
			success: true,
			forwardedPorts,
			sandboxId,
			provider: project.sandboxProvider
		});
	} catch (error) {
		console.error(`❌ [PortForward] Failed to list forwarded ports:`, error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Failed to list forwarded ports',
				success: false
			},
			{ status: 500 }
		);
	}
};
