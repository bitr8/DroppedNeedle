import { describe, expect, it } from 'vitest';

import { load as rootLoad } from './library/management/+page';
import { load as artistsLoad } from './library/management/artists/+page';
import { load as historyLoad } from './library/management/history/+page';
import { load as previewLoad } from './library/management/previews/[id]/+page';
import { load as operationLoad } from './library/management/operations/[id]/+page';

function urlEvent(href: string) {
	return { url: new URL(href) } as never;
}

function paramEvent(href: string, id: string) {
	return { url: new URL(href), params: { id } } as never;
}

describe('old library/management routes redirect to /manage', () => {
	it('redirects the control room root, preserving query', async () => {
		await expect(
			rootLoad(urlEvent('https://music.example.test/library/management?tab=organize'))
		).rejects.toMatchObject({ status: 307, location: '/manage?tab=organize' });
	});

	it('redirects the artist merge desk', async () => {
		await expect(
			artistsLoad(urlEvent('https://music.example.test/library/management/artists?q=Grimes'))
		).rejects.toMatchObject({ status: 307, location: '/manage/artists?q=Grimes' });
	});

	it('redirects the organization history table', async () => {
		await expect(
			historyLoad(urlEvent('https://music.example.test/library/management/history'))
		).rejects.toMatchObject({ status: 307, location: '/manage/history' });
	});

	it('redirects a preview page, encoding the id', async () => {
		await expect(
			previewLoad(
				paramEvent('https://music.example.test/library/management/previews/job%2F1', 'job/1')
			)
		).rejects.toMatchObject({ status: 307, location: '/manage/previews/job%2F1' });
	});

	it('redirects an operation page, encoding the id', async () => {
		await expect(
			operationLoad(
				paramEvent('https://music.example.test/library/management/operations/job%2F1', 'job/1')
			)
		).rejects.toMatchObject({ status: 307, location: '/manage/operations/job%2F1' });
	});
});
