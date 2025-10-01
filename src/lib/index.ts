// Tool Call Store Exports
export {
	activeToolCalls,
	executionContext,
	hasActiveToolCalls,
	isExecutingAnyTool,
	toolCallActions,
	toolCallHistory,
	totalToolCalls
} from './stores/tool-calls.store.js';

// Tool Types
export type {
	FileEditToolParams,
	FileEditToolResult,
	ToolCall,
	ToolCallDisplayState,
	ToolCallExecutionContext,
	ToolCallResult,
	ToolDefinition
} from './types/tools.js';

export const sanitizeResponseContent = (content: string) => {
	return content
		.replace(/<\|[a-z]*$/, '')
		.replace(/<\|[a-z]+\|$/, '')
		.replace(/<$/, '')
		.replaceAll(/<\|[a-z]+\|>/g, ' ')
		.replaceAll('<', '&lt;')
		.trim();
};

export const revertSanitizedResponseContent = (content: string) => {
	return content.replaceAll('&lt;', '<');
};

export const copyToClipboard = async (text: string | null) => {
	let result = false;
	if (!navigator.clipboard) {
		const textArea = document.createElement('textarea');
		textArea.value = text;

		// Avoid scrolling to bottom
		textArea.style.top = '0';
		textArea.style.left = '0';
		textArea.style.position = 'fixed';

		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			const successful = document.execCommand('copy');
			const msg = successful ? 'successful' : 'unsuccessful';
			result = true;
		} catch (err) {
			console.error('Fallback: Oops, unable to copy', err);
		}

		document.body.removeChild(textArea);
		return result;
	}

	result = await navigator.clipboard
		.writeText(text)
		.then(() => {
			return true;
		})
		.catch((error) => {
			console.error('Async: Could not copy text: ', error);
			return false;
		});

	return result;
};

export const getTimeDifference = (date: string) => {
	const currentDate = new Date();
	const messageDate = new Date(date);
	const diff = currentDate.getTime() - messageDate.getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
	const seconds = Math.floor((diff % (1000 * 60)) / 1000);
	if (days > 0) {
		return `${days} days ago`;
	} else if (hours > 0) {
		return `${hours} hr ago`;
	} else if (minutes > 0) {
		return `${minutes} min ago`;
	} else {
		return `${seconds} sec ago`;
	}
};

export const debounce = (func: (...args: any[]) => void, delay: number) => {
	let timeout: number;
	return function (...args: any[]) {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = window.setTimeout(() => func.apply(this, args), delay);
	};
};

export const isValidEmail = (email: string) => {
	const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
	return re.test(email);
};

export function unescapeHtml(html: string) {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	return doc.documentElement.textContent;
}

export function formatFileSize(fileSize: string | number) {
	const size = parseInt(fileSize);
	if (size < 1024) {
		return `${size} B`;
	} else if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(2)} KB`;
	} else if (size < 1024 * 1024 * 1024) {
		return `${(size / 1024 / 1024).toFixed(2)} MB`;
	} else {
		return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
	}
}

export function removeEmptyProperties(obj: any): any {
	if (Array.isArray(obj)) {
		return obj
			.map(removeEmptyProperties)
			.filter(
				(value) =>
					value !== null &&
					value !== undefined &&
					value !== '' &&
					(typeof value !== 'object' || Object.keys(value).length > 0)
			);
	} else if (typeof obj === 'object' && obj !== null) {
		return Object.fromEntries(
			Object.entries(obj)
				.map(([key, value]) => [key, removeEmptyProperties(value)])
				.filter(
					([_, value]) =>
						value !== null &&
						value !== undefined &&
						value !== '' &&
						(typeof value !== 'object' || Object.keys(value).length > 0)
				)
		);
	} else {
		return obj;
	}
}
