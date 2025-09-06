import { cleanNotifications, showNotification } from "@mantine/notifications";
import queryClient from "@/apis/queries";
import { QueryKeys } from "@/apis/queries/keys";
import api from "@/apis/raw";
import { notification, task } from "@/modules/task";
import { LOG } from "@/utilities/console";
import { setCriticalError, setOnlineStatus } from "@/utilities/event";

export function createDefaultReducer(): SocketIO.Reducer[] {
  return [
    {
      key: "connect",
      any: () => setOnlineStatus(true),
    },
    {
      key: "connect_error",
      any: () => {
        setCriticalError("Cannot connect to backend");
        cleanNotifications();
      },
    },
    {
      key: "disconnect",
      any: () => setOnlineStatus(false),
    },
    {
      key: "message",
      update: (msg) => {
        msg
          .map((message) => notification.info("Notification", message))
          .forEach((data) => showNotification(data));
      },
    },
    {
      key: "progress",
      update: task.updateProgress.bind(task),
      delete: task.removeProgress.bind(task),
    },
    {
      key: "series",
      update: (ids) => {
        LOG("info", "Invalidating series", ids);
        ids.forEach((id) => {
          void queryClient.invalidateQueries({
            queryKey: [QueryKeys.Series, id],
          });
        });
      },
      delete: (ids) => {
        LOG("info", "Invalidating series", ids);
        ids.forEach((id) => {
          void queryClient.invalidateQueries({
            queryKey: [QueryKeys.Series, id],
          });
        });
      },
    },
    {
      key: "movie",
      update: (ids) => {
        LOG("info", "Invalidating movies", ids);
        ids.forEach((id) => {
          void queryClient.invalidateQueries({
            queryKey: [QueryKeys.Movies, id],
          });
        });
      },
      delete: (ids) => {
        LOG("info", "Invalidating movies", ids);
        ids.forEach((id) => {
          void queryClient.invalidateQueries({
            queryKey: [QueryKeys.Movies, id],
          });
        });
      },
    },
    {
      key: "episode",
      update: (ids) => {
        // Currently invalidate episodes is impossible because we don't directly fetch episodes (we fetch episodes by series id)
        // So we need to invalidate series instead
        // TODO: Make a query for episodes and invalidate that instead
        LOG("info", "Invalidating episodes", ids);
        ids.forEach((id) => {
          const episode = queryClient.getQueryData<Item.Episode>([
            QueryKeys.Episodes,
            id,
          ]);
          if (episode !== undefined) {
            void queryClient.invalidateQueries({
              queryKey: [QueryKeys.Series, episode.sonarrSeriesId],
            });
          }
        });
      },
      delete: (ids) => {
        LOG("info", "Invalidating episodes", ids);
        ids.forEach((id) => {
          const episode = queryClient.getQueryData<Item.Episode>([
            QueryKeys.Episodes,
            id,
          ]);
          if (episode !== undefined) {
            void queryClient.invalidateQueries({
              queryKey: [QueryKeys.Series, episode.sonarrSeriesId],
            });
          }
        });
      },
    },
    {
      key: "episode-wanted",
      update: () => {
        // Find a better way to update wanted
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Episodes, QueryKeys.Wanted],
        });
      },
      delete: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Episodes, QueryKeys.Wanted],
        });
      },
    },
    {
      key: "movie-wanted",
      update: () => {
        // Find a better way to update wanted
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Movies, QueryKeys.Wanted],
        });
      },
      delete: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Movies, QueryKeys.Wanted],
        });
      },
    },
    {
      key: "settings",
      any: () => {
        void queryClient.invalidateQueries({ queryKey: [QueryKeys.System] });
      },
    },
    {
      key: "languages",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.System, QueryKeys.Languages],
        });
      },
    },
    {
      key: "badges",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.System, QueryKeys.Badges],
        });
      },
    },
    {
      key: "movie-history",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Movies, QueryKeys.History],
        });
      },
    },
    {
      key: "movie-blacklist",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Movies, QueryKeys.Blacklist],
        });
      },
    },
    {
      key: "episode-history",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Episodes, QueryKeys.History],
        });
      },
    },
    {
      key: "episode-blacklist",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Episodes, QueryKeys.Blacklist],
        });
      },
    },
    {
      key: "reset-episode-wanted",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Episodes, QueryKeys.Wanted],
        });
      },
    },
    {
      key: "reset-movie-wanted",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.Movies, QueryKeys.Wanted],
        });
      },
    },
    {
      key: "task",
      any: () => {
        void queryClient.invalidateQueries({
          queryKey: [QueryKeys.System, QueryKeys.Tasks],
        });
      },
    },
    {
      key: "jobs",
      update: (ids) => {
        ids.forEach((id) => {
          // Update only the specified job id in the jobs list cache
          LOG("info", "Updating single job (partial)", id);
          const idNum = id as number;

          if (Number.isNaN(idNum)) {
            LOG("warning", "Invalid job id in SocketIO payload", id);
            return;
          }

          void api.system
            .jobs(idNum)
            .then((resp: LooseObject[] | undefined) => {
              const incomingJobs = Array.isArray(resp) ? resp : [];
              if (incomingJobs.length === 0) {
                return;
              }
              const incoming = incomingJobs[0];

              const key = [QueryKeys.System, QueryKeys.Jobs] as const;
              const current =
                queryClient.getQueryData<LooseObject[]>(key) || [];

              const idx = current.findIndex(
                (j) => j.job_id === incoming.job_id,
              );
              const next =
                idx >= 0
                  ? [
                      ...current.slice(0, idx),
                      { ...current[idx], ...incoming },
                      ...current.slice(idx + 1),
                    ]
                  : [...current, incoming];

              queryClient.setQueryData(key, next);
            })
            .catch((e: unknown) => {
              LOG("warning", "Failed to fetch job update", id, e);
            });
        });
      },
    },
  ];
}
