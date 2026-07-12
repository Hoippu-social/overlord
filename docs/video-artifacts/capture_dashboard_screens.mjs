import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  const require = createRequire(import.meta.url);
  ({ chromium } = require("playwright"));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;
const env = typeof process === "undefined" ? {} : process.env;
const baseUrl = env.DASHBOARD_CAPTURE_URL || "http://127.0.0.1:3001";
const guildId = env.DASHBOARD_CAPTURE_GUILD_ID || "video-demo-guild";
const secret = env.NEXTAUTH_SECRET || "dev-secret-change-me";

const now = Date.now();
const created = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();
const future = (minutesAhead) => new Date(now + minutesAhead * 60_000).toISOString();

const roles = [
  { id: "r-owner", name: "Owner", color: "#75f16a", position: 100 },
  { id: "r-admin", name: "Admin", color: "#8f5eff", position: 90 },
  { id: "r-mod", name: "Moderator", color: "#10b981", position: 70 },
  { id: "r-helper", name: "Support", color: "#f59e0b", position: 40 },
  { id: "r-muted", name: "Muted", color: "#f43f5e", position: 10 },
];

const channels = [
  { id: "cat-staff", name: "Staff", type: 4, position: 1, parentId: null },
  { id: "c-mod", name: "moderation", type: 0, position: 2, parentId: "cat-staff" },
  { id: "c-audit", name: "audit-log", type: 0, position: 3, parentId: "cat-staff" },
  { id: "c-support", name: "support", type: 0, position: 4, parentId: "cat-staff" },
  { id: "c-voice", name: "voice-hub", type: 2, position: 5, parentId: null },
  { id: "c-music", name: "music", type: 0, position: 6, parentId: null },
];

const builtInRuleKeys = [
  "flood",
  "repeated_messages",
  "banwords",
  "zalgo",
  "links",
  "advertising",
  "emoji_spam",
  "repeated_mentions",
  "emoji",
  "command_channels",
  "lines",
  "image_filter",
];

const aiCategories = [
  "toxicity",
  "harassment",
  "hate_discrimination",
  "threats_violence",
  "sexual_explicit",
  "scam_fraud",
  "self_harm_crisis",
  "doxxing_personal_data",
];

const users = {
  "u-system": { name: "Overlord", tag: "system" },
  "u-admin": { name: "Mira Control", tag: "mira#0001" },
  "u-target": { name: "Raid Signal", tag: "signal#4411" },
  "u-helper": { name: "Aki Support", tag: "aki#1188" },
};

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 7 * 24 * 60 * 60 * 1000 }));
  const sig = crypto.createHmac("sha256", secret).update(payload).digest();
  return `${base64Url(payload)}.${base64Url(sig)}`;
}

function json(route, data, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
}

function statsOverview() {
  return {
    cards: {
      totalMessages: 18420,
      totalVoiceSeconds: 312_600,
      memberChange: 326,
    },
    activityData: [
      { date: "Mon", messages: 1800, voice: 220 },
      { date: "Tue", messages: 2440, voice: 310 },
      { date: "Wed", messages: 2190, voice: 285 },
      { date: "Thu", messages: 3060, voice: 410 },
      { date: "Fri", messages: 3970, voice: 520 },
      { date: "Sat", messages: 2860, voice: 455 },
      { date: "Sun", messages: 2100, voice: 360 },
    ],
  };
}

function moderationConfig() {
  return {
    roles,
    channels,
    moderationConfig: {
      muteRoleId: "r-muted",
      ignoredChannels: ["c-music"],
      ignoredRoles: ["r-owner"],
      ignoredUsers: [],
      commandOnlyChannels: ["c-mod"],
    },
    commandRules: [],
    roleBindings: [
      { id: 1, roleId: "r-admin", title: "Control", accessLevel: 95, enabled: true, sortOrder: 0 },
      { id: 2, roleId: "r-mod", title: "Moderator", accessLevel: 70, enabled: true, sortOrder: 1 },
      { id: 3, roleId: "r-helper", title: "Support", accessLevel: 45, enabled: true, sortOrder: 2 },
    ],
    commandGrants: [],
    automodRules: builtInRuleKeys.map((ruleKey, index) => ({
      id: index + 1,
      guildId,
      ruleKey,
      enabled: ["flood", "repeated_messages", "links", "advertising", "emoji_spam"].includes(ruleKey),
      config: null,
    })),
    customRules: [
      {
        id: 1,
        guildId,
        name: "Hidden phishing links",
        ruleType: "regex",
        pattern: "\\[(?:https?:\\/\\/|[a-z0-9-]+\\.)",
        enabled: true,
        action: "DELETE",
        strikeWeight: 2,
        notes: "Blocks disguised markdown phishing links.",
      },
    ],
    sanctionSteps: [
      { id: 1, guildId, triggerStrikeCount: 1, actionType: "WARN", durationMinutes: null, enabled: true, sortOrder: 0 },
      { id: 2, guildId, triggerStrikeCount: 2, actionType: "TIMEOUT", durationMinutes: 60, enabled: true, sortOrder: 1 },
      { id: 3, guildId, triggerStrikeCount: 4, actionType: "BAN", durationMinutes: null, enabled: true, sortOrder: 2 },
    ],
    aiConfig: {
      enabled: true,
      provider: "openai",
      model: "omni-moderation-latest",
      defaultThreshold: 82,
      scanEdits: true,
      includedChannels: ["c-mod", "c-support"],
      excludedChannels: ["c-music"],
      exemptRoles: ["r-owner"],
      exemptUsers: [],
      customPolicyPrompt: "Prioritize raids, phishing, hate speech and doxxing.",
    },
    aiCategories: aiCategories.map((category, index) => ({
      id: index + 1,
      guildId,
      category,
      enabled: !["sexual_explicit", "self_harm_crisis"].includes(category),
      threshold: index % 2 ? 78 : 84,
      sortOrder: index,
    })),
    appealConfig: {
      enabled: true,
      appealChannelId: "c-support",
      pardonLogChannelId: "c-audit",
      allowUserAppeals: true,
      allowDirectPardon: true,
    },
    retentionPolicies: [],
    builtInRuleKeys,
    availableAiCategories: aiCategories,
  };
}

