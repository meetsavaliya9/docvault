import "server-only";
import { Prisma } from "@prisma/client";
import { getAdminEmails } from "@/lib/auth/admin";
import { logSafeServerError } from "@/lib/auth/errorDiagnostics";
import { prisma } from "@/lib/prisma";

export async function getManagerWorkspaceStats(permissions) {
  const showUsers = permissions.VIEW_USERS === true;
  const showFiles = permissions.VIEW_USER_FILES === true;
  if (!showUsers && !showFiles) return { userCount: null, fileCount: null };

  const adminEmails = getAdminEmails();
  const usersWhere = {
    role: "USER",
    ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
  };
  const counts = await Promise.all([
    showUsers ? prisma.user.count({ where: usersWhere }) : Promise.resolve(null),
    showFiles
      ? prisma.document.count({
          where: {
            user: {
              is: {
                role: "USER",
                ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
              },
            },
            deleted: false,
          },
        })
      : Promise.resolve(null),
  ]);

  return { userCount: counts[0], fileCount: counts[1] };
}

function getReportWindow() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return { now, monthStart };
}

function getUserScope() {
  const adminEmails = getAdminEmails();
  return {
    role: "USER",
    ...(adminEmails.length ? { email: { notIn: adminEmails } } : {}),
  };
}

function getDocumentScope() {
  return {
    user: { is: getUserScope() },
    deleted: false,
  };
}

function getPaymentScope() {
  return { user: { is: getUserScope() } };
}

function getSubscriptionScope() {
  return { user: { is: getUserScope() } };
}

function getActiveSubscriptionWhere(now) {
  return {
    status: { in: ["active", "trialing"] },
    AND: [
      { OR: [{ endDate: null }, { endDate: { gt: now } }] },
      { OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] },
    ],
  };
}

function toNumber(value) {
  return Number(value || 0);
}

async function getUserReports(userScope, monthStart, now, canViewSubscriptions) {
  const adminEmails = getAdminEmails();
  const registrationEmailFilter = adminEmails.length
    ? Prisma.sql`AND email NOT IN (${Prisma.join(adminEmails)})`
    : Prisma.empty;
  const planEmailFilter = adminEmails.length
    ? Prisma.sql`AND u.email NOT IN (${Prisma.join(adminEmails)})`
    : Prisma.empty;
  const [totalUsers, activeUsers, registrations, usersByPlan] = await Promise.all([
    prisma.user.count({ where: userScope }),
    prisma.user.count({ where: { ...userScope, isBlocked: false } }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(createdAt, '%Y-%m') AS month, COUNT(*) AS count
      FROM \`User\`
      WHERE role = 'USER' ${registrationEmailFilter} AND createdAt >= ${monthStart}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month ASC
    `,
    canViewSubscriptions ? prisma.$queryRaw`
      SELECT COALESCE(p.name, s.planKey, 'Free') AS plan, COUNT(*) AS count
      FROM \`User\` u
      LEFT JOIN \`Subscription\` s
        ON s.userId = u.id
        AND s.status IN ('active', 'trialing')
        AND (s.endDate IS NULL OR s.endDate > ${now})
        AND (s.currentPeriodEnd IS NULL OR s.currentPeriodEnd > ${now})
        AND NOT EXISTS (
          SELECT 1
          FROM \`Subscription\` newer
          WHERE newer.userId = s.userId
            AND newer.status IN ('active', 'trialing')
            AND (newer.endDate IS NULL OR newer.endDate > ${now})
            AND (newer.currentPeriodEnd IS NULL OR newer.currentPeriodEnd > ${now})
            AND (
              newer.createdAt > s.createdAt
              OR (newer.createdAt = s.createdAt AND newer.id > s.id)
            )
        )
      LEFT JOIN \`SubscriptionPlan\` p ON p.id = s.planId
      WHERE u.role = 'USER' ${planEmailFilter}
      GROUP BY COALESCE(p.name, s.planKey, 'Free')
      ORDER BY count DESC, plan ASC
    ` : Promise.resolve([]),
  ]);

  return {
    totalUsers,
    activeUsers,
    registrations: registrations.map((row) => ({
      month: row.month,
      count: toNumber(row.count),
    })),
    usersByPlan: canViewSubscriptions
      ? usersByPlan.map((row) => ({
          plan: row.plan,
          count: toNumber(row.count),
        }))
      : null,
  };
}

async function getFileReports(monthStart) {
  const scope = getDocumentScope();
  const adminEmails = getAdminEmails();
  const emailFilter = adminEmails.length
    ? Prisma.sql`AND u.email NOT IN (${Prisma.join(adminEmails)})`
    : Prisma.empty;
  const [totalFiles, size, byType, uploads, largestOwners] = await Promise.all([
    prisma.document.count({ where: scope }),
    prisma.document.aggregate({ where: scope, _sum: { rawBytes: true } }),
    prisma.document.groupBy({
      by: ["type"],
      where: scope,
      _count: { _all: true },
      orderBy: { _count: { type: "desc" } },
    }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(d.createdAt, '%Y-%m') AS month, COUNT(*) AS count
      FROM \`Document\` d
      INNER JOIN \`User\` u ON u.id = d.userId
      WHERE d.deleted = false AND d.createdAt >= ${monthStart}
        AND u.role = 'USER' ${emailFilter}
      GROUP BY DATE_FORMAT(d.createdAt, '%Y-%m')
      ORDER BY month ASC
    `,
    prisma.document.groupBy({
      by: ["userId"],
      where: scope,
      _count: { _all: true },
      _sum: { rawBytes: true },
      orderBy: { _sum: { rawBytes: "desc" } },
      take: 10,
    }),
  ]);
  const ownerIds = largestOwners.map(({ userId }) => userId);
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds }, ...getUserScope() },
        select: { id: true, name: true, email: true },
      })
    : [];
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return {
    totalFiles,
    totalBytes: toNumber(size._sum.rawBytes),
    byType: byType.map((row) => ({
      type: row.type || "Unknown",
      count: row._count._all,
    })),
    uploads: uploads.map((row) => ({
      month: row.month,
      count: toNumber(row.count),
    })),
    largestOwners: largestOwners
      .map((row) => ({
        user: ownerById.get(row.userId),
        count: row._count._all,
        bytes: toNumber(row._sum.rawBytes),
      }))
      .filter((row) => row.user),
  };
}

