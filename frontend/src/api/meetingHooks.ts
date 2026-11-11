import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { i18n } from "../i18n";
import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews, settleSave } from "./hooks";
import { notifyError } from "./notifyError";

export type Meeting = Schemas["MeetingOut"];
export type MeetingKind = Schemas["MeetingIn"]["kind"];

export const MEETING_KINDS = [
  { value: "call", key: "calls:kinds.call" },
  { value: "video", key: "calls:kinds.video" },
  { value: "in_person", key: "calls:kinds.in_person" },
] as const satisfies readonly { value: NonNullable<MeetingKind>; key: string }[];

export interface MeetingFilters {
  contact_id?: string;
  agency_id?: string;
  company_id?: string;
  application_id?: string;
}

/** Calls and meetings, soonest first. */
export function useMeetings(filters: MeetingFilters, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["meetings", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/meetings", { params: { query: filters } })),
  });
}

function useRefreshMeetings() {
  const qc = useQueryClient();
  return () => {
    // A call about an application also changes that application: a move goes on its timeline. A
    // to-do to book a new time can be made or ticked off too.
    invalidateApplicationViews(qc);
    void qc.invalidateQueries({ queryKey: ["search"] });
  };
}

/** Mark a booked call as needing a new time; with `todo`, its to-do is made in this same request. */
export function useMarkCallNeedsNewTime() {
  const refresh = useRefreshMeetings();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["NeedsNewTimeIn"] }) =>
      unwrap(
        await api.POST("/api/v1/meetings/{meeting_id}/needs-new-time", {
          params: { path: { meeting_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

const keepOldTime = async (id: string) =>
  unwrap(
    await api.DELETE("/api/v1/meetings/{meeting_id}/needs-new-time", {
      params: { path: { meeting_id: id } },
    }),
  );

/** The call keeps its old time after all, or the mark is undone: deletes the mark's to-do if unchanged. */
export function useKeepCallOldTime() {
  const refresh = useRefreshMeetings();
  return useMutation({ mutationFn: keepOldTime, onSuccess: refresh, onError: notifyError });
}

/** The same as a plain function, for an Undo toast that outlives its dialog. */
export function useUndoCallNeedsNewTime() {
  const refresh = useRefreshMeetings();
  return (id: string) => keepOldTime(id).then(refresh, (error: unknown) => notifyError(error as Error));
}

export function useSaveMeeting() {
  const refresh = useRefreshMeetings();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      args: { id: string; body: Schemas["MeetingPatch"] } | { body: Schemas["MeetingIn"] },
    ) =>
      "id" in args
        ? unwrap(
            await api.PATCH("/api/v1/meetings/{meeting_id}", {
              params: { path: { meeting_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(await api.POST("/api/v1/meetings", { body: args.body })),
    // Edit opens from a list of calls.
    onSuccess: (saved, args) =>
      "id" in args ? settleSave(qc, refresh, saved, { store: [["meetings"]] }) : refresh(),
    onError: notifyError,
  });
}

export function useDeleteMeeting() {
  const refresh = useRefreshMeetings();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/meetings/{meeting_id}", {
        params: { path: { meeting_id: id } },
      });
      if (error) throw new Error(i18n.t("errors:own.deleteCall"));
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
