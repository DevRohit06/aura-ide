/**
 * Terminal Bridge Service (Client-side)
 * Connects the chat/agent system with the terminal output display
 * Routes agent messages, tool executions, and command outputs to the terminal
 */

import {
	ANSI,
	formatAgentMessage,
	formatToolResult,
	TerminalOutput
} from './terminal-output.service';

export interface TerminalBridgeConfig {
	autoScroll?: boolean;
	showTimestamps?: boolean;
	showToolExecutions?: boolean;
	showAgentThinking?: boolean;
}

/**
 * Terminal Bridge manages the connection between various parts of the app
 * and the terminal display component
 */
export class TerminalBridge {
	private terminalManager: any = null;
	private config: TerminalBridgeConfig = {
		autoScroll: true,
		showTimestamps: false,
		showToolExecutions: true,
		showAgentThinking: true
	};

	/**
	 * Set the terminal manager instance
	 */
	setTerminalManager(manager: any) {
		this.terminalManager = manager;
		console.log('✅ Terminal bridge connected to terminal manager:', !!manager);
		console.log('Terminal manager methods:', {
			hasWriteOutput: typeof manager?.writeOutput === 'function',
			hasWriteLine: typeof manager?.writeLine === 'function',
			hasClearTerminal: typeof manager?.clearTerminal === 'function',
			hasGetActiveSessionId: typeof manager?.getActiveSessionId === 'function',
			hasIsReady: typeof manager?.isReady === 'function'
		});

		// Check if manager is ready
		if (typeof manager?.isReady === 'function') {
			const ready = manager.isReady();
			console.log('Terminal manager ready status:', ready);
		}
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<TerminalBridgeConfig>) {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get the active terminal session ID
	 */
	private getSessionId(): string | null {
		if (!this.terminalManager) {
			console.warn('⚠️ Terminal manager not initialized in bridge');
			return null;
		}
		const sessionId = this.terminalManager.getActiveSessionId();
		if (!sessionId) {
			console.warn('⚠️ No active terminal session');
		}
		return sessionId;
	}

	/**
	 * Write raw output to terminal
	 */
	write(content: string) {
		console.log('🔵 Bridge.write() called with content:', content.substring(0, 100));
		console.log('🔵 Has terminal manager:', !!this.terminalManager);

		const sessionId = this.getSessionId();
		console.log('🔵 Session ID:', sessionId);

		if (!sessionId) {
			console.warn('⚠️ Cannot write to terminal: no session ID');
			return;
		}

		console.log('📝 Calling terminalManager.writeOutput...');
		this.terminalManager.writeOutput(sessionId, content);
		console.log('✅ terminalManager.writeOutput called');
	}

	/**
	 * Write a line to terminal
	 */
	writeLine(content: string) {
		const sessionId = this.getSessionId();
		if (!sessionId) return;

		const timestamp = this.config.showTimestamps ? TerminalOutput.formatTimestamp() : '';
		this.terminalManager.writeLine(sessionId, timestamp + content);
	}

	/**
	 * Clear the terminal
	 */
	clear() {
		const sessionId = this.getSessionId();
		if (!sessionId) return;

		this.terminalManager.clearTerminal(sessionId);
	}

	/**
	 * Show agent thinking message
	 */
	showThinking(message: string) {
		if (!this.config.showAgentThinking) return;

		const formatted = formatAgentMessage('thinking', message);
		this.write(formatted);
	}

	/**
	 * Show agent action
	 */
	showAction(message: string) {
		const formatted = formatAgentMessage('action', message);
		this.write(formatted);
	}

	/**
	 * Show success message
	 */
	showSuccess(message: string) {
		const formatted = formatAgentMessage('result', message);
		this.write(formatted);
	}

	/**
	 * Show error message
	 */
	showError(message: string) {
		const formatted = formatAgentMessage('error', message);
		this.write(formatted);
	}

	/**
	 * Show warning message
	 */
	showWarning(message: string) {
		this.write(`${ANSI.YELLOW}⚠️  ${message}${ANSI.RESET}\n`);
	}

	/**
	 * Show tool execution
	 */
	showToolExecution(toolName: string, args?: any, result?: any, error?: string, duration?: number) {
		if (!this.config.showToolExecutions) return;

		const formatted = formatToolResult(toolName, result, error, duration);
		this.write(formatted);
	}

	/**
	 * Show command being executed
	 */
	showCommand(command: string) {
		this.write(`${ANSI.BOLD}${ANSI.CYAN}$ ${ANSI.RESET}${command}\n`);
	}

	/**
	 * Show file operation
	 */
	showFileOperation(operation: string, filePath: string) {
		this.write(TerminalOutput.formatFileOperation(operation, filePath));
	}

	/**
	 * Show separator
	 */
	showSeparator() {
		this.write(TerminalOutput.formatSeparator());
	}

	/**
	 * Show section header
	 */
	showHeader(title: string) {
		this.write(TerminalOutput.formatKeyValue('', title));
		this.write(TerminalOutput.formatSeparator('═'));
	}

	/**
	 * Handle SSE event from agent stream
	 */
	handleSSEEvent(event: any) {
		console.log('🔵 [TerminalBridge] handleSSEEvent called:', {
			type: event.type,
			hasTerminalManager: !!this.terminalManager,
			eventData: event.data,
			eventContent: event.content
		});

		if (!this.terminalManager) {
			console.warn('⚠️ [TerminalBridge] No terminal manager, cannot handle event');
			return;
		}

		switch (event.type) {
			case 'thinking':
				console.log('💭 [TerminalBridge] Showing thinking message');
				this.showThinking(event.content || event.message || event.data?.message);
				break;

			case 'tool_start':
				console.log('🔧 [TerminalBridge] Tool started:', event.toolName || event.data?.toolName);
				if (event.toolName || event.data?.toolName) {
					const toolName = event.toolName || event.data?.toolName;
					this.write(
						`${ANSI.BOLD}${ANSI.CYAN}▶${ANSI.RESET} Executing: ${ANSI.CYAN}${toolName}${ANSI.RESET}\n`
					);
				}
				break;

			case 'tool_result':
			case 'tool_execution':
				console.log('✅ [TerminalBridge] Tool result received:', {
					hasToolName: !!(event.toolName || event.data?.toolName),
					hasOutput: !!(event.data?.output || event.data?.content || event.content),
					outputLength: (event.data?.output || event.data?.content || event.content || '')?.length
				});

				// First, check if we have raw output/content to display
				const toolOutput = event.data?.output || event.data?.content || event.content;
				if (toolOutput && typeof toolOutput === 'string' && toolOutput.trim()) {
					console.log(
						'📝 [TerminalBridge] Writing tool output to terminal:',
						toolOutput.substring(0, 100)
					);
					this.write(toolOutput);
					if (!toolOutput.endsWith('\n')) {
						this.write('\n');
					}
				}

				// Then show formatted tool execution if we have tool name
				if (event.toolName || event.data?.toolName) {
					this.showToolExecution(
						event.toolName || event.data?.toolName,
						event.args || event.parameters || event.data?.args,
						event.result || event.data?.result,
						event.error || event.data?.error,
						event.duration || event.data?.duration
					);
				}
				break;

			case 'output':
			case 'stdout':
				const outputContent = event.content || event.data || '';
				console.log('📤 [TerminalBridge] Writing output to terminal:', {
					contentType: typeof outputContent,
					contentLength: outputContent?.length,
					preview: outputContent?.substring?.(0, 100)
				});
				if (outputContent) {
					this.write(outputContent);
					if (!outputContent.endsWith('\n')) {
						this.write('\n');
					}
				}
				break;

			case 'stderr':
				console.log('❌ [TerminalBridge] Writing stderr to terminal');
				this.write(TerminalOutput.formatProcessOutput(event.content || event.data || '', true));
				break;

			case 'command':
				console.log('⚡ [TerminalBridge] Showing command:', event.command || event.content);
				this.showCommand(event.command || event.content || event.data?.command);
				break;

			case 'file_operation':
				if (event.operation && event.filePath) {
					console.log('📁 [TerminalBridge] File operation:', event.operation, event.filePath);
					this.showFileOperation(event.operation, event.filePath);
				}
				break;

			case 'error':
				console.log('❌ [TerminalBridge] Showing error');
				this.showError(event.message || event.content || event.data?.message || 'Unknown error');
				break;

			case 'success':
				console.log('✅ [TerminalBridge] Showing success');
				this.showSuccess(event.message || event.content || event.data?.message || 'Success');
				break;

			case 'separator':
				this.showSeparator();
				break;

			case 'header':
				this.showHeader(event.title || event.content || '');
				break;
		}
	}

	/**
	 * Handle chat message for terminal output
	 */
	handleChatMessage(message: any) {
		if (!this.terminalManager) return;

		// If message has terminal output array
		if (message.terminalOutput && Array.isArray(message.terminalOutput)) {
			message.terminalOutput.forEach((line: string) => {
				this.writeLine(line);
			});
		}

		// If message has metadata with tool calls
		if (message.metadata?.toolCalls) {
			message.metadata.toolCalls.forEach((tool: any) => {
				this.showToolExecution(
					tool.name,
					tool.args || tool.parameters,
					tool.result,
					tool.error,
					tool.duration
				);
			});
		}

		// If message has agent interrupt (tool execution request)
		if (message.agentInterrupt?.toolCalls) {
			this.showSeparator();
			this.write(`${ANSI.BOLD}${ANSI.YELLOW}⚠ Human Approval Required${ANSI.RESET}\n`);
			message.agentInterrupt.toolCalls.forEach((tool: any) => {
				this.write(`${ANSI.CYAN}  • ${tool.name}${ANSI.RESET}\n`);
			});
			this.showSeparator();
		}
	}

	/**
	 * Show a welcome message in terminal
	 */
	showWelcome(projectName?: string) {
		this.write(TerminalOutput.formatSeparator('━', 60));
		this.write(`${ANSI.BOLD}${ANSI.CYAN}  Aura IDE Terminal${ANSI.RESET}\n`);
		if (projectName) {
			this.write(`${ANSI.GRAY}  Project: ${projectName}${ANSI.RESET}\n`);
		}
		this.write(
			`${ANSI.GRAY}  Output-only terminal for AI responses and command execution${ANSI.RESET}\n`
		);
		this.write(TerminalOutput.formatSeparator('━', 60));
		this.write('\n');
	}

	/**
	 * Show project initialization message
	 */
	showProjectInit(projectName: string) {
		this.write('\n');
		this.write(
			`${ANSI.BOLD}${ANSI.GREEN}✓${ANSI.RESET} Project loaded: ${ANSI.CYAN}${projectName}${ANSI.RESET}\n`
		);
		this.write('\n');
	}
}

// Global singleton instance
export const terminalBridge = new TerminalBridge();