async function getSubscriptionReports(now) {
  const scope = getSubscriptionScope();
  const activeWhere = {
    ...scope,
    ...getActiveSubscriptionWhere(now),
  };
  const [activeSubscriptions, byStatus, expiredSubscriptions, activeByPlan] = await Promise.all([
    prisma.subscription.count({ where: activeWhere }),
    prisma.subscription.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.subscription.groupBy({
      by: ["status"],
      where: {
        ...scope,
        status: { in: ["active", "trialing"] },
        AND: [
          {
            OR: [
              { endDate: { lte: now } },
              { currentPeriodEnd: { lte: now } },
            ],
          },
        ],
      },
      _count: { _all: true },
    }),
    prisma.subscription.groupBy({
      by: ["planId", "planKey"],
      where: activeWhere,
      _count: { _all: true },
      orderBy: { _count: { planKey: "desc" } },
    }),
  ]);
  const planIds = activeByPlan.map(({ planId }) => planId).filter(Boolean);
  const plans = planIds.length
    ? await prisma.subscriptionPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true },
      })
    : [];
  const plansById = new Map(plans.map((plan) => [plan.id, plan.name]));
  const expiredByStatus = new Map(
    expiredSubscriptions.map((row) => [row.status, row._count._all]),
  );
  const expiredTotal = [...expiredByStatus.values()].reduce((sum, count) => sum + count, 0);
  const statusCounts = byStatus.map((row) => {
    const count = row._count._all;
    if (!["active", "trialing"].includes(row.status)) {
      return { status: row.status || "Unknown", count };
    }
    const expiredCount = expiredByStatus.get(row.status) || 0;
    return { status: row.status, count: count - expiredCount };
  }).filter((row) => row.count > 0);
  if (expiredTotal > 0) {
    statusCounts.push({ status: "expired", count: expiredTotal });
  }

  return {
    activeSubscriptions,
    byStatus: statusCounts,
    activeByPlan: activeByPlan.map((row) => ({
      plan: plansById.get(row.planId) || row.planKey || "Unknown",
      count: row._count._all,
    })),
  };
}

