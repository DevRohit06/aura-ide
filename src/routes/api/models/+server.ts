import { MODEL_PRESETS, modelManager } from '$lib/agent/model-manager';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const models = modelManager.listModels();
	return json({ models, presets: Object.keys(MODEL_PRESETS) });
};

export const POST: RequestHandler = async ({ request }) => {
	const { modelName, provider, customModel } = await request.json();

	let modelConfig;
	if (modelName) {
		modelConfig = modelManager.getModelPreset(modelName);
		if (!modelConfig) return json({ error: 'Invalid model preset' }, { status: 400 });
	} else if (provider && customModel) {
		modelConfig = { provider, model: customModel };
	} else {
		return json({ error: 'Must provide modelName or provider+customModel' }, { status: 400 });
	}

	return json({ success: true, modelConfig });
};
