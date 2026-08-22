import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const mutate = vi.fn();
const dismissMutate = vi.fn();

vi.mock('$lib/queries/activity/ActivityQuery.svelte', () => ({
	getActivityQuery: () => ({
		data: {
			running: [
				{
					id: 'w1',
					kind: 'scan',
					title: 'Scanning library',
					state: 'running',
					detail: null,
					progress: 40,
					facts: [],
					href: null,
					started_at: null,
					finished_at: null,
					controls: ['pause', 'stop']
				}
			],
			queued: [],
			attention: [
				{
					id: 'a1',
					what: 'Abbey Road',
					why: 'Repeated match failures',
					action_label: 'Review',
					action_href: '/review?highlight=a1',
					tier: 'warning',
					dismissible: true
				}
			],
			history: []
		},
		isError: false
	})
}));

vi.mock('$lib/queries/activity/ActivityMutations.svelte', () => ({
	runActivityVerb: () => ({ mutate }),
	dismissAttentionItem: () => ({ mutate: dismissMutate })
}));

import ActivityDrawer from './ActivityDrawer.svelte';

describe('ActivityDrawer', () => {
	it('groups running work and needs-attention items', async () => {
		render(ActivityDrawer, { open: true });
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await expect.element(page.getByText('Scanning library')).toBeVisible();
		await expect.element(page.getByText('Abbey Road')).toBeVisible();
	});

	it('fires the control verb with the item id', async () => {
		render(ActivityDrawer, { open: true });
		await page.getByRole('button', { name: 'Pause Scanning library' }).click();
		expect(mutate).toHaveBeenCalledWith({ id: 'w1', verb: 'pause', title: 'Scanning library' });
	});

	it('dismisses an attention item', async () => {
		render(ActivityDrawer, { open: true });
		await page.getByRole('button', { name: 'Dismiss Abbey Road' }).click();
		expect(dismissMutate).toHaveBeenCalledWith({ id: 'a1', what: 'Abbey Road' });
	});
});
