import { page, userEvent } from '@vitest/browser/context';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ConfirmModal from './ConfirmModal.svelte';

describe('ConfirmModal', () => {
	it('opens as a modal dialog and fires onconfirm', async () => {
		const onconfirm = vi.fn();
		render(ConfirmModal, {
			open: true,
			title: 'Discard this download?',
			kicker: 'Permanent deletion',
			confirmLabel: 'Discard files',
			cancelLabel: 'Keep files',
			danger: true,
			onconfirm
		});
		const dialog = page.getByRole('dialog');
		await expect.element(dialog).toBeVisible();
		expect((dialog.element() as HTMLDialogElement).open).toBe(true);
		await expect
			.element(page.getByRole('heading', { name: 'Discard this download?' }))
			.toBeVisible();

		await page.getByRole('button', { name: 'Discard files' }).click();
		expect(onconfirm).toHaveBeenCalledOnce();
	});

	it('closes on cancel and on Escape', async () => {
		const onconfirm = vi.fn();
		render(ConfirmModal, { open: true, title: 'Remove album?', onconfirm });
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect.element(page.getByRole('dialog')).not.toBeVisible();

		render(ConfirmModal, { open: true, title: 'Remove again?', onconfirm });
		await expect.element(page.getByRole('dialog')).toBeVisible();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByRole('dialog')).not.toBeVisible();
		expect(onconfirm).not.toHaveBeenCalled();
	});

	it('disables confirm while pending and surfaces an error', async () => {
		render(ConfirmModal, {
			open: true,
			title: 'Stop scan?',
			pending: true,
			error: 'Couldn’t stop the scan',
			onconfirm: vi.fn()
		});
		await expect.element(page.getByRole('button', { name: 'Confirm' })).toBeDisabled();
		await expect.element(page.getByRole('alert')).toHaveTextContent('Couldn’t stop the scan');
	});
});