function moderationCases() {
  return {
    summary: { total: 143, active: 8, warnings: 92, timed: 17 },
    cases: [
      {
        id: 1,
        caseNumber: 1042,
        guildId,
        targetUserId: "u-target",
        actorUserId: "u-admin",
        actionType: "TIMEOUT",
        status: "ACTIVE",
        source: "automod",
        reason: "Repeated invite spam detected in public channels.",
        createdAt: created(18),
        expiresAt: future(42),
        targetProfile: users["u-target"],
        actorProfile: users["u-admin"],
        notes: [{ id: 1, note: "Pattern matched the anti-raid rule chain.", actorUserId: "u-admin", actorProfile: users["u-admin"], createdAt: created(12) }],
      },
      {
        id: 2,
        caseNumber: 1041,
        guildId,
        targetUserId: "u-helper",
        actorUserId: "u-admin",
        actionType: "WARN",
        status: "CLEARED",
        source: "manual",
        reason: "Context reviewed, false positive cleared.",
        createdAt: created(140),
        expiresAt: null,
        resolvedByUserId: "u-admin",
        targetProfile: users["u-helper"],
        actorProfile: users["u-admin"],
        resolvedByProfile: users["u-admin"],
        notes: [],
      },
    ],
  };
}

function ticketsData() {
  return {
    config: { enabled: true, logChannelId: "c-audit" },
    channels: {
      text: channels.filter((channel) => channel.type === 0),
      categories: channels.filter((channel) => channel.type === 4),
    },
    categories: [
      {
        id: 1,
        name: "Appeals",
        description: "Punishment appeals routed into the moderation loop.",
        channelId: "c-support",
        stats: { total: 92, active: 7 },
        saveHistory: true,
        mentionAgents: true,
        allowUserClose: false,
        enableRating: true,
        messagePayload: null,
        buttonText: "Open appeal",
        buttonEmoji: "⚖️",
        buttonStyle: "PRIMARY",
        systemManagedBy: "appeals",
        sortOrder: 1,
      },
      {
        id: 2,
        name: "Support",
        description: "General support and private routing.",
        channelId: "c-support",
        stats: { total: 318, active: 12 },
        saveHistory: true,
        mentionAgents: true,
        allowUserClose: true,
        enableRating: true,
        messagePayload: null,
        buttonText: "Get help",
        buttonEmoji: "🎫",
        buttonStyle: "SUCCESS",
        sortOrder: 2,
      },
    ],
    globalStats: {
      open: 12,
      onHold: 4,
      closed: 184,
      total: 200,
      avgResolutionMins: 18,
      ratings: { positive: 83, neutral: 9, negative: 4, total: 96 },
      categoryPieData: [
        { name: "Support", value: 114 },
        { name: "Appeals", value: 52 },
        { name: "Reports", value: 34 },
      ],
    },
    activityData: [
      { date: "Mon", created: 18, solved: 16 },
      { date: "Tue", created: 24, solved: 19 },
      { date: "Wed", created: 21, solved: 23 },
      { date: "Thu", created: 32, solved: 25 },
      { date: "Fri", created: 28, solved: 31 },
      { date: "Sat", created: 16, solved: 18 },
      { date: "Sun", created: 14, solved: 17 },
    ],
  };
}

