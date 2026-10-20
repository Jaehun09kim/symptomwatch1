"use server";

import { refresh } from "next/cache";
import { ZodError } from "zod";
import { authorizeAction, AuthorizationError } from "@/lib/auth/current";
import type { AppContext } from "@/lib/authz/context";
import type { ImportKind } from "@/lib/import/fields";
import { ServiceError } from "@/lib/services/errors";
import { buildSampleExport, commitImport, previewImport, type ImportPreview, type ImportRequest, type ImportResult } from "@/lib/services/imports";

export type ImportActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function guarded<T>(fn: (ctx: AppContext) => Promise<T>, refreshAfter = false): Promise<ImportActionResult<T>> {
  try {
    const { ctx } = await authorizeAction("records.import");
    const data = await fn(ctx);
    if (refreshAfter) refresh();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ServiceError || error instanceof AuthorizationError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "The import request was incomplete. Choose a file and try again." };
    console.error("import action failed", error);
    return { ok: false, message: "Something went wrong. Nothing was imported — please try again." };
  }
}

export async function sampleExportAction(kind: ImportKind): Promise<ImportActionResult<{ filename: string; csv: string }>> {
  return guarded((ctx) => buildSampleExport(ctx, kind));
}

export async function previewImportAction(request: ImportRequest): Promise<ImportActionResult<ImportPreview>> {
  return guarded((ctx) => previewImport(ctx, request));
}

export async function commitImportAction(request: ImportRequest): Promise<ImportActionResult<ImportResult>> {
  return guarded((ctx) => commitImport(ctx, request), true);
}
