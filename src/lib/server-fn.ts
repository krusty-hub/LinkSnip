import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getAllLinks,
  getLinkByCode,
  createLink,
  deleteLink,
  isAliasTaken,
  getLinkAnalytics,
  getWorkspaceAnalytics,
  type LinkRecord,
} from "./db";

export const getWorkspaceData = createServerFn({ method: "GET" }).handler(async () => {
  const links = getAllLinks();
  const analytics = getWorkspaceAnalytics(30);
  return {
    links,
    analytics,
  };
});

export const getLinks = createServerFn({ method: "GET" }).handler(async () => {
  return getAllLinks();
});

export const getLinkDetails = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    return z.object({ code: z.string() }).parse(data);
  })
  .handler(async ({ data }) => {
    const link = getLinkByCode(data.code);
    if (!link) return null;
    const analytics = getLinkAnalytics(data.code, 30);
    return {
      link,
      analytics,
    };
  });

export const checkAliasAvailability = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    return z.object({ alias: z.string() }).parse(data);
  })
  .handler(async ({ data }) => {
    return {
      taken: isAliasTaken(data.alias),
    };
  });

const CreateLinkSchema = z.object({
  longUrl: z.string().url("Must be a valid URL"),
  alias: z.string().optional(),
  expiresAt: z.string().nullable().optional(),
});

export const createShortLink = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    return CreateLinkSchema.parse(data);
  })
  .handler(async ({ data }) => {
    const result = createLink({
      longUrl: data.longUrl,
      alias: data.alias || undefined,
      expiresAt: data.expiresAt || null,
    });
    return result;
  });

export const removeShortLink = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    return z.object({ code: z.string() }).parse(data);
  })
  .handler(async ({ data }) => {
    const success = deleteLink(data.code);
    return { success };
  });
