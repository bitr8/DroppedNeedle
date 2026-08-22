import type { WorkState } from '$lib/components/kit/workState';

export type WorkVerb = 'pause' | 'resume' | 'stop' | 'retry';

export interface WorkItem {
	id: string;
	kind: string;
	title: string;
	state: WorkState;
	detail: string | null;
	progress: number | null;
	facts: string[];
	href: string | null;
	started_at: string | null;
	finished_at: string | null;
	controls: WorkVerb[];
}

export interface AttentionItem {
	id: string;
	what: string;
	why: string;
	action_label: string;
	action_href: string;
	tier: 'critical' | 'warning' | 'info';
	dismissible: boolean;
}

export interface ActivityResponse {
	running: WorkItem[];
	queued: WorkItem[];
	attention: AttentionItem[];
	history: WorkItem[];
}
