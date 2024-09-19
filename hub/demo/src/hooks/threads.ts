import { useCallback, useMemo } from 'react';

import { useAuthStore } from '~/stores/auth';
import { api, type RouterOutputs } from '~/trpc/react';

export type Thread = {
  agent: {
    name: string;
    namespace: string;
    version: string;
    url: string;
  };
  description: string;
  environments: RouterOutputs['hub']['entries'];
  environmentId: string;
  lastMessageAt: Date | null;
  messageCount: number;
  url: string;
};

export function useThreads() {
  const accountId = useAuthStore((store) => store.auth?.account_id);
  const utils = api.useUtils();

  const entriesQuery = api.hub.entries.useQuery(
    {
      category: 'environment',
      namespace: accountId,
    },
    {
      enabled: !!accountId,
    },
  );

  const setThreadEnvironmentData = useCallback(
    (id: number, data: Partial<RouterOutputs['hub']['entries'][number]>) => {
      const environments = [...(entriesQuery.data ?? [])].map((environment) => {
        if (environment.id === id) {
          return {
            ...environment,
            ...data,
          };
        }

        return environment;
      });

      utils.hub.entries.setData(
        {
          category: 'environment',
          namespace: accountId,
        },
        environments,
      );
    },
    [accountId, utils, entriesQuery.data],
  );

  const threads = useMemo(() => {
    const result: Thread[] = [];
    if (!accountId) return [];
    if (!entriesQuery.data) return;

    // If an environment has a nullish `base_id`, it's a parent (the start of a thread)
    const parents = entriesQuery.data.filter(
      (environment) => !environment.details.base_id,
    );
    const children = entriesQuery.data.filter(
      (environment) => !!environment.details.base_id,
    );

    for (const parent of parents) {
      const environments = followThread(children, parent);
      const firstEnvironment = environments[0];
      const lastEnvironment = environments.at(-1);

      if (firstEnvironment && lastEnvironment) {
        const environmentId = `${accountId}/${lastEnvironment.name}/${lastEnvironment.version}`;
        const name = lastEnvironment.details.primary_agent_name;
        const namespace = lastEnvironment.details.primary_agent_namespace;
        const version = lastEnvironment.details.primary_agent_version;

        if (!name || !namespace || !version) continue;

        const agentUrl = `/agents/${namespace}/${name}/${version}`;
        const threadUrl = `${agentUrl}/run?environmentId=${encodeURIComponent(environmentId)}`;

        let description = firstEnvironment.description;
        if (description.startsWith('Agent remote run')) {
          description = name;
        }

        result.push({
          agent: {
            name,
            namespace,
            version,
            url: agentUrl,
          },
          description,
          environments,
          environmentId,
          lastMessageAt: lastEnvironment.details.timestamp
            ? new Date(lastEnvironment.details.timestamp)
            : null,
          messageCount: environments.length,
          url: threadUrl,
        });
      }
    }

    return result;
  }, [accountId, entriesQuery.data]);

  return {
    setThreadEnvironmentData,
    threads,
    threadsQuery: entriesQuery,
  };
}

function followThread(
  children: RouterOutputs['hub']['entries'],
  current: RouterOutputs['hub']['entries'][number],
  result: RouterOutputs['hub']['entries'] = [],
) {
  result.push(current);

  const next = children.find(
    (c) =>
      current.details.run_id &&
      c.details.base_id?.includes(current.details.run_id),
  );

  if (next) {
    followThread(children, next, result);
    return result;
  }

  return result;
}
