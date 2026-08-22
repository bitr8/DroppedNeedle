import type { LibraryWorkItem } from '$lib/queries/library/LibraryOperationsTypes';
import type { WorkState } from '$lib/components/kit/workState';

const TERMINAL_STATES = new Set([
	'completed',
	'succeeded',
	'cancelled',
	'stopped',
	'idle',
	'ready'
]);

export function isTerminalWork(item: LibraryWorkItem): boolean {
	return TERMINAL_STATES.has(item.state) || item.state === 'failed';
}

export function isRunningWork(item: LibraryWorkItem): boolean {
	return !isTerminalWork(item);
}

export function toWorkState(item: LibraryWorkItem): WorkState {
	if (item.state === 'failed') return 'failed';
	if (item.effect === 'attention') return 'attention';
	if (item.state === 'queued') return 'queued';
	if (item.state === 'paused' || item.state === 'pausing') return 'paused';
	if (item.state === 'stopping') return 'waiting';
	if (TERMINAL_STATES.has(item.state)) return 'done';
	return 'running';
}
