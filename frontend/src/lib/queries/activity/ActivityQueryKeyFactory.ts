export const ActivityQueryKeyFactory = {
	all: ['activity'] as const,
	feed: () => [...ActivityQueryKeyFactory.all, 'feed'] as const
};
