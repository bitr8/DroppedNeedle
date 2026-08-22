import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Moved to /manage/artists — kept as a redirect for old links and bookmarks.
export const load: PageLoad = async ({ url }) => {
	throw redirect(307, `/manage/artists${url.search}`);
};
