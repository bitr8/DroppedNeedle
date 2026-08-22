import { createQuery, queryOptions } from '@tanstack/svelte-query';

import { api } from '$lib/api/client';

import { ActivityQueryKeyFactory } from './ActivityQueryKeyFactory';
import type { ActivityResponse } from './types';

// Not routed through $lib/constants API map — activity/** is the only surface
// allowed to touch this task; keep the path local instead of editing shared constants.
const ACTIVITY_PATH = '/api/v1/activity';
const POLL_MS = 5000;

const activityQueryOptions = () =>
	queryOptions({
		staleTime: 0,
		queryKey: ActivityQueryKeyFactory.feed(),
		queryFn: ({ signal }) => api.global.get<ActivityResponse>(ACTIVITY_PATH, { signal }),
		refetchInterval: POLL_MS,
		refetchIntervalInBackground: false
	});

export const getActivityQuery = () => createQuery(() => activityQueryOptions());
