import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { get } from 'svelte/store';
import Toast from './Toast.svelte';
import { toastStore } from '$lib/stores/toast';

describe('Toast outlet', () => {
	afterEach(() => toastStore.hide());

	it('renders an undo toast whose action fires once and dismisses', async () => {
		const onUndo = vi.fn();
		render(Toast);
		toastStore.undo('Removed Abbey Road', onUndo);
		await expect.element(page.getByRole('status')).toHaveTextContent('Removed Abbey Road');

		await page.getByRole('button', { name: 'Undo' }).click();
		expect(onUndo).toHaveBeenCalledOnce();
		await expect.element(page.getByTestId('toast')).not.toBeInTheDocument();
		expect(get(toastStore)).toBeNull();
	});

	it('announces errors assertively and keeps them until dismissed', async () => {
		render(Toast);
		toastStore.show({ message: 'Couldn’t stop the scan', type: 'error' });
		const alert = page.getByRole('alert');
		await expect.element(alert).toBeVisible();
		expect(alert.element().getAttribute('aria-live')).toBe('assertive');

		await page.getByRole('button', { name: 'Dismiss' }).click();
		await expect.element(page.getByTestId('toast')).not.toBeInTheDocument();
	});
});
