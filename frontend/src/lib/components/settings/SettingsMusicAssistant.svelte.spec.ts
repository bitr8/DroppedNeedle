import { page } from '@vitest/browser/context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_API_URL: '' }
}));

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const show = vi.fn();

vi.mock('$lib/api/client', () => ({
	api: {
		global: {
			get: (...args: unknown[]) => get(...args),
			post: (...args: unknown[]) => post(...args),
			put: (...args: unknown[]) => put(...args)
		}
	}
}));

vi.mock('$lib/stores/toast', () => ({
	toastStore: { show: (...args: unknown[]) => show(...args) }
}));

import SettingsMusicAssistant from './SettingsMusicAssistant.svelte';

const STORED = { url: 'http://ma.test:8095', enabled: true, token_set: true };

describe('SettingsMusicAssistant', () => {
	beforeEach(() => {
		get.mockReset().mockResolvedValue(STORED);
		post.mockReset();
		put.mockReset();
		show.mockReset();
	});

	it('seeds the form and shows the token as stored rather than revealing it', async () => {
		render(SettingsMusicAssistant);
		await expect.element(page.getByLabelText('Server URL')).toHaveValue('http://ma.test:8095');
		const token = page.getByLabelText('Token');
		await expect.element(token).toHaveValue('');
		await expect.element(token).toHaveAttribute('placeholder', 'Stored — leave blank to keep');
	});

	it('reports a successful test with the server version', async () => {
		post.mockResolvedValue({ ok: true, message: 'Connected to Music Assistant 2.9.13' });
		render(SettingsMusicAssistant);
		await expect.element(page.getByLabelText('Server URL')).toHaveValue('http://ma.test:8095');
		await page.getByRole('button', { name: 'Test connection' }).click();
		await expect.element(page.getByText(/Connected to Music Assistant 2.9.13/)).toBeVisible();
	});

	it('reports a rejected token', async () => {
		post.mockResolvedValue({ ok: false, message: 'Music Assistant rejected the token' });
		render(SettingsMusicAssistant);
		await expect.element(page.getByLabelText('Server URL')).toHaveValue('http://ma.test:8095');
		await page.getByRole('button', { name: 'Test connection' }).click();
		await expect.element(page.getByText(/rejected the token/)).toBeVisible();
	});

	it('sends the mask when the token field is left blank', async () => {
		put.mockResolvedValue(STORED);
		render(SettingsMusicAssistant);
		await expect.element(page.getByLabelText('Server URL')).toHaveValue('http://ma.test:8095');
		await page.getByRole('button', { name: 'Save' }).click();
		await vi.waitFor(() =>
			expect(put).toHaveBeenCalledWith('/api/v1/settings/music-assistant', {
				url: 'http://ma.test:8095',
				enabled: true,
				token: 'ma****'
			})
		);
		expect(show).toHaveBeenCalledWith({ message: 'Music Assistant saved', type: 'success' });
	});

	it('sends a typed token verbatim and toasts on failure', async () => {
		put.mockRejectedValue(new Error('Music Assistant URL is required when enabled'));
		render(SettingsMusicAssistant);
		await expect.element(page.getByLabelText('Server URL')).toHaveValue('http://ma.test:8095');
		await page.getByLabelText('Token').fill('fresh-token');
		await page.getByRole('button', { name: 'Save' }).click();
		await vi.waitFor(() =>
			expect(put).toHaveBeenCalledWith('/api/v1/settings/music-assistant', {
				url: 'http://ma.test:8095',
				enabled: true,
				token: 'fresh-token'
			})
		);
		expect(show).toHaveBeenCalledWith({
			message: 'Music Assistant URL is required when enabled',
			type: 'error'
		});
	});
});
