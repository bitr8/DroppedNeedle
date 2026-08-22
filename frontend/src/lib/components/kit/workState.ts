export type WorkState =
	| 'running'
	| 'queued'
	| 'paused'
	| 'waiting'
	| 'attention'
	| 'done'
	| 'failed';

export const WORK_STATE_LABEL: Record<WorkState, string> = {
	running: 'Running',
	queued: 'Queued',
	paused: 'Paused',
	waiting: 'Waiting',
	attention: 'Needs attention',
	done: 'Done',
	failed: 'Failed'
};
