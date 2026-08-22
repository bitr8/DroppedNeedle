import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SegmentedControl from './SegmentedControl.svelte';

const options = [
	{ value: 'all', label: 'All', count: 12 },
	{ value: 'active', label: 'Active', count: 3 },
	{ value: 'done', label: 'Done' }
];

describe('SegmentedControl', () => {
	it('marks the selected option checked and exposes radiogroup semantics', async () => {
		render(SegmentedControl, { options, value: 'active', ariaLabel: 'Filter' });
		await expect.element(page.getByRole('radiogroup', { name: 'Filter' })).toBeVisible();
		const active = page.getByRole('radio', { name: 'Active 3' });
		expect(active.element().getAttribute('aria-checked')).toBe('true');
		expect(active.element().getAttribute('tabindex')).toBe('0');
		expect(page.getByRole('radio', { name: 'All 12' }).element().getAttribute('tabindex')).toBe(
			'-1'
		);
	});

	it('moves selection on click', async () => {
		let value = 'all';
		render(SegmentedControl, {
			options,
			get value() {
				return value;
			},
			set value(v) {
				value = v;
			},
			ariaLabel: 'Filter'
		});
		await page.getByRole('radio', { name: 'Done' }).click();
		expect(value).toBe('done');
	});

	it('moves focus and selection with arrow keys, wrapping', async () => {
		let value = 'done';
		render(SegmentedControl, {
			options,
			get value() {
				return value;
			},
			set value(v) {
				value = v;
			},
			ariaLabel: 'Filter'
		});
		const done = page.getByRole('radio', { name: 'Done' });
		(done.element() as HTMLElement).focus();
		await done
			.element()
			.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
			);
		expect(value).toBe('all');
	});
});
