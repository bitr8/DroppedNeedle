import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import ProgressHeader from './ProgressHeader.svelte';
import '../../../app.css';

describe('ProgressHeader', () => {
	it('shows a determinate bar and facts while running', async () => {
		render(ProgressHeader, {
			title: 'Applying changes',
			state: 'running',
			progress: 60,
			facts: ['34 of 56 files']
		});
		const bar = page.getByRole('progressbar');
		await expect.element(bar).toBeVisible();
		expect(bar.element().getAttribute('aria-valuenow')).toBe('60');
		await expect.element(page.getByText('34 of 56 files')).toBeVisible();
	});

	it('drops the bar once done', async () => {
		render(ProgressHeader, { title: 'Applying changes', state: 'done' });
		await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
	});

	it('renders caller-supplied controls', async () => {
		render(ProgressHeader, {
			title: 'Scanning library',
			state: 'running',
			controls: createRawSnippet(() => ({ render: () => '<button>Cancel</button>' }))
		});
		await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
	});
});