async function handleApi(route) {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;

  if (pathname === "/api/auth/session") {
    return json(route, {
      user: { id: "u-admin", name: "Demo Admin", image: null },
      expires: new Date(now + 60 * 60 * 1000).toISOString(),
    });
  }

  if (pathname === "/api/guilds") {
    return json(route, [{ id: guildId, name: "North Star Community", icon: null }]);
  }

  if (pathname === `/api/guilds/${guildId}`) {
    return json(route, {
      guild: { id: guildId, name: "North Star Community", icon: null },
      counts: { roles: 42, voiceChannels: 18, textChannels: 76, totalChannels: 94, members: 12840, onlineMembers: 1840 },
      lastSyncedAt: created(2),
    });
  }

  if (pathname === `/api/guilds/${guildId}/access`) return json(route, { ok: true });
  if (pathname === `/api/guilds/${guildId}/bot-settings`) return json(route, { config: { timezone: "Europe/Kiev" } });
  if (pathname === "/api/system") return json(route, { cpu: 24, memory: 784, ping: 42, uptime: "14d 06h", botStatus: "ONLINE" });

  if (pathname === `/api/guilds/${guildId}/audit/events`) {
    return json(route, {
      events: [
        { id: 1, tag: "bot_event", actorId: "u-system", payload: JSON.stringify({ event: "automod policy armed" }), createdAt: created(4) },
        { id: 2, tag: "channels", actorId: "u-admin", channelId: "c-support", payload: JSON.stringify({ event: "CHANNEL_UPDATE" }), createdAt: created(11) },
        { id: 3, tag: "warn", actorId: "u-admin", targetId: "u-target", payload: JSON.stringify({ event: "WARN_CREATE" }), createdAt: created(18) },
        { id: 4, tag: "dashboard_event", actorId: "u-admin", payload: JSON.stringify({ event: "tickets sla reviewed" }), createdAt: created(26) },
      ],
    });
  }

  if (pathname === `/api/guilds/${guildId}/enrich`) {
    return json(route, {
      users,
      channels: {
        "c-mod": { id: "c-mod", name: "moderation", type: 0 },
        "c-audit": { id: "c-audit", name: "audit-log", type: 0 },
        "c-support": { id: "c-support", name: "support", type: 0 },
      },
    });
  }

  if (pathname === `/api/guilds/${guildId}/music/queue`) {
    return json(route, {
      queue: {
        current: { title: "Server Pulse", author: "Overlord Radio", durationMs: 214_000, positionMs: 78_000, sourceName: "local" },
        tracks: [
          { title: "Night Ops", author: "Queue", durationMs: 190_000 },
          { title: "Signal Clean", author: "Queue", durationMs: 204_000 },
        ],
        paused: false,
        volume: 64,
        positionMs: 78_000,
        repeatMode: "off",
      },
    });
  }

  if (pathname === `/api/guilds/${guildId}/stats`) return json(route, statsOverview());
  if (pathname === `/api/guilds/${guildId}/moderation/config`) return json(route, moderationConfig());
  if (pathname === `/api/guilds/${guildId}/moderation/cases`) return json(route, moderationCases());
  if (pathname === `/api/guilds/${guildId}/moderation/ai/incidents`) return json(route, { summary: { total: 37, open: 5, falsePositive: 2, confirmed: 30 }, incidents: [] });
  if (pathname === `/api/guilds/${guildId}/moderation/appeals/tickets`) return json(route, { summary: { total: 22, open: 4, inReview: 3, accepted: 11, rejected: 4 }, tickets: [] });
  if (pathname === `/api/guilds/${guildId}/moderation/analytics`) {
    return json(route, {
      windowDays: 30,
      summary: { totalModeratorActions: 812, totalAiReviews: 1840, totalAppealReviews: 22, uniqueModerators: 9 },
      moderators: [],
    });
  }

  if (pathname === `/api/guilds/${guildId}/tickets`) return json(route, ticketsData());
  if (pathname.startsWith(`/api/guilds/${guildId}/tickets/`)) return json(route, {});

  return json(route, {});
}

async function capture(page, routePath, filename, waitMs = 3200) {
  await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: path.join(outDir, filename), fullPage: false });
}

async function findBrowserExecutable() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  return null;
}

await fs.mkdir(outDir, { recursive: true });

const executablePath = await findBrowserExecutable();
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1512, height: 982 },
  deviceScaleFactor: 1,
});
await context.addInitScript(() => {
  window.localStorage.setItem("dashboardLocale", "en");
});

const host = new URL(baseUrl).hostname;
await context.addCookies([
  {
    name: "session",
    value: createSessionToken(),
    domain: host,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: false,
    expires: Math.floor((now + 7 * 24 * 60 * 60 * 1000) / 1000),
  },
]);

const page = await context.newPage();
page.setDefaultTimeout(45_000);
await page.addInitScript(() => {
  window.localStorage.setItem("dashboardLocale", "en");
});
await context.route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith("/api/")) {
    return handleApi(route);
  }
  return route.continue();
});

const targets = [
  [`/dashboard/${guildId}`, "dashboard-hub.png", 3600],
  [`/dashboard/${guildId}/stats`, "dashboard-stats.png", 2800],
  [`/dashboard/${guildId}/moderation`, "dashboard-moderation.png", 3200],
  [`/dashboard/${guildId}/tickets`, "dashboard-tickets.png", 3200],
];

for (const [routePath, filename, waitMs] of targets) {
  try {
    await capture(page, routePath, filename, waitMs);
    console.log(`captured ${filename}`);
  } catch (error) {
    console.warn(`failed to capture ${filename}: ${error.message}`);
  }
}

await browser.close();
