import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import StatusPill from './StatusPill.svelte';

describe('StatusPill', () => {
	it('renders the plain state word', async () => {
		render(StatusPill, { state: 'attention' });
		const pill = page.getByText('Needs attention');
		await expect.element(pill).toBeVisible();
		expect(pill.element().getAttribute('data-state')).toBe('attention');
	});

	it('lets a caller qualify the word without changing the state', async () => {
		render(StatusPill, { state: 'waiting', label: 'Waiting — retry at 14:30' });
		await expect.element(page.getByText('Waiting — retry at 14:30')).toBeVisible();
		await expect.element(page.getByText('Waiting', { exact: true })).not.toBeInTheDocument();
	});
});