async function getPaymentReports(monthStart) {
  const scope = getPaymentScope();
  const adminEmails = getAdminEmails();
  const emailFilter = adminEmails.length
    ? Prisma.sql`AND u.email NOT IN (${Prisma.join(adminEmails)})`
    : Prisma.empty;
  const verifiedWhere = {
    ...scope,
    status: { in: ["SUCCESS", "REFUNDED"] },
    amountPaid: { gt: 0 },
  };
  const [byStatus, byCurrency, byPlan, paymentTrend] = await Promise.all([
    prisma.payment.groupBy({
      by: ["status"],
      where: scope,
      _count: { _all: true },
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: verifiedWhere,
      _count: { _all: true },
      _sum: { amountPaid: true, refundedAmount: true },
      orderBy: { currency: "asc" },
    }),
    prisma.payment.groupBy({
      by: ["planId", "planName", "plan", "currency"],
      where: verifiedWhere,
      _count: { _all: true },
      _sum: { amountPaid: true, refundedAmount: true },
      orderBy: { _sum: { amountPaid: "desc" } },
      take: 10,
    }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(p.createdAt, '%Y-%m') AS month, p.currency,
        COUNT(*) AS count,
        SUM(CASE WHEN p.status IN ('SUCCESS', 'REFUNDED') AND p.amountPaid > 0 THEN p.amountPaid ELSE 0 END) AS gross,
        SUM(CASE WHEN p.status IN ('SUCCESS', 'REFUNDED') AND p.amountPaid > 0 THEN p.refundedAmount ELSE 0 END) AS refunded,
        SUM(CASE WHEN p.status IN ('SUCCESS', 'REFUNDED') AND p.amountPaid > 0 THEN 1 ELSE 0 END) AS verifiedCount
      FROM \`Payment\` p
      INNER JOIN \`User\` u ON u.id = p.userId
      WHERE p.createdAt >= ${monthStart} AND u.role = 'USER' ${emailFilter}
      GROUP BY DATE_FORMAT(p.createdAt, '%Y-%m'), p.currency
      ORDER BY month ASC, p.currency ASC
    `,
  ]);

  return {
    byStatus: byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    byCurrency: byCurrency.map((row) => ({
      currency: row.currency,
      count: row._count._all,
      gross: toNumber(row._sum.amountPaid),
      refunded: toNumber(row._sum.refundedAmount),
      net: toNumber(row._sum.amountPaid) - toNumber(row._sum.refundedAmount),
    })),
    byPlan: byPlan.map((row) => ({
      plan: row.planName || row.plan || row.planId || "Unknown",
      currency: row.currency,
      count: row._count._all,
      gross: toNumber(row._sum.amountPaid),
      refunded: toNumber(row._sum.refundedAmount),
      net: toNumber(row._sum.amountPaid) - toNumber(row._sum.refundedAmount),
    })),
    trend: paymentTrend.map((row) => ({
      month: row.month,
      currency: row.currency,
      count: toNumber(row.count),
      gross: toNumber(row.gross),
      refunded: toNumber(row.refunded),
      verifiedCount: toNumber(row.verifiedCount),
    })),
  };
}

export async function getManagerOverallReport(permissions) {
  const { now, monthStart } = getReportWindow();
  const [users, files, subscriptions, payments] = await Promise.all([
    permissions.VIEW_USERS === true
      ? getUserReports(
          getUserScope(),
          monthStart,
          now,
          permissions.VIEW_SUBSCRIPTIONS === true,
        )
      : null,
    permissions.VIEW_USER_FILES === true
      ? getFileReports(monthStart)
      : null,
    permissions.VIEW_SUBSCRIPTIONS === true
      ? getSubscriptionReports(now)
      : null,
    permissions.VIEW_PAYMENTS === true
      ? getPaymentReports(monthStart)
      : null,
  ]);

  return { users, files, subscriptions, payments };
}

const DASHBOARD_RANGES = ["today", "7d", "30d", "month", "all"];
const VERIFIED_PAYMENT_STATUSES = ["SUCCESS", "REFUNDED"];

function getDashboardRange(range, now) {
  const key = DASHBOARD_RANGES.includes(range) ? range : "30d";
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (key === "7d") start.setUTCDate(start.getUTCDate() - 6);
  if (key === "30d") start.setUTCDate(start.getUTCDate() - 29);
  if (key === "month") start.setUTCDate(1);
  return {
    key,
    start: key === "all" ? null : start,
  };
}

function createdAtRange(start, now) {
  return { createdAt: { ...(start ? { gte: start } : {}), lte: now } };
}

function getTrendExpression(field, start) {
  const format = start
    ? Prisma.raw("'%Y-%m-%d'")
    : Prisma.raw("'%Y-%m'");
  const column = {
    user: Prisma.sql`createdAt`,
    document: Prisma.sql`d.createdAt`,
    payment: Prisma.sql`p.createdAt`,
  }[field];
  if (!column) {
    throw new Error(`Unsupported dashboard trend field: ${field}`);
  }
  return Prisma.sql`DATE_FORMAT(${column}, ${format})`;
}

async function runDashboardSection(name, load) {
  try {
    return await load();
  } catch (error) {
    logSafeServerError(`Manager dashboard ${name} query failed`, error);
    throw error;
  }
}

function normalizeCurrencyGroups(rows) {
  return rows.map((row) => {
    const gross = toNumber(row._sum.amountPaid);
    const refunded = toNumber(row._sum.refundedAmount);
    return {
      currency: row.currency || "INR",
      count: row._count._all,
      gross,
      refunded,
      net: gross - refunded,
    };
  });
}

async function getDashboardUsers(start, now, canViewSubscriptions) {
  const scope = getUserScope();
  const emailFilter = getAdminEmails();
  const registrationFilter = emailFilter.length
    ? Prisma.sql`AND email NOT IN (${Prisma.join(emailFilter)})`
    : Prisma.empty;
  const trendExpression = getTrendExpression("user", start);
  const trendStart = start ? Prisma.sql`AND createdAt >= ${start}` : Prisma.empty;
  const [total, active, newToday, newThisMonth, selectedNew, trend, recent, planRows] =
    await Promise.all([
      prisma.user.count({ where: scope }),
      prisma.user.count({ where: { ...scope, isBlocked: false } }),
      prisma.user.count({
        where: { ...scope, createdAt: { gte: utcStartOfDay(now), lte: now } },
      }),
      prisma.user.count({
        where: { ...scope, createdAt: { gte: utcStartOfMonth(now), lte: now } },
      }),
      prisma.user.count({
        where: { ...scope, ...createdAtRange(start, now) },
      }),
      prisma.$queryRaw`
        SELECT ${trendExpression} AS period, COUNT(*) AS count
        FROM \`User\`
        WHERE role = 'USER' ${registrationFilter} ${trendStart}
          AND createdAt <= ${now}
        GROUP BY ${trendExpression}
        ORDER BY period ASC
      `,
      prisma.user.findMany({
        where: { ...scope, ...createdAtRange(start, now) },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          ...(canViewSubscriptions
            ? {
                subscriptions: {
                  where: getActiveSubscriptionWhere(now),
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    planKey: true,
                    plan: { select: { name: true } },
                  },
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      canViewSubscriptions
        ? prisma.$queryRaw`
            SELECT COALESCE(p.name, s.planKey, 'Free') AS plan, COUNT(*) AS count
            FROM \`User\` u
            LEFT JOIN \`Subscription\` s
              ON s.userId = u.id
              AND s.status IN ('active', 'trialing')
              AND (s.endDate IS NULL OR s.endDate > ${now})
              AND (s.currentPeriodEnd IS NULL OR s.currentPeriodEnd > ${now})
              AND NOT EXISTS (
                SELECT 1
                FROM \`Subscription\` newer
                WHERE newer.userId = s.userId
                  AND newer.status IN ('active', 'trialing')
                  AND (newer.endDate IS NULL OR newer.endDate > ${now})
                  AND (newer.currentPeriodEnd IS NULL OR newer.currentPeriodEnd > ${now})
                  AND (
                    newer.createdAt > s.createdAt
                    OR (newer.createdAt = s.createdAt AND newer.id > s.id)
                  )
              )
            LEFT JOIN \`SubscriptionPlan\` p ON p.id = s.planId
            WHERE u.role = 'USER' ${registrationFilter}
            GROUP BY COALESCE(p.name, s.planKey, 'Free')
            ORDER BY count DESC, plan ASC
          `
        : Promise.resolve(null),
    ]);

  return {
    total,
    active,
    newToday,
    newThisMonth,
    selectedNew,
    trend: trend.map((row) => ({ period: row.period, count: toNumber(row.count) })),
    byPlan: planRows?.map((row) => ({
      plan: row.plan,
      count: toNumber(row.count),
    })) ?? null,
    recent: recent.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      plan: canViewSubscriptions
        ? user.subscriptions?.[0]?.plan?.name || user.subscriptions?.[0]?.planKey || "Free"
        : null,
    })),
  };
}

function utcStartOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcStartOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function getDashboardFiles(start, now) {
  const scope = getDocumentScope();
  const adminEmails = getAdminEmails();
  const emailFilter = adminEmails.length
    ? Prisma.sql`AND u.email NOT IN (${Prisma.join(adminEmails)})`
    : Prisma.empty;
  const trendExpression = getTrendExpression("document", start);
  const trendStart = start ? Prisma.sql`AND d.createdAt >= ${start}` : Prisma.empty;
  const [total, storage, selectedCount, uploadedToday, uploadedThisMonth, byType, trend, recent, largestOwners] =
    await Promise.all([
      prisma.document.count({ where: scope }),
      prisma.document.aggregate({ where: scope, _sum: { rawBytes: true } }),
      prisma.document.count({
        where: { ...scope, ...createdAtRange(start, now) },
      }),
      prisma.document.count({
        where: { ...scope, createdAt: { gte: utcStartOfDay(now), lte: now } },
      }),
      prisma.document.count({
        where: { ...scope, createdAt: { gte: utcStartOfMonth(now), lte: now } },
      }),
      prisma.document.groupBy({
        by: ["type"],
        where: { ...scope, ...createdAtRange(start, now) },
        _count: { _all: true },
        orderBy: { _count: { type: "desc" } },
      }),
      prisma.$queryRaw`
        SELECT ${trendExpression} AS period, COUNT(*) AS count
        FROM \`Document\` d
        INNER JOIN \`User\` u ON u.id = d.userId
        WHERE d.deleted = false ${trendStart} AND d.createdAt <= ${now}
          AND u.role = 'USER' ${emailFilter}
        GROUP BY ${trendExpression}
        ORDER BY period ASC
      `,
      prisma.document.findMany({
        where: { ...scope, ...createdAtRange(start, now) },
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          rawBytes: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.document.groupBy({
        by: ["userId"],
        where: scope,
        _count: { _all: true },
        _sum: { rawBytes: true },
        orderBy: { _sum: { rawBytes: "desc" } },
        take: 5,
      }),
    ]);
  const ownerIds = largestOwners.map((row) => row.userId);
  const owners = ownerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ownerIds }, ...getUserScope() },
        select: { id: true, name: true, email: true },
      })
    : [];
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return {
    total,
    totalBytes: toNumber(storage._sum.rawBytes),
    selectedCount,
    uploadedToday,
    uploadedThisMonth,
    byType: byType.map((row) => ({
      type: row.type || "Unknown",
      count: row._count._all,
    })),
    trend: trend.map((row) => ({ period: row.period, count: toNumber(row.count) })),
    recent,
    largestOwners: largestOwners
      .map((row) => ({
        user: ownerById.get(row.userId),
        count: row._count._all,
        bytes: toNumber(row._sum.rawBytes),
      }))
      .filter((row) => row.user),
  };
}

