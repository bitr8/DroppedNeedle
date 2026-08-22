import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Moved to /manage/history — kept as a redirect for old links and bookmarks.
export const load: PageLoad = async ({ url }) => {
	throw redirect(307, `/manage/history${url.search}`);
};
