import { page } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AttentionCard from './AttentionCard.svelte';

describe('AttentionCard', () => {
	it('renders what/why/action for a valid item', async () => {
		render(AttentionCard, {
			item: {
				id: 'a1',
				what: 'Abbey Road',
				why: 'Repeated match failures',
				action_label: 'Review',
				action_href: '/review?highlight=a1',
				tier: 'warning',
				dismissible: false
			}
		});
		await expect.element(page.getByText('Abbey Road')).toBeVisible();
		await expect.element(page.getByText('Repeated match failures')).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Review' })).toBeVisible();
	});

	it('refuses to render an item missing why', async () => {
		render(AttentionCard, {
			item: {
				id: 'a2',
				what: 'Abbey Road',
				why: '',
				action_label: 'Review',
				action_href: '/review',
				tier: 'critical',
				dismissible: false
			}
		});
		await expect.element(page.getByTestId('attention-card')).not.toBeInTheDocument();
	});

	it('calls ondismiss with the item when dismissible', async () => {
		const ondismiss = vi.fn();
		render(AttentionCard, {
			item: {
				id: 'a3',
				what: 'Sync',
				why: 'Auth expired',
				action_label: 'Reconnect',
				action_href: '/settings/connections',
				tier: 'critical',
				dismissible: true
			},
			ondismiss
		});
		await page.getByRole('button', { name: 'Dismiss Sync' }).click();
		expect(ondismiss).toHaveBeenCalledWith(expect.objectContaining({ id: 'a3' }));
	});
});