async function getDashboardPayments(start, now, includeRevenue) {
  const scope = getPaymentScope();
  const paymentRange = createdAtRange(start, now);
  const verifiedWhere = {
    ...scope,
    ...paymentRange,
    status: { in: VERIFIED_PAYMENT_STATUSES },
    amountPaid: { gt: 0 },
  };
  const adminEmails = getAdminEmails();
  const emailFilter = adminEmails.length
    ? Prisma.sql`AND u.email NOT IN (${Prisma.join(adminEmails)})`
    : Prisma.empty;
  const trendExpression = getTrendExpression("payment", start);
  const trendStart = start ? Prisma.sql`AND p.createdAt >= ${start}` : Prisma.empty;
  const [totalSuccess, successfulToday, successfulThisMonth, lifetimeRevenue, rangeRevenue,
    revenueToday, revenueThisMonth, statusRows, trendRows, recent] = await Promise.all([
      prisma.payment.count({
        where: { ...scope, status: { in: VERIFIED_PAYMENT_STATUSES }, amountPaid: { gt: 0 } },
      }),
      prisma.payment.count({
        where: {
          ...scope,
          createdAt: { gte: utcStartOfDay(now), lte: now },
          status: { in: VERIFIED_PAYMENT_STATUSES },
          amountPaid: { gt: 0 },
        },
      }),
      prisma.payment.count({
        where: {
          ...scope,
          createdAt: { gte: utcStartOfMonth(now), lte: now },
          status: { in: VERIFIED_PAYMENT_STATUSES },
          amountPaid: { gt: 0 },
        },
      }),
      prisma.payment.groupBy({
        by: ["currency"],
        where: {
          ...scope,
          status: { in: VERIFIED_PAYMENT_STATUSES },
          amountPaid: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { amountPaid: true, refundedAmount: true },
      }),
      prisma.payment.groupBy({
        by: ["currency"],
        where: verifiedWhere,
        _count: { _all: true },
        _sum: { amountPaid: true, refundedAmount: true },
      }),
      prisma.payment.groupBy({
        by: ["currency"],
        where: {
          ...scope,
          createdAt: { gte: utcStartOfDay(now), lte: now },
          status: { in: VERIFIED_PAYMENT_STATUSES },
          amountPaid: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { amountPaid: true, refundedAmount: true },
      }),
      prisma.payment.groupBy({
        by: ["currency"],
        where: {
          ...scope,
          createdAt: { gte: utcStartOfMonth(now), lte: now },
          status: { in: VERIFIED_PAYMENT_STATUSES },
          amountPaid: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { amountPaid: true, refundedAmount: true },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        where: { ...scope, ...paymentRange },
        _count: { _all: true },
      }),
      prisma.$queryRaw`
        SELECT ${trendExpression} AS period, p.currency,
          COUNT(*) AS count,
          SUM(CASE WHEN p.status IN ('SUCCESS', 'REFUNDED') AND p.amountPaid > 0
            THEN p.amountPaid ELSE 0 END) AS gross,
          SUM(CASE WHEN p.status IN ('SUCCESS', 'REFUNDED') AND p.amountPaid > 0
            THEN p.refundedAmount ELSE 0 END) AS refunded
        FROM \`Payment\` p
        INNER JOIN \`User\` u ON u.id = p.userId
        WHERE 1 = 1 ${trendStart} AND p.createdAt <= ${now}
          AND u.role = 'USER' ${emailFilter}
        GROUP BY ${trendExpression}, p.currency
        ORDER BY period ASC, p.currency ASC
      `,
      prisma.payment.findMany({
        where: { ...scope, ...paymentRange },
        select: {
          id: true,
          razorpayPaymentId: true,
          razorpayOrderId: true,
          plan: true,
          planName: true,
          amountPaid: true,
          refundedAmount: true,
          currency: true,
          status: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
  const selectedStatusCounts = Object.fromEntries(
    statusRows.map((row) => [row.status, row._count._all]),
  );

  return {
    totalSuccess,
    successfulToday,
    successfulThisMonth,
    revenueToday: normalizeCurrencyGroups(revenueToday),
    revenueThisMonth: normalizeCurrencyGroups(revenueThisMonth),
    pending: selectedStatusCounts.PENDING || 0,
    failed: selectedStatusCounts.FAILED || 0,
    selectedStatusCounts,
    lifetimeRevenue: normalizeCurrencyGroups(lifetimeRevenue),
    rangeRevenue: normalizeCurrencyGroups(rangeRevenue),
    trend: trendRows.map((row) => ({
      period: row.period,
      currency: row.currency || "INR",
      count: toNumber(row.count),
      gross: toNumber(row.gross),
      refunded: toNumber(row.refunded),
      net: toNumber(row.gross) - toNumber(row.refunded),
    })),
    byPlan: includeRevenue
      ? await prisma.payment.groupBy({
          by: ["planId", "planName", "plan", "currency"],
          where: verifiedWhere,
          _count: { _all: true },
          _sum: { amountPaid: true, refundedAmount: true },
          orderBy: { _sum: { amountPaid: "desc" } },
          take: 8,
        }).then((rows) => rows.map((row) => ({
          plan: row.planName || row.plan || row.planId || "Unknown",
          currency: row.currency || "INR",
          count: row._count._all,
          gross: toNumber(row._sum.amountPaid),
          refunded: toNumber(row._sum.refundedAmount),
          net: toNumber(row._sum.amountPaid) - toNumber(row._sum.refundedAmount),
        })))
      : null,
    recent: recent.map((record) => ({
      id: record.id,
      paymentId: record.razorpayPaymentId || record.razorpayOrderId,
      plan: record.planName || record.plan || "Unknown",
      amount: record.amountPaid,
      refundedAmount: record.refundedAmount,
      currency: record.currency,
      status: record.status,
      createdAt: record.createdAt,
      user: record.user,
    })),
  };
}

async function getDashboardSubscriptions(start, now) {
  const scope = getSubscriptionScope();
  const activeWhere = { ...scope, ...getActiveSubscriptionWhere(now) };
  const expiredWhere = {
    ...scope,
    OR: [
      { status: "expired" },
      {
        status: { in: ["active", "trialing"] },
        OR: [
          { endDate: { lte: now } },
          { currentPeriodEnd: { lte: now } },
        ],
      },
    ],
  };
  const selectedExpiryWhere = {
    ...scope,
    ...createdAtRange(start, now),
    status: { in: ["active", "trialing"] },
    OR: [
      { endDate: { lte: now } },
      { currentPeriodEnd: { lte: now } },
    ],
  };
  const [
    total,
    active,
    cancelled,
    expired,
    selectedTotal,
    statuses,
    selectedExpiredStatuses,
    byPlan,
    recent,
  ] =
    await Promise.all([
      prisma.subscription.count({ where: scope }),
      prisma.subscription.count({ where: activeWhere }),
      prisma.subscription.count({
        where: { ...scope, status: { in: ["cancelled", "canceled"] } },
      }),
      prisma.subscription.count({ where: expiredWhere }),
      prisma.subscription.count({ where: { ...scope, ...createdAtRange(start, now) } }),
      prisma.subscription.groupBy({
        by: ["status"],
        where: { ...scope, ...createdAtRange(start, now) },
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ["status"],
        where: selectedExpiryWhere,
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ["planId", "planKey"],
        where: activeWhere,
        _count: { _all: true },
        orderBy: { _count: { planKey: "desc" } },
      }),
      prisma.subscription.findMany({
        where: { ...scope, updatedAt: createdAtRange(start, now).createdAt },
        select: {
          id: true,
          status: true,
          planKey: true,
          endDate: true,
          currentPeriodEnd: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);
  const planIds = byPlan.map((row) => row.planId).filter(Boolean);
  const plans = planIds.length
    ? await prisma.subscriptionPlan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true },
      })
    : [];
  const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));

  const selectedExpiredByStatus = new Map(
    selectedExpiredStatuses.map((row) => [row.status, row._count._all]),
  );
  let selectedExpiredTotal = 0;
  const statusCounts = statuses
    .map((row) => {
      const count = row._count._all;
      if (["active", "trialing"].includes(row.status)) {
        const lapsed = selectedExpiredByStatus.get(row.status) || 0;
        selectedExpiredTotal += lapsed;
        return { status: row.status, count: count - lapsed };
      }
      if (row.status === "expired") selectedExpiredTotal += count;
      return { status: row.status || "Unknown", count };
    })
    .filter((row) => row.count > 0 && row.status !== "expired");
  if (selectedExpiredTotal > 0) {
    statusCounts.push({ status: "expired", count: selectedExpiredTotal });
  }

  return {
    total,
    active,
    cancelled,
    expired,
    selectedTotal,
    statuses: statusCounts,
    byPlan: byPlan.map((row) => ({
      plan: planNames.get(row.planId) || row.planKey || "Unknown",
      count: row._count._all,
    })),
    recent: recent.map((record) => ({
      id: record.id,
      status:
        ["active", "trialing"].includes(record.status.toLowerCase()) &&
        [record.endDate, record.currentPeriodEnd].some(
          (date) => date && date <= now,
        )
          ? "expired"
          : record.status,
      plan: record.plan?.name || record.planKey || "Unknown",
      updatedAt: record.updatedAt,
      user: record.user,
    })),
  };
}

export async function getManagerDashboardData(permissions, range) {
  const now = new Date();
  const selectedRange = getDashboardRange(range, now);
  const canViewUsers = permissions.VIEW_USERS === true;
  const canViewFiles = permissions.VIEW_USER_FILES === true;
  const canViewPayments = permissions.VIEW_PAYMENTS === true;
  const canViewSubscriptions = permissions.VIEW_SUBSCRIPTIONS === true;
  const canViewReports = permissions.VIEW_REPORTS === true;
  const canViewDashboardStats = permissions.VIEW_DASHBOARD_STATS === true;
  const [users, files, payments, subscriptions] = await Promise.all([
    canViewUsers
      ? runDashboardSection("users", () =>
          getDashboardUsers(selectedRange.start, now, canViewSubscriptions))
      : Promise.resolve(null),
    canViewFiles
      ? runDashboardSection("files", () =>
          getDashboardFiles(selectedRange.start, now))
      : Promise.resolve(null),
    canViewPayments
      ? runDashboardSection("payments", () =>
          getDashboardPayments(
            selectedRange.start,
            now,
            canViewReports,
          ))
      : Promise.resolve(null),
    canViewSubscriptions
      ? runDashboardSection("subscriptions", () =>
          getDashboardSubscriptions(selectedRange.start, now))
      : Promise.resolve(null),
  ]);
  const recentActivity = canViewReports
    ? [
        ...(users?.recent || []).map((user) => ({
          id: `user-${user.id}`,
          kind: "registration",
          label: user.name || user.email,
          detail: "Registered",
          at: user.createdAt,
          href: `/manager/users/${encodeURIComponent(user.id)}`,
        })),
        ...(files?.recent || []).map((file) => ({
          id: `file-${file.id}`,
          kind: "upload",
          label: file.name,
          detail: `Uploaded by ${file.user.name || file.user.email}`,
          at: file.createdAt,
          href: "/manager/files",
        })),
        ...(payments?.recent || []).map((payment) => ({
          id: `payment-${payment.id}`,
          kind: "payment",
          label: payment.paymentId,
          detail: `${payment.status} · ${payment.user.name || payment.user.email}`,
          at: payment.createdAt,
          href: "/manager/payments",
        })),
        ...(subscriptions?.recent || []).map((subscription) => ({
          id: `subscription-${subscription.id}`,
          kind: "subscription",
          label: subscription.plan,
          detail: `${subscription.status} · ${subscription.user.name || subscription.user.email}`,
          at: subscription.updatedAt,
          href: "/manager/subscriptions",
        })),
      ]
        .sort((first, second) => new Date(second.at) - new Date(first.at))
        .slice(0, 10)
    : null;

  return {
    range: selectedRange.key,
    dateBoundary: "UTC",
    permissions: {
      users: canViewUsers,
      files: canViewFiles,
      payments: canViewPayments,
      subscriptions: canViewSubscriptions,
      reports: canViewReports,
      dashboardStats: canViewDashboardStats,
    },
    users,
    files,
    payments: payments
      ? {
          ...payments,
          revenue: canViewReports
            ? {
                lifetime: payments.lifetimeRevenue,
                selected: payments.rangeRevenue,
                byPlan: payments.byPlan,
                trend: payments.trend,
              }
            : null,
        }
      : null,
    subscriptions,
    overall: canViewReports && canViewDashboardStats
      ? {
          users: canViewUsers ? users?.total ?? null : null,
          files: canViewFiles ? files?.total ?? null : null,
          storageBytes: canViewFiles ? files?.totalBytes ?? null : null,
          successfulPayments: canViewPayments ? payments?.totalSuccess ?? null : null,
          activeSubscriptions: canViewSubscriptions ? subscriptions?.active ?? null : null,
        }
      : null,
    recentActivity,
  };
}
