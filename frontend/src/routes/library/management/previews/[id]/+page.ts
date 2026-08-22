import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Moved to /manage/previews/[id] — kept as a redirect for old links and bookmarks.
export const load: PageLoad = async ({ params, url }) => {
	throw redirect(307, `/manage/previews/${encodeURIComponent(params.id)}${url.search}`);
};
