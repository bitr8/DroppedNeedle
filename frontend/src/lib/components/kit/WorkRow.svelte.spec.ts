import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import WorkRow from './WorkRow.svelte';
import '../../../app.css';

describe('WorkRow', () => {
	it('shows a determinate bar while running', async () => {
		render(WorkRow, { title: 'Scanning library', state: 'running', progress: 42 });
		const bar = page.getByRole('progressbar');
		await expect.element(bar).toBeVisible();
		expect(bar.element().getAttribute('aria-valuenow')).toBe('42');
		await expect.element(page.getByText('Running')).toBeVisible();
	});

	it('drops the bar once the work is done and keeps the facts', async () => {
		render(WorkRow, {
			title: 'Scanning library',
			state: 'done',
			progress: 100,
			facts: ['12 new', '3 changed']
		});
		await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
		await expect.element(page.getByText('12 new · 3 changed')).toBeVisible();
	});

	it('renders caller-supplied controls', async () => {
		render(WorkRow, {
			title: 'Organizing files',
			state: 'paused',
			controls: createRawSnippet(() => ({ render: () => '<button>Resume</button>' }))
		});
		await expect.element(page.getByRole('button', { name: 'Resume' })).toBeVisible();
	});
});
