export type RoleOption = { id: string; name: string; color?: string | number; position?: number; };
export type ChannelOption = { id: string; name: string; type?: number | string; position?: number; parentId?: string | null; isCategory?: boolean; categoryName?: string | null; };

export type ModerationConfig = {
    muteRoleId: string;
    ignoredChannels: string[];
    ignoredRoles: string[];
    ignoredUsers: string[];
    commandOnlyChannels: string[];
};

export type AutomodFloodWindowUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export type AutomodFloodAction = {
    messageCount: number;
    action: string;
    durationText: string;
};

export type AutomodActionConfig = {
    action: string;
    durationText: string;
};

export type AutomodFloodConfig = {
    windowValue: number;
    windowUnit: AutomodFloodWindowUnit;
    actions: AutomodFloodAction[];
    ignoredChannels: string[];
    ignoredRoles: string[];
};

export type AutomodZalgoConfig = {
    percent: number;
    ignoredChannels: string[];
    actions: AutomodFloodAction[];
};

export type AutomodEmojiConfig = {
    emojiOnlyChannelIds: string[];
    denyEmojiChannelIds: string[];
    actions: AutomodFloodAction[];
};

export type AutomodEmojiSpamConfig = {
    count: number;
    ignoredChannels: string[];
    actions: AutomodFloodAction[];
};

export type AutomodSpamScope = 'channel' | 'server';

export type AutomodSpamConfig = {
    scope: AutomodSpamScope;
    windowValue: number;
    windowUnit: AutomodFloodWindowUnit;
    ignoredChannels: string[];
    actions: AutomodFloodAction[];
};

export type AutomodMentionSpamConfig = {
    userMentions: boolean;
    roleMentions: boolean;
    ignoredChannels: string[];
    windowValue: number;
    windowUnit: AutomodFloodWindowUnit;
    actions: AutomodFloodAction[];
};

export type AutomodLinesConfig = {
    count: number;
    ignoredChannels: string[];
    actions: AutomodActionConfig[];
};

export type AutomodLinksMode = 'allowlist' | 'blocklist';

export type AutomodLinksConfig = {
    mode: AutomodLinksMode;
    ignoredChannels: string[];
    domains: string[];
    actions: AutomodActionConfig[];
};

export type AutomodBanwordsConfig = {
    ignoredChannels: string[];
    ignoredRoles: string[];
    words: string[];
    matchWholeWordsOnly: boolean;
    ignoreCase: boolean;
    actions: AutomodActionConfig[];
};

export type AutomodCommandChannelsMode = 'allowlist' | 'blocklist';

export type AutomodCommandChannelsConfig = {
    mode: AutomodCommandChannelsMode;
    channelIds: string[];
    actions: AutomodActionConfig[];
};

export type AutomodAdvertisingCategoryConfig = {
    enabled: boolean;
    actions: AutomodActionConfig[];
};

export type AutomodAdvertisingReferralConfig = AutomodAdvertisingCategoryConfig & {
    customDomains: string[];
    customPhrases: string[];
    customCodeTokens: string[];
};

export type AutomodAdvertisingScamLinksConfig = AutomodAdvertisingCategoryConfig & {
    customDomains: string[];
    customPhrases: string[];
};

export type AutomodAdvertisingConfig = {
    ignoredChannels: string[];
    discordInvites: AutomodAdvertisingCategoryConfig;
    referrals: AutomodAdvertisingReferralConfig;
    scamLinks: AutomodAdvertisingScamLinksConfig;
};

export type AutomodImageFilterConfig = {
    ignoredChannels: string[];
    imageOnlyChannelIds: string[];
    denyImageChannelIds: string[];
    actions: AutomodActionConfig[];
};

export type RoleBinding = {
    roleId: string;
    title: string;
    accessLevel: number;
    enabled: boolean;
    sortOrder: number;
};

export type CommandRuleMode = 'WHITELIST' | 'BLACKLIST';

export type CommandGrant = {
    roleId: string;
    scopeType: 'COMMAND' | 'GROUP';
    scopeKey: string;
    effect: 'ALLOW' | 'DENY';
};

export type CommandRule = {
    commandKey: string;
    enabled: boolean;
    roleMode: CommandRuleMode;
    roleIds: string[];
    channelMode: CommandRuleMode;
    channelIds: string[];
    requiredAccessLevel: number | null;
};

export type AutomodRule = {
    ruleKey: string;
    enabled: boolean;
    configText: string;
    floodConfig?: AutomodFloodConfig;
    zalgoConfig?: AutomodZalgoConfig;
    emojiConfig?: AutomodEmojiConfig;
    emojiSpamConfig?: AutomodEmojiSpamConfig;
    spamConfig?: AutomodSpamConfig;
    mentionSpamConfig?: AutomodMentionSpamConfig;
    linesConfig?: AutomodLinesConfig;
    linksConfig?: AutomodLinksConfig;
    banwordsConfig?: AutomodBanwordsConfig;
    advertisingConfig?: AutomodAdvertisingConfig;
    commandChannelsConfig?: AutomodCommandChannelsConfig;
    imageFilterConfig?: AutomodImageFilterConfig;
};

export type CustomRule = {
    name: string;
    ruleType: string;
    pattern: string;
    enabled: boolean;
    action: string;
    strikeWeight: number;
    notes: string;
};

export type SanctionStep = {
    triggerStrikeCount: number;
    actionType: string;
    durationMinutes: number | null;
    enabled: boolean;
    sortOrder: number;
};

