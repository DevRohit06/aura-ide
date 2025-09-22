import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	let layout = event.cookies.get('PaneForge:layout');
	let verticalLayout = event.cookies.get('PaneForge:vertical-layout');
	if (layout) {
		layout = JSON.parse(layout);
	}
	if (verticalLayout) {
		verticalLayout = JSON.parse(verticalLayout);
	}

	return {
		layout,
		verticalLayout
	};
};
