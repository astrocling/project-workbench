import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeDatabaseUrl } from "./connection-string";
import { projectAssignmentHasSyncRoleFromFloatColumn } from "./projectAssignmentSyncColumn";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  basePrisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }
  const connectionString = normalizeDatabaseUrl(raw);
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

function getBasePrisma(): PrismaClient {
  if (!globalForPrisma.basePrisma) {
    globalForPrisma.basePrisma = createPrismaClient();
  }
  return globalForPrisma.basePrisma;
}

function stripSyncRoleFromData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if (!("syncRoleFromFloat" in data)) return data;
  const { syncRoleFromFloat: _removed, ...rest } = data as Record<string, unknown>;
  return rest;
}

/**
 * When the DB has not applied the `syncRoleFromFloat` migration, Prisma would still SELECT/INSERT
 * that column because it exists in the schema. We omit/strip it so reads and writes succeed until
 * `prisma migrate deploy` runs on this DATABASE_URL.
 */
function buildExtendedClient(): PrismaClient {
  const base = getBasePrisma();
  return base.$extends({
    query: {
      projectAssignment: {
        async $allOperations({ operation, args, query }) {
          const hasCol = await projectAssignmentHasSyncRoleFromFloatColumn(base);
          if (hasCol) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          const withOmitUnlessSelect = (x: Record<string, unknown>): Record<string, unknown> => {
            if (x.select) {
              return x;
            }
            return {
              ...x,
              omit: { ...((x.omit as Record<string, boolean>) ?? {}), syncRoleFromFloat: true },
            };
          };

          switch (operation) {
            case "findMany":
            case "findFirst":
            case "findUnique":
            case "findFirstOrThrow":
            case "findUniqueOrThrow":
              return query(withOmitUnlessSelect({ ...a }));
            case "create": {
              const next = {
                ...a,
                data: stripSyncRoleFromData(a.data),
              };
              return query(withOmitUnlessSelect(next));
            }
            case "update": {
              const next = {
                ...a,
                data: stripSyncRoleFromData(a.data),
              };
              return query(withOmitUnlessSelect(next));
            }
            case "upsert": {
              return query(
                withOmitUnlessSelect({
                  ...a,
                  create: stripSyncRoleFromData(a.create),
                  update: stripSyncRoleFromData(a.update),
                })
              );
            }
            case "createMany": {
              const data = a.data;
              if (Array.isArray(data)) {
                return query({
                  ...a,
                  data: data.map((row) => stripSyncRoleFromData(row)),
                });
              }
              return query(args);
            }
            case "updateMany": {
              return query({
                ...a,
                data: stripSyncRoleFromData(a.data),
              } as never);
            }
            case "createManyAndReturn": {
              const data = a.data;
              const next: Record<string, unknown> = { ...a };
              if (Array.isArray(data)) {
                next.data = data.map((row) => stripSyncRoleFromData(row));
              }
              return query(withOmitUnlessSelect(next));
            }
            default:
              return query(args);
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? buildExtendedClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
