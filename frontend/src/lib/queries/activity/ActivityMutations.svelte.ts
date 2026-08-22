import { createMutation } from '@tanstack/svelte-query';

import { api } from '$lib/api/client';
import { invalidateQueriesWithPersister } from '$lib/queries/QueryClient';
import { toastStore } from '$lib/stores/toast';

import { ActivityQueryKeyFactory } from './ActivityQueryKeyFactory';
import type { WorkVerb } from './types';

function errorMessage(err: unknown, fallback: string): string {
	return err instanceof Error && err.message ? err.message : fallback;
}

const invalidateActivity = () =>
	invalidateQueriesWithPersister({ queryKey: ActivityQueryKeyFactory.all });

const VERB_LABEL: Record<WorkVerb, string> = {
	pause: 'pause',
	resume: 'resume',
	stop: 'stop',
	retry: 'retry'
};

interface VerbInput {
	id: string;
	verb: WorkVerb;
	title: string;
}

function verbRequest(input: VerbInput) {
	return api.global.post<void>(`/api/v1/activity/${input.id}/${input.verb}`, {});
}

export function runActivityVerb() {
	function handleError(err: unknown, input: VerbInput) {
		toastStore.show({
			message: errorMessage(err, `Couldn't ${VERB_LABEL[input.verb]} ${input.title}`),
			type: 'error',
			action: { label: 'Retry', onClick: () => mutation.mutate(input) }
		});
	}
	const mutation = createMutation(() => ({
		mutationFn: verbRequest,
		onSuccess: () => void invalidateActivity(),
		onError: handleError
	}));
	return mutation;
}

interface DismissInput {
	id: string;
	what: string;
}

function dismissRequest(input: DismissInput) {
	return api.global.post<void>(`/api/v1/activity/attention/${input.id}/dismiss`, {});
}

export function dismissAttentionItem() {
	function handleError(err: unknown, input: DismissInput) {
		toastStore.show({
			message: errorMessage(err, `Couldn't dismiss ${input.what}`),
			type: 'error',
			action: { label: 'Retry', onClick: () => mutation.mutate(input) }
		});
	}
	const mutation = createMutation(() => ({
		mutationFn: dismissRequest,
		onSuccess: () => void invalidateActivity(),
		onError: handleError
	}));
	return mutation;
}