export type AiConfig = {
    enabled: boolean;
    provider: string;
    model: string;
    defaultThreshold: number;
    scanEdits: boolean;
    includedChannels: string[];
    excludedChannels: string[];
    exemptRoles: string[];
    exemptUsers: string[];
    customPolicyPrompt: string;
};

export type AiCategoryRule = {
    category: string;
    enabled: boolean;
    threshold: number;
    sortOrder: number;
};

export type AppealConfig = {
    enabled: boolean;
    appealChannelId: string;
    pardonLogChannelId: string;
    allowUserAppeals: boolean;
    allowDirectPardon: boolean;
};

export type RetentionPolicy = {
    category: string;
    strategy: string;
    ttlDays: number | null;
    enabled: boolean;
};

export type ConfigState = {
    roles: RoleOption[];
    channels: ChannelOption[];
    moderationConfig: ModerationConfig;
    roleBindings: RoleBinding[];
    commandGrants: CommandGrant[];
    commandRules: CommandRule[];
    automodRules: AutomodRule[];
    customRules: CustomRule[];
    sanctionSteps: SanctionStep[];
    aiConfig: AiConfig;
    aiCategories: AiCategoryRule[];
    appealConfig: AppealConfig;
    retentionPolicies: RetentionPolicy[];
};

// -- Cases & Incidents & Appeals

export type CaseNote = {
    id: number;
    actorUserId: string;
    actorProfile?: {
        id: string;
        name: string;
        username: string;
        tag: string;
        avatar: string | null;
        globalName?: string | null;
    } | null;
    note: string;
    createdAt: string;
};

export type ModerationCase = {
    id: number;
    caseNumber: number;
    actionType: string;
    status: string;
    source: string;
    actorUserId: string | null;
    actorProfile?: {
        id: string;
        name: string;
        username: string;
        tag: string;
        avatar: string | null;
        globalName?: string | null;
    } | null;
    targetUserId: string;
    targetProfile?: {
        id: string;
        name: string;
        username: string;
        tag: string;
        avatar: string | null;
        globalName?: string | null;
    } | null;
    resolvedByUserId?: string | null;
    resolvedByProfile?: {
        id: string;
        name: string;
        username: string;
        tag: string;
        avatar: string | null;
        globalName?: string | null;
    } | null;
    resolvedAt?: string | null;
    resolutionType?: string | null;
    resolutionReason?: string | null;
    reason: string | null;
    createdAt: string;
    expiresAt?: string | null;
    relatedCaseId?: number | null;
    relatedCase?: {
        id: number;
        caseNumber: number;
        actionType: string;
        status: string;
    } | null;
    linkedCases?: Array<{
        id: number;
        caseNumber: number;
        actionType: string;
        status: string;
        source: string;
        targetUserId: string;
        actorUserId: string | null;
        createdAt: string;
        relatedCaseId?: number | null;
    }>;
    metadata?: Record<string, unknown> | null;
    notes?: CaseNote[];
};

export type CasesState = {
    summary: {
        total: number;
        active: number;
        warnings: number;
        timed: number;
    };
    cases: ModerationCase[];
};

export type AiIncidentCategory = {
    category: string;
    score: number;
};

export type AiIncident = {
    id: number;
    messageId: string;
    channelId: string;
    authorId: string;
    excerpt: string | null;
    summary: string | null;
    categories: AiIncidentCategory[];
    provider: string | null;
    model: string | null;
    confidence: number | null;
    status: string;
    reviewerId?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
};

export type AiIncidentState = {
    summary: {
        total: number;
        open: number;
        falsePositive: number;
        confirmed: number;
    };
    incidents: AiIncident[];
};

export type AppealTicket = {
    id: number;
    caseId: number;
    caseNumber: number;
    userId: string;
    appealType: string;
    status: string;
    message: string;
    resolutionNote?: string | null;
    reviewerId?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    moderationCase: {
        id: number;
        caseNumber: number;
        actionType: string;
        status: string;
        targetUserId: string;
        actorUserId?: string | null;
    };
};

export type AppealTicketState = {
    summary: {
        total: number;
        open: number;
        inReview: number;
        accepted: number;
        rejected: number;
    };
    tickets: AppealTicket[];
};

export type AppealReviewDecision = 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'PARDONED';

// -- Analytics

export type ModeratorAnalyticsRow = {
    moderatorId: string;
    moderatorProfile?: {
        id: string;
        name: string;
        username: string;
        tag: string;
        avatar: string | null;
        globalName?: string | null;
        roleName?: string | null;
        roleColor?: number | null;
    } | null;
    totalActions: number;
    activeCases: number;
    warns: number;
    timeouts: number;
    bans: number;
    mutes: number;
    kicks: number;
    reversals: number;
    aiReviews: number;
    falsePositives: number;
    falsePositiveRate: number;
    appealsReviewed: number;
    acceptedAppeals: number;
    rejectedAppeals: number;
    relatedAppealTickets: number;
    activeRelatedAppealTickets: number;
    avgAiReviewMinutes: number | null;
    avgAppealReviewHours: number | null;
};

export type AnalyticsState = {
    windowDays: number;
    summary: {
        totalModeratorActions: number;
        totalAiReviews: number;
        totalAppealReviews: number;
        uniqueModerators: number;
    };
    moderators: ModeratorAnalyticsRow[];
};
